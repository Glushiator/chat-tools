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


class ClipboardWriter {
  constructor() {
    this.completed = false;
    this.clipboardInput = Future.create()
    this.clipboardResult = Future.create()
    const data = [new ClipboardItem({ "text/plain": this.clipboardInput })];
    navigator.clipboard
      .write(data)
      .then(() => this.clipboardResult.resolve(true))
      .catch((err) => this.clipboardResult.reject(err.message))
  }

  async cancel() {
    if (this.completed)
      throw new Error("Write operation already completed.")
    this.completed = true
    this.clipboardInput.reject("Clipboard write canceled.");
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
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    99: "Thunderstorm with hail"
  };
  return mapping[code] || `WTHR(${code})`;
}

const weatherCache = { time: 0, value: null }
const geocodeCache = { lat: null, lon: null, address: null }


async function getAddress(lat, lon) {
  const coords = `(${lat}, ${lon})`
  if (geocodeCache.address && calculateDistance(lat, lon, geocodeCache.lat, geocodeCache.lon) < 200)
    return geocodeCache.address
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    const data = await res.json()
    const addr = data.display_name || coords
    if (!data.display_name) console.error("Geo-Reversing: address not found.")
    geocodeCache.lat = lat
    geocodeCache.lon = lon
    geocodeCache.address = addr
    return addr
  } catch (e) {
    console.error("Geo-Reversing failure:", e)
    geocodeCache.lat = lat
    geocodeCache.lon = lon
    geocodeCache.address = coords
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


async function getPosition(updateStatus) {
  updateStatus('Getting location...');
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(async pos => {
      resolve(pos)
    }, () => {
      updateStatus('Error: Could not get location.')
      resolve({ coords: { lotitude: 0, longitude: 0 } })
    })
  })
}


async function getWather(pos) {
  const now = Date.now()
  if (weatherCache.value && now - weatherCache.time < 3600_000)
    return weatherCache.value
  const { latitude, longitude } = pos.coords
  return new Promise((resolve) => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
      .then(res => res.json())
      .then(data => {
        let result
        if (!data.current_weather) {
          result = "Weather unavailable"
        } else {
          const w = data.current_weather
          // Weather codes: https://open-meteo.com/en/docs#api-formats
          result = `Weather: ${w.temperature}°C, ${weatherCodeToString(w.weathercode)}, wind ${w.windspeed} km/h`
        }
        weatherCache.time = now
        weatherCache.value = result
        resolve(result)
      })
      .catch(err => {
        console.error("Weather failed", err)
        weatherCache.time = now
        weatherCache.value = "Weather unavailable"
        resolve("Weather unavailable")
      })
  })
}


function currenTimestamp() {
  return new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}


async function identifyPosition(pos, savedLocations, updateStatus) {
  const { latitude, longitude } = pos.coords
  let locationString = ''
  let matchFound = false
  for (const loc of savedLocations) {
    const d = calculateDistance(latitude, longitude, loc.coords.lat, loc.coords.lon)
    if (d <= 100) {
      locationString = `at ${loc.label}`
      matchFound = true
      break
    }
  }
  if (!matchFound) {
    updateStatus('No saved match. Looking up address...')
    const addr = await getAddress(latitude, longitude)
    locationString = `at ${addr}`
  }
  return locationString
}
