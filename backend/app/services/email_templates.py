def _base_html(title: str, body_html: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;background:#0f172a;color:#ffffff;">
                <h1 style="margin:0;font-size:20px;">FactGuard Security</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h2 style="margin-top:0;font-size:18px;color:#0f172a;">{title}</h2>
                {body_html}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def mfa_code_template(code: str, minutes: int) -> tuple[str, str, str]:
    subject = "Your FactGuard MFA Code"
    text = (
        "Your FactGuard verification code is: "
        f"{code}\nThis code expires in {minutes} minutes.\n"
    )
    html = _base_html(
        "Multi-factor Authentication Code",
        (
            "<p>Use the code below to complete sign in.</p>"
            f"<p style=\"font-size:30px;font-weight:700;letter-spacing:6px;\">{code}</p>"
            f"<p style=\"color:#475569;\">This code expires in {minutes} minutes.</p>"
        ),
    )
    return subject, text, html


def signup_otp_template(code: str, minutes: int) -> tuple[str, str, str]:
    subject = "Activate your FactGuard account"
    text = f"Your account activation code is: {code}\nIt expires in {minutes} minutes.\n"
    html = _base_html(
        "Verify Your Email",
        (
            "<p>Enter this code in FactGuard to activate your account.</p>"
            f"<p style=\"font-size:30px;font-weight:700;letter-spacing:6px;\">{code}</p>"
            f"<p style=\"color:#475569;\">Code expires in {minutes} minutes.</p>"
        ),
    )
    return subject, text, html


def reset_link_template(reset_link: str, minutes: int) -> tuple[str, str, str]:
    subject = "Reset your FactGuard password"
    text = (
        "Reset your password using this link:\n"
        f"{reset_link}\nThis link expires in {minutes} minutes.\n"
    )
    html = _base_html(
        "Password Reset Request",
        (
            "<p>Click the button below to reset your password.</p>"
            f"<p><a href=\"{reset_link}\" style=\"display:inline-block;padding:12px 20px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;\">Reset Password</a></p>"
            f"<p style=\"color:#475569;\">If the button does not work, use this link:<br><span>{reset_link}</span></p>"
            f"<p style=\"color:#475569;\">This link expires in {minutes} minutes.</p>"
        ),
    )
    return subject, text, html
