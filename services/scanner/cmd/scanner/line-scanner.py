# services/scanner/line_scanner.py
import requests
import json
from dataclasses import dataclass
from typing import List, Dict

@dataclass
class LINEFinding:
    platform: str = "line"
    channel_id: str = ""
    channel_name: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class LINEScanner:
    def __init__(self, channel_access_token: str, channel_id: str):
        self.channel_access_token = channel_access_token
        self.channel_id = channel_id
        self.base_url = "https://api.line.me/v2"
        self.findings: List[LINEFinding] = []
    
    def scan_all(self) -> List[LINEFinding]:
        self.scan_rich_menu_consent()
        self.scan_auto_reply_settings()
        self.scan_chat_history_retention()
        self.scan_member_profile_access()
        self.scan_login_permissions()
        self.scan_group_settings()
        return self.findings
    
    def scan_rich_menu_consent(self):
        """Check if rich menus have privacy notices"""
        url = f"{self.base_url}/bot/richmenu/list"
        headers = {'Authorization': f'Bearer {self.channel_access_token}'}
        
        response = requests.get(url, headers=headers, timeout=10)
        menus = response.json().get('richmenus', [])
        
        for menu in menus:
            # Check menu actions for data collection
            actions = menu.get('areas', [])
            for action in actions:
                action_type = action.get('action', {}).get('type', '')
                if action_type in ['uri', 'message']:
                    # Check if URI leads to privacy policy
                    uri = action.get('action', {}).get('uri', '')
                    if 'privacy' not in uri.lower() and 'policy' not in uri.lower():
                        self.findings.append(LINEFinding(
                            channel_id=self.channel_id,
                            finding_type='rich_menu_no_privacy_link',
                            severity='high',
                            description=f"Rich menu '{menu.get('name')}' action lacks privacy policy link",
                            evidence=f"Action type: {action_type}, URI: {uri}",
                            gdpr_article='Article 23 (Collection limitation), Article 30 (Privacy notice)',
                            remediation='Add privacy policy link to all data-collecting rich menu actions'
                        ))
    
    def scan_auto_reply_settings(self):
        """Check auto-reply for PII collection without consent"""
        url = f"{self.base_url}/bot/audienceGroup/list"
        headers = {'Authorization': f'Bearer {self.channel_access_token}'}
        
        # Check if auto-reply asks for PII before consent
        # This requires webhook inspection
        webhook_url = f"{self.base_url}/bot/info"
        response = requests.get(webhook_url, headers=headers, timeout=10)
        bot_info = response.json()
        
        if bot_info.get('autoReplyEnabled', False):
            self.findings.append(LINEFinding(
                channel_id=self.channel_id,
                finding_type='auto_reply_pii_collection',
                severity='high',
                description='Auto-reply bot may collect PII without explicit consent',
                evidence='Auto-reply is enabled',
                gdpr_article='Article 19 (Consent)',
                remediation='Add consent confirmation before collecting any PII in auto-reply flows'
            ))
    
    def scan_chat_history_retention(self):
        """Check chat history retention settings"""
        # LINE OA Manager doesn't expose this via API easily
        # This is a manual check that we flag
        
        self.findings.append(LINEFinding(
            channel_id=self.channel_id,
            finding_type='chat_history_retention_unknown',
            severity='medium',
            description='Unable to verify chat history retention period — may exceed GDPR limits',
            evidence='Chat history retention settings not accessible via API',
            gdpr_article='Article 34 (Storage limitation)',
            remediation='Manually verify OA settings: Chat history should be deleted after purpose is fulfilled (typically 1-3 years for real estate)'
        ))
    
    def scan_member_profile_access(self):
        """Check if member profile access is justified"""
        url = f"{self.base_url}/bot/followers/ids"
        headers = {'Authorization': f'Bearer {self.channel_access_token}'} 
        params = {'limit': 1000}
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        followers = response.json().get('userIds', [])
        
        if len(followers) > 1000:
            self.findings.append(LINEFinding(
                channel_id=self.channel_id,
                finding_type='large_follower_base_no_consent_audit',
                severity='high',
                description=f'Large follower base ({len(followers)}) without verifiable consent records',
                evidence=f'Total followers: {len(followers)}',
                gdpr_article='Article 19 (Consent), Article 24 (Records of processing)',
                remediation='Export follower list and cross-reference with consent database; remove followers without consent proof'
            ))
    
    def scan_login_permissions(self):
        """Check LINE Login scope permissions"""
        # Requires LINE Login channel inspection
        scopes = ['openid', 'profile', 'email', 'phone', 'address']
        # If any scope beyond 'openid' is requested without consent
        
        self.findings.append(LINEFinding(
            channel_id=self.channel_id,
            finding_type='line_login_scope_unverified',
            severity='medium',
            description='LINE Login scopes may collect excessive PII',
            evidence='Unable to verify requested scopes via API',
            gdpr_article='Article 23 (Collection limitation)',
            remediation='Audit Login channel: Only request minimum necessary scopes; document consent for each scope'
        ))
    
    def scan_group_settings(self):
        """Check LINE groups for data exposure"""
        # LINE groups are harder to scan programmatically
        # Flag for manual review
        
        self.findings.append(LINEFinding(
            channel_id=self.channel_id,
            finding_type='line_groups_manual_review_required',
            severity='medium',
            description='LINE groups managed by this OA may expose member data',
            evidence='Group member lists and chat history may be accessible to admins',
            gdpr_article='Article 37 (Security)',
            remediation='Review all LINE groups: Ensure members are aware of data collection; implement group rules with privacy notice'
        ))