# services/scanner/facebook_scanner.py
import requests
import re
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime


class GraphApiError(Exception):
    """Raised when the Graph API itself returns an error object, so callers
    can't mistake 'the API call failed' for 'this page has no data here'."""
    pass


def _graph_json(response):
    """Parse a Graph API response, raising GraphApiError if Facebook
    returned an error object. Previously every scan_* method did
    `response.json().get('data', [])` directly -- since an error response
    has no 'data' key, that silently produced an empty list and the scan
    reported a false-clean result instead of surfacing the failure."""
    data = response.json()
    if isinstance(data, dict) and 'error' in data:
        raise GraphApiError(data['error'].get('message', 'Unknown Graph API error'))
    return data


@dataclass
class FacebookFinding:
    platform: str = "facebook"
    page_id: str = ""
    page_name: str = ""
    finding_type: str = ""  # lead_form, messenger_bot, pixel, comment_pii, etc.
    severity: str = ""      # critical, high, medium, low
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""  # Which GDPR article is violated
    remediation: str = ""

class FacebookScanner:
    def __init__(self, access_token: str, page_id: str):
        self.access_token = access_token
        self.page_id = page_id
        self.base_url = "https://graph.facebook.com/v18.0"
        self.findings: List[FacebookFinding] = []
    
    def scan_all(self) -> List[FacebookFinding]:
        """Run complete Facebook GDPR audit. Each check runs independently --
        one Graph API call failing (expired token, missing permission, etc.)
        is recorded as its own finding rather than either being silently
        treated as 'no data here' or aborting every other check."""
        checks = [
            self.scan_lead_forms,
            self.scan_messenger_settings,
            self.scan_pixel_configuration,
            self.scan_page_posts_for_pii,
            self.scan_custom_audiences,
            self.scan_group_memberships,
        ]
        for check in checks:
            try:
                check()
            except GraphApiError as e:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='api_error',
                    severity='low',
                    description=f"Could not complete {check.__name__.replace('scan_', '')} check: {e}",
                    evidence=str(e),
                    gdpr_article='',
                    remediation='Check that the Facebook access token has the required permissions and has not expired'
                ))
        return self.findings
    
    def scan_lead_forms(self):
        """Check if lead forms have consent checkboxes"""
        url = f"{self.base_url}/{self.page_id}/leadgen_forms"
        params = {
            'access_token': self.access_token,
            'fields': 'id,name,questions,privacy_policy_url,tracking_parameters'
        }
        
        response = requests.get(url, params=params, timeout=10)
        forms = _graph_json(response).get('data', [])
        
        for form in forms:
            # Check for privacy policy link
            has_privacy = bool(form.get('privacy_policy_url'))
            
            # Check questions for sensitive data
            questions = form.get('questions', [])
            sensitive_fields = self._detect_sensitive_fields(questions)
            
            # Check for consent checkbox
            has_consent = any(
                q.get('key') in ['consent', 'agree', 'terms', 'gdpr_consent']
                for q in questions
            )
            
            if not has_privacy or not has_consent:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    page_name=form.get('name', 'Unknown'),
                    finding_type='lead_form_missing_consent',
                    severity='critical' if sensitive_fields else 'high',
                    description=f"Lead form '{form.get('name')}' collects data without proper consent",
                    evidence=f"Privacy policy: {has_privacy}, Consent checkbox: {has_consent}, Sensitive fields: {sensitive_fields}",
                    gdpr_article='Article 6/7 (Lawful basis and conditions for consent), Article 5(1)(c) (Data minimisation)',
                    remediation='Add privacy policy link and explicit consent checkbox before form submission'
                ))
    
    def scan_messenger_settings(self):
        """Check Messenger bot data handling"""
        url = f"{self.base_url}/{self.page_id}/messaging_feature_status"
        params = {'access_token': self.access_token}
        
        response = requests.get(url, params=params, timeout=10)
        settings = _graph_json(response)
        
        # Check if automated responses collect PII
        if settings.get('chat_plugin', {}).get('enabled'):
            self.findings.append(FacebookFinding(
                page_id=self.page_id,
                finding_type='messenger_chat_plugin',
                severity='medium',
                description='Messenger chat plugin enabled — conversations may contain PII without consent',
                evidence='Chat plugin is active on website',
                gdpr_article='Article 6/7 (Lawful basis and conditions for consent)',
                remediation='Add pre-chat consent message: "By continuing, you agree to our privacy policy"'
            ))
    
    def scan_pixel_configuration(self):
        """Check Facebook Pixel data collection"""
        url = f"{self.base_url}/{self.page_id}/events"
        params = {
            'access_token': self.access_token,
            'fields': 'data_sources{name,type,automatic_matching_fields}'
        }
        
        response = requests.get(url, params=params, timeout=10)
        pixels = _graph_json(response).get('data', [])
        
        for pixel in pixels:
            auto_match = pixel.get('automatic_matching_fields', [])
            if auto_match:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='pixel_advanced_matching',
                    severity='high',
                    description='Facebook Pixel using Advanced Matching without explicit consent',
                    evidence=f"Auto-matching fields: {auto_match}",
                    gdpr_article='Article 6/7 (Lawful basis and conditions for consent), Article 32 (Security of processing)',
                    remediation='Implement consent banner before pixel fires; disable auto-matching until consent'
                ))
    
    def scan_page_posts_for_pii(self):
        """Scrape public posts for leaked PII in comments"""
        url = f"{self.base_url}/{self.page_id}/posts"
        params = {
            'access_token': self.access_token,
            'fields': 'message,comments{message,from}',
            'limit': 100
        }
        
        response = requests.get(url, params=params, timeout=10)
        posts = _graph_json(response).get('data', [])
        
        pii_patterns = {
            'uk_phone': r'(?:(?:\+44\s?|0)(?:7\d{3}|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4})',
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            'ni_number': r'\b[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}\d{6}[A-D]{1}\b',  # UK National Insurance number
            'sort_code': r'\b\d{2}-\d{2}-\d{2}\b',  # UK bank sort code
        }
        
        for post in posts:
            content = post.get('message', '')
            comments = post.get('comments', {}).get('data', [])
            
            for comment in comments:
                comment_text = comment.get('message', '')
                full_text = content + ' ' + comment_text
                
                for pii_type, pattern in pii_patterns.items():
                    matches = re.findall(pattern, full_text)
                    if matches:
                        self.findings.append(FacebookFinding(
                            page_id=self.page_id,
                            finding_type='public_pii_exposure',
                            severity='critical',
                            description=f'PII ({pii_type}) exposed in public post/comment',
                            evidence=f"Found {len(matches)} instances: {matches[:3]}",
                            gdpr_article='Article 32 (Security of processing), Article 33/34 (Breach notification)',
                            remediation='Delete exposed comments, implement auto-moderation for PII, educate agents'
                        ))
                        break  # One finding per post is enough
    
    def scan_custom_audiences(self):
        """Check if custom audiences are properly sourced"""
        url = f"{self.base_url}/{self.page_id}/customaudiences"
        params = {
            'access_token': self.access_token,
            'fields': 'name,approximate_count,data_source,operation_status'
        }
        
        response = requests.get(url, params=params, timeout=10)
        audiences = _graph_json(response).get('data', [])
        
        for audience in audiences:
            source = audience.get('data_source', {}).get('type', 'unknown')
            if source in ['UNKNOWN', 'FILE_IMPORTED', 'MULTIPLE']:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='custom_audience_unverified_source',
                    severity='high',
                    description=f"Custom audience '{audience.get('name')}' has unverified data source",
                    evidence=f"Data source: {source}",
                    gdpr_article='Article 6/7 (Lawful basis), Article 5(1)(d) (Accuracy)',
                    remediation='Document consent for every contact in audience; remove contacts without consent proof'
                ))
    
    def scan_group_memberships(self):
        """Check groups for member data exposure"""
        url = f"{self.base_url}/{self.page_id}/groups"
        params = {
            'access_token': self.access_token,
            'fields': 'name,member_count,privacy,admins'
        }
        
        response = requests.get(url, params=params, timeout=10)
        groups = _graph_json(response).get('data', [])
        
        for group in groups:
            if group.get('privacy') == 'PUBLIC' and group.get('member_count', 0) > 1000:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='large_public_group',
                    severity='medium',
                    description=f"Large public group '{group.get('name')}' may expose member data",
                    evidence=f"Members: {group.get('member_count')}, Privacy: {group.get('privacy')}",
                    gdpr_article='Article 32 (Security of processing)',
                    remediation='Convert to private group or implement member approval with privacy notice'
                ))
    
    def _detect_sensitive_fields(self, questions: List[Dict]) -> List[str]:
        """Detect sensitive data fields in form questions"""
        sensitive_keywords = {
            'national_id': ['national insurance', 'ni number', 'passport number', 'driving licence'],
            'income': ['salary', 'income', 'annual earnings'],
            'bank': ['bank', 'account number', 'sort code'],
            'family': ['family', 'spouse', 'next of kin', 'dependents'],
        }
        
        found = []
        for q in questions:
            text = (q.get('label', '') + ' ' + q.get('key', '')).lower()
            for category, keywords in sensitive_keywords.items():
                if any(kw in text for kw in keywords):
                    found.append(category)
        return found