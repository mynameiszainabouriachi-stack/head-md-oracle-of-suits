// ----- ADD / REPLACE: interactive state & helpers -----
let paintLayer;
let prevIndexPos = []; // previous index tip per hand
let particles = [];
let trails = []; // per-hand index trails (points with timestamp) to allow 3s fade

function setup() {
  // full window canvas
  createCanvas(windowWidth, windowHeight);

  // persistent paint layer (we will redraw trails each frame)
  paintLayer = createGraphics(windowWidth, windowHeight);
  paintLayer.clear();

  // initialize MediaPipe settings
  setupHands();
  // start camera using MediaPipeHands.js helper
  setupVideo();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (paintLayer) {
    const old = paintLayer;
    paintLayer = createGraphics(windowWidth, windowHeight);
    paintLayer.clear();
    image(old, 0, 0); // copy old content if desired (optional)
  }
}

function draw() {
  // removed background(255) so video remains visible
  // draw camera first (video is visible behind overlays)
  if (isVideoReady()) {
    image(videoElement, 0, 0);
  }

  // prepare / redraw paintLayer (we clear and draw fading trails each frame)
  paintLayer.clear();
  const now = millis();
  // draw trails for each hand, remove old points (>3000ms)
  for (let hi = 0; hi < trails.length; hi++) {
    const list = trails[hi] || [];
    // drop old points
    while (list.length > 0 && now - list[0].t > 3000) list.shift();
    if (list.length < 2) continue;
    // draw connected line with alpha mapped by age (new=255 -> old=0 over 3s)
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const age = now - b.t; // age of segment end
      const alpha = constrain(map(age, 0, 3000, 255, 0), 0, 255);
      paintLayer.stroke(a.c[0], a.c[1], a.c[2], alpha);
      paintLayer.strokeWeight(a.w);
      paintLayer.strokeCap(ROUND);
      paintLayer.line(a.x, a.y, b.x, b.y);
    }
  }

  // draw persistent paint layer (fading strokes) over video
  image(paintLayer, 0, 0);

  // update particles (interactive effects)
  updateParticles();
  drawParticles();

  // make sure we have detections to draw/interact
  if (detections && detections.multiHandLandmarks) {
    const hands = detections.multiHandLandmarks;

    // If two hands present, spawn a big multicolor explosion once per frame
    if (hands.length >= 2) {
      // midpoint between first two palm centers
      const w = videoElement.width;
      const h = videoElement.height;
      const mid1 = hands[0][9] || hands[0][0];
      const mid2 = hands[1][9] || hands[1][0];
      const x = ((mid1.x + mid2.x) / 2) * w;
      const y = ((mid1.y + mid2.y) / 2) * h;
      // magnitude based on average palm size
      const p1 = dist(hands[0][0].x * w, hands[0][0].y * h, mid1.x * w, mid1.y * h);
      const p2 = dist(hands[1][0].x * w, hands[1][0].y * h, mid2.x * w, mid2.y * h);
      const scale = constrain((p1 + p2) / 100, 1, 6);
      // spawn mixed colors
      const colors = ['#FF4500', '#00BFFF', '#8A2BE2', '#32CD32', '#FFD700'];
      for (let c of colors) spawnParticles(x + random(-30,30), y + random(-30,30), 20, c, 2 * scale, 8 * scale, scale);
    }

    for (let hi = 0; hi < hands.length; hi++) {
      const hand = hands[hi];

      // compute which fingers are up (true = extended)
      const fingers = getFingersUp(hand); // [thumb,index,middle,ring,pinky]

      // determine connection color state (your rules)
      const allOpen = fingers.every(Boolean);
      const thumbClosed = !fingers[0];
      const indexClosed = !fingers[1];

      let connColor = [0, 200, 0]; // default green
      if (allOpen) {
        connColor = [255, 165, 0]; // orange
      } else if (thumbClosed && indexClosed) {
        connColor = [148, 0, 211]; // violet
      } else if (indexClosed) {
        connColor = [0, 0, 255]; // blue
      } else if (thumbClosed) {
        connColor = [255, 0, 0]; // red
      }

      // draw thick connections (no dots)
      drawConnections(hand, connColor);

      // --- Interactive behaviors ---

      // compute useful points/sizes
      const w = videoElement.width;
      const h = videoElement.height;
      const indexTip = hand[TIP_INDICES.index];
      const thumbTip = hand[TIP_INDICES.thumb];
      const wrist = hand[0] || { x: 0.5, y: 0.5 };
      const midMcp = hand[9] || wrist;
      const palmSize = dist(wrist.x * w, wrist.y * h, midMcp.x * w, midMcp.y * h);
      const strokeSize = constrain(palmSize * 0.4, 6, 120);
      const sizeScale = constrain(palmSize / 60, 0.6, 6); // bigger when closer

      // 1) INDEX EXTENDED -> record trail point (will fade after 3s)
      if (fingers[1] && indexTip) {
        const x = indexTip.x * w;
        const y = indexTip.y * h;
        if (!trails[hi]) trails[hi] = [];
        // push point with timestamp, color (cyan), and weight based on palm
        trails[hi].push({ x, y, t: now, c: FINGER_COLORS[1], w: strokeSize * 0.6 });
        // keep trail trimmed (avoid memory grow)
        while (trails[hi].length > 200) trails[hi].shift();
      } else {
        // release trail when index not extended (we still let it fade naturally)
      }

      // 2) GESTURE-SPECIFIC particle effects (based on closed fingers)
      const palmCenter = { x: midMcp.x * w, y: midMcp.y * h };

      if (allOpen) {
        // whole hand open -> orange floaters + gentle fade of paintLayer
        spawnParticles(palmCenter.x, palmCenter.y, 6, colorArrayToHex([255,165,0]), 0.5 * sizeScale, 2.5 * sizeScale, sizeScale);
      } else if (thumbClosed && indexClosed) {
        // thumb + index closed -> violet explosion (bigger when closer)
        spawnParticles(palmCenter.x, palmCenter.y, 30, colorArrayToHex([148,0,211]), 3 * sizeScale, 6 * sizeScale, sizeScale);
      } else if (indexClosed) {
        // index closed alone -> blue burst at index base (scale with proximity)
        if (indexTip) spawnParticles(indexTip.x * w, indexTip.y * h, 14, colorArrayToHex([0,0,255]), 2 * sizeScale, 4 * sizeScale, sizeScale);
      } else if (thumbClosed) {
        // thumb closed alone -> red ripple at thumb tip (scale with proximity)
        if (thumbTip) spawnRipple(thumbTip.x * w, thumbTip.y * h, colorArrayToHex([255,0,0]), strokeSize * sizeScale);
      }
    } // end hands loop
  } // end if detections
} // end draw


// ---- simple particle system & helpers ----
// added last param sizeScale to scale velocity/size if hand is close
function spawnParticles(x, y, count, hexColor = '#ffffff', minR = 1, maxR = 4, sizeScale = 1) {
  // scale count by sizeScale for closer/larger hands
  const scaledCount = Math.max(1, Math.round(count * sizeScale));
  for (let i = 0; i < scaledCount; i++) {
    const angle = random(TWO_PI);
    const speed = random(0.5, 6) * (0.6 + 0.8 * sizeScale);
    particles.push({
      x: x + random(-10 * sizeScale, 10 * sizeScale),
      y: y + random(-10 * sizeScale, 10 * sizeScale),
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      r: random(minR, maxR) * (0.8 + 0.6 * sizeScale),
      life: random(40, 140) * (1 + 0.5 * sizeScale),
      c: hexColor
    });
  }
}

function spawnRipple(x, y, hexColor, baseSize) {
  // ripple implemented as several outward particles with low life
  const s = constrain(baseSize / 8, 1, 6);
  spawnParticles(x, y, 8, hexColor, baseSize * 0.2, baseSize * 0.9, s);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06; // gravity-ish
    p.vx *= 0.995;
    p.vy *= 0.995;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  noStroke();
  for (let p of particles) {
    fill(p.c + hexAlpha(map(p.life, 0, 200, 0, 255)));
    circle(p.x, p.y, p.r * 2);
  }
}

// small utils for hex/color handling
function colorArrayToHex(arr) {
  return '#' + arr.map(v => {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}
function hexAlpha(a) {
  // returns two-digit hex alpha for 0..255 value
  const v = Math.max(0, Math.min(255, Math.round(a)));
  const h = v.toString(16);
  return (h.length === 1 ? '0' + h : h);
}

// utility indices (MediaPipe Hands)
const TIP_INDICES = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP_INDICES = { thumb_ip: 3, index: 6, middle: 10, ring: 14, pinky: 18 };
// colors: [thumb, index, middle, ring, pinky]
const FINGER_COLORS = [
  [255, 200, 0],   // thumb (yellow)
  [0, 255, 255],   // index (cyan)
  [255, 0, 255],   // middle (magenta)
  [0, 200, 0],     // ring (green)
  [0, 0, 255]      // pinky (blue)
];
// hand color when exactly one finger is up (per finger)
const HAND_COLORS = [
  [255, 230, 180], // thumb -> warm
  [200, 255, 255], // index -> cyan tint
  [255, 200, 255], // middle -> magenta tint
  [200, 255, 200], // ring -> green tint
  [200, 200, 255]  // pinky -> blue tint
];

function getFingersUp(landmarks) {
  // returns boolean array [thumb, index, middle, ring, pinky]
  if (!landmarks || landmarks.length < 21) return [false, false, false, false, false];

  // determine simple handedness heuristic: compare x of pinky_mcp (17) vs index_mcp (5)
  // if pinky_mcp.x > index_mcp.x => hand is likely "left" from camera view
  const isLeft = (landmarks[17].x > landmarks[5].x);

  // thumb: compare tip.x vs ip.x depending on orientation
  const thumbTip = landmarks[TIP_INDICES.thumb];
  const thumbIp = landmarks[PIP_INDICES.thumb_ip];
  let thumbUp = false;
  if (thumbTip && thumbIp) {
    if (isLeft) {
      thumbUp = thumbTip.x > thumbIp.x; // thumb to the right for left-hand
    } else {
      thumbUp = thumbTip.x < thumbIp.x; // thumb to the left for right-hand
    }
  }

  // other fingers: tip y lower than pip y means finger extended (y increases downward)
  const idxTip = landmarks[TIP_INDICES.index];
  const idxPip = landmarks[PIP_INDICES.index];
  const midTip = landmarks[TIP_INDICES.middle];
  const midPip = landmarks[PIP_INDICES.middle];
  const ringTip = landmarks[TIP_INDICES.ring];
  const ringPip = landmarks[PIP_INDICES.ring];
  const pinkyTip = landmarks[TIP_INDICES.pinky];
  const pinkyPip = landmarks[PIP_INDICES.pinky];

  const indexUp = idxTip && idxPip ? (idxTip.y < idxPip.y) : false;
  const middleUp = midTip && midPip ? (midTip.y < midPip.y) : false;
  const ringUp = ringTip && ringPip ? (ringTip.y < ringPip.y) : false;
  const pinkyUp = pinkyTip && pinkyPip ? (pinkyTip.y < pinkyPip.y) : false;

  return [thumbUp, indexUp, middleUp, ringUp, pinkyUp];
}

// modified drawing helpers accept optional color parameters

function drawIndex(landmarks, color = [0,255,255]) {
  let mark = landmarks[TIP_INDICES.index];
  if (!mark) return;
  noStroke();
  fill(...color);
  let x = mark.x * videoElement.width;
  let y = mark.y * videoElement.height;
  circle(x, y, 20);
}

function drawThumb(landmarks, color = [255,255,0]) {
  let mark = landmarks[TIP_INDICES.thumb];
  if (!mark) return;
  noStroke();
  fill(...color);
  let x = mark.x * videoElement.width;
  let y = mark.y * videoElement.height;
  circle(x, y, 20);
}

function drawTips(landmarks, color = [0,0,255]) {
  if (!landmarks) return;
  noStroke();
  fill(...color);
  const tips = [TIP_INDICES.thumb, TIP_INDICES.index, TIP_INDICES.middle, TIP_INDICES.ring, TIP_INDICES.pinky];
  for (let tipIndex of tips) {
    let mark = landmarks[tipIndex];
    if (!mark) continue;
    let x = mark.x * videoElement.width;
    let y = mark.y * videoElement.height;
    circle(x, y, 10);
  }
}

function drawLandmarks(landmarks, color = [255,0,0]) {
  if (!landmarks) return;
  noStroke();
  fill(...color);
  for (let mark of landmarks) {
    if (!mark) continue;
    let x = mark.x * videoElement.width;
    let y = mark.y * videoElement.height;
    circle(x, y, 6);
  }
}

function drawConnections(landmarks, color = [0,255,0]) {
  if (!landmarks || typeof HAND_CONNECTIONS === 'undefined') return;

  const w = videoElement.width;
  const h = videoElement.height;
  const wrist = landmarks[0];
  const midMcp = landmarks[9] || wrist;
  const indexMcp = landmarks[5] || wrist;

  // compute a size using wrist->middle_mcp and wrist->index_mcp (palm / finger scale)
  const palmDist = dist(wrist.x * w, wrist.y * h, midMcp.x * w, midMcp.y * h);
  const fingerDist = dist(wrist.x * w, wrist.y * h, indexMcp.x * w, indexMcp.y * h);
  const baseSize = max(palmDist, fingerDist);

  // thickness proportional to base size, adjust multiplier / bounds as desired
  const thickness = constrain(baseSize * 0.45, 8, 160);

  stroke(...color);
  strokeWeight(thickness);
  strokeCap(ROUND);

  for (let connection of HAND_CONNECTIONS) {
    const a = landmarks[connection[0]];
    const b = landmarks[connection[1]];
    if (!a || !b) continue;
    let ax = a.x * w;
    let ay = a.y * h;
    let bx = b.x * w;
    let by = b.y * h;

    line(ax, ay, bx, by);
  }
}
