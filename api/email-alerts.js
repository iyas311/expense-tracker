import { getSql } from './lib/db.js';

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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px 20px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, #6366f1, #06b6d4); width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 20px;">⚡</div>
            <span style="font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.02em;">Expensia Alerts</span>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(16,185,129,0.15); color: #10b981; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid rgba(16,185,129,0.3);">
              ✓ Connected & Active
            </div>
            <h2 style="font-size: 18px; margin: 0 0 10px 0; color: #fff;">Resend Email Alerts Working!</h2>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0;">
              Your Expensia finance tracker is now connected to Resend. You will receive credit card bill payment reminders and monthly budget digests directly to this address.
            </p>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://expensia.rentlora.in" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 700;">
              Open Expensia Dashboard →
            </a>
          </div>

          <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 28px;">
            Expensia AI Expense Tracker • Secure Private Vault: ${vaultId}
          </p>
        </div>
      `;

      const result = await sendEmail({
        to: target,
        subject: '🎉 Expensia Email Alerts are Connected!',
        html
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
      const accounts = await sql`
        SELECT id, name, type, balance, statement_day as "statementDay", due_day as "dueDay", credit_limit as "creditLimit"
        FROM accounts
        WHERE vault_id = ${vaultId} AND type = 'card' AND due_day IS NOT NULL;
      `;

      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const dueSoonCards = [];

      for (const card of accounts) {
        const debt = card.balance < 0 ? Math.abs(card.balance) : 0;
        if (debt <= 0) continue; // Bill already paid

        const dueDayNum = parseInt(card.dueDay);
        let dueDateMidnight = new Date(now.getFullYear(), now.getMonth(), dueDayNum);
        if (now.getDate() > dueDayNum) {
          dueDateMidnight = new Date(now.getFullYear(), now.getMonth() + 1, dueDayNum);
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

      // Format clean alert email
      const target = recipientEmail;
      const cardRows = dueSoonCards.map(c => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-left: 4px solid ${c.daysRemaining <= 1 ? '#f43f5e' : '#f59e0b'}; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="color: #fff; font-size: 15px;">${c.name}</strong>
            <span style="color: ${c.daysRemaining <= 1 ? '#f43f5e' : '#f59e0b'}; font-weight: 700; font-size: 12px; background: rgba(244,63,94,0.1); padding: 2px 8px; border-radius: 4px;">
              ${c.daysRemaining === 0 ? 'DUE TODAY!' : c.daysRemaining === 1 ? 'DUE TOMORROW' : 'Due in ' + c.daysRemaining + ' days'} (${c.dueDateFormatted})
            </span>
          </div>
          <div style="margin-top: 8px; font-size: 20px; font-weight: 800; color: #f43f5e;">
            ${currency}${c.debt.toLocaleString('en-IN')}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
            Statement: ${c.statementDay ? c.statementDay + 'th' : 'N/A'} • Limit: ${currency}${(parseFloat(c.creditLimit) || 0).toLocaleString('en-IN')}
          </div>
        </div>
      `).join('');

      const urgentCount = dueSoonCards.length;
      const totalDue = dueSoonCards.reduce((s, c) => s + c.debt, 0);

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px 20px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #f43f5e; background: rgba(244,63,94,0.15); padding: 4px 8px; border-radius: 6px;">
              ⚠️ Bill Payment Reminder
            </span>
            <h1 style="font-size: 20px; font-weight: 800; color: #fff; margin: 12px 0 4px 0;">
              ${urgentCount} Credit Card Bill${urgentCount > 1 ? 's' : ''} Due Soon
            </h1>
            <p style="font-size: 13px; color: #94a3b8; margin: 0;">
              Total outstanding due: <strong style="color: #fff;">${currency}${totalDue.toLocaleString('en-IN')}</strong>
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            ${cardRows}
          </div>

          <div style="text-align: center;">
            <a href="https://expensia.rentlora.in" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700;">
              Open Expensia & 1-Click Pay →
            </a>
          </div>

          <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 28px;">
            Avoid late fees & interest charges. Expensia Automated Alert System.
          </p>
        </div>
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
