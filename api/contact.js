// /api/contact.js
const nodemailer = require('nodemailer');
const { URLSearchParams } = require('url');

// Read raw body (works in Vercel Node functions)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parsePayload(req, raw = '') {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    return JSON.parse(raw || '{}');
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const p = new URLSearchParams(raw);
    return Object.fromEntries(p.entries());
  }
  // Default: try JSON, then urlencoded
  try { return JSON.parse(raw || '{}'); } catch { /*ignore*/ }
  const p = new URLSearchParams(raw);
  return Object.fromEntries(p.entries());
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s])
  );
}

module.exports = async (req, res) => {
  // Preflight + method guard
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse payload
  let payload = {};
  try {
    const raw = await readBody(req);
    payload = parsePayload(req, raw);
  } catch {
    return res.status(400).json({ error: 'Invalid body' });
  }

  const { name, email, message, company } = payload;

  // Honeypot (spam): silently OK
  if (company) return res.status(200).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // ---- SendGrid SMTP via Nodemailer (env vars in Vercel) ----
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // only true for 465
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS, // DO NOT hard-code
      },
    });

    const from = process.env.FROM_EMAIL || 'Sociabl Website <no-reply@sociablpty.com>';
    const to = process.env.TO_EMAIL || 'ops@sociablpty.com';

    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject: `[Sociabl] New contact form submission`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email error:', err?.response?.toString?.() || err);
    return res.status(500).json({ error: 'Email failed to send.' });
  }
};
