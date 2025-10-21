// create a close called planet 
class Planet {
  //create an x,y position 
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // give each planet a random RGB color
    this.color = color(random(255), random(255), random(255));
  }
  //draw the planet as a circle
  draw () {
    // wiggle the planet's position a little bit
    this.x += random(-1, 1);
    this.y += random(-1, 1);
    //set the fill color to the planet's color
    fill(this.color);
    // no outline
    noStroke();
    //draw the planet as a circle 
    ellipse(this.x, this.y, 50, 50);
  }
}

 
 
  //create a array to hold all uranus planets
let uranus =[] ;



  function setup() {
    //create a canvas that fills the entire window
    createCanvas(windowWidth, windowHeight);
  }

  function draw() {
    //set the background to white
    background(255);
    // draw all uranus planets
    for (let planet of uranus) {
      planet.draw();
    }
  }
  //when the mouse is pressed create a new planet at the mouse position
  function mousePressed() {
    let newPlanet = new Planet(mouseX, mouseY);
    uranus.push(newPlanet);
  }