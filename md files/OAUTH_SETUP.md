# Google OAuth & Firebase Auth Domain Configuration

## Why Google Sign-In only works locally by default

Firebase automatically adds `{project-id}.firebaseapp.com` to your Google OAuth credentials when you enable Google Sign-In. It does **not** auto-add `web.app` domains or custom site names. This means Google Sign-In works on localhost and the legacy `firebaseapp.com` domain out of the box, but fails on any other deployed domain with a `redirect_uri_mismatch` error.

---

## Configured Domains

### Google Cloud Console — OAuth 2.0 Credentials
*(APIs & Services → Credentials → OAuth 2.0 Client ID → Web client)*

**Authorized JavaScript Origins:**
```
http://localhost
http://localhost:5000
https://cookly-e712f.web.app
https://cookly-e712f.firebaseapp.com
https://cookly-recipes.web.app
https://cookly-recipes.firebaseapp.com
```

**Authorized Redirect URIs:**
```
https://cookly-e712f.web.app/__/auth/handler
https://cookly-e712f.firebaseapp.com/__/auth/handler
https://cookly-recipes.web.app/__/auth/handler
https://cookly-recipes.firebaseapp.com/__/auth/handler
```

The `/__/auth/handler` path is Firebase's internal OAuth callback URL. Google redirects back to it after the user authenticates, and Firebase completes the sign-in from there.

---

### Firebase Console — Authorized Domains
*(Authentication → Settings → Authorized domains)*

```
localhost
127.0.0.1
cookly-e712f.firebaseapp.com
cookly-e712f.web.app
cookly-recipes.web.app
cookly-recipes.firebaseapp.com
```

The first three (`localhost`, `cookly-e712f.firebaseapp.com`, `cookly-e712f.web.app`) are added automatically by Firebase as defaults. The rest were added manually.

---

## If you add a new domain in the future

You need to update **both** places:

1. **Google Cloud Console** — add the new origin and its `/__/auth/handler` redirect URI
2. **Firebase Console** — add the domain to the Authorized domains list

Missing either one will cause Google Sign-In to fail on that domain.
