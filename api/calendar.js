import { getSql } from './lib/db.js';

function formatIcsDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeIcsText(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getSql();
    let vaultId = req.query.vault || 'vault_admin';
    const token = req.query.token;
    const key = req.query.key;

    // Validate access
    let authorized = false;
    if (token) {
      const s = await sql`SELECT vault_id FROM app_sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP;`;
      if (s.length > 0) {
        vaultId = s[0].vault_id;
        authorized = true;
      }
    }
    if (!authorized && key) {
      const settings = await sql`SELECT key, value FROM app_settings WHERE key = 'passcode' AND value = ${key};`;
      if (settings.length > 0) authorized = true;
      const vaults = await sql`SELECT id FROM app_vaults WHERE id = ${vaultId} AND passcode = ${key};`;
      if (vaults.length > 0) authorized = true;
    }

    // Default fallback for master vault if key matches admin default passcode '1122' or no key provided
    if (!authorized && (!key || key === '1122')) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(401).send('Unauthorized: Invalid or missing calendar key or token.');
    }

    // Fetch accounts, subscriptions, debts, settings
    const [accounts, subscriptions, debts, rawSettings] = await Promise.all([
      sql`SELECT id, name, type, balance, statement_day as "statementDay", due_day as "dueDay", color FROM accounts WHERE vault_id = ${vaultId};`,
      sql`SELECT id, name, amount, billing_cycle as "billingCycle", next_due_date as "nextDueDate" FROM subscriptions WHERE vault_id = ${vaultId};`,
      sql`SELECT id, person_name as "personName", amount, direction, due_date as "dueDate", reason FROM app_debts WHERE vault_id = ${vaultId} AND status = 'pending' AND due_date IS NOT NULL;`,
      sql`SELECT key, value FROM app_settings;`
    ]);

    const currency = rawSettings.find(s => s.key === 'currency')?.value || '₹';
    const now = new Date();
    const nowStamp = `${formatIcsDate(now)}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;

    const events = [];

    // 1. Credit Card Bill Due Dates (Next 12 months)
    const cardAccounts = accounts.filter(a => a.type === 'card' && a.dueDay);
    for (const card of cardAccounts) {
      const dueDay = parseInt(card.dueDay);
      const debt = card.balance < 0 ? Math.abs(card.balance) : 0;

      for (let offset = 0; offset < 12; offset++) {
        const dueDate = new Date(now.getFullYear(), now.getMonth() + offset, dueDay);
        // Skip past dates in current month
        if (offset === 0 && now.getDate() > dueDay) continue;

        const nextDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1);
        const isCurrentCycle = offset === 0 || (offset === 1 && now.getDate() > dueDay);

        const summary = isCurrentCycle && debt > 0
          ? `💳 Pay ${card.name} Bill (${currency}${debt.toLocaleString('en-IN')})`
          : `💳 ${card.name} Bill Due Date`;

        const desc = `Credit card payment due for ${card.name}.\n` +
          (debt > 0 ? `Current Outstanding: ${currency}${debt.toLocaleString('en-IN')}\n` : 'No balance due right now.\n') +
          (card.statementDay ? `Statement Day: ${card.statementDay}th of month\n` : '') +
          `Due Day: ${dueDay}th of month\n` +
          `Pay your bill: https://expensia.rentlora.in`;

        events.push(`BEGIN:VEVENT
UID:cc-due-${card.id}-${formatIcsDate(dueDate)}@expensia.rentlora.in
DTSTAMP:${nowStamp}
DTSTART;VALUE=DATE:${formatIcsDate(dueDate)}
DTEND;VALUE=DATE:${formatIcsDate(nextDay)}
SUMMARY:${escapeIcsText(summary)}
DESCRIPTION:${escapeIcsText(desc)}
STATUS:CONFIRMED
TRANSP:TRANSPARENT
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeIcsText('Reminder: ' + card.name + ' bill is due in 2 days')}
TRIGGER:-P2D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeIcsText('Reminder: ' + card.name + ' bill is due today!')}
TRIGGER:-PT9H
END:VALARM
END:VEVENT`);
      }
    }

    // 2. Subscriptions
    for (const sub of subscriptions) {
      if (!sub.nextDueDate) continue;
      const subDate = new Date(sub.nextDueDate);
      const nextDay = new Date(subDate.getFullYear(), subDate.getMonth(), subDate.getDate() + 1);
      const summary = `🔄 ${sub.name} (${currency}${parseFloat(sub.amount).toLocaleString('en-IN')})`;
      const desc = `Recurring subscription renewal for ${sub.name}.\nAmount: ${currency}${parseFloat(sub.amount).toLocaleString('en-IN')}\nBilling Cycle: ${sub.billingCycle}\nExpensia: https://expensia.rentlora.in`;

      let rrule = '';
      if (sub.billingCycle === 'monthly') rrule = '\nRRULE:FREQ=MONTHLY';
      if (sub.billingCycle === 'yearly' || sub.billingCycle === 'annual') rrule = '\nRRULE:FREQ=YEARLY';
      if (sub.billingCycle === 'weekly') rrule = '\nRRULE:FREQ=WEEKLY';

      events.push(`BEGIN:VEVENT
UID:sub-${sub.id}@expensia.rentlora.in
DTSTAMP:${nowStamp}
DTSTART;VALUE=DATE:${formatIcsDate(subDate)}
DTEND;VALUE=DATE:${formatIcsDate(nextDay)}${rrule}
SUMMARY:${escapeIcsText(summary)}
DESCRIPTION:${escapeIcsText(desc)}
STATUS:CONFIRMED
TRANSP:TRANSPARENT
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeIcsText('Reminder: ' + sub.name + ' subscription renews tomorrow')}
TRIGGER:-P1D
END:VALARM
END:VEVENT`);
    }

    // 3. Debts with Due Dates
    for (const d of debts) {
      const dDate = new Date(d.dueDate);
      const nextDay = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate() + 1);
      const actionText = d.direction === 'lent' ? 'Collect from' : 'Repay to';
      const summary = `💰 ${actionText} ${d.personName} (${currency}${parseFloat(d.amount).toLocaleString('en-IN')})`;
      const desc = `Loan reminder: ${d.direction === 'lent' ? 'Money owed to you by' : 'Money you borrowed from'} ${d.personName}.\nAmount: ${currency}${parseFloat(d.amount).toLocaleString('en-IN')}\nReason: ${d.reason || 'None'}\nExpensia: https://expensia.rentlora.in`;

      events.push(`BEGIN:VEVENT
UID:debt-${d.id}@expensia.rentlora.in
DTSTAMP:${nowStamp}
DTSTART;VALUE=DATE:${formatIcsDate(dDate)}
DTEND;VALUE=DATE:${formatIcsDate(nextDay)}
SUMMARY:${escapeIcsText(summary)}
DESCRIPTION:${escapeIcsText(desc)}
STATUS:CONFIRMED
TRANSP:TRANSPARENT
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeIcsText('Reminder: ' + actionText + ' ' + d.personName + ' today')}
TRIGGER:-PT9H
END:VALARM
END:VEVENT`);
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Expensia//Due Dates & Subscriptions//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Expensia Bills & Subscriptions',
      'X-WR-TIMEZONE:Asia/Kolkata',
      'X-WR-CALDESC:Credit card bill due dates, recurring subscriptions, and debts from Expensia.',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="expensia_calendar.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return res.status(200).send(icsContent);

  } catch (err) {
    console.error('Calendar feed error:', err);
    return res.status(500).send('Error generating calendar feed.');
  }
}
