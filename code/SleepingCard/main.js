// =====================================================
// MAIN.JS — Version stable (gauge OK, knock OK)
// =====================================================

// ---------------------------
// GLOBAL CONSTANTS
// ---------------------------
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const BG_COLOR = [0, 60, 100];
const OVERLAY_COLOR = [0, 60, 100, 180];
const SPLASH_FADE_STEP = 4;
const TRANSITION_DURATION = 1500;
const VIDEO_CORNER_RADIUS = 36;

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

let currentScene = "splash";  
let transitioning = false;
let transitionStart = 0;

// =====================================================
// KNOCK → gauge down
// =====================================================
function decreaseGauge() {
  gaugeValue = Math.max(0, gaugeValue - 0.15);
  console.log("gaugeValue =", gaugeValue);
}

// Called by MediaPipeHands.js
function onKnockDetected() {
  decreaseGauge();
}

// =====================================================
// VIDEO READY
// =====================================================
function waitForVideoToBeReady(callback) {
  let tries = 0;
  const check = () => {
    if (isVideoReady && isVideoReady()) {
      return callback();
    }
    tries++;
    if (tries < 50) setTimeout(check, 120);
    else callback();
  };
  check();
}

// =====================================================
// HAND PRESENCE
// =====================================================
function setHandPresent(isDetected) {
  if (handDetected !== isDetected) {
    handDetected = isDetected;
    if (handDetected && currentScene === "splash") {
      waitForVideoToBeReady(startTransitionToKnock);
    }
  }
}

// =====================================================
// PRELOAD
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
// DRAW LOOP
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
// SPLASH
// =====================================================
function drawSplash() {
  splashFade = min(255, splashFade + SPLASH_FADE_STEP);

  if (splashCard) {
    const cardH = DESIGN_H * 1.15;
    const cardW = cardH * (splashCard.width / splashCard.height);
    imageMode(CENTER);
    tint(255, splashFade);
    image(splashCard, DESIGN_W / 2, DESIGN_H / 2, cardW, cardH);
  }

  noStroke();
  fill(...OVERLAY_COLOR);
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  if (splashTitle) {
    const tScale = Math.max(
      DESIGN_W / splashTitle.width,
      DESIGN_H / splashTitle.height
    );
    image(splashTitle, DESIGN_W / 2, DESIGN_H / 2, splashTitle.width * tScale, splashTitle.height * tScale);
  }
}

function showSplash() {
  splashFade = 0;
  if (!splashSnoreSound.isPlaying()) splashSnoreSound.loop();
}

// =====================================================
// TRANSITION SPLASH → KNOCK
// =====================================================
function startTransitionToKnock() {
  if (transitioning) return;
  transitioning = true;
  transitionStart = millis();
  currentScene = "transition";

  splashSnoreSound.stop();
}

function updateTransition() {
  const t = constrain((millis() - transitionStart) / TRANSITION_DURATION, 0, 1);
  const eased = t * t * (3 - 2 * t);

  background(...BG_COLOR);

  push();
  translate(viewportOffsetX, viewportOffsetY);
  scale(viewportScale);

  const cardH = DESIGN_H * 1.15;
  const cardW = cardH * (splashCard.width / splashCard.height);
  const cardX = lerp(DESIGN_W / 2, DESIGN_W * 0.30, eased);
  imageMode(CENTER);
  image(splashCard, cardX, DESIGN_H / 2, cardW, cardH);

  const rightX = lerp(DESIGN_W * 1.2, DESIGN_W * 0.75, eased);
  push();
  translate(rightX, DESIGN_H / 2);
  drawingContext.globalAlpha = eased;
  drawRightColumn();
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
  const level =
    gaugeValue >= 0.75 ? 100 :
    gaugeValue >= 0.50 ? 75 :
    gaugeValue >= 0.25 ? 50 : 0;

  const img = dodoImgs[level];
  const cardH = DESIGN_H * 1.15;
  const cardW = cardH * (img.width / img.height);

  imageMode(CENTER);
  image(img, DESIGN_W * 0.30, DESIGN_H / 2, cardW, cardH);

  push();
  translate(DESIGN_W * 0.75, DESIGN_H / 2);
  drawRightColumn();
  pop();
}

// =====================================================
// RIGHT COLUMN
// =====================================================
function drawRightColumn() {
  const colW = DESIGN_W * 0.44;
  const colH = DESIGN_H * 0.68;

  fill(0, 40, 80, 190);
  rectMode(CENTER);
  rect(0, 0, colW, colH, 40);

  // Message
  const maxW = colW * 0.96;
  const maxH = colH * 0.45;
  let msgW = maxW;
  let msgH = msgW * (messageImg.height / messageImg.width);
  if (msgH > maxH) {
    msgH = maxH;
    msgW = msgH * (messageImg.width / messageImg.height);
  }
  image(messageImg, 0, -colH * 0.33, msgW, msgH);

  // Video
  const vid = getReadyVideo();
  const areaH = colH * 0.58;
  const areaW = colW * 0.94;
  const ratio = vid.videoWidth / vid.videoHeight;

  let w = areaW;
  let h = w / ratio;
  if (h > areaH) {
    h = areaH;
    w = h * ratio;
  }

  push();
  translate(0, -colH * 0.01);
  drawingContext.save();
  drawingContext.clip();
  drawingContext.drawImage(vid, -w / 2, -h / 2, w, h);
  drawingContext.restore();
  pop();

  // Gauge
  const gaugeY = colH * 0.28;
  drawGauge(0, gaugeY);
}

// =====================================================
// GAUGE
// =====================================================
function drawGauge(x, y) {
  const gaugeW = DESIGN_W * 0.25;
  const gaugeH = 26;

  fill(255, 255, 255, 60);
  rect(x, y, gaugeW, gaugeH, 12);

  const fillW = gaugeW * gaugeValue;
  fill(255, 140, 0);
  rect(x - (gaugeW - fillW) / 2, y, fillW, gaugeH - 4, 10);
}

// =====================================================
// VIDEO READY
// =====================================================
function getReadyVideo() {
  const vid = window.videoElement;
  if (!vid) return null;
  if (!isVideoReady()) return null;
  return vid;
}

// =====================================================
// VIEWPORT
// =====================================================
function calcViewport() {
  const kx = width / DESIGN_W;
  const ky = height / DESIGN_H;
  viewportScale = Math.min(kx, ky);
  viewportOffsetX = (width - DESIGN_W * viewportScale) / 2;
  viewportOffsetY = (height - DESIGN_H * viewportScale) / 2;
}
