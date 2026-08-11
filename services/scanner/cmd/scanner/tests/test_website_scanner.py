import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import website_scanner as scanner


class WebsiteScannerTargetTests(unittest.TestCase):
    def test_public_https_target_is_accepted(self):
        with patch.object(scanner, "_resolve_public_host", return_value=["93.184.216.34"]):
            self.assertEqual(scanner._normalise_target("https://example.org"), "https://example.org")

    def test_non_public_and_unsupported_targets_are_rejected(self):
        for target in ["http://localhost", "http://127.0.0.1", "http://[::1]", "http://10.0.0.1", "http://169.254.169.254", "file:///etc/passwd", "ftp://example.org", "http://user:pass@example.org"]:
            with self.subTest(target=target), self.assertRaises(scanner.UnsafeTargetError):
                scanner._normalise_target(target)

    def test_private_dns_answer_is_rejected(self):
        with patch("website_scanner.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.1", 443))]):
            with self.assertRaises(scanner.UnsafeTargetError):
                scanner._resolve_public_host("example.org", 443)

    def test_redirect_to_private_target_is_revalidated(self):
        with patch.object(scanner, "_resolve_public_host", side_effect=lambda host, port: ["93.184.216.34"] if host == "example.org" else (_ for _ in ()).throw(scanner.UnsafeTargetError("private"))), patch.object(scanner, "_request_once", return_value=(302, "http://127.0.0.1", None)):
            with self.assertRaises(scanner.UnsafeTargetError):
                scanner.fetch_public_url("https://example.org")

    def test_redirect_limit_is_enforced(self):
        response = scanner._FetchResponse("https://example.org", b"", "utf-8")
        with patch.object(scanner, "_resolve_public_host", return_value=["93.184.216.34"]), patch.object(scanner, "_request_once", return_value=(302, "https://example.org/next", response)):
            with self.assertRaises(scanner.UnsafeTargetError):
                scanner.fetch_public_url("https://example.org")

    def test_dns_rebinding_is_checked_on_each_hop(self):
        public = [(2, 1, 6, "", ("93.184.216.34", 443))]
        private = [(2, 1, 6, "", ("127.0.0.1", 443))]
        with patch("website_scanner.socket.getaddrinfo", side_effect=[public, private]):
            # _normalise_target resolves first and _request_once resolves
            # again immediately before connecting. A rebinding answer is
            # rejected before any socket is opened.
            with self.assertRaises(scanner.UnsafeTargetError):
                scanner.fetch_public_url("https://example.org")
