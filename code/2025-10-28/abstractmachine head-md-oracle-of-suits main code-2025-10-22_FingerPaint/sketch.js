// global anchor state
let anchor = null;            // { x: <pixels>, y: <pixels> } or null
let TOUCH_THRESHOLD = 40;     // pixels, adjust sensitivity

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

  // make sure we have detections to draw
  if (detections) {

    // for each detected hand
    for (let handIndex = 0; handIndex < detections.multiHandLandmarks.length; handIndex++) {
      let hand = detections.multiHandLandmarks[handIndex];

      // set anchor to landmark 9 (Middle finger MCP) in video pixels
      if (hand[9]) {
        let ax = hand[9].x * videoElement.width;
        let ay = hand[9].y * videoElement.height;
        // update anchor every frame so the circle follows this point
        anchor = { x: ax, y: ay };
      }

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

      // check distance between landmarks 4 and 8 for this hand
      // if they exist and anchor is set, update anchor color state by drawing below
      if (hand[4] && hand[8] && anchor) {
        let x4 = hand[4].x * videoElement.width;
        let y4 = hand[4].y * videoElement.height;
        let x8 = hand[8].x * videoElement.width;
        let y8 = hand[8].y * videoElement.height;
        let d = dist(x4, y4, x8, y8);

        // draw anchor circle with color depending on distance
        noStroke();
        if (d <= TOUCH_THRESHOLD) {
          fill(255, 0, 0); // red when touching / close
        } else {
          fill(0, 0, 255); // blue when not touching
        }
        circle(anchor.x, anchor.y, 80);
      } else if (anchor) {
        // if this hand doesn't have 4/8 but we have an anchor, draw it blue
        noStroke();
        fill(0, 0, 255);
        circle(anchor.x, anchor.y, 60);
      }

    } // end of hands loop

    // if anchor exists but no hand provided distance this frame, still draw last known anchor blue
    if (anchor && detections.multiHandLandmarks.length === 0) {
      noStroke();
      fill(0, 0, 255);
      circle(anchor.x, anchor.y, 60);
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
