const express = require('express');
const app = express();
app.use(express.json());

const YOCO_API_KEY = process.env.YOCO_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PORT = process.env.PORT || 3000;

if (!YOCO_API_KEY) {
  console.error('[STARTUP] ERROR: YOCO_API_KEY is not set');
  process.exit(1);
}

console.log('[STARTUP] Key prefix:', YOCO_API_KEY.substring(0, 15) + '...');
console.log('[STARTUP] Key length:', YOCO_API_KEY.length);
console.log('[STARTUP] Resend key set:', RESEND_API_KEY ? 'YES' : 'NO');

async function sendEmail(subject, text) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'meyer@carpetlab.co.za',
        subject,
        text
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    console.log('[EMAIL] Sent successfully:', data.id);
  } catch (err) {
    console.error('[EMAIL] Failed:', err.message);
  }
}

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Yoco Invoice Backend' }));

app.post('/checkout', async (req, res) => {
  const { amount, currency = 'ZAR', externalReference } = req.body;
  console.log('[CHECKOUT] amount:', amount, 'ref:', externalReference);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${YOCO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, externalReference })
    });

    const rawText = await response.text();
    console.log('[CHECKOUT] Yoco status:', response.status);

    let data;
    try { data = JSON.parse(rawText); }
    catch (e) { return res.status(500).json({ error: 'Non-JSON response from Yoco', raw: rawText.substring(0, 200) }); }

    if (!response.ok) return res.status(response.status).json({ error: 'Yoco API error', detail: data });

    res.json({ id: data.id, redirectUrl: data.redirectUrl, status: data.status });

  } catch (err) {
    console.error('[CHECKOUT] Exception:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

app.post('/payment-link', async (req, res) => {
  const { amount, currency = 'ZAR', externalReference, description } = req.body;
  console.log('[PAYMENT-LINK] amount:', amount, 'ref:', externalReference);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const body = { amount, currency, externalReference, ...(description ? { description } : {}) };

  try {
    const response = await fetch('https://payments.yoco.com/api/payment-initiations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${YOCO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    console.log('[PAYMENT-LINK] Yoco status:', response.status);

    let data;
    try { data = JSON.parse(rawText); }
    catch (e) { return fallbackToCheckout(res, amount, currency, externalReference); }

    if (!response.ok) return fallbackToCheckout(res, amount, currency, externalReference);

    const paymentUrl = data.paymentUrl || data.redirectUrl || data.url;
    if (!paymentUrl) return fallbackToCheckout(res, amount, currency, externalReference);

    console.log('[PAYMENT-LINK] Success, URL:', paymentUrl);
    res.json({ id: data.id || '', redirectUrl: paymentUrl, status: data.status || 'created' });

  } catch (err) {
    console.error('[PAYMENT-LINK] Exception:', err.message);
    return fallbackToCheckout(res, amount, currency, externalReference);
  }
});

async function fallbackToCheckout(res, amount, currency, externalReference) {
  console.log('[FALLBACK] Using /checkout endpoint instead');
  try {
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${YOCO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, externalReference })
    });
    const rawText = await response.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch (e) { return res.status(500).json({ error: 'Non-JSON fallback response' }); }
    if (!response.ok) return res.status(response.status).json({ error: 'Yoco fallback error', detail: data });
    res.json({ id: data.id, redirectUrl: data.redirectUrl, status: data.status });
  } catch (err) {
    res.status(500).json({ error: 'Fallback server error', detail: err.message });
  }
}

app.post('/webhook', async (req, res) => {
  const event = req.body;
  console.log('[WEBHOOK] Received:', JSON.stringify(event));

  if (event.type === 'payment.succeeded') {
    const { amount, currency, externalReference } = event.payload || {};
    const amountFormatted = `R${(amount / 100).toFixed(2)}`;
    await sendEmail(
      `Payment Received — ${externalReference || 'Invoice'}`,
      `A payment of ${amountFormatted} ${currency} has been received.\n\nReference: ${externalReference}\nAmount: ${amountFormatted}`
    );
  }

  res.json({ received: true });
});

app.listen(PORT, () => console.log('[STARTUP] Running on port', PORT));