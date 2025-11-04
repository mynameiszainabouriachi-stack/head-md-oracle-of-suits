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


// new globals for fist detection / effect
let fistActive = false;
let lastPalm = null; // {x,y} in video coords for effect placement
const FIST_THRESHOLD = 0.25; // normalized threshold (experiment to tune)

// small helper: Euclidean distance between two normalized landmarks
function distNorm(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// returns true if hand landmarks indicate a closed fist
function isFist(landmarks) {
  // choose palm center: prefer 9 (center of palm), fallback to 0 (wrist)
  const palmIndex = (landmarks[9]) ? 9 : 0;
  const palm = landmarks[palmIndex];

  // choose a reference length to normalize for hand size
  // use distance between wrist (0) and middle finger MCP (9) if available
  let refLen = 0.0;
  if (landmarks[0] && landmarks[9]) {
    refLen = distNorm(landmarks[0], landmarks[9]);
  } else {
    // fallback: distance between wrist and index MCP (5) or a small epsilon
    if (landmarks[5]) refLen = distNorm(landmarks[0], landmarks[5]);
    if (refLen === 0) refLen = 0.0001;
  }

  // fingertip indices to check (exclude thumb 4, as requested)
  const tips = [8, 12, 16, 20];

  // compute average normalized distance of tips to palm
  let sum = 0;
  let count = 0;
  for (let ti of tips) {
    const tip = landmarks[ti];
    if (!tip) continue;
    sum += distNorm(tip, palm);
    count++;
  }
  if (count === 0) return false;
  const avg = sum / count;

  // update lastPalm for effect (convert to video coords later)
  lastPalm = { x: palm.x, y: palm.y };

  // if average distance is small relative to refLen -> fist
  return avg <= (FIST_THRESHOLD * refLen);
}

function onFistStart() {
  // activate effect / action
  console.log("Fist detected: activating effect");
  // ...place other activation code here (sound, state, etc.)...
}

function onFistEnd() {
  // deactivate effect / action
  console.log("Hand opened: deactivating effect");
  // ...place other deactivation code here...
}

function drawEffect() {
  if (!lastPalm) return;
  // convert normalized palm coords to video pixels
  const px = lastPalm.x * videoElement.width;
  const py = lastPalm.y * videoElement.height;
  // draw a translucent pulsing circle at the palm
  push();
  noStroke();
  fill(255, 200, 0, 140);
  const r = min(videoElement.width, videoElement.height) * 0.12;
  ellipse(px, py, r, r);
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
