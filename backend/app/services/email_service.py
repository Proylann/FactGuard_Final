import smtplib
import ssl
from email.message import EmailMessage

from .email_templates import mfa_code_template, reset_link_template, signup_otp_template


class SMTPEmailService:
    def __init__(self, settings):
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(
            self.settings.SMTP_HOST
            and self.settings.SMTP_PORT
            and self.settings.SMTP_USERNAME
            and self.settings.SMTP_PASSWORD
        )

    def send_mfa_code(self, to_email: str, code: str) -> None:
        subject, text, html = mfa_code_template(code=code, minutes=5)
        self._send_email(to_email=to_email, subject=subject, body=text, html=html)

    def send_signup_otp(self, to_email: str, code: str) -> None:
        subject, text, html = signup_otp_template(code=code, minutes=10)
        self._send_email(to_email=to_email, subject=subject, body=text, html=html)

    def send_reset_link(self, to_email: str, reset_link: str) -> None:
        subject, text, html = reset_link_template(reset_link=reset_link, minutes=30)
        self._send_email(to_email=to_email, subject=subject, body=text, html=html)

    def _send_email(self, to_email: str, subject: str, body: str, html: str | None = None) -> None:
        from_email = self.settings.SMTP_FROM_EMAIL or self.settings.SMTP_USERNAME
        from_name = self.settings.SMTP_FROM_NAME or "FactGuard"

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")

        context = ssl.create_default_context()

        if self.settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(self.settings.SMTP_HOST, self.settings.SMTP_PORT, context=context) as server:
                server.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
                server.send_message(msg)
            return

        with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT) as server:
            server.ehlo()
            if self.settings.SMTP_USE_TLS:
                server.starttls(context=context)
                server.ehlo()
            server.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
            server.send_message(msg)
