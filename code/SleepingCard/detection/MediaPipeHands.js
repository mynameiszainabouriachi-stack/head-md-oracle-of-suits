// =====================================================
// MediaPipe Hands — Version stable pour Sleeping Card
// =====================================================

// ---- Knock thresholds ----
const KNOCK_POINT_INDEX = 9;          // middle finger base
const KNOCK_DELTA_THRESHOLD = 0.003;  // detect forward movement
const KNOCK_MAX_DT_MS = 120;          // must be fast
const KNOCK_COOLDOWN_MS = 400;        // cooldown to avoid spam

// ---- Globals ----
let videoElement = null;
let detections = null;

const knockState = {
  lastDepth: null,
  lastTimestamp: 0,
  cooldownUntil: 0,
};

let lastHandPresent = false;

// ----------------------------------------------------
// Create hidden <video> that MediaPipe uses
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
  }
  window.videoElement = videoElement;
  return videoElement;
}

// ----------------------------------------------------
// Initialize MediaPipe Hands
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
// Hands callback: detect hand + detect knock
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
    detectKnock(results.multiHandLandmarks);
  } else {
    resetKnock();
  }
}

// ----------------------------------------------------
// Knock detection: track one knuckle moving forward
// ----------------------------------------------------
function detectKnock(landmarks) {
  const now = performance.now();
  const hand = landmarks[0];
  if (!hand || !hand[KNOCK_POINT_INDEX]) return;

  const pt = hand[KNOCK_POINT_INDEX];
  const z = pt.z || 0;

  if (knockState.lastDepth === null) {
    knockState.lastDepth = z;
    knockState.lastTimestamp = now;
    return;
  }

  const dt = now - knockState.lastTimestamp;
  if (dt <= 0) {
    knockState.lastDepth = z;
    knockState.lastTimestamp = now;
    return;
  }

  const forwardDelta = knockState.lastDepth - z; // positive = moving closer
  const isForward = forwardDelta > KNOCK_DELTA_THRESHOLD;
  const isFast = dt <= KNOCK_MAX_DT_MS;

  if (isForward && isFast && now >= knockState.cooldownUntil) {
    knockState.cooldownUntil = now + KNOCK_COOLDOWN_MS;

    console.log("KNOCK!", {
      z: z.toFixed(3),
      forwardDelta: forwardDelta.toFixed(3),
      dt: Math.round(dt),
    });

    if (typeof onKnockDetected === "function") {
      onKnockDetected();
    }
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
// Camera starter
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

  const loop = async () => {
    const vid = videoElement;
    if (
      vid &&
      vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      vid.videoWidth > 0 &&
      vid.videoHeight > 0
    ) {
      try {
        await hands.send({ image: vid });
      } catch (err) {
        console.error("hands.send failed", err);
      }
    }

    requestAnimationFrame(loop);
  };

  loop();
}

// ----------------------------------------------------
// p5 can check if the video is ready
// ----------------------------------------------------
function isVideoReady() {
  const vid = window.videoElement;
  if (!vid) return false;
  return vid.videoWidth > 0 && vid.videoHeight > 0 && !vid.paused;
}

window.isVideoReady = isVideoReady;

// auto-start camera
document.addEventListener("DOMContentLoaded", () => {
  startCamera();
});

// Debug access
window.hands = hands;
window.getHandsDetections = () => detections;
