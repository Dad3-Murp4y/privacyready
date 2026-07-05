# services/scanner/facebook_scanner.py
import requests
import re
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime

@dataclass
class FacebookFinding:
    platform: str = "facebook"
    page_id: str = ""
    page_name: str = ""
    finding_type: str = ""  # lead_form, messenger_bot, pixel, comment_pii, etc.
    severity: str = ""      # critical, high, medium, low
    description: str = ""
    evidence: str = ""
    pdpa_article: str = ""  # Which PDPA article is violated
    remediation: str = ""

class FacebookScanner:
    def __init__(self, access_token: str, page_id: str):
        self.access_token = access_token
        self.page_id = page_id
        self.base_url = "https://graph.facebook.com/v18.0"
        self.findings: List[FacebookFinding] = []
    
    def scan_all(self) -> List[FacebookFinding]:
        """Run complete Facebook PDPA audit"""
        self.scan_lead_forms()
        self.scan_messenger_settings()
        self.scan_pixel_configuration()
        self.scan_page_posts_for_pii()
        self.scan_custom_audiences()
        self.scan_group_memberships()
        return self.findings
    
    def scan_lead_forms(self):
        """Check if lead forms have consent checkboxes"""
        url = f"{self.base_url}/{self.page_id}/leadgen_forms"
        params = {
            'access_token': self.access_token,
            'fields': 'id,name,questions,privacy_policy_url,tracking_parameters'
        }
        
        response = requests.get(url, params=params, timeout=10)
        forms = response.json().get('data', [])
        
        for form in forms:
            # Check for privacy policy link
            has_privacy = bool(form.get('privacy_policy_url'))
            
            # Check questions for sensitive data
            questions = form.get('questions', [])
            sensitive_fields = self._detect_sensitive_fields(questions)
            
            # Check for consent checkbox
            has_consent = any(
                q.get('key') in ['consent', 'agree', 'terms', 'ยินยอม'] 
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
                    pdpa_article='Article 19 (Consent), Article 23 (Collection limitation)',
                    remediation='Add privacy policy link and explicit consent checkbox before form submission'
                ))
    
    def scan_messenger_settings(self):
        """Check Messenger bot data handling"""
        url = f"{self.base_url}/{self.page_id}/messaging_feature_status"
        params = {'access_token': self.access_token}
        
        response = requests.get(url, params=params, timeout=10)
        settings = response.json()
        
        # Check if automated responses collect PII
        if settings.get('chat_plugin', {}).get('enabled'):
            self.findings.append(FacebookFinding(
                page_id=self.page_id,
                finding_type='messenger_chat_plugin',
                severity='medium',
                description='Messenger chat plugin enabled — conversations may contain PII without consent',
                evidence='Chat plugin is active on website',
                pdpa_article='Article 19 (Consent)',
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
        pixels = response.json().get('data', [])
        
        for pixel in pixels:
            auto_match = pixel.get('automatic_matching_fields', [])
            if auto_match:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='pixel_advanced_matching',
                    severity='high',
                    description='Facebook Pixel using Advanced Matching without explicit consent',
                    evidence=f"Auto-matching fields: {auto_match}",
                    pdpa_article='Article 19 (Consent), Article 37 (Security)',
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
        posts = response.json().get('data', [])
        
        pii_patterns = {
            'thai_phone': r'0[689]\d{8}',
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            'thai_id': r'\d{1}-\d{4}-\d{5}-\d{2}-\d{1}',  # Thai ID format
            'line_id': r'(?i)line[:\s]*[@]?[a-z0-9_]+',
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
                            pdpa_article='Article 37 (Security), Article 41 (Data breach notification)',
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
        audiences = response.json().get('data', [])
        
        for audience in audiences:
            source = audience.get('data_source', {}).get('type', 'unknown')
            if source in ['UNKNOWN', 'FILE_IMPORTED', 'MULTIPLE']:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='custom_audience_unverified_source',
                    severity='high',
                    description=f"Custom audience '{audience.get('name')}' has unverified data source",
                    evidence=f"Data source: {source}",
                    pdpa_article='Article 19 (Consent), Article 25 (Data quality)',
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
        groups = response.json().get('data', [])
        
        for group in groups:
            if group.get('privacy') == 'PUBLIC' and group.get('member_count', 0) > 1000:
                self.findings.append(FacebookFinding(
                    page_id=self.page_id,
                    finding_type='large_public_group',
                    severity='medium',
                    description=f"Large public group '{group.get('name')}' may expose member data",
                    evidence=f"Members: {group.get('member_count')}, Privacy: {group.get('privacy')}",
                    pdpa_article='Article 37 (Security)',
                    remediation='Convert to private group or implement member approval with privacy notice'
                ))
    
    def _detect_sensitive_fields(self, questions: List[Dict]) -> List[str]:
        """Detect sensitive data fields in form questions"""
        sensitive_keywords = {
            'id_card': ['id', 'บัตรประชาชน', 'id card', 'citizen'],
            'income': ['salary', 'รายได้', 'income', 'เงินเดือน'],
            'bank': ['bank', 'ธนาคาร', 'account number', 'เลขบัญชี'],
            'family': ['family', 'spouse', 'relative', 'คู่สมรส', 'บุตร'],
        }
        
        found = []
        for q in questions:
            text = (q.get('label', '') + ' ' + q.get('key', '')).lower()
            for category, keywords in sensitive_keywords.items():
                if any(kw in text for kw in keywords):
                    found.append(category)
        return found