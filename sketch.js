// =============================================================================
// PONGO – Pang/Bubble Trouble clone with Onda, Spain theme
// =============================================================================

// ── 1. CONSTANTS & GLOBALS ───────────────────────────────────────────────────
const BALLOON_SIZES = {
  large:  { radius: 40, nextSize: 'medium', score: 100, minBounce: 3.0, vxMag: 0.75 },
  medium: { radius: 25, nextSize: 'small',  score: 30,  minBounce: 2.5, vxMag: 1.1  },
  small:  { radius: 13, nextSize: null,     score: 10,  minBounce: 2.0, vxMag: 1.6  }
};

const GRAVITY       = 0.10;
const PLAYER_SPEED  = 4;
const BULLET_SPEED  = 10;
const FLOOR_H       = 60;   // height of ceramic tile floor
const HUD_H         = 45;   // HUD bar height at top
const INVINCIBLE_FRAMES = 60;

// ── 2. GAME STATE VARIABLES ───────────────────────────────────────────────────
let canvasW, canvasH;
let gameState  = 'start';
let score      = 0;
let hiScore    = 0;
let lives      = 3;
let level      = 1;
let flashTimer = 0;

let player;
let balloons   = [];
let bullets    = [];

let keysDown   = {};
let touchLeft  = false;
let touchRight = false;
let touchJustShot = false;

// Audio
let audioCtx   = null;

// Stars for background parallax
let bgStars    = [];

// Building geometry (generated once per resize)
let bgBuildings = [];

// Balloon colors — Spanish flag palette (rood & geel)
const TILE_COLORS = ['#C60B1E','#FFC400','#E8000D','#F0A500','#CC0000','#FFD700'];

// ── 3. CLASS DEFINITIONS ──────────────────────────────────────────────────────

class Player {
  constructor() {
    this.w         = 36;
    this.h         = 58;
    this.x         = canvasW / 2;
    this.y         = canvasH - FLOOR_H - this.h / 2;
    this.vx        = 0;
    this.invTimer  = 0;
    this.facing    = 'front'; // 'front' | 'left' | 'right'
    this.walkFrame = 0;
  }

  update() {
    const moveLeft  = keysDown[LEFT_ARROW] || keysDown[65] || touchLeft;
    const moveRight = keysDown[RIGHT_ARROW] || keysDown[68] || touchRight;

    if (moveLeft)       { this.vx = -PLAYER_SPEED; this.facing = 'left';  }
    else if (moveRight) { this.vx =  PLAYER_SPEED;  this.facing = 'right'; }
    else                { this.vx = 0;               this.facing = 'front'; }

    this.x = constrain(this.x + this.vx, this.w / 2, canvasW - this.w / 2);
    this.y = canvasH - FLOOR_H - this.h / 2;

    if (this.vx !== 0) this.walkFrame++;
    if (this.invTimer > 0) this.invTimer--;
  }

  draw() {
    if (this.invTimer > 0 && floor(this.invTimer / 5) % 2 === 0) return;
    push();
    translate(this.x, this.y);
    if (this.facing === 'front') {
      this._drawFront();
    } else {
      this._drawSide(this.facing === 'right' ? 1 : -1);
    }
    pop();
  }

  _drawFront() {
    // Shadow
    noStroke(); fill(0, 0, 0, 40);
    ellipse(0, this.h / 2 + 2, this.w * 1.3, 8);

    // Legs
    stroke('#C1440E'); strokeWeight(5);
    line(-7, 14, -9, 26);
    line( 7, 14,  9, 26);

    // Body
    noStroke(); fill('#FAFAFA'); rectMode(CENTER);
    rect(0, 4, this.w - 4, 28, 4);
    fill(30, 144, 255);
    rect(0, 4, 4, 28);

    // ── Boog (voor-aanzicht: boog omhoog geheven boven hoofd)
    push();
    translate(12, -18);
    stroke(120, 75, 20); strokeWeight(2.5); noFill();
    arc(0, 0, 22, 30, -HALF_PI - 0.9, -HALF_PI + 0.9); // gebogen boog
    // Pees
    stroke(200, 180, 140); strokeWeight(1);
    line(-10, -8, -10, 8);   // verticale pees
    pop();

    // Head
    fill('#F4C07A'); ellipse(0, -12, 20, 20);
    fill('#2c1810');
    ellipse(-4, -13, 3, 3);
    ellipse( 4, -13, 3, 3);
    noFill(); stroke('#2c1810'); strokeWeight(1.5);
    arc(0, -10, 10, 6, 0, PI);

    // Sombrero
    noStroke(); fill('#C1440E');
    ellipse(0, -22, 30, 6);
    fill('#FF8C00');
    rect(0, -27, 16, 12, 2);
    fill('#FAFAFA');
    rect(0, -23, 16, 2);
  }

  _drawSide(dir) {
    // dir: 1 = facing right, -1 = facing left
    push();
    scale(dir, 1);

    // Walking leg animation
    const swing = sin(this.walkFrame * 0.32) * 9;

    // Shadow
    noStroke(); fill(0, 0, 0, 40);
    ellipse(2, this.h / 2 + 2, this.w * 1.1, 7);

    // Back leg
    stroke('#9B3010'); strokeWeight(5);
    line(0, 14, -swing * 0.6, 26);
    // Front leg
    stroke('#C1440E'); strokeWeight(5);
    line(2, 14,  swing * 0.6 + 2, 26);

    // Body (side view)
    noStroke(); fill('#FAFAFA'); rectMode(CENTER);
    rect(2, 4, 16, 28, 3);
    fill(30, 144, 255);
    rect(8, 4, 3, 26);

    // ── Boog (zij-aanzicht: omhoog geheven arm met boog)
    push();
    translate(10, -8);
    stroke(120, 75, 20); strokeWeight(2.5); noFill();
    // Gebogen boog (C-vorm naar rechts)
    arc(0, 0, 18, 34, -HALF_PI - 1.1, HALF_PI + 1.1);
    // Pees
    stroke(200, 180, 140); strokeWeight(1);
    line(8, -14, 8, 14);
    pop();

    // Head — profile
    fill('#F4C07A');
    ellipse(4, -12, 16, 19);
    noStroke(); fill(220, 140, 80);
    triangle(11, -14, 14, -11, 11, -8);
    fill('#2c1810');
    ellipse(7, -14, 3, 3);

    // Sombrero — side view
    noStroke(); fill('#C1440E');
    quad(-6, -20,  18, -20,  18, -17, -6, -17);
    fill('#FF8C00');
    rect(2, -29, 13, 11, 2);
    fill('#FAFAFA');
    rect(2, -25, 13, 2);

    pop();
  }

  hitBy(bx, by, br) {
    if (this.invTimer > 0) return false;
    const dx = this.x - bx;
    const dy = this.y - by;
    return sqrt(dx * dx + dy * dy) < br + this.w * 0.4;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class Balloon {
  constructor(sizeType, startX, startY, vx, vy, colorIdx) {
    this.sizeType  = sizeType;
    const cfg      = BALLOON_SIZES[sizeType];
    this.r         = cfg.radius;
    this.x         = startX  || random(this.r + 20, canvasW - this.r - 20);
    this.y         = startY  || this.r + 10;
    this.vx        = vx      !== undefined ? vx : random(-cfg.vxMag, cfg.vxMag) || cfg.vxMag;
    this.vy        = vy      !== undefined ? vy : random(1, 2);
    this.colorIdx  = colorIdx !== undefined ? colorIdx : floor(random(TILE_COLORS.length));
    this.wobble    = random(TWO_PI);
    this.alive     = true;
  }

  update(speedMult) {
    this.vy += GRAVITY * speedMult;   // gravity ook schalen met speedMult
    this.x  += this.vx * speedMult;
    this.y  += this.vy * speedMult;

    // Wall bounce
    if (this.x - this.r < 0) {
      this.x  = this.r;
      this.vx = abs(this.vx);
    } else if (this.x + this.r > canvasW) {
      this.x  = canvasW - this.r;
      this.vx = -abs(this.vx);
    }

    // Floor bounce
    const floorY = canvasH - FLOOR_H - this.r;
    if (this.y >= floorY) {
      this.y  = floorY;
      this.vy = -abs(this.vy) * 0.95;
      // Enforce minimum bounce height
      const cfg = BALLOON_SIZES[this.sizeType];
      if (abs(this.vy) < cfg.minBounce) this.vy = -cfg.minBounce;
      playBounce();
    }

    // Ceiling
    if (this.y - this.r < HUD_H) {
      this.y  = HUD_H + this.r;
      this.vy = abs(this.vy);
    }

    this.wobble += 0.08;
  }

  draw() {
    const col = TILE_COLORS[this.colorIdx];
    const w   = this.wobble;

    push();
    translate(this.x, this.y);

    // ── String
    stroke('#555');
    strokeWeight(1.5);
    line(0, this.r, 0, this.r + this.r * 0.6);

    // ── Knot
    noStroke();
    fill(col);
    ellipse(0, this.r + 2, 6, 6);

    // ── Balloon body (slightly squished on bounce wobble)
    const scaleX = 1 + 0.04 * sin(w * 2);
    const scaleY = 1 - 0.04 * sin(w * 2);
    scale(scaleX, scaleY);

    // Shadow tint on right side
    const c = color(col);
    fill(red(c) * 0.6, green(c) * 0.6, blue(c) * 0.6, 180);
    ellipse(4, 4, this.r * 2 - 2, this.r * 2 - 2);

    // Main balloon
    fill(col);
    ellipse(0, 0, this.r * 2, this.r * 2);

    // Highlight
    fill(255, 255, 255, 90);
    ellipse(-this.r * 0.3, -this.r * 0.3, this.r * 0.6, this.r * 0.5);

    pop();
  }

  split() {
    const cfg = BALLOON_SIZES[this.sizeType];
    if (!cfg.nextSize) return [];
    const speedBoost = 1.3;
    return [
      new Balloon(cfg.nextSize, this.x, this.y, -abs(this.vx) * speedBoost - 0.5, -6, this.colorIdx),
      new Balloon(cfg.nextSize, this.x, this.y,  abs(this.vx) * speedBoost + 0.5, -6, (this.colorIdx + 1) % TILE_COLORS.length)
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class Bullet {
  constructor(startX) {
    this.x     = startX;
    this.y     = canvasH - FLOOR_H - 60;
    this.w     = 6;  // collision width
    this.alive = true;
  }

  update() {
    this.prevY = this.y;
    this.y -= BULLET_SPEED;
    if (this.y < HUD_H) this.alive = false;
  }

  draw() {
    push();
    translate(this.x, this.y);

    // ── Pijlschacht
    stroke(160, 100, 30);
    strokeWeight(2.5);
    line(0, 0, 0, 28);

    // ── Pijlpunt (driehoek naar boven)
    noStroke();
    fill(160, 160, 170);   // staalgrijs
    triangle(0, -10, -5, 5, 5, 5);
    // Gleam op de punt
    fill(220, 220, 230, 180);
    triangle(0, -8, -2, 0, 1, 0);

    // ── Veren (fletching) onderaan
    stroke(198, 11, 30, 200);  // Spaans rood
    strokeWeight(1.5);
    noFill();
    // Linker veer
    line(0, 24, -6, 32);
    line(0, 26, -5, 30);
    // Rechter veer
    line(0, 24,  6, 32);
    line(0, 26,  5, 30);
    // Nok (inkeping)
    stroke(100, 60, 10);
    strokeWeight(2);
    line(-2, 28, 2, 28);

    pop();
  }

  hits(balloon) {
    if (abs(this.x - balloon.x) >= balloon.r + this.w / 2) return false;
    // Alleen de pijl zelf (tip -10 tot fletching +30), niet de hele schermhoogte
    return balloon.y + balloon.r > this.y - 10 &&
           balloon.y - balloon.r < this.y + 30;
  }
}

// ── 4. AUDIO FUNCTIONS ────────────────────────────────────────────────────────

function initAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch(e) {}
}

function playShoot() {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
  } catch(e) {}
}

function playPop() {
  if (!audioCtx) return;
  try {
    const t  = audioCtx.currentTime;
    const bufSize = audioCtx.sampleRate * 0.3;
    const buf  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    src.start(t);

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch(e) {}
}

function playBounce() {
  if (!audioCtx) return;
  try {
    const t    = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.15);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch(e) {}
}

function playHit() {
  // Kort geluidje bij leven verliezen (game gaat door)
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.4);
  } catch(e) {}
}

function playGameOver() {
  // DRAMATISCH: sad trombone wah-wah-wah-waaaah + diepe dreun + knal
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;

    // 4 dalende sawtooth-slides (sad trombone)
    const wahs = [
      { s: 0.00, f: 466, to: 392, d: 0.28 },
      { s: 0.28, f: 392, to: 330, d: 0.28 },
      { s: 0.56, f: 330, to: 277, d: 0.28 },
      { s: 0.84, f: 277, to: 110, d: 1.20 },
    ];
    wahs.forEach(n => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.connect(g); g.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f,  t + n.s);
      osc.frequency.exponentialRampToValueAtTime(n.to, t + n.s + n.d);
      g.gain.setValueAtTime(0.30, t + n.s);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.s + n.d + 0.05);
      osc.start(t + n.s); osc.stop(t + n.s + n.d + 0.15);
    });

    // Diepe bas-dreun
    const bass = audioCtx.createOscillator();
    const bg   = audioCtx.createGain();
    bass.connect(bg); bg.connect(audioCtx.destination);
    bass.type = 'sine';
    bass.frequency.setValueAtTime(70, t + 2.05);
    bass.frequency.exponentialRampToValueAtTime(25, t + 2.6);
    bg.gain.setValueAtTime(0.55, t + 2.05);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    bass.start(t + 2.05); bass.stop(t + 2.7);

    // Ruisknal
    const bufSize = audioCtx.sampleRate * 0.4;
    const buf  = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    const ns = audioCtx.createBufferSource();
    ns.buffer = buf;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.45, t + 2.05);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    ns.connect(ng); ng.connect(audioCtx.destination);
    ns.start(t + 2.05);
  } catch(e) {}
}

function playLevelComplete() {
  if (!audioCtx) return;
  try {
    const t     = audioCtx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4-E4-G4-C5
    notes.forEach((freq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      const st = t + i * 0.12;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.0, st);
      gain.gain.linearRampToValueAtTime(0.2, st + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
      osc.start(st);
      osc.stop(st + 0.2);
    });
  } catch(e) {}
}

function playScore() {
  if (!audioCtx) return;
  try {
    const t    = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch(e) {}
}

// ── 5. SETUP & DRAW ───────────────────────────────────────────────────────────

function setup() {
  canvasW = min(windowWidth, 800);
  canvasH = min(windowHeight * 0.85, 600);
  if (canvasW < 360) canvasW = 360;

  const cnv = createCanvas(canvasW, canvasH);
  cnv.parent('game-wrapper');

  textFont('monospace');
  generateBackground();

  hiScore = parseInt(localStorage.getItem('pongoHiScore') || '0');
}

function draw() {
  // ── Background always
  drawBackground();

  if (gameState === 'start') {
    drawStartScreen();
  } else if (gameState === 'playing') {
    updateGame();
    drawGame();
    drawHUD();
  } else if (gameState === 'levelComplete') {
    drawGame();
    drawHUD();
    drawLevelComplete();
    if (flashTimer > 0) flashTimer--;
    else startNextLevel();
  } else if (gameState === 'gameOver') {
    drawGame();
    drawHUD();
    drawGameOver();
  }
}

// ── 6. GAME LOGIC ─────────────────────────────────────────────────────────────

function updateGame() {
  player.update();

  // Continuous shooting while key held
  if (keysDown[32] || keysDown[UP_ARROW]) tryShoot();

  const speedMult = 0.42 + (level - 1) * 0.10;

  // Update balloons
  for (let i = balloons.length - 1; i >= 0; i--) {
    balloons[i].update(speedMult);
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    if (!bullets[i].alive) bullets.splice(i, 1);
  }

  // Bullets ↔ balloon collisions
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    for (let i = balloons.length - 1; i >= 0; i--) {
      if (bullets[bi] && bullets[bi].hits(balloons[i])) {
        const children = balloons[i].split();
        const pts = BALLOON_SIZES[balloons[i].sizeType].score;
        balloons.splice(i, 1);
        balloons.push(...children);
        bullets.splice(bi, 1);
        score += pts;
        if (score > hiScore) hiScore = score;
        playPop();
        playScore();
        break;
      }
    }
  }

  // Player ↔ balloon collisions
  for (let b of balloons) {
    if (player.hitBy(b.x, b.y, b.r)) {
      loseLife();
      break;
    }
  }

  // Check level complete
  if (balloons.length === 0) {
    gameState  = 'levelComplete';
    flashTimer = 120;
    playLevelComplete();
    localStorage.setItem('pongoHiScore', hiScore);
  }
}

function drawGame() {
  drawTouchZones();
  // Draw balloons
  for (let b of balloons) b.draw();
  // Draw bullets
  for (let b of bullets) b.draw();
  // Draw player
  if (player) player.draw();
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    gameState = 'gameOver';
    playGameOver();
    localStorage.setItem('pongoHiScore', hiScore);
  } else {
    playHit();
    player.invTimer = INVINCIBLE_FRAMES;
  }
}

let lastShotFrame = -99;

function tryShoot() {
  if (player && frameCount - lastShotFrame >= 8) {
    bullets.push(new Bullet(player.x));
    lastShotFrame = frameCount;
    playShoot();
  }
}

function startNextLevel() {
  level++;
  bullets   = [];
  spawnLevel(level);
  gameState = 'playing';
}

// ── 7. SPAWN LEVEL ────────────────────────────────────────────────────────────

function spawnLevel(lvl) {
  balloons = [];
  // Level 1: 1 grote ballon, heel rustig
  // Level 2: 2 groot
  // Level 3: 2 groot + 1 medium
  // Level 4+: geleidelijk meer
  const largeCnt  = min(lvl, 5);
  const mediumCnt = min(max(0, lvl - 2), 3);

  for (let i = 0; i < largeCnt; i++) {
    const x  = random(80, canvasW - 80);
    const vx = (random() > 0.5 ? 1 : -1) * BALLOON_SIZES.large.vxMag;
    balloons.push(new Balloon('large', x, 60, vx, 0.5, i % TILE_COLORS.length));
  }
  for (let i = 0; i < mediumCnt; i++) {
    const x  = random(80, canvasW - 80);
    const vx = (random() > 0.5 ? 1 : -1) * BALLOON_SIZES.medium.vxMag;
    balloons.push(new Balloon('medium', x, 80, vx, 0.5, (i + 2) % TILE_COLORS.length));
  }
}

// ── 8. BACKGROUND & VISUALS ───────────────────────────────────────────────────

function generateBackground() {
  bgBuildings = [];
  const STORY = 48;

  // Landmarks op canvas-breedte-relatieve posities zodat ze op elk scherm zichtbaar zijn
  // 1. Kasteel van Onda — altijd links
  bgBuildings.push({ type: 'castle', x: -8, w: 110, h: 158 });

  // 2. Tapas de Sofia — ca. 1/3 van het scherm
  const tapasX = floor(canvasW * 0.32);
  bgBuildings.push({ type: 'tapas', x: tapasX, w: 95, h: 112 });

  // 3. Molí de la Reixa (windmolen) — ca. 2/3 van het scherm
  const moliX = floor(canvasW * 0.66);
  bgBuildings.push({ type: 'windmill', x: moliX, w: 78, h: 115 });

  // Opvulling: reguliere gevels tussen kasteel en tapas bar
  let bx = 104;
  while (bx < tapasX - 4) {
    const bw = min(floor(random(70, 110)), tapasX - bx - 2);
    if (bw < 40) break;
    const floors = floor(random(2, 3));
    bgBuildings.push({ type: 'regular', x: bx, w: bw, h: floors*STORY + floor(random(-4,8)),
      floors, archCount: max(1, floor((bw-10)/36)), balconyFloor: floors>2?1:-1,
      windowsPerFloor: floor(random(1, 3)), colorVariant: floor(random(3)) });
    bx += bw + floor(random(1, 5));
  }

  // Reguliere gevels tussen tapas en molen
  bx = tapasX + 97;
  while (bx < moliX - 4) {
    const bw = min(floor(random(70, 110)), moliX - bx - 2);
    if (bw < 40) break;
    const floors = floor(random(2, 3));
    bgBuildings.push({ type: 'regular', x: bx, w: bw, h: floors*STORY + floor(random(-4,8)),
      floors, archCount: max(1, floor((bw-10)/36)), balconyFloor: floors>2?1:-1,
      windowsPerFloor: floor(random(1, 3)), colorVariant: floor(random(3)) });
    bx += bw + floor(random(1, 5));
  }

  // Opvulling rechts van molen
  bx = moliX + 80;
  while (bx < canvasW + 60) {
    const bw = floor(random(60, 90));
    const floors = 2;
    bgBuildings.push({ type: 'regular', x: bx, w: bw, h: floors*STORY,
      floors, archCount: max(1, floor((bw-10)/36)), balconyFloor: -1,
      windowsPerFloor: floor(random(1, 2)), colorVariant: floor(random(3)) });
    bx += bw + floor(random(1, 5));
  }
}

// ── Steen kleurenpalet
const _stone = [
  [212, 195, 155],
  [225, 210, 175],
  [196, 172, 120],
];

function _drawRegularBuilding(b, groundY) {
  const STORY = 48;
  const top = groundY - b.h;
  const sc  = _stone[b.colorVariant || 0];
  const shutterC = [120, 80, 30];

  noStroke(); fill(sc[0], sc[1], sc[2]);
  rect(b.x, top, b.w, b.h);

  // Ramen + balkons per verdieping
  for (let fl = 0; fl < b.floors - 1; fl++) {
    const floorTop = top + fl * STORY + 8;
    const isBalc   = fl === b.balconyFloor;
    const winW = isBalc ? 14 : 10, winH = isBalc ? 18 : 14;
    const winY = floorTop + (STORY - winH) / 2 - 4;
    for (let wi = 0; wi < b.windowsPerFloor; wi++) {
      const winX = b.x + (b.w / (b.windowsPerFloor + 1)) * (wi + 1) - winW / 2;
      fill(sc[0]-30, sc[1]-30, sc[2]-30);
      rect(winX-1, winY-1, winW+2, winH+2, 2, 2, 0, 0);
      fill(70, 90, 110, 200);
      rect(winX, winY, winW, winH, 2, 2, 0, 0);
      fill(shutterC[0], shutterC[1], shutterC[2]);
      rect(winX-5, winY, 4, winH);
      rect(winX+winW+1, winY, 4, winH);
      if (isBalc) {
        fill(sc[0]-20, sc[1]-20, sc[2]-20);
        rect(winX-4, winY+winH, winW+8, 4);
        stroke(40, 30, 20, 200); strokeWeight(1.5);
        for (let sp = 0; sp <= floor((winW+8)/4); sp++)
          line(winX-4+sp*4, winY+winH+4, winX-4+sp*4, winY+winH+12);
        line(winX-4, winY+winH+4, winX+winW+4, winY+winH+4);
        noStroke();
      }
    }
  }

  // Soportales begane grond
  const archFloorY = groundY - STORY;
  const asp = b.w / (b.archCount + 1);
  fill(sc[0]-50, sc[1]-50, sc[2]-50);
  rect(b.x, archFloorY, b.w, STORY);
  for (let ai = 0; ai < b.archCount; ai++) {
    const ax = b.x + asp * (ai + 0.5);
    const aw = asp * 0.6;
    fill(60, 45, 30, 210);
    arc(ax, archFloorY, aw, aw * 0.9, PI, TWO_PI);
    rect(ax - aw/2, archFloorY, aw, STORY * 0.55);
    fill(sc[0]-10, sc[1]-10, sc[2]-10);
    ellipse(ax, archFloorY+1, 6, 6);
  }
  noStroke(); fill(sc[0]-15, sc[1]-15, sc[2]-15);
  for (let pi = 0; pi <= b.archCount; pi++)
    rect(b.x + asp*pi, archFloorY, asp*0.2, STORY);

  // Daklijn
  fill(sc[0]+15, min(sc[1]+15,255), min(sc[2]+15,255));
  rect(b.x-2, top-4, b.w+4, 6);
  fill(178, 85, 35, 180);
  rect(b.x, top-8, b.w, 5);

  // Gevelrand
  stroke(sc[0]-40, sc[1]-40, sc[2]-40, 60); strokeWeight(1);
  noFill(); rect(b.x, top, b.w, b.h); noStroke();
}

function _drawCastle(b, groundY) {
  // Castillo de las 300 Torres — Moorse vesting
  const top  = groundY - b.h;
  const cx   = b.x + b.w / 2;

  // Basis vestingmuur — donkere Moorse steen
  noStroke();
  fill(155, 140, 110);
  rect(b.x, top + 30, b.w, b.h - 30);

  // Linker toren
  fill(140, 126, 98);
  rect(b.x, top, 32, b.h);
  // Rechter toren
  rect(b.x + b.w - 30, top + 15, 30, b.h - 15);
  // Midden-toren (hoogste)
  fill(148, 133, 104);
  rect(cx - 18, top - 10, 36, b.h + 10);

  // Kantelen (merlons) op alle torens
  fill(155, 140, 110);
  const mW = 7, mH = 11;
  // Links
  for (let mx = b.x + 2; mx < b.x + 30; mx += mW + 5)
    rect(mx, top - mH, mW, mH);
  // Midden
  for (let mx = cx - 16; mx < cx + 16; mx += mW + 5)
    rect(mx, top - 10 - mH, mW, mH);
  // Rechts
  for (let mx = b.x + b.w - 28; mx < b.x + b.w - 2; mx += mW + 5)
    rect(mx, top + 15 - mH, mW, mH);

  // Moorse boogvensters (spitsbogen)
  fill(40, 28, 15, 220);
  // Links toren
  arc(b.x + 16, top + 28, 14, 18, PI, TWO_PI);
  rect(b.x + 9, top + 28, 14, 14);
  // Midden toren (2 vensters)
  arc(cx - 6, top + 18, 12, 16, PI, TWO_PI);
  rect(cx - 12, top + 18, 12, 12);
  arc(cx + 6, top + 38, 12, 16, PI, TWO_PI);
  rect(cx, top + 38, 12, 12);
  // Rechter toren
  arc(b.x + b.w - 15, top + 40, 12, 16, PI, TWO_PI);
  rect(b.x + b.w - 21, top + 40, 12, 12);

  // Poortboog (beneden midden)
  fill(30, 20, 10, 240);
  arc(cx, groundY - 8, 22, 28, PI, TWO_PI);
  rect(cx - 11, groundY - 20, 22, 14);

  // Horz. muurband
  stroke(130, 115, 85, 120); strokeWeight(1.5);
  for (let band = 1; band < 4; band++)
    line(b.x, top + band * 38, b.x + b.w, top + band * 38);
  noStroke();

  // Schaduwen torens
  fill(0, 0, 0, 25);
  rect(b.x + 30, top + 30, 4, b.h - 30);
  rect(b.x + b.w - 30, top + 15, 4, b.h - 15);
}

function _drawTapasBar(b, groundY) {
  const top = groundY - b.h;
  const sc  = _stone[2]; // okergeel
  const cx  = b.x + b.w / 2;

  // ── Gebouwlichaam
  noStroke(); fill(sc[0], sc[1], sc[2]);
  rect(b.x, top, b.w, b.h);

  // ── Gestreepte luifel (rood/geel) — breed, goed zichtbaar
  const awY = top + 4;
  const strW = 8;
  for (let sx = b.x - 4; sx < b.x + b.w + 4; sx += strW * 2) {
    fill(198, 11, 30);
    rect(sx, awY, strW, 20);
  }
  for (let sx = b.x - 4 + strW; sx < b.x + b.w + 4; sx += strW * 2) {
    fill(255, 196, 0);
    rect(sx, awY, strW, 20);
  }
  // Luifelrand
  noStroke(); fill(120, 5, 15);
  rect(b.x - 5, awY + 18, b.w + 10, 4);
  // Luifelschaduw
  fill(0, 0, 0, 35);
  rect(b.x - 5, awY + 20, b.w + 10, 5);

  // ── Groot uithangbord "Tapas de Sofia"
  const signY = top + 32;
  fill(80, 20, 5);  noStroke();
  rect(cx - 42, signY, 84, 22, 3);
  // Gouden rand
  stroke(220, 170, 40); strokeWeight(1.5);
  noFill();
  rect(cx - 42, signY, 84, 22, 3);
  noStroke();
  // Tekst
  fill(255, 230, 160);
  textSize(11); textAlign(CENTER, CENTER); textFont('monospace');
  text('Tapas de Sofia', cx, signY + 11);

  // ── Ramen (boven soportal)
  fill(50, 70, 90, 200); noStroke();
  rect(b.x + 8,           top + 62, 24, 20, 2);
  rect(b.x + b.w - 32,   top + 62, 24, 20, 2);
  // Raamkruis
  stroke(sc[0]-20, sc[1]-20, sc[2]-20); strokeWeight(1);
  line(b.x + 20, top + 62, b.x + 20, top + 82);
  line(b.x + b.w - 20, top + 62, b.x + b.w - 20, top + 82);
  noStroke();

  // ── Soportal (begane grond) — getekend NADAT bordje klaar is
  const archFloorY = groundY - 42;
  fill(sc[0] - 45, sc[1] - 45, sc[2] - 45);
  rect(b.x, archFloorY, b.w, 42);
  // Centrale boog
  fill(45, 30, 15, 220);
  arc(cx, archFloorY, b.w * 0.52, 34, PI, TWO_PI);
  rect(cx - b.w*0.26, archFloorY, b.w * 0.52, 22);
  // Zijpijlers
  noStroke(); fill(sc[0]-20, sc[1]-20, sc[2]-20);
  rect(b.x, archFloorY, 10, 42);
  rect(b.x + b.w - 10, archFloorY, 10, 42);

  // ── Daklijn
  fill(sc[0]+15, min(sc[1]+15,255), min(sc[2]+15,255));
  rect(b.x - 2, top - 4, b.w + 4, 6);
  fill(178, 85, 35, 190);
  rect(b.x, top - 8, b.w, 5);

  // ── Gevelrand
  stroke(sc[0]-40, sc[1]-40, sc[2]-40, 50); strokeWeight(1);
  noFill(); rect(b.x, top, b.w, b.h); noStroke();
}

function _drawWindmill(b, groundY) {
  // Molí de la Reixa — Mediterrane windmolen
  const top  = groundY - b.h;
  const cx   = b.x + b.w / 2;

  // Ronde toren (trapezoid: breder onderaan)
  noStroke(); fill(225, 215, 190);
  quad(b.x + 8, top + 22, b.x + b.w - 8, top + 22,
       b.x + b.w,  groundY,  b.x, groundY);

  // Witte bepleistering
  fill(235, 228, 210);
  quad(b.x + 10, top + 22, b.x + b.w - 10, top + 22,
       b.x + b.w - 2, groundY - 2, b.x + 2, groundY - 2);

  // Dak (donkere kap)
  fill(100, 80, 50);
  arc(cx, top + 24, b.w - 14, 34, PI, TWO_PI);

  // Deur
  fill(90, 55, 20);
  arc(cx, groundY - 2, 16, 20, PI, TWO_PI);
  rect(cx - 8, groundY - 12, 16, 12);

  // Klein venster
  fill(60, 80, 100, 180);
  ellipse(cx, top + 50, 10, 10);

  // 4 Wieken (sails) — rotatie via frameCount
  push();
  translate(cx, top + 24);
  const rot = (frameCount * 0.008) % TWO_PI;
  for (let i = 0; i < 4; i++) {
    push();
    rotate(rot + i * HALF_PI);
    // Wiekarm
    stroke(110, 75, 25); strokeWeight(3); noFill();
    line(0, 0, 0, -38);
    // Wiekdoek (canvas)
    noStroke(); fill(200, 190, 165, 190);
    quad(-1, -6, 1, -6, 7, -36, -7, -36);
    // Dwarslatjes
    stroke(130, 90, 30); strokeWeight(1.5);
    line(-5, -14, 5, -14);
    line(-6, -24, 6, -24);
    noStroke();
    pop();
  }
  // Naaf
  noStroke(); fill(130, 90, 40);
  ellipse(0, 0, 10, 10);
  pop();

  // Label "MOLÍ" klein
  fill(100, 80, 40, 180);
  textSize(7); textAlign(CENTER, CENTER); textFont('monospace');
  noStroke();
  text("MOLÍ DE LA REIXA", cx, groundY - 18);
}

function drawBackground() {
  push();

  // Lucht: warm Mediterraan blauw → gouden horizon
  noStroke();
  for (let y = 0; y < canvasH - FLOOR_H; y += 6) {
    const inter = constrain(map(y, 0, canvasH * 0.8, 0, 1), 0, 1);
    fill(lerpColor(color(28, 80, 160), color(180, 210, 240), inter));
    rect(0, y, canvasW, 7);
  }

  // Zon
  noStroke();
  fill(255, 210, 40, 220);
  ellipse(canvasW * 0.82, 48, 52, 52);
  fill(255, 220, 80, 70);
  ellipse(canvasW * 0.82, 48, 82, 82);

  // Gebouwen
  const groundY = canvasH - FLOOR_H;
  for (const b of bgBuildings) {
    push();
    if      (b.type === 'castle')   _drawCastle(b, groundY);
    else if (b.type === 'tapas')    _drawTapasBar(b, groundY);
    else if (b.type === 'windmill') _drawWindmill(b, groundY);
    else                            _drawRegularBuilding(b, groundY);
    pop();
  }

  drawTileFloor();
  pop();
}

function drawTileFloor() {
  const floorY = canvasH - FLOOR_H;
  const tileW  = 20;
  const tileH  = 18;

  // Base terracotta
  noStroke();
  fill('#C1440E');
  rect(0, floorY, canvasW, FLOOR_H);

  // Grout lines + tile pattern
  for (let row = 0; row < ceil(FLOOR_H / tileH) + 1; row++) {
    const offset = (row % 2 === 0) ? 0 : tileW / 2;
    for (let col = -1; col < ceil(canvasW / tileW) + 1; col++) {
      const tx = col * tileW + offset;
      const ty = floorY + row * tileH;

      // Tile base
      fill('#E8B86D');
      rect(tx + 1, ty + 1, tileW - 2, tileH - 2);

      // Mini ceramic pattern inside tile
      const pat = (col + row * 2) % 4;
      if (pat === 0) {
        fill(30, 144, 255, 160);
        ellipse(tx + tileW/2, ty + tileH/2, 6, 6);
      } else if (pat === 1) {
        fill(107, 142, 35, 160);
        noStroke();
        const cx = tx + tileW / 2;
        const cy = ty + tileH / 2;
        push();
        translate(cx, cy);
        for (let p = 0; p < 4; p++) {
          fill(p % 2 === 0 ? '#C1440E' : '#E8B86D');
          rect(-3, -3, 3, 3);
          rotate(HALF_PI);
        }
        pop();
      } else if (pat === 2) {
        stroke(255, 140, 0, 100);
        strokeWeight(1);
        noFill();
        rect(tx + 3, ty + 3, tileW - 6, tileH - 6);
        noStroke();
      } else {
        fill(193, 68, 14, 120);
        noStroke();
        triangle(
          tx + tileW/2, ty + 3,
          tx + tileW - 3, ty + tileH - 3,
          tx + 3, ty + tileH - 3
        );
      }
    }
  }

  // Floor highlight line
  stroke(255, 255, 255, 60);
  strokeWeight(2);
  line(0, floorY + 1, canvasW, floorY + 1);
  noStroke();
}

// ── 9. HUD ────────────────────────────────────────────────────────────────────

function drawHUD() {
  // HUD bar
  noStroke();
  fill(0, 0, 0, 160);
  rect(0, 0, canvasW, HUD_H);
  stroke(255, 200, 50, 120);
  strokeWeight(1.5);
  line(0, HUD_H, canvasW, HUD_H);
  noStroke();

  // Score
  fill(255, 230, 50);
  textSize(14);
  textAlign(LEFT, CENTER);
  text(`${score}`, 12, HUD_H / 2);

  // Hi-Score
  fill(200, 200, 200);
  textSize(11);
  textAlign(CENTER, CENTER);
  text(`HI:${hiScore}`, canvasW / 2, HUD_H / 2 - 8);

  // Level
  fill(100, 220, 255);
  textSize(14);
  textAlign(CENTER, CENTER);
  text(`LVL ${level}`, canvasW / 2, HUD_H / 2 + 8);

  // Lives (balloon icons)
  textAlign(RIGHT, CENTER);
  for (let i = 0; i < lives; i++) {
    const lx = canvasW - 14 - i * 22;
    fill('#FF4466');
    ellipse(lx, HUD_H / 2 - 3, 14, 14);
    fill(255, 255, 255, 60);
    ellipse(lx - 3, HUD_H / 2 - 6, 4, 4);
    stroke('#FF4466');
    strokeWeight(1);
    noFill();
    line(lx, HUD_H / 2 + 4, lx, HUD_H / 2 + 9);
    noStroke();
  }
}

// ── 10. SCREEN STATES ─────────────────────────────────────────────────────────

function drawStartScreen() {
  // Dark overlay
  fill(0, 0, 0, 100);
  noStroke();
  rect(0, 0, canvasW, canvasH);

  // Tile border decoration
  stroke('#C1440E');
  strokeWeight(4);
  noFill();
  rect(10, 10, canvasW - 20, canvasH - 20, 8);
  stroke('#FF8C00');
  strokeWeight(2);
  rect(16, 16, canvasW - 32, canvasH - 32, 6);
  noStroke();

  // Title
  textAlign(CENTER, CENTER);
  textSize(canvasW > 500 ? 72 : 54);

  // Shadow
  fill(100, 20, 0);
  text('PONGO', canvasW / 2 + 4, canvasH * 0.25 + 4);

  // Main title with gradient-like effect
  fill('#FF8C00');
  text('PONGO', canvasW / 2, canvasH * 0.25);

  // Subtitle
  textSize(14);
  fill('#FAFAFA');
  text('La Aventura de Onda', canvasW / 2, canvasH * 0.25 + 52);

  // Decorative balloons on start screen
  drawDecoBalloon(canvasW * 0.18, canvasH * 0.45, 30, 0);
  drawDecoBalloon(canvasW * 0.82, canvasH * 0.45, 25, 2);
  drawDecoBalloon(canvasW * 0.5,  canvasH * 0.52, 20, 4);

  // Instructions
  textSize(13);
  fill(220, 220, 220);
  textAlign(CENTER, CENTER);
  const iY = canvasH * 0.67;
  if ('ontouchstart' in window) {
    text('Hold left / right side — Move', canvasW / 2, iY);
    text('Tap middle — Shoot', canvasW / 2, iY + 22);
  } else {
    text('← → / A D  — Move', canvasW / 2, iY);
    text('SPACE / ↑ — Shoot', canvasW / 2, iY + 22);
  }
  text('Pop all balloons to advance!', canvasW / 2, iY + 44);

  // Pulsing tap prompt
  const pulse = 0.6 + 0.4 * sin(frameCount * 0.07);
  fill(255, 220, 50, 255 * pulse);
  textSize(18);
  text('— TAP TO PLAY —', canvasW / 2, canvasH * 0.9);

  // Onda credit
  fill(160, 160, 160, 180);
  textSize(10);
  text('Inspired by Onda, Castellón – Capital del Azulejo', canvasW / 2, canvasH - 16);
}

function drawDecoBalloon(bx, by, br, colorIdx) {
  const t   = frameCount * 0.02;
  const osc = sin(t + bx) * 6;
  push();
  translate(bx, by + osc);
  const col = TILE_COLORS[colorIdx % TILE_COLORS.length];
  stroke('#555');
  strokeWeight(1.5);
  line(0, br, 0, br + br * 0.7);
  noStroke();
  fill(col);
  ellipse(0, 0, br * 2, br * 2);
  fill(255, 255, 255, 80);
  ellipse(-br * 0.3, -br * 0.3, br * 0.6, br * 0.45);
  pop();
}

function drawLevelComplete() {
  fill(0, 0, 0, 120);
  noStroke();
  rect(0, 0, canvasW, canvasH);

  const pulse = 0.85 + 0.15 * sin(frameCount * 0.15);

  fill(255, 220, 50, 255 * pulse);
  textAlign(CENTER, CENTER);
  textSize(canvasW > 500 ? 42 : 32);
  text(`¡NIVEL ${level} COMPLETO!`, canvasW / 2, canvasH / 2 - 20);

  fill(200, 255, 200, 220);
  textSize(22);
  text(`+${score} pts`, canvasW / 2, canvasH / 2 + 26);
}

function drawGameOver() {
  fill(0, 0, 0, 160);
  noStroke();
  rect(0, 0, canvasW, canvasH);

  // Border
  stroke('#C1440E');
  strokeWeight(3);
  noFill();
  rect(20, 20, canvasW - 40, canvasH - 40, 10);
  noStroke();

  textAlign(CENTER, CENTER);
  fill('#C1440E');
  textSize(canvasW > 500 ? 56 : 42);
  text('GAME OVER', canvasW / 2, canvasH * 0.3);

  fill('#FAFAFA');
  textSize(20);
  text(`Score: ${score}`, canvasW / 2, canvasH * 0.5);
  text(`Best:  ${hiScore}`, canvasW / 2, canvasH * 0.5 + 32);
  text(`Level: ${level}`, canvasW / 2, canvasH * 0.5 + 64);

  const pulse = 0.6 + 0.4 * sin(frameCount * 0.07);
  fill(255, 220, 50, 255 * pulse);
  textSize(18);
  text('— TAP TO PLAY AGAIN —', canvasW / 2, canvasH * 0.82);
}

// ── 11. INPUT HANDLING ────────────────────────────────────────────────────────

function keyPressed() {
  initAudio();
  keysDown[keyCode] = true;

  if (gameState === 'start' || gameState === 'gameOver') {
    startGame();
    return false;
  }

  if (gameState === 'playing') {
    if (keyCode === 32 || keyCode === UP_ARROW) {  // Space or Up
      tryShoot();
      return false;
    }
  }
  return false; // prevent default scroll
}

function keyReleased() {
  keysDown[keyCode] = false;
  return false;
}

function mousePressed() {
  initAudio();
  if (gameState === 'start' || gameState === 'gameOver') {
    startGame();
  } else if (gameState === 'playing') {
    tryShoot();
  }
}

function touchStarted() {
  initAudio();
  if (gameState === 'start' || gameState === 'gameOver') {
    startGame();
    return false;
  }
  if (gameState === 'playing') {
    for (let i = 0; i < touches.length; i++) {
      const tx = touches[i].x;
      if (tx < canvasW * 0.38) {
        touchLeft = true;
      } else if (tx > canvasW * 0.62) {
        touchRight = true;
      } else {
        // Middle tap = shoot
        tryShoot();
      }
    }
  }
  return false;
}

function touchMoved() {
  if (gameState !== 'playing') return false;
  touchLeft  = false;
  touchRight = false;
  for (let i = 0; i < touches.length; i++) {
    const tx = touches[i].x;
    if (tx < canvasW * 0.38)       touchLeft  = true;
    else if (tx > canvasW * 0.62)  touchRight = true;
  }
  return false;
}

function touchEnded() {
  touchLeft  = false;
  touchRight = false;
  return false;
}

function drawTouchZones() {
  // Only show on touch devices
  if (!('ontouchstart' in window)) return;
  push();
  noStroke();
  // Left zone
  fill(255, 255, 255, touchLeft ? 35 : 12);
  rect(0, HUD_H, canvasW * 0.38, canvasH - HUD_H - FLOOR_H);
  // Right zone
  fill(255, 255, 255, touchRight ? 35 : 12);
  rect(canvasW * 0.62, HUD_H, canvasW * 0.38, canvasH - HUD_H - FLOOR_H);
  // Zone labels
  fill(255, 255, 255, touchLeft ? 120 : 50);
  textSize(28);
  textAlign(CENTER, CENTER);
  text('◀', canvasW * 0.19, canvasH * 0.6);
  fill(255, 255, 255, touchRight ? 120 : 50);
  text('▶', canvasW * 0.81, canvasH * 0.6);
  fill(255, 255, 255, 40);
  textSize(10);
  textAlign(CENTER, CENTER);
  text('tap = shoot', canvasW * 0.5, canvasH * 0.6);
  pop();
}

function windowResized() {
  canvasW = min(windowWidth, 800);
  canvasH = min(windowHeight * 0.85, 600);
  if (canvasW < 360) canvasW = 360;
  resizeCanvas(canvasW, canvasH);
  generateBackground();
  if (player) {
    player.y = canvasH - FLOOR_H - player.h / 2;
  }
}

// ── 12. HELPER: startGame ─────────────────────────────────────────────────────

function startGame() {
  score      = 0;
  lives      = 3;
  level      = 1;
  bullets    = [];
  lastShotFrame = -99;
  keysDown   = {};
  touchLeft  = false;
  touchRight = false;
  player     = new Player();
  spawnLevel(1);
  gameState  = 'playing';
}
