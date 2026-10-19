# AGENTS.md

## Project status

- Weather App for the Programación Web course (UMES). Early stage: only `.gitignore` and this file are committed.

## Stack

- Plain HTML, CSS and JavaScript. No framework, no build step, no npm dependencies.
- Reason: small app, easy to explain line by line, nothing to install.
- Do not introduce a framework or dependency without asking first.

## How to run

- Open `index.html` in the browser, or serve the folder with `python -m http.server 8000` and visit http://localhost:8000.

## API

- Open-Meteo, free, no API key.
- Geocoding: `https://geocoding-api.open-meteo.com` (city name -> coordinates).
- Forecast: `https://api.open-meteo.com` (current weather + daily forecast from coordinates).
- Confirm every request parameter against https://open-meteo.com/en/docs before writing code.

## Requirements (minimum)

1. City search that resolves coordinates.
2. Current weather: temperature, feels-like, sky condition, wind speed, humidity.
3. Forecast of at least 3 days with max/min temperature.
4. Visible loading state.
5. Visible, understandable error state (unknown city, no connection).
6. Usable on a phone screen.

## Code conventions

- Use `fetch` with `async/await`; wrap every request in `try/catch`.
- Check `response.ok` and handle empty geocoding results explicitly.
- Keep API calls, DOM rendering and event handling in separate functions.
- Never hardcode credentials. Secrets go in `.env` (gitignored).
- Small, focused commits; review `git diff` before each one.

## Agent guidance

- Work in small steps: structure and API first, then UI, then forecast, then loading/error states.
- Do not create new files without showing the proposed structure first.
- Update this file whenever an architecture decision is made.