# Yoco Invoice Backend

Minimal Node.js server that sits between your Android app and Yoco's API.
Your Yoco secret key lives here — never in the app.

## Deploy to Render.com (free)

### Step 1 — GitHub
1. Go to github.com → sign in (or create free account)
2. Click **New repository** → name it `yoco-backend` → Public → Create
3. On your PC, open a terminal in `C:\Users\meyer\OneDrive\Desktop\APPS\yoco-backend`
4. Run these commands:
   ```
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/yoco-backend.git
   git push -u origin main
   ```
   Replace YOUR_USERNAME with your GitHub username.

### Step 2 — Render
1. Go to render.com → sign in with GitHub
2. Click **New +** → **Web Service**
3. Connect your `yoco-backend` repository
4. Settings:
   - **Name**: yoco-backend (or anything you like)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Click **Advanced** → **Add Environment Variable**:
   - Key: `YOCO_API_KEY`
   - Value: `yoco_live_d870ee71d25bee01_e975c0b557e3c3d53a49f7f48c53647b`
6. Click **Create Web Service**

### Step 3 — Get your URL
After deploy (takes ~2 minutes), Render gives you a URL like:
`https://yoco-backend-xxxx.onrender.com`

### Step 4 — Add URL to the app
1. Open InvoiceApp → hamburger menu → Settings → Invoice Settings → Invoice Payment
2. Paste the Render URL into **Backend Server URL**
3. Your Yoco API key field can stay filled in (used as fallback) or clear it
4. Tap Save

### Step 5 — Keep-alive (optional but recommended)
Render free tier sleeps after 15 minutes of inactivity. The WorkManager in your app
already has a 30-second timeout to handle cold starts, so it will just retry automatically.

If you want to prevent sleeping entirely, sign up for UptimeRobot (free) and add a
monitor that pings your Render URL every 14 minutes. This keeps the server warm so
responses are instant every time.

## Test it
Open a browser and go to: `https://your-url.onrender.com`
You should see: `{"status":"ok","service":"Yoco Invoice Backend"}`

That confirms the server is running. Now create an invoice in the app and wait for
the "Invoice ready to send" push notification.
