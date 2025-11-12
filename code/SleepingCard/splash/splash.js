// ---------------------------
// Splash Screen – Sleeping Card
// ---------------------------

let splashCardAsset, splashTitleAsset, snoreSoundSplash;
let overlayAlpha = 180; // opacité du rectangle (0–255)
let fadeIn = 0; // fondu d’apparition

// charge les assets du splash (images + son)
function preloadSplash() {
  splashCardAsset = loadImage('splash/images/card_sleep.png');
  splashTitleAsset = loadImage('splash/images/title.png');
  soundFormats('wav');
  snoreSoundSplash = loadSound('splash/sounds/snore.wav');
}

// appelée depuis setup() dans main.js
function showSplash() {
  preloadSplash();
  fadeIn = 0;

  // jouer le ronflement uniquement quand le son est prêt
  if (snoreSoundSplash && snoreSoundSplash.isLoaded()) {
    if (!snoreSoundSplash.isPlaying()) snoreSoundSplash.loop();
  } else {
    const wait = setInterval(() => {
      if (snoreSoundSplash && snoreSoundSplash.isLoaded()) {
        clearInterval(wait);
        if (!snoreSoundSplash.isPlaying()) snoreSoundSplash.loop();
      }
    }, 200);
  }
}

// dessine le splash (aucune déformation des PNG)
function drawSplash() {
  // 1) rectangle semi-transparent (même teinte que le fond)
  noStroke();
  fill(0, 60, 100, overlayAlpha); // même couleur que ton background, opacité douce
  rectMode(CENTER);
  rect(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H);

  // fondu d’apparition
  if (fadeIn < 255) fadeIn += 4;
  push();
  tint(255, fadeIn);
  imageMode(CENTER);

  // 2) carte grande et centrée (ratio conservé)
  if (splashCardAsset) {
    const cardH = DESIGN_H * 1.15; // 115 % → elle dépasse pour remplir l’écran
    const cardW = cardH * (splashCardAsset.width / splashCardAsset.height);
    image(splashCardAsset, DESIGN_W / 2, DESIGN_H / 2, cardW, cardH);
  }

  // 3) titre AU PREMIER PLAN, grand, centré (ratio conservé)
  if (splashTitleAsset) {
    const titleScale = max(
      DESIGN_W / splashTitleAsset.width,
      DESIGN_H / splashTitleAsset.height
    );
    const titleW = splashTitleAsset.width * titleScale;
    const titleH = splashTitleAsset.height * titleScale;
    image(splashTitleAsset, DESIGN_W / 2, DESIGN_H / 2, titleW, titleH);
  }

  pop();
}
