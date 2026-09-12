# Installation & Setup

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 (24 recommended) | `.nvmrc` pins 24. With nvm: `nvm use` |
| npm | ≥ 10 | Ships with Node 20+. Workspaces are required, so npm 7+ is a hard floor |
| Git | any recent | |
| Firebase project | — | Free (Spark) tier is sufficient for development |
| Google Cloud project with billing | — | Optional: the Google map and Google business counts |

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

Without Google keys, the web app draws an OpenStreetMap map and every facility
comes from OpenStreetMap — see [Google Maps Platform](#google-maps-platform-optional).

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

### 3. Web app (`apps/web`)

The web app needs no Firebase configuration: it reads everything through the
API. Only the API's address is configurable:

```bash
# .env
VITE_API_BASE_URL=http://localhost:3000
```

The Firestore security rules below still matter: they are what stops any
client from reading or writing the database directly.

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

## Geoapify Places API

The primary POI source. Geoapify serves OpenStreetMap data over a hosted API
with an availability guarantee the public Overpass instances do not offer.

1. Register at [Geoapify MyProjects](https://myprojects.geoapify.com/) and
   create a project.
2. Copy the API key from the **API Keys** section.
3. Put it in `.env` — server-side only, never with a `VITE_` prefix:

```bash
GEOAPIFY_API_KEY=your-api-key
GEOAPIFY_BASE_URL=https://api.geoapify.com/v2
GEOAPIFY_TIMEOUT_MS=20000
GEOAPIFY_MAX_PLACES=1000
```

The free plan allows 3,000 credits per day, and Places API costs 1 credit per
20 places returned. `GEOAPIFY_MAX_PLACES` caps a single cell, so one cold cell
costs at most 50 credits; the POI cache means an area is paid for once per
`POI_CACHE_TTL_SECONDS`.

Leave `GEOAPIFY_API_KEY` empty and the API falls back to Overpass for POIs.

---

## Overpass API

No key or account is required. The main public instance and two fallback
instances are configured by default:

```bash
OVERPASS_URL=https://overpass-api.de/api/interpreter
OVERPASS_FALLBACK_URLS=https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter
OVERPASS_TIMEOUT_MS=30000
```

When an instance cannot be reached, rate-limits or is overloaded, the API tries
the next one; set `OVERPASS_FALLBACK_URLS` to an empty value to use
`OVERPASS_URL` alone. Public instances are shared and can all be unavailable at
the same time — the areas in [OSM snapshots](#osm-snapshots) do not depend on
them.

Please respect the [Overpass usage policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
— it is a volunteer-funded service.

---

## Google Maps Platform (optional)

With Google keys, the web app draws a Google map and the API adds Google
business counts — see [data-sources.md](data-sources.md#google-maps-business-counts).
Without them, everything runs on OpenStreetMap.

### 1. Enable the APIs

In the [Google Cloud console](https://console.cloud.google.com/), select or
create a project and link a billing account. Under **APIs & Services →
Library**, enable **Places Aggregate API** and **Maps JavaScript API**.

### 2. Create two keys

Under **APIs & Services → Credentials → Create credentials → API key**, create
one key for each side, and restrict each:

| Key | Application restriction | API restriction |
|-----|-------------------------|-----------------|
| Server key | None: Cloud Run has no fixed outbound IP address | Places Aggregate API only |
| Browser key | Websites: `http://localhost:5173/*` and your production origin, such as `https://your-app.web.app/*` | Maps JavaScript API only |

> **The browser key is visible to anyone who opens the web app.** The website
> restriction is what stops others from using it. The server key must never
> reach the browser, and neither key may be committed.

### 3. Configure

```bash
# .env
GOOGLE_PLACES_API_KEY=your-server-key
VITE_GOOGLE_MAPS_API_KEY=your-browser-key

# Optional. A Map ID for the Google map; defaults to Google's DEMO_MAP_ID, which is for development
VITE_GOOGLE_MAP_ID=
# Optional. How long counts stay cached, in seconds: default 604800 (7 days), at most 2592000 (30 days)
PLACE_COUNT_CACHE_TTL_SECONDS=604800
GOOGLE_PLACES_TIMEOUT_MS=10000
```

Restart `npm run dev` after changing `.env`: the API reads it at startup, and
Vite reads `VITE_` variables when it starts or builds.

### 4. Cap the cost

A new location takes 25 to 75 Places Aggregate requests, and 5,000 a month are
free. On the Places Aggregate API's **Quotas & System Limits** page, lower the
requests-per-day limit, and add a budget alert under **Billing → Budgets &
alerts**. When the quota runs out, the API falls back to OpenStreetMap and the
interface says so.

---

## OSM snapshots

The areas listed in `apps/api/scripts/osm-areas.json` are answered from
OpenStreetMap snapshots in `apps/api/data/osm-snapshots` instead of Overpass.
The API loads every `*.json.gz` file there at startup — set `OSM_SNAPSHOT_DIR`
to use another directory — and uses a snapshot whenever a query's whole circle
lies inside it. The committed snapshots work as they are; rebuild them to add an
area or refresh the data.

**1. Choose the areas.** Edit `apps/api/scripts/osm-areas.json`. With a 3,000 m
radius, every click within about 1.3 km of the centre is covered.

**2. Download an extract and install pyosmium** in a directory outside the
repository (here `D:/osm`; any directory works):

```bash
cd D:/osm
curl -LO https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf
python -m venv venv
venv/Scripts/python -m pip install osmium      # venv/bin/python on macOS and Linux
```

**3. Extract the areas.** For Java this takes about 40 minutes. Node locations
are indexed on disk, so it needs little memory but about 3 GB of free disk:

```bash
venv/Scripts/python <repo>/apps/api/scripts/osm_extract.py \
  --pbf java-latest.osm.pbf --areas <repo>/apps/api/scripts/osm-areas.json \
  --out D:/osm/raw --index D:/osm/nodes.idx
```

**4. Build the snapshots** from the repository root:

```bash
npm run osm:snapshots -w @gayatama/api -- D:/osm/raw
```

Commit the resulting files. They are OpenStreetMap data under ODbL 1.0 — see
[data-sources.md](data-sources.md#licence-and-attribution).

---

## Overture places

The areas listed in `apps/api/scripts/overture-areas.json` get photocopy,
printing and stationery shops from Overture Maps, stored in
`apps/api/data/overture-places`. The API loads every `*.json.gz` file there at
startup — set `OVERTURE_PLACES_DIR` to use another directory. The committed files
work as they are; rebuild them to add an area or use a newer Overture release.
No account or large download is needed: each area takes about a minute.

**1. Choose the areas.** Edit `apps/api/scripts/overture-areas.json`. These areas
are independent of the OSM snapshot areas.

**2. Extract the places** into a directory outside the repository, with DuckDB:

```bash
cd D:/osm
python -m venv venv                              # once
venv/Scripts/python -m pip install duckdb        # venv/bin/python on macOS and Linux
venv/Scripts/python <repo>/apps/api/scripts/overture_extract.py \
  --areas <repo>/apps/api/scripts/overture-areas.json --out D:/osm/raw-overture
```

`--release` selects another Overture release; the default is `2026-08-19.0`.

**3. Build the files** from the repository root:

```bash
npm run overture:places -w @gayatama/api -- D:/osm/raw-overture
```

Commit the resulting files. `CDLA-Permissive-2.0.txt` must stay beside them — see
[data-sources.md](data-sources.md#overture-maps-places).

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
  --set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=gayatama-sa:latest,GEOAPIFY_API_KEY=gayatama-geoapify:latest,GOOGLE_PLACES_API_KEY=gayatama-places-key:latest"
```

Leave out `GOOGLE_PLACES_API_KEY` to run without Google counts.

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
rebuild the frontend. `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID` are
also read at build time.

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
| Requests return `504 UPSTREAM_TIMEOUT` | The POI source failed and nothing is cached for the area | Check the log for which source failed. Geoapify: verify `GEOAPIFY_API_KEY` and the daily credit quota. Overpass: retry, or point `OVERPASS_URL` at an alternative instance |
| Log: "Geoapify responded 401" | Invalid or restricted API key | Check the key, and any IP or referrer restrictions on the Geoapify project |
| Response reports `siteConditions: "unavailable"` | The Overpass site query failed | Site inputs are scored as unknown. Point `OVERPASS_URL` at a reachable instance to restore them |
| Every visitor is rate-limited together in production | The proxy is not trusted | Set `TRUST_PROXY_HOPS=1` |
| CORS errors in the browser | Frontend origin not allowed | Add it to `CORS_ORIGINS`, comma-separated |
| Overpass returns 429 | Rate limited | Raise `POI_CACHE_TTL_SECONDS`, or use an alternative instance |
| Map tiles blank | OSM tile policy throttling | Expected under heavy reload; switch tile provider for production |
| `PERMISSION_DENIED` from Firestore | Rules not deployed | `firebase deploy --only firestore:rules` |
| Notice: "Business counts from Google Maps could not be loaded" | Google rejected or failed the count requests | The API log gives the reason. `403 PERMISSION_DENIED`: Places Aggregate API not enabled, billing not linked, or excluded by the key's API restriction. `429 RESOURCE_EXHAUSTED`: quota reached |
| Notice: "Google Maps business counts are not set up on the server" | The web app has a browser key, but the API has no `GOOGLE_PLACES_API_KEY` | Set it and restart the API |
| The Google map says "This page can't load Google Maps correctly" | Browser key rejected | Check that the key's website restriction includes the page's origin, that Maps JavaScript API is enabled, and that billing is linked |
