# Copilot Instructions

## Project Overview
- Interactive sketches live in sibling folders like `prototype frame gesture/`, `prototype knock/`, and `abstractmachine head-md-oracle-of-suits main code-2025-10-22_FingerPaint 2/`; each folder is a self-contained p5.js + MediaPipe experiment with its own `index.html`, `sketch.js`, `MediaPipeHands.js`, assets, and `libraries/` bundle.
- `MediaPipeHands.js` owns the shared `window.hands` instance, exposes `setupHands()`, `setupVideo()`, and leaves `videoElement`/`detections` as globals consumed by every `sketch.js`; extending tracking logic belongs in this helper instead of the sketch loops.

## Runtime Patterns
- In every sketch `setup()`, call `setupHands()` before `setupVideo()` and keep the returned camera hidden; reinitialising `Hands` elsewhere will break the singleton shared via `window.hands`.
- Always guard with `isVideoReady()` before reading `videoElement.width/height`; MediaPipe delivers frames asynchronously and the sketches expect that check (see both `prototype frame gesture/sketch.js` and `prototype knock/sketch.js`).
- `detections.multiHandLandmarks` may lack handedness metadata; follow the existing pattern of tracking `unknownHands` and assigning fallbacks so gestures remain robust when MediaPipe omits labels.
- Utility functions such as `landmarkToCanvas()`, `drawRoundedImage()`, `isCollinear()`, and the touch-distance helpers live near the bottom of `sketch.js`; reuse them rather than introducing new coordinate math.

## Gesture Logic
- Straight-finger detection is derived from `isCollinear()` with indices `[5,6,7,8]` (index) and `[2,3,4]` (thumb); when altering tolerances, update the shared `tol` calculation so both hands behave symmetrically.
- Hand-touch recognition (`left[4]↔right[8]`, `left[8]↔right[4]`) scales its threshold with the screen diagonal; keep this adaptive rule when porting the `finalMatch` logic to avoid distance drift on different canvas sizes.
- The `prototype knock` sketch layers fist and tap detection using exponential smoothing (`FIST_SMOOTH`, `TAP_SMOOTH`) plus hysteresis constants; adjust both the smooth factor and paired thresholds together to prevent flicker.
- The frame-gesture gauge steps (`GAUGE_STEPS`) only decrement on the rising edge of `finalMatch`; any new state machine should hook into the `prevFinalMatch` edge detection rather than polling continuously.

## UI, Audio, and Assets
- Gauge artwork in `prototype frame gesture` is swapped via the `gaugeImages` lookup created in `preload()`; keep filenames (`images/{0,25,50,75,100}.png`) consistent or update the map in one place.
- DOM overlays (e.g., `gestureGif`) are created lazily with `createImg`, marked `pointer-events: none`, and positioned each frame; reuse this pattern for additional instructional media instead of drawing animated GIFs onto the canvas.
- Background sound obeys browser autoplay policies: `mousePressed()` primes a muted loop and `userStartAudio()` is called defensively inside `draw()` when hands appear. Mirror this handshake when introducing new soundscapes.

## Developer Workflow
- Serve a prototype directory over HTTP (e.g., `cd prototype\ frame\ gesture && python3 -m http.server 8000`) before opening `index.html`; MediaPipe camera utilities and audio assets fail under direct `file://` access.
- External dependencies (p5.js, p5.sound, MediaPipe camera/hands) load from CDN script tags; if swapping versions, update both `index.html` and the `locateFile` override in `MediaPipeHands.js`.
- To spawn a new experiment, duplicate an existing prototype folder, keep the `libraries/` bundle, and replace only the sketch-specific assets; sharing globals means edits to `MediaPipeHands.js` cascade to every sketch.
- Testing is observational: rely on the console logs (`Tap registered`, `Fist detected`, `Autoplay started`) and on-screen gauges/overlays to verify gesture pipelines after code changes.
