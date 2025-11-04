function setup() {

  // full window canvas
  createCanvas(windowWidth, windowHeight);

  // initialize MediaPipe settings
  setupHands();
  // start camera using MediaPipeHands.js helper
  setupVideo();

}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}


// new globals for fist detection / effect (updated to use palm center 9)
let fistActive = false;
let lastPalm = null; // {x,y} in normalized video coords for effect placement

// smoothing / hysteresis parameters (for stable, real-time feedback)
let fistConfidence = 0;            // 0..1 smoothed confidence that hand is closed
const FIST_SMOOTH = 0.18;          // EMA smoothing factor (0..1)
const PALM_THRESHOLD = 0.05;       // normalized distance threshold between landmark 12 and 9
const HYSTERESIS = 0.01;           // small hysteresis to avoid flicker
const CONFIDENCE_THRESHOLD = 0.6;  // when smoothed confidence exceeds this -> consider closed

// Tap (knock) detection globals
let tapMeanDist = 0;                // smoothed mean finger-to-middle distance
const TAP_SMOOTH = 0.22;            // smoothing for distance
const TAP_CLOSE_THRESHOLD = 0.048;  // distance considered "closed"
const TAP_OPEN_THRESHOLD = 0.066;   // distance considered "open" (hysteresis)
const TAP_MAX_INTERVAL = 850;       // ms max time between close and open to count as a tap
let pendingClose = false;           // true after we detect a "close" waiting for an "open"
let lastCloseTime = 0;              // millis() when close detected
let lastTapTime = 0;                // millis() of last registered tap
let tapEffects = [];                // active visual tap effects

// small helper: Euclidean distance between two normalized landmarks
function distNorm(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// register a tap — create a visual effect at the palm center
function registerTap(palmNorm) {
  const now = millis();
  lastTapTime = now;
  // store effect with creation time and normalized coords
  tapEffects.push({
    x: palmNorm.x,
    y: palmNorm.y,
    t: now
  });
  console.log("Tap registered at", now);
}

// process a single hand for taps: returns true if a tap was registered this frame
function processTap(landmarks) {
  if (!landmarks) return false;

  // compute mean distance from each fingertip to its corresponding "middle" joint:
  // tips [8,12,16,20] -> middles [5,9,13,17]
  const tipIdx = [8, 12, 16, 20];
  const midIdx = [5, 9, 13, 17];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < tipIdx.length; i++) {
    const tip = landmarks[tipIdx[i]];
    const mid = landmarks[midIdx[i]];
    if (!tip || !mid) continue;
    sum += distNorm(tip, mid);
    count++;
  }
  if (count === 0) return false;
  const meanDist = sum / count;

  // update a palm center reference (average of 5,9,13,17)
  let px = 0, py = 0, pc = 0;
  for (let idx of midIdx) {
    const m = landmarks[idx];
    if (!m) continue;
    px += m.x; py += m.y; pc++;
  }
  if (pc > 0) lastPalm = { x: px / pc, y: py / pc };

  // smooth the mean distance to reduce jitter
  tapMeanDist = tapMeanDist + (meanDist - tapMeanDist) * TAP_SMOOTH;

  const now = millis();

  // timeout pending close if it takes too long
  if (pendingClose && now - lastCloseTime > TAP_MAX_INTERVAL) {
    pendingClose = false;
  }

  // detect close -> open pattern with hysteresis
  if (tapMeanDist <= TAP_CLOSE_THRESHOLD && !pendingClose) {
    // started a close
    pendingClose = true;
    lastCloseTime = now;
    // don't register a tap yet; wait for the open
    return false;
  }

  if (tapMeanDist >= TAP_OPEN_THRESHOLD && pendingClose) {
    // completed a close -> open sequence within time -> register a tap
    if (now - lastCloseTime <= TAP_MAX_INTERVAL) {
      // make a solid palm point for the effect (use lastPalm if available)
      const palmPos = lastPalm ? lastPalm : landmarks[9];
      registerTap(palmPos || { x: 0.5, y: 0.5 });
      pendingClose = false;
      return true;
    } else {
      pendingClose = false;
    }
  }

  return false;
}

// draw and cleanup active tap effects
function drawTapEffects() {
  if (!tapEffects.length) return;

  const now = millis();
  // draw behind other UI elements or atop as desired
  push();
  noStroke();
  for (let i = tapEffects.length - 1; i >= 0; i--) {
    const e = tapEffects[i];
    const age = now - e.t;
    const life = 600; // ms
    if (age > life) {
      tapEffects.splice(i, 1);
      continue;
    }
    const norm = constrain(age / life, 0, 1);
    const alpha = (1 - norm) * 220;
    const pulse = 1 + Math.sin((age / 30)) * 0.12;
    const baseR = Math.min(videoElement.width, videoElement.height) * 0.06;
    const r = baseR * (0.6 + (1 - norm) * 1.4) * pulse;

    // map normalized palm to video coords
    const px = e.x * videoElement.width;
    const py = e.y * videoElement.height;

    // flash / glow
    fill(255, 200, 40, alpha * 0.12);
    rect(0, 0, width, height);

    // outer glow
    fill(255, 140, 30, alpha * 0.25);
    ellipse(px, py, r * 2.6, r * 2.6);

    // main circle
    fill(255, 220, 80, alpha);
    ellipse(px, py, r, r);
  }
  pop();
}

// ...existing code...
function isFist(landmarks) {
  if (!landmarks) return false;
  const tip12 = landmarks[12];
  const palm9 = landmarks[9];
  if (!tip12 || !palm9) return false;

  // distances in normalized coordinates
  const d12_9 = distNorm(tip12, palm9);

  // keep a reference point for effects at the palm center
  lastPalm = { x: palm9.x, y: palm9.y };

  // compute a crisp closed/open decision with hysteresis
  // closed when distance <= PALM_THRESHOLD - HYSTERESIS
  // open when distance >= PALM_THRESHOLD + HYSTERESIS
  const closedHard = d12_9 <= (PALM_THRESHOLD - HYSTERESIS);
  const openHard = d12_9 >= (PALM_THRESHOLD + HYSTERESIS);

  // target confidence: 1 = closed, 0 = open, smooth in-between
  let target = 0;
  if (closedHard) {
    target = 1;
  } else if (openHard) {
    target = 0;
  } else {
    // interpolate softly when in the hysteresis band
    const t = (PALM_THRESHOLD + HYSTERESIS - d12_9) / (2 * HYSTERESIS || 1);
    target = constrain(t, 0, 1);
  }

  // exponential smoothing of confidence
  fistConfidence = fistConfidence + (target - fistConfidence) * FIST_SMOOTH;

  return fistConfidence >= CONFIDENCE_THRESHOLD;
}

function onFistStart() {
  // activate effect / action
  console.log("Fist detected: activating effect");
  // additional activation code can go here
}

function onFistEnd() {
  // deactivate effect / action
  console.log("Hand opened: deactivating effect");
  // additional deactivation code can go here
}

function drawEffect() {
  if (!lastPalm) return;

  // use fistConfidence to control intensity/pulse
  const intensity = fistConfidence; // 0..1

  // translucent overlay whose alpha depends on confidence
  push();
  noStroke();
  fill(10, 120, 200, 60 * intensity + 10); // tint the whole screen slightly
  rect(0, 0, width, height);
  pop();

  // convert normalized tip coords to video pixels (consistent with the rest of the code)
  const px = lastPalm.x * videoElement.width;
  const py = lastPalm.y * videoElement.height;

  // pulsing radius
  const baseR = Math.min(videoElement.width, videoElement.height) * 0.06;
  const pulse = 1 + Math.sin(frameCount * 0.15) * 0.12;
  const r = baseR * (1 + intensity * 0.6) * pulse;

  // glowing circle
  push();
  noStroke();
  // outer glow
  fill(255, 50, 50, 30 * intensity + 10);
  ellipse(px, py, r * 3, r * 3);
  // main circle
  fill(255, 80, 80, 220 * intensity + 35);
  ellipse(px, py, r, r);
  pop();

  // label with confidence percent
  push();
  fill(255);
  textAlign(CENTER, BOTTOM);
  textSize(20 + 12 * intensity);
  text(`closed fist detected`, px, py - r - 8);
  pop();
}

function draw() {
  // clear the canvas
  background(255);

  // if the video connection is ready
  if (isVideoReady()) {
    // draw the capture image
    image(videoElement, 0, 0);
  }

  // use thicker lines for drawing hand connections
  strokeWeight(2);

  // make sure we have detections to draw
  if (detections) {

    // flag used to determine if any hand is a fist this frame
    let anyFist = false;

    // for each detected hand
    for (let hand of detections.multiHandLandmarks) {
      // draw the index finger
      drawIndex(hand);
      // draw the thumb finger
      drawThumb(hand);
      // draw fingertip points
      drawTips(hand);
      // draw connections
      drawConnections(hand);
      // draw all landmarks
      drawLandmarks(hand);

      // process tap detection for this hand (close -> open)
      processTap(hand);

      // check fist for this hand
      if (isFist(hand)) {
        anyFist = true;
      }
    } // end of hands loop

    // handle activation/deactivation transitions
    if (anyFist && !fistActive) {
      fistActive = true;
      onFistStart();
    } else if (!anyFist && fistActive) {
      fistActive = false;
      onFistEnd();
    }

    // draw the effect while fist is active
    if (fistActive) {
      drawEffect();
    }

    // draw any active tap effects (visuals for taps)
    drawTapEffects();

  } // end of if detections
  
} // end of draw


// only the index finger tip landmark
function drawIndex(landmarks) {

  // get the index fingertip landmark
  let mark = landmarks[FINGER_TIPS.index];

  noStroke();
  // set fill color for index fingertip
  fill(0, 255, 255);

  // adapt the coordinates (0..1) to video coordinates
  let x = mark.x * videoElement.width;
  let y = mark.y * videoElement.height;
  circle(x, y, 20);

}


// draw the thumb finger tip landmark
function drawThumb(landmarks) {

  // get the thumb fingertip landmark
  let mark = landmarks[FINGER_TIPS.thumb];

  noStroke();
  // set fill color for thumb fingertip
  fill(255, 255, 0);

  // adapt the coordinates (0..1) to video coordinates
  let x = mark.x * videoElement.width;
  let y = mark.y * videoElement.height;
  circle(x, y, 20);

}

function drawTips(landmarks) {

  noStroke();
  // set fill color for fingertips
  fill(0, 0, 255);

  // fingertip indices
  const tips = [4, 8, 12, 16, 20];

  for (let tipIndex of tips) {
    let mark = landmarks[tipIndex];
    // adapt the coordinates (0..1) to video coordinates
    let x = mark.x * videoElement.width;
    let y = mark.y * videoElement.height;
    circle(x, y, 10);
  }

}


function drawLandmarks(landmarks) {

  noStroke();
  // set fill color for landmarks
  fill(255, 0, 0);

  for (let mark of landmarks) {
    // adapt the coordinates (0..1) to video coordinates
    let x = mark.x * videoElement.width;
    let y = mark.y * videoElement.height;
    circle(x, y, 6);
  }

}


function drawConnections(landmarks) {

  // set stroke color for connections
  stroke(0, 255, 0);

  // iterate through each connection
  for (let connection of HAND_CONNECTIONS) {
    // get the two landmarks to connect
    const a = landmarks[connection[0]];
    const b = landmarks[connection[1]];
    // skip if either landmark is missing
    if (!a || !b) continue;
    // landmarks are normalized [0..1], (x,y) with origin top-left
    let ax = a.x * videoElement.width;
    let ay = a.y * videoElement.height;
    let bx = b.x * videoElement.width;
    let by = b.y * videoElement.height;
    line(ax, ay, bx, by);
  }

}
