# Cookly — Presentation Slides
> Each `---` is a slide break. Import into PowerPoint, Google Slides, or use Marp to render directly.

---

# Slide 1 — Title

# 🍳 Cookly
## Community Cooking Recipes Web Application

**Course:** Web Engineering (ECE5604)
**Institution:** Arab Academy for Science, Technology & Maritime Transport (AASTMT)
**Semester:** Term 8 — 2025 / 2026

> [ Team Member 1 ] · [ Team Member 2 ] · [ Team Member 3 ]

---

# Slide 2 — Problem Statement

# The Problem

### Existing recipe platforms fall short in four key areas:

- 📌 **One-directional content** — users can only consume recipes, not contribute their own to a shared community feed
- 💬 **No author communication** — no direct channel to ask the recipe author a question within the platform
- 🤖 **Tedious manual creation** — filling all recipe fields by hand is slow with no AI assistance
- 🔒 **No content moderation** — user submissions on open platforms go live without any review, leading to low-quality content
- 🛡️ **Privacy gaps** — most web chat stores messages as plain readable text in the database

---

# Slide 3 — Proposed Solution

# Cookly

### A full-stack community recipe platform that solves all five problems:

| Problem | Our Solution |
|---|---|
| One-directional content | Users publish recipes → admin reviews → community feed |
| No author communication | Built-in encrypted user-to-user messaging |
| Tedious creation | AI recipe generation from a photo or text description |
| No moderation | Pending review queue with admin approve / reject |
| Privacy gaps | AES-GCM 256-bit encryption on all chat messages |

> Built entirely with **Firebase** (no backend server) and **Google Gemini AI** — deployed live at **cookly-recipes.web.app**

---

# Slide 4 — Team & Task Organization

# Team & Responsibilities

| Member | Role | Key Deliverables |
|---|---|---|
| [ Name 1 ] | Full-Stack Lead | Firebase config, Auth system, AI integration, Chat encryption, Deployment |
| [ Name 2 ] | Frontend Developer | UI/UX design, CSS architecture, Login & Register pages, Responsive layout |
| [ Name 3 ] | Frontend Developer | Recipe features, Comments, Favourites, Profile page, Chat UI |

### Sub-Groups

- **Frontend** — [ Name 2 ], [ Name 3 ] — all HTML pages, CSS, responsive design
- **Backend / Firebase** — [ Name 1 ] — Firestore rules, Auth, Storage, Hosting
- **AI & Security** — [ Name 1 ] — Gemini API integration, AES-GCM encryption
- **DevOps** — [ Name 1 ] — Firebase Hosting, OAuth domain config, two live domains

---

# Slide 5 — Work Steps & Outcomes

# Development Phases

| Phase | What We Built | Outcome |
|---|---|---|
| 1 | Firebase setup, Firestore schema, Auth config | Working login/register on localhost |
| 2 | Home page, Recipe Details, Browse & Search | Browsable recipe catalog with filters |
| 3 | Favourites, Create Recipe, Edit Recipe | Full user recipe CRUD |
| 4 | Profile page — avatar crop, inline edits, stats | Complete profile management |
| 5 | Gemini AI — recipe generation + Chef AI chatbot | AI-assisted creation & in-app assistant |
| 6 | Google OAuth, TOTP 2FA, password reset | Full multi-method auth system |
| 7 | Voting, Comments, Admin approval workflow | Community engagement & moderation |
| 8 | Encrypted user-to-user messaging + reactions | Private real-time chat |
| 9 | Mobile responsive design, Bootstrap migration | Works across all screen sizes |
| 10 | Firebase Hosting deployment, OAuth domain config | Live at cookly-recipes.web.app |

---

# Slide 6 — Final Product Features (Core)

# Core Features

### 🔐 Authentication
- Email/password · Google OAuth · Forgot password
- TOTP Two-Factor Authentication (QR code + authenticator app)
- Auto verification email on registration

### 🍽️ Recipe Discovery
- Browse built-in + community recipes
- Live search · Category filter · Time & calorie filters · Sort by most liked
- Paginated cards (12 per page) with lazy-loaded vote counts

### ❤️ Favourites & Voting
- Save recipes with a heart button
- Upvote / downvote with atomic Firestore transactions (no race conditions)
- Not logged in → redirected to login · Not verified → disabled with message

---

# Slide 7 — Final Product Features (Advanced)

# Advanced Features

### 🤖 AI Integration (Google Gemini 2.5 Flash)
- Generate a full recipe from a **food photo** (base64 upload)
- Generate a full recipe from a **text description**
- **Chef AI chatbot** — cooking-only assistant on the home page

### 💬 Encrypted User Messaging
- Real-time chat between any two users
- **AES-GCM 256-bit encryption** — messages stored as ciphertext in Firestore
- Message reactions, unread badge, mobile slide layout

### 🛡️ Admin Approval Workflow
- Users submit recipes → pending review queue
- Admin expands full recipe details → Approve (publishes) or Reject (reverts to private)
- Admin recipes bypass the queue and publish immediately

---

# Slide 8 — Technical Specifications

# Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript ES Modules | Multi-page app, no build step |
| CSS | Custom modular CSS + Bootstrap 5.3 | Styling & responsive layout |
| Backend | Firebase (BaaS) | Auth, Firestore, Storage, Hosting |
| Database | Firestore (NoSQL) | Persistent offline cache via IndexedDB |
| Auth | Firebase Authentication | Email, Google OAuth, TOTP MFA |
| AI | Google Gemini 2.5 Flash API | Recipe generation + Chef AI chatbot |
| Encryption | Web Crypto API (browser-native) | AES-GCM chat encryption, PBKDF2 key derivation |
| Image Crop | Cropper.js | Square avatar crop before upload |
| Hosting | Firebase Hosting (CDN) | Global delivery, HTTPS |
| Version Control | Git + GitHub | Branch: `Hecko` → `main` |

### Firestore Collections
`recipes` · `published_recipes` · `users/{uid}/favorites` · `users/{uid}/recipes_created` · `pending_reviews` · `recipe_interactions` · `conversations`

---

# Slide 9 — Achievements & Results

# What We Achieved

### ✅ Fully Deployed & Live
- **cookly-recipes.web.app** — accessible on any device, any browser

### ✅ Complete Feature Set Delivered
- 11 HTML pages · 10 JavaScript modules · 8 CSS files
- Authentication with 2FA · AI generation · Encrypted chat · Admin moderation

### ✅ Security Implemented
- Firestore server-side security rules on every collection
- AES-GCM end-to-end encrypted messages (browser Web Crypto API)
- Gemini API key stored in `.gitignore`d `config.js` — never committed to repo
- Google OAuth configured across both live domains

### ✅ Cross-Platform
- Tested on Chrome, Opera GX, iOS Safari (mobile)
- Responsive from 320px to 1440px

### ✅ Real-World Architecture
- Serverless (no Node.js/Express server needed)
- Offline-capable via Firestore's IndexedDB persistent cache
- Firebase Hosting CDN with 99.95% uptime SLA

---

# Slide 10 — Live Demo & Thank You

# 🎉 Thank You

## Live Demo
### cookly-recipes.web.app

---

### Key Highlights
- 🔐 Register → verify email → login with 2FA
- 🤖 Create a recipe using AI (photo or text)
- 👍 Vote and comment on community recipes
- 💬 Message a recipe author with encrypted chat
- 🛡️ Admin review and publish a submitted recipe

---

> **Questions?**

[ Name 1 ] · [ Name 2 ] · [ Name 3 ]
**AASTMT — Web Engineering (ECE5604) — Term 8**
