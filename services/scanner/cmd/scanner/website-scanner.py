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
