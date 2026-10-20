
"use strict";

/* ==========================================
   THE ENDLESS JUMP
   Canvas game engine — no external libraries
   ========================================== */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Your browser does not support the HTML Canvas API.");
}

const W = 600;
const H = 800;
canvas.width = W;
canvas.height = H;

const $ = (id) => document.getElementById(id);

const screens = [
  "introScreen", "storyScreen", "menuScreen",
  "pauseScreen", "gameOverScreen", "shopScreen",
  "settingsScreen", "recordsScreen"
];

const showScreen = (id) => {
  screens.forEach((name) => {
    $(name).hidden = name !== id;
  });
};

const STORAGE_KEY = "endlessJumpSaveV1";

const DEFAULT_SAVE = {
  name: "Sky Jumper",
  coins: 0,
  bestScore: 0,
  bestHeight: 0,
  sfx: true,
  music: false,
  difficulty: "normal",
  inventory: { feather: 0, magnet: 0, super: 0, rocket: 0 },
  leaderboard: [],
  headData: null
};

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);

    const parsed = JSON.parse(raw);
    const inventory = parsed.inventory || {};

    return {
      ...DEFAULT_SAVE,
      ...parsed,
      inventory: {
        ...DEFAULT_SAVE.inventory,
        ...inventory
      },
      leaderboard: Array.isArray(parsed.leaderboard)
        ? parsed.leaderboard.slice(0, 10)
        : []
    };
  } catch (error) {
    console.warn("Save data could not be loaded.", error);
    return structuredClone(DEFAULT_SAVE);
  }
}

let save = loadSave();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("Progress could not be saved.", error);
  }
}

/* ---------- UI / PLAYER PROFILE ---------- */

let uploadedHead = null;
let currentMenu = "menuScreen";
let previousMenu = "menuScreen";

function updateProfile() {
  $("playerName").value = save.name;
  $("bestScore").textContent = save.bestScore;
  $("bestHeight").textContent = save.bestHeight + " m";
  $("totalCoins").textContent = save.coins;

  $("profileName").textContent = save.name || "Sky Jumper";
  $("sideBestScore").textContent = save.bestScore;
  $("sideBestHeight").textContent = save.bestHeight + " m";
  $("sideCoins").textContent = save.coins;

  const avatar = $("profileAvatar");
  avatar.replaceChildren();

  if (uploadedHead) {
    const img = document.createElement("img");
    img.src = uploadedHead.src;
    img.alt = "Your character head";
    avatar.appendChild(img);
  } else {
    avatar.textContent = "🦸";
  }

  updateInventoryUI();
}

function updateInventoryUI() {
  const names = {
    feather: "🪶 Feather Fall",
    magnet: "🧲 Coin Magnet",
    super: "🌀 Super Spring",
    rocket: "🚀 Rocket Jump"
  };

  const owned = Object.entries(save.inventory)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${names[key]} × ${count}`);

  $("inventory").textContent = owned.length
    ? "Owned: " + owned.join(" · ")
    : "No power-ups yet. Visit the shop!";

  $("sideInventory").textContent = owned.length
    ? owned.join(" · ")
    : "No power-ups yet";

  $("shopCoins").textContent = save.coins;

  document.querySelectorAll("[data-buy]").forEach((button) => {
    const item = SHOP_ITEMS[button.dataset.buy];
    button.disabled = save.coins < item.price;
  });
}

$("playerName").addEventListener("input", () => {
  save.name = $("playerName").value.trim().slice(0, 16) || "Sky Jumper";
  $("profileName").textContent = save.name;
  persist();
});

$("headUpload").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Please choose an image smaller than 5 MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();

    img.onload = () => {
      uploadedHead = img;
      save.headData = reader.result;
      persist();
      updateProfile();
    };

    img.onerror = () => alert("This image could not be opened.");
    img.src = reader.result;
  };

  reader.onerror = () => alert("Could not read the selected image.");
  reader.readAsDataURL(file);
});

if (save.headData) {
  const img = new Image();
  img.onload = () => {
    uploadedHead = img;
    updateProfile();
  };
  img.src = save.headData;
}

$("soundBtn").addEventListener("click", () => {
  save.sfx = !save.sfx;
  $("sfxSetting").checked = save.sfx;
  $("soundBtn").textContent = save.sfx ? "🔊" : "🔇";
  persist();
});

$("sfxSetting").checked = save.sfx;
$("musicSetting").checked = save.music;
$("difficultySetting").value = save.difficulty;

$("sfxSetting").addEventListener("change", () => {
  save.sfx = $("sfxSetting").checked;
  $("soundBtn").textContent = save.sfx ? "🔊" : "🔇";
  persist();
});

$("musicSetting").addEventListener("change", () => {
  save.music = $("musicSetting").checked;
  persist();

  if (save.music) startMusic();
  else stopMusic();
});

$("difficultySetting").addEventListener("change", () => {
  save.difficulty = $("difficultySetting").value;
  persist();
});

$("shopBtn").addEventListener("click", () => openPanel("shopScreen"));
$("settingsBtn").addEventListener("click", () => openPanel("settingsScreen"));
$("leaderboardBtn").addEventListener("click", () => {
  renderLeaderboard();
  openPanel("recordsScreen");
});

function openPanel(id) {
  previousMenu = currentMenu;
  currentMenu = id;
  updateProfile();
  showScreen(id);
}

function returnFromPanel() {
  showScreen(previousMenu);
  currentMenu = previousMenu;
  updateProfile();
}

$("shopBackBtn").addEventListener("click", returnFromPanel);
$("settingsBackBtn").addEventListener("click", returnFromPanel);
$("recordsBackBtn").addEventListener("click", returnFromPanel);

function renderLeaderboard() {
  const list = $("leaderboardList");
  list.replaceChildren();

  if (!save.leaderboard.length) {
    const item = document.createElement("li");
    item.textContent = "No runs recorded yet. Make your first jump!";
    list.appendChild(item);
    return;
  }

  save.leaderboard.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent =
      `${entry.name} — ${entry.score} points (${entry.height} m)`;
    list.appendChild(item);
  });
}

/* ---------- SOUND EFFECTS ---------- */

let audioContext = null;
let musicTimer = null;
let musicStep = 0;

function beep(frequency = 440, duration = 0.09, type = "sine", volume = 0.06) {
  if (!save.sfx) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("Audio is unavailable.", error);
  }
}

function playJump() {
  beep(310, 0.09, "triangle");
  beep(560, 0.12, "sine", 0.035);
}

function playCoin() {
  beep(850, 0.08, "sine");
  beep(1150, 0.12, "sine", 0.04);
}

function playSpring() {
  beep(180, 0.15, "triangle", 0.09);
  beep(720, 0.2, "sine");
}

function startMusic() {
  stopMusic();

  if (!save.music) return;

  const notes = [262, 330, 392, 330, 294, 349, 440, 349];

  musicTimer = setInterval(() => {
    if (!save.music || !audioContext) return;

    // Music is deliberately soft and generated by the browser.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (audioContext.state === "suspended") audioContext.resume();

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = "sine";
      osc.frequency.value = notes[musicStep % notes.length];
      gain.gain.setValueAtTime(0.015, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001, audioContext.currentTime + 0.22
      );

      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.23);
      musicStep++;
    } catch (error) {
      console.warn("Music could not play.", error);
    }
  }, 280);
}

function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

/* ---------- GAME PHYSICS ---------- */

// World y-coordinates increase upward.
// The player's y-coordinate represents the bottom of their feet.

const GRAVITY = 1450;
const JUMP_VELOCITY = 720;
const SPRING_VELOCITY = 990;
const SUPER_VELOCITY = 1100;
const PLAYER_WIDTH = 34;
const PLAYER_HEIGHT = 46;
const PLATFORM_HEIGHT = 15;
const PLAYER_SPEED = 300;

const SHOP_ITEMS = {
  feather: { price: 30 },
  magnet: { price: 40 },
  super: { price: 50 },
  rocket: { price: 70 }
};

let running = false;
let paused = false;
let gameEnded = false;
let animationId = null;
let lastTime = 0;

let player;
let platforms = [];
let coins = [];
let hazards = [];
let particles = [];

let cameraY = 0;
let highestGeneratedY = 0;
let score = 0;
let runCoins = 0;
let maxHeight = 0;
let jumpCount = 0;

let keys = { left: false, right: false };
let activeItems = { feather: 0, magnet: 0, super: 0, rocket: 0 };
let backgroundOffset = 0;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function difficultySettings() {
  const settings = {
    easy:   { gapMin: 65, gapMax: 100, maxDx: 205, hazardRate: 0.12 },
    normal: { gapMin: 70, gapMax: 112, maxDx: 215, hazardRate: 0.20 },
    hard:   { gapMin: 78, gapMax: 120, maxDx: 225, hazardRate: 0.29 }
  };

  return settings[save.difficulty] || settings.normal;
}

function startGame() {
  save.name = $("playerName").value.trim().slice(0, 16) || "Sky Jumper";
  $("playerName").value = save.name;
  persist();

  stopMusic();
  if (save.music) startMusic();

  score = 0;
  runCoins = 0;
  maxHeight = 0;
  jumpCount = 0;
  cameraY = 0;
  highestGeneratedY = 0;
  backgroundOffset = 0;
  gameEnded = false;
  paused = false;

  activeItems = { feather: 0, magnet: 0, super: 0, rocket: 0 };

  // Items bought from the shop are consumed one at a time per run.
  for (const key of Object.keys(activeItems)) {
    if (save.inventory[key] > 0) {
      activeItems[key] = 1;
      save.inventory[key]--;
    }
  }

  platforms = [];
  coins = [];
  hazards = [];
  particles = [];

  // The first platform is always directly under the player.
  const startingPlatform = {
    x: 210,
    y: 75,
    w: 180,
    h: PLATFORM_HEIGHT,
    type: "grass",
    vx: 0
  };

  platforms.push(startingPlatform);
  highestGeneratedY = startingPlatform.y;

  player = {
    x: startingPlatform.x + startingPlatform.w / 2 - PLAYER_WIDTH / 2,
    y: startingPlatform.y,
    vx: 0,
    vy: JUMP_VELOCITY,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    facing: 1,
    squash: 1,
    blink: 0,
    rocketBoostTimer: 0,
    alive: true
  };

  // Pre-generate enough reachable platforms before the first jump.
  while (highestGeneratedY < 1150) generatePlatform();

  $("hud").hidden = false;
  $("touchControls").hidden = false;
  showScreen("");
  running = true;
  updateHUD();

  lastTime = performance.now();
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
  playJump();
}

function generatePlatform() {
  const cfg = difficultySettings();
  const previous = platforms[platforms.length - 1];

  // Vertical gaps stay comfortably inside the jump height.
  const gap = rand(cfg.gapMin, cfg.gapMax);
  const y = highestGeneratedY + gap;

  // Horizontal movement is limited to reachable distances.
  // A normal jump lasts roughly 0.99 seconds.
  // At 300 units/second, this permits large sideways corrections.
  const safeReach = 185;
  const maxShift = Math.min(cfg.maxDx, safeReach);
  const minX = Math.max(10, previous.x - maxShift);
  const maxX = Math.min(W - 130, previous.x + previous.w - 45 + maxShift);

  const x = rand(minX, Math.max(minX, maxX));
  const w = rand(90, 135);

  let type = "grass";
  const altitude = y;

  if (altitude > 1100 && Math.random() < 0.18) type = "ice";
  else if (altitude > 500 && Math.random() < 0.18) type = "moving";
  else if (Math.random() < 0.11) type = "spring";

  const platform = {
    x: clamp(x, 8, W - w - 8),
    y,
    w,
    h: PLATFORM_HEIGHT,
    type,
    vx: type === "moving" ? (Math.random() < 0.5 ? -1 : 1) * rand(35, 70) : 0
  };

  platforms.push(platform);
  highestGeneratedY = y;

  // Coins appear above some platforms, never inside them.
  if (Math.random() < 0.66) {
    coins.push({
      x: platform.x + platform.w / 2 + rand(-16, 16),
      y: platform.y + rand(40, 72),
      r: 11,
      taken: false,
      phase: rand(0, Math.PI * 2)
    });
  }

  // Hazards are introduced at higher altitudes.
  if (y > 850 && Math.random() < cfg.hazardRate) {
    hazards.push({
      x: rand(50, W - 50),
      y: y + rand(35, 95),
      r: 17,
      vx: rand(55, 100) * (Math.random() < 0.5 ? -1 : 1),
      phase: rand(0, 6)
    });
  }
}

function generateAhead() {
  // Maintain enough platforms above the camera and player.
  while (highestGeneratedY < cameraY + H + 650) {
    generatePlatform();
  }

  // Remove old world objects to keep memory use bounded.
  const cutoff = cameraY - 180;
  platforms = platforms.filter((p) => p.y > cutoff);
  coins = coins.filter((c) => !c.taken && c.y > cutoff);
  hazards = hazards.filter((h) => h.y > cutoff);
}

function screenY(worldY) {
  return H - (worldY - cameraY);
}

function playerScreenY() {
  return screenY(player.y) - player.height;
}

function updateHUD() {
  $("score").textContent = Math.floor(score);
  $("height").textContent = Math.max(0, Math.floor(maxHeight)) + " m";
  $("runCoins").textContent = runCoins;
}

/* ---------- PARTICLES ---------- */

function burst(x, y, color, count = 9) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, 170);

    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.25, 0.65),
      maxLife: 0.65,
      size: rand(2, 6),
      color
    });
  }
}

function updateParticles(dt) {
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 180 * dt;
    p.life -= dt;
  });

  particles = particles.filter((p) => p.life > 0);
}

/* ---------- COLLISIONS ---------- */

function overlaps(aLeft, aRight, bLeft, bRight) {
  return aRight > bLeft && aLeft < bRight;
}

function landOn(platform) {
  player.y = platform.y;
  player.vy = platform.type === "spring"
    ? SPRING_VELOCITY
    : JUMP_VELOCITY;

  if (activeItems.rocket > 0) {
    player.vy = 1500;
    player.rocketBoostTimer = 1.4;
    activeItems.rocket--;
    burst(player.x + player.width / 2, player.y, "#ff9b45", 22);
    burst(player.x + player.width / 2, player.y, "#fff0a1", 12);
    playSpring();
  } else if (activeItems.super > 0) {
    player.vy = SUPER_VELOCITY;
    activeItems.super--;
    burst(player.x + player.width / 2, player.y, "#ffe77a", 20);
    playSpring();
  } else if (platform.type === "spring") {
    burst(player.x + player.width / 2, player.y, "#ffe77a", 16);
    playSpring();
  } else {
    burst(player.x + player.width / 2, player.y, "#c3fff1", 7);
    beep(280, 0.05, "triangle", 0.025);
  }

  player.squash = 0.75;
  jumpCount++;
  score += 10;

  // The world becomes slightly more rewarding as you climb.
  if (jumpCount % 10 === 0) score += 25;
}

function updatePlayer(dt) {
  const previousY = player.y;

  let direction = 0;
  if (keys.left) direction -= 1;
  if (keys.right) direction += 1;

  player.vx = direction * PLAYER_SPEED;

  if (direction !== 0) player.facing = direction;

  player.x += player.vx * dt;

  // Screen-edge wraparound, including partial off-screen positions.
  if (player.x + player.width < 0) {
    player.x = W;
  } else if (player.x > W) {
    player.x = -player.width;
  }

  // Gravity acts in the downward direction of the world.
  const gravityScale = activeItems.feather > 0 && player.vy < 0 ? 0.42 : 1;
  player.vy -= GRAVITY * gravityScale * dt;
  player.y += player.vy * dt;

  // Only detect a landing when the player is falling.
  // Feet must cross the platform's top from above.
  if (player.vy <= 0) {
    for (const platform of platforms) {
      const crossedTop =
        previousY >= platform.y &&
        player.y <= platform.y;

      const playerLeft = player.x + 3;
      const playerRight = player.x + player.width - 3;

      if (
        crossedTop &&
        overlaps(playerLeft, playerRight, platform.x, platform.x + platform.w)
      ) {
        landOn(platform);
        break;
      }
    }
  }

  player.squash += (1 - player.squash) * Math.min(1, dt * 12);
  player.blink = Math.max(0, player.blink - dt);
  player.rocketBoostTimer = Math.max(0, player.rocketBoostTimer - dt);

  // A short feather effect, consumed during this run.
  if (activeItems.feather > 0) {
    activeItems.feather = Math.max(0, activeItems.feather - dt);
  }
}

function updatePlatforms(dt) {
  for (const p of platforms) {
    if (p.type !== "moving") continue;

    p.x += p.vx * dt;

    if (p.x < 8) {
      p.x = 8;
      p.vx = Math.abs(p.vx);
    }

    if (p.x + p.w > W - 8) {
      p.x = W - 8 - p.w;
      p.vx = -Math.abs(p.vx);
    }
  }
}

function updateCoins(dt) {
  for (const coin of coins) {
    if (coin.taken) continue;
    coin.phase += dt * 4;

    const cx = player.x + player.width / 2;
    const cy = player.y + player.height * 0.45;
    const dx = cx - coin.x;
    const dy = cy - coin.y;
    const distance = Math.hypot(dx, dy);

    if (activeItems.magnet > 0 && distance < 230 && distance > 0) {
      const pull = 250 * dt;
      coin.x += dx / distance * pull;
      coin.y += dy / distance * pull;
    }

    if (
      Math.abs(cx - coin.x) < 25 &&
      Math.abs(cy - coin.y) < 29
    ) {
      coin.taken = true;
      runCoins++;
      save.coins++;
      score += 50;
      burst(coin.x, coin.y, "#ffdb58", 12);
      playCoin();
      persist();
    }
  }
}

function updateHazards(dt) {
  for (const hazard of hazards) {
    hazard.x += hazard.vx * dt;
    hazard.phase += dt * 3;

    if (hazard.x < 20) {
      hazard.x = 20;
      hazard.vx = Math.abs(hazard.vx);
    }
    if (hazard.x > W - 20) {
      hazard.x = W - 20;
      hazard.vx = -Math.abs(hazard.vx);
    }

    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    if (
      Math.abs(px - hazard.x) < hazard.r + player.width * 0.42 &&
      Math.abs(py - hazard.y) < hazard.r + player.height * 0.42
    ) {
      endGame("Ouch! Watch out for hazards.");
      return;
    }
  }
}

/* ---------- CAMERA / UPDATE LOOP ---------- */

function updateCamera() {
  // Keep the player in the upper-middle area while climbing.
  const target = player.y - H * 0.58;
  if (target > cameraY) {
    cameraY += (target - cameraY) * 0.12;
    if (target - cameraY < 0.4) cameraY = target;
  }

  maxHeight = Math.max(maxHeight, player.y - 75);
  score = Math.max(score, Math.floor(maxHeight / 10));
  backgroundOffset = cameraY * 0.2;
}

function updateGame(dt) {
  updatePlatforms(dt);
  updatePlayer(dt);
  updateCoins(dt);
  updateHazards(dt);
  updateParticles(dt);
  updateCamera();
  generateAhead();
  updateHUD();

  // Falling far below the camera ends the run.
  if (player.y < cameraY - 100) {
    endGame("You fell out of the sky!");
  }
}

function gameLoop(now) {
  if (!running || paused || gameEnded) return;

  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  updateGame(dt);
  drawGame();

  if (running && !paused && !gameEnded) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

/* ---------- DRAWING ---------- */

function drawBackground() {
  const altitude = Math.max(0, maxHeight);

  let top = "#64c8ff";
  let bottom = "#d4f4ff";

  if (altitude > 1000) {
    top = "#414fa0";
    bottom = "#d2b4ff";
  }
  if (altitude > 2500) {
    top = "#181b54";
    bottom = "#654b9b";
  }
  if (altitude > 5000) {
    top = "#090f2f";
    bottom = "#28275f";
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Distant, softly glowing stars.
  for (let i = 0; i < 35; i++) {
    const x = (i * 137.5 + 31) % W;
    const y = ((i * 211 + backgroundOffset * 0.6) % H + H) % H;
    const size = 1.2 + (i % 3) * 0.6;

    ctx.globalAlpha = 0.18 + (i % 4) * 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Decorative clouds, moving more slowly than the player.
  for (let i = 0; i < 8; i++) {
    const x = (i * 93 + (i % 2) * 40) % (W + 100) - 40;
    const y = ((i * 137 + backgroundOffset * 0.28) % (H + 100) + H + 100) % (H + 100) - 40;
    drawCloud(x, y, 0.65 + (i % 3) * 0.17);
  }

  if (altitude < 1000) {
    ctx.fillStyle = "#4c9c8d";
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 100);
    ctx.lineTo(90, H - 165);
    ctx.lineTo(190, H - 70);
    ctx.lineTo(310, H - 145);
    ctx.lineTo(440, H - 75);
    ctx.lineTo(530, H - 160);
    ctx.lineTo(W, H - 100);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawCloud(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.20;

  ctx.beginPath();
  ctx.ellipse(0, 0, 37, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(-17, -7, 18, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(3, -13, 22, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(23, -5, 19, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawPlatform(p) {
  const y = screenY(p.y);

  if (y < -30 || y > H + 30) return;

  const colors = {
    grass: ["#4be0a4", "#188f77"],
    ice: ["#c1f4ff", "#51a9dc"],
    moving: ["#b9a0ff", "#7157d5"],
    spring: ["#ffce6c", "#ff8b54"]
  };

  const palette = colors[p.type] || colors.grass;

  ctx.save();

  // A gentle shadow makes the platforms feel dimensional.
  ctx.fillStyle = "#17234b30";
  roundedRect(p.x + 3, y + 5, p.w, p.h, 7);
  ctx.fill();

  const gradient = ctx.createLinearGradient(p.x, y, p.x, y + p.h);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(1, palette[1]);

  ctx.fillStyle = gradient;
  roundedRect(p.x, y, p.w, p.h, 7);
  ctx.fill();

  ctx.fillStyle = "#ffffff65";
  roundedRect(p.x + 5, y + 2, Math.max(0, p.w - 10), 3, 2);
  ctx.fill();

  if (p.type === "spring") {
    ctx.strokeStyle = "#fff7b1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2 - 9, y + 5);
    ctx.lineTo(p.x + p.w / 2 + 7, y - 7);
    ctx.lineTo(p.x + p.w / 2 - 6, y - 13);
    ctx.stroke();
  }

  if (p.type === "ice") {
    ctx.fillStyle = "#ffffffaa";
    ctx.beginPath();
    ctx.arc(p.x + p.w * 0.72, y + 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCoin(coin) {
  if (coin.taken) return;

  const y = screenY(coin.y);
  if (y < -30 || y > H + 30) return;

  const squish = 0.78 + Math.abs(Math.sin(coin.phase)) * 0.22;

  ctx.save();
  ctx.translate(coin.x, y);
  ctx.scale(squish, 1);

  const gradient = ctx.createLinearGradient(-coin.r, -coin.r, coin.r, coin.r);
  gradient.addColorStop(0, "#fff6a4");
  gradient.addColorStop(0.5, "#ffc928");
  gradient.addColorStop(1, "#f18b12");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fff6bc";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#bd7511";
  ctx.font = "bold 14px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 1);

  ctx.restore();
}

function drawHazard(hazard) {
  const y = screenY(hazard.y);
  if (y < -40 || y > H + 40) return;

  ctx.save();
  ctx.translate(hazard.x, y);
  ctx.rotate(Math.sin(hazard.phase) * 0.1);

  ctx.fillStyle = "#f55e92";
  ctx.beginPath();
  ctx.ellipse(0, 0, hazard.r, hazard.r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffc3db";
  ctx.beginPath();
  ctx.ellipse(-8, -10, 8, 6, -0.6, 0, Math.PI * 2);
  ctx.ellipse(8, -10, 8, 6, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-6, -1, 4, 0, Math.PI * 2);
  ctx.arc(6, -1, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#182044";
  ctx.beginPath();
  ctx.arc(-5, -1, 2, 0, Math.PI * 2);
  ctx.arc(7, -1, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const x = player.x;
  const y = playerScreenY();
  const w = player.width;
  const h = player.height;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(player.facing, 1);
  ctx.scale(1, player.squash);
  ctx.translate(-w / 2, -h / 2);

  // Soft shadow.
  ctx.fillStyle = "#18204428";
  ctx.beginPath();
  ctx.ellipse(w / 2, h + 5, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms.
  ctx.strokeStyle = "#ffc99e";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.lineTo(1, 15 + Math.sin(performance.now() / 100) * 3);
  ctx.moveTo(w - 8, 24);
  ctx.lineTo(w - 1, 15 - Math.sin(performance.now() / 100) * 3);
  ctx.stroke();

  // Legs.
  ctx.strokeStyle = "#263d8b";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(11, 36);
  ctx.lineTo(8, 43);
  ctx.moveTo(w - 11, 36);
  ctx.lineTo(w - 8, 43);
  ctx.stroke();

  // Body and suit.
  const suit = ctx.createLinearGradient(0, 18, 0, 39);
  suit.addColorStop(0, "#ff78b2");
  suit.addColorStop(1, "#ed4d8b");
  ctx.fillStyle = suit;
  roundedRect(6, 17, w - 12, 22, 8);
  ctx.fill();

  // Chest badge.
  ctx.fillStyle = "#fff1a1";
  ctx.beginPath();
  ctx.arc(w / 2, 27, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f49a30";
  ctx.beginPath();
  ctx.arc(w / 2, 27, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Neck.
  ctx.fillStyle = "#ffc99e";
  ctx.fillRect(w / 2 - 5, 12, 10, 8);

  // Head base.
  ctx.fillStyle = "#ffc99e";
  ctx.beginPath();
  ctx.arc(w / 2, 11, 12, 0, Math.PI * 2);
  ctx.fill();

  if (uploadedHead) {
    // Crop the uploaded image to a circular face.
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, 11, 11, 0, Math.PI * 2);
    ctx.clip();

    const size = 24;
    ctx.drawImage(uploadedHead, w / 2 - size / 2, 11 - size / 2, size, size);
    ctx.restore();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, 11, 11, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Hair.
    ctx.fillStyle = "#49336f";
    ctx.beginPath();
    ctx.arc(w / 2, 7, 12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w / 2 - 12, 5, 5, 7);

    // Eyes.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(w / 2 - 4, 11, 2.5, 0, Math.PI * 2);
    ctx.arc(w / 2 + 4, 11, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#25274f";
    ctx.beginPath();
    ctx.arc(w / 2 - 3, 11, 1.2, 0, Math.PI * 2);
    ctx.arc(w / 2 + 5, 11, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Smile.
    ctx.strokeStyle = "#a44a5f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, 13, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  if (player.rocketBoostTimer > 0) {
    const flameLength = 12 + Math.sin(performance.now() / 35) * 5;
    const flame = ctx.createLinearGradient(0, 36, 0, 36 + flameLength);
    flame.addColorStop(0, "#fff7a1");
    flame.addColorStop(0.45, "#ffad3d");
    flame.addColorStop(1, "#ff5b52");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.lineTo(6, 35);
    ctx.lineTo(3, 35 + flameLength);
    ctx.closePath();
    ctx.fill();
  }

  // Jetpack.
  ctx.fillStyle = "#65d9ef";
  roundedRect(-1, 23, 7, 14, 3);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    const y = screenY(p.y);
    ctx.beginPath();
    ctx.arc(p.x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawGame() {
  drawBackground();

  for (const platform of platforms) drawPlatform(platform);
  for (const coin of coins) drawCoin(coin);
  for (const hazard of hazards) drawHazard(hazard);

  drawParticles();

  if (player) drawPlayer();

  // Decorative altitude label.
  ctx.save();
  ctx.textAlign = "right";
  ctx.font = "bold 12px Nunito, sans-serif";
  ctx.fillStyle = "#ffffffb8";
  ctx.fillText(`ALTITUDE ${Math.floor(maxHeight)} m`, W - 15, H - 16);
  ctx.restore();
}

/* ---------- GAME OVER / SAVE RECORDS ---------- */

function endGame(reason = "Adventure complete!") {
  if (gameEnded) return;

  gameEnded = true;
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);

  $("hud").hidden = true;
  $("touchControls").hidden = true;

  const finalScore = Math.floor(score);
  const finalHeight = Math.max(0, Math.floor(maxHeight));

  save.bestScore = Math.max(save.bestScore, finalScore);
  save.bestHeight = Math.max(save.bestHeight, finalHeight);

  save.leaderboard.push({
    name: save.name || "Sky Jumper",
    score: finalScore,
    height: finalHeight,
    date: new Date().toISOString()
  });

  save.leaderboard.sort((a, b) => b.score - a.score);
  save.leaderboard = save.leaderboard.slice(0, 10);

  persist();

  $("gameOverTitle").textContent =
    reason.startsWith("Ouch") ? "So Close!" : "Nice Jump!";

  $("finalScore").textContent = finalScore;
  $("finalHeight").textContent = finalHeight + " m";
  $("finalCoins").textContent = runCoins;
  $("finalBest").textContent = save.bestScore;

  updateProfile();
  showScreen("gameOverScreen");
  stopMusic();
  beep(180, 0.25, "triangle", 0.06);
}

/* ---------- STORY INTRO ---------- */

const storyPages = [
  {
    emoji: "🌤️",
    chapter: "CHAPTER 1",
    title: "A Tower Above the Clouds",
    text: "A brave little jumper discovers a mysterious trail of floating platforms reaching into the sky."
  },
  {
    emoji: "🪙",
    chapter: "CHAPTER 2",
    title: "Treasures in the Sky",
    text: "Golden coins sparkle along the way. Collect them to unlock helpful power-ups and new adventures."
  },
  {
    emoji: "🚀",
    chapter: "YOUR MISSION",
    title: "Jump Beyond the Stars",
    text: "Leap from platform to platform, dodge flying hazards, and set the highest score you can!"
  }
];

let storyIndex = 0;

function showStoryPage() {
  const page = storyPages[storyIndex];
  $("storyEmoji").textContent = page.emoji;
  $("storyChapter").textContent = page.chapter;
  $("storyTitle").textContent = page.title;
  $("storyText").textContent = page.text;
  $("storyNext").textContent =
    storyIndex === storyPages.length - 1 ? "CUSTOMIZE →" : "NEXT →";

  showScreen("storyScreen");
}

function openCustomization() {
  updateProfile();
  showScreen("menuScreen");
}

$("storyBtn").addEventListener("click", () => {
  storyIndex = 0;
  showStoryPage();
});

$("storyNext").addEventListener("click", () => {
  if (storyIndex < storyPages.length - 1) {
    storyIndex++;
    showStoryPage();
  } else {
    openCustomization();
  }
});

$("storySkip").addEventListener("click", openCustomization);
$("skipBtn").addEventListener("click", openCustomization);

$("startBtn").addEventListener("click", startGame);
$("retryBtn").addEventListener("click", startGame);

$("overMenuBtn").addEventListener("click", () => {
  stopMusic();
  running = false;
  $("hud").hidden = true;
  $("touchControls").hidden = true;
  updateProfile();
  showScreen("menuScreen");
});

$("overShopBtn").addEventListener("click", () => {
  previousMenu = "gameOverScreen";
  currentMenu = "shopScreen";
  updateProfile();
  showScreen("shopScreen");
});

$("pauseBtn").addEventListener("click", pauseGame);
$("resumeBtn").addEventListener("click", resumeGame);

$("pauseMenuBtn").addEventListener("click", () => {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);
  $("hud").hidden = true;
  $("touchControls").hidden = true;
  showScreen("menuScreen");
  updateProfile();
});

function pauseGame() {
  if (!running || paused || gameEnded) return;
  paused = true;
  cancelAnimationFrame(animationId);
  showScreen("pauseScreen");
}

function resumeGame() {
  if (!running || !paused || gameEnded) return;
  paused = false;
  showScreen("");
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

/* ---------- SHOP ---------- */

document.querySelectorAll("[data-buy]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.buy;
    const item = SHOP_ITEMS[key];

    if (!item || save.coins < item.price) {
      beep(150, 0.08, "square", 0.025);
      return;
    }

    save.coins -= item.price;
    save.inventory[key]++;
    persist();
    updateProfile();
    beep(660, 0.12, "sine");
  });
});

/* ---------- KEYBOARD / TOUCH ---------- */

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowleft" || key === "a") keys.left = true;
  if (key === "arrowright" || key === "d") keys.right = true;

  if (key === "escape" || key === "p") {
    if (running && !paused) pauseGame();
    else if (running && paused) resumeGame();
  }

  // Do not restart when a key is held down.
  if (key === "enter" && !running && !paused && !gameEnded) {
    if (!$("menuScreen").hidden) startGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
});

function bindTouchButton(id, direction) {
  const button = $(id);

  const press = (event) => {
    event.preventDefault();
    keys[direction] = true;
    try {
      button.setPointerCapture(event.pointerId);
    } catch (_) {}
  };

  const release = (event) => {
    event.preventDefault();
    keys[direction] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    keys[direction] = false;
  });
}

bindTouchButton("leftBtn", "left");
bindTouchButton("rightBtn", "right");

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused && !gameEnded) {
    pauseGame();
  }
});

/* ---------- INITIAL SCREEN ---------- */

// A static animated background is drawn before the first run.
function drawTitleBackground() {
  drawBackground();

  const samplePlatforms = [
    { x: 55, y: 130, w: 135, h: 15, type: "grass" },
    { x: 350, y: 245, w: 125, h: 15, type: "spring" },
    { x: 130, y: 355, w: 130, h: 15, type: "ice" },
    { x: 340, y: 465, w: 120, h: 15, type: "grass" },
    { x: 75, y: 575, w: 135, h: 15, type: "moving" }
  ];

  samplePlatforms.forEach((platform) => drawPlatform(platform));

  // Decorative coins for the title screen.
  [
    { x: 285, y: 225, r: 11, phase: 0, taken: false },
    { x: 295, y: 445, r: 11, phase: 1, taken: false },
    { x: 245, y: 625, r: 11, phase: 2, taken: false }
  ].forEach(drawCoin);
}

function idleLoop() {
  if (running) return;

  drawTitleBackground();
  animationId = requestAnimationFrame(idleLoop);
}

updateProfile();
showScreen("introScreen");
idleLoop();
