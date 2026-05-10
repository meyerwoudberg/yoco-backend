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

app.get('/', (req, res) => res.json({ status: 'ok' }));

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

app.listen(PORT, () => console.log('[STARTUP] Running on port', PORT));