# Installation & Setup

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (24 recommended) | `.nvmrc` pins 24. With nvm: `nvm use` |
| npm | ≥ 10 | Ships with Node 20+. Workspaces are required, so npm 7+ is a hard floor |
| Git | any recent | |
| Firebase project | — | Free (Spark) tier is sufficient for development |

Verify:

```bash
node --version   # v20.x or newer
npm --version    # 10.x or newer
```

---

## Quick start

```bash
git clone https://github.com/CaptainSDD/GAYATAMA-2026.git
cd GAYATAMA-2026

npm install

cp .env.example .env
```

`npm install` installs every workspace and links `@gayatama/scoring` into both
apps. Do not run `npm install` inside a subdirectory — it will break the
workspace symlinks.

Run in development:

```bash
npm run dev          # web + api together
npm run dev:web      # frontend only  → http://localhost:5173
npm run dev:api      # backend only   → http://localhost:3000
```

The frontend runs without Firebase configured. Scoring works; caching and saved
reports do not, and every POI request goes straight to Overpass. That is enough
to develop the UI, but expect it to be slow and to hit rate limits.

---

## Firebase setup

Needed for the POI cache and saved reports.

### 1. Create the project

1. Open the [Firebase console](https://console.firebase.google.com/) and create
   a project.
2. **Build → Firestore Database → Create database.** Start in **production
   mode**; the rules below replace the defaults.
3. Choose a region close to your users (`asia-southeast2`, Jakarta, for
   Indonesia).

### 2. Server credentials (`apps/api`)

**Project settings → Service accounts → Generate new private key.** This
downloads a JSON file.

> **This key grants full read and write access to your database.** This
> repository is public. Never place the file inside the project directory, even
> temporarily — a stray `git add -A` is all it takes.

Store it outside the repository and point to it:

```bash
# .env
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/repo/serviceAccount.json
```

`.gitignore` blocks `*serviceAccount*.json`, `firebase-adminsdk-*.json`, and
`.env` as a second line of defence — but the primary defence is keeping the file
elsewhere.

### 3. Web credentials (`apps/web`)

**Project settings → General → Your apps → Web app.** Copy the config values:

```bash
# .env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=...
```

These are **public by design**. A Firebase web API key identifies the project;
it does not authorise access. Security comes from Firestore rules, which is why
the rules below matter more than the key does.

### 4. Firestore security rules

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // POI cache: server-side only. The Admin SDK bypasses these rules;
    // this denies every client path to it.
    match /poiCache/{cell} {
      allow read, write: if false;
    }

    // Saved reports: readable by anyone holding the ID; writes go via the API.
    match /reports/{reportId} {
      allow read: if true;
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy them:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Overpass API

No key or account is required. The default public instance is configured out of
the box:

```bash
OVERPASS_URL=https://overpass-api.de/api/interpreter
OVERPASS_TIMEOUT_MS=30000
```

Public instances are rate-limited and shared. During development the Firestore
cache absorbs most of this; if you hit 429s repeatedly, either raise
`POI_CACHE_TTL_SECONDS` or switch to an alternative instance
(`https://overpass.kumi.systems/api/interpreter`).

Please respect the [Overpass usage policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
— it is a volunteer-funded service.

---

## Verifying the setup

```bash
npm run typecheck      # must pass with no errors
npm test               # scoring engine tests must be green
npm run build          # all workspaces build
```

The scoring engine tests are the meaningful check. They assert every worked
example from [methodology.md](methodology.md), so a green suite means the
implementation matches the documented methodology.

---

## Deployment

### Frontend → Firebase Hosting

```bash
npm run build --workspace @gayatama/web
firebase deploy --only hosting
```

### Backend → Cloud Run

```bash
gcloud run deploy gayatama-api \
  --source apps/api \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,CORS_ORIGINS=https://your-app.web.app" \
  --set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=gayatama-sa:latest"
```

In production, pass the service account through **Secret Manager** using
`FIREBASE_SERVICE_ACCOUNT_JSON` rather than mounting a file.

On Cloud Run the API can also use the runtime's default service account, in
which case no explicit credential is needed at all — grant the Cloud Run service
account the *Cloud Datastore User* role and leave both Firebase credential
variables empty.

After deploying the API, set `VITE_API_BASE_URL` to the Cloud Run URL and
rebuild the frontend.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '@gayatama/scoring'` | Engine not built, or install run in a subdirectory | `npm install` at the repo root, then `npm run build --workspace @gayatama/scoring` |
| API starts but every POI request fails | Firebase credentials missing or wrong project | Check `FIREBASE_PROJECT_ID` matches the service account's `project_id` |
| CORS errors in the browser | Frontend origin not allowed | Add it to `CORS_ORIGINS`, comma-separated |
| Overpass returns 429 | Rate limited | Raise `POI_CACHE_TTL_SECONDS`, or use an alternative instance |
| Map tiles blank | OSM tile policy throttling | Expected under heavy reload; switch tile provider for production |
| `PERMISSION_DENIED` from Firestore | Rules not deployed | `firebase deploy --only firestore:rules` |
