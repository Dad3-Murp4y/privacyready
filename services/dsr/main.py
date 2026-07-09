from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI(title="PrivacyReady DSR Service", version="2.1.0")


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
    if not x_tenant_id.strip():
        raise HTTPException(status_code=400, detail="X-Tenant-ID header required")
    return x_tenant_id


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "dsr", "version": "2.1.0"}


@app.post("/api/v1/dsr", response_model=DSRResponse)
async def create_request(request: DSRRequest, tenant_id: str = Depends(verify_tenant)) -> DSRResponse:
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
    return {
        "request_id": request_id,
        "status": "processing",
        "progress": 25,
        "note": "Status tracking is scaffolded only.",
    }
