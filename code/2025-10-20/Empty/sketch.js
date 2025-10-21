let x;
let y;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(220);
  circle(x, y, 50);
  print(x);
}

function mousePressed() {
  x = mouseX;
  y = mouseY;
}