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

- **Built with Vue 3 + Buefy:**
  Lightweight UI powered entirely by CDN resources.

- **Privacy-respecting:**  
  All data stays local to your device. Only the address and weather lookups use the internet, and that’s via free, public APIs.

---

## How To Use

1. **Open `index.html` in your browser** (mobile or desktop).
2. **Press “Copy Timestamp & Location”:**
   - If near a saved place, you’ll get e.g., `[Fri, Jul 4, 2025, 3:32 PM at Home; Weather: 22°C, Clear sky]`
   - Otherwise, you’ll get `[Fri, Jul 4, 2025, 3:32 PM at 123 Main St, Springfield...; Weather: 22°C, Clear sky]`
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

[No install needed, just open here.](https://glushiator.github.io/chat-tools/)

## FAQ

* Q: Does this send my location to anyone?

  A: No. Only the address and weather lookups briefly query public APIs (OpenStreetMap and Open-Meteo). Saved locations and all other data stay 100% local.

* Q: Can I share or backup my saved places?

  A: Yes! Use the “Export” button to save as JSON. “Import” to load on another device or after a reset.

* Q: How accurate are saved location matches?

  A: If you’re within ~100 meters of a saved location, the app will use your label for privacy.

* Q: Who built this?

  A: Glushiator (with a little help and affection from Gemini, Monday and Claudette, his AI companions).
