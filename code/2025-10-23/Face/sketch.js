// the blendshapes we are going to track
let leftEyeBlink = 0.0;
let rightEyeBlink = 0.0;
let jawOpen = 0.0;
// treat camera as mirrored horizontally; set to false if your video is not flipped
let videoMirrored = true;

// new: blink / background state
let prevLeftBlink = 0;
let prevRightBlink = 0;
let blinkThreshold = 0.65;
let bgCurrent = [34, 139, 34]; // starting green
let bgTarget = bgCurrent.slice();

// added: fixed palette and nextBg() so blink handling won't throw
let bgPalette = [
  [34, 139, 34],
  [70, 130, 180],
  [255, 165, 0],
  [199, 21, 133],
  [255, 215, 0],
  [123, 104, 238]
];
let bgIndex = 0;
function nextBg() {
  bgIndex = (bgIndex + 1) % bgPalette.length;
  bgTarget = bgPalette[bgIndex].slice();
}

// audio (Web Audio beep for eat events)
let audioCtx = null;
function playBeep(type = 'good') {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  // different tones for good / bad
  o.type = 'sine';
  o.frequency.value = type === 'good' ? 1200 : 220;
  g.gain.value = 0;
  o.connect(g);
  g.connect(audioCtx.destination);
  const dur = 0.09;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.start(now);
  o.stop(now + dur + 0.02);
}

// game state
let animalX = 200;
let animalY = 200;
let animalScale = 1;
let mouthOpen = false;
let items = []; // items: {x,y,vy,size,type,subtype,eaten}
let spawnTimer = 0;
let score = 0;
let lives = 3;

function setup() {
  createCanvas(windowWidth, windowHeight);
  setupFace();
  setupVideo();
  textAlign(LEFT, CENTER);
  rectMode(CENTER);
  ellipseMode(CENTER);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function getVideoSize() {
  // try to get actual video pixel size; fall back to element size or canvas
  let vw = (videoElement && (videoElement.videoWidth || videoElement.width)) || width;
  let vh = (videoElement && (videoElement.videoHeight || videoElement.height)) || height;
  return { vw, vh, vx: 0, vy: 0 };
}

function spawnItem(videoW) {
  // cap active items so it doesn't flood
  if (items.length >= 6) return;
  let size = max(10, (videoW || 80) * random(0.05, 0.10));
  let x = random(size, max(size + 1, videoW - size));
  let type = random() < 0.7 ? 'food' : 'trash';
  // store a stable subtype for food so the appearance doesn't flicker each frame
  let subtype = null;
  if (type === 'food') subtype = (random() < 0.7) ? 'kibble' : 'bone';
  items.push({ x, y: -size - random(0, 40), vy: random(0.5, 1.5), size, type, subtype, eaten: false });
}

// new helpers to draw nicer food and trash
function drawKibble(cx, cy, s) {
  push(); translate(cx, cy); noStroke();
  fill(190, 125, 30); ellipse(0, 0, s * 0.9, s * 0.7);
  fill(230, 180, 60); ellipse(-s * 0.08, -s * 0.06, s * 0.2, s * 0.14);
  pop();
}

function drawBone(cx, cy, s) {
  push(); translate(cx, cy); noStroke();
  fill(240); rect(0, 0, s * 0.9, s * 0.28, s * 0.1);
  ellipse(-s * 0.48, 0, s * 0.48, s * 0.48); ellipse(s * 0.48, 0, s * 0.48, s * 0.48);
  pop();
}

function drawTrashShape(cx, cy, s) {
  push(); translate(cx, cy);
  fill(170); stroke(120); strokeWeight(1);
  rect(0, 0, s * 1.1, s * 0.8, 6);
  noStroke();
  // draw the label using Comic Sans
  textFont('Comic Sans MS');
  fill(140, 120);
  textSize(max(8, s * 0.25));
  textAlign(CENTER, CENTER);
  text('rubbish', 0, 0);
  pop();
}

function drawDog(x, y, faceW, jaw) {
  // simple dog head centered at (x,y) with mouth open by jaw
  push();
  translate(x, y);
  // compute a capped scale so the dog never becomes huge and hides the player.
  // faceW is the available video width; scale relative to a larger reference to keep dog modest.
  let target = (faceW || 160);
  // scale = target / referenceWidth, then constrain to a reasonable range
  let s = constrain(target / 400, 0.35, 0.85);
  scale(s);
  // body/neck
  fill(200, 160, 120);
  noStroke();
  ellipse(0, 30, 200, 100);
  // head
  ellipse(0, -10, 160, 140);
  // ears
  fill(140, 90, 60);
  ellipse(-60, -40, 40, 60);
  ellipse(60, -40, 40, 60);
  // eyes
  fill(0);
  ellipse(-30, -20, 14, 14);
  ellipse(30, -20, 14, 14);
  // nose
  fill(40, 20, 10);
  ellipse(0, 0, 18, 12);
  // mouth - open based on jaw
  let mouthH = map(jaw, 0, 1, 8, 70);
  fill(120, 10, 10);
  rect(0, 30, 120, mouthH, 16);
  pop();
}

function draw() {
  // update blink-based background (draw background first so camera image stays visible)
  let { vw, vh, vx, vy } = getVideoSize();

  // grab blink blendshapes (left + right) for detection and debug
  leftEyeBlink = getBlendshapeScore('eyeBlinkLeft');
  rightEyeBlink = getBlendshapeScore('eyeBlinkRight');
  // on blink onset (crossing threshold) advance to next palette color and keep it
  if (leftEyeBlink > blinkThreshold && prevLeftBlink <= blinkThreshold) nextBg();
  if (rightEyeBlink > blinkThreshold && prevRightBlink <= blinkThreshold) nextBg();
  prevLeftBlink = leftEyeBlink;
  prevRightBlink = rightEyeBlink;

  // smoothly lerp current background toward target (keeps transition smooth)
  for (let i = 0; i < 3; i++) bgCurrent[i] = lerp(bgCurrent[i], bgTarget[i], 0.12);
  background(bgCurrent[0], bgCurrent[1], bgCurrent[2]);

  // draw video on top of the background so camera image remains visible
  if (isVideoReady()) image(videoElement, vx, vy);

  // --- new: face detection to move dog horizontally ---
  let faces = getFaceLandmarks();
  if (faces && faces.length > 0) {
    // compute face center (supports {x,y} and [x,y], normalized or pixel coords)
    let lm = faces[0];
    let cx = 0, cy = 0, count = 0;
    let minX = Infinity, maxX = -Infinity;
    for (let p of lm) {
      let px = (p.x !== undefined) ? p.x : p[0];
      let py = (p.y !== undefined) ? p.y : p[1];
      if (px == null || py == null) continue;
      // if normalized (0..1) convert to video pixels
      if (px <= 1 && vw > 1) px *= vw;
      if (py <= 1 && vh > 1) py *= vh;
      // if the camera image is mirrored, flip the x coordinate so movement matches user
      if (videoMirrored) px = vw - px;
      cx += px; cy += py; count++;
      minX = min(minX, px); maxX = max(maxX, px);
    }
    if (count > 0) {
      cx /= count; cy /= count;
    } else {
      cx = vw / 2; cy = vh / 2;
    }
    // target world x (video origin vx + cx)
    let targetX = vx + cx;
    // clamp so the dog can reach the very edges of the video but stays inside by a tiny margin
    targetX = constrain(targetX, vx + 8, vx + vw - 8);
    // smooth horizontal follow; keep dog near bottom of video
    animalX = lerp(animalX, targetX, 0.18);
  } else {
    // no face -> slowly return to center
    let centerX = vx + vw / 2;
    animalX = lerp(animalX, centerX, 0.03);
  }

  // decide mouthOpen using jawOpen
  jawOpen = getBlendshapeScore('jawOpen');
  let openThreshold = 0.35;
  mouthOpen = jawOpen > openThreshold;

  // position dog vertical: keep fixed near bottom of video
  animalY = vy + vh - max(40, vh * 0.12);

  // spawn items inside video width only (slower)
  spawnTimer++;
  let spawnInterval = 90;
  if (spawnTimer > spawnInterval) { spawnTimer = 0; spawnItem(vw); }

  // update and draw items (relative to video origin vx,vy)
  for (let it of items) {
    if (it.eaten) continue;
    it.vy += 0.04;
    it.y += it.vy;

    let worldX = vx + it.x;
    let worldY = vy + it.y;

    // draw items with better visuals
    push();
    if (it.type === 'food') {
      // use stored subtype so it doesn't flicker between shapes
      if (it.subtype === 'kibble') drawKibble(worldX, worldY, it.size);
      else drawBone(worldX, worldY, it.size);
    } else {
      drawTrashShape(worldX, worldY, it.size);
    }
    pop();

    // mouth rectangle in world coords (approx) under the video
    let mouthW = vw * 0.35;
    let mouthH = map(jawOpen, 0, 1, 12, 80);
    let mouthX = animalX;
    let mouthY = animalY + (vh * 0.06); // slightly below dog center

    // check eat: if mouth open and item inside mouth area
    if (mouthOpen) {
      let dx = worldX - mouthX;
      let dy = worldY - mouthY;
      if (abs(dx) < mouthW * 0.5 && abs(dy) < mouthH * 0.6) {
        it.eaten = true;
        if (it.type === 'food') {
          score += 1;
          playBeep('good');
        }
        else {
          score -= 2;
          playBeep('bad');
        }
      }
    }

    // item missed
    if (worldY - it.size / 2 > vy + vh + 40 && !it.eaten) {
      // just remove missed items, no penalty / no game over
      it.eaten = true;
    }
  }

  // remove consumed items
  items = items.filter(it => !it.eaten);

  // draw dog last so it appears above items
  // use a reduced faceW when drawing so the dog stays centered but smaller
  drawDog(animalX, animalY, vw * 0.5, jawOpen);

  // HUD (draw outside video) — no lives anymore
  fill(255);
  textSize(20);
  text('Score: ' + score, 10, height - 30);
}

// allow restart
function keyPressed() {
  if (key === 'r' || key === 'R') {
    score = 0;
    items = [];
  }
}
