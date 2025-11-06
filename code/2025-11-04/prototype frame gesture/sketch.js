let IMAGE_X = 0;
let IMAGE_Y = 0;
let IMAGE_W = 0;
let IMAGE_H = 0;

// gauge: percentage (1 = full -> 0 = empty) and config
let GAUGE_PCT = 1.0;
const GAUGE_EMPTY_MS = 30000; // time to empty in milliseconds (30s)
const GAUGE_MIN_H = 8;
const GAUGE_MAX_H = 28;
const GAUGE_COLOR = [255, 140, 0];

// --- added globals for images and gesture-edge detection ---
let gaugeImages = {};
let currentGaugeImage = null;
let prevFinalMatch = false;
const GAUGE_STEPS = [1.0, 0.75, 0.5, 0.25, 0.0];

let sound1;
let soundStarted = false; // <-- added flag

// simple percent config (0..1)
const IMAGE_SCALE_PCT = 0.8;
const IMAGE_CENTER_PCT = { x: -2.9, y: -1.7 }; // center of canvas






// preload images for gauge states
function preload() {
  // load images from images/ as requested
  gaugeImages['0'] = loadImage('images/0 neutre.png');
  gaugeImages['25'] = loadImage('images/25.png');
  gaugeImages['50'] = loadImage('images/50.png');
  gaugeImages['75'] = loadImage('images/75.png');
  gaugeImages['100'] = loadImage('images/100.png');
  sound1 = loadSound('sound/sound_6_nov_bg.wav',
    () => { console.log('sound loaded'); },
    (err) => { console.error('sound load error:', err); }
  );
}
function mousePressed() {
  setTimeout(() => {
    // Start muted autoplay (allowed in Chrome)
    sound1.setVolume(0);
    sound1.loop(); // or .play()
    console.log('Autoplay started (muted)');

    // Fade in over 3 seconds
    sound1.amp(1, 3);
  }, 1000);
}



// helper to update currentGaugeImage based on GAUGE_PCT
function updateImageForGauge() {
  // map GAUGE_PCT to exact labels
  if (Math.abs(GAUGE_PCT - 1.0) < 0.001) {
    currentGaugeImage = gaugeImages['100'];
  } else if (Math.abs(GAUGE_PCT - 0.75) < 0.001) {
    currentGaugeImage = gaugeImages['75'];
  } else if (Math.abs(GAUGE_PCT - 0.5) < 0.001) {
    currentGaugeImage = gaugeImages['50'];
  } else if (Math.abs(GAUGE_PCT - 0.25) < 0.001) {
    currentGaugeImage = gaugeImages['25'];
  } else if (Math.abs(GAUGE_PCT - 0.0) < 0.001) {
    currentGaugeImage = gaugeImages['0'];
  } else {
    // fallback: choose nearest step
    let nearest = GAUGE_STEPS.reduce((best, val) => Math.abs(val - GAUGE_PCT) < Math.abs(best - GAUGE_PCT) ? val : best, GAUGE_STEPS[0]);
    if (nearest === 1.0) currentGaugeImage = gaugeImages['100'];
    else if (nearest === 0.75) currentGaugeImage = gaugeImages['75'];
    else if (nearest === 0.5) currentGaugeImage = gaugeImages['50'];
    else if (nearest === 0.25) currentGaugeImage = gaugeImages['25'];
    else currentGaugeImage = gaugeImages['0'];
  }
}

// helper to set gauge and update image
function setGaugePct(pct) {
  GAUGE_PCT = pct;
  updateImageForGauge();
}

function setup() {
  // full window canvas
  const cnv = createCanvas(windowWidth, windowHeight);
  // ensure the canvas sits above DOM elements (video / GIF) so landmarks drawn on the canvas are visible on top
  cnv.style('position', 'relative');
  cnv.style('z-index', '999');

  // initialize MediaPipe settings
  setupHands();
  // start camera using MediaPipeHands.js helper
  setupVideo();

  // hide the underlying DOM video element (MediaPipe capture) if present
  // we draw the video into the canvas, so hide the DOM video to avoid it overlaying landmarks
  if (typeof videoElement !== 'undefined' && videoElement) {
    if (typeof videoElement.hide === 'function') {
      videoElement.hide();
    } else if (videoElement.style) {
      videoElement.style.display = 'none';
    }
  }

  // ensure initial image corresponds to full gauge
  updateImageForGauge();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  // clear the canvas
  background('#90D5FF');
// sound1.play();
  // if the video connection is ready
  if (isVideoReady()) {
    const IMG_SCALE = IMAGE_SCALE_PCT;
    const vidW = (videoElement.videoWidth || videoElement.width || width);
    const vidH = (videoElement.videoHeight || videoElement.height || height);
    const imageDrawW = vidW * IMG_SCALE;
    const imageDrawH = vidH * IMG_SCALE;

    // desired center in canvas (percentage)
    const desiredCenterX = width * IMAGE_CENTER_PCT.x;
    const desiredCenterY = height * IMAGE_CENTER_PCT.y;

    const margin = Math.min(80, width * 0.06); // safe margin from edges
    const minCenterX = margin + imageDrawW * 0.5;
    const maxCenterX = width - margin - imageDrawW * 0.5;
    const minCenterY = margin + imageDrawH * 0.5;
    const maxCenterY = height - margin - imageDrawH * 0.5;

    const imageDrawX = Math.max(minCenterX, Math.min(desiredCenterX, maxCenterX));
    const imageDrawY = Math.max(minCenterY, Math.min(desiredCenterY, maxCenterY));

    IMAGE_X = imageDrawX;
    IMAGE_Y = imageDrawY;
    IMAGE_W = imageDrawW;
    IMAGE_H = imageDrawH;

    const imgX = IMAGE_X - IMAGE_W * 0.5;
    const imgY = IMAGE_Y - IMAGE_H * 0.5;

    // --- added: ensure video + gauge + GIF fit in window by computing a single vertical offset (yOffset) ---
    // do not change any existing positions — compute using temporary vars to avoid name collisions
    const gifGapLocal = 8;
    const gifOriginalW = 1474;
    const gifOriginalH = 1292;
    const gaugeW_calc = IMAGE_W || Math.max(100, width * 0.3);
    const gaugeH_calc = Math.max(GAUGE_MIN_H, Math.min(GAUGE_MAX_H, (IMAGE_H || 120) * 0.05));
    const gifDisplayW_calc = Math.min(gaugeW_calc, windowWidth - 16);
    const gifDisplayH_calc = (gifDisplayW_calc * gifOriginalH) / gifOriginalW;

    // total stacked height: video + gauge + gap + GIF + gap
    const totalStackedHeight = IMAGE_H + gaugeH_calc + gifGapLocal + gifDisplayH_calc + gifGapLocal;

    // compute single vertical offset to move all three elements upward when overflowing
    const yOffset = Math.max(0, totalStackedHeight - windowHeight);
    // --- end added block ---

    // draw centered using percent, no extra offset
    // always draw the live video in the main frame (do NOT use gauge images here)
    // apply the computed vertical offset so video/gauge/GIF move together when needed
    drawRoundedImage(videoElement, imgX, imgY - 100 + 180 - yOffset, IMAGE_W, IMAGE_H, 24);

    // draw the gauge-related image to the right of the video, preserving aspect ratio (no deformation)
    if (currentGaugeImage) {
      // desired image width roughly equal to the window height (increased)
      const desiredW = windowHeight * 1.2;
      const imgAspect = (currentGaugeImage.width && currentGaugeImage.height) ? (currentGaugeImage.width / currentGaugeImage.height) : 1;

      // compute display size preserving aspect ratio
      let displayW = desiredW;
      let displayH = displayW / imgAspect;

      // ensure it fits vertically within the window
      const maxDisplayH = windowHeight * 0.95;
      if (displayH > maxDisplayH) {
        displayH = maxDisplayH;
        displayW = displayH * imgAspect;
      }

      // position slightly closer to the right side of the video output
      const smallOffset = Math.min(40, width * 0.03); // small gap from video
      let gaugeTopLeftX = imgX + IMAGE_W + smallOffset;

      // clamp to stay within canvas with a right margin
      const marginRight = Math.min(80, width * 0.06);
      if (gaugeTopLeftX + displayW > width - marginRight) {
        gaugeTopLeftX = width - marginRight - displayW;
      }

      // vertically center relative to the main video image
      const gaugeTopLeftY = IMAGE_Y - displayH * 0.5;

      drawRoundedImage(currentGaugeImage, gaugeTopLeftX-170, gaugeTopLeftY-200, displayW*2, displayH*2, 12);
    }
  }

  // keep strokeWeight for any future drawing
  strokeWeight(2);

  // per-hand states
  let leftLandmarks = null;
  let rightLandmarks = null;
  let leftGesture = false;
  let rightGesture = false;
  const unknownHands = [];

  // default positions (unused but kept)
  const leftIndicatorPos = { x: 40, y: 40 };
  const rightIndicatorPos = { x: width - 100, y: 40 };

  // make sure we have detections to process
  if (detections && detections.multiHandLandmarks && detections.multiHandLandmarks.length) {
    for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
      const hand = detections.multiHandLandmarks[i];
      const handednessObj = (detections.multiHandedness && detections.multiHandedness[i]) || null;
      const label = handednessObj && handednessObj.label ? handednessObj.label : null;

      // compute gesture: index (5..8) and thumb (2..4) straight
      const indexIdx = [5, 6, 7, 8];
      const thumbIdx = [2, 3, 4];
      const indexStraight = isCollinear(hand, indexIdx);
      const thumbStraight = isCollinear(hand, thumbIdx);
      const gestureDetected = indexStraight && thumbStraight;

      // assign by handedness if available
      if (label === "Left") {
        leftLandmarks = hand;
        leftGesture = gestureDetected;
      } else if (label === "Right") {
        rightLandmarks = hand;
        rightGesture = gestureDetected;
      } else {
        // unknown handedness: store for fallback
        unknownHands.push({ landmarks: hand, gesture: gestureDetected });
      }

      // draw only landmarks (no extra decorations)
      drawLandmarks(hand);
    }

    // if handedness not provided, heuristically assign unknowns:
    if (!leftLandmarks || !rightLandmarks) {
      for (let u of unknownHands) {
        if (!leftLandmarks) {
          leftLandmarks = u.landmarks;
          leftGesture = u.gesture;
        } else if (!rightLandmarks) {
          rightLandmarks = u.landmarks;
          rightGesture = u.gesture;
        }
      }
    }
  }

  // --- added: start background sound once when any hand is detected ---
  if (!soundStarted && detections && detections.multiHandLandmarks && detections.multiHandLandmarks.length) {
    const startIfPossible = () => {
      if (sound1 && typeof sound1.loop === 'function') {
        try { sound1.loop(); } catch (e) { /* ignore */ }
      }
    };
    if (typeof userStartAudio === 'function') {
      userStartAudio().then(startIfPossible).catch(startIfPossible);
    } else {
      startIfPossible();
    }
    soundStarted = true;
  }
  // --- end added block ---
  
  // detect touches between hands (for final match)
  const diag = Math.hypot(IMAGE_W || width, IMAGE_H || height);
  const touchTol = Math.max(20, diag * 0.03);

  let touchA = false;
  let touchB = false;

  if (leftLandmarks && rightLandmarks) {
    const l4 = leftLandmarks[4];
    const l8 = leftLandmarks[8];
    const r4 = rightLandmarks[4];
    const r8 = rightLandmarks[8];

    if (l4 && r8) {
      const lpos = landmarkToCanvas(l4);
      const rpos = landmarkToCanvas(r8);
      const dA = Math.hypot(rpos.x - lpos.x, rpos.y - lpos.y);
      if (dA <= touchTol) touchA = true;
    }

    if (l8 && r4) {
      const lpos2 = landmarkToCanvas(l8);
      const rpos2 = landmarkToCanvas(r4);
      const dB = Math.hypot(rpos2.x - lpos2.x, rpos2.y - lpos2.y);
      if (dB <= touchTol) touchB = true;
    }
  }

  const leftState = !!leftGesture;
  const rightState = !!rightGesture;
  const finalMatch = leftState && rightState && touchA && touchB;

  // draw final effect only when finalMatch is true
  if (finalMatch) {
    push();
    const phase = (sin(millis() * 0.006) + 1) * 0.5;
    noStroke();
    fill(255, 140, 0, 120 * phase);
    rect(0, 0, width, height);
    const burstSize = 160 + phase * 220;
    translate(width / 2, height / 2);
    for (let i = 0; i < 8; i++) {
      push();
      rotate((TWO_PI / 8) * i + millis() * 0.002 * (i % 2 ? 1 : -1));
      fill(255, 220, 100, 160 * (1 - i / 12));
      ellipse(burstSize * 0.35, 0, 60 + phase * 60, 20 + phase * 40);
      pop();
    }
    pop();
  }

  // ---------------------------
  // Gauge: orange, decreases stepwise only when finalMatch true,
  // aligned with the bottom edge of the image, nothing else changed.
  // ---------------------------
  // NOTE: removed automatic time-based decrease. Gauge only changes on gesture edges.

  // on rising edge of finalMatch, step gauge down one step
  if (finalMatch && !prevFinalMatch) {
    // find current step index
    let idx = GAUGE_STEPS.findIndex(s => Math.abs(s - GAUGE_PCT) < 0.001);
    if (idx === -1) {
      // fallback: nearest
      idx = GAUGE_STEPS.reduce((bestIdx, val, i) => {
        return (Math.abs(val - GAUGE_PCT) < Math.abs(GAUGE_STEPS[bestIdx] - GAUGE_PCT)) ? i : bestIdx;
      }, 0);
    }
    if (idx < GAUGE_STEPS.length - 1) {
      setGaugePct(GAUGE_STEPS[idx + 1]);
    }
  }
  // remember previous finalMatch state for edge detection
  prevFinalMatch = finalMatch;

  // compute gauge geometry aligned with image bottom
  const gaugeW = IMAGE_W || Math.max(100, width * 0.3);
  const gaugeH = Math.max(GAUGE_MIN_H, Math.min(GAUGE_MAX_H, (IMAGE_H || 120) * 0.05));
  const gaugeX = IMAGE_X - gaugeW * 0.5;
  const gaugeY = IMAGE_Y + IMAGE_H * 0.5; // top aligned with bottom of image

  // draw track (subtle dark background)
  noStroke();
  fill(0, 0, 0, 60);
  rect(gaugeX, gaugeY, gaugeW, gaugeH);

  // draw orange fill (decreasing)
  fill(GAUGE_COLOR[0], GAUGE_COLOR[1], GAUGE_COLOR[2]);
  rect(gaugeX, gaugeY, gaugeW * GAUGE_PCT, gaugeH);
  // ---------------------------

  // --- added: show animated GIF directly below the gauge ---
  // GIF file: image/animation geste.gif
  if (typeof gestureGif === 'undefined') {
    // declare global holder if not declared elsewhere
    window.gestureGif = null;
  }

  if (!window.gestureGif) {
    // create the GIF element (will animate as an HTML <img>)
    // keep it non-interactive and styled nicely
    window.gestureGif = createImg('images/animation geste.gif');
    window.gestureGif.attribute('draggable', 'false');
    window.gestureGif.style('pointer-events', 'none');
    // give a small corner radius via inline style
    window.gestureGif.elt.style.borderRadius = '8px';
    // position absolutely and keep it under the canvas (canvas z-index is higher)
    window.gestureGif.style('position', 'absolute');
    window.gestureGif.style('z-index', '1000');
  }

  // position and size the GIF directly below the gauge, matching gauge width
  // add a small gap of 8px
  const gifGap = 8;
  const gifX = Math.max(0, gaugeX);
  const gifY = gaugeY + gaugeH + gifGap;

  // choose GIF display size based on original proportions
  const originalW = 1474;
  const originalH = 1292;

  // largeur maximale autorisée (par exemple largeur de la fenêtre)
  const maxWidth = windowWidth - 16; // petit padding de 8px de chaque côté

  // on prend la largeur du gauge mais on limite à maxWidth
  let gifDisplayW = Math.min(gaugeW, maxWidth);

  // calcule la hauteur pour garder les proportions
  let gifDisplayH = (gifDisplayW * originalH) / originalW;

  // applique position et taille
  window.gestureGif.position(gifX, gifY-5);
  window.gestureGif.size(gifDisplayW*0.6, gifDisplayH*0.6);

  // --- end added block ---

} // end draw

// helper: convert a normalized landmark {x,y} (0..1) to canvas coordinates
function landmarkToCanvas(mark) {
  if (!mark) return { x: 0, y: 0 };
  const x = IMAGE_X - IMAGE_W * 0.5 + mark.x * IMAGE_W;
  const y = IMAGE_Y - IMAGE_H * 0.5 + mark.y * IMAGE_H;
  return { x, y };
}

// draw only landmarks (kept for display)
function drawLandmarks(landmarks) {
  noStroke();
  fill(255, 0, 0);
  for (let mark of landmarks) {
    if (!mark) continue;
    let p = landmarkToCanvas(mark);
    circle(p.x, p.y, 6);
  }
}

// helper: draw an image with rounded corners (x,y are top-left)
function drawRoundedImage(img, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w * 0.5, h * 0.5));
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.moveTo(x + r, y);
  drawingContext.lineTo(x + w - r, y);
  drawingContext.arcTo(x + w, y, x + w, y + r, r);
  drawingContext.lineTo(x + w, y + h - r);
  drawingContext.arcTo(x + w, y + h, x + w - r, y + h, r);
  drawingContext.lineTo(x + r, y + h);
  drawingContext.arcTo(x, y + h, x, y + h - r, r);
  drawingContext.lineTo(x, y + r);
  drawingContext.arcTo(x, y, x + r, y, r);
  drawingContext.closePath();
  drawingContext.clip();
  imageMode(CORNER);
  image(img, x, y, w, h);
  drawingContext.restore();
  imageMode(CENTER);
}

// helper: perpendicular distance from point (px,py) to line (x1,y1)-(x2,y2)
function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.hypot(dx, dy);
}

// helper: check if a sequence of landmarks is approximately collinear
function isCollinear(landmarks, indices) {
  const first = landmarks[indices[0]];
  const last = landmarks[indices[indices.length - 1]];
  if (!first || !last) return false;
  const p1 = landmarkToCanvas(first);
  const p2 = landmarkToCanvas(last);
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const endpointDist = Math.hypot(dx, dy);
  const tol = Math.max(8, endpointDist * 0.06);

  let maxDist = 0;
  for (let i = 1; i < indices.length - 1; i++) {
    const m = landmarks[indices[i]];
    if (!m) continue;
    const p = landmarkToCanvas(m);
    const d = pointToLineDistance(p.x, p.y, x1, y1, x2, y2);
    if (d > maxDist) maxDist = d;
    if (maxDist > tol) return false;
  }
  return true;
}
