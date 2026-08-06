# services/scanner/unified_scorer.py
from dataclasses import dataclass
from typing import List, Dict
from enum import Enum

class RiskLevel(Enum):
    CRITICAL = 4
    HIGH = 3
    MEDIUM = 2
    LOW = 1

@dataclass
class UnifiedReport:
    customer_id: str
    customer_name: str
    scan_date: str
    platforms_scanned: List[str]
    findings: List[Dict]
    overall_risk_score: int  # 0-100
    risk_level: str
    gdpr_compliance_percentage: float
    estimated_fine_exposure: str  # e.g. "Statutory max £8.7M/2% turnover..."
    action_items: List[str]

class UnifiedScorer:
    def __init__(self):
        self.platform_weights = {
            'website': 1.0,
            'facebook': 1.2,
            'instagram': 1.2,
            'linkedin': 1.1,
            'mailchimp': 1.3,
            'twitter': 1.0,
            'google_analytics': 1.4,
            'whatsapp': 1.2,
            'tiktok': 0.8,
        }
        
        self.severity_scores = {
            'critical': 25,
            'high': 15,
            'medium': 8,
            'low': 3,
        }
        # NOTE: gdpr_fine_ranges dict removed -- it isn't referenced anywhere
        # in calculate_score (fine_exposure strings are now set inline,
        # UK-GBP-denominated, based on ICO's actual maximum fine tiers
        # rather than the Thai PDPA THB figures that were here before).
    
    def calculate_score(self, all_findings: List[Dict]) -> UnifiedReport:
        total_score = 0.0
        platform_findings = {}

        for finding in all_findings:
            platform = finding.get('platform', 'unknown')
            severity = finding.get('severity', 'low')

            weight = self.platform_weights.get(platform, 1.0)
            score = self.severity_scores.get(severity, 3)

            total_score += score * weight

            if platform not in platform_findings:
                platform_findings[platform] = []
            platform_findings[platform].append(finding)

        # Cap at 100 rather than normalizing against a denominator that
        # grows with the number of findings. The old approach added
        # `25 * weight` to the denominator per finding regardless of that
        # finding's actual severity -- so a scan padded with many
        # low-severity findings pulled the *average* down and could score
        # as safer than a scan with just one or two serious findings.
        # Summing and capping means additional findings can only add risk,
        # never dilute it.
        has_scan_error = any(f.get('finding_type') in ('scan_error', 'scan_blocked', 'scan_failed') for f in all_findings)
        if has_scan_error:
            normalized_score = 100
        else:
            normalized_score = min(100, int(total_score))

        # Determine risk level and realistic fine exposure. UK GDPR/DPA
        # 2018 sets statutory maximum fines (enforced by the ICO) of
        # up to £17.5m / 4% of global turnover for the most serious tier,
        # £8.7m / 2% for the standard tier -- but the ICO's actual
        # enforcement history against SMEs runs far below the statutory
        # ceiling, so both are given rather than quoting the theoretical
        # maximum as if it were the likely outcome.
        if normalized_score >= 75:
            risk_level = 'CRITICAL'
            fine_exposure = 'Statutory max £17.5M/4% turnover (higher tier); realistic SME enforcement: tens of thousands+'
        elif normalized_score >= 50:
            risk_level = 'HIGH'
            fine_exposure = 'Statutory max £8.7M/2% turnover (standard tier); realistic SME enforcement: low-to-mid thousands'
        elif normalized_score >= 25:
            risk_level = 'MEDIUM'
            fine_exposure = 'ICO improvement notice or formal warning more likely than a fine at this level'
        else:
            risk_level = 'LOW'
            fine_exposure = 'Unlikely to trigger ICO enforcement; address before next review'

        # Compliance % is deliberately just the complement of the risk
        # score, not a second independent formula. Previously this used an
        # unrelated formula (100 - critical_high*10 - total*2) that could
        # disagree with the risk level computed above -- e.g. show a HIGH
        # risk level next to a compliance % that still looked reassuring.
        compliance_pct = 100 - normalized_score

        # Generate action items
        action_items = self._generate_action_items(all_findings, platform_findings)

        return UnifiedReport(
            customer_id='',
            customer_name='',
            scan_date='',
            platforms_scanned=list(platform_findings.keys()),
            findings=all_findings,
            overall_risk_score=normalized_score,
            risk_level=risk_level,
            gdpr_compliance_percentage=compliance_pct,
            estimated_fine_exposure=fine_exposure,
            action_items=action_items
        )
    
    def _generate_action_items(self, findings: List[Dict], by_platform: Dict) -> List[str]:
        actions = []
        
        # Critical actions first
        critical = [f for f in findings if f['severity'] == 'critical']
        for f in critical[:3]:  # Top 3 critical
            actions.append(f"URGENT: {f['remediation']} (Platform: {f['platform']})")
        
        # Platform-specific actions
        if 'instagram' in by_platform:
            ig_critical = [f for f in by_platform['instagram'] if f['severity'] in ['critical', 'high']]
            if ig_critical:
                actions.append("Instagram: Implement consent confirmation in all DM auto-reply flows")
                actions.append("Instagram: Review all Lead Ads for privacy policy links")
        
        if 'facebook' in by_platform:
            fb_critical = [f for f in by_platform['facebook'] if f['severity'] in ['critical', 'high']]
            if fb_critical:
                actions.append("Facebook: Add privacy policy links to all lead forms")
                actions.append("Facebook: Enable comment moderation to filter PII")

        if 'linkedin' in by_platform:
            li_critical = [f for f in by_platform['linkedin'] if f['severity'] in ['critical', 'high']]
            if li_critical:
                actions.append("LinkedIn: Audit Lead Gen forms for privacy policy links")

        if 'mailchimp' in by_platform:
            mc_critical = [f for f in by_platform['mailchimp'] if f['severity'] in ['critical', 'high']]
            if mc_critical:
                actions.append("CRM: Clean inactive subscribers and implement double opt-in")

        if 'google_analytics' in by_platform:
            ga_critical = [f for f in by_platform['google_analytics'] if f['severity'] in ['critical', 'high']]
            if ga_critical:
                actions.append("Analytics: Implement Consent Mode and restrict Google data sharing")
        
        # General compliance
        actions.append("Implement cross-platform consent management system")
        actions.append("Create a GDPR-compliant data retention policy and stick to it")
        actions.append("Train all agents on GDPR requirements for social media")
        
        return actions