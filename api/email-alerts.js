import { getSql, getComputedAccounts } from './lib/db.js';

export default async function handler(req, res) {
  // Allow POST from frontend or GET from Vercel Cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({
      success: false,
      error: 'RESEND_API_KEY environment variable is not configured in Vercel.'
    });
  }

  try {
    const sql = getSql();
    const body = req.method === 'POST' ? (req.body || {}) : {};
    const action = body.action || req.query.action || 'checkDueBills';
    const payload = body.payload || {};

    let vaultId = payload.vaultId || 'vault_admin';
    const token = payload.token || req.query.token;

    // Optional token validation if provided
    if (token) {
      const s = await sql`SELECT vault_id FROM app_sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP;`;
      if (s.length > 0) vaultId = s[0].vault_id;
    }

    const settings = await sql`SELECT key, value FROM app_settings;`;
    const getSetting = (k, def = '') => settings.find(s => s.key === k)?.value || def;
    const currency = getSetting('currency', '₹');
    const recipientEmail = payload.recipientEmail || getSetting('alert_email') || process.env.ALERT_EMAIL || 'iyas2458@gmail.com';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Expensia Alerts <onboarding@resend.dev>';

    // Helper: Send via Resend REST API
    const sendEmail = async ({ to, subject, html }) => {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: Array.isArray(to) ? to : [to],
          subject,
          html
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || 'Resend API returned error code ' + resp.status);
      }
      return data;
    };

    // ─── ACTION: TEST EMAIL ───────────────────────────────────────────────────
    if (action === 'test' || action === 'sendTestEmail') {
      const target = payload.recipientEmail || recipientEmail;
      if (!target) {
        return res.status(400).json({ success: false, error: 'Recipient email is required.' });
      }

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.85); } }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    .btn-hover:hover { opacity: 0.94; transform: translateY(-1px); }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f1f5f9; padding: 40px 16px;">
    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
      <!-- Glowing Animated Top Accent Bar -->
      <div style="height: 6px; background: linear-gradient(90deg, #10b981, #06b6d4, #6366f1, #10b981); background-size: 300% 100%; animation: gradientShift 6s ease infinite;"></div>

      <div style="padding: 32px 28px 24px 28px;">
        <!-- Brand Header -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="vertical-align: middle;">
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <div style="background: linear-gradient(135deg, #10b981, #06b6d4); width: 38px; height: 38px; border-radius: 10px; text-align: center; line-height: 38px; color: #ffffff; font-size: 20px; font-weight: 800; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">
                      ⚡
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">Expensia</div>
                    <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Smart Financial Alerts</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 100px; display: inline-block;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; margin-right: 4px; vertical-align: middle; animation: pulseDot 2s infinite ease-in-out;"></span>
                Connected
              </span>
            </td>
          </tr>
        </table>

        <!-- Main Body Box -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px 22px; margin-bottom: 24px;">
          <h2 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; letter-spacing: -0.02em;">
            Email Alerts Successfully Activated!
          </h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
            Your Expensia vault is now configured to receive automated morning alerts directly to this address.
          </p>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.6;">
            <div>🔔 <strong>Credit Card Reminders:</strong> 2-3 days before payment due date</div>
            <div style="margin-top: 4px;">📊 <strong>Automated Schedule:</strong> Daily check at 9:30 AM IST</div>
          </div>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 8px;">
          <a href="https://expensia.rentlora.in" class="btn-hover" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 24px; border-radius: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
            Open Expensia Dashboard →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
          Expensia AI Finance Intelligence • Private Vault: <strong>${vaultId}</strong>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      const subject = payload.subject || '🎉 Expensia Email Alerts are Connected!';
      const contentHtml = payload.html || (payload.text ? `<p style="font-size:14px;color:#0f172a;">${payload.text}</p>` : html);

      const result = await sendEmail({
        to: target,
        subject,
        html: contentHtml
      });

      // Save recipient email in settings for future automated alerts
      try {
        await sql`
          INSERT INTO app_settings (key, value) VALUES ('alert_email', ${target})
          ON CONFLICT (key) DO UPDATE SET value = ${target};
        `;
      } catch (e) {}

      return res.status(200).json({ success: true, messageId: result.id, sentTo: target });
    }

    // ─── ACTION: CHECK DUE BILLS & ALERT ──────────────────────────────────────
    if (action === 'checkDueBills') {
      const allAccounts = await getComputedAccounts(sql, vaultId);
      const accounts = allAccounts.filter(a => a.type === 'card' && a.dueDay);

      const now = new Date();
      // Use IST (Asia/Kolkata) date to match user's local day
      const istString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const [year, month, day] = istString.split('-').map(Number);
      const todayMidnight = new Date(year, month - 1, day);

      const dueSoonCards = [];

      for (const card of accounts) {
        const debt = card.balance < 0 ? Math.abs(card.balance) : 0;
        if (debt <= 0) continue; // Bill already paid or zero balance

        const dueDayNum = parseInt(card.dueDay);
        let dueDateMidnight = new Date(year, month - 1, dueDayNum);
        if (day > dueDayNum) {
          dueDateMidnight = new Date(year, month, dueDayNum);
        }

        const diffMs = dueDateMidnight.getTime() - todayMidnight.getTime();
        const daysRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

        // Alert if due within 3 days (or due today!)
        if (daysRemaining <= 3) {
          dueSoonCards.push({
            ...card,
            debt,
            daysRemaining,
            dueDateFormatted: dueDateMidnight.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          });
        }
      }

      if (dueSoonCards.length === 0) {
        return res.status(200).json({ success: true, message: 'No cards due in the next 3 days.' });
      }

      // Format clean light-theme alert email
      const target = recipientEmail;
      const cardRows = dueSoonCards.map(c => `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid ${c.daysRemaining <= 1 ? '#e11d48' : '#f59e0b'}; border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td style="font-size: 16px; font-weight: 700; color: #0f172a; vertical-align: middle;">
                ${c.name}
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span style="font-size: 11px; font-weight: 700; color: ${c.daysRemaining <= 1 ? '#be123c' : '#b45309'}; background: ${c.daysRemaining <= 1 ? '#ffe4e6' : '#fef3c7'}; border: 1px solid ${c.daysRemaining <= 1 ? '#fecdd3' : '#fde68a'}; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.02em; display: inline-block;">
                  ${c.daysRemaining === 0 ? 'DUE TODAY' : c.daysRemaining === 1 ? 'DUE TOMORROW' : 'Due in ' + c.daysRemaining + ' days'} (${c.dueDateFormatted})
                </span>
              </td>
            </tr>
          </table>

          <div style="font-size: 28px; font-weight: 800; color: ${c.daysRemaining <= 1 ? '#e11d48' : '#0f172a'}; letter-spacing: -0.02em; margin-bottom: 8px;">
            ${currency}${c.debt.toLocaleString('en-IN')}
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #64748b;">
            <tr>
              <td>
                Statement: <strong style="color: #334155;">${c.statementDay ? c.statementDay + 'th' : 'N/A'}</strong>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                Limit: <strong style="color: #334155;">${currency}${(parseFloat(c.creditLimit) || 0).toLocaleString('en-IN')}</strong>
              </td>
            </tr>
          </table>
        </div>
      `).join('');

      const urgentCount = dueSoonCards.length;
      const totalDue = dueSoonCards.reduce((s, c) => s + c.debt, 0);

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.85); } }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    .btn-pay:hover { opacity: 0.94; transform: translateY(-1px); }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f1f5f9; padding: 40px 16px;">
    <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
      <!-- Glowing Animated Top Accent Bar -->
      <div style="height: 6px; background: linear-gradient(90deg, #f43f5e, #fb7185, #f59e0b, #f43f5e); background-size: 300% 100%; animation: gradientShift 6s ease infinite;"></div>

      <div style="padding: 32px 28px 24px 28px;">
        <!-- Header: Logo & Badge -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="vertical-align: middle;">
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <div style="background: linear-gradient(135deg, #e11d48, #f43f5e); width: 38px; height: 38px; border-radius: 10px; text-align: center; line-height: 38px; color: #ffffff; font-size: 20px; font-weight: 800; box-shadow: 0 4px 10px rgba(225, 29, 72, 0.25);">
                      💳
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">Expensia</div>
                    <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Smart Financial Alerts</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 100px; display: inline-block;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #e11d48; margin-right: 4px; vertical-align: middle; animation: pulseDot 1.8s infinite ease-in-out;"></span>
                Bill Reminder
              </span>
            </td>
          </tr>
        </table>

        <!-- Main Banner -->
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.03em;">
            ${urgentCount} Credit Card Bill${urgentCount > 1 ? 's' : ''} Due Soon
          </h1>
          <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.5;">
            Total pending settlement: <strong style="color: #0f172a; font-weight: 800;">${currency}${totalDue.toLocaleString('en-IN')}</strong>
          </p>
        </div>

        <!-- Cards List -->
        <div style="margin-bottom: 26px;">
          ${cardRows}
        </div>

        <!-- CTA Button -->
        <div style="margin-bottom: 12px;">
          <a href="https://expensia.rentlora.in" class="btn-pay" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 24px; border-radius: 12px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.28); transition: all 0.2s ease;">
            Open Expensia & Pay Bill →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
          Avoid late fees & interest charges • Expensia Automated Alert System
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      const result = await sendEmail({
        to: target,
        subject: `⚠️ Reminder: ${dueSoonCards[0].name} Bill Due (${currency}${dueSoonCards[0].debt.toLocaleString('en-IN')})`,
        html
      });

      return res.status(200).json({ success: true, messageId: result.id, notifiedCards: dueSoonCards.map(c => c.name) });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('Email alert error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
