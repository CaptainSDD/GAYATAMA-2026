import type { MailMessage } from '../mail/mail.service';

/** Minimal escaping for the few characters that would break out of text or an attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The verification email, in Indonesian like the rest of the product.
 *
 * A pure function of the address and the link so it can be read and tested
 * without an SMTP server. The link itself is minted by Firebase Auth, which
 * stays the single source of truth for whether an address is verified — this
 * only carries it.
 *
 * The URL is printed in full as well as linked: a plain-text client gets
 * something usable, and anyone wary of a button in an email can read where it
 * goes before following it.
 */
export function verificationEmail(to: string, link: string): MailMessage {
  const safeLink = escapeHtml(link);

  const text = [
    'Terima kasih sudah mendaftar di LOKABIS.',
    '',
    'Klik tautan berikut untuk memverifikasi alamat email ini:',
    link,
    '',
    'Tautan ini hanya berlaku sekali dan akan kedaluwarsa. Jika Anda tidak merasa mendaftar di LOKABIS, abaikan email ini — tanpa verifikasi, alamat ini tidak akan dipakai.',
    '',
    'LOKABIS — analisis lokasi usaha mikro.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:32rem;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Verifikasi email Anda</h1>
          <p style="margin:0 0 16px;line-height:1.6;">Terima kasih sudah mendaftar di LOKABIS. Satu langkah lagi: pastikan alamat email ini benar milik Anda.</p>
          <p style="margin:0 0 20px;">
            <a href="${safeLink}" style="display:inline-block;padding:12px 20px;font-weight:700;color:#ffffff;background:#0f766e;border-radius:8px;text-decoration:none;">Verifikasi email</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475569;">Tombolnya tidak bisa diklik? Buka tautan ini:<br />
            <a href="${safeLink}" style="color:#0f766e;word-break:break-all;">${safeLink}</a>
          </p>
          <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.6;color:#475569;">
            Tautan ini hanya berlaku sekali dan akan kedaluwarsa. Jika Anda tidak merasa mendaftar di LOKABIS, abaikan email ini — tanpa verifikasi, alamat ini tidak akan dipakai.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to, subject: 'Verifikasi email Anda untuk LOKABIS', text, html };
}
