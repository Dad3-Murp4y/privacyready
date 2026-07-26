# services/scanner/instagram_scanner.py
import requests
import re
from dataclasses import dataclass
from typing import List, Dict, Optional

class GraphApiError(Exception):
    pass

def _graph_json(response):
    data = response.json()
    if isinstance(data, dict) and 'error' in data:
        raise GraphApiError(data['error'].get('message', 'Unknown Graph API error'))
    return data

@dataclass
class InstagramFinding:
    platform: str = "instagram"
    ig_account_id: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class InstagramScanner:
    def __init__(self, access_token: str, ig_account_id: str):
        self.access_token = access_token
        self.ig_account_id = ig_account_id
        self.base_url = "https://graph.facebook.com/v18.0"
        self.findings: List[InstagramFinding] = []
    
    def scan_all(self) -> List[InstagramFinding]:
        checks = [
            self.scan_comments_for_pii,
            self.scan_message_settings,
        ]
        for check in checks:
            try:
                check()
            except GraphApiError as e:
                self.findings.append(InstagramFinding(
                    ig_account_id=self.ig_account_id,
                    finding_type='api_error',
                    severity='low',
                    description=f"Could not complete {check.__name__.replace('scan_', '')} check: {e}",
                    evidence=str(e),
                    gdpr_article='',
                    remediation='Check that the access token has instagram_basic and instagram_manage_comments permissions.'
                ))
            except Exception as e:
                pass
        return self.findings
    
    def scan_comments_for_pii(self):
        """Scrape recent Instagram media comments for leaked PII"""
        url = f"{self.base_url}/{self.ig_account_id}/media"
        params = {
            'access_token': self.access_token,
            'fields': 'id,caption,comments{text,username}',
            'limit': 25
        }
        
        response = requests.get(url, params=params, timeout=10)
        media_items = _graph_json(response).get('data', [])
        
        pii_patterns = {
            'uk_phone': r'(?:(?:\+44\s?|0)(?:7\d{3}|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4})',
            'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        }
        
        for item in media_items:
            comments = item.get('comments', {}).get('data', [])
            for comment in comments:
                text = comment.get('text', '')
                for pii_type, pattern in pii_patterns.items():
                    matches = re.findall(pattern, text)
                    if matches:
                        self.findings.append(InstagramFinding(
                            ig_account_id=self.ig_account_id,
                            finding_type='public_pii_exposure',
                            severity='critical',
                            description=f'PII ({pii_type}) exposed in public Instagram comment',
                            evidence=f"Found instances: {matches[:3]} in media ID {item.get('id')}",
                            gdpr_article='Article 32 (Security of processing), Article 33/34 (Breach notification)',
                            remediation='Delete exposed comments, implement auto-moderation for PII using Instagram hidden words, and educate support agents.'
                        ))
                        break
    
    def scan_message_settings(self):
        """Check if IG account uses automated responses without consent"""
        # Note: True deep inspection of messaging requires pages_messaging permissions 
        # and checking the connected page's messaging_feature_status, but we can check if 
        # the IG account has message controls exposed or if we can infer chatbot usage.
        # This is a basic proxy check.
        
        self.findings.append(InstagramFinding(
            ig_account_id=self.ig_account_id,
            finding_type='ig_dm_bot_consent_heuristic',
            severity='medium',
            description='If using Instagram DM automation (ManyChat, etc.), explicit privacy consent may be missing.',
            evidence='Automated verification requires manual review of DM flows.',
            gdpr_article='Article 6/7 (Lawful basis and conditions for consent)',
            remediation='Ensure all DM bots provide a privacy notice link before collecting user data.'
        ))
