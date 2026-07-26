# services/scanner/google_analytics_scanner.py
import requests
from dataclasses import dataclass
from typing import List

@dataclass
class GoogleAnalyticsFinding:
    platform: str = "google_analytics"
    property_id: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class GoogleAnalyticsScanner:
    def __init__(self, property_id: str):
        self.property_id = property_id
        self.findings: List[GoogleAnalyticsFinding] = []
    
    def scan_all(self) -> List[GoogleAnalyticsFinding]:
        self.findings.append(GoogleAnalyticsFinding(
            property_id=self.property_id,
            finding_type='ga4_data_sharing',
            severity='high',
            description='Google Analytics 4 data sharing with Google products and benchmarking may be enabled without user consent.',
            evidence='Requires GA4 Admin API access to verify property settings.',
            gdpr_article='Article 6 (Lawfulness of processing)',
            remediation='Review GA4 Admin > Data Settings > Data Collection. Ensure granular consent mode is enabled and data sharing with Google is restricted.'
        ))
        return self.findings
