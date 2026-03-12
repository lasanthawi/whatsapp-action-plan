# WhatsApp Agent Permissions (Error #10)

If the auto-reply agent fails with **"(#10) Application does not have permission for this action"**, the app does not have the required Meta/WhatsApp permissions to send messages.

## Required permissions

Your **access token** must include:

- **`whatsapp_business_management`** – manage WhatsApp Business Account and phone numbers
- **`whatsapp_business_messaging`** – send and receive messages

## Steps to fix

### 1. Add permissions to your Meta app

1. Go to [Meta for Developers](https://developers.facebook.com/) → **Your App** → **App Dashboard**.
2. Open **Use cases** or **App settings** → **Basic**.
3. Under **Add Products**, ensure **WhatsApp** is added.
4. In **WhatsApp** → **API Setup** (or **Configuration**), confirm your app has access to the correct **WhatsApp Business Account** and **Phone number**.

### 2. Request / add permissions

1. In the app dashboard, go to **App Review** → **Permissions and features** (or **Use cases**).
2. Request or add:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. In **development mode**, these are usually available without App Review. In **live mode**, you may need to submit for review.

### 3. Generate a token with the right scopes

Use a **System User** token (recommended for production) so the token has the correct permissions:

1. Go to [Meta Business Suite](https://business.facebook.com/) → **Business Settings** (gear icon).
2. **Users** → **System users** → select (or create) a system user.
3. Click **Generate new token**.
4. Select your **Meta app** (the one used for WhatsApp).
5. Under **Permissions**, enable:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
6. Generate the token and copy it.
7. Set this token as **`WHATSAPP_ACCESS_TOKEN`** in your environment (e.g. Vercel).

### 4. Verify the token

1. Open [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
2. Paste your `WHATSAPP_ACCESS_TOKEN`.
3. Click **Debug**.
4. Check that **Scopes** (or **Permissions**) include:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

If any are missing, generate a new token (step 3) and include them.

### 5. Development mode: test numbers

If the app is in **development**:

1. In **WhatsApp** → **API Setup**, find **"To"** or **"Send and receive messages"**.
2. Add the recipient phone number(s) as **test numbers** (with country code, no `+`).
3. Only these numbers can receive messages until the app is live.

## Summary checklist

- [ ] WhatsApp product added to the Meta app
- [ ] Permissions `whatsapp_business_management` and `whatsapp_business_messaging` requested/added
- [ ] Token generated from **System user** with both permissions
- [ ] Token set as `WHATSAPP_ACCESS_TOKEN` in Vercel (or your host)
- [ ] In development: recipient added as test number in WhatsApp API Setup

After updating the token in Vercel, redeploy or wait for env to apply, then trigger the webhook again.
