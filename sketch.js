// =============================================================================
// PONGO – Pang/Bubble Trouble clone with Onda, Spain theme
// =============================================================================

// ── 1. CONSTANTS & GLOBALS ───────────────────────────────────────────────────
const BALLOON_SIZES = {
  large:  { radius: 40, nextSize: 'medium', score: 100, minBounce: 8,  vxMag: 2.0 },
  medium: { radius: 25, nextSize: 'small',  score: 30,  minBounce: 7,  vxMag: 2.6 },
  small:  { radius: 13, nextSize: null,     score: 10,  minBounce: 6,  vxMag: 3.2 }
};

const GRAVITY       = 0.15;
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
let bullet     = null;

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

// Tile pattern colors
const TILE_COLORS = ['#1E90FF','#C1440E','#FF8C00','#6B8E23','#FAFAFA','#E8B86D'];

// ── 3. CLASS DEFINITIONS ──────────────────────────────────────────────────────

class Player {
  constructor() {
    this.w         = 36;
    this.h         = 58;
    this.x         = canvasW / 2;
    this.y         = canvasH - FLOOR_H - this.h / 2;
    this.vx        = 0;
    this.invTimer  = 0;
  }

  update() {
    const moveLeft  = keysDown[LEFT_ARROW] || keysDown[65] || touchLeft;
    const moveRight = keysDown[RIGHT_ARROW] || keysDown[68] || touchRight;

    if (moveLeft)  this.vx = -PLAYER_SPEED;
    else if (moveRight) this.vx =  PLAYER_SPEED;
    else           this.vx = 0;

    this.x = constrain(this.x + this.vx, this.w / 2, canvasW - this.w / 2);
    this.y = canvasH - FLOOR_H - this.h / 2; // always on ground

    if (this.invTimer > 0) this.invTimer--;
  }

  draw() {
    // Flash when invincible
    if (this.invTimer > 0 && floor(this.invTimer / 5) % 2 === 0) return;

    push();
    translate(this.x, this.y);

    // ── Shadow
    noStroke();
    fill(0, 0, 0, 40);
    ellipse(0, this.h / 2 + 2, this.w * 1.3, 8);

    // ── Legs
    stroke('#C1440E');
    strokeWeight(5);
    line(-7, 14, -9, 26);
    line( 7, 14,  9, 26);

    // ── Body (guayabera shirt - white with blue stripe)
    noStroke();
    fill('#FAFAFA');
    rectMode(CENTER);
    rect(0, 4, this.w - 4, 28, 4);
    fill('#1E90FF');
    rect(0, 4, 4, 28);

    // ── Head
    fill('#F4C07A');
    ellipse(0, -12, 20, 20);

    // ── Eyes
    fill('#2c1810');
    ellipse(-4, -13, 3, 3);
    ellipse( 4, -13, 3, 3);

    // ── Smile
    noFill();
    stroke('#2c1810');
    strokeWeight(1.5);
    arc(0, -10, 10, 6, 0, PI);

    // ── Sombrero
    noStroke();
    fill('#C1440E');
    ellipse(0, -22, 28, 6);  // brim
    fill('#FF8C00');
    rect(0, -27, 16, 12, 2); // crown
    fill('#FAFAFA');
    rect(0, -23, 16, 2);     // band

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
    this.vy += GRAVITY;
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
    this.y     = canvasH - FLOOR_H - 55;
    this.w     = 8;
    this.alive = true;
  }

  update() {
    this.y -= BULLET_SPEED;
    if (this.y < HUD_H) this.alive = false;
  }

  draw() {
    // Animated beam
    const t = frameCount * 0.3;
    for (let i = 0; i < 3; i++) {
      const alpha = 255 - i * 60;
      stroke(255, 255, 100, alpha);
      strokeWeight(this.w - i * 2);
      line(this.x, this.y + i * 4, this.x, canvasH - FLOOR_H - 50);
    }
    // Tip glow
    noStroke();
    fill(255, 255, 200, 200);
    ellipse(this.x, this.y, this.w + 4, this.w + 4);
  }

  hits(balloon) {
    return balloon.alive &&
      abs(this.x - balloon.x) < balloon.r + this.w / 2 &&
      this.y < balloon.y + balloon.r &&
      this.y > balloon.y - balloon.r;
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

function playDeath() {
  if (!audioCtx) return;
  try {
    const t    = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.5);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
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

  const speedMult = 1 + (level - 1) * 0.1;

  // Update balloons
  for (let i = balloons.length - 1; i >= 0; i--) {
    balloons[i].update(speedMult);
  }

  // Update bullet
  if (bullet) {
    bullet.update();
    if (!bullet.alive) bullet = null;
  }

  // Bullet ↔ balloon collisions
  if (bullet) {
    for (let i = balloons.length - 1; i >= 0; i--) {
      if (bullet.hits(balloons[i])) {
        const children = balloons[i].split();
        const pts = BALLOON_SIZES[balloons[i].sizeType].score;
        balloons.splice(i, 1);
        balloons.push(...children);
        bullet.alive = false;
        bullet = null;
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
  // Draw bullet
  if (bullet) bullet.draw();
  // Draw player
  if (player) player.draw();
}

function loseLife() {
  lives--;
  playDeath();
  player.invTimer = INVINCIBLE_FRAMES;
  if (lives <= 0) {
    gameState = 'gameOver';
    localStorage.setItem('pongoHiScore', hiScore);
  }
}

function tryShoot() {
  if (!bullet && player) {
    bullet = new Bullet(player.x);
    playShoot();
  }
}

function startNextLevel() {
  level++;
  bullet = null;
  spawnLevel(level);
  gameState = 'playing';
}

// ── 7. SPAWN LEVEL ────────────────────────────────────────────────────────────

function spawnLevel(lvl) {
  balloons = [];
  let largeCnt  = 1 + lvl;
  let mediumCnt = max(0, lvl - 1);
  // Cap to reasonable amounts
  largeCnt  = min(largeCnt, 5);
  mediumCnt = min(mediumCnt, 3);

  for (let i = 0; i < largeCnt; i++) {
    const x  = random(60, canvasW - 60);
    const vx = (random() > 0.5 ? 1 : -1) * BALLOON_SIZES.large.vxMag * (1 + (lvl - 1) * 0.08);
    balloons.push(new Balloon('large', x, 60, vx, 1, i % TILE_COLORS.length));
  }
  for (let i = 0; i < mediumCnt; i++) {
    const x  = random(60, canvasW - 60);
    const vx = (random() > 0.5 ? 1 : -1) * BALLOON_SIZES.medium.vxMag * (1 + (lvl - 1) * 0.08);
    balloons.push(new Balloon('medium', x, 80, vx, 1, (i + 2) % TILE_COLORS.length));
  }
}

// ── 8. BACKGROUND & VISUALS ───────────────────────────────────────────────────

function generateBackground() {
  bgBuildings = [];
  // Generate a row of white Andalusian buildings
  let bx = 0;
  while (bx < canvasW + 80) {
    const bw = random(60, 110);
    const bh = random(canvasH * 0.25, canvasH * 0.55);
    bgBuildings.push({ x: bx, w: bw, h: bh,
      windows: floor(random(1, 3)),
      hasDome: random() > 0.6,
      hasTower: random() > 0.75
    });
    bx += bw + random(0, 12);
  }
}

function drawBackground() {
  push();
  // Sky gradient (Mediterranean blue) — drawn in 6px bands for performance
  noStroke();
  for (let y = 0; y < canvasH; y += 6) {
    const inter = constrain(map(y, 0, canvasH * 0.75, 0, 1), 0, 1);
    fill(lerpColor(color('#1a85e0'), color('#87CEEB'), inter));
    rect(0, y, canvasW, 7);
  }

  // Sun
  noStroke();
  fill(255, 240, 80, 200);
  ellipse(canvasW - 55, 55, 60, 60);
  fill(255, 230, 100, 80);
  ellipse(canvasW - 55, 55, 90, 90);

  // Buildings silhouette
  noStroke();
  for (const b of bgBuildings) {
    fill(245, 240, 228, 220);
    const top = canvasH - FLOOR_H - b.h;
    rect(b.x, top, b.w, b.h);

    // Arch/windows
    fill(100, 160, 220, 180);
    for (let wi = 0; wi < b.windows; wi++) {
      const wx = b.x + (b.w / (b.windows + 1)) * (wi + 1) - 5;
      const wy = top + b.h * 0.3;
      rect(wx, wy, 10, 14, 5, 5, 0, 0);
    }

    // Dome
    if (b.hasDome) {
      fill(255, 220, 100, 200);
      arc(b.x + b.w / 2, top + 2, b.w * 0.6, b.w * 0.4, PI, TWO_PI);
    }

    // Tower
    if (b.hasTower) {
      fill(240, 235, 220, 220);
      rect(b.x + b.w * 0.3, top - 30, b.w * 0.35, 32);
      fill(180, 50, 10, 200);
      triangle(
        b.x + b.w * 0.3, top - 30,
        b.x + b.w * 0.65, top - 30,
        b.x + b.w * 0.475, top - 52
      );
    }

    // Wall outline
    stroke(200, 190, 170, 80);
    strokeWeight(1);
    noFill();
    rect(b.x, top, b.w, b.h);
    noStroke();
  }

  // Ceramic tile floor (Onda specialty!)
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
  bullet     = null;
  keysDown   = {};
  touchLeft  = false;
  touchRight = false;
  player     = new Player();
  spawnLevel(1);
  gameState  = 'playing';
}
