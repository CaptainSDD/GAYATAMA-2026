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

The API runs without Firebase configured. POI results are then cached in memory
only, so the cache is lost whenever the API restarts and the first request for
each area goes to Overpass. That is enough for development; configure Firebase
before a demo so the cache survives restarts.

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

The rules live in [`firestore.rules`](../firestore.rules) at the repository
root, and `firebase.json` points the Firebase CLI at them:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // POI cache: server-side only. The Admin SDK bypasses these rules;
    // this denies every client path to it.
    match /poiCache/{cell} {
      allow read, write: if false;
    }

    // Saved reports: readable by anyone holding the ID, but not listable —
    // `read` would also let anyone download every report. Writes go via the API.
    match /reports/{reportId} {
      allow get: if true;
      allow list, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy them from the repository root:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project your-project-id
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

The API depends on the workspace's scoring package, so its image is built from
the `Dockerfile` at the repository root:

```bash
gcloud run deploy gayatama-api \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,TRUST_PROXY_HOPS=1,CORS_ORIGINS=https://your-app.web.app,FIREBASE_PROJECT_ID=your-project-id" \
  --set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=gayatama-sa:latest"
```

`TRUST_PROXY_HOPS=1` lets the rate limiter see each visitor's IP address rather
than the address of Cloud Run's proxy. Locally, leave it unset (it defaults to
0).

In production, pass the service account through **Secret Manager** using
`FIREBASE_SERVICE_ACCOUNT_JSON` rather than mounting a file.

On Cloud Run the API can also use the runtime's default service account: grant
it the *Cloud Datastore User* role, set `FIREBASE_PROJECT_ID`, and leave
`FIREBASE_SERVICE_ACCOUNT_JSON` empty. Without `FIREBASE_PROJECT_ID` the API does
not use Firestore at all.

After deploying the API, set `VITE_API_BASE_URL` to the Cloud Run URL and
rebuild the frontend.

### Before judging: warm the cache

The first request for an area waits on Overpass — about 5 seconds for central
Surabaya — and depends on a shared public service being available at that
moment. With Firebase configured, request `/api/v1/pois` once for every location
you plan to demo, so those answers come from Firestore during judging.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '@gayatama/scoring'` | Engine not built | `npm run build --workspace @gayatama/scoring`. The root `npm run dev` and `npm test` build it first |
| Log: "Firebase is not configured" | `FIREBASE_PROJECT_ID` is empty | Expected in development; the POI cache is in memory. Set it to persist the cache |
| Log: "Firestore read failed" or "Firestore write failed" | Wrong credentials or project | Check `FIREBASE_PROJECT_ID` matches the service account's `project_id` |
| Requests return `504 UPSTREAM_TIMEOUT` | Overpass unreachable or overloaded, and nothing cached for the area | Retry shortly, or point `OVERPASS_URL` at an alternative instance |
| Every visitor is rate-limited together in production | The proxy is not trusted | Set `TRUST_PROXY_HOPS=1` |
| CORS errors in the browser | Frontend origin not allowed | Add it to `CORS_ORIGINS`, comma-separated |
| Overpass returns 429 | Rate limited | Raise `POI_CACHE_TTL_SECONDS`, or use an alternative instance |
| Map tiles blank | OSM tile policy throttling | Expected under heavy reload; switch tile provider for production |
| `PERMISSION_DENIED` from Firestore | Rules not deployed | `firebase deploy --only firestore:rules` |
