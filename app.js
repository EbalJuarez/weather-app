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
