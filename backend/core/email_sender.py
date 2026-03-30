from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any

import requests
from django.conf import settings

from .models import Reservation


@dataclass(frozen=True)
class GmailOAuthConfig:
    client_id: str | None
    client_secret: str | None
    refresh_token: str | None
    access_token: str | None


def _get_gmail_oauth_config() -> GmailOAuthConfig:
    return GmailOAuthConfig(
        client_id=getattr(settings, "GMAIL_OAUTH_CLIENT_ID", None),
        client_secret=getattr(settings, "GMAIL_OAUTH_CLIENT_SECRET", None),
        refresh_token=getattr(settings, "GMAIL_OAUTH_REFRESH_TOKEN", None),
        access_token=getattr(settings, "GMAIL_OAUTH_ACCESS_TOKEN", None),
    )


def _refresh_access_token(cfg: GmailOAuthConfig) -> str:
    if not (cfg.client_id and cfg.client_secret and cfg.refresh_token):
        raise RuntimeError(
            "Missing Gmail OAuth config. Set GMAIL_OAUTH_CLIENT_ID, "
            "GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_OAUTH_REFRESH_TOKEN."
        )
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "refresh_token": cfg.refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to refresh Gmail token: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"Refresh response missing access_token: {json.dumps(data)}")
    return str(token)


def _get_access_token() -> str:
    cfg = _get_gmail_oauth_config()
    if cfg.access_token:
        return cfg.access_token
    return _refresh_access_token(cfg)


def _format_eur(amount: Any) -> str:
    try:
        return f"{float(amount):.2f} €"
    except Exception:
        return f"{amount} €"


def _format_date_fr(d) -> str:
    try:
        return d.strftime("%d/%m/%Y")
    except Exception:
        return str(d)


def build_admin_reservation_email(reservation: Reservation) -> tuple[str, str, str]:
    subject = f"Nouvelle réservation confirmée #{reservation.id} — DeepCleaning"

    services = reservation.supplementary_services or []
    services_html = ""
    services_text = ""
    services_subtotal = 0.0
    if services:
        rows = []
        for s in services:
            title = s.get("title") or s.get("service_id") or "Service"
            qty = int(s.get("quantity") or 1)
            price = float(s.get("price_discounted") or s.get("price_original") or s.get("price") or 0)
            line_total = price * qty
            services_subtotal += line_total
            rows.append(
                f"""
                <tr>
                  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#0f172a;">{title}</td>
                  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#0f172a;text-align:center;">{qty}</td>
                  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#0f172a;text-align:right;white-space:nowrap;">{_format_eur(price)}</td>
                  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#0f172a;text-align:right;white-space:nowrap;font-weight:700;">{_format_eur(line_total)}</td>
                </tr>
                """.strip()
            )
            services_text += f"- {title} x{qty} — {_format_eur(line_total)}\n"
        services_html = f"""
          <div style="margin-top:14px;border:1px solid #d1d5db;border-radius:12px;background:#ffffff;overflow:hidden;">
            <div style="padding:10px 12px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1f2937;background:#f9fafb;">Prestations supplémentaires</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;overflow:hidden;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="text-align:left;padding:10px 12px;color:#374151;font-size:11px;letter-spacing:.04em;text-transform:uppercase;">Service</th>
                  <th style="text-align:center;padding:10px 12px;color:#374151;font-size:11px;letter-spacing:.04em;text-transform:uppercase;">Qté</th>
                  <th style="text-align:right;padding:10px 12px;color:#374151;font-size:11px;letter-spacing:.04em;text-transform:uppercase;">PU</th>
                  <th style="text-align:right;padding:10px 12px;color:#374151;font-size:11px;letter-spacing:.04em;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                {''.join(rows)}
                <tr style="background:#f9fafb;">
                  <td colspan="3" style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;font-weight:700;text-align:right;">Sous-total services</td>
                  <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;font-weight:800;text-align:right;white-space:nowrap;">{_format_eur(services_subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        """.strip()

    original_price = float(reservation.original_price or reservation.total_price or 0)
    total_price = float(reservation.total_price or 0)
    discount_amount = float(reservation.discount_amount or 0)
    discount_pct = (discount_amount / original_price * 100.0) if original_price > 0 else 0.0

    promo_line = ""
    if reservation.code_promo:
        promo_line = (
            f"<div style=\"margin-top:6px;color:#1f2937;font-size:13px;\">"
            f"Code promo: <b>{reservation.code_promo}</b><br/>"
           
            f"</div>"
        )
    promo_value_line = (
        f"<div style=\"margin-top:4px;color:#0f172a;font-size:13px;\">"
        f"<span style=\"font-weight:700;\">Remise: {_format_eur(discount_amount)}</span>"
        f" &nbsp; <span style=\"display:inline-block;padding:4px 8px;background:#dbeafe;border-radius:999px;color:#1e3a8a;font-weight:700;\">-{discount_pct:.2f}%</span>"
        f"</div>"
        if discount_amount > 0
        else ""
    )

    created_iso = (
        reservation.created_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        if getattr(reservation, "created_at", None)
        else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    )

    text = (
        f"Réservation confirmée #{reservation.id}\n"
        f"Date: {_format_date_fr(reservation.reservation_date)} à {reservation.time_slot}\n"
        f"Client: {reservation.prenom} {reservation.nom} ({reservation.email}, {reservation.telephone})\n"
        f"Adresse: {reservation.adresse}, {reservation.code_postal} {reservation.ville}\n"
        f"Prestation: {reservation.prestation_type} — {reservation.selected_plan_title}\n"
        f"Total: {_format_eur(total_price)}\n"
        + (f"Code promo: {reservation.code_promo}\n" if reservation.code_promo else "")
        + ("\nPrestations supplémentaires:\n" + services_text if services_text else "")
        + (f"\nInfos: {reservation.autres_informations}\n" if reservation.autres_informations else "")
        + f"\nCréée: {created_iso}\n"
    )

    html = f"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Nouvelle réservation confirmée #{reservation.id} - {_format_date_fr(reservation.reservation_date)} {reservation.time_slot}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f3f6fb;padding:22px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;background:#ffffff;border-radius:18px;border:1px solid #dbe4f0;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="padding:18px 22px;background:linear-gradient(135deg,#0a2540 0%,#164e8c 45%,#0ea5e9 100%);color:#ffffff;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="vertical-align:top;">
                      <div style="font-size:12px;opacity:.9;letter-spacing:.08em;text-transform:uppercase;">DeepCleaning</div>
                      <div style="margin-top:6px;font-size:23px;line-height:1.2;font-weight:800;">Reservation confirmee</div>
                      <div style="margin-top:8px;font-size:13px;opacity:.95;">Paiement valide via Stripe</div>
                    </td>
                    <td align="right" style="vertical-align:top;">
                      <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:12px;font-weight:700;">ID #{reservation.id}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:10px;">
                  <tr>
                    <td style="vertical-align:top;width:52%;border:1px solid #dce5f3;border-radius:14px;background:#f9fbff;padding:14px;">
                      <div style="font-size:11px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;font-weight:700;">RDV</div>
                      <div style="margin-top:8px;font-size:21px;line-height:1.25;color:#0f172a;font-weight:800;">📅 {_format_date_fr(reservation.reservation_date)} • 🕒 {reservation.time_slot}</div>
                      <div style="margin-top:8px;color:#334155;font-size:13px;">🧼 {reservation.prestation_type} - <b>{reservation.selected_plan_title}</b></div>
                      <div style="margin-top:6px;color:#64748b;font-size:12px;">Duree: {reservation.selected_plan_duration}</div>
                    </td>
                    <td style="vertical-align:top;width:48%;border:1px solid #dce5f3;border-radius:14px;background:#f9fbff;padding:14px;">
                      <div style="font-size:11px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;font-weight:700;">Prix</div>
                      <div style="margin-top:6px;font-size:34px;line-height:1;color:#0f172a;font-weight:900;">{_format_eur(total_price)}</div>
                      <div style="margin-top:8px;font-size:13px;color:#334155;">Original: <b>{_format_eur(original_price)}</b></div>
                      {promo_value_line}
                      {promo_line}
                    </td>
                  </tr>
                </table>

                <div style="margin-top:8px;border:1px solid #dce5f3;border-radius:14px;background:#ffffff;padding:14px;">
                  <div style="font-size:11px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;font-weight:700;">Client</div>
                  <div style="margin-top:6px;font-size:21px;color:#0f172a;font-weight:900;">👤 {reservation.prenom} {reservation.nom}</div>
                  <div style="margin-top:4px;font-size:13px;color:#1d4ed8;font-weight:700;">✉️ {reservation.email} &nbsp; • &nbsp; 📞 {reservation.telephone}</div>
                  <div style="margin-top:10px;font-size:13px;color:#334155;line-height:1.45;">📍 {reservation.adresse}<br/>{reservation.code_postal} {reservation.ville}</div>
                </div>

                {services_html}

                <div style="margin-top:14px;border:1px solid #dce5f3;border-radius:14px;background:#ffffff;overflow:hidden;">
                  <div style="padding:11px 14px;background:#f8fbff;border-bottom:1px solid #e6edf8;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1e3a8a;">📋 Details techniques</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Plan ID</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:700;text-align:right;">{reservation.selected_plan_id}</td></tr>
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Date / Heure</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:700;text-align:right;">{_format_date_fr(reservation.reservation_date)} - {reservation.time_slot}</td></tr>
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Code promo</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:700;text-align:right;">{reservation.code_promo or '-'}</td></tr>
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Original</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:700;text-align:right;">{_format_eur(original_price)}</td></tr>
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Remise</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:700;text-align:right;">{_format_eur(discount_amount)}</td></tr>
                    <tr><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#64748b;font-size:12px;">Total</td><td style="padding:9px 12px;border-top:1px solid #eef3fb;color:#0f172a;font-size:12px;font-weight:900;text-align:right;">{_format_eur(total_price)}</td></tr>
                  </table>
                </div>

                {"<div style=\"margin-top:12px;border:1px solid #dce5f3;border-radius:14px;background:#ffffff;padding:14px;\"><div style=\"font-size:11px;color:#64748b;letter-spacing:.06em;text-transform:uppercase;font-weight:700;\">📝 Informations complementaires</div><div style=\"margin-top:8px;color:#1f2937;font-size:13px;line-height:1.55;\">" + str(reservation.autres_informations).replace(chr(10), "<br />") + "</div></div>" if reservation.autres_informations else ""}

                <div style="margin-top:14px;font-size:11px;color:#64748b;">Creee: {created_iso}</div>
              </td>
            </tr>
          </table>
          <div style="max-width:720px;margin-top:10px;font-size:11px;color:#64748b;line-height:1.4;">
            DeepCleaning - Notification admin automatique
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
    """.strip()

    return subject, text, html


def send_gmail_html_email(*, to_email: str, subject: str, text_body: str, html_body: str) -> None:
    from_email = getattr(settings, "GMAIL_SENDER_EMAIL", None)
    if not from_email:
        raise RuntimeError("Missing GMAIL_SENDER_EMAIL in settings/env.")

    msg = EmailMessage()
    msg["To"] = to_email
    msg["From"] = from_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    token = _get_access_token()

    resp = requests.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"raw": raw},
        timeout=20,
    )

    if resp.status_code == 401:
        token = _refresh_access_token(_get_gmail_oauth_config())
        resp = requests.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"raw": raw},
            timeout=20,
        )

    if resp.status_code not in (200, 202):
        raise RuntimeError(f"Gmail send failed: {resp.status_code} {resp.text}")


def notify_admin_reservation_confirmed(reservation: Reservation) -> None:
    admin_email = getattr(settings, "ADMIN_RESERVATION_EMAIL", "contact@deepcleaning.fr")
    subject, text, html = build_admin_reservation_email(reservation)
    send_gmail_html_email(to_email=admin_email, subject=subject, text_body=text, html_body=html)
