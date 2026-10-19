const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;

class CityNotFoundError extends Error {
  constructor() {
    super('Ciudad no encontrada');
    this.name = 'CityNotFoundError';
  }
}

class HttpError extends Error {
  constructor(status) {
    super(`Error del servidor (HTTP ${status})`);
    this.name = 'HttpError';
    this.status = status;
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Tiempo de espera agotado');
    this.name = 'TimeoutError';
  }
}

class NetworkError extends Error {
  constructor() {
    super('Sin conexión');
    this.name = 'NetworkError';
  }
}

let activeController = null;

function createController() {
  if (activeController) {
    activeController.abort();
  }
  const controller = new AbortController();
  controller.timedOut = false;
  const timeoutId = setTimeout(() => {
    controller.timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  activeController = controller;
  return {
    controller,
    cleanup() {
      clearTimeout(timeoutId);
      if (activeController === controller) {
        activeController = null;
      }
    },
  };
}

function abortActiveRequest() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

async function geocodeCity(name) {
  const { controller, cleanup } = createController();
  try {
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=1&language=es&format=json`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new CityNotFoundError();
    }
    const r = data.results[0];
    return {
      latitude: r.latitude,
      longitude: r.longitude,
      name: r.name,
      admin1: r.admin1,
      country: r.country,
    };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      if (controller.timedOut) throw new TimeoutError();
      throw err;
    }
    if (
      err instanceof CityNotFoundError ||
      err instanceof HttpError ||
      err instanceof TimeoutError
    ) {
      throw err;
    }
    throw new NetworkError();
  } finally {
    cleanup();
  }
}

async function fetchWeather(lat, lon) {
  const { controller, cleanup } = createController();
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      forecast_days: '3',
      timezone: 'auto',
    });
    const response = await fetch(`${FORECAST_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    return await response.json();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      if (controller.timedOut) throw new TimeoutError();
      throw err;
    }
    if (err instanceof HttpError || err instanceof TimeoutError) {
      throw err;
    }
    throw new NetworkError();
  } finally {
    cleanup();
  }
}

const WEATHER_CODES = {
  0: 'Despejado',
  1: 'Principalmente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  56: 'Llovizna helada ligera',
  57: 'Llovizna helada densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada ligera',
  67: 'Lluvia helada fuerte',
  71: 'Nieve ligera',
  73: 'Nieve moderada',
  75: 'Nieve fuerte',
  77: 'Granizo',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos fuertes',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve fuertes',
  95: 'Tormenta',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo fuerte',
};

function weatherDescription(code) {
  return WEATHER_CODES[code] || 'Condición desconocida';
}

function $(id) {
  return document.getElementById(id);
}

function renderCurrent(weather, location) {
  const parts = [location.name, location.admin1, location.country].filter(Boolean);
  $('location').textContent = parts.join(', ');
  $('temperature').textContent = `${weather.current.temperature_2m} °C`;
  $('feels-like').textContent = `Sensación térmica: ${weather.current.apparent_temperature} °C`;
  $('condition').textContent = weatherDescription(weather.current.weather_code);
  $('wind').textContent = `Viento: ${weather.current.wind_speed_10m} km/h`;
  $('humidity').textContent = `Humedad: ${weather.current.relative_humidity_2m} %`;
}

function renderForecast(daily) {
  const list = $('forecast-list');
  list.innerHTML = '';
  const days = daily.time;
  for (let i = 0; i < Math.min(3, days.length); i++) {
    const card = document.createElement('div');
    card.className = 'forecast-card';
    const date = new Date(days[i] + 'T00:00:00');
    const dayLabel = date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    card.innerHTML = `
      <div class="day">${dayLabel}</div>
      <div class="range">${daily.temperature_2m_max[i]}° / ${daily.temperature_2m_min[i]}°</div>
      <div class="cond">${weatherDescription(daily.weather_code[i])}</div>
    `;
    list.appendChild(card);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const city = $('city-input').value.trim();
  if (!city) return;
  abortActiveRequest();
  try {
    const location = await geocodeCity(city);
    const weather = await fetchWeather(location.latitude, location.longitude);
    renderCurrent(weather, location);
    renderForecast(weather.daily);
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      console.error(err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = $('search-form');
  if (form) {
    form.addEventListener('submit', handleSearch);
  }
});