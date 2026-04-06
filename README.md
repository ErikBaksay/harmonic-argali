# Harmonic Argali

Harmonic Argali is a decorative repeating timer built with Angular. Each preset stores a name, icon, duration, and repeat style, then loops automatically with a five-second flash phase and a short chime at every cycle boundary.

## Features

- Local preset storage with no required starter data
- Infinite or finite repeat modes with a quick run-time override
- Font Awesome free icon class input with automatic fallback for invalid icons
- Full-screen alert flash plus Web Audio chime
- GitHub Pages deployment via GitHub Actions

## Development

```bash
npm install
npm start
```

## GitHub Pages build

```bash
npm run build:pages
```
