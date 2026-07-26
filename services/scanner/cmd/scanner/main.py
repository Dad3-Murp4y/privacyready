# services/scanner/main.py
import os
import secrets
from fastapi import FastAPI, HTTPException, Header, Depends
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

app = FastAPI(title="PrivacyReady Scanner API", version="2.1.0")

# This service has no auth of its own -- it relies entirely on network
# isolation (only reachable at scanner.privacyready.local from inside the
# API service's network) and binding 0.0.0.0 so it's actually reachable
# there. That's a single point of failure: any network misconfiguration
# (a bad security group, a debug port-forward, running it outside the
# private network during local dev against a shared host) exposes an
# open scan-relay with no second layer of defence. A shared-secret header
# is cheap, defense-in-depth insurance against exactly that.
SCANNER_API_KEY = os.environ.get("SCANNER_API_KEY")
if not SCANNER_API_KEY:
    raise RuntimeError(
        "SCANNER_API_KEY environment variable is required and must not be "
        "empty. Refusing to start with no shared secret between this "
        "service and the API service that calls it."
    )


def require_api_key(x_scanner_api_key: Optional[str] = Header(default=None)):
    if not x_scanner_api_key or not secrets.compare_digest(x_scanner_api_key, SCANNER_API_KEY):
        raise HTTPException(status_code=401, detail="Missing or invalid X-Scanner-Api-Key")


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
    # Deliberately doesn't require auth (used by container/orchestrator
    # health checks) and doesn't echo the app version, which is otherwise
    # free reconnaissance info for an attacker probing for known CVEs.
    return {"status": "ok", "service": "scanner"}

@app.post("/v1/scan/website", dependencies=[Depends(require_api_key)])
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

    # Always go through the scorer, including for an empty findings list,
    # rather than returning a separate hardcoded "100% compliant" dict.
    # Two independent code paths computing "clean" made it easy for them
    # to drift out of sync, and calculate_score([]) already produces the
    # correct 0-risk/100-compliance result on its own.
    scorer = unified_scorer.UnifiedScorer()
    report = scorer.calculate_score(all_findings)
    report.customer_id = req.customer_id
    report.scan_date = datetime.now().isoformat()
    if not all_findings:
        report.action_items = ["No compliance issues found in the categories we checked."]

    return asdict(report)

@app.post("/v1/scan/social", dependencies=[Depends(require_api_key)])
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

    # 4. Calculate Unified Score -- same reasoning as scan_website above:
    # one scoring path for both the empty and non-empty case.
    scorer = unified_scorer.UnifiedScorer()
    report = scorer.calculate_score(all_findings)
    report.customer_id = req.customer_id
    report.scan_date = datetime.now().isoformat()
    if not all_findings:
        report.action_items = ["Connect social accounts to perform an audit."]

    return asdict(report)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)  # nosec B104
