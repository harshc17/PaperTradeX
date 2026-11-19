# Google sign-in setup

Google Identity Services uses a public Web application Client ID. This flow does not need a client secret, Google API access tokens, or access to Gmail, Drive or other Google services.

## Google Auth Platform

1. Open https://console.cloud.google.com/auth/overview and select or create a PaperTradeX project.
2. Complete Branding with the name PaperTradeX and a support email you control. Use:
   - Homepage: `https://papertradex.in`
   - Privacy: `https://papertradex.in/privacy`
   - Terms: `https://papertradex.in/terms`
   - Authorized domain: `papertradex.in`
3. Choose an External audience. While in Testing, add the Google accounts that will test sign-in. Publish the audience when ready for public use; follow any ownership or branding verification Google requests.
4. Create a client with type Web application. Add JavaScript origins:
   - `https://papertradex.in`
   - `https://www.papertradex.in` if this hostname serves the website
   - `http://localhost` and `http://localhost:3014` for the local test copy
5. Leave redirect URIs empty: this implementation uses Google's JavaScript callback.
6. Copy the public Client ID ending in `.apps.googleusercontent.com`. Do not share the client secret.

## Deployment

Set `GOOGLE_CLIENT_ID` to the same Client ID on Render and Railway. Retain the existing shared JWT secret and MongoDB database. Redeploy both backends after changing the setting. No frontend Client ID or secret is required: the login page reads public configuration from `/api/auth/google/config` at runtime.

When disabled, that endpoint returns `{ "enabled": false }`, and the Google option is hidden. When enabled, it returns the public Client ID and a short-lived, signed request challenge. The backend verifies Google's signed ID token, audience and request nonce before reading or changing any account.

The Google library loads only on the login/signup screen, after configuration is available. Its official button resizes with the form. The login page permits Google's sign-in popup through its opener policy.

## Account behavior

- Returning Google users are identified by Google's stable subject ID.
- A Google-authoritative Gmail or Workspace identity can link to an existing account with the same email. The user ID, password, role, token version, balance and trading records are preserved.
- New verified Google accounts receive the normal virtual starting balance and no password.
- A non-Gmail, non-Workspace Google email does not prove continuing ownership of that mailbox. An unlinked account using such an address must use email sign-in rather than automatically linking a password account.
- Unique database constraints and duplicate-create recovery prevent simultaneous Google sign-ins from creating duplicate accounts.

## Verification

Test a new Google account, an existing password account with a matching authoritative Google email, cancelled account selection, and a blocked Google script. Privately complete Google account selection and consent; do not copy ID tokens, passwords or OTPs into chat. Confirm that existing holdings, balance and orders remain unchanged.

Official instructions: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
