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
    // Required env vars on Vercel:
    // SMTP_HOST=smtp.sendgrid.net
    // SMTP_PORT=587
    // SMTP_USER=apikey                 (literally the word "apikey")
    // SMTP_PASS=SG.xxxxxxxxxxxxxxxxx   (your SendGrid API key)
    // FROM_EMAIL="Sociabl Website <no-reply@sociablpty.com>"
    // TO_EMAIL=admin@sociablpty.com
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS, // your SendGrid API key
      },
    });

    const from = process.env.FROM_EMAIL || 'Sociabl Website <no-reply@sociablpty.com>';
    co
