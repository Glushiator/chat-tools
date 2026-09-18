# AI Geo-Timestamp

**A privacy-first, mobile-friendly web app for quick, accurate timestamp + location snippets—perfect for journaling, AI chat context, or personal recordkeeping.**

---

## Features

- **One-tap Timestamp & Location:**  
  Instantly copies a friendly, timestamped string with your current street address or a named saved location to the clipboard.

- **Walk Mode:**
  A second button for when you're on the move. It always looks up the real street
  address (never a saved label), refreshes it every 10 metres instead of every
  200, asks for a high-accuracy fix, and appends the exact coordinates.
  
- **Address Lookup:**  
  Uses OpenStreetMap for fast, free reverse geocoding—no API keys needed.

- **Smart Saved Locations:**  
  Save common places (e.g., Home, Office). When you’re nearby (±100m), the app uses your label instead of an address for privacy and clarity.

- **Dark Mode:**  
  Sleek toggle in Settings for day or night use. Preference is remembered.

- **Clear, Single Status Line:**
  One status area above the tabs reports everything - locating, copying, saving,
  importing, updating - so there is only ever one place to look.

- **Export / Import Locations:**
  Backup or transfer your saved locations as a simple JSON file—easy, secure, no
  cloud required. Importing *merges* into your list rather than replacing it, so
  nothing is lost by accident.

- **Current Weather:**
  Adds local conditions from Open-Meteo to the copied timestamp.

- **Offline Capable:**
  Once loaded, the app installs a service worker so it continues to work without
  an internet connection (address and weather will fall back to placeholders).
  Icons keep working too, even on a flaky connection.

- **Built with Vue 3 + Buefy:**
  Lightweight UI powered entirely by CDN resources.

- **Privacy-respecting:**  
  All data stays local to your device. Only the address and weather lookups use the internet, and that’s via free, public APIs.

---

## How To Use

**[Open the app](https://glushiator.github.io/chat-tools/)** on mobile or desktop.
There are three tabs — **Copy**, **Locations** and **Settings** — with a status
line above them that tells you what's happening.

1. **Copy tab — "Copy Timestamp & Location"** (the everyday button):
   - If near a saved place, you'll get e.g., `[Fri, Jul 4, 2025, 3:32 PM at Home; Weather: 22°C, Clear sky, wind 12 km/h]`
   - Otherwise, you'll get `[Fri, Jul 4, 2025, 3:32 PM at 123 Main St, Springfield...; Weather: 22°C, Clear sky, wind 12 km/h]`
   - The result is instantly copied to your clipboard—paste anywhere!
2. **Copy tab — "Copy Walk Position (10 m)"** (for when you're walking):
   - Always resolves the street address and adds the exact coordinates:
     `[Fri, Jul 4, 2025, 3:32 PM at 123 Main St, Springfield... (39.799400, -89.644200); Weather: 22°C, Clear sky, wind 12 km/h]`
   - Saved labels are deliberately ignored here — use the first button when you
     want "at Home" instead.
3. **Locations tab:**
   - Add a label (e.g., “Home”), hit “Save Current Location” to store.
   - Export/Import lets you move your list between devices.
4. **Settings tab:**
   - Toggle dark mode, check for app updates, and see the installed version.

---

## Installation

Works best on modern browsers with geolocation and clipboard access.

No build steps. Vue 3 and Buefy are loaded via CDN.

This site now includes a web manifest so you can "Add to Home Screen" on most
mobile browsers and run it like a standalone app.

After the first visit, a service worker caches the app so it continues to work
offline (address and weather lookups will simply show as unavailable).

[No install needed, just open here.](https://glushiator.github.io/chat-tools/)

---

## Technical Details

### Architecture
- **Frontend**: Vue 3 with Buefy component library
- **Geocoding**: OpenStreetMap Nominatim API (free, no API key required)
- **Weather**: Open-Meteo API (free, no API key required)
- **Storage**: Browser localStorage for saved locations and preferences
- **Offline Support**: Service Worker with precached resources
- **Clipboard**: Advanced clipboard API with promise-based writing

### Key Features Implementation
- **Distance Calculation**: Haversine formula for accurate geo-distance
- **Caching**: address reused within 200 m (10 m in walk mode); weather reused
  for 1 hour *and* within 5 km. Failed lookups are never cached, so retrying
  immediately actually retries.
- **Location Matching**: 100m proximity threshold for saved locations
- **Polite API use**: geocoding requests are queued at 1 per second, per
  OpenStreetMap's usage policy
- **Progressive Web App**: Installable via manifest.json

### File Structure
- `index.html` - Main application UI
- `index.js` - Core utilities (geolocation, weather, clipboard)
- `service-worker.js` - Offline caching and PWA functionality
- `manifest.json` - PWA configuration
- Local CDN mirrors for offline operation

---

## FAQ

* Q: Does this send my location to anyone?

  A: No. Only the address and weather lookups briefly query public APIs (OpenStreetMap and Open-Meteo). Saved locations and all other data stay 100% local.

* Q: Can I share or backup my saved places?

  A: Yes! Use the “Export” button to save as JSON. “Import” to load on another device or after a reset.

* Q: How accurate are saved location matches?

  A: If you’re within ~100 meters of a saved location, the app will use your
  label for privacy. The walk button skips saved locations entirely and always
  gives you the street address plus coordinates.

* Q: Why are there two copy buttons?

  A: They want opposite things. Standing still, a saved label and a wide cache
  are ideal — private, stable, and light on the free APIs. Walking, both get in
  the way: "at Home" erases where you actually went, and a 200 m cache repeats
  an address you left two blocks ago.

* Q: Who built this?

  A: Glushiator (with a little help and affection from Gemini, Monday and Claudette, his AI companions).

---

## Contributing

This project is open source (Unlicense) and contributions are welcome!

To contribute:
1. Fork the repository
2. Make your changes
3. Test thoroughly (especially on mobile devices)
4. Submit a pull request

Areas that could use improvement:
- Add more weather code mappings (see `weatherCodeToString` in `index.js`)
- Persist the geocode/weather caches so a reload mid-walk doesn't discard them
- Add unit tests (see the `vm`-based harness in `DEVELOPER_GUIDE.md`)
- Enhance accessibility (ARIA labels, keyboard navigation)
- Add i18n/localization support
- Add ability to edit saved location labels
- Add option to customize timestamp format

---

## License

This project is released into the public domain under the [Unlicense](LICENSE). Use it however you want!
