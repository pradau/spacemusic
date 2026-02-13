# Space Music

A browser-based spatial music visualization. Instruments move on the canvas and a puck travels between them; when the puck hits an instrument, that instrument toggles on or off and the puck is sent to another instrument at random. Audio layers stack as more instruments play.

## Setup

**Requirements:** Node.js 18+ and npm.

1. Clone the repo and go into the project folder:
   ```bash
   git clone https://github.com/pradau/spacemusic.git
   cd spacemusic
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. http://localhost:5173). Click "Start audio" to enable sound, then click instruments or watch the puck.

**Controls:** After starting, use the top-left sliders to adjust puck speed and instrument speed (0.25x to 2x). Use "Quit" to stop; the button then becomes "Start" so you can restart the demo. Instruments are balanced by timbre (not volume) so they stay distinct by sound.

**Optional:** Run `python3 start.py` to start the dev server and stop it with Ctrl+C in the same terminal.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production (output in `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests |

## Publishing

See [DEPLOY.md](DEPLOY.md) for deploying to GitHub Pages.

## Live demo

https://pradau.github.io/spacemusic/
