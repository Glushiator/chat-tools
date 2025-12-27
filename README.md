# AI Geo-Timestamp

**A privacy-first, mobile-friendly web app for quick, accurate timestamp + location snippets—perfect for journaling, AI chat context, or personal recordkeeping.**

---

## Features

- **One-tap Timestamp & Location:**  
  Instantly copies a friendly, timestamped string with your current street address or a named saved location to the clipboard.
  
- **Address Lookup:**  
  Uses OpenStreetMap for fast, free reverse geocoding—no API keys needed.

- **Smart Saved Locations:**  
  Save common places (e.g., Home, Office). When you’re nearby (±100m), the app uses your label instead of an address for privacy and clarity.

- **Dark Mode:**  
  Sleek toggle for day or night use. Preference is remembered.

- **Export / Import Locations:**
  Backup or transfer your saved locations as a simple JSON file—easy, secure, no cloud required.

- **Current Weather:**
  Adds local conditions from Open-Meteo to the copied timestamp.

- **Offline Capable:**
  Once loaded, the app installs a service worker so it continues to work without
  an internet connection (address and weather will fall back to placeholders).

- **Built with Vue 3 + Buefy:**
  Lightweight UI powered entirely by CDN resources.

- **Privacy-respecting:**  
  All data stays local to your device. Only the address and weather lookups use the internet, and that’s via free, public APIs.

---

## How To Use

1. **Open `index.html` in your browser** (mobile or desktop).
2. **Press "Copy Timestamp & Location":**
   - If near a saved place, you'll get e.g., `[Fri, Jul 4, 2025, 3:32 PM at Home; Weather: 22°C, Clear sky, wind 12 km/h]`
   - Otherwise, you'll get `[Fri, Jul 4, 2025, 3:32 PM at 123 Main St, Springfield...; Weather: 22°C, Clear sky, wind 12 km/h]`
   - The result is instantly copied to your clipboard—paste anywhere!
3. **Manage Saved Locations:**  
   - Add a label (e.g., “Home”), hit “Save Current Location” to store.
   - Export/Import lets you move your list between devices.
4. **Toggle Dark Mode:**  
   - Use the top-right switch to match your preference.

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
- **Caching**: 200m radius for geocoding, 1-hour TTL for weather data
- **Location Matching**: 100m proximity threshold for saved locations
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

  A: If you’re within ~100 meters of a saved location, the app will use your label for privacy.

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
- Improve error handling and user feedback
- Add unit tests
- Enhance accessibility (ARIA labels, keyboard navigation)
- Add i18n/localization support
- Add ability to edit saved location labels
- Add option to customize timestamp format

---

## License

This project is released into the public domain under the [Unlicense](LICENSE). Use it however you want!
