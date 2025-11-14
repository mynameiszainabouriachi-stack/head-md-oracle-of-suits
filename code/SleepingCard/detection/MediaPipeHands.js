// =====================================================
// MediaPipe Hands — stable version for Sleeping Card
// =====================================================

// ---- Knock thresholds ----
// we track a single knuckle moving quickly toward the camera
const KNOCK_POINT_INDEX = 9;      // middle finger base (or any stable knuckle)
const KNOCK_DELTA_THRESHOLD = -0.015; // Z change to count as "forward"
const KNOCK_MAX_DT_MS = 260;          // must happen fast
const KNOCK_COOLDOWN_MS = 600;


// ---- Globals ----
let videoElement = null;
let handsLoopHandle = null;
let isSendingFrame = false;
let detections = null;

const knockState = {
  lastDepth: null,
  lastTimestamp: 0,
  cooldownUntil: 0,
};

let lastHandPresent = false;
let lastTrackingLog = 0;

// ----------------------------------------------------
// 1) Create / reuse hidden <video>
// ----------------------------------------------------
function ensureVideo() {
  if (!videoElement) {
    videoElement = document.createElement("video");
    videoElement.setAttribute("playsinline", "true");
    videoElement.setAttribute("autoplay", "true");
    videoElement.setAttribute("muted", "true");
    videoElement.muted = true;
    videoElement.style.display = "none";
    document.body.appendChild(videoElement);
    console.log("created hidden video element");
  }
  window.videoElement = videoElement;
  return videoElement;
}

// ----------------------------------------------------
// 2) Init MediaPipe Hands
// ----------------------------------------------------
const hands = new Hands({
  locateFile: (file) => 
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  selfieMode: true,
});

hands.onResults(onHandsResults);

// ----------------------------------------------------
// 3) Results callback → hand presence + knock
// ----------------------------------------------------
function onHandsResults(results) {
  detections = results;

  const hasHands =
    results &&
    results.multiHandLandmarks &&
    results.multiHandLandmarks.length > 0;

  if (typeof setHandPresent === "function") {
    setHandPresent(hasHands);
  }

  if (hasHands !== lastHandPresent) {
    console.log(hasHands ? "hand detected" : "no hand detected");
    lastHandPresent = hasHands;
  }

  if (hasHands) {
    const now = performance.now();
    if (now - lastTrackingLog > 1000) {
      const points = results.multiHandLandmarks[0]
        ? results.multiHandLandmarks[0].length
        : 0;
      console.log("tracking landmarks ok", { points });
      lastTrackingLog = now;
    }
    detectKnock(results.multiHandLandmarks);
  } else {
    resetKnock();
  }
}

// ----------------------------------------------------
// 4) Knock gesture detection
// ----------------------------------------------------
function detectKnock(landmarks) {
  const now = performance.now();
  const hand = landmarks[0];
  if (!hand || !hand[KNOCK_POINT_INDEX]) return;

  // we follow ONE point (a knuckle) instead of averaging all points
  const pt = hand[KNOCK_POINT_INDEX];
  const z = pt.z || 0;

  if (knockState.lastDepth === null) {
    knockState.lastDepth = z;
    knockState.lastTimestamp = now;
    return;
  }

  const dt = now - knockState.lastTimestamp; // ms
  if (dt <= 0) {
    knockState.lastDepth = z;
    knockState.lastTimestamp = now;
    return;
  }

  const deltaZ = z - knockState.lastDepth;          // how much it moved in depth
  const isForward = deltaZ <= KNOCK_DELTA_THRESHOLD;
  const isFast = dt <= KNOCK_MAX_DT_MS;

  // debug every time we have a noticeable forward motion
  if (deltaZ < -0.005) {
    console.log("🌀 fist motion", {
      z: z.toFixed(3),
      deltaZ: deltaZ.toFixed(3),
      dt: Math.round(dt),
      isForward,
      isFast
    });
  }

  if (isForward && isFast && now >= knockState.cooldownUntil) {
    knockState.cooldownUntil = now + KNOCK_COOLDOWN_MS;

    if (typeof onKnockDetected === "function") {
      onKnockDetected();
    }

    console.log("✅ KNOCK DETECTED (fist)", {
      z: z.toFixed(3),
      deltaZ: deltaZ.toFixed(3),
      dt: Math.round(dt)
    });
  }

  knockState.lastDepth = z;
  knockState.lastTimestamp = now;
}


function resetKnock() {
  knockState.lastDepth = null;
  knockState.lastTimestamp = 0;
  knockState.cooldownUntil = 0;
}

// ----------------------------------------------------
// 5) Camera + Frame Loop
// ----------------------------------------------------
async function startCamera() {
  const vid = ensureVideo();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    vid.srcObject = stream;
    await vid.play();

    console.log("camera stream started");

    startHandsLoop();
  } catch (err) {
    console.error("camera start failed", err);
  }
}

function startHandsLoop() {
  if (!videoElement) return;

  if (handsLoopHandle) {
    cancelAnimationFrame(handsLoopHandle);
    handsLoopHandle = null;
  }

  const loop = async () => {
    const vid = videoElement;
    if (
      vid &&
      vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      vid.videoWidth > 0 &&
      vid.videoHeight > 0 &&
      !isSendingFrame
    ) {
      isSendingFrame = true;
      try {
        await hands.send({ image: vid });
      } catch (err) {
        console.error("hands.send failed", err);
      } finally {
        isSendingFrame = false;
      }
    }

    handsLoopHandle = requestAnimationFrame(loop);
  };

  loop();
}

// ----------------------------------------------------
// 6) p5 can check if video is ready
// ----------------------------------------------------
function isVideoReady() {
  const vid = window.videoElement;
  if (!vid) return false;
  return vid.videoWidth > 0 && vid.videoHeight > 0 && !vid.paused;
}

window.isVideoReady = isVideoReady;

// ----------------------------------------------------
// 7) Auto-start
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  startCamera();
});

// Optional debug
window.hands = hands;
window.getHandsDetections = () => detections;

// main.js — replace drawRightColumn() with this version.
function drawRightColumn() {
  const colW = DESIGN_W * 0.44;
  const colH = DESIGN_H * 0.68;
  const cornerR = 40;

  noStroke();
  fill(0, 40, 80, 190);
  rectMode(CENTER);
  rect(0, 0, colW, colH, cornerR);

  if (messageImg && messageImg.width && messageImg.height) {
    imageMode(CENTER);
    const maxW = colW * 0.96;
    const maxH = colH * 0.45;
    let msgW = maxW;
    let msgH = msgW * (messageImg.height / messageImg.width);
    if (msgH > maxH) {
      msgH = maxH;
      msgW = msgH * (messageImg.width / messageImg.height);
    }
    image(messageImg, 0, -colH * 0.33, msgW, msgH);
  }

  const vid = getReadyVideo();
  const areaH = colH * 0.58;
  const areaW = colW * 0.94;
  const videoCenterY = -colH * 0.01;

  if (vid) {
    const ratio = vid.videoWidth / vid.videoHeight;

    let w = areaW;
    let h = w / ratio;
    if (h > areaH) {
      h = areaH;
      w = h * ratio;
    }
    push();
    translate(0, videoCenterY);
    drawingContext.save();
    drawingContext.drawImage(vid, -w / 2, -h / 2, w, h);
    drawingContext.restore();
    pop();
  } else {
    fill(0, 30, 60, 150);
    rect(0, videoCenterY, areaW, areaH, 30);
  }

  const gaugeY = videoCenterY + areaH / 2 + colH * 0.08;
  drawGauge(0, gaugeY, 255);
}
