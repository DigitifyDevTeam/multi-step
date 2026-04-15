#!/usr/bin/env python3
"""
Production API smoke/integration tests for DeepCleaning backend.

Default mode is safe (read-only + public endpoints only).
Use flags/env vars to include write and authenticated endpoint tests.

Usage examples:
  python core/tests_prod_api.py
  python core/tests_prod_api.py --base-url https://api.deepcleaning.fr/api
  python core/tests_prod_api.py --run-write-tests
  python core/tests_prod_api.py --username admin --password 'secret' --run-auth-tests
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from dataclasses import dataclass
from typing import Any

import requests


DEFAULT_BASE_URL = "https://api.deepcleaning.fr/api"
DEFAULT_TIMEOUT = 20


@dataclass
class TestResult:
    name: str
    passed: bool
    details: str = ""


class ProdApiTester:
    def __init__(
        self,
        base_url: str,
        timeout: int,
        run_write_tests: bool,
        run_auth_tests: bool,
        username: str | None,
        password: str | None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.run_write_tests = run_write_tests
        self.run_auth_tests = run_auth_tests
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.results: list[TestResult] = []
        self.created_reservation_id: int | None = None
        self.auth_access_token: str | None = None

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{self.base_url}{path}"

    def _record(self, name: str, passed: bool, details: str = "") -> None:
        self.results.append(TestResult(name=name, passed=passed, details=details))
        status = "PASS" if passed else "FAIL"
        suffix = f" - {details}" if details else ""
        print(f"[{status}] {name}{suffix}")

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        kwargs.setdefault("timeout", self.timeout)
        return self.session.request(method, self._url(path), **kwargs)

    @staticmethod
    def _safe_json(resp: requests.Response) -> Any:
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text[:500]}

    def _assert_status(
        self,
        name: str,
        response: requests.Response,
        expected: set[int],
        extra_check: str = "",
    ) -> bool:
        if response.status_code in expected:
            self._record(name, True, f"status={response.status_code}")
            return True
        payload = self._safe_json(response)
        self._record(
            name,
            False,
            f"status={response.status_code}, expected={sorted(expected)}, body={json.dumps(payload, ensure_ascii=False)} {extra_check}".strip(),
        )
        return False

    def test_payments_config(self) -> None:
        resp = self._request("GET", "/payments/config/")
        ok = self._assert_status("GET /payments/config/", resp, {200})
        if ok:
            data = self._safe_json(resp)
            key = data.get("publishable_key")
            self._record(
                "payments/config has publishable_key",
                isinstance(key, str) and bool(key.strip()),
                "publishable_key present" if key else f"response={data}",
            )

    def test_available_slots(self) -> None:
        target_date = (dt.date.today() + dt.timedelta(days=7)).isoformat()
        resp = self._request("GET", f"/reservations/available-slots/?date={target_date}")
        ok = self._assert_status("GET /reservations/available-slots/", resp, {200})
        if ok:
            data = self._safe_json(resp)
            valid = isinstance(data, dict) and "booked_slots" in data and "date" in data
            self._record(
                "available-slots payload shape",
                valid,
                f"keys={list(data.keys())}" if isinstance(data, dict) else f"body={data}",
            )

    def test_places(self) -> None:
        autocomplete_resp = self._request("GET", "/places/autocomplete/?input=Paris")
        ok = self._assert_status("GET /places/autocomplete/", autocomplete_resp, {200})
        if not ok:
            return

        data = self._safe_json(autocomplete_resp)
        predictions = data.get("predictions", []) if isinstance(data, dict) else []
        self._record(
            "places/autocomplete payload shape",
            isinstance(predictions, list),
            f"predictions_count={len(predictions) if isinstance(predictions, list) else 'n/a'}",
        )

        if predictions and isinstance(predictions[0], dict) and predictions[0].get("place_id"):
            place_id = predictions[0]["place_id"]
            details_resp = self._request("GET", f"/places/details/?place_id={place_id}")
            details_ok = self._assert_status("GET /places/details/", details_resp, {200})
            if details_ok:
                d = self._safe_json(details_resp)
                valid = isinstance(d, dict) and all(k in d for k in ("formatted_address", "ville", "code_postal"))
                self._record(
                    "places/details payload shape",
                    valid,
                    f"keys={list(d.keys())}" if isinstance(d, dict) else f"body={d}",
                )
        else:
            self._record(
                "GET /places/details/",
                True,
                "skipped (no predictions returned by autocomplete)",
            )

    def test_promo_validate_invalid(self) -> None:
        payload = {"code": "INVALID-CODE-XYZ", "cart_total": 150}
        resp = self._request("POST", "/promo-codes/validate/", json=payload)
        ok = self._assert_status("POST /promo-codes/validate/ invalid", resp, {404, 200})
        if ok:
            data = self._safe_json(resp)
            looks_invalid = isinstance(data, dict) and (
                data.get("valid") is False or "Invalid promo code" in json.dumps(data, ensure_ascii=False)
            )
            self._record("promo validate invalid semantics", looks_invalid, f"body={data}")

    def _build_reservation_payload(self) -> dict[str, Any]:
        future_date = (dt.date.today() + dt.timedelta(days=10)).isoformat()
        now_suffix = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
        return {
            "prestation_type": "canape",
            "selected_plan_id": "canape-2-3",
            "selected_plan_title": "Canapé 2-3 places",
            "selected_plan_price": 79,
            "selected_plan_duration": "30 min",
            "reservation_date": future_date,
            "time_slot": "15h00",
            "nom": "ProdTest",
            "prenom": f"API{now_suffix}",
            "telephone": f"06{now_suffix[-8:]}",
            "email": f"prod.api.{now_suffix}@example.com",
            "adresse": "1 Rue de Test",
            "ville": "Paris",
            "code_postal": "75001",
            "code_promo": "",
            "autres_informations": "Reservation created by production API test script.",
            "supplementary_services": [],
        }

    def test_create_reservation(self) -> None:
        if not self.run_write_tests:
            self._record("POST /reservations/", True, "skipped (enable with --run-write-tests)")
            return

        payload = self._build_reservation_payload()
        resp = self._request("POST", "/reservations/", json=payload)
        ok = self._assert_status("POST /reservations/", resp, {200, 201})
        if not ok:
            return

        data = self._safe_json(resp)
        reservation_id = data.get("id") if isinstance(data, dict) else None
        self.created_reservation_id = int(reservation_id) if isinstance(reservation_id, int) else None
        self._record(
            "reservation created has id",
            self.created_reservation_id is not None,
            f"id={self.created_reservation_id}, status={data.get('status') if isinstance(data, dict) else 'n/a'}",
        )

    def test_create_payment_intent(self) -> None:
        if not self.run_write_tests:
            self._record("POST /payments/create-intent/", True, "skipped (enable with --run-write-tests)")
            return

        if not self.created_reservation_id:
            self._record("POST /payments/create-intent/", False, "missing created reservation id")
            return

        resp = self._request("POST", "/payments/create-intent/", json={"reservation_id": self.created_reservation_id})
        ok = self._assert_status("POST /payments/create-intent/", resp, {200})
        if ok:
            data = self._safe_json(resp)
            has_secret = isinstance(data, dict) and isinstance(data.get("client_secret"), str)
            self._record("payment intent has client_secret", has_secret, f"keys={list(data.keys()) if isinstance(data, dict) else data}")

    def test_confirm_reservation(self) -> None:
        if not self.run_write_tests:
            self._record("POST /reservations/{id}/confirm/", True, "skipped (enable with --run-write-tests)")
            return

        if not self.created_reservation_id:
            self._record("POST /reservations/{id}/confirm/", False, "missing created reservation id")
            return

        resp = self._request("POST", f"/reservations/{self.created_reservation_id}/confirm/")
        ok = self._assert_status("POST /reservations/{id}/confirm/", resp, {200, 400})
        if ok:
            data = self._safe_json(resp)
            accepted = isinstance(data, dict) and (
                data.get("status") == "Reservation confirmed"
                or "Cannot confirm reservation with status" in json.dumps(data, ensure_ascii=False)
            )
            self._record("confirm reservation semantics", accepted, f"body={data}")

    def test_auth_token(self) -> None:
        if not self.run_auth_tests:
            self._record("POST /auth/token/", True, "skipped (enable with --run-auth-tests)")
            return
        if not self.username or not self.password:
            self._record("POST /auth/token/", False, "missing credentials (--username/--password)")
            return

        resp = self._request("POST", "/auth/token/", json={"username": self.username, "password": self.password})
        ok = self._assert_status("POST /auth/token/", resp, {200})
        if not ok:
            return
        data = self._safe_json(resp)
        access = data.get("access") if isinstance(data, dict) else None
        refresh = data.get("refresh") if isinstance(data, dict) else None
        valid = isinstance(access, str) and isinstance(refresh, str)
        self._record("auth token payload shape", valid, "access+refresh present" if valid else f"body={data}")
        if valid:
            self.auth_access_token = access

    def _auth_headers(self) -> dict[str, str]:
        if not self.auth_access_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_access_token}"}

    def test_authenticated_endpoints(self) -> None:
        if not self.run_auth_tests:
            self._record("Authenticated endpoint checks", True, "skipped (enable with --run-auth-tests)")
            return
        if not self.auth_access_token:
            self._record("Authenticated endpoint checks", False, "no access token available")
            return

        for path in ("/reservations/", "/conges/", "/promo-codes/"):
            resp = self._request("GET", path, headers=self._auth_headers())
            self._assert_status(f"GET {path} (auth)", resp, {200})

    def run(self) -> int:
        print(f"Testing base URL: {self.base_url}")
        print(f"Write tests enabled: {self.run_write_tests}")
        print(f"Auth tests enabled: {self.run_auth_tests}")
        print("-" * 72)

        # Public endpoints
        self.test_payments_config()
        self.test_available_slots()
        self.test_places()
        self.test_promo_validate_invalid()
        self.test_create_reservation()
        self.test_create_payment_intent()
        self.test_confirm_reservation()

        # Authenticated endpoints
        self.test_auth_token()
        self.test_authenticated_endpoints()

        total = len(self.results)
        failed = sum(1 for r in self.results if not r.passed)
        passed = total - failed
        print("-" * 72)
        print(f"Summary: {passed}/{total} passed, {failed} failed")

        if failed:
            print("\nFailed tests:")
            for r in self.results:
                if not r.passed:
                    print(f"- {r.name}: {r.details}")
            return 1
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run production API tests against DeepCleaning backend.")
    parser.add_argument(
        "--base-url",
        default=os.getenv("API_BASE_URL", DEFAULT_BASE_URL),
        help=f"API base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.getenv("API_TEST_TIMEOUT", str(DEFAULT_TIMEOUT))),
        help=f"HTTP timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--run-write-tests",
        action="store_true",
        default=os.getenv("API_TEST_WRITE", "").lower() in {"1", "true", "yes"},
        help="Enable tests that create/confirm reservations and payment intents on target environment.",
    )
    parser.add_argument(
        "--run-auth-tests",
        action="store_true",
        default=os.getenv("API_TEST_AUTH", "").lower() in {"1", "true", "yes"},
        help="Enable authenticated endpoint tests.",
    )
    parser.add_argument("--username", default=os.getenv("API_TEST_USERNAME"), help="Username for /auth/token/ tests.")
    parser.add_argument("--password", default=os.getenv("API_TEST_PASSWORD"), help="Password for /auth/token/ tests.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    tester = ProdApiTester(
        base_url=args.base_url,
        timeout=args.timeout,
        run_write_tests=args.run_write_tests,
        run_auth_tests=args.run_auth_tests,
        username=args.username,
        password=args.password,
    )
    return tester.run()


if __name__ == "__main__":
    sys.exit(main())
