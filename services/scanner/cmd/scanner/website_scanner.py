import http.client
import ipaddress
import socket
import ssl
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup


MAX_REDIRECTS = 5
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 10
ALLOWED_SCHEMES = {"http", "https"}


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


class UnsafeTargetError(Exception):
    """Raised when a target is not a public HTTP(S) destination."""


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
            ip.is_unspecified,
        )
    )


def _resolve_public_host(hostname: str, port: int) -> list[str]:
    """Resolve a hostname for one request and reject every non-public answer.

    This deliberately does not change ``socket`` globally. Each outbound hop
    is resolved and pinned to the checked address immediately before it is
    connected, preventing a redirect or a later DNS answer from bypassing the
    check.
    """
    try:
        records = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeTargetError("Could not resolve a public scan target") from exc

    addresses = list(dict.fromkeys(record[4][0] for record in records))
    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise UnsafeTargetError("Scan target must resolve only to public Internet addresses")
    return addresses


def _normalise_target(url: str) -> str:
    candidate = url.strip()
    if not candidate:
        raise UnsafeTargetError("URL is required")
    if "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlsplit(candidate)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeTargetError("Only HTTP and HTTPS scan targets are supported")
    if not parsed.hostname:
        raise UnsafeTargetError("URL has no hostname")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeTargetError("URLs containing embedded credentials are not supported")
    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeTargetError("URL contains an invalid port") from exc
    if port is not None and not 1 <= port <= 65535:
        raise UnsafeTargetError("URL contains an invalid port")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname.endswith((".local", ".internal", ".localhost")) or "." not in hostname:
        raise UnsafeTargetError("Scan target must be a public Internet hostname")

    blocked_domains = {
        "google.com", "facebook.com", "amazon.com", "aws.amazon.com",
        "microsoft.com", "apple.com", "github.com", "gitlab.com",
    }
    if any(hostname == domain or hostname.endswith(f".{domain}") for domain in blocked_domains):
        raise UnsafeTargetError("Refusing to scan protected infrastructure domain")

    effective_port = port or (443 if parsed.scheme.lower() == "https" else 80)
    _resolve_public_host(hostname, effective_port)
    return candidate


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS connection that dials a checked IP but verifies the hostname."""

    def __init__(self, address: str, server_hostname: str, port: int, timeout: int):
        super().__init__(address, port=port, timeout=timeout, context=ssl.create_default_context())
        self._server_hostname = server_hostname

    def connect(self):
        self.sock = socket.create_connection((self.host, self.port), self.timeout, self.source_address)
        if self._tunnel_host:
            self._tunnel()
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self._server_hostname)


@dataclass
class _FetchResponse:
    url: str
    content: bytes
    encoding: str | None


def _request_once(url: str) -> tuple[int, str | None, _FetchResponse]:
    parsed = urlsplit(url)
    hostname = parsed.hostname
    assert hostname is not None
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    address = _resolve_public_host(hostname, port)[0]
    host_header = hostname if parsed.port is None else f"{hostname}:{parsed.port}"
    path = (parsed.path or "/") + (f"?{parsed.query}" if parsed.query else "")

    if parsed.scheme == "https":
        connection = _PinnedHTTPSConnection(address, hostname, port, REQUEST_TIMEOUT_SECONDS)
    else:
        connection = http.client.HTTPConnection(address, port=port, timeout=REQUEST_TIMEOUT_SECONDS)

    try:
        connection.request("GET", path, headers={"Host": host_header, "User-Agent": "PrivacyReadyScanner/1.0", "Connection": "close"})
        response = connection.getresponse()
        content_length = response.getheader("Content-Length")
        if content_length and int(content_length) > MAX_RESPONSE_BYTES:
            raise ValueError(f"Response exceeded {MAX_RESPONSE_BYTES} byte limit")

        chunks: list[bytes] = []
        received = 0
        while chunk := response.read(65536):
            received += len(chunk)
            if received > MAX_RESPONSE_BYTES:
                raise ValueError(f"Response exceeded {MAX_RESPONSE_BYTES} byte limit")
            chunks.append(chunk)
        return response.status, response.getheader("Location"), _FetchResponse(
            url=url,
            content=b"".join(chunks),
            encoding=response.headers.get_content_charset(),
        )
    finally:
        connection.close()


def fetch_public_url(url: str) -> _FetchResponse:
    current_url = _normalise_target(url)
    for redirect_count in range(MAX_REDIRECTS + 1):
        # Validate again for every request, then pin the same checked DNS
        # result in _request_once. This prevents redirects and DNS rebinding
        # from reaching an internal target.
        current_url = _normalise_target(current_url)
        status, location, response = _request_once(current_url)
        if status not in {301, 302, 303, 307, 308}:
            return response
        if not location:
            return response
        if redirect_count == MAX_REDIRECTS:
            raise UnsafeTargetError("Scan target exceeded the redirect limit")
        current_url = urljoin(current_url, location)
    raise UnsafeTargetError("Scan target exceeded the redirect limit")


class WebsiteScanner:
    def __init__(self, url: str):
        self.url = url
        self.findings: list[WebsiteFinding] = []

    def scan_all(self):
        try:
            response = fetch_public_url(self.url)
            self.url = response.url
            self.html = response.content.decode(response.encoding or "utf-8", errors="replace")
            self.soup = BeautifulSoup(self.html, "html.parser")

            self.scan_ssl(response.url)
            self.scan_trackers()
            self.scan_forms()
            self.scan_privacy_policy()
            self.scan_dpo_contact()
            self.scan_dsr_link()
            self.scan_uk_gdpr_ref()
        except UnsafeTargetError as exc:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type="scan_blocked",
                severity="low",
                description=f"Scan target rejected: {exc}",
                remediation="Provide a public website URL",
            ))
        except Exception:
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type="scan_failed",
                severity="low",
                description="Could not reach website",
                remediation="Verify the domain is accessible",
            ))
        return self.findings

    def scan_ssl(self, final_url: str):
        if not final_url.startswith("https://"):
            self.findings.append(WebsiteFinding(
                url=self.url,
                finding_type="insecure_protocol",
                severity="high",
                description="Website is not forcing HTTPS encryption",
                evidence=f"Final resolved URL: {final_url}",
                gdpr_article="Article 32 (Security of processing)",
                remediation="Enable SSL/TLS certificate and force HTTPS redirect",
            ))

    def scan_trackers(self):
        scripts = self.soup.find_all("script", src=True)
        trackers_found = []
        for script in scripts:
            source = script["src"].lower()
            if "google-analytics.com" in source or "googletagmanager.com" in source:
                trackers_found.append("Google Analytics")
            elif "connect.facebook.net" in source or "fbevents.js" in source:
                trackers_found.append("Facebook Pixel")
        if trackers_found:
            self.findings.append(WebsiteFinding(url=self.url, finding_type="tracking_scripts", severity="medium", description=f"Found third-party tracking scripts: {', '.join(set(trackers_found))}", evidence=f"{len(trackers_found)} script(s) found in DOM", gdpr_article="Article 7 (Conditions for consent)", remediation="Implement a cookie consent banner blocking these scripts until user opts in"))

    def scan_forms(self):
        forms = self.soup.find_all("form")
        if forms:
            has_consent_checkbox = any("agree" in (item.parent.text.lower() if item.parent else "") or "consent" in (item.parent.text.lower() if item.parent else "") or "privacy" in (item.parent.text.lower() if item.parent else "") for form in forms for item in form.find_all("input", type="checkbox"))
            if not has_consent_checkbox:
                self.findings.append(WebsiteFinding(url=self.url, finding_type="form_consent", severity="medium", description="Forms detected without explicit GDPR consent checkboxes", evidence=f"{len(forms)} form(s) found without privacy agreement checkbox", gdpr_article="Article 7 (Conditions for consent)", remediation="Add mandatory consent checkbox linking to Privacy Policy before form submission"))

    def scan_privacy_policy(self):
        has_policy = any(("privacy" in link.text.lower() or "policy" in link.text.lower()) and not any(excluded in link["href"].lower() for excluded in ("policies.google.com", "google.com/policies", "facebook.com/privacy")) for link in self.soup.find_all("a", href=True))
        if not has_policy:
            self.findings.append(WebsiteFinding(url=self.url, finding_type="privacy_policy_missing", severity="high", description="No Privacy Policy link found on the homepage", evidence="Scanned all <a> tags", gdpr_article="Article 13 & 14 (Information to be provided)", remediation="Add a clear link to your Privacy Policy in the footer"))

    def scan_dpo_contact(self):
        text = self.soup.get_text().lower()
        if "dpo" not in text and "data protection officer" not in text and "privacy@" not in text:
            self.findings.append(WebsiteFinding(url=self.url, finding_type="dpo_contact_missing", severity="medium", description="No DPO or privacy contact email found", evidence="Scanned homepage text", gdpr_article="Article 37 (DPO)", remediation="List a contact email (e.g. privacy@) or DPO details"))

    def scan_dsr_link(self):
        text = self.soup.get_text().lower()
        if "data subject rights" not in text and "manage data" not in text and "dsr" not in text:
            self.findings.append(WebsiteFinding(url=self.url, finding_type="dsr_link_missing", severity="medium", description="No Data Subject Rights (DSR) request process found", evidence="Scanned homepage text", gdpr_article="Article 15-22 (Data Subject Rights)", remediation="Provide a form or instructions for users to exercise their data rights"))

    def scan_uk_gdpr_ref(self):
        text = self.soup.get_text().lower()
        if "gdpr" not in text and "uk gdpr" not in text:
            self.findings.append(WebsiteFinding(url=self.url, finding_type="uk_gdpr_ref_missing", severity="low", description="No reference to UK GDPR compliance found", evidence="Scanned homepage text", gdpr_article="Article 13 (Information to be provided)", remediation="Explicitly mention UK GDPR compliance in your privacy documentation"))
