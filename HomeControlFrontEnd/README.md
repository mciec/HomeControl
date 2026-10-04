# HomeControlFrontEnd

The web client of [HomeControl](../README.md): React 19, TypeScript 5.9, Vite 7, Redux Toolkit, Axios, SignalR, with Bootstrap 5 / react-bootstrap as the component base under a custom dark theme. The mobile app ([HomeControlMobile](../HomeControlMobile/README.md)) mirrors it screen for screen - keep the two in sync.

## Run

```bash
npm ci
npm run dev        # http://localhost:3000 (from the repo root, ../run-dev.sh also starts the backend)
npm run build      # tsc -b && vite build -> dist/ (the Dockerfile copies this into the backend's wwwroot)
npm run lint
```

The dev server proxies `/api`, `/signin-google` and `/hubs` (WebSocket) to the backend on `https://localhost:7000` (`vite.config.ts`), so the browser only ever talks to port 3000. Sign-in itself completes on the backend (`https://localhost:7000/signin-google`) and returns to `http://localhost:3000`.

## Structure

```
src/
├── App.tsx                      # shell: navbar, offcanvas menu, auth gate, view switch (no router)
├── pages/                       # WelcomePage (landing/sign-in), AuthenticatedPage (home), DevicesPage (list + detail + SignalR)
├── components/
│   ├── Background.tsx           # animated backdrop (CSS only, honours prefers-reduced-motion)
│   ├── icons/Icons.tsx          # hand-drawn SVG icon set + logo mark (no icon dependency)
│   └── devices/                 # DeviceListItem, LedStripeWithSensorsDetail, OverrideControl, AnimationProgressBar
├── services/                    # api.ts (Axios, cookie auth), devicesApi.ts (types + calls), deviceHub.ts (SignalR)
└── store/                       # authSlice, devicesSlice, store
```

## Design

Tokens are CSS variables in `src/index.css` (`--hc-*`, fed into Bootstrap's own `--bs-*`); component styling is in `src/App.css`. Dark theme via `data-bs-theme="dark"` on `<html>`, frosted-glass cards, cyan -> indigo -> violet accent, the same icon set as the mobile app. The favicon is `public/favicon.svg`.

## Time handling (important)

Animations carry absolute `startedAtUtc` / `endsAtUtc`, stamped by the **backend's** clock. Never compare them with `Date.now()` directly: every state the server sends includes `serverTimeUtc`, and `devicesSlice` stores `serverClockOffsetMs = serverTimeUtc - Date.now()`; code that counts down uses `Date.now() + serverClockOffsetMs` (`AnimationProgressBar`, the local-expiry fallback in `DevicesPage`). A skewed browser clock therefore cannot shift the progress bar.

## Behaviour notes

- **Live updates:** `DevicesPage` keeps one SignalR connection for the page's lifetime with indefinite back-off reconnect, and re-fetches the detail after a reconnect to resync.
- **Override button -> progress bar:** shows while the device reports an animation in that direction; a `Stopped` push or the local expiry fallback restores the button.
- No `any`; keep strict types. Do not add npm packages without a reason.
