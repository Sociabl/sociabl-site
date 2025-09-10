// /api/contact.js
const nodemailer = require('nodemailer');

// Read raw JSON body (safe for Vercel Node functions)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s])
  );
}

module.exports = async (req, res) => {
  // Allow CORS preflight (optional) + method guard
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse JSON
  let payload = {};
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, email, message, company } = payload;

  // Honeypot (spam): silently OK
  if (company) return res.status(200).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // ---- SendGrid SMTP via Nodemailer ----
    // All credentials must come from environment variables set in Vercel:
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, TO_EMAIL
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true only if using 465
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS, // <-- DO NOT hard-code; use env var
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
