"""Hand-written early/mid history file contents (intentionally imperfect).

These scaffolds exist so the generated history shows bugs being *introduced*
over time, matching issues still present in the live tree at HEAD.
"""

from __future__ import annotations

from pathlib import Path


def write(root: Path, rel: str, content: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.lstrip("\n"), encoding="utf-8")


def initial_readme(root: Path) -> None:
    write(
        root,
        "README.md",
        """
# DataWai

Thailand PDPA compliance platform for SMEs. Website scanning, consent, and DSR workflows.

> Working name / early scaffold. Deploy target: AWS ap-southeast-1 (Bangkok).
""",
    )


def gitignore(root: Path) -> None:
    write(
        root,
        ".gitignore",
        """
node_modules/
dist/
.env
*.tfstate
*.tfstate.*
.terraform/
__pycache__/
*.pyc
.tfvars
plan.out
""",
    )


def early_scanner_main(root: Path) -> None:
    write(
        root,
        "services/scanner/cmd/scanner/main.py",
        '''
"""DataWai scanner API — early prototype. No auth yet (internal VPC only... hopefully)."""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="DataWai Scanner", version="0.1.0")


class WebsiteScanRequest(BaseModel):
    customer_id: str
    url: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "scanner", "version": "0.1.0"}


@app.post("/v1/scan/website")
def scan_website(req: WebsiteScanRequest):
    # TODO: wire WebsiteScanner — for now return a stub "clean" report
    return {
        "customer_id": req.customer_id,
        "url": req.url,
        "overall_risk_score": 0,
        "gdpr_compliance_percentage": 100,
        "risk_level": "LOW",
        "findings": [],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
''',
    )


def website_scanner_ssrf(root: Path) -> None:
    """Introduce the SSRF-prone website scanner (no URL allowlist)."""
    write(
        root,
        "services/scanner/cmd/scanner/website-scanner.py",
        '''
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
        # HACK: naive scheme check — uppercase HTTPS:// breaks; no private-IP block
        if not url.startswith("http"):
            self.url = f"https://{url}"
        else:
            self.url = url
        self.findings: list[WebsiteFinding] = []

    def scan_all(self):
        try:
            # BUG: follows redirects to internal/metadata hosts (SSRF)
            response = requests.get(self.url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            self.html = response.text
            self.soup = BeautifulSoup(self.html, "html.parser")
            self.scan_ssl(response.url)
            self.scan_trackers()
            self.scan_forms()
        except Exception as e:
            self.findings.append(
                WebsiteFinding(
                    url=self.url,
                    finding_type="scan_failed",
                    severity="low",
                    description=f"Could not reach website: {str(e)}",
                    remediation="Verify the domain is accessible",
                )
            )
        return self.findings

    def scan_ssl(self, final_url: str):
        if not final_url.startswith("https://"):
            self.findings.append(
                WebsiteFinding(
                    url=self.url,
                    finding_type="insecure_protocol",
                    severity="high",
                    description="Site does not use HTTPS",
                    gdpr_article="Article 32",
                    remediation="Enable TLS and redirect HTTP to HTTPS",
                )
            )

    def scan_trackers(self):
        scripts = self.soup.find_all("script", src=True)
        trackers = ["google-analytics", "googletagmanager", "facebook.net", "hotjar"]
        for s in scripts:
            src = s.get("src", "")
            for t in trackers:
                if t in src:
                    self.findings.append(
                        WebsiteFinding(
                            url=self.url,
                            finding_type="third_party_tracker",
                            severity="medium",
                            description=f"Third-party tracker detected: {t}",
                            evidence=src[:200],
                            gdpr_article="Article 6 / ePrivacy",
                            remediation="Load trackers only after consent",
                        )
                    )

    def scan_forms(self):
        for form in self.soup.find_all("form"):
            action = form.get("action") or ""
            if action.startswith("http://"):
                self.findings.append(
                    WebsiteFinding(
                        url=self.url,
                        finding_type="insecure_form",
                        severity="high",
                        description="Form posts over HTTP",
                        evidence=action,
                        gdpr_article="Article 32",
                        remediation="Submit forms only over HTTPS",
                    )
                )
''',
    )


def unified_scorer_dilution(root: Path) -> None:
    write(
        root,
        "services/scanner/cmd/scanner/unified-scanner.py",
        '''
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class UnifiedReport:
    overall_risk_score: int = 0
    gdpr_compliance_percentage: int = 100
    risk_level: str = "LOW"
    fine_exposure: str = "Under 500K THB"
    findings: List[Dict] = field(default_factory=list)
    platform_breakdown: Dict = field(default_factory=dict)


class UnifiedScanner:
    def __init__(self):
        self.severity_scores = {"critical": 25, "high": 15, "medium": 8, "low": 3}
        self.platform_weights = {"website": 1.0, "facebook": 1.2, "tiktok": 1.0, "line": 1.1}

    def calculate_score(self, all_findings: List[Dict]) -> UnifiedReport:
        total_score = 0
        max_possible = 0
        platform_findings: Dict = {}

        for finding in all_findings:
            platform = finding.get("platform", "unknown")
            severity = finding.get("severity", "low")
            weight = self.platform_weights.get(platform, 1.0)
            score = self.severity_scores.get(severity, 3)
            total_score += score * weight
            # BUG: max_possible grows per finding — more findings dilute the score
            max_possible += 25 * weight
            platform_findings.setdefault(platform, []).append(finding)

        if max_possible > 0:
            normalized_score = min(100, int((total_score / max_possible) * 100))
        else:
            normalized_score = 0

        if normalized_score >= 75:
            risk_level, fine = "CRITICAL", "5M+ THB"
        elif normalized_score >= 50:
            risk_level, fine = "HIGH", "1M-5M THB"
        elif normalized_score >= 25:
            risk_level, fine = "MEDIUM", "500K-1M THB"
        else:
            risk_level, fine = "LOW", "Under 500K THB"

        total = len(all_findings)
        critical_high = sum(1 for f in all_findings if f.get("severity") in ("critical", "high"))
        # HACK: arbitrary "compliance %" — not standards-based
        compliance = max(0, 100 - critical_high * 10 - total * 2)

        return UnifiedReport(
            overall_risk_score=normalized_score,
            gdpr_compliance_percentage=compliance if all_findings else 100,
            risk_level=risk_level if all_findings else "LOW",
            fine_exposure=fine if all_findings else "Under 500K THB",
            findings=all_findings,
            platform_breakdown=platform_findings,
        )
''',
    )


def dsr_scaffold(root: Path) -> None:
    write(
        root,
        "services/dsr/main.py",
        '''
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI(title="DataWai DSR Service", version="0.3.0")


class DSRRequest(BaseModel):
    request_type: Literal["access", "rectification", "erasure", "portability", "restriction"]
    subject_email: EmailStr
    description: Optional[str] = None


class DSRResponse(BaseModel):
    request_id: str
    status: str
    submitted_at: datetime
    deadline: datetime


async def verify_tenant(x_tenant_id: str = Header(...)) -> str:
    # BUG: header presence is not authentication
    if not x_tenant_id.strip():
        raise HTTPException(status_code=400, detail="X-Tenant-ID header required")
    return x_tenant_id


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "dsr", "version": "0.3.0"}


@app.post("/api/v1/dsr", response_model=DSRResponse)
async def create_request(request: DSRRequest, tenant_id: str = Depends(verify_tenant)) -> DSRResponse:
    # HACK: nothing is persisted — scaffold only
    now = datetime.now(timezone.utc)
    request_id = f"{tenant_id[:8]}-{int(now.timestamp())}"
    return DSRResponse(
        request_id=request_id,
        status="pending",
        submitted_at=now,
        deadline=now + timedelta(days=30),
    )


@app.get("/api/v1/dsr/{request_id}")
async def get_request(request_id: str, _tenant_id: str = Depends(verify_tenant)) -> dict[str, object]:
    # BUG: always returns the same fake progress
    return {
        "request_id": request_id,
        "status": "processing",
        "progress": 25,
        "note": "Status tracking is scaffolded only.",
    }
''',
    )


def consent_stub(root: Path) -> None:
    write(
        root,
        "services/api/src/routes/consent.ts",
        '''
import { FastifyInstance } from 'fastify';

// HACK: public no-op — clients think consent is recorded
export async function registerConsentRoutes(app: FastifyInstance) {
  app.get('/api/consent', async () => {
    return { status: 'ok', consents: [] };
  });

  app.post('/api/consent', async (_request, reply) => {
    return reply.code(201).send({ status: 'recorded' });
  });
}
''',
    )


def auth_enumeration(root: Path) -> None:
    write(
        root,
        "services/api/src/routes/auth.ts",
        '''
import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  const LoginSchema = {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      password: Type.String()
    })
  };

  app.post('/auth/login', { schema: LoginSchema }, async (request, reply) => {
    const { email, password } = request.body as any;
    const user = await prisma.user.findUnique({ where: { email } });
    // BUG: distinct messages enable email enumeration
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    // HACK: role/org baked into JWT — no DB re-check on later requests
    const token = app.jwt.sign(
      { sub: user.id, org: user.organizationId, role: user.role },
      { expiresIn: '1h' }
    );
    return { token };
  });
}
''',
    )


def public_scan_route(root: Path) -> None:
    write(
        root,
        "services/api/src/routes/scan.ts",
        '''
import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../db.js';

export async function registerScanRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/scan') || request.url.startsWith('/api/public')) {
      return;
    }
    try {
      await request.jwtVerify();
    } catch (err) {
      // BUG: send without return/throw — Fastify may still run the handler
      reply.send(err);
    }
  });

  const CreateScanSchema = {
    body: Type.Object({
      targetIdentifier: Type.String(),
      scanType: Type.String()
    })
  };

  // Unauthenticated landing-page scan — no rate limit / URL allowlist
  app.post('/api/public/scan', { schema: CreateScanSchema }, async (request, reply) => {
    const { targetIdentifier, scanType } = request.body as any;
    const scan = await prisma.scan.create({
      data: { scanType, targetIdentifier, status: 'PENDING' }
    });
    const isWebsite = scanType.toLowerCase() === 'website';
    const scannerEndpoint = isWebsite
      ? 'http://scanner.privacyready.local:8080/v1/scan/website'
      : 'http://scanner.privacyready.local:8080/v1/scan/social';
    const payload = isWebsite
      ? { customer_id: 'guest', url: targetIdentifier }
      : { customer_id: 'guest', tiktok_username: targetIdentifier };

    try {
      const response = await fetch(scannerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // BUG: no response.ok check — errors still marked COMPLETED
      const result = await response.json();
      return prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          score: result.gdpr_compliance_percentage,
          riskLevel: result.risk_level,
          findingsJson: result.findings,
          completedAt: new Date()
        }
      });
    } catch (err) {
      return prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          findingsJson: [{ description: `Scanner failed: ${String(err)}` }],
          completedAt: new Date()
        }
      });
    }
  });
}
''',
    )


def cookie_force_accept(root: Path) -> None:
    write(
        root,
        "frontend/main.js",
        '''
function acceptCookies() {
  document.cookie = "privacyready-cookies=accepted; domain=.privacyready.co.uk; path=/; max-age=31536000; SameSite=Lax";
  document.getElementById('cookieBanner').classList.remove('show');
  document.body.style.overflow = '';
}

function declineCookies() {
  // BUG / dark pattern: decline is not a real choice
  alert('You must accept cookies to use this site.');
}

(function () {
  const consentMatch = document.cookie.match(/(?:^|;\\s*)privacyready-cookies=([^;]*)/);
  const consent = consentMatch ? consentMatch[1] : null;
  if (!consent || consent === 'declined') {
    document.getElementById('cookieBanner').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
})();

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  // HACK: fake success — no backend
  console.log('Form submitted:', Object.fromEntries(data));
  document.getElementById('contactFormWrap').style.display = 'none';
  document.getElementById('formSuccess').classList.add('show');
}
''',
    )


def package_json_data_loss(root: Path) -> None:
    write(
        root,
        "services/api/package.json",
        '''
{
  "name": "privacyready-api",
  "version": "0.8.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "export DATABASE_URL=\\"postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}\\" && npx prisma db push --accept-data-loss && node dist/main.js"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/jwt": "^9.0.0",
    "@prisma/client": "^6.0.0",
    "bcrypt": "^5.1.1"
  }
}
''',
    )


def version_file(root: Path, version: str, notes: str) -> None:
    write(
        root,
        "VERSION",
        f"{version}\n",
    )
    write(
        root,
        "CHANGELOG.md",
        f"# Changelog\n\n## {version}\n\n{notes}\n",
    )


def line_scanner_dead_check(root: Path) -> None:
    write(
        root,
        "services/scanner/cmd/scanner/line-scanner.py",
        '''
import requests


class LINEFinding:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def as_dict(self):
        return dict(self.__dict__)


class LINEScanner:
    def __init__(self, channel_id: str, channel_access_token: str):
        self.channel_id = channel_id
        self.channel_access_token = channel_access_token
        self.base_url = "https://api.line.me/v2"
        self.findings = []

    def scan_all(self):
        self.scan_member_profile_access()
        return [f.as_dict() if hasattr(f, "as_dict") else f.__dict__ for f in self.findings]

    def scan_member_profile_access(self):
        url = f"{self.base_url}/bot/followers/ids"
        headers = {"Authorization": f"Bearer {self.channel_access_token}"}
        params = {"limit": 1000}
        response = requests.get(url, headers=headers, params=params, timeout=10)
        # BUG: API max page is 1000, so len(followers) > 1000 never fires
        followers = response.json().get("userIds", [])
        if len(followers) > 1000:
            self.findings.append(
                LINEFinding(
                    channel_id=self.channel_id,
                    finding_type="large_follower_base_no_consent_audit",
                    severity="high",
                    description=f"Large follower base ({len(followers)}) without verifiable consent records",
                    evidence=f"Total followers: {len(followers)}",
                    gdpr_article="Article 19 / Article 24",
                    remediation="Export followers and cross-reference consent records",
                )
            )
''',
    )


def tiktok_stub_findings(root: Path) -> None:
    write(
        root,
        "services/scanner/cmd/scanner/tiktok-scanner.py",
        '''
import re
import requests
from bs4 import BeautifulSoup


class TikTokScanner:
    def __init__(self, username: str):
        self.username = username
        self.findings = []
        self.pii_pattern = re.compile(r"[\\w.+-]+@[\\w-]+\\.[\\w.-]+")

    def scan_all(self):
        self.scan_public_comments_for_pii()
        self.scan_business_settings()
        return self.findings

    def scan_public_comments_for_pii(self):
        # HACK: always emits a medium finding — pattern unused
        self.findings.append(
            {
                "platform": "tiktok",
                "finding_type": "public_comments_pii_risk",
                "severity": "medium",
                "description": "Public comments may contain PII; manual review recommended",
                "evidence": f"@{self.username}",
                "remediation": "Disable public comments or moderate aggressively",
            }
        )

    def scan_business_settings(self):
        # HACK: stub — no real settings API check
        self.findings.append(
            {
                "platform": "tiktok",
                "finding_type": "business_settings_unverified",
                "severity": "medium",
                "description": "Unable to verify TikTok business privacy settings automatically",
                "evidence": "stub",
                "remediation": "Manually review TikTok Business Center privacy controls",
            }
        )
''',
    )
)
