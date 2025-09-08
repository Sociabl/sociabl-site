// /api/contact.js
const nodemailer = require('nodemailer');

// Helper: read raw JSON body (works in Vercel Node functions)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[s]));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let payload = {};
  try {
    const bodyStr = await readBody(req);
    payload = JSON.parse(bodyStr || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, email, message, company } = payload;

  // Honeypot: if filled, pretend success (quietly drop spam)
  if (company) return res.status(200).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                // e.g. smtp.sendgrid.net
      port: Number(process.env.SMTP_PORT) || 587, // 465 for SSL, 587 for TLS
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,              // e.g. "apikey" for SendGrid
        pass: process.env.SMTP_PASS,              // your API key or SMTP password
      },
    });

    const from = process.env.FROM_EMAIL || 'Sociabl Website <no-reply@sociablpty.com>';
    const to   = process.env.TO_EMAIL   || 'admin@sociablpty.com';

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
