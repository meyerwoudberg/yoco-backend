const express = require('express');
const app = express();
app.use(express.json());

const YOCO_API_KEY = process.env.YOCO_API_KEY;
const PORT = process.env.PORT || 3000;

if (!YOCO_API_KEY) {
  console.error('[STARTUP] ERROR: YOCO_API_KEY is not set');
  process.exit(1);
}

console.log('[STARTUP] Key prefix:', YOCO_API_KEY.substring(0, 15) + '...');
console.log('[STARTUP] Key length:', YOCO_API_KEY.length);

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Yoco Invoice Backend' }));

// ── /checkout — used for invoices (c.yoco.com) ───────────────────────────────
app.post('/checkout', async (req, res) => {
  const { amount, currency = 'ZAR', externalReference } = req.body;
  console.log('[CHECKOUT] amount:', amount, 'ref:', externalReference);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const YOCO_URL = 'https://payments.yoco.com/api/checkouts';
  console.log('[CHECKOUT] Calling:', YOCO_URL);

  try {
    const response = await fetch(YOCO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency, externalReference })
    });

    const rawText = await response.text();
    console.log('[CHECKOUT] Yoco status:', response.status);
    console.log('[CHECKOUT] Yoco raw response:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('[CHECKOUT] Response was not JSON — wrong endpoint or network issue');
      return res.status(500).json({ error: 'Non-JSON response from Yoco', raw: rawText.substring(0, 200) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Yoco API error', detail: data });
    }

    res.json({ id: data.id, redirectUrl: data.redirectUrl, status: data.status });

  } catch (err) {
    console.error('[CHECKOUT] Exception:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── /payment-link — used for Payment Links (pay.yoco.com with merchant logo) ─
// Calls Yoco Payment Initiations API which produces pay.yoco.com URLs.
// These URLs show your merchant logo (from your Yoco business profile) in WhatsApp.
// Falls back to /checkout automatically if Payment Initiations isn't enabled.
app.post('/payment-link', async (req, res) => {
  const { amount, currency = 'ZAR', externalReference, description } = req.body;
  console.log('[PAYMENT-LINK] amount:', amount, 'ref:', externalReference);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const YOCO_URL = 'https://payments.yoco.com/api/payment-initiations';
  console.log('[PAYMENT-LINK] Calling:', YOCO_URL);

  const body = {
    amount,
    currency,
    externalReference,
    ...(description ? { description } : {})
  };

  try {
    const response = await fetch(YOCO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    console.log('[PAYMENT-LINK] Yoco status:', response.status);
    console.log('[PAYMENT-LINK] Yoco raw response:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('[PAYMENT-LINK] Response was not JSON — falling back to checkout');
      return fallbackToCheckout(res, amount, currency, externalReference);
    }

    if (!response.ok) {
      console.error('[PAYMENT-LINK] Yoco error — falling back to checkout:', data);
      return fallbackToCheckout(res, amount, currency, externalReference);
    }

    // Payment initiations returns paymentUrl (pay.yoco.com)
    const paymentUrl = data.paymentUrl || data.redirectUrl || data.url;
    if (!paymentUrl) {
      console.error('[PAYMENT-LINK] No URL in response — falling back to checkout:', data);
      return fallbackToCheckout(res, amount, currency, externalReference);
    }

    console.log('[PAYMENT-LINK] Success, URL:', paymentUrl);
    res.json({
      id: data.id || data.paymentInitiationId || '',
      redirectUrl: paymentUrl,
      status: data.status || 'created'
    });

  } catch (err) {
    console.error('[PAYMENT-LINK] Exception:', err.message, '— falling back to checkout');
    return fallbackToCheckout(res, amount, currency, externalReference);
  }
});

// Fallback: if payment-initiations isn't available, use checkout (c.yoco.com)
async function fallbackToCheckout(res, amount, currency, externalReference) {
  console.log('[FALLBACK] Using /checkout endpoint instead');
  try {
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency, externalReference })
    });

    const rawText = await response.text();
    console.log('[FALLBACK] Yoco status:', response.status);

    let data;
    try { data = JSON.parse(rawText); }
    catch (e) { return res.status(500).json({ error: 'Non-JSON fallback response', raw: rawText.substring(0, 200) }); }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Yoco fallback error', detail: data });
    }

    console.log('[FALLBACK] Success, URL:', data.redirectUrl);
    res.json({ id: data.id, redirectUrl: data.redirectUrl, status: data.status });

  } catch (err) {
    console.error('[FALLBACK] Exception:', err.message);
    res.status(500).json({ error: 'Fallback server error', detail: err.message });
  }
}

app.listen(PORT, () => console.log('[STARTUP] Running on port', PORT));
