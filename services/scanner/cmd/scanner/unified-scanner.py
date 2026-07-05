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
    pdpa_compliance_percentage: float
    estimated_fine_exposure: str  # "1M-5M THB", etc.
    action_items: List[str]

class UnifiedScorer:
    def __init__(self):
        self.platform_weights = {
            'website': 1.0,
            'facebook': 1.2,   # Higher weight = more data exposure
            'line': 1.5,       # LINE is primary channel for Thai agents
            'tiktok': 0.8,
        }
        
        self.severity_scores = {
            'critical': 25,
            'high': 15,
            'medium': 8,
            'low': 3,
        }
        
        self.pdpa_fine_ranges = {
            'critical': '1M-5M THB',
            'high': '500K-1M THB',
            'medium': '100K-500K THB',
            'low': 'Warning-100K THB',
        }
    
    def calculate_score(self, all_findings: List[Dict]) -> UnifiedReport:
        total_score = 0
        max_possible = 0
        platform_findings = {}
        
        for finding in all_findings:
            platform = finding.get('platform', 'unknown')
            severity = finding.get('severity', 'low')
            
            weight = self.platform_weights.get(platform, 1.0)
            score = self.severity_scores.get(severity, 3)
            
            weighted_score = score * weight
            total_score += weighted_score
            max_possible += 25 * weight  # 25 = max per finding
            
            if platform not in platform_findings:
                platform_findings[platform] = []
            platform_findings[platform].append(finding)
        
        # Normalize to 0-100
        if max_possible > 0:
            normalized_score = min(100, int((total_score / max_possible) * 100))
        else:
            normalized_score = 0
        
        # Determine risk level
        if normalized_score >= 75:
            risk_level = 'CRITICAL'
            fine_exposure = '5M+ THB'
        elif normalized_score >= 50:
            risk_level = 'HIGH'
            fine_exposure = '1M-5M THB'
        elif normalized_score >= 25:
            risk_level = 'MEDIUM'
            fine_exposure = '500K-1M THB'
        else:
            risk_level = 'LOW'
            fine_exposure = 'Under 500K THB'
        
        # Calculate compliance percentage
        total_findings = len(all_findings)
        critical_high = sum(1 for f in all_findings if f['severity'] in ['critical', 'high'])
        compliance_pct = max(0, 100 - (critical_high * 10) - (total_findings * 2))
        
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
            pdpa_compliance_percentage=compliance_pct,
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
        if 'line' in by_platform:
            line_critical = [f for f in by_platform['line'] if f['severity'] in ['critical', 'high']]
            if line_critical:
                actions.append("LINE: Implement consent confirmation in all auto-reply flows")
                actions.append("LINE: Export follower list and audit consent records")
        
        if 'facebook' in by_platform:
            fb_critical = [f for f in by_platform['facebook'] if f['severity'] in ['critical', 'high']]
            if fb_critical:
                actions.append("Facebook: Add privacy policy links to all lead forms")
                actions.append("Facebook: Enable comment moderation to filter PII")
        
        # General compliance
        actions.append("Implement cross-platform consent management system")
        actions.append("Create PDPA-compliant data retention policy (max 3 years for real estate)")
        actions.append("Train all agents on PDPA requirements for social media")
        
        return actions