// =====================================================
// MAIN.JS — Sleeping Card Final Build (Knock Scene Ready)
// =====================================================

// ---------------------------
// GLOBAL CONSTANTS
// ---------------------------
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const BG_COLOR = [0, 60, 100];
const OVERLAY_COLOR = [0, 60, 100, 180];
const SPLASH_FADE_STEP = 4;
const TRANSITION_DURATION = 1500; // 1.5s
const MEDIA_READY_THRESHOLD = (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.HAVE_CURRENT_DATA) || 2;

// ---------------------------
// STATE VARIABLES
// ---------------------------
let viewportScale = 1, viewportOffsetX = 0, viewportOffsetY = 0;
let splashCard, splashTitle, splashSnoreSound, splashFade = 0, splashAudioReady = false;
let backgroundSound;
let messageImg;
let videoReady = false;
let videoWasReady = false;
let dodoImgs = {};
let gaugeValue = 1.0; // 1 = 100%, 0 = empty
let handDetected = false;
let currentScene = "splash";
let transitioning = false;
let transitionStart = 0;

// =====================================================
// HAND DETECTION BRIDGE (called by MediaPipeHands.js)
// =====================================================
function setHandPresent(isDetected) {
  if (handDetected !== isDetected) {
    handDetected = isDetected;
    console.log("handDetected =", handDetected);

    // When first hand appears → start transition
    if (handDetected && currentScene === "splash") {
      startTransitionToKnock();
    }
  }
}

// For gesture-driven knock detection (will be called from MediaPipe)
function onKnockDetected() {
  decreaseGauge();
}

// TEMPORARY: simulate knock gesture with key "K"
function keyPressed() {
  if (key === "K") {
    decreaseGauge();
  }
}

// =====================================================
// PRELOAD
// =====================================================
function preload() {
  preloadSplash();
  preloadKnockAssets();
}

function preloadSplash() {
  splashCard = loadImage('splash/images/card_sleep.png');
  splashTitle = loadImage('splash/images/title.png');
  soundFormats('wav');
  splashSnoreSound = loadSound('splash/sounds/snore.wav');
}

function preloadKnockAssets() {
  messageImg = loadImage('part1_knock/images/narr1-8.png');
  dodoImgs[100] = loadImage('part1_knock/images/dodo1-8.png');
  dodoImgs[75] = loadImage('part1_knock/images/dodo2-8.png');
  dodoImgs[50] = loadImage('part1_knock/images/dodo3-8.png');
  dodoImgs[0] = loadImage('part1_knock/images/dodo4-8.png');
  backgroundSound = loadSound('assets/music/background.wav');
}

// =====================================================
// SETUP
// =====================================================
function setup() {
  if (typeof userStartAudio === "function") {
    const audioUnlock = userStartAudio();
    if (audioUnlock && typeof audioUnlock.catch === "function") {
      audioUnlock.catch((err) => console.warn("userStartAudio failed", err));
    }
  }

  createCanvas(windowWidth, windowHeight);
  calcViewport();
  showSplash();

  const ctx = getAudioContext();
  if (ctx && ctx.state !== 'running') ctx.resume();
}

// =====================================================
// DRAW LOOP
// =====================================================
function draw() {
  background(...BG_COLOR);

  const videoPhase = transitioning ? "transition" : currentScene;
  if (videoPhase === "transition" || videoPhase === "knock") {
    updateVideoReady(videoPhase);
  } else if (videoReady || videoWasReady) {
    videoReady = false;
    videoWasReady = false;
  }

  if (transitioning) {
    updateTransition();
  } else if (currentScene === "splash") {
    ensureSnoreLoop();
    push();
    translate(viewportOffsetX, viewportOffsetY);
    scale(viewportScale);
    drawSplash();
    pop();
  } else if (currentScene === "knock") {
    drawKnockScene();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calcViewport();
}

// =====================================================
// SPLASH SCENE
// =====================================================
function drawSplash() {
  if (splashFade < 255) splashFade = min(255, splashFade + SPLASH_FADE_STEP);

  // 1️⃣ Card
  if (splashCard) {
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * (splashCard.width / splashCard.height);
    push();
    imageMode(CENTER);
    tint(255, splashFade);
    image(splashCard, DESIGN_W / 2, DESIGN_H / 2, cardW, cardH);
    pop();
  }

  // 2️⃣ Overlay
  noStroke();
  fill(...OVERLAY_COLOR);
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  // 3️⃣ Title
  if (splashTitle) {
    const titleScale = max(DESIGN_W / splashTitle.width, DESIGN_H / splashTitle.height);
    const titleW = splashTitle.width * titleScale;
    const titleH = splashTitle.height * titleScale;
    push();
    imageMode(CENTER);
    tint(255, splashFade);
    image(splashTitle, DESIGN_W / 2, DESIGN_H / 2, titleW, titleH);
    pop();
  }
}

function showSplash() {
  splashFade = 0;
  splashAudioReady = false;

  if (!splashSnoreSound.isPlaying()) splashSnoreSound.loop();
}

function ensureSnoreLoop() {
  if (!splashSnoreSound.isPlaying()) splashSnoreSound.loop();
}

// =====================================================
// TRANSITION (Splash → Knock)
// =====================================================
function startTransitionToKnock() {
  if (!transitioning && currentScene === "splash") {
    transitioning = true;
    transitionStart = millis();
    splashSnoreSound.stop();
    console.log("🌀 Transition to knock started!");
  }
}

function updateTransition() {
  const elapsed = millis() - transitionStart;
  const t = constrain(elapsed / TRANSITION_DURATION, 0, 1);

  const splashOpacity = map(t, 0, 1, 255, 0);
  const blurAmt = 20 * t;
  const cardX = lerp(DESIGN_W / 2, DESIGN_W * 0.35, t);
  const cardY = DESIGN_H / 2;
  const rightX = lerp(DESIGN_W * 1.2, DESIGN_W * 0.75, t);
  const rightOpacity = map(t, 0, 1, 0, 255);

  drawTransitionScene(cardX, cardY, splashOpacity, blurAmt, rightX, rightOpacity);

  if (t >= 1) {
    transitioning = false;
    currentScene = "knock";
    backgroundSound.loop();
    console.log("✅ Transition complete → Knock scene");
  }
}

function drawTransitionScene(cardX, cardY, splashOpacity, blurAmt, rightX, rightOpacity) {
  push();
  imageMode(CENTER);
  background(...BG_COLOR);

  // Card left
  if (splashCard) {
    drawingContext.filter = `blur(${blurAmt}px)`;
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * (splashCard.width / splashCard.height);
    tint(255, splashOpacity);
    image(splashCard, cardX, cardY, cardW, cardH);
    drawingContext.filter = 'none';
  }

  // Right group (message + video + gauge)
  push();
  translate(rightX, DESIGN_H / 2);
  tint(255, rightOpacity);

  if (messageImg) {
    const msgW = DESIGN_W * 0.4;
    const msgH = msgW * (messageImg.height / messageImg.width);
    image(messageImg, 0, -DESIGN_H * 0.3, msgW, msgH);
  }

  if (videoReady && videoElement) {
    const vidW = DESIGN_W * 0.25;
    const vidH = vidW * (videoElement.videoHeight / videoElement.videoWidth);
    image(videoElement, 0, 0, vidW, vidH);
  }

  drawGauge(0, DESIGN_H * 0.25, rightOpacity);

  pop();
  pop();
}

// =====================================================
// KNOCK SCENE
// =====================================================
function drawKnockScene() {
  push();
  translate(viewportOffsetX, viewportOffsetY);
  scale(viewportScale);
  background(...BG_COLOR);

  // Left card (changes with gauge)
  const level = gaugeValue >= 0.75 ? 100 : gaugeValue >= 0.5 ? 75 : gaugeValue >= 0.25 ? 50 : 0;
  const img = dodoImgs[level];
  if (img) {
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * (img.width / img.height);
    imageMode(CENTER);
    image(img, DESIGN_W * 0.35, DESIGN_H / 2, cardW, cardH);
  }

  // Right group
  translate(DESIGN_W * 0.75, DESIGN_H / 2);
  if (messageImg) {
    const msgW = DESIGN_W * 0.4;
    const msgH = msgW * (messageImg.height / messageImg.width);
    image(messageImg, 0, -DESIGN_H * 0.3, msgW, msgH);
  }

  if (videoReady && videoElement) {
    const vidW = DESIGN_W * 0.25;
    const vidH = vidW * (videoElement.videoHeight / videoElement.videoWidth);
    image(videoElement, 0, 0, vidW, vidH);
  }

  drawGauge(0, DESIGN_H * 0.25, 255);
  pop();
}

// =====================================================
// GAUGE LOGIC
// =====================================================
function drawGauge(x, y, opacity = 255) {
  const gaugeW = DESIGN_W * 0.25;
  const gaugeH = 25;
  noStroke();
  fill(255, 255, 255, opacity * 0.3);
  rectMode(CENTER);
  rect(x, y, gaugeW, gaugeH, 10);
  fill(255, 140, 0, opacity);
  rectMode(CORNER);
  rect(x - gaugeW / 2, y - gaugeH / 2, gaugeW * gaugeValue, gaugeH, 10);
}

function decreaseGauge() {
  gaugeValue = max(0, gaugeValue - 0.25);
  console.log("Gauge:", gaugeValue);
  if (gaugeValue <= 0) console.log("🎉 Card is awake!");
}

// =====================================================
// VIEWPORT UTILS
// =====================================================
function calcViewport() {
  const scaleX = width / DESIGN_W;
  const scaleY = height / DESIGN_H;
  viewportScale = min(scaleX, scaleY);
  const viewW = DESIGN_W * viewportScale;
  const viewH = DESIGN_H * viewportScale;
  viewportOffsetX = (width - viewW) * 0.5;
  viewportOffsetY = (height - viewH) * 0.5;
}

function canDrawVideo(element) {
  if (!element) return false;
  const readyState = typeof element.readyState === 'number' ? element.readyState : 0;
  if (readyState < MEDIA_READY_THRESHOLD) return false;
  return element.videoWidth > 0 && element.videoHeight > 0;
}

function updateVideoReady(label) {
  const canRender = canDrawVideo(videoElement);
  const readyState = videoElement ? videoElement.readyState : -1;
  const width = videoElement ? videoElement.videoWidth : 0;
  const height = videoElement ? videoElement.videoHeight : 0;

  if (canRender && !videoWasReady) {
    console.log(`[p5] video ready (${label})`, { readyState, width, height });
  } else if (!canRender && videoWasReady) {
    console.warn(`[p5] video unavailable (${label})`, { readyState, width, height });
  }

  videoReady = canRender;
  videoWasReady = canRender;
  return canRender;
}
