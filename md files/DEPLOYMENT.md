# Cookly — Deployment Guide

## Prerequisites

Make sure you have the following installed:

- **Node.js** — [nodejs.org](https://nodejs.org) (LTS version)
- **Firebase CLI** — install once with:
  ```
  npm install -g firebase-tools
  ```

---

## First-Time Setup

### 1. Log in to Firebase
```
firebase login
```
A browser window will open — sign in with the Google account linked to the Cookly Firebase project.

### 2. The `firebase.json` config file is already set up in the project root. No changes needed.

---

## Deploying the Website

Run this command from the Cookly project folder:

```
firebase deploy --only hosting --project cookly-e712f
```

This deploys to **all hosting sites** at once, keeping both URLs in sync.

The site will be live at:
- **https://cookly-recipes.web.app** (main URL)
- **https://cookly-recipes.firebaseapp.com**
- https://cookly-e712f.web.app
- https://cookly-e712f.firebaseapp.com

---

## Pushing Updates to the Live Site

Whenever you make changes to the code, run the same command to push them live:

```
firebase deploy --only hosting --project cookly-e712f
```

Firebase only uploads changed files so subsequent deploys are faster than the first.

> If you only want to update one site and not the other, you can target it specifically:
> ```
> firebase deploy --only hosting:cookly-recipes --project cookly-e712f
> ```

---

## Gemini API Key Restriction

The Gemini API key is restricted to only work from the Cookly domains. If you ever need to update it (e.g. after adding a new domain):

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select the **Cookly** project from the top dropdown
3. Left sidebar → **APIs & Services** → **Credentials**
4. Click **Cookly API Key** to edit it
5. Under **Application restrictions** → **Websites** — the following entries should be present:
   ```
   cookly-e712f.web.app/*
   cookly-e712f.firebaseapp.com/*
   cookly-recipes.web.app/*
   cookly-recipes.firebaseapp.com/*
   ```
6. Under **API restrictions** → **Gemini API** should be selected
7. Click **Save** — takes up to 5 minutes to take effect

> **Important:** If you add a custom domain later, add it here too or the AI chatbot and recipe generator will stop working on that domain.

---

## Firebase Project Info

| Item | Value |
|---|---|
| Project ID | `cookly-e712f` |
| Hosting site | `cookly-recipes` |
| Live URL | https://cookly-recipes.web.app |
| Firebase Console | https://console.firebase.google.com/project/cookly-e712f |

---

## If You Get Logged Out of Firebase CLI

Just run `firebase login` again and re-authenticate.
