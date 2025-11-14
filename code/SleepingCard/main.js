// =====================================================
// MAIN.JS — Sleeping Card (FINAL PART 1)
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

// ---------------------------
// STATE
// ---------------------------
let viewportScale = 1, viewportOffsetX = 0, viewportOffsetY = 0;

let splashCard, splashTitle, splashSnoreSound;
let splashFade = 0;

let backgroundSound;
let messageImg;
let dodoImgs = {};

let gaugeValue = 1.0; 
let handDetected = false;

let currentScene = "splash";  // splash → transition → knock
let transitioning = false;
let transitionStart = 0;

function decreaseGauge(step = 0.12) {
  gaugeValue = Math.max(0, gaugeValue - step);
}

// =====================================================
// WAIT FOR VIDEO READY (safe)
// =====================================================
function waitForVideoToBeReady(callback) {
  let tries = 0;
  const check = () => {
    if (isVideoReady && isVideoReady()) {
      console.log("🎥 Camera ready");
      return callback();
    }
    tries++;
    if (tries < 50) setTimeout(check, 120);
    else callback(); 
  };
  check();
}

// =====================================================
// HAND BRIDGE (from MediaPipeHands.js)
// =====================================================
function setHandPresent(isDetected) {
  if (handDetected !== isDetected) {
    handDetected = isDetected;

    if (handDetected && currentScene === "splash") {
      waitForVideoToBeReady(startTransitionToKnock);
    }
  }
}

function onKnockDetected() {
  decreaseGauge();
}

// =====================================================
// PRELOAD ASSETS
// =====================================================
function preload() {
  splashCard = loadImage("splash/images/card_sleep.png");
  splashTitle = loadImage("splash/images/title.png");

  soundFormats("wav");
  splashSnoreSound = loadSound("splash/sounds/snore.wav");
  backgroundSound = loadSound("assets/music/background.wav");

  messageImg = loadImage("part1_knock/images/narr1-8.png");
  dodoImgs[100] = loadImage("part1_knock/images/dodo1-8.png");
  dodoImgs[75]  = loadImage("part1_knock/images/dodo2-8.png");
  dodoImgs[50]  = loadImage("part1_knock/images/dodo3-8.png");
  dodoImgs[0]   = loadImage("part1_knock/images/dodo4-8.png");
}

// =====================================================
// SETUP
// =====================================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  calcViewport();
  showSplash();

  let ctx = getAudioContext();
  if (ctx.state !== "running") ctx.resume();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calcViewport();
}

// =====================================================
// MAIN DRAW LOOP
// =====================================================
function draw() {
  background(...BG_COLOR);

  if (transitioning) {
    updateTransition();
    return;
  }

  push();
  translate(viewportOffsetX, viewportOffsetY);
  scale(viewportScale);

  if (currentScene === "splash") drawSplash();
  else if (currentScene === "knock") drawKnockScene();

  pop();
}

// =====================================================
// SPLASH SCENE
// =====================================================
function drawSplash() {
  splashFade = min(255, splashFade + SPLASH_FADE_STEP);

  // CARD
  if (splashCard) {
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * ((splashCard.width || 1) / (splashCard.height || 1));
    imageMode(CENTER);
    tint(255, splashFade);
    image(splashCard, DESIGN_W / 2, DESIGN_H / 2, cardW, cardH);
  }

  // DARK OVERLAY
  noStroke();
  fill(...OVERLAY_COLOR);
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  // TITLE
  if (splashTitle) {
    const titleScale = Math.max(
      DESIGN_W / (splashTitle.width || 1),
      DESIGN_H / (splashTitle.height || 1)
    );
    const titleW = (splashTitle.width || 1) * titleScale;
    const titleH = (splashTitle.height || 1) * titleScale;
    tint(255, splashFade);
    image(splashTitle, DESIGN_W / 2, DESIGN_H / 2, titleW, titleH);
  }

  if (!splashCard || !splashTitle) {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(32);
    text("Loading…", DESIGN_W / 2, DESIGN_H * 0.85);
  }
}

function showSplash() {
  splashFade = 0;
  if (!splashSnoreSound.isPlaying()) splashSnoreSound.loop();
}

// =====================================================
// TRANSITION (SPLASH → KNOCK)
// =====================================================
function startTransitionToKnock() {
  if (transitioning) return;
  transitioning = true;
  transitionStart = millis();
  currentScene = "transition";

  splashSnoreSound.stop();
}

function updateTransition() {
  const elapsed = millis() - transitionStart;
  const t = constrain(elapsed / TRANSITION_DURATION, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const fadeOut = 1 - eased;

  background(...BG_COLOR);

  push();
  translate(viewportOffsetX, viewportOffsetY);
  scale(viewportScale);

  const cardH = DESIGN_H * 1.15;
  if (splashCard) {
    const cardW = cardH * ((splashCard.width || 1) / (splashCard.height || 1));
    const cardX = lerp(DESIGN_W / 2, DESIGN_W * 0.30, eased);
    tint(255, 255);
    imageMode(CENTER);
    image(splashCard, cardX, DESIGN_H / 2, cardW, cardH);
  }

  noStroke();
  const overlayAlpha = (OVERLAY_COLOR[3] || 0) * fadeOut;
  fill(OVERLAY_COLOR[0], OVERLAY_COLOR[1], OVERLAY_COLOR[2], overlayAlpha);
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  // Splash title fades away while the card slides
  if (splashTitle) {
    const titleScale = Math.max(
      DESIGN_W / (splashTitle.width || 1),
      DESIGN_H / (splashTitle.height || 1)
    );
    const titleW = (splashTitle.width || 1) * titleScale;
    const titleH = (splashTitle.height || 1) * titleScale;
    tint(255, 255 * fadeOut);
    image(splashTitle, DESIGN_W / 2, DESIGN_H / 2, titleW, titleH);
    tint(255, 255);
  }

  const rightX = lerp(DESIGN_W * 1.2, DESIGN_W * 0.75, eased);

  push();
  translate(rightX, DESIGN_H / 2);
  drawingContext.save();
  drawingContext.globalAlpha = eased;
  drawRightColumn();
  drawingContext.restore();
  pop();

  pop();

  if (t >= 1) {
    transitioning = false;
    currentScene = "knock";
    if (!backgroundSound.isPlaying()) backgroundSound.loop();
  }
}

// =====================================================
// KNOCK SCENE
// =====================================================
function drawKnockScene() {
  // Determine correct sleep level image
  const level =
    gaugeValue >= 0.75 ? 100 :
    gaugeValue >= 0.50 ? 75 :
    gaugeValue >= 0.25 ? 50 :
    0;

  const img = dodoImgs[level];
  if (img && img.width && img.height) {
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * (img.width / img.height);

    // LEFT CARD
    imageMode(CENTER);
    image(img, DESIGN_W * 0.30, DESIGN_H / 2, cardW, cardH);
  }

  // RIGHT COLUMN
  push();
  translate(DESIGN_W * 0.75, DESIGN_H / 2);
  drawRightColumn();
  pop();
}

// =====================================================
// RIGHT COLUMN LAYOUT
// =====================================================
function drawRightColumn() {
  const colW = DESIGN_W * 0.44;
  const colH = DESIGN_H * 0.68;
  const cornerR = 40;

  // PANEL
  noStroke();
  fill(0, 40, 80, 190);
  rectMode(CENTER);
  rect(0, 0, colW, colH, cornerR);

  // MESSAGE
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

  // VIDEO
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

  // GAUGE
  const gaugeY = videoCenterY + areaH / 2 + colH * 0.08;
  drawGauge(0, gaugeY, 255);
}

// =====================================================
// GAUGE
// =====================================================
function drawGauge(x, y, opacity = 255) {
  const gaugeW = DESIGN_W * 0.25;
  const gaugeH = 26;

  noStroke();
  fill(255,255,255, opacity * 0.25);
  rect(x, y, gaugeW, gaugeH, 14);

  const fillW = gaugeW * gaugeValue;
  fill(255,140,0, opacity);
  rect(x - (gaugeW-fillW)/2, y, fillW, gaugeH-4, 12);
}

// =====================================================
// VIDEO SAFE WRAPPER
// =====================================================
function getReadyVideo() {
  const vid = window.videoElement;
  if (!vid) return null;
  if (!(vid instanceof HTMLVideoElement)) return null;
  if (typeof isVideoReady === "function" && !isVideoReady()) return null;
  if (vid.videoWidth <= 0 || vid.videoHeight <= 0) return null;

  return vid;
}


// =====================================================
// VIEWPORT (NO DEFORMATION EVER)
// =====================================================
function calcViewport() {
  const kx = width / DESIGN_W;
  const ky = height / DESIGN_H;
  viewportScale = Math.min(kx, ky);

  viewportOffsetX = (width - DESIGN_W * viewportScale) / 2;
  viewportOffsetY = (height - DESIGN_H * viewportScale) / 2;
}
