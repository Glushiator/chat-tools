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

**Zero build setup** - Just open `index.html` in a browser. All dependencies load via CDN.

```bash
# Clone and run
git clone https://github.com/Glushiator/chat-tools.git
cd chat-tools
open index.html  # or python3 -m http.server 8000
```

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
│  │  Vue 3 App (tools-app component)             │  │
│  │  - User Interface                            │  │
│  │  - Event Handlers                            │  │
│  │  - State Management (localStorage)           │  │
│  └──────────────────────────────────────────────┘  │
│                         │                            │
│                         ↓                            │
│  ┌──────────────────────────────────────────────┐  │
│  │  Utility Functions (index.js)                │  │
│  │  - ClipboardWriter (Future-based Promise)    │  │
│  │  - getPosition() → Geolocation              │  │
│  │  - getAddress() → OSM Nominatim             │  │
│  │  - getWeather() → Open-Meteo                │  │
│  │  - currentTimestamp() → Formatted date      │  │
│  │  - identifyPosition() → Match logic         │  │
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
│  - Cache-first strategy for app files              │
│  - Network-first for API calls                      │
│  - Offline fallback support                         │
└─────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. **index.html**
Single-page Vue 3 application with inline template.

**Component:** `tools-app`
- **Template ID:** `#tools-app-template` (lines 26-67)
- **Component Definition:** lines 77-181

**Key Sections:**
- Dark mode toggle (line 28-30)
- Copy timestamp button (line 34)
- Location management UI (lines 38-66)
- Service worker registration (lines 185-189)

### 2. **index.js**
Utility functions and core business logic (211 lines).

**Classes:**
- `Future` (lines 1-29): Promise subclass with external resolve/reject
- `ClipboardWriter` (lines 32-64): Async clipboard writing with cancellation

**Functions:**
- `weatherCodeToString()` - Maps WMO codes to readable strings
- `getAddress()` - Reverse geocoding with 200m cache
- `calculateDistance()` - Haversine formula for geo-distance
- `getPosition()` - Promise wrapper for Geolocation API
- `getWeather()` - Fetch current weather with 1-hour cache
- `currentTimestamp()` - Formatted timestamp string
- `identifyPosition()` - Match current location to saved locations

### 3. **service-worker.js**
PWA offline support (69 lines).

**Strategy:**
- **Precache:** All app files + CDN resources (lines 3-34)
- **Runtime:** Cache-first for GET requests
- **Fallback:** Show index.html when offline

**Cache name:** `geo-timestamp-cache-v1` (update version to bust cache)

### 4. **manifest.json**
PWA configuration for "Add to Home Screen" functionality.

---

## Data Flow

### Copy Timestamp Flow
```
User clicks "Copy Timestamp & Location"
    ↓
copyInfo() method executes
    ↓
1. ClipboardWriter initialized (starts async write)
2. getPosition() → Get GPS coordinates
3. identifyPosition() → Match or reverse geocode
4. getWeather() → Fetch current conditions
5. currentTimestamp() → Format datetime
    ↓
Combine all data: `[timestamp at location; weather]`
    ↓
clipboardWriter.writeText() → Write to clipboard
    ↓
Show success toast with preview
```

### Save Location Flow
```
User enters label → Clicks "Save Current Location"
    ↓
saveLocation() method
    ↓
Get current GPS position
    ↓
Push to savedLocations array: {label, coords: {lat, lon}}
    ↓
localStorage.setItem('savedLocations', JSON.stringify(...))
    ↓
Update UI table
```

---

## Key Functions Reference

### `ClipboardWriter` Class
**Purpose:** Handle async clipboard writes with better control than `navigator.clipboard.writeText()`.

**Why it exists:** Standard clipboard API is too simplistic. This allows preparing clipboard write, then populating it after async operations complete.

```javascript
const writer = new ClipboardWriter()
// ... do async work ...
await writer.writeText("final text")  // or writer.cancel()
```

**Used in:** `index.html:109-130` (copyInfo method)

---

### `getAddress(lat, lon)`
**Returns:** Promise<string> - Address or coordinates

**Caching:**
- Cache key: lat/lon within 200m radius
- Stored in: `geocodeCache` object (module scope)

**API:** `https://nominatim.openstreetmap.org/reverse`

**Error handling:** Returns `"(lat, lon)"` on failure

**Usage note:** OSM Nominatim has rate limits. Cache prevents excessive requests.

---

### `getWeather(pos)`
**Returns:** Promise<string> - Weather description or "Weather unavailable"

**Caching:**
- TTL: 1 hour (3600000ms)
- Stored in: `weatherCache` object

**API:** `https://api.open-meteo.com/v1/forecast`

**Format:** `"Weather: 22°C, Clear sky, wind 12 km/h"`

**WMO Codes:** 99 weather conditions mapped (see `weatherCodeToString`)

---

### `identifyPosition(pos, savedLocations, updateStatus)`
**Returns:** Promise<string> - `"at [Location Label]"` or `"at [Address]"`

**Logic:**
1. Check all saved locations
2. If any within 100m → return saved label
3. Else → call `getAddress()` for reverse geocoding

**Proximity threshold:** 100 meters (line 198)

---

### `calculateDistance(lat1, lon1, lat2, lon2)`
**Returns:** number - Distance in meters

**Algorithm:** Haversine formula
- Accounts for Earth's curvature
- Accurate for distances < 1000km
- Earth radius: 6,371,000 meters

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

### Vue Component State

```javascript
data() {
  return {
    label: '',              // Input for new location label
    savedLocations: [],     // Loaded from localStorage
    darkMode: false,        // Loaded from localStorage
    status: 'Click...'      // Status message display
  }
}
```

**Reactive updates:** Changes to `savedLocations` automatically update the table view (Buefy `<b-table>`).

---

## External APIs

### 1. OpenStreetMap Nominatim
**Endpoint:** `https://nominatim.openstreetmap.org/reverse`

**Params:**
- `format=json`
- `lat={latitude}`
- `lon={longitude}`

**Response:**
```json
{
  "display_name": "123 Main St, Springfield, IL 62701, USA",
  ...
}
```

**Rate Limit:** ~1 req/sec (usage policy). Our 200m cache helps compliance.

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
const geocodeCache = {
  lat: null,
  lon: null,
  address: null
}
```
- **Invalidation:** New position > 200m from cached position
- **Reason for 200m:** Typical city block, prevents cache thrashing

**Weather Cache:**
```javascript
const weatherCache = {
  time: 0,      // timestamp in ms
  value: null   // weather string
}
```
- **TTL:** 1 hour (weather doesn't change rapidly)
- **Invalidation:** `Date.now() - weatherCache.time > 3600000`

### Potential Improvements
- Store caches in localStorage for persistence
- Add cache versioning
- Implement LRU for multiple geocode results

---

## Offline Support

### Service Worker Lifecycle

**Install Phase:**
```javascript
caches.open(CACHE_NAME)
  .then(cache => cache.addAll(PRECACHE_ASSETS))
```
Downloads all 30+ assets (app files + CDN resources).

**Activate Phase:**
- Deletes old caches (cache version changed)
- Takes control of all clients

**Fetch Phase:**
```javascript
// Cache-first strategy
caches.match(request)
  .then(cached => cached || fetch(request))
```

### What Works Offline
✅ App loads completely
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
5. App should still work (no network requests)

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

### Change Proximity Threshold
**File:** `index.js`

```javascript
async function identifyPosition(pos, savedLocations, updateStatus) {
  // ...
  for (const loc of savedLocations) {
    const d = calculateDistance(latitude, longitude, loc.coords.lat, loc.coords.lon)
    if (d <= 100) {  // ← Change this value (meters)
      locationString = `at ${loc.label}`
      matchFound = true
      break
    }
  }
}
```

---

### Customize Output Format
**File:** `index.html` (copyInfo method)

```javascript
// Current format:
const finalStr = `[${timestamp} ${await locationString}; ${await weatherInfo}]`

// Example alternatives:
const finalStr = `${timestamp} - ${await locationString} (${await weatherInfo})`
const finalStr = {
  timestamp,
  location: await locationString,
  weather: await weatherInfo
}  // For JSON output
```

---

### Add a New Saved Location Field
**Files:** `index.html`, localStorage schema

1. Update data structure:
```javascript
// Add to saveLocation() method
this.savedLocations.push({
  label: this.label.trim(),
  coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
  notes: this.notes,  // New field
  created: Date.now()  // New field
})
```

2. Update table display:
```html
<b-table-column field="notes" label="Notes" v-slot="props">
  {{ props.row.notes }}
</b-table-column>
```

3. Add input field for notes in template

---

### Update Cache Version (Force Refresh)
**File:** `service-worker.js`

```javascript
const CACHE_NAME = 'geo-timestamp-cache-v2';  // Increment version
```

**What happens:** On next visit, service worker activates and deletes old cache.

---

### Add a New CDN Resource
**Files:** `index.html`, `service-worker.js`

1. Add link/script tag to `index.html`
2. Download resource to local mirror directory
3. Add path to `PRECACHE_ASSETS` array in service worker

**Example:**
```javascript
// service-worker.js
const PRECACHE_ASSETS = [
  // ... existing assets ...
  './cdn.example.com/library.js'  // Add new resource
];
```

---

## Testing

### Manual Testing Checklist

**Core Functionality:**
- [ ] Copy timestamp creates correct format
- [ ] Saved location matches within 100m
- [ ] Address lookup works (not near saved location)
- [ ] Weather displays correctly
- [ ] Dark mode toggles and persists

**Location Management:**
- [ ] Save location with label
- [ ] Delete location
- [ ] Export to JSON
- [ ] Import from JSON
- [ ] Import invalid JSON shows error

**Edge Cases:**
- [ ] Geolocation denied (should show error)
- [ ] Network offline (should show cached/unavailable)
- [ ] Duplicate location labels (currently allowed)
- [ ] Empty label (should be rejected)

**Cross-Browser:**
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (especially iOS for clipboard API)

**PWA:**
- [ ] Install to home screen (mobile)
- [ ] Works offline after first load
- [ ] Updates when service worker changes

### Automated Testing

**Current state:** No automated tests

**Recommended approach:**
```javascript
// Vitest + Vue Test Utils
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'

describe('calculateDistance', () => {
  it('calculates distance between two points', () => {
    const d = calculateDistance(0, 0, 0, 1)
    expect(d).toBeCloseTo(111000, -3)  // ~111km per degree
  })
})
```

**What to test:**
- Pure functions (calculateDistance, weatherCodeToString, currentTimestamp)
- ClipboardWriter state machine
- Cache logic (mock Date.now)
- Component methods (saveLocation, removeLocation)

---

## File Structure Summary

```
chat-tools/
├── index.html              # Main app (192 lines)
│   └── Vue 3 SPA with inline template
├── index.js                # Utilities (211 lines)
│   ├── Future class
│   ├── ClipboardWriter class
│   └── 7 core functions
├── service-worker.js       # PWA offline (69 lines)
│   └── Cache-first strategy
├── manifest.json           # PWA metadata (15 lines)
├── icon-256.png            # App icon
├── README.md               # User documentation
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

**Total LOC:** ~500 lines of actual code (excluding CDN resources)

---

## Architecture Decisions

### Why No Build System?
**Pros:**
- Zero setup friction
- Works everywhere (just open HTML)
- Easy to understand (no webpack configs)
- Perfect for small projects

**Cons:**
- No TypeScript
- No JSX/SFC
- No tree-shaking
- CDN dependencies (larger initial load)

**When to migrate:** If project grows beyond ~1000 LOC or needs npm packages.

---

### Why Future Class?
Standard Promises can't be resolved externally. ClipboardWriter needs to:
1. Start clipboard write immediately (must be in user gesture)
2. Populate data after async operations complete

**Alternative considered:** Pre-compute all data before clipboard write
**Why rejected:** GPS can take 5+ seconds; user might cancel

---

### Why Cache in Memory vs localStorage?
**Current:** Caches stored in module-scope variables (cleared on page reload)

**Tradeoff:**
- ✅ Simpler code
- ✅ No serialization overhead
- ❌ Lost on page refresh
- ❌ Not shared across tabs

**To persist caches:**
```javascript
// Write to localStorage
localStorage.setItem('geocodeCache', JSON.stringify(geocodeCache))

// Read on page load
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

---

## Performance Considerations

### Bundle Size
**Total download (first visit):** ~500KB
- Vue 3: 140KB
- Buefy: 180KB
- Font Awesome: 80KB
- MDI: 70KB
- App code: ~10KB

**After service worker:** 0 bytes (all cached)

### Optimization Opportunities
1. **Lazy load icons:** Only include used glyphs
2. **Preconnect to APIs:** `<link rel="preconnect" href="https://nominatim.openstreetmap.org">`
3. **Compress cached resources:** Use gzip in service worker
4. **Background sync:** Queue failed API calls for retry

---

## Security Considerations

### Current Security Posture
✅ **No server-side code** - Can't be hacked
✅ **No user accounts** - No credential theft
✅ **HTTPS required** - Geolocation + Clipboard APIs need it
✅ **No eval()** - No code injection vectors
✅ **Public domain license** - No legal issues

### Potential Risks
⚠️ **Location privacy:** GPS coordinates stored in localStorage (readable by any script on same origin)
⚠️ **XSS via import:** Malicious JSON could inject HTML (mitigated: JSON.parse validates)
⚠️ **API abuse:** User could spam OSM/Open-Meteo (mitigated: caching)

### Hardening Recommendations
```html
<!-- Add CSP header -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com;
               connect-src 'self' nominatim.openstreetmap.org api.open-meteo.com">
```

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

### View All Console Logs
```javascript
// index.html - Already present at line 112
console.log("current position:", pos)
```

### Inspect localStorage
```javascript
// Browser console
JSON.parse(localStorage.getItem('savedLocations'))
```

### Clear All Data
```javascript
// Browser console
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
```

---

## Contributing Workflow

1. **Fork repository**
2. **Create feature branch:** `git checkout -b feature/your-feature`
3. **Make changes** (test in multiple browsers)
4. **Test offline mode** (service worker + airplane mode)
5. **Update docs** (this file + README if user-facing)
6. **Commit:** Clear message explaining "why" not just "what"
7. **Push and create PR**

**Code style:**
- 2-space indentation
- No semicolons (current style)
- Async/await over .then() chains
- Descriptive variable names

---

## Troubleshooting

### "Clipboard write failed"
**Cause:** Must be triggered by user gesture (click)
**Fix:** Ensure copyInfo() only called from button click

### "Service worker not updating"
**Cause:** Browser caching old service worker
**Fix:**
1. DevTools → Application → Service Workers → "Update on reload"
2. Or increment `CACHE_NAME` version

### "Address shows as (lat, lon)"
**Cause:** OSM Nominatim request failed or offline
**Fix:** Check network tab, verify not rate-limited

### "Location not matching saved location"
**Cause:** GPS accuracy > 100m
**Fix:** Increase threshold in identifyPosition(), or save location while at exact spot

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
// Get current position
const pos = await getPosition(updateStatusCallback)

// Reverse geocode
const address = await getAddress(lat, lon)

// Get weather
const weather = await getWeather(pos)

// Format timestamp
const timestamp = currentTimestamp()

// Calculate distance
const meters = calculateDistance(lat1, lon1, lat2, lon2)

// Match location or geocode
const locationStr = await identifyPosition(pos, savedLocations, updateStatus)

// Write to clipboard (must be in user gesture)
const writer = new ClipboardWriter()
await writer.writeText("text to copy")
```

---

**Last Updated:** 2025-12-27
**Contributors:** Glushiator, Claude Sonnet 4.5
