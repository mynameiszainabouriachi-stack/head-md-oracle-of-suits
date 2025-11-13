// ---------------------------
// MediaPipe Hands bridge for p5 sketch
// ---------------------------

const HAVE_CURRENT_DATA = 2; // HTMLMediaElement readyState flag
const KNOCK_DELTA_THRESHOLD = -0.12; // normalized Z change needed to register forward motion
const KNOCK_SPEED_THRESHOLD = -0.6; // normalized meters/sec approximation (negative = toward camera)
const KNOCK_COOLDOWN_MS = 600;

let videoElement = null;
let camera = null;
let detections = null;
let manualFeedId = null;
let videoLoggedReady = false;
const lastVideoStateLog = {
  readyState: undefined,
  width: undefined,
  height: undefined
};
let videoPollInterval = null;
let videoReadyCallbackFired = false;

const locateHandsFile = (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
const hands = (() => {
  if (window.hands) return window.hands;
  const instance = new Hands({ locateFile: locateHandsFile });
  window.hands = instance;
  return instance;
})();

const DEFAULT_HAND_OPTIONS = {
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.5,
  selfieMode: true
};

hands.setOptions(DEFAULT_HAND_OPTIONS);
hands.onResults(onHandsResults);

const knockState = {
  lastDepth: null,
  lastTimestamp: 0,
  cooldownUntil: 0
};

function stopManualFeed() {
  if (manualFeedId !== null) {
    cancelAnimationFrame(manualFeedId);
    manualFeedId = null;
  }
}

function startManualFeed() {
  stopManualFeed();
  const tick = async () => {
    if (!videoElement) return;
    try {
      await hands.send({ image: videoElement });
    } catch (err) {
      console.error('manual hands.send failed', err);
    }
    manualFeedId = requestAnimationFrame(tick);
  };
  manualFeedId = requestAnimationFrame(tick);
}

function onHandsResults(results) {
  detections = results;
  logVideoStateIfChanged('onResults');

  const hasHands = Boolean(
    results &&
    results.multiHandLandmarks &&
    results.multiHandLandmarks.length > 0
  );
  if (hasHands) {
    detectKnock(results.multiHandLandmarks);
  } else {
    resetKnockTracking();
  }

  if (typeof setHandPresent === 'function') {
    setHandPresent(hasHands);
  }
}

function setupHands(options = {}) {
  const merged = Object.assign({}, DEFAULT_HAND_OPTIONS, options);
  hands.setOptions(merged);
  return hands;
}

function setupVideo(selfieMode = true) {
  if (!videoElement) {
    videoElement = document.createElement('video');
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('autoplay', 'true');
    videoElement.setAttribute('muted', 'true');
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);
    console.log('[MediaPipe] video element appended to document');
    attachVideoDebugListeners(videoElement);
    resetVideoStateDebug();
    logVideoStateIfChanged('create');
    startVideoDebugPolling('init');
    window.videoElement = videoElement; // expose for other scripts
  } else if (!document.body.contains(videoElement)) {
    document.body.appendChild(videoElement);
    console.log('[MediaPipe] video element re-appended to document');
    attachVideoDebugListeners(videoElement);
    logVideoStateIfChanged('re-attach');
    startVideoDebugPolling('re-attach');
  }

  if (camera && typeof camera.stop === 'function') {
    camera.stop();
  }

  const { Camera } = window;
  if (!Camera) {
    console.error('MediaPipe Camera util is missing. Did you include @mediapipe/camera_utils?');
    return null;
  }

  camera = new Camera(videoElement, {
    onFrame: async () => {
      try {
        await hands.send({ image: videoElement });
      } catch (err) {
        console.error('hands.send failed', err);
      }
    },
    width: 640,
    height: 480,
    facingMode: selfieMode ? 'user' : 'environment'
  });

  const startPromise = camera.start().then(async () => {
    console.log('MediaPipe camera started');
    reportVideoStreamStatus();
    startVideoDebugPolling('camera.start');
    let streamAvailable = hasActiveStream(videoElement);

    if (!streamAvailable && camera && camera.video && camera.video.srcObject) {
      applyStreamToVideo(camera.video.srcObject, 'camera.start-existing');
      streamAvailable = hasActiveStream(videoElement);
    }

    if (!streamAvailable) {
      console.warn('[MediaPipe] warning: no active stream after camera.start(); acquiring manually');
      const stream = await acquireUserMediaStream(selfieMode, 'camera.start-fallback');
      streamAvailable = Boolean(stream);
      if (streamAvailable) {
        console.log('[MediaPipe] manual stream attached after camera.start');
        startManualFeed();
      }
    } else {
      stopManualFeed();
    }

    if (streamAvailable) {
      await ensureVideoIsPlaying();
    }
    logVideoStateIfChanged('camera.start');
    notifyVideoReady();
  }).catch(async (err) => {
    console.error('MediaPipe camera start failed', err);
    // fallback: try to manually request camera access to trigger permission prompt
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await acquireUserMediaStream(selfieMode, 'camera.start-error');
        if (stream) {
          console.log('Fallback stream acquired, feeding frames manually');
          startManualFeed();
          notifyVideoReady();
        }
      } catch (fallbackErr) {
        console.error('Fallback getUserMedia failed', fallbackErr);
      }
    }
  });

  window.camera = camera;
  window.cameraStartPromise = startPromise;
  return camera;
}

function resetVideoStateDebug() {
  videoLoggedReady = false;
  lastVideoStateLog.readyState = undefined;
  lastVideoStateLog.width = undefined;
  lastVideoStateLog.height = undefined;
  stopVideoDebugPolling();
  videoReadyCallbackFired = false;
}

async function acquireUserMediaStream(selfieMode, reason = 'manual') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('[MediaPipe] navigator.mediaDevices.getUserMedia is unavailable');
    return null;
  }

  const constraints = {
    video: {
      facingMode: selfieMode ? 'user' : 'environment',
      width: 640,
      height: 480
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    applyStreamToVideo(stream, reason);
    return stream;
  } catch (err) {
    console.error(`[MediaPipe] getUserMedia failed during ${reason}`, err);
    return null;
  }
}

function applyStreamToVideo(stream, reason = 'manual') {
  if (!videoElement) return;
  if (videoElement.srcObject !== stream) {
    videoElement.srcObject = stream;
  }
  if (!document.body.contains(videoElement)) {
    document.body.appendChild(videoElement);
    console.log('[MediaPipe] video element re-attached while applying stream');
  }
  window.videoElement = videoElement;
  reportVideoStreamStatus();
  logVideoStateIfChanged(`${reason}:apply`);
  startVideoDebugPolling(`${reason}:poll`);
  ensureVideoIsPlaying().then(() => {
    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      notifyVideoReady();
    }
  });
}

function hasActiveStream(element) {
  if (!element) return false;
  const stream = element.srcObject;
  if (!stream) return false;
  const tracks = typeof stream.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
  return tracks.some((track) => track.readyState === 'live');
}

function startVideoDebugPolling(label = 'poll') {
  stopVideoDebugPolling();
  if (!videoElement) return;
  videoPollInterval = setInterval(() => {
    if (!videoElement) {
      stopVideoDebugPolling();
      return;
    }
    const readyState = typeof videoElement.readyState === 'number' ? videoElement.readyState : -1;
    const width = videoElement.videoWidth || 0;
    const height = videoElement.videoHeight || 0;
    const hasSrcObject = Boolean(videoElement.srcObject);
    console.log(`[MediaPipe] video poll (${label})`, videoElement, {
      hasSrcObject,
      readyState,
      width,
      height
    });
    if (width > 0 && height > 0 && readyState >= HAVE_CURRENT_DATA) {
      stopVideoDebugPolling();
      logVideoStateIfChanged(`${label}:ready`);
      notifyVideoReady();
    }
  }, 200);
}

function stopVideoDebugPolling() {
  if (videoPollInterval) {
    clearInterval(videoPollInterval);
    videoPollInterval = null;
  }
}

function notifyVideoReady() {
  if (!videoElement) return;
  if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) return;
  if (!videoReadyCallbackFired) {
    videoReadyCallbackFired = true;
    tryResumeAudioContext();
    const callback = window.onVideoElementReady;
    if (typeof callback === 'function') {
      try {
        callback(videoElement);
      } catch (err) {
        console.error('[MediaPipe] onVideoElementReady callback failed', err);
      }
    }
    if (typeof window.dispatchEvent === 'function') {
      try {
        const event = new CustomEvent('mediapipe:video-ready', { detail: { video: videoElement } });
        window.dispatchEvent(event);
      } catch (err) {
        console.warn('[MediaPipe] dispatch video-ready event failed', err);
      }
    }
  }
}

function tryResumeAudioContext() {
  try {
    if (typeof getAudioContext === 'function') {
      const ctx = getAudioContext();
      if (ctx && typeof ctx.resume === 'function' && ctx.state !== 'running') {
        ctx.resume().catch((err) => {
          console.warn('[MediaPipe] AudioContext resume failed', err);
        });
      }
    }
  } catch (err) {
    console.warn('[MediaPipe] Unable to resume audio context', err);
  }
}

function detectKnock(handsLandmarks) {
  if (!handsLandmarks || handsLandmarks.length === 0) {
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const primaryHand = handsLandmarks[0];
  if (!primaryHand || primaryHand.length === 0) {
    return;
  }

  const avgZ = primaryHand.reduce((sum, landmark) => sum + (landmark.z || 0), 0) / primaryHand.length;

  if (knockState.lastDepth === null) {
    knockState.lastDepth = avgZ;
    knockState.lastTimestamp = now;
    return;
  }

  const dtMs = now - (knockState.lastTimestamp || now);
  if (dtMs <= 0) {
    knockState.lastDepth = avgZ;
    knockState.lastTimestamp = now;
    return;
  }

  const deltaZ = avgZ - knockState.lastDepth;
  if (dtMs < 16) {
    knockState.lastDepth = avgZ;
    knockState.lastTimestamp = now;
    return;
  }

  const velocity = deltaZ / (dtMs / 1000);
  const withinWindow = dtMs <= 300;

  if (
    now >= knockState.cooldownUntil &&
    deltaZ <= KNOCK_DELTA_THRESHOLD &&
    velocity <= KNOCK_SPEED_THRESHOLD &&
    withinWindow
  ) {
    knockState.cooldownUntil = now + KNOCK_COOLDOWN_MS;
    if (typeof onKnockDetected === 'function') {
      onKnockDetected();
    }
    console.log('[MediaPipe] knock detected', {
      avgZ,
      deltaZ,
      velocity: Number(velocity.toFixed(3)),
      dtMs: Math.round(dtMs)
    });
  }

  knockState.lastDepth = avgZ;
  knockState.lastTimestamp = now;
}

function resetKnockTracking() {
  knockState.lastDepth = null;
  knockState.lastTimestamp = 0;
  knockState.cooldownUntil = 0;
}

function attachVideoDebugListeners(element) {
  if (element.__debugListenersAttached) return;
  element.addEventListener('loadeddata', () => {
    logVideoStateIfChanged('loadeddata');
    ensureVideoIsPlaying();
  });
  element.addEventListener('playing', () => {
    logVideoStateIfChanged('playing');
  });
  element.__debugListenersAttached = true;
}

async function ensureVideoIsPlaying() {
  if (!videoElement) return false;
  if (videoElement.readyState >= HAVE_CURRENT_DATA && !videoElement.paused) return true;
  try {
    await videoElement.play();
    return true;
  } catch (err) {
    console.warn('Video play() rejected', err);
    return false;
  }
}

function reportVideoStreamStatus() {
  if (!videoElement) return;
  const readyState = typeof videoElement.readyState === 'number' ? videoElement.readyState : -1;
  const width = videoElement.videoWidth || 0;
  const height = videoElement.videoHeight || 0;
  const hasSrcObject = Boolean(videoElement.srcObject);
  const trackStates = hasSrcObject
    ? videoElement.srcObject.getVideoTracks().map((track) => `${track.label || 'track'}:${track.readyState}`)
    : [];
  console.log('[MediaPipe] video status', {
    appended: document.body.contains(videoElement),
    hasSrcObject,
    readyState,
    width,
    height,
    tracks: trackStates
  });
}

function logVideoStateIfChanged(source) {
  if (!videoElement) return;
  const readyState = typeof videoElement.readyState === 'number' ? videoElement.readyState : -1;
  const width = videoElement.videoWidth || 0;
  const height = videoElement.videoHeight || 0;
  const stateChanged =
    lastVideoStateLog.readyState !== readyState ||
    lastVideoStateLog.width !== width ||
    lastVideoStateLog.height !== height;
  if (stateChanged) {
    lastVideoStateLog.readyState = readyState;
    lastVideoStateLog.width = width;
    lastVideoStateLog.height = height;
    console.log(`[MediaPipe] video state (${source})`, {
      readyState,
      width,
      height
    });
  }
  if (!videoLoggedReady && readyState >= HAVE_CURRENT_DATA && width > 0 && height > 0) {
    videoLoggedReady = true;
    console.log('[MediaPipe] video ready for rendering', {
      readyState,
      width,
      height
    });
  }
}

function isVideoReady() {
  if (!videoElement) return false;
  const readyState = typeof videoElement.readyState === 'number' ? videoElement.readyState : 0;
  if (readyState < HAVE_CURRENT_DATA) return false;
  return videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
}

window.setupHands = setupHands;
window.setupVideo = setupVideo;
window.isVideoReady = isVideoReady;

window.MediaPipeBridge = {
  hands,
  setupHands,
  setupVideo,
  isVideoReady,
  get videoElement() {
    return videoElement;
  },
  get detections() {
    return detections;
  }
};

function autoStartHands() {
  if (window.__handsAutoStarted) return;
  window.__handsAutoStarted = true;

  try {
    setupHands();
    const cam = setupVideo();
    if (!cam) {
      console.warn('MediaPipe camera could not start – check Camera util availability.');
    }
  } catch (err) {
    console.error('Auto-start for MediaPipe Hands failed', err);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(autoStartHands, 0);
} else {
  document.addEventListener('DOMContentLoaded', autoStartHands, { once: true });
}
