# services/scanner/tiktok_scanner.py
import requests
from bs4 import BeautifulSoup
import re
from dataclasses import dataclass

@dataclass
class TikTokFinding:
    platform: str = "tiktok"
    username: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class TikTokScanner:
    def __init__(self, username: str):
        self.username = username
        self.findings: list[TikTokFinding] = []
    
    def scan_all(self):
        self.scan_bio_for_tracking()
        self.scan_public_comments_for_pii()
        self.scan_business_settings()
        return self.findings
    
    def scan_bio_for_tracking(self):
        """Check bio link for tracking parameters"""
        url = f"https://www.tiktok.com/@{self.username}"
        try:
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find bio link
            bio_link = soup.find('a', {'href': re.compile(r'https?://')})
            if bio_link:
                href = bio_link.get('href', '')
                if 'utm_' in href or 'fbclid' in href or 'ttclid' in href:
                    self.findings.append(TikTokFinding(
                        username=self.username,
                        finding_type='bio_link_tracking',
                        severity='medium',
                        description='Bio link contains tracking parameters without consent notice',
                        evidence=f"Link: {href}",
                        gdpr_article='Article 23 (Collection limitation)',
                        remediation='Add privacy notice: "This link uses analytics tracking"'
                    ))
        except Exception as e:
            self.findings.append(TikTokFinding(
                username=self.username,
                finding_type='scan_failed',
                severity='low',
                description=f'Could not scan TikTok profile: {str(e)}',
                evidence='',
                gdpr_article='',
                remediation='Manual review required'
            ))
    
    def scan_public_comments_for_pii(self):
        """Scrape recent videos for PII in comments"""
        # TikTok's API is restrictive; this is a heuristic
        pii_pattern = r'0[689]\d{8}|[^@\s]+@[^@\s]+\.[^@\s]+'
        
        self.findings.append(TikTokFinding(
            username=self.username,
            finding_type='comments_pii_heuristic',
            severity='medium',
            description='Public video comments may contain PII — manual review required',
            evidence='TikTok API restrictions prevent automated comment scanning',
            gdpr_article='Article 37 (Security)',
            remediation='Manually review recent video comments; delete any containing phone/email/ID; enable comment moderation'
        ))
    
    def scan_business_settings(self):
        """Check business account settings"""
        self.findings.append(TikTokFinding(
            username=self.username,
            finding_type='business_account_settings',
            severity='medium',
            description='Business account may collect lead data without proper consent flow',
            evidence='TikTok Business Center settings not accessible via public API',
            gdpr_article='Article 19 (Consent)',
            remediation='Review Business Center: Ensure lead forms have consent checkboxes; verify data retention settings'
        ))