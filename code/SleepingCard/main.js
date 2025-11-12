// ---------------------------
// Splash Screen — Sleeping Card (grande carte + grand titre)
// ---------------------------

let splashCard;
let splashTitle;

// couleur et opacité du rectangle (même teinte que ton background)
const OVERLAY_COLOR = [0, 60, 100, 180]; // 180 = opacité douce

function preloadSplash() {
  splashCard = loadImage('splash/images/card_sleep.png');
  splashTitle = loadImage('splash/images/title.png');
}

function showSplash() {
  // pas de son, pas de transition
}

function drawSplash() {
  // --- 1️⃣ Carte géante (derrière le rectangle) ---
  if (splashCard) {
    const cardH = DESIGN_H * 1.15; // 115 % → elle dépasse un peu pour remplir l’écran
    const cardW = cardH * (splashCard.width / splashCard.height); // conserve le ratio
    imageMode(CENTER);
    image(splashCard, DESIGN_W / 2, DESIGN_H / 2, cardW, cardH);
  }

  // --- 2️⃣ Rectangle semi-transparent (au-dessus de la carte) ---
  noStroke();
  fill(...OVERLAY_COLOR);
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  // --- 3️⃣ Titre géant au premier plan ---
  if (splashTitle) {
    const titleScale = max(
      DESIGN_W / splashTitle.width,
      DESIGN_H / splashTitle.height
    );
    const titleW = splashTitle.width * titleScale;
    const titleH = splashTitle.height * titleScale;
    imageMode(CENTER);
    image(splashTitle, DESIGN_W / 2, DESIGN_H / 2, titleW, titleH);
  }
}

