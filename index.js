class Future extends Promise {
  constructor(executor) {
    let resolveRef, rejectRef;

    // Call parent Promise constructor
    super((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;

      // If executor provided, run it like normal Promise
      if (executor && typeof executor === 'function') {
        try {
          executor(resolve, reject);
        } catch (error) {
          reject(error);
        }
      }
    });

    // Expose resolve/reject methods externally
    this.resolve = resolveRef;
    this.reject = rejectRef;
  }

  // Static factory method for simple cases
  static create() {
    return new Future();
  }
}


// Chrome/Safari accept a Promise inside ClipboardItem, which lets us claim the
// clipboard synchronously with the user gesture and supply the text later.
// Where that is missing we fall back to writeText() at the end.
function supportsDeferredClipboard() {
  return typeof ClipboardItem !== 'undefined'
    && !!(navigator.clipboard && navigator.clipboard.write)
}


class ClipboardWriter {
  constructor() {
    this.completed = false
    this.deferred = false
    if (!supportsDeferredClipboard()) return

    const input = Future.create()
    const result = Future.create()
    // Cancelling rejects both; keep no-op handlers attached so a normal
    // cancellation never surfaces as an unhandled rejection.
    input.catch(() => {})
    result.catch(() => {})
    try {
      const data = [new ClipboardItem({ "text/plain": input })];
      navigator.clipboard
        .write(data)
        .then(() => result.resolve(true))
        .catch((err) => result.reject(new Error(err && err.message || String(err))))
      this.clipboardInput = input
      this.clipboardResult = result
      this.deferred = true
    } catch (e) {
      console.error("Deferred clipboard unavailable, falling back:", e)
      input.resolve(null)
      result.resolve(false)
    }
  }

  async cancel() {
    // Idempotent: callers cancel on every error path, including after a
    // successful write in a shared catch-all.
    if (this.completed) return
    this.completed = true
    if (!this.deferred) return
    this.clipboardInput.reject(new Error("Clipboard write canceled."));
    try {
      await this.clipboardResult
    }
    catch {
      return
    }
  }

  async writeText(text) {
    if (this.completed)
      throw new Error("Write operation already completed.")
    this.completed = true
    if (!this.deferred) {
      if (!navigator.clipboard)
        throw new Error("Clipboard API unavailable (requires a secure context).")
      return navigator.clipboard.writeText(text)
    }
    this.clipboardInput.resolve(new Blob([text], { type: "text/plain" }))
    return this.clipboardResult;
  }
}


function weatherCodeToString(code) {
  // Simplified mapping; expand as needed
  const mapping = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Slight or moderate thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
  };
  return mapping[code] || `WTHR(${code})`;
}


// Reuse a geocoded address while we are still within this many metres of the
// position it was looked up for.
const GEOCODE_CACHE_RADIUS = 200   // standing still / travelling by vehicle
const WALK_CACHE_RADIUS = 10       // walking: re-geocode almost every step
const SAVED_LOCATION_RADIUS = 100  // distance at which a saved label wins
const WEATHER_CACHE_MAX_AGE = 3600_000
const WEATHER_CACHE_RADIUS = 5000  // weather does not change block to block

// Both caches also record where the value came from, so moving invalidates
// them, and neither is written on a failure - a transient network error must
// not pin a fallback string in place for the next hour / 200 metres.
const weatherCache = { time: 0, lat: null, lon: null, value: null }
const geocodeCache = { lat: null, lon: null, address: null }


function formatCoords(lat, lon) {
  // 6 decimals is ~0.1 m, fine enough for walking.
  return `(${lat.toFixed(6)}, ${lon.toFixed(6)})`
}


function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}


// Nominatim's usage policy caps us at one request per second. Browsers will not
// let us set a User-Agent, so honouring the rate limit is the one thing we can
// actually do to stay welcome.
const NOMINATIM_MIN_INTERVAL = 1000
let nominatimQueue = Promise.resolve()
let nominatimLastCall = 0

function throttleNominatim(task) {
  const run = nominatimQueue.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL - (Date.now() - nominatimLastCall)
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    nominatimLastCall = Date.now()
    return task()
  })
  nominatimQueue = run.then(() => {}, () => {})
  return run
}


async function getAddress(lat, lon, radius = GEOCODE_CACHE_RADIUS) {
  const coords = formatCoords(lat, lon)
  if (geocodeCache.address && calculateDistance(lat, lon, geocodeCache.lat, geocodeCache.lon) < radius)
    return geocodeCache.address
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=0&lat=${lat}&lon=${lon}`
    const data = await throttleNominatim(() => fetchWithTimeout(url, 10_000).then(res => res.json()))
    if (!data.display_name) {
      console.error("Geo-Reversing: address not found.")
      return coords
    }
    geocodeCache.lat = lat
    geocodeCache.lon = lon
    geocodeCache.address = data.display_name
    return data.display_name
  } catch (e) {
    console.error("Geo-Reversing failure:", e)
    return coords
  }
}


function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const toRad = x => x * Math.PI / 180
  const dPhi = toRad(lat2 - lat1)
  const dLam = toRad(lon2 - lon1)
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLam / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}


// getCurrentPosition defaults to timeout: Infinity, which leaves the UI (and a
// pending clipboard write) hanging forever when no fix arrives.
const POSITION_OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
const PRECISE_POSITION_OPTIONS = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }


function getPosition(options = POSITION_OPTIONS) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      error => reject(new Error(`Geolocation failed: ${error.message}`)),
      options
    )
  })
}


async function getWeather(pos) {
  const { latitude, longitude } = pos.coords
  const now = Date.now()
  if (weatherCache.value
      && now - weatherCache.time < WEATHER_CACHE_MAX_AGE
      && calculateDistance(latitude, longitude, weatherCache.lat, weatherCache.lon) < WEATHER_CACHE_RADIUS)
    return weatherCache.value
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    const data = await fetchWithTimeout(url, 10_000).then(res => res.json())
    if (!data.current_weather) return "Weather unavailable"
    const w = data.current_weather
    // Weather codes: https://open-meteo.com/en/docs#api-formats
    const result = `Weather: ${w.temperature}°C, ${weatherCodeToString(w.weathercode)}, wind ${w.windspeed} km/h`
    weatherCache.time = now
    weatherCache.lat = latitude
    weatherCache.lon = longitude
    weatherCache.value = result
    return result
  } catch (err) {
    console.error("Weather failed", err)
    return "Weather unavailable"
  }
}


function currentTimestamp() {
  return new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}


async function identifyPosition(pos, savedLocations, updateStatus, options = {}) {
  const { radius = GEOCODE_CACHE_RADIUS, useSavedLocations = true } = options
  const { latitude, longitude } = pos.coords
  // Walk mode opts out of saved labels: it always wants the street-level
  // address, and the plain button is there when a saved label is preferred.
  if (useSavedLocations) {
    for (const loc of savedLocations) {
      const d = calculateDistance(latitude, longitude, loc.coords.lat, loc.coords.lon)
      if (d <= SAVED_LOCATION_RADIUS)
        return `at ${loc.label}`
    }
  }
  if (updateStatus) updateStatus('Reverse geocoding address...')
  return `at ${await getAddress(latitude, longitude, radius)}`
}


// Single definition of what a stored location looks like, shared by load and
// import so both reject the same garbage.
function normalizeLocation(loc) {
  if (!loc || typeof loc !== 'object') return null
  const label = typeof loc.label === 'string' ? loc.label.trim() : ''
  const lat = loc.coords ? loc.coords.lat : undefined
  const lon = loc.coords ? loc.coords.lon : undefined
  if (!label) return null
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) return null
  if (typeof lon !== 'number' || !Number.isFinite(lon) || Math.abs(lon) > 180) return null
  return { label, coords: { lat, lon } }
}
