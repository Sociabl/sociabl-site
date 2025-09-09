// /api/contact.js
const nodemailer = require('nodemailer');

// Read raw JSON body (Vercel Node function safe)
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
  // Preflight + method guard
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

  // ---------- SMTP TRANSPORT (Brevo) ----------
  // Required Vercel env vars:
  // SMTP_HOST=smtp-relay.brevo.com
  // SMTP_PORT=587
  // SMTP_USER=<your Brevo login email>
  // SMTP_PASS=<your Brevo SMTP key>   (Brevo > SMTP & API > SMTP > Generate)
  // FROM_EMAIL="Sociabl Website <no-reply@sociablpty.com>"
  // TO_EMAIL=admin@sociablpty.com
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true only for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const from = process.env.FROM_EMAIL || 'Sociabl Website <no-reply@sociablpty.com>';
    const to = process.env.TO_EMAIL || 'admin@sociablpty.com';

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
    console.error('Email error:', err);
    return res.status(500).json({ error: 'Email failed to send.' });
  }
};
