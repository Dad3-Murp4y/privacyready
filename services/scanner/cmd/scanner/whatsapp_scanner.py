# services/scanner/whatsapp_scanner.py
import requests
from dataclasses import dataclass
from typing import List

@dataclass
class WhatsAppFinding:
    platform: str = "whatsapp"
    phone_number: str = ""
    finding_type: str = ""
    severity: str = ""
    description: str = ""
    evidence: str = ""
    gdpr_article: str = ""
    remediation: str = ""

class WhatsAppScanner:
    def __init__(self, phone_number: str):
        self.phone_number = phone_number
        self.findings: List[WhatsAppFinding] = []
    
    def scan_all(self) -> List[WhatsAppFinding]:
        self.findings.append(WhatsAppFinding(
            phone_number=self.phone_number,
            finding_type='whatsapp_greeting_privacy',
            severity='medium',
            description='WhatsApp Business automated greeting messages often fail to provide a privacy notice.',
            evidence='WhatsApp Business API verification required.',
            gdpr_article='Article 13 (Information to be provided where personal data are collected)',
            remediation='Update WhatsApp Business greeting message to include: "By continuing this chat, you agree to our Privacy Policy [Link]".'
        ))
        return self.findings
