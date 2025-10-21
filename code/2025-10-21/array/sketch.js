//create an empty array
let values = [];

function setup() {
// fit the canvas to the window size
  createCanvas(windowWidth, windowHeight);
// add 100 random values to the array
  for (let i = 0; i < 100; i++) {
    values.push(random(height));
  }

}

function draw() {
  background(220);
  // do something interesting with the values array

  // animated vertical bars: add a smooth sine-wave jitter so bars move
  const w = width / values.length;
  const speed = 0.06;    // animation speed
  const amp = 40;        // amplitude of vertical movement
  const t = frameCount * speed;

  noStroke();
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const x = i * w;
    const phase = i * 0.15;
    // animated height = original value + sine offset
    const animated = values[i] + Math.sin(t + phase) * amp;
    const h = Math.max(0, Math.min(animated, height)); // clamp to canvas
    fill(100, 150, 255);
    rect(x, height - h, w - 1, h);
    sum += h;
  }

 // change the bars to randon colors based on average height
  const avg = sum / values.length;
  for (let i = 0; i < values.length; i++) {
    const x = i * w;
    const phase = i * 0.15;
    const animated = values[i] + Math.sin(t + phase) * amp;
    const h = Math.max(0, Math.min(animated, height)); // clamp to canvas
    const col = map(h, 0, height, 0, 255);
    fill(col, 100, 255 - col);
    rect(x, height - h, w - 1, h);
  }
}