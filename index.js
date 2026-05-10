const express = require('express');
const app = express();
app.use(express.json());

const YOCO_API_KEY = process.env.YOCO_API_KEY;
const PORT = process.env.PORT || 3000;

if (!YOCO_API_KEY) {
  console.error('ERROR: YOCO_API_KEY environment variable is not set');
  process.exit(1);
}

// Health check — Render pings this to keep the server alive
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Yoco Invoice Backend' }));

// Main endpoint — called by your Android app
app.post('/checkout', async (req, res) => {
  const { amount, currency = 'ZAR', externalReference } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const response = await fetch('https://online.yoco.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency, externalReference })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Yoco error:', data);
      return res.status(response.status).json({ error: 'Yoco API error', detail: data });
    }

    // Return just what the app needs
    res.json({
      id: data.id,
      redirectUrl: data.redirectUrl,
      status: data.status
    });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`Yoco backend running on port ${PORT}`));
