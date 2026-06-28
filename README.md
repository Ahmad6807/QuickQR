# QuickQR Generator

A fast, private, single-page QR code generator that runs entirely in your browser. No server, no data transmission, no dependencies beyond a single CDN script.

![QuickQR interface showing the scanner frame and form](https://img.shields.io/badge/Pure%20Frontend-HTML%20%7C%20CSS%20%7C%20JS-15803d?style=flat-square) ![No server](https://img.shields.io/badge/Privacy-Zero%20data%20sent-15803d?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## Features

| Feature | Detail |
|---|---|
| **Input** | Plain text or any URL, up to **10,000 characters** |
| **Live generation** | QR updates automatically 480 ms after you stop typing |
| **Instant paste** | Paste a URL and the QR generates immediately |
| **Error correction** | Four levels: Low / Medium / High / Max |
| **Output size** | 200 px · 300 px · 400 px · 512 px |
| **Custom colors** | Native color pickers for foreground and background |
| **Download** | Saves as `quickqr-{timestamp}.png` |
| **iOS Safari** | Opens QR in a new tab for long-press save |
| **Keyboard shortcut** | `Ctrl + Enter` (or `Cmd + Enter`) to generate immediately |
| **Privacy** | Everything happens locally — zero network requests for your data |
| **Accessibility** | Keyboard navigable, ARIA labels, `prefers-reduced-motion` respected |

---

## Getting Started

This is a pure static project — no build step, no package manager, no server required.

### Option 1 — Open directly (simplest)

```
double-click index.html
```

The page opens in your default browser. The QR library loads from CDN on first visit and is cached for offline use thereafter.

### Option 2 — Serve locally (recommended for development)

Any static server works. If you have Node.js:

```bash
npx serve .
```

Or with Python:

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

Then open `http://localhost:8080` in your browser.

---

## Project Structure

```
quickqr/
├── index.html   # Application shell and markup
├── style.css    # Design system, layout, animations
├── app.js       # All interactivity and QR generation logic
└── README.md    # This file
```

### No build output, no `node_modules`, no config files.

---

## How It Works

```
User types / pastes input
        │
        ▼ (480ms debounce or Ctrl+Enter)
Validate input (empty check)
        │
        ├─ Empty → show inline error, stop
        │
        ▼
Trigger scanner animation (CSS class swap)
        │ (animationend fires after ~0.65s)
        ▼
qrcode.js renders QR into a hidden <div>
        │
        ▼
Copy pixel data onto <canvas> with drawImage()
        │
        ▼
Show canvas, enable Download button
        │
        ▼ (on click)
canvas.toDataURL('image/png')
        │
        ├─ Desktop / Android → <a download> triggers browser save
        └─ iOS Safari        → new tab with img + long-press prompt
```

---

## Dependencies

| Library | Version | Source | Purpose |
|---|---|---|---|
| `qrcodejs` | 1.0.0 | jsDelivr CDN | QR code rendering to canvas |
| Google Fonts | — | fonts.googleapis.com | DM Sans · Inter · JetBrains Mono |

All other logic is vanilla HTML5, CSS3, and JavaScript — no frameworks.

> **Offline note:** On first load, the QR library and fonts are fetched from CDN and cached by the browser. Subsequent visits work without an internet connection.

---

## Browser Compatibility

| Browser | Version | Notes |
|---|---|---|
| Chrome / Edge | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari (macOS) | 14+ | Full support |
| Safari (iOS) | 14+ | Download opens new tab (long-press to save) |
| Android Chrome | 90+ | Full support |
| Samsung Internet | 14+ | Full support |

### Known platform differences

- **iOS Safari:** The `download` attribute on `<a href="data:...">` links is silently ignored. QuickQR detects this and opens your QR code in a new tab with a "tap and hold → Save Image" instruction.
- **`aspect-ratio` CSS:** Older Safari (pre-15) does not support `aspect-ratio`. A `height: 300px` fallback is provided via `@supports`.
- **`prefers-reduced-motion`:** All animations (scanner beam, placeholder pulse, entrance fade) are suppressed when the user has enabled reduced motion in their OS settings.

---

## Customisation

All design tokens live at the top of [`style.css`](style.css) inside `:root { ... }`. Change them to retheme the entire app:

```css
:root {
  --forest:        #15803d;   /* primary button and accent color */
  --scanner-red:   #dc2626;   /* scanner beam color */
  --paper:         #f8f7f5;   /* page background */
  --ink:           #1c1917;   /* primary text */
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body:    'Inter',    system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
}
```

To change the character limit, edit the single constant in [`app.js`](app.js):

```js
const MAX_CHARS = 10000;
```

---

## Security & Privacy

- **No data leaves your device.** Your text is processed entirely inside your browser's JavaScript engine.
- **No analytics, no tracking, no cookies.**
- **No server-side code.** There is no backend. The app has no login, no database, and no API.
- The only external network requests are for the QR library and fonts — both from reputable CDNs (jsDelivr and Google Fonts). These requests carry no user data.

---

## License

MIT — free to use, modify, and distribute.

---

## Acknowledgements

- [qrcodejs](https://github.com/davidshimjs/qrcodejs) by davidshimjs — QR code generation
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) — display typeface
- [Inter](https://rsms.me/inter/) — body typeface
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — monospace typeface
