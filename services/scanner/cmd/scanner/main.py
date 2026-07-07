# services/scanner/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
from dataclasses import asdict

# Import our scanner modules
# Since they are named with dashes in the file system, we need to import them carefully
# But wait, python doesn't easily import files with dashes. Let's use importlib or rename them.
# It's better to rename them, but for now we can just use importlib or rename the files.
import importlib.util
import sys
import os

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

current_dir = os.path.dirname(os.path.abspath(__file__))
facebook_scanner = load_module("facebook_scanner", os.path.join(current_dir, "facebook-scanner.py"))
line_scanner = load_module("line_scanner", os.path.join(current_dir, "line-scanner.py"))
tiktok_scanner = load_module("tiktok_scanner", os.path.join(current_dir, "tiktok-scanner.py"))
website_scanner = load_module("website_scanner", os.path.join(current_dir, "website-scanner.py"))
unified_scorer = load_module("unified_scorer", os.path.join(current_dir, "unified-scanner.py"))

app = FastAPI(title="DataWai Scanner API", version="2.1.0")

class SocialScanRequest(BaseModel):
    customer_id: str
    facebook_token: Optional[str] = None
    facebook_page_id: Optional[str] = None
    line_token: Optional[str] = None
    line_channel_id: Optional[str] = None
    tiktok_username: Optional[str] = None

class WebsiteScanRequest(BaseModel):
    customer_id: str
    url: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "scanner", "version": "2.1.0"}

@app.post("/v1/scan/website")
def scan_website(req: WebsiteScanRequest):
    all_findings = []
    
    try:
        scanner = website_scanner.WebsiteScanner(req.url)
        findings = scanner.scan_all()
        all_findings.extend([asdict(f) for f in findings])
    except Exception as e:
        print(f"Website scan error: {e}")
        all_findings.append({
            "platform": "website",
            "severity": "medium",
            "finding_type": "scan_error",
            "description": f"Failed to scan Website: {str(e)}"
        })
        
    scorer = unified_scorer.UnifiedScorer()
    if not all_findings:
        return {
            "overall_risk_score": 0,
            "risk_level": "LOW",
            "pdpa_compliance_percentage": 100,
            "estimated_fine_exposure": "None",
            "findings": [],
            "action_items": ["No compliance issues found."]
        }
        
    report = scorer.calculate_score(all_findings)
    report.customer_id = req.customer_id
    report.scan_date = datetime.now().isoformat()
    
    return asdict(report)

@app.post("/v1/scan/social")
def scan_social(req: SocialScanRequest):
    all_findings = []
    
    # 1. Facebook Scan
    if req.facebook_token and req.facebook_page_id:
        try:
            scanner = facebook_scanner.FacebookScanner(req.facebook_token, req.facebook_page_id)
            findings = scanner.scan_all()
            all_findings.extend([asdict(f) for f in findings])
        except Exception as e:
            print(f"Facebook scan error: {e}")
            all_findings.append({
                "platform": "facebook",
                "severity": "medium",
                "finding_type": "scan_error",
                "description": f"Failed to scan Facebook: {str(e)}"
            })
            
    # 2. LINE Scan
    if req.line_token and req.line_channel_id:
        try:
            scanner = line_scanner.LINEScanner(req.line_token, req.line_channel_id)
            findings = scanner.scan_all()
            all_findings.extend([asdict(f) for f in findings])
        except Exception as e:
            print(f"LINE scan error: {e}")
            all_findings.append({
                "platform": "line",
                "severity": "medium",
                "finding_type": "scan_error",
                "description": f"Failed to scan LINE: {str(e)}"
            })
            
    # 3. TikTok Scan
    if req.tiktok_username:
        try:
            scanner = tiktok_scanner.TikTokScanner(req.tiktok_username)
            findings = scanner.scan_all()
            all_findings.extend([asdict(f) for f in findings])
        except Exception as e:
            print(f"TikTok scan error: {e}")
            all_findings.append({
                "platform": "tiktok",
                "severity": "medium",
                "finding_type": "scan_error",
                "description": f"Failed to scan TikTok: {str(e)}"
            })
            
    # 4. Calculate Unified Score
    scorer = unified_scorer.UnifiedScorer()
    
    # If no findings, provide a baseline safe report
    if not all_findings:
        return {
            "overall_risk_score": 0,
            "risk_level": "LOW",
            "pdpa_compliance_percentage": 100,
            "estimated_fine_exposure": "None",
            "findings": [],
            "action_items": ["Connect social accounts to perform an audit."]
        }
        
    report = scorer.calculate_score(all_findings)
    report.customer_id = req.customer_id
    report.scan_date = datetime.now().isoformat()
    
    return asdict(report)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
