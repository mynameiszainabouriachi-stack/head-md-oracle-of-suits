// create an empty array named things
let things = [];

function setup() {
  // full window canvas
  createCanvas(windowWidth, windowHeight);
  // create one Thing that draws the grid
  things.push(new Thing());
}

function draw() {
  background(220);
  // for each thing
  for (const each of things) {
    // call its draw method
    each.draw();
  }
}

function mousePressed() {
  // add another Thing (optional) - keep behaviour if user wants multiple layers
  let t = new Thing();
  things.push(t);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}