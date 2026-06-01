# Enabling TOTP 2FA on Cookly (Firebase Identity Platform)

This is not straightforward — TOTP is not available in standard Firebase Auth and requires several manual steps beyond just writing code.

---

## Prerequisites
- Firebase project on the **Blaze** (pay-as-you-go) plan

---

## Step 1: Upgrade to Firebase Blaze Plan
1. Go to Firebase Console → your project → **Upgrade** (bottom left)
2. Add a credit card and set a **$1 budget alert** to avoid unexpected charges

---

## Step 2: Upgrade to Google Cloud Identity Platform
1. In Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **Advanced** → **SMS Multi-factor Authentication**
3. Click **"Upgrade to enable"**
4. Complete the Identity Platform upgrade (free tier covers up to 49,999 MAU)

---

## Step 3: Enable TOTP via REST API (cannot be done through the UI)
The Firebase/Google Cloud Console only shows SMS MFA in the UI. TOTP must be enabled via a REST API call.

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** with your project selected
2. Open **Cloud Shell** (the `>_` terminal icon at the top right)
3. Set your project:
   ```bash
   gcloud config set project cookly-e712f
   ```
4. Run this command to enable TOTP:
   ```bash
   curl -X PATCH \
     "https://identitytoolkit.googleapis.com/v2/projects/cookly-e712f/config?updateMask=mfa" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "Content-Type: application/json" \
     -H "x-goog-user-project: cookly-e712f" \
     -d '{"mfa": {"state": "ENABLED", "providerConfigs": [{"state": "ENABLED", "totpProviderConfig": {"adjacentIntervals": 5}}]}}'
   ```
5. Confirm the response contains:
   ```json
   "mfa": {
     "state": "ENABLED",
     "providerConfigs": [{ "totpProviderConfig": { "adjacentIntervals": 5 }, "state": "ENABLED" }]
   }
   ```

---

## Step 4: Disable SMS MFA (optional but recommended)
Since we use TOTP (free) instead of SMS (paid per message):
1. Firebase Console → **Authentication** → **Sign-in method** → **Advanced**
2. Click **Change** next to SMS Multi-factor Authentication → **Disable**

---

## Step 5: Code changes needed
All code is already implemented in the project. For reference, the key pieces are:

- **`scripts/profile.js`** — TOTP enrollment UI (Enable/Verify/Disable)
- **`scripts/auth.js`** — MFA challenge on login (catches `auth/multi-factor-auth-required`)
- **`pages/profile.html`** — 2FA section with QR code display
- **`pages/Login.html`** — Authenticator code input form

### Important: Error code is `auth/multi-factor-auth-required`
Not `auth/multi-factor-required` (which you might find in older docs). The correct code has `-auth-` in the middle.

### Important: Email must be verified
Users must have a verified email before they can enroll in TOTP. The code handles this automatically by sending a verification email if needed.

### Important: Recent login required
Firebase requires a fresh login session before enrolling in 2FA. If the user gets `auth/requires-recent-login`, they need to sign out and sign back in.

---

## How it works for users
1. Go to **Profile** → **Two-Factor Authentication** → **Enable 2FA**
2. Scan the QR code with **Google Authenticator** or **Authy**
3. Enter the 6-digit code to confirm
4. On next login: enter email/password → enter 6-digit code from app
