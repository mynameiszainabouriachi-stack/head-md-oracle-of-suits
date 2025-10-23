let x;
let y;

function setup() {
  createCanvas(windowWidth, windowHeight);
  x = width * 0.5;
  y = height * 0.5;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(220);
  y += random(-1, 1);
  y += random(-1, 1);
  circle(x, y, 50);
}

function mousePressed() {
  x = mouseX;
  y = mouseY;
}