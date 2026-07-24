import requests
from bs4 import BeautifulSoup
from dataclasses import dataclass

@dataclass
class WebsiteFinding:
    platform: str = "website"
    url: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class WebsiteScanner:
    def __init__(self, url: str):
        if not url.startswith('http'):
            self.url = f"https://{url}"
        else:
            self.url = url
        self.findings: list[WebsiteFinding] = []
    
    def scan_all(self):
        try:
            response = requests.get(self.url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
            self.html = response.text
            self.soup = BeautifulSoup(self.html, 'html.parser')
            
            self.scan_ssl(response.url)
            self.scan_trackers()
            self.scan_forms()
            self.scan_privacy_policy()
            self.scan_dpo_contact()
            self.scan_dsr_link()
            self.scan_uk_gdpr_ref()
        except Exception as e:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='scan_failed',
                severity='low',
                description=f'Could not reach website: {str(e)}',
                evidence='',
                gdpr_article='',
                remediation='Verify the domain is accessible'
            ))
        return self.findings

    def scan_ssl(self, final_url: str):
        if not final_url.startswith('https://'):
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='insecure_protocol',
                severity='high',
                description='Website is not forcing HTTPS encryption',
                evidence=f'Final resolved URL: {final_url}',
                gdpr_article='Article 37 (Security)',
                remediation='Enable SSL/TLS certificate and force HTTPS redirect'
            ))
            
    def scan_trackers(self):
        scripts = self.soup.find_all('script', src=True)
        trackers_found = []
        for s in scripts:
            src = s['src'].lower()
            if 'google-analytics.com' in src or 'googletagmanager.com' in src:
                trackers_found.append('Google Analytics')
            elif 'connect.facebook.net' in src or 'fbevents.js' in src:
                trackers_found.append('Facebook Pixel')
        
        if trackers_found:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='tracking_scripts',
                severity='medium',
                description=f'Found third-party tracking scripts: {", ".join(set(trackers_found))}',
                evidence=f'{len(trackers_found)} script(s) found in DOM',
                gdpr_article='Article 19 (Consent)',
                remediation='Implement a cookie consent banner blocking these scripts until user opts in'
            ))

    def scan_forms(self):
        forms = self.soup.find_all('form')
        if forms:
            has_consent_checkbox = False
            for form in forms:
                inputs = form.find_all('input', type='checkbox')
                for i in inputs:
                    parent_text = i.parent.text.lower() if i.parent else ''
                    if 'agree' in parent_text or 'consent' in parent_text or 'privacy' in parent_text:
                        has_consent_checkbox = True
            
            if not has_consent_checkbox:
                self.findings.append(WebsiteFinding(
                    url=self.url,
                    finding_type='form_consent',
                    severity='medium',
                    description='Forms detected without explicit GDPR consent checkboxes',
                    evidence=f'{len(forms)} form(s) found without privacy agreement checkbox',
                    gdpr_article='Article 19 (Consent)',
                    remediation='Add mandatory consent checkbox linking to Privacy Policy before form submission'
                ))

    def scan_privacy_policy(self):
        links = self.soup.find_all('a', href=True)
        has_policy = False
        for link in links:
            text = link.text.lower()
            if 'privacy' in text or 'policy' in text:
                href = link['href'].lower()
                if 'policies.google.com' in href or 'google.com/policies' in href or 'facebook.com/privacy' in href:
                    continue
                has_policy = True
                break
        if not has_policy:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='privacy_policy_missing',
                severity='high',
                description='No Privacy Policy link found on the homepage',
                evidence='Scanned all <a> tags',
                gdpr_article='Article 13 & 14 (Information to be provided)',
                remediation='Add a clear link to your Privacy Policy in the footer'
            ))

    def scan_dpo_contact(self):
        text = self.soup.get_text().lower()
        if 'dpo' not in text and 'data protection officer' not in text and 'privacy@' not in text:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='dpo_contact_missing',
                severity='medium',
                description='No DPO or privacy contact email found',
                evidence='Scanned homepage text',
                gdpr_article='Article 37 (DPO)',
                remediation='List a contact email (e.g. privacy@) or DPO details'
            ))

    def scan_dsr_link(self):
        text = self.soup.get_text().lower()
        if 'data subject rights' not in text and 'manage data' not in text and 'dsr' not in text:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='dsr_link_missing',
                severity='medium',
                description='No Data Subject Rights (DSR) request process found',
                evidence='Scanned homepage text',
                gdpr_article='Article 15-22 (Data Subject Rights)',
                remediation='Provide a form or instructions for users to exercise their data rights'
            ))

    def scan_uk_gdpr_ref(self):
        text = self.soup.get_text().lower()
        if 'gdpr' not in text and 'uk gdpr' not in text:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type='uk_gdpr_ref_missing',
                severity='low',
                description='No reference to UK GDPR compliance found',
                evidence='Scanned homepage text',
                gdpr_article='Article 13 (Information to be provided)',
                remediation='Explicitly mention UK GDPR compliance in your privacy documentation'
            ))
