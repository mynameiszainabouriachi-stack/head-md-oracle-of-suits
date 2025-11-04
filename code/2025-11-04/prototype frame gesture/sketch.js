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

  // per-hand gesture flags for this frame
  // will map by handedness (Left/Right) when available
  const handGestures = []; // boolean per detected hand (index)
  let leftLandmarks = null;
  let rightLandmarks = null;
  let leftGesture = false;
  let rightGesture = false;
  const unknownHands = []; // fallback when handedness not provided

  // default positions for indicators / objects (left / right)
  const leftIndicatorPos = { x: 40, y: 40 };
  const rightIndicatorPos = { x: width - 100, y: 40 };
  const leftObjectPos = { x: 80, y: height - 120 };
  const rightObjectPos = { x: width - 80, y: height - 120 };

  // make sure we have detections to draw
  if (detections) {

    // for each detected hand
    for (let i = 0; i < detections.multiHandLandmarks.length; i++) {
      let hand = detections.multiHandLandmarks[i];
      let label = (detections.multiHandedness && detections.multiHandedness[i] && detections.multiHandedness[i].label) || null;

      // draw landmarks & features
      drawIndex(hand);
      drawThumb(hand);
      drawTips(hand);
      drawConnections(hand);
      drawLandmarks(hand);

      // detect straightness of specific point groups on this hand:
      // index: 5,6,7,8  (from MCP to fingertip)
      // thumb: 2,3,4    (proximal -> tip)
      const indexIdx = [5, 6, 7, 8];
      const thumbIdx = [2, 3, 4];

      const indexStraight = isCollinear(hand, indexIdx);
      const thumbStraight = isCollinear(hand, thumbIdx);

      // highlight the finger polylines when straight (per-hand color)
      if (indexStraight) {
        stroke(0, 255, 255);
        strokeWeight(4);
        drawPolyline(hand, indexIdx);
      }
      if (thumbStraight) {
        stroke(255, 255, 0);
        strokeWeight(4);
        drawPolyline(hand, thumbIdx);
      }

      // set gesture flag for this hand
      const gestureDetected = indexStraight && thumbStraight;
      handGestures[i] = gestureDetected;

      // remember landmarks + gesture by label if available; otherwise push to unknown
      if (label === 'Left') {
        leftLandmarks = hand;
        leftGesture = gestureDetected;
      } else if (label === 'Right') {
        rightLandmarks = hand;
        rightGesture = gestureDetected;
      } else {
        unknownHands.push({ idx: i, landmarks: hand, gesture: gestureDetected });
      }

      // small label near the wrist indicating straightness
      noStroke();
      fill(gestureDetected ? 'rgba(0,180,0,0.9)' : 'rgba(180,0,0,0.9)');
      const wrist = hand[0];
      const wx = wrist.x * videoElement.width;
      const wy = wrist.y * videoElement.height;
      rectMode(CENTER);
      rect(wx, wy - 30, 80, 24, 6);
      fill(255);
      textSize(12);
      textAlign(CENTER, CENTER);
      text(gestureDetected ? 'STRAIGHT ✓' : 'STRAIGHT', wx, wy - 30);

      // restore strokeWeight for other drawings
      strokeWeight(2);
    } // end of hands loop

    // if no handedness provided, assign unknowns by index fallback
    if (!leftLandmarks || !rightLandmarks) {
      for (let k = 0; k < unknownHands.length; k++) {
        const u = unknownHands[k];
        if (!leftLandmarks && k === 0) {
          leftLandmarks = u.landmarks;
          leftGesture = u.gesture;
        } else if (!rightLandmarks && k === 1) {
          rightLandmarks = u.landmarks;
          rightGesture = u.gesture;
        } else {
          // if there are more unknowns, assign by index order
          if (!leftLandmarks) { leftLandmarks = u.landmarks; leftGesture = u.gesture; }
          else if (!rightLandmarks) { rightLandmarks = u.landmarks; rightGesture = u.gesture; }
        }
      }
    }

  } // end of if detections

  // per-hand boolean states
  const leftState = !!leftGesture;
  const rightState = !!rightGesture;

  // detect both interactions:
  // - touchA: left point 4 touches right point 8
  // - touchB: left point 8 touches right point 4
  let touchA = false;
  let touchB = false;
  let touchAPx = null;
  let touchBPx = null;
  const diag = Math.hypot(videoElement.width || width, videoElement.height || height);
  const touchTol = Math.max(20, diag * 0.03); // adaptive threshold

  if (leftLandmarks && rightLandmarks) {
    // safe access with guards
    const l4 = leftLandmarks[4];
    const l8 = leftLandmarks[8];
    const r4 = rightLandmarks[4];
    const r8 = rightLandmarks[8];

    if (l4 && r8) {
      const lx = l4.x * videoElement.width;
      const ly = l4.y * videoElement.height;
      const rx = r8.x * videoElement.width;
      const ry = r8.y * videoElement.height;
      const dA = Math.hypot(rx - lx, ry - ly);
      if (dA <= touchTol) {
        touchA = true;
        touchAPx = { x: (lx + rx) / 2, y: (ly + ry) / 2 };
      }
    }

    if (l8 && r4) {
      const lx2 = l8.x * videoElement.width;
      const ly2 = l8.y * videoElement.height;
      const rx2 = r4.x * videoElement.width;
      const ry2 = r4.y * videoElement.height;
      const dB = Math.hypot(rx2 - lx2, ry2 - ly2);
      if (dB <= touchTol) {
        touchB = true;
        touchBPx = { x: (lx2 + rx2) / 2, y: (ly2 + ry2) / 2 };
      }
    }
  }

  // final combined condition: both hands straight AND both touch interactions detected
  const finalMatch = leftState && rightState && touchA && touchB;

  // Draw per-hand UI indicators and objects.
  // draw left indicator (top-left)
  push();
  translate(leftIndicatorPos.x, leftIndicatorPos.y);
  noStroke();
  const t = millis() * 0.005;
  if (leftState) {
    // pulsing green when active
    const pulse = 1 + sin(t) * 0.08;
    fill(0, 200, 0);
    rectMode(CORNER);
    rect(-10, -10, 60 * pulse, 60 * pulse, 10);
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('L HAND', 20, 20);
  } else {
    fill(150);
    rect(-10, -10, 60, 60, 10);
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('L HAND', 20, 20);
  }
  pop();

  // draw right indicator (top-right)
  push();
  translate(rightIndicatorPos.x, rightIndicatorPos.y);
  noStroke();
  if (rightState) {
    const pulse = 1 + sin(t + 1.5) * 0.08;
    fill(0, 150, 255);
    rectMode(CORNER);
    rect(-10, -10, 60 * pulse, 60 * pulse, 10);
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('R HAND', 20, 20);
  } else {
    fill(150);
    rect(-10, -10, 60, 60, 10);
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('R HAND', 20, 20);
  }
  pop();

  // small touch indicators (near top-center)
  push();
  translate(width / 2, 28);
  noStroke();
  // touch A indicator (left4 → right8)
  if (touchA) fill(200, 0, 200);
  else fill(120);
  rectMode(CENTER);
  rect(-70, 0, 120, 28, 8);
  fill(255);
  textSize(12);
  textAlign(CENTER, CENTER);
  text('L4 → R8', -70, 0);

  // touch B indicator (left8 → right4)
  if (touchB) fill(200, 100, 0);
  else fill(120);
  rect(70, 0, 120, 28, 8);
  fill(255);
  text('L8 → R4', 70, 0);
  pop();

  // draw objects whose color change per-hand (bottom corners)
  // left object
  push();
  noStroke();
  if (leftState || touchA || touchB) {
    // if finalMatch, tint bright; if touched, magenta; if straight, green
    if (finalMatch) {
      fill(255, 120, 0);
      ellipse(leftObjectPos.x, leftObjectPos.y, 200, 200);
      fill('rgba(255,120,0,0.12)');
      ellipse(leftObjectPos.x, leftObjectPos.y, 360, 360);
    } else if (touchA || touchB) {
      fill(160, 0, 200);
      ellipse(leftObjectPos.x, leftObjectPos.y, 160, 160);
      fill('rgba(160,0,200,0.12)');
      ellipse(leftObjectPos.x, leftObjectPos.y, 300, 300);
    } else {
      fill(0, 220, 0);
      ellipse(leftObjectPos.x, leftObjectPos.y, 140, 140);
      fill('rgba(0,220,0,0.12)');
      ellipse(leftObjectPos.x, leftObjectPos.y, 260, 260);
    }
  } else {
    fill(120);
    ellipse(leftObjectPos.x, leftObjectPos.y, 110, 110);
  }
  fill(255);
  textSize(14);
  textAlign(CENTER, CENTER);
  text('Left Object', leftObjectPos.x, leftObjectPos.y);
  pop();

  // right object
  push();
  noStroke();
  if (rightState || touchA || touchB) {
    if (finalMatch) {
      fill(255, 120, 0);
      ellipse(rightObjectPos.x, rightObjectPos.y, 200, 200);
      fill('rgba(255,120,0,0.12)');
      ellipse(rightObjectPos.x, rightObjectPos.y, 360, 360);
    } else if (touchA || touchB) {
      fill(160, 0, 200);
      ellipse(rightObjectPos.x, rightObjectPos.y, 160, 160);
      fill('rgba(160,0,200,0.12)');
      ellipse(rightObjectPos.x, rightObjectPos.y, 300, 300);
    } else {
      fill(0, 140, 220);
      ellipse(rightObjectPos.x, rightObjectPos.y, 140, 140);
      fill('rgba(0,140,220,0.12)');
      ellipse(rightObjectPos.x, rightObjectPos.y, 260, 260);
    }
  } else {
    fill(120);
    ellipse(rightObjectPos.x, rightObjectPos.y, 110, 110);
  }
  fill(255);
  textSize(14);
  textAlign(CENTER, CENTER);
  text('Right Object', rightObjectPos.x, rightObjectPos.y);
  pop();

  // if touch interactions active, draw connecting visual cues
  if (touchA && touchAPx && leftLandmarks && rightLandmarks) {
    push();
    const glow = 1 + sin(millis() * 0.01) * 0.15;
    strokeWeight(4 * glow);
    stroke(200, 0, 200, 220);
    const l4 = leftLandmarks[4];
    const r8 = rightLandmarks[8];
    if (l4 && r8) {
      const lx = l4.x * videoElement.width;
      const ly = l4.y * videoElement.height;
      const rx = r8.x * videoElement.width;
      const ry = r8.y * videoElement.height;
      line(lx, ly, rx, ry);
      noStroke();
      fill(255, 200, 0, 220);
      const pulseSize = 14 + Math.sin(millis() * 0.02) * 6;
      ellipse(touchAPx.x, touchAPx.y, pulseSize, pulseSize);
    }
    pop();
  }

  if (touchB && touchBPx && leftLandmarks && rightLandmarks) {
    push();
    const glow = 1 + sin(millis() * 0.01) * 0.15;
    strokeWeight(4 * glow);
    stroke(200, 100, 0, 220);
    const l8 = leftLandmarks[8];
    const r4 = rightLandmarks[4];
    if (l8 && r4) {
      const lx = l8.x * videoElement.width;
      const ly = l8.y * videoElement.height;
      const rx = r4.x * videoElement.width;
      const ry = r4.y * videoElement.height;
      line(lx, ly, rx, ry);
      noStroke();
      fill(255, 200, 0, 220);
      const pulseSize = 14 + Math.sin(millis() * 0.02) * 6;
      ellipse(touchBPx.x, touchBPx.y, pulseSize, pulseSize);
    }
    pop();
  }

  // final visual effect when both gestures + both touches are present
  if (finalMatch) {
    push();
    // full-screen pulsing overlay + central burst
    const phase = (sin(millis() * 0.006) + 1) * 0.5; // 0..1
    noStroke();
    fill(255, 140, 0, 120 * phase);
    rect(0, 0, width, height);
    // central burst
    const burstSize = 160 + phase * 220;
    translate(width / 2, height / 2);
    for (let i = 0; i < 8; i++) {
      push();
      rotate((TWO_PI / 8) * i + millis() * 0.002 * (i % 2 ? 1 : -1));
      fill(255, 220, 100, 160 * (1 - i / 12));
      ellipse(burstSize * 0.35, 0, 60 + phase * 60, 20 + phase * 40);
      pop();
    }
    // central label
    noStroke();
    fill(255);
    textSize(36);
    textAlign(CENTER, CENTER);
    text('MATCH FOUND', 0, 0);
    pop();
  }

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

// helper: draw a polyline connecting the given landmark indices (in pixel coords)
function drawPolyline(landmarks, indices) {
  noFill();
  beginShape();
  for (let i of indices) {
    let m = landmarks[i];
    let x = m.x * videoElement.width;
    let y = m.y * videoElement.height;
    vertex(x, y);
  }
  endShape();
}

// helper: check if a sequence of landmarks is approximately collinear
function isCollinear(landmarks, indices) {
  // convert endpoints to pixel coordinates
  const first = landmarks[indices[0]];
  const last = landmarks[indices[indices.length - 1]];
  const x1 = first.x * videoElement.width;
  const y1 = first.y * videoElement.height;
  const x2 = last.x * videoElement.width;
  const y2 = last.y * videoElement.height;

  // distance between endpoints
  const dx = x2 - x1;
  const dy = y2 - y1;
  const endpointDist = Math.hypot(dx, dy);
  // adaptive tolerance: a small fraction of finger length, minimum fallback
  const tol = Math.max(8, endpointDist * 0.06);

  // check max perpendicular distance of intermediate points to line
  let maxDist = 0;
  for (let i = 1; i < indices.length - 1; i++) {
    const m = landmarks[indices[i]];
    const px = m.x * videoElement.width;
    const py = m.y * videoElement.height;
    const d = pointToLineDistance(px, py, x1, y1, x2, y2);
    if (d > maxDist) maxDist = d;
    if (maxDist > tol) return false; // early out
  }

  return true;
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
