# Developer Guide - AI Geo-Timestamp

Quick reference guide for developers contributing to or understanding this project.

## Table of Contents
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Key Functions Reference](#key-functions-reference)
- [State Management](#state-management)
- [External APIs](#external-apis)
- [Caching Strategy](#caching-strategy)
- [Offline Support](#offline-support)
- [Common Tasks](#common-tasks)
- [Testing](#testing)

---

## Quick Start

**Zero build setup** - but serve over HTTP, don't open the file directly:
geolocation, clipboard and service workers all need a secure context, and
`file://` is not one.

```bash
git clone https://github.com/Glushiator/chat-tools.git
cd chat-tools
git config core.hooksPath hooks   # one-time: enables the cache-busting hook
python3 -m http.server 8000       # then visit http://localhost:8000
```

`http://localhost` counts as a secure context, so everything works there.

**Do not skip the `core.hooksPath` line.** `hooks/pre-commit` is what keeps
`CACHE_NAME` moving; git deliberately never enables a cloned repo's hooks by
itself, and without it every commit ships a service worker that returning
clients treat as unchanged.

**Tech Stack:**
- Vue 3 (production build via CDN)
- Buefy 1.x (Bulma + Vue components)
- Material Design Icons + Font Awesome
- Vanilla JavaScript (ES6+)
- Service Worker API
- Geolocation API
- Clipboard API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    index.html                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  Global status line (v-text)                 │  │
│  ├──────────────────────────────────────────────┤  │
│  │  Vue 3 App (tools-app component)             │  │
│  │  Tabs: Copy | Locations | Settings           │  │
│  │  - Event Handlers                            │  │
│  │  - State Management (localStorage)           │  │
│  └──────────────────────────────────────────────┘  │
│                         │                            │
│                         ↓                            │
│  ┌──────────────────────────────────────────────┐  │
│  │  Utility Functions (index.js)                │  │
│  │  - ClipboardWriter (Future-based Promise)    │  │
│  │  - getPosition(options)   → Geolocation      │  │
│  │  - getAddress(lat,lon,r)  → OSM Nominatim    │  │
│  │  - getWeather(pos)        → Open-Meteo       │  │
│  │  - currentTimestamp()     → Formatted date   │  │
│  │  - identifyPosition(...)  → Match logic      │  │
│  │  - normalizeLocation()    → Validation       │  │
│  │  - throttleNominatim()    → 1 req/s queue    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              │                          │
              ↓                          ↓
    ┌──────────────────┐      ┌──────────────────┐
    │  External APIs   │      │  localStorage    │
    │  - OSM           │      │  - savedLocations│
    │  - Open-Meteo    │      │  - darkMode      │
    └──────────────────┘      └──────────────────┘

┌─────────────────────────────────────────────────────┐
│              service-worker.js                       │
│  - Cache-first, ignoreSearch: true                  │
│  - Offline fallback to index.html on navigation     │
│  - SKIP_WAITING / GET_VERSION message handlers      │
└─────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. **index.html** (635 lines)
Single-page Vue 3 application with inline template.

**Component:** `tools-app`
- **Template:** `#tools-app-template` (lines 201-275)
- **Component definition:** lines 320-608
- **Service worker registration + reload logic:** lines 611-633

**Key sections:**
- Global status line (lines 202-204)
- Copy tab, two buttons (lines 207-221)
- Locations tab (lines 223-257)
- Settings tab: dark mode, updates, version (lines 259-273)

**Helpers defined outside the component:**
- `askServiceWorkerVersion()` (lines 287-302) - MessageChannel round trip
- `whenInstalled(worker)` (lines 305-317) - resolves when a worker is promotable

### 2. **index.js** (299 lines)
Utility functions and core business logic.

**Classes:**
- `Future` (lines 1-29): Promise subclass with external resolve/reject
- `ClipboardWriter` (lines 41-96): Async clipboard writing with cancellation and
  a `writeText` fallback

**Functions:**
- `supportsDeferredClipboard()` (35) - feature detection for `ClipboardItem`
- `weatherCodeToString()` (99) - maps WMO codes to readable strings
- `formatCoords(lat, lon)` (150) - `(50.000000, 20.000000)`, 6 dp ≈ 0.1 m
- `fetchWithTimeout(url, ms)` (156) - AbortController-backed fetch
- `throttleNominatim(task)` (171) - serializes geocodes at 1 req/s
- `getAddress(lat, lon, radius)` (183) - reverse geocoding, distance-cached
- `calculateDistance()` (205) - Haversine formula for geo-distance
- `getPosition(options)` (222) - Promise wrapper for Geolocation API
- `getWeather(pos)` (237) - current weather, time+distance cached
- `currentTimestamp()` (263) - formatted timestamp string
- `identifyPosition(pos, saved, updateStatus, options)` (271) - label or address
- `normalizeLocation(loc)` (290) - the one definition of a valid stored location

**Tunable constants** (lines 137-141):

| Constant | Value | Meaning |
|---|---|---|
| `GEOCODE_CACHE_RADIUS` | 200 m | Reuse an address while within this distance |
| `WALK_CACHE_RADIUS` | 10 m | Same, for walk mode |
| `SAVED_LOCATION_RADIUS` | 100 m | Distance at which a saved label wins |
| `WEATHER_CACHE_MAX_AGE` | 1 h | Weather TTL |
| `WEATHER_CACHE_RADIUS` | 5 km | Distance that invalidates cached weather |

Position options live at lines 218-219 (`POSITION_OPTIONS`,
`PRECISE_POSITION_OPTIONS`).

### 3. **service-worker.js** (90 lines)
PWA offline support.

**Strategy:**
- **Precache:** All app files + CDN resources (lines 3-31, 28 entries)
- **Runtime:** Cache-first for GET requests, `ignoreSearch: true`
- **Fallback:** index.html on failed navigation; other failures rethrow

**Cache name:** `geo-timestamp-cache-<timestamp>`, rewritten automatically by
`hooks/pre-commit`. Do not edit it by hand.

**Deliberately no `skipWaiting()` in `install`.** A new worker parks in
`waiting` so the Settings tab can detect it. Promotion happens only when the
page sends `SKIP_WAITING`.

### 4. **manifest.json**
PWA configuration for "Add to Home Screen" functionality.

---

## Data Flow

### Copy Timestamp Flow
```
User clicks a Copy button → copyInfo(walkMode)
    ↓
1. ClipboardWriter initialized (claims the clipboard inside the gesture)
2. getPosition(walkMode ? PRECISE_POSITION_OPTIONS : POSITION_OPTIONS)
     ↳ on failure: clipboardWriter.cancel(), status + toast, abort
3. currentTimestamp()
4. Promise.allSettled([identifyPosition(...), getWeather(pos)])
     ↳ either may fail independently; the other still contributes
5. walk mode only: append formatCoords(lat, lon)
    ↓
`[timestamp at location; weather]`
    ↓
clipboardWriter.writeText() → status + success toast
    ↓
finally: busy = false   (a catch-all cancels the writer on any surprise)
```

`lookup` decides the mode (index.html:414-416):

```javascript
const lookup = walkMode
  ? { radius: WALK_CACHE_RADIUS, useSavedLocations: false }
  : { radius: GEOCODE_CACHE_RADIUS, useSavedLocations: true }
```

### Save Location Flow
```
User enters label → "Save Current Location"
    ↓
saveLocation()
    ↓
Reject empty label / duplicate label (case-insensitive)
    ↓
getPosition(PRECISE_POSITION_OPTIONS)
    ↓
Push {label, coords:{lat, lon}} → saveToStore() → localStorage
    ↓
Table updates reactively; status reports the saved label
```

### Update Flow
```
Settings → "Check for Updates"
    ↓
registration.update()
    ↓
pending = registration.waiting || registration.installing
    ↓  (none → "App is up to date.")
whenInstalled(pending)
    ↓
armUpdateReload(); pending.postMessage({type:'SKIP_WAITING'})
    ↓
worker activates → claim() → 'controllerchange' → location.reload()
    ↓  (5s with no takeover → "Reload the page to use it.")
```

---

## Key Functions Reference

### `ClipboardWriter` Class
**Purpose:** Handle async clipboard writes with better control than `navigator.clipboard.writeText()`.

**Why it exists:** Browsers require the clipboard write to start inside the user
gesture, but the text is not known until GPS and two HTTP calls have completed.
`ClipboardItem` accepts a `Promise<Blob>`, so the write is claimed immediately
and fed later.

```javascript
const writer = new ClipboardWriter()
// ... do async work ...
await writer.writeText("final text")  // or writer.cancel()
```

**Fallback:** if `ClipboardItem` is missing (Firefox), `deferred` stays false and
`writeText()` calls `navigator.clipboard.writeText()` directly. That happens
after the awaits, so the browser may reject it - unavoidable without
pre-computing everything.

**`cancel()` is idempotent** - call it on any error path without checking state.

**Used in:** `index.html:385-467` (copyInfo method)

---

### `getAddress(lat, lon, radius = GEOCODE_CACHE_RADIUS)`
**Returns:** Promise&lt;string&gt; - Address or `"(lat, lon)"`

**Caching:**
- Reuses the cached address while within `radius` metres of where it was fetched
- Stored in: `geocodeCache` object (module scope)
- **Failures are never cached** - a dropped request must not pin coordinates in
  place for the next 200 m

**Throttling:** every call goes through `throttleNominatim()`, which serializes
requests at least 1s apart per Nominatim's usage policy.

**API:** `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=0`

**Timeout:** 10s via `fetchWithTimeout()`

---

### `getWeather(pos)`
**Returns:** Promise&lt;string&gt; - Weather description or "Weather unavailable"

**Caching:** valid for 1 hour **and** within 5 km of where it was fetched. Both
conditions must hold, so driving out of town refreshes it. Failures are not
cached.

**API:** `https://api.open-meteo.com/v1/forecast`

**Format:** `"Weather: 22°C, Clear sky, wind 12 km/h"`

**WMO Codes:** 28 weather conditions mapped (see `weatherCodeToString`)

---

### `identifyPosition(pos, savedLocations, updateStatus, options)`
**Returns:** Promise&lt;string&gt; - `"at [Location Label]"` or `"at [Address]"`

**Options:** `{ radius = GEOCODE_CACHE_RADIUS, useSavedLocations = true }`

**Logic:**
1. If `useSavedLocations`, check saved locations; any within
   `SAVED_LOCATION_RADIUS` (100 m) wins and returns its label
2. Otherwise call `getAddress()` with the given cache radius

Walk mode passes `useSavedLocations: false` so it always produces a street
address - the plain button is the one that honours saved labels.

---

### `getPosition(options = POSITION_OPTIONS)`
**Returns:** Promise&lt;GeolocationPosition&gt;

Rejects with a descriptive `Error` on failure, and on an unsupported browser.
Always pass options: the API's default `timeout` is `Infinity`.

---

### `calculateDistance(lat1, lon1, lat2, lon2)`
**Returns:** number - Distance in meters

**Algorithm:** Haversine formula
- Accounts for Earth's curvature
- Accurate for distances < 1000km
- Earth radius: 6,371,000 meters

---

### `normalizeLocation(loc)`
**Returns:** `{label, coords:{lat, lon}}` or `null`

Rejects non-objects, blank labels, non-numeric or non-finite coordinates, and
out-of-range latitude/longitude. Used by both `loadSaved()` and `handleImport()`
so storage and imports enforce identical rules.

---

### `currentTimestamp()`
**Returns:** string - Formatted date/time

**Format:** `"Fri, Jul 4, 2025, 3:32 PM"`

**Locale:** en-US, 12-hour format

**Customization tip:** This is a good candidate for user preferences (see Contributing in README)

---

## State Management

### localStorage Schema

**Key:** `savedLocations`
```json
[
  {
    "label": "Home",
    "coords": {
      "lat": 37.7749,
      "lon": -122.4194
    }
  }
]
```

**Key:** `darkMode`
```json
"true" | "false"
```

A corrupt `savedLocations` value is caught in `loadSaved()`, reported through the
status line, and treated as empty. It is **not** overwritten, so the raw value
stays recoverable from devtools until the user saves something.

### Vue Component State

```javascript
data() {
  return {
    label: '',              // Input for new location label
    savedLocations: [],     // Loaded from localStorage
    darkMode: false,        // Loaded from localStorage
    status: READY_STATUS,   // The single global status line
    activeTab: 0,           // 0 Copy, 1 Locations, 2 Settings
    cacheVersion: 'unknown',// Reported by the service worker
    busy: false,            // A copy is in flight
    savingLocation: false,  // A save is in flight
    checkingUpdate: false,  // An update check is in flight
  }
}
```

All user feedback goes through `updateStatus()`. There is no second status
property - everything shares the one line above the tabs.

**Reactive updates:** Changes to `savedLocations` automatically update the table view (Buefy `<b-table>`).

---

## External APIs

### 1. OpenStreetMap Nominatim
**Endpoint:** `https://nominatim.openstreetmap.org/reverse`

**Params:** `format=json`, `zoom=18`, `addressdetails=0`, `lat`, `lon`

**Response:**
```json
{
  "display_name": "123 Main St, Springfield, IL 62701, USA",
  ...
}
```

**Rate Limit:** 1 req/sec (usage policy). Enforced by `throttleNominatim()`, and
further reduced by the distance cache. Browsers cannot set `User-Agent`, so the
throttle is the only compliance lever we have.

**Terms:** Must not use for bulk geocoding. See: https://operations.osmfoundation.org/policies/nominatim/

---

### 2. Open-Meteo
**Endpoint:** `https://api.open-meteo.com/v1/forecast`

**Params:**
- `latitude={latitude}`
- `longitude={longitude}`
- `current_weather=true`

**Response:**
```json
{
  "current_weather": {
    "temperature": 22.5,
    "weathercode": 0,
    "windspeed": 12.3
  }
}
```

**Rate Limit:** Free tier, reasonable use. No API key required.

**WMO Codes:** https://open-meteo.com/en/docs#api-formats

---

## Caching Strategy

### Why Caching Matters
- Reduce API calls (rate limits)
- Faster response times
- Better offline experience
- Lower network usage

### Implementation

**Geocoding Cache:**
```javascript
const geocodeCache = { lat: null, lon: null, address: null }
```
- **Invalidation:** new position further than the caller's `radius` from the
  cached position (200 m normally, 10 m in walk mode)
- **Reason for 200m:** typical city block, prevents cache thrashing
- **Reason for 10m:** on foot, the street address genuinely changes that fast

**Weather Cache:**
```javascript
const weatherCache = { time: 0, lat: null, lon: null, value: null }
```
- **TTL:** 1 hour (weather doesn't change rapidly)
- **Distance:** 5 km - weather does not change block to block, but it does change
  between towns, and a purely time-based cache reported the wrong town's weather

### The Rule Both Caches Follow

**Never cache a failure.** The error paths in `getAddress()` and `getWeather()`
return a fallback string without touching the cache. Caching them meant one
dropped request degraded every subsequent timestamp for an hour, or until the
user moved 200 m.

### Potential Improvements
- Store caches in localStorage for persistence across reloads
- Implement LRU for multiple geocode results

---

## Offline Support

### Service Worker Lifecycle

**Install Phase:**
```javascript
caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
```
Downloads 28 assets (app files + CDN mirrors). No `skipWaiting()` here on
purpose - see below.

**Activate Phase:**
- Deletes old caches, **then** `clients.claim()` (both inside `waitUntil`, so
  cleanup cannot race the claim)

**Fetch Phase:**
```javascript
caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request))
```

**`ignoreSearch` is load-bearing.** MDI's stylesheet requests
`materialdesignicons-webfont.woff2?v=5.8.55`, while the precache list stores the
file without a query string. `caches.match` compares query strings by default,
so every icon font request missed the cache and fell through to the network -
producing tofu rectangles whenever connectivity was poor. Do not remove it.

### Why install does not call `skipWaiting()`

With an unconditional `skipWaiting()`, a new worker activates the moment it
installs and never appears in `registration.waiting`. "Check for Updates" then
found nothing pending and reported "App is up to date" immediately after a new
version had silently taken over. Now the worker waits, the button can see it,
and promotion is explicit.

The page reloads on `controllerchange`, guarded so it fires only when a worker
replaces an existing controller **or** the user asked for the update
(`armUpdateReload()`). Without that guard, the first-ever `claim()` would trigger
a pointless reload on a first visit.

### What Works Offline
✅ App loads completely
✅ Icons render (the cache actually serves the fonts now)
✅ Dark mode toggle
✅ View saved locations
✅ Location matching (if GPS available)
✅ Export locations
✅ Import locations

### What Doesn't Work Offline
❌ Address lookup (returns coordinates instead)
❌ Weather data (shows "Weather unavailable")

### Testing Offline Mode
1. Load app once (service worker installs)
2. Open DevTools → Application → Service Workers
3. Check "Offline" checkbox
4. Reload page
5. App should still work, **with icons**, and no network requests

---

## Common Tasks

### Add a New Weather Code
**File:** `index.js`

```javascript
function weatherCodeToString(code) {
  const mapping = {
    // ... existing codes ...
    98: "Thunderstorm with hail",  // Add new code
  };
  return mapping[code] || `WTHR(${code})`;
}
```

---

### Change a Proximity or Cache Threshold
**File:** `index.js` lines 137-141 - all five thresholds are named constants.

```javascript
const SAVED_LOCATION_RADIUS = 100  // ← distance at which a saved label wins
const WALK_CACHE_RADIUS = 10       // ← walk mode geocode cache
```

No magic numbers are left in the function bodies; change them here.

---

### Customize Output Format
**File:** `index.html` (copyInfo method, line 442)

```javascript
// Current format:
const finalStr = `[${timestamp} ${locationString}; ${weatherInfo}]`

// Example alternatives:
const finalStr = `${timestamp} - ${locationString} (${weatherInfo})`
const finalStr = JSON.stringify({ timestamp, location: locationString, weather: weatherInfo })
```

---

### Add a New Saved Location Field
**Files:** `index.html`, `index.js`

1. Extend `normalizeLocation()` in `index.js` so the field survives load/import
2. Set it in `saveLocation()`:
```javascript
this.savedLocations.push({
  label,
  coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
  notes: this.notes,
})
```
3. Add a column:
```html
<b-table-column field="notes" label="Notes" v-slot="props">
  {{ props.row.notes }}
</b-table-column>
```

**Do not skip step 1** - `loadSaved()` and `handleImport()` both rebuild entries
through `normalizeLocation()`, so any field it does not copy is silently dropped.

---

### Update Cache Version (Force Refresh)
**Handled for you.** `hooks/pre-commit` rewrites `CACHE_NAME` to
`geo-timestamp-cache-$(date +%Y%m%d-%H%M%S)` whenever a commit has staged files,
and re-stages `service-worker.js`:

```bash
NEW_VERSION="geo-timestamp-cache-$(date +%Y%m%d-%H%M%S)"
perl -i -pe "s/^const CACHE_NAME = '[^']+';/const CACHE_NAME = '${NEW_VERSION}';/" "$SERVICE_WORKER"
git add "$SERVICE_WORKER"
```

The hook lives in the repo rather than `.git/hooks/` so it survives a clone, and
it refuses to fail quietly: if `service-worker.js` has no recognisable
`CACHE_NAME` line it warns on stderr instead of committing an unbumped worker.

**One-time setup per clone:** `git config core.hooksPath hooks`. Git will not
enable a repository's own hooks automatically, and there is no portable way to
make it - running code straight from a clone is a security hole. Verify with:

```bash
git config core.hooksPath                    # → hooks
git show HEAD:service-worker.js | head -1    # → a fresh timestamp after a commit
```

**What happens on the client:** the new worker installs and waits; the Settings
tab's "Check for Updates" promotes it and reloads. Old caches are deleted during
activation.

---

### Add a New CDN Resource
**Files:** `index.html`, `service-worker.js`

1. Add link/script tag to `index.html`
2. Download resource to local mirror directory
3. Add path to `PRECACHE_ASSETS` array in service worker (without any query
   string - `ignoreSearch: true` handles versioned URLs)

`CACHE_NAME` takes care of itself via the pre-commit hook.

---

## Testing

### Automated Checks

There is no test framework, but `index.js` is a plain classic script with no DOM
dependencies at load time, so it can be loaded into a Node `vm` context with a
stubbed `fetch`. This is how the caching behaviour is verified:

```javascript
const fs = require('fs'), vm = require('vm');
let calls = [], nextResponse = null;
const ctx = {
  console, setTimeout, clearTimeout, AbortController, Date, Math, Number, Promise, Blob,
  fetch: async (url) => {
    calls.push(url);
    if (nextResponse instanceof Error) throw nextResponse;
    return { json: async () => nextResponse };
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('index.js', 'utf8'), ctx);

// Gotcha: top-level `const` does NOT become a property of the context object.
// Function declarations do. Read constants from inside the context:
const K = vm.runInContext('({WALK: WALK_CACHE_RADIUS, GEO: GEOCODE_CACHE_RADIUS})', ctx);

nextResponse = new Error('offline');
await ctx.getAddress(50, 20);                       // → "(50.000000, 20.000000)"
nextResponse = { display_name: 'Real Street 1' };
await ctx.getAddress(50, 20);                       // → retries; failure wasn't cached
```

Worth covering: cache hit/miss at each radius, failure paths not caching,
weather invalidation by distance, `normalizeLocation()` rejections, walk mode
ignoring saved locations, and the Nominatim throttle spacing calls ≥1s apart.

Syntax-check the inline scripts too, since they never pass through a bundler:

```bash
node --check index.js && node --check service-worker.js
node -e "const fs=require('fs'),vm=require('vm');
[...fs.readFileSync('index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .forEach((m,i)=>new vm.Script(m[1],{filename:'inline-'+i}));
console.log('inline scripts parse OK')"
```

### Manual Testing Checklist

**Core Functionality:**
- [ ] Plain copy creates correct format
- [ ] Walk copy appends coordinates and ignores a nearby saved location
- [ ] Saved location matches within 100m (plain button only)
- [ ] Address lookup works (not near saved location)
- [ ] Weather displays correctly
- [ ] Dark mode toggles and persists (Settings tab)
- [ ] Every action reports to the single status line

**Location Management:**
- [ ] Save location with label (Enter key works too)
- [ ] Duplicate label is rejected
- [ ] Delete location
- [ ] Export to JSON
- [ ] Import merges rather than replaces
- [ ] Import invalid JSON shows error
- [ ] Import with some invalid entries reports the skipped count

**Edge Cases:**
- [ ] Geolocation denied (error status + toast, clipboard write cancelled)
- [ ] Geolocation hangs (times out after 10s / 15s rather than forever)
- [ ] Network offline (coordinates + "Weather unavailable", nothing cached)
- [ ] Corrupt `savedLocations` in localStorage (app still loads)
- [ ] Empty label (rejected)

**Cross-Browser:**
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox (exercises the `writeText` clipboard fallback)
- [ ] Safari (especially iOS for clipboard API)

**PWA:**
- [ ] Install to home screen (mobile)
- [ ] Works offline after first load, **icons included**
- [ ] "Check for Updates" finds a bumped `CACHE_NAME` and reloads
- [ ] "Check for Updates" says "up to date" when nothing changed

---

## File Structure Summary

```
chat-tools/
├── index.html              # Main app (635 lines)
│   └── Vue 3 SPA with inline template
├── index.js                # Utilities (299 lines)
│   ├── Future class
│   ├── ClipboardWriter class
│   └── 11 core functions
├── service-worker.js       # PWA offline (90 lines)
│   └── Cache-first strategy, ignoreSearch
├── manifest.json           # PWA metadata (15 lines)
├── icon-256.png            # App icon
├── hooks/
│   └── pre-commit          # Bumps CACHE_NAME; enable with core.hooksPath
├── README.md               # User documentation
├── CLAUDE.md               # Code analysis / architecture notes
├── DEVELOPER_GUIDE.md      # This file
├── LICENSE                 # Unlicense (public domain)
├── poc.html               # Buefy test file (can ignore)
│
├── cdn.jsdelivr.net/       # Local CDN mirrors
│   └── Buefy, MDI fonts
├── unpkg.com/              # Local CDN mirrors
│   └── Vue 3
└── use.fontawesome.com/    # Local CDN mirrors
    └── Font Awesome 5
```

**Total LOC:** ~1000 lines of actual code (excluding CDN resources)

---

## Architecture Decisions

### Why No Build System?
**Pros:**
- Zero setup friction
- Works everywhere (just serve the folder)
- Easy to understand (no webpack configs)
- Perfect for small projects

**Cons:**
- No TypeScript
- No JSX/SFC
- No tree-shaking
- CDN dependencies (larger initial load)
- Cache busting depends on a git hook each clone must enable once

**When to migrate:** If project grows beyond ~1000 LOC or needs npm packages.

---

### Why Future Class?
Standard Promises can't be resolved externally. ClipboardWriter needs to:
1. Start clipboard write immediately (must be in user gesture)
2. Populate data after async operations complete

**Alternative considered:** Pre-compute all data before clipboard write
**Why rejected:** GPS can take 5+ seconds; user might cancel

---

### Why Two Copy Buttons?
A single button cannot serve both uses. Standing still, a saved label and a
200 m cache are exactly right: private, stable, few API calls. Walking, both are
wrong - "at Home" erases the route, and a 200 m cache repeats an address that is
already two blocks stale.

Rather than infer intent from movement (unreliable, and it would need
`watchPosition`), the mode is an explicit choice. Walk mode turns off saved
locations entirely, drops the cache radius to 10 m, requests a high-accuracy fix
with no cached position, and appends the coordinates.

---

### Why Cache in Memory vs localStorage?
**Current:** Caches stored in module-scope variables (cleared on page reload)

**Tradeoff:**
- ✅ Simpler code
- ✅ No serialization overhead
- ❌ Lost on page refresh (noticeable mid-walk)
- ❌ Not shared across tabs

**To persist caches:**
```javascript
localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache))
const geocodeCache = JSON.parse(localStorage.getItem('geocodeCache')) ||
  { lat: null, lon: null, address: null }
```

---

### Why Buefy?
**Alternatives:** Vuetify, BootstrapVue, PrimeVue

**Chosen because:**
- Lightweight (vs Vuetify)
- Clean Bulma design
- Good mobile support
- Works with CDN (no build required)

**Downside:** Buefy 1.x is in maintenance mode (Buefy 2 not released)

**Vue 3 note:** the `.native` event modifier does not exist in Vue 3. Listeners
such as `@keyup.enter` on `<b-input>` land on the component's root `<div>` via
attribute fallthrough and work because the event bubbles from the inner input.

---

## Performance Considerations

### Bundle Size
**Total download (first visit):** ~500KB
- Vue 3: 140KB
- Buefy: 180KB
- Font Awesome: 80KB
- MDI: 70KB
- App code: ~15KB

**After service worker:** 0 bytes (all cached)

### Optimization Opportunities
1. **Lazy load icons:** Only include used glyphs
2. **Preconnect to APIs:** `<link rel="preconnect" href="https://nominatim.openstreetmap.org">`
3. **Background sync:** Queue failed API calls for retry

---

## Security Considerations

### Current Security Posture
✅ **No server-side code** - Can't be hacked
✅ **No user accounts** - No credential theft
✅ **HTTPS required** - Geolocation + Clipboard APIs need it
✅ **No eval()** - No code injection vectors
✅ **Status line uses `v-text`** - labels and imported data cannot inject markup
✅ **Import validation** - `normalizeLocation()` gates every stored entry
✅ **Public domain license** - No legal issues

### Potential Risks
⚠️ **Location privacy:** GPS coordinates stored in localStorage (readable by any script on same origin)
⚠️ **API abuse:** mitigated by the 1 req/s throttle and the distance caches

### Hardening Recommendations
```html
<!-- Add CSP header -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               connect-src 'self' nominatim.openstreetmap.org api.open-meteo.com">
```
(All CDN resources are mirrored locally, so `'self'` is sufficient for scripts.)

---

## Debugging Tips

### Enable Service Worker Logging
```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
  console.log('SW fetch:', event.request.url)  // Add logging
  // ... rest of handler
})
```

### Check What the Cache Actually Holds
```javascript
// Browser console - the icon-rectangle class of bug lives here
const c = await caches.open((await caches.keys())[0])
const reqs = await c.keys()
reqs.map(r => r.url).filter(u => u.includes('webfont'))
```

### Inspect localStorage
```javascript
JSON.parse(localStorage.getItem('savedLocations'))
```

### Clear All Data
```javascript
localStorage.clear()
caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
navigator.serviceWorker.getRegistrations().then(regs =>
  regs.forEach(reg => reg.unregister())
)
```

### Test Error Paths
```javascript
// Simulate geolocation failure
navigator.geolocation.getCurrentPosition = (success, error) => {
  error({ code: 1, message: 'User denied' })
}

// Simulate a dead network for the APIs only
const realFetch = window.fetch
window.fetch = (u, o) => /nominatim|open-meteo/.test(u) ? Promise.reject(new Error('offline')) : realFetch(u, o)
```

---

## Contributing Workflow

1. **Fork repository**
2. **Create feature branch:** `git checkout -b feature/your-feature`
3. **Make changes** (test in multiple browsers)
4. **Test offline mode** (service worker + airplane mode)
5. **Confirm `git config core.hooksPath` is `hooks`** - without it `CACHE_NAME`
   never changes and clients keep the old assets
6. **Update docs** (this file + CLAUDE.md + README if user-facing)
7. **Commit:** Clear message explaining "why" not just "what"
8. **Push and create PR**

**Code style:**
- 2-space indentation
- No semicolons (current style)
- Async/await over .then() chains
- Descriptive variable names
- Thresholds as named constants, not literals in function bodies

---

## Troubleshooting

### "Icons show as rectangles"
**Cause:** the font file was requested with a query string the precache key
lacked, so `caches.match` missed and the request hit the network.
**Fix:** already handled by `ignoreSearch: true` in the fetch handler. If it
recurs after adding a font, confirm the precache entry has **no** query string.

### "Clipboard write failed"
**Cause:** must be triggered by a user gesture; on Firefox the fallback
`writeText()` runs after the awaits and may be refused.
**Fix:** ensure `copyInfo()` is only called from a button click.

### "Service worker not updating"
**Cause:** `CACHE_NAME` unchanged, so the worker byte-compares identical -
usually because `core.hooksPath` was never set in this clone.
**Fix:** `git config core.hooksPath hooks` and re-commit, or DevTools →
Application → Service Workers → "Update on reload".

### "Check for Updates says 'up to date' but I deployed"
**Cause:** the deployed `service-worker.js` is byte-identical. Check that the
hook actually ran (`git show HEAD:service-worker.js | head -1` should show a
fresh timestamp), that `core.hooksPath` is set, and that the server is not
serving a stale worker script.

### "Address shows as (lat, lon)"
**Cause:** Nominatim request failed, timed out, or the app is offline.
**Fix:** check the network tab. Note the failure is not cached, so simply
pressing the button again retries.

### "Location not matching saved location"
**Cause:** GPS accuracy > 100m, or you used the walk button (which ignores saved
locations by design).
**Fix:** use the plain button, raise `SAVED_LOCATION_RADIUS`, or re-save the
location while standing at the exact spot.

### "Dark mode not persisting"
**Cause:** localStorage blocked (private browsing)
**Fix:** Check browser settings, localStorage.setItem() might throw

---

## Resources

- **Vue 3 Docs:** https://vuejs.org/guide/
- **Buefy Docs:** https://buefy.org/documentation
- **Service Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Geolocation API:** https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- **Clipboard API:** https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API

---

## Quick Reference Card

```javascript
// Get current position (always pass options; the API default never times out)
const pos = await getPosition(POSITION_OPTIONS)          // or PRECISE_POSITION_OPTIONS

// Reverse geocode, with an explicit cache radius
const address = await getAddress(lat, lon, WALK_CACHE_RADIUS)

// Get weather (cached 1h AND within 5km)
const weather = await getWeather(pos)

// Format timestamp / coordinates
const timestamp = currentTimestamp()
const coords = formatCoords(lat, lon)

// Calculate distance
const meters = calculateDistance(lat1, lon1, lat2, lon2)

// Match a saved label, or geocode
const locationStr = await identifyPosition(pos, savedLocations, updateStatus, {
  radius: GEOCODE_CACHE_RADIUS,
  useSavedLocations: true,     // false = walk mode
})

// Validate a stored/imported location
const clean = normalizeLocation(raw)   // null if invalid

// Write to clipboard (construct inside the user gesture)
const writer = new ClipboardWriter()
await writer.writeText("text to copy")   // or writer.cancel()
```

---

**Last Updated:** 2026-09-18
**Contributors:** Glushiator, Claude Sonnet 4.5, Claude Opus 5
