// ============================================================
//  RONIN'S REDEMPTION — Room System + Boss Fight
//  Player: samurai_sheet.jpg (3x3, WHITE bg, trimmed frames)
//  Enemies: 4x4 grids (WHITE bg)
//  Rooms: Main → Boss (portal transition)
// ============================================================

const W = 1280, H = 720;
const config = {
    type: Phaser.AUTO, width: W, height: H,
    backgroundColor: '#05050a',
    physics: { default: 'arcade', arcade: { gravity: { y: 1400 }, debug: false } },
    scene: { preload, create, update },
    pixelArt: true
};
const game = new Phaser.Game(config);

// ===================== STATE =====================
let player, platforms, walls, cursors, keys, gameScene;
let facingRight = true, jumpCount = 0, onWall = false, wallDirection = 0;
let isDashing = false, canDash = true, dashTime = 0;
let comboStep = 0, comboTimer = 0, isAttacking = false, canAttack = true, attackTimer = 0, hitstopTimer = 0;
let isParrying = false, parryTimer = 0, parryWindow = 0, parryCooldown = 0, parryFlash = null;
let slashGfx = [], emberTimer = 0, playerGlow;
let coyoteTimer = 0, jumpBufferTimer = 0;

// ===================== ENEMY / ROOM STATE =====================
let enemies = [];
let projectiles = [];
let playerHP = 100, playerMaxHP = 100;
let playerHurtTimer = 0;
const PLAYER_HURT_IFRAMES = 600;
let currentRoom = 'main'; // 'main' or 'boss'
let portalZone = null;
let portalGfx = null;
let transitioning = false;
let boss = null;
let bossHpGfx = null, bossHpText = null, bossNameText = null;
let roomObjects = []; // track objects to destroy on room change

// ===================== AUDIO =====================
let audioCtx = null;
let slashAudio = null, bgmAudio = null;

// ===================== HUD =====================
let hpBarGfx, hpText;

// ===================== SPRITE SHEET GRID =====================
const PLAYER_COLS = 3, PLAYER_ROWS = 3;
const ENEMY_COLS = 4, ENEMY_ROWS = 4;
const CHAR_SCALE = 0.35;

// ===================== TUNING =====================
const maxJumps = 2;
const MOVE_SPEED = 420, GROUND_DECEL = 2800, AIR_DECEL = 600;
const JUMP_FORCE = -620, DOUBLE_JUMP_FORCE = -540;
const WALL_SLIDE = 90, WALL_JUMP_X = 380, WALL_JUMP_Y = -560;
const DASH_SPEED = 900, DASH_DURATION = 150, DASH_COOLDOWN = 650;
const COYOTE_TIME = 80, JUMP_BUFFER = 100;
const COMBO_WINDOW = 500, HITSTOP_MS = 55;
const PARRY_ACTIVE = 200, PARRY_TOTAL = 400, PARRY_CD = 600;

const ATTACKS = [
    { name: '一 SLASH',  dur:240, cd:60,  hb:{ox:55,oy:-10,w:70,h:50}, lunge:180, trail:{sa:-15,ea:25,r:55,w:6}, shake:0.003, dmg:25 },
    { name: '二 RISE',   dur:240, cd:60,  hb:{ox:50,oy:-25,w:60,h:55}, lunge:140, trail:{sa:40,ea:-50,r:50,w:5}, shake:0.004, dmg:20 },
    { name: '三 SWEEP',  dur:320, cd:100, hb:{ox:60,oy:10,w:80,h:50},  lunge:240, trail:{sa:-35,ea:55,r:62,w:8}, shake:0.007, dmg:35 }
];

// ============================================================
//  AUDIO
// ============================================================
function initAudio() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    slashAudio = new Audio('https://actions.google.com/sounds/v1/science_fiction/swish_vroom.ogg');
    slashAudio.volume = 0.4; slashAudio.load();
    bgmAudio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    bgmAudio.volume = 0.12; bgmAudio.loop = true; bgmAudio.load();
}
function playSlashSound() { if (slashAudio) { const s = slashAudio.cloneNode(); s.volume = 0.35 + Math.random() * 0.15; s.play().catch(() => {}); } }
function playHitSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.15);
}
function playHurtSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.25);
}
function playDashSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime; const dur = 0.1;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI) * 0.8;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.5;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, t);
    src.connect(bp).connect(g).connect(audioCtx.destination); src.start(t); src.stop(t + dur);
}
function playBlockSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.1);
}
function playArrowSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime; const dur = 0.15;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.3;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, t);
    src.connect(hp).connect(g).connect(audioCtx.destination); src.start(t); src.stop(t + dur);
}
function playSlamSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(80, t); osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.4);
    // Rumble noise
    const dur = 0.3;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.4;
    const ns = audioCtx.createBufferSource(); ns.buffer = buf;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.4, t);
    ns.connect(lp).connect(ng).connect(audioCtx.destination); ns.start(t); ns.stop(t + dur);
}
let bgmStarted = false;
function startBGM() { if (bgmStarted || !bgmAudio) return; bgmStarted = true; bgmAudio.play().catch(() => { bgmStarted = false; }); }

// ============================================================
//  SPRITE SHEET — Slice + White BG Removal + Trim
// ============================================================
function processAndSliceSheet(scene, rawKey, prefix, bgColor, tolerance, cols, rows, trimBottom) {
    const src = scene.textures.get(rawKey).getSourceImage();
    const fw = Math.floor(src.width / cols);
    const rawFh = Math.floor(src.height / rows);
    // trimBottom: pixels to crop from bottom of each frame (fixes bleed)
    const trim = trimBottom || 0;
    const fh = rawFh - trim;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = row * cols + col;
            const c = document.createElement('canvas');
            c.width = fw; c.height = fh;
            const ctx = c.getContext('2d');
            ctx.drawImage(src, col * fw, row * rawFh, fw, fh, 0, 0, fw, fh);
            const imgData = ctx.getImageData(0, 0, fw, fh);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
                if (Math.abs(d[i] - bgColor.r) < tolerance &&
                    Math.abs(d[i+1] - bgColor.g) < tolerance &&
                    Math.abs(d[i+2] - bgColor.b) < tolerance) {
                    d[i+3] = 0;
                }
            }
            ctx.putImageData(imgData, 0, 0);
            scene.textures.addCanvas(prefix + idx, c);
        }
    }
    return { fw, fh };
}

// ============================================================
//  SCENE
// ============================================================
function preload() {
    this.load.image('bg_castle', 'background.jpeg');
    this.load.image('samurai_raw', 'samurai_sheet.jpg');
    this.load.image('oni_raw', 'enemy_sheet.jpg');
    this.load.image('archer_raw', 'enemy__archer.jpg');
    this.load.image('shield_raw', 'enemy_shield.jpg');
    this.load.image('assassin_raw', 'enemy_assasin.jpg');
}

const WHITE_BG = { r: 255, g: 255, b: 255 };

function create() {
    gameScene = this;

    // --- Process samurai (3x3, trim bottom 40px to prevent bleed) ---
    const samDims = processAndSliceSheet(this, 'samurai_raw', 'sam_f', WHITE_BG, 35, PLAYER_COLS, PLAYER_ROWS, 40);

    // --- Process enemies (4x4, no trim needed) ---
    const oniDims = processAndSliceSheet(this, 'oni_raw', 'oni_f', WHITE_BG, 35, ENEMY_COLS, ENEMY_ROWS, 0);
    const archerDims = processAndSliceSheet(this, 'archer_raw', 'archer_f', WHITE_BG, 35, ENEMY_COLS, ENEMY_ROWS, 0);
    const shieldDims = processAndSliceSheet(this, 'shield_raw', 'shield_f', WHITE_BG, 35, ENEMY_COLS, ENEMY_ROWS, 0);
    const assassinDims = processAndSliceSheet(this, 'assassin_raw', 'assassin_f', WHITE_BG, 35, ENEMY_COLS, ENEMY_ROWS, 0);

    EnemyOni.dims = oniDims;
    EnemyArcher.dims = archerDims;
    EnemyShield.dims = shieldDims;
    EnemyAssassin.dims = assassinDims;
    BossOni.dims = oniDims;

    // --- PLAYER ---
    player = this.physics.add.sprite(640, 600, 'sam_f0');
    player.setScale(CHAR_SCALE).setBounce(0).setCollideWorldBounds(true).setDepth(10);
    const pBw = Math.floor(samDims.fw * 0.30);
    const pBh = Math.floor(samDims.fh * 0.50);
    const pBx = Math.floor((samDims.fw - pBw) / 2);
    const pBy = Math.floor(samDims.fh * 0.28);
    player.body.setSize(pBw, pBh).setOffset(pBx, pBy);
    player.body.setMaxVelocityY(900);
    player.animFrame = 0; player.animTimer = 0; player.currentAnim = 'idle';

    // --- PLAYER GLOW ---
    const gc = document.createElement('canvas'); gc.width = 300; gc.height = 300;
    const gctx = gc.getContext('2d');
    const grad = gctx.createRadialGradient(150, 150, 0, 150, 150, 150);
    grad.addColorStop(0, 'rgba(110,150,240,0.35)'); grad.addColorStop(0.2, 'rgba(90,120,220,0.2)');
    grad.addColorStop(0.5, 'rgba(60,90,180,0.08)'); grad.addColorStop(1, 'rgba(40,60,140,0)');
    gctx.fillStyle = grad; gctx.fillRect(0, 0, 300, 300);
    this.textures.addCanvas('glow', gc);
    playerGlow = this.add.image(player.x, player.y, 'glow').setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    // --- INPUT ---
    cursors = this.input.keyboard.createCursorKeys();
    keys = {
        A: this.input.keyboard.addKey('A'), D: this.input.keyboard.addKey('D'),
        W: this.input.keyboard.addKey('W'), SPACE: this.input.keyboard.addKey('SPACE'),
        SHIFT: this.input.keyboard.addKey('SHIFT'),
        X: this.input.keyboard.addKey('X'), C: this.input.keyboard.addKey('C')
    };
    this.input.on('pointerdown', (p) => {
        if (p.leftButtonDown()) triggerAttack();
        if (!audioCtx) initAudio(); startBGM();
    });

    // --- HUD ---
    createHUD(this);
    initAudio();
    this.input.keyboard.on('keydown', () => { startBGM(); });

    // --- BUILD MAIN ROOM ---
    buildRoom(this, 'main');
}

// ============================================================
//  ROOM SYSTEM
// ============================================================
function clearRoom() {
    // Destroy enemies
    enemies.forEach(e => {
        if (e.sprite && e.sprite.scene) e.sprite.destroy();
        if (e.hpGfx && e.hpGfx.scene) e.hpGfx.destroy();
        if (e.typeLabel && e.typeLabel.scene) e.typeLabel.destroy();
    });
    enemies = [];
    // Destroy projectiles
    projectiles.forEach(p => { if (p.gfx && p.gfx.scene) p.gfx.destroy(); });
    projectiles = [];
    // Destroy room objects (platforms, walls, bg, portal)
    roomObjects.forEach(obj => { if (obj && obj.scene) obj.destroy(); });
    roomObjects = [];
    // Destroy platform/wall groups
    if (platforms) { platforms.clear(true, true); }
    if (walls) { walls.clear(true, true); }
    // Destroy boss HUD
    if (bossHpGfx) { bossHpGfx.destroy(); bossHpGfx = null; }
    if (bossHpText) { bossHpText.destroy(); bossHpText = null; }
    if (bossNameText) { bossNameText.destroy(); bossNameText = null; }
    if (portalGfx) { portalGfx.destroy(); portalGfx = null; }
    boss = null;
}

function buildRoom(scene, roomName) {
    currentRoom = roomName;
    platforms = scene.physics.add.staticGroup();
    walls = scene.physics.add.staticGroup();

    if (roomName === 'main') {
        // Background
        const bg = scene.add.image(W / 2, H / 2, 'bg_castle').setDepth(0).setDisplaySize(W, H);
        roomObjects.push(bg);
        drawFog(scene);

        // Platforms — NEON GOLD, visible at alpha 0.6
        makePlatform(scene, 640, 694, 1280, 28, 'ground');
        makePlatform(scene, 200, 555, 180, 10, 'wood');
        makePlatform(scene, 500, 475, 200, 10, 'wood');
        makePlatform(scene, 820, 525, 160, 10, 'wood');
        makePlatform(scene, 1060, 435, 200, 10, 'wood');
        makePlatform(scene, 360, 345, 160, 10, 'wood');
        makePlatform(scene, 700, 285, 220, 10, 'wood');
        makePlatform(scene, 1010, 235, 180, 10, 'wood');
        makePlatform(scene, 200, 195, 140, 10, 'wood');

        // Walls
        makeWall(scene, 16, 360, 24, 720);
        makeWall(scene, 1264, 360, 24, 720);
        makeWall(scene, 640, 585, 18, 220);

        // Enemies
        enemies.push(new EnemyOni(scene, 900, 640));
        enemies.push(new EnemyOni(scene, 350, 640));
        enemies.push(new EnemyArcher(scene, 1060, 380));
        enemies.push(new EnemyArcher(scene, 200, 505));
        enemies.push(new EnemyShield(scene, 700, 640));
        enemies.push(new EnemyAssassin(scene, 500, 425));

        // Portal at right edge
        createPortal(scene, 1240, 640);

    } else if (roomName === 'boss') {
        // Dark red background for boss room
        const bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0205).setDepth(0);
        roomObjects.push(bg);
        // Reuse castle bg with red tint
        const bgImg = scene.add.image(W / 2, H / 2, 'bg_castle').setDepth(0).setDisplaySize(W, H).setTint(0xff2222).setAlpha(0.3);
        roomObjects.push(bgImg);
        drawFog(scene);

        // Boss arena — flatter, wider
        makePlatform(scene, 640, 694, 1280, 28, 'ground');
        makePlatform(scene, 300, 520, 200, 10, 'wood');
        makePlatform(scene, 980, 520, 200, 10, 'wood');
        makePlatform(scene, 640, 400, 260, 10, 'wood');

        // Walls
        makeWall(scene, 16, 360, 24, 720);
        makeWall(scene, 1264, 360, 24, 720);

        // THE GREAT ONI BOSS
        boss = new BossOni(scene, 900, 600);
        enemies.push(boss);

        // Boss HUD
        const z = 1.6;
        bossNameText = scene.add.text(W / z / 2, 50, '⛩ THE GREAT ONI ⛩', {
            fontFamily: 'monospace', fontSize: '11px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
        bossHpGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
        bossHpText = scene.add.text(W / z / 2, 67, '', {
            fontFamily: 'monospace', fontSize: '7px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
    }

    // Set up colliders
    scene.physics.add.collider(player, platforms, onLand, null, scene);
    scene.physics.add.collider(player, walls);
    enemies.forEach(e => {
        scene.physics.add.collider(e.sprite, platforms);
        scene.physics.add.collider(e.sprite, walls);
    });

    // Camera
    scene.cameras.main.setZoom(1.6);
    scene.cameras.main.startFollow(player, true, 0.1, 0.1);
    scene.cameras.main.setDeadzone(60, 30);
    scene.cameras.main.setBounds(0, 0, W, H);
}

function createPortal(scene, x, y) {
    // Visual portal
    portalGfx = scene.add.graphics().setDepth(5);
    const px = x, py = y - 40;
    // Glowing rectangle
    portalGfx.fillStyle(0x00ccff, 0.15); portalGfx.fillRoundedRect(px - 18, py - 45, 36, 90, 8);
    portalGfx.lineStyle(2, 0x00ccff, 0.6); portalGfx.strokeRoundedRect(px - 18, py - 45, 36, 90, 8);
    portalGfx.lineStyle(1, 0x44eeff, 0.8); portalGfx.strokeRoundedRect(px - 14, py - 41, 28, 82, 6);
    // Inner glow
    portalGfx.fillStyle(0x44eeff, 0.08); portalGfx.fillRoundedRect(px - 10, py - 35, 20, 70, 4);
    roomObjects.push(portalGfx);

    // Label
    const lbl = scene.add.text(px, py - 55, '► BOSS', {
        fontFamily: 'monospace', fontSize: '8px', color: '#00ccff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);
    scene.tweens.add({ targets: lbl, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    roomObjects.push(lbl);

    // Collision zone
    portalZone = scene.physics.add.staticBody(px - 15, py - 40, 30, 80);
    roomObjects.push(portalZone);
}

function transitionToRoom(targetRoom) {
    if (transitioning) return;
    transitioning = true;

    // Fade out
    const fade = gameScene.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000, 0).setDepth(500).setScrollFactor(0);
    gameScene.tweens.add({
        targets: fade, alpha: 1, duration: 400,
        onComplete: () => {
            clearRoom();
            // Move player to left side
            player.setPosition(80, 600);
            player.body.setVelocity(0, 0);
            buildRoom(gameScene, targetRoom);
            // Fade in
            gameScene.tweens.add({
                targets: fade, alpha: 0, duration: 400,
                onComplete: () => { fade.destroy(); transitioning = false; }
            });
        }
    });
}

function drawFog(scene) {
    const fogG = scene.add.graphics().setDepth(1);
    fogG.fillGradientStyle(0x000000, 0x000000, 0x0a0404, 0x0a0404, 0, 0, 0.3, 0.3);
    fogG.fillRect(0, 550, W, 170);
    roomObjects.push(fogG);
    const v = scene.add.graphics().setDepth(90).setScrollFactor(0);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0.4, 0, 0); v.fillRect(0, 0, W, 100);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5); v.fillRect(0, H - 120, W, 120);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0, 0, 0.35); v.fillRect(0, 0, 80, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.35, 0.35, 0); v.fillRect(W - 80, 0, 80, H);
    roomObjects.push(v);
}

// ============================================================
//  ENEMY BASE CLASS
// ============================================================
class Enemy {
    constructor(scene, x, y, config) {
        this.scene = scene; this.config = config;
        this.hp = config.hp; this.maxHp = config.hp;
        this.dead = false; this.facingRight = false;
        this.state = 'idle'; this.attackTimer = 0; this.attackCd = 0; this.hurtTimer = 0;
        this.animName = 'idle'; this.animFrame = 0; this.animTimer = 0;

        this.sprite = scene.physics.add.sprite(x, y, config.prefix + '0');
        this.sprite.setScale(config.scale).setDepth(10).setBounce(0).setCollideWorldBounds(true);
        this.sprite.body.setMaxVelocityY(900);

        const dims = config.dims || { fw: 256, fh: 256 };
        const bw = Math.floor(dims.fw * config.bodyWRatio);
        const bh = Math.floor(dims.fh * config.bodyHRatio);
        const bx = Math.floor((dims.fw - bw) / 2);
        const by = Math.floor(dims.fh * config.bodyYOffset);
        this.sprite.body.setSize(bw, bh).setOffset(bx, by);

        this.hpGfx = scene.add.graphics().setDepth(22);
        this.typeLabel = scene.add.text(x, y - 52, config.label || '', {
            fontFamily: 'monospace', fontSize: '7px', color: config.labelColor || '#ff6644'
        }).setOrigin(0.5).setDepth(23).setAlpha(0.8);
    }

    drawHP() {
        const s = this.sprite, g = this.hpGfx; g.clear();
        const bx = s.x - 22, by = s.y - 46, bw = 44, bh = 6;
        const ratio = Math.max(0, this.hp / this.maxHp);
        const fillW = Math.floor((bw - 2) * ratio);
        g.fillStyle(0x111111, 0.7); g.fillRoundedRect(bx, by, bw, bh, 3);
        g.lineStyle(1, this.config.hpBorderColor || 0x444466, 0.8); g.strokeRoundedRect(bx, by, bw, bh, 3);
        if (fillW > 0) {
            let color = ratio > 0.6 ? (this.config.hpColor || 0x22cc44) : ratio > 0.3 ? 0xcccc22 : 0xcc2222;
            g.fillStyle(color, 0.9); g.fillRoundedRect(bx + 1, by + 1, fillW, bh - 2, 2);
            g.lineStyle(1, 0xffffff, 0.15); g.lineBetween(bx + 3, by + 2, bx + 1 + fillW - 2, by + 2);
        }
        this.typeLabel.setPosition(s.x, s.y - 54);
    }

    playAnim(name) {
        if (this.animName === name) return;
        this.animName = name; this.animFrame = 0; this.animTimer = 0;
        const anim = this.config.anims[name];
        if (anim) this.sprite.setTexture(this.config.prefix + anim.frames[0]);
    }

    updateAnim(delta) {
        const anim = this.config.anims[this.animName];
        if (!anim || anim.frames.length <= 1) return;
        this.animTimer += delta;
        if (this.animTimer >= 1000 / anim.fps) {
            this.animTimer -= 1000 / anim.fps; this.animFrame++;
            if (this.animFrame >= anim.frames.length) this.animFrame = anim.loop ? 0 : anim.frames.length - 1;
            this.sprite.setTexture(this.config.prefix + anim.frames[this.animFrame]);
        }
    }

    takeDamage(dmg, dir) {
        if (this.dead) return;
        this.hp -= dmg; this.hurtTimer = 200;
        this.sprite.body.setVelocityX(dir * 300); this.sprite.body.setVelocityY(-100);
        playHitSound();
        const txt = gameScene.add.text(this.sprite.x, this.sprite.y - 30, '-' + dmg, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
        for (let i = 0; i < 5; i++) {
            const px = this.sprite.x + Phaser.Math.Between(-8, 8), py = this.sprite.y + Phaser.Math.Between(-15, 10);
            const sp = gameScene.add.circle(px, py, Phaser.Math.Between(1, 3), 0xff4422, 0.9).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + dir * Phaser.Math.Between(10, 40), y: py + Phaser.Math.Between(-20, 10), alpha: 0, duration: 250, onComplete: () => sp.destroy() });
        }
        if (this.hp <= 0) this.die();
    }

    canTakeDamage(attackDir) { return true; }

    die() {
        this.dead = true; this.sprite.body.enable = false;
        const s = this.sprite;
        const fl = gameScene.add.circle(s.x, s.y, 30, 0xff2200, 0.5).setDepth(15);
        gameScene.tweens.add({ targets: fl, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 300, onComplete: () => fl.destroy() });
        for (let i = 0; i < 12; i++) {
            const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360)), r = Phaser.Math.Between(5, 15);
            const px = s.x + Math.cos(a) * r, py = s.y + Math.sin(a) * r;
            const sp = gameScene.add.rectangle(px, py, Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 6),
                Math.random() < 0.5 ? 0xcc2222 : 0xff6644, 1).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + Math.cos(a) * Phaser.Math.Between(30, 80), y: py + Math.sin(a) * Phaser.Math.Between(30, 80) - 20,
                alpha: 0, rotation: Phaser.Math.Between(-3, 3), duration: Phaser.Math.Between(300, 600), onComplete: () => sp.destroy() });
        }
        gameScene.tweens.add({ targets: s, alpha: 0, scaleX: 0, scaleY: 0, duration: 400, ease: 'Power3',
            onComplete: () => { s.destroy(); this.hpGfx.destroy(); this.typeLabel.destroy(); }
        });
        const kt = gameScene.add.text(s.x, s.y - 40, 'SLAIN', { fontFamily: 'monospace', fontSize: '12px', color: '#ff6644', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({ targets: kt, y: kt.y - 30, alpha: 0, duration: 1000, onComplete: () => kt.destroy() });
        if (currentRoom === 'main') {
            gameScene.time.delayedCall(6000, () => { this.respawn(); });
        }
    }

    respawn() {
        const idx = enemies.indexOf(this);
        if (idx !== -1) enemies.splice(idx, 1);
        const ne = new this.constructor(gameScene, Phaser.Math.Between(200, 1080), 640);
        enemies.push(ne);
        gameScene.physics.add.collider(ne.sprite, platforms);
        gameScene.physics.add.collider(ne.sprite, walls);
    }

    checkHitPlayer() {
        if (isDashing || playerHurtTimer > 0 || playerHP <= 0) return;
        const dx = Math.abs(player.x - this.sprite.x), dy = Math.abs(player.y - this.sprite.y);
        if (dx < 50 && dy < 50) {
            if (isParrying && parryWindow > 0) {
                triggerParrySuccess(gameScene);
                this.hurtTimer = 300; this.sprite.body.setVelocityX((this.facingRight ? -1 : 1) * 300);
                return;
            }
            playerHP -= this.config.attackDmg; playerHurtTimer = PLAYER_HURT_IFRAMES;
            playHurtSound();
            player.body.setVelocityX((this.facingRight ? -1 : 1) * this.config.knockback);
            player.body.setVelocityY(-150); player.setTint(0xff4444);
            gameScene.time.delayedCall(200, () => { if (playerHurtTimer > 0) player.setAlpha(0.6); });
            gameScene.cameras.main.shake(80, 0.005); updateHUD();
            for (let i = 0; i < 6; i++) {
                const px = player.x + Phaser.Math.Between(-10, 10), py = player.y + Phaser.Math.Between(-15, 15);
                const sp = gameScene.add.circle(px, py, 2, 0xff2222, 0.8).setDepth(15);
                gameScene.tweens.add({ targets: sp, x: px + Phaser.Math.Between(-30, 30), y: py - Phaser.Math.Between(10, 40), alpha: 0, duration: 300, onComplete: () => sp.destroy() });
            }
            if (playerHP <= 0) playerDeath();
        }
    }

    update(delta) {
        if (this.dead) return;
        const s = this.sprite;
        if (!s || !s.body) return;
        if (this.hurtTimer > 0) {
            this.hurtTimer -= delta;
            s.setTint(this.hurtTimer % 100 > 50 ? 0xffffff : 0xff4444);
            this.drawHP(); this.updateAnim(delta); return;
        }
        s.clearTint();
        if (this.attackCd > 0) this.attackCd -= delta;
        this.facingRight = player.x > s.x;
        s.setFlipX(!this.facingRight);
        this.updateAI(delta);
        this.updateAnim(delta);
        this.drawHP();
    }

    updateAI(delta) {}
}

// ============================================================
//  ONI
// ============================================================
class EnemyOni extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            prefix: 'oni_f', label: 'ONI', labelColor: '#cc66ff',
            hp: 120, scale: 0.28, attackDmg: 18, knockback: 280,
            speed: 110, chaseRange: 300, attackRange: 55,
            attackDur: 550, attackCooldown: 1300,
            hpColor: 0xcc66ff, hpBorderColor: 0x6633aa,
            bodyWRatio: 0.30, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: EnemyOni.dims,
            anims: { idle:{frames:[0,1,2,3],fps:5,loop:true}, walk:{frames:[4,5,6,7],fps:8,loop:true}, attack:{frames:[8,9,10,11],fps:10,loop:false}, special:{frames:[12,13,14,15],fps:6,loop:false} }
        });
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x - s.x, dist = Math.sqrt(dx*dx + (player.y-s.y)**2);
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('attack');
            if (this.attackTimer < this.config.attackDur*0.3) { s.setTint(0xff6644); if (this.attackTimer < this.config.attackDur*0.25 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < this.config.attackRange && this.attackCd <= 0) { this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0); }
        else if (dist < this.config.chaseRange) { this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed); }
        else { this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(Math.sin(Date.now()*0.001+s.x)*25); }
    }
}

// ============================================================
//  ARCHER
// ============================================================
class EnemyArcher extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            prefix: 'archer_f', label: 'ARCHER', labelColor: '#44cc44',
            hp: 70, scale: 0.26, attackDmg: 10, knockback: 200,
            speed: 130, chaseRange: 400, attackRange: 250, fleeRange: 100,
            attackDur: 600, attackCooldown: 1800,
            hpColor: 0x44cc44, hpBorderColor: 0x226622,
            bodyWRatio: 0.28, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: EnemyArcher.dims,
            anims: { idle:{frames:[0,1,2,3],fps:5,loop:true}, walk:{frames:[4,5,6,7],fps:8,loop:true}, shoot:{frames:[8,9,10,11],fps:8,loop:false}, flee:{frames:[12,13,14,15],fps:10,loop:true} }
        });
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x - s.x, dist = Math.sqrt(dx*dx + (player.y-s.y)**2);
        if (dist < this.config.fleeRange) { this.state='flee'; this.playAnim('flee'); s.body.setVelocityX((dx>0?-1:1)*this.config.speed*1.3); }
        else if (dist < this.config.attackRange && this.attackCd <= 0) {
            this.state='shoot'; this.playAnim('shoot'); s.body.setVelocityX(0); this.attackCd=this.config.attackCooldown;
            gameScene.time.delayedCall(300, () => { if (!this.dead) this.fireArrow(); });
        } else if (dist < this.config.chaseRange && dist > this.config.attackRange*0.8) { this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed*0.7); }
        else { this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); }
    }
    fireArrow() {
        playArrowSound(); const dir = this.facingRight?1:-1;
        const ax = this.sprite.x+dir*20, ay = this.sprite.y-5;
        const arrow = gameScene.add.graphics().setDepth(15);
        arrow.lineStyle(2,0x88ff88,1); arrow.lineBetween(0,0,dir*18,0);
        arrow.fillStyle(0xffffff,1); arrow.fillTriangle(dir*18,-3,dir*18,3,dir*24,0);
        arrow.setPosition(ax, ay);
        projectiles.push({gfx:arrow, x:ax, y:ay, vx:dir*450, vy:0, life:2000, dmg:this.config.attackDmg});
    }
}

// ============================================================
//  SHIELD
// ============================================================
class EnemyShield extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            prefix: 'shield_f', label: 'SHIELD', labelColor: '#ff6644',
            hp: 200, scale: 0.30, attackDmg: 20, knockback: 350,
            speed: 55, chaseRange: 250, attackRange: 50,
            attackDur: 700, attackCooldown: 2000,
            hpColor: 0xcc4422, hpBorderColor: 0x662211,
            bodyWRatio: 0.35, bodyHRatio: 0.55, bodyYOffset: 0.28,
            dims: EnemyShield.dims,
            anims: { idle:{frames:[0,1,2,3],fps:4,loop:true}, walk:{frames:[4,5,6,7],fps:5,loop:true}, block:{frames:[8,9,10,11],fps:6,loop:false}, stagger:{frames:[12,13,14,15],fps:8,loop:false} }
        });
    }
    canTakeDamage(attackDir) {
        const pr = player.x > this.sprite.x, f = this.facingRight;
        if ((f && pr) || (!f && !pr)) { this.showBlock(); return false; }
        return true;
    }
    showBlock() {
        playBlockSound(); this.playAnim('block');
        const s = this.sprite, dir = this.facingRight?1:-1, bx = s.x+dir*25, by = s.y-10;
        for (let i=0;i<6;i++) { const px=bx+Phaser.Math.Between(-5,5), py=by+Phaser.Math.Between(-10,10); const sp=gameScene.add.circle(px,py,2,0xff6644,1).setDepth(16); gameScene.tweens.add({targets:sp,x:px+Phaser.Math.Between(-20,20),y:py+Phaser.Math.Between(-20,5),alpha:0,duration:200,onComplete:()=>sp.destroy()}); }
        const bt = gameScene.add.text(s.x, s.y-40, 'BLOCKED!', {fontFamily:'monospace',fontSize:'10px',color:'#ff6644',fontStyle:'bold'}).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({targets:bt,y:bt.y-20,alpha:0,duration:600,onComplete:()=>bt.destroy()});
        player.body.setVelocityX((player.x>s.x?1:-1)*200);
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x-s.x, dist = Math.sqrt(dx*dx+(player.y-s.y)**2);
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('block');
            if (this.attackTimer < this.config.attackDur*0.3) { s.setTint(0xff6644); if (this.attackTimer < this.config.attackDur*0.25 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < this.config.attackRange && this.attackCd <= 0) { this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0); }
        else if (dist < this.config.chaseRange) { this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed); }
        else { this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); }
    }
}

// ============================================================
//  ASSASSIN
// ============================================================
class EnemyAssassin extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            prefix: 'assassin_f', label: 'ASSASSIN', labelColor: '#44ddcc',
            hp: 80, scale: 0.25, attackDmg: 22, knockback: 200,
            speed: 220, chaseRange: 350, attackRange: 45,
            attackDur: 350, attackCooldown: 900,
            hpColor: 0x44ddcc, hpBorderColor: 0x226655,
            bodyWRatio: 0.26, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: EnemyAssassin.dims,
            anims: { idle:{frames:[0,1,2,3],fps:6,loop:true}, run:{frames:[4,5,6,7],fps:12,loop:true}, attack:{frames:[8,9,10,11],fps:14,loop:false}, vanish:{frames:[12,13,14,15],fps:6,loop:true} }
        });
        this.invisTimer = 0; this.isInvisible = false;
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x-s.x, dist = Math.sqrt(dx*dx+(player.y-s.y)**2);
        if (this.hp < this.maxHp*0.5 && !this.isInvisible && this.invisTimer <= 0) {
            this.isInvisible = true; this.invisTimer = 3000; this.playAnim('vanish'); s.setAlpha(0.1);
            this.typeLabel.setAlpha(0); this.hpGfx.setAlpha(0);
        }
        if (this.isInvisible) { this.invisTimer -= delta; if (this.invisTimer <= 0) { this.isInvisible = false; s.setAlpha(1); this.typeLabel.setAlpha(0.8); this.hpGfx.setAlpha(1); } }
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('attack');
            if (this.attackTimer < this.config.attackDur*0.35) { s.setTint(0x44ddcc); if (this.attackTimer < this.config.attackDur*0.3 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < this.config.attackRange && this.attackCd <= 0 && !this.isInvisible) { this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0); }
        else if (dist < this.config.chaseRange) { this.state='chase'; this.playAnim(this.isInvisible?'vanish':'run'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed); }
        else { this.state='idle'; this.playAnim(this.isInvisible?'vanish':'idle'); s.body.setVelocityX(Math.sin(Date.now()*0.002+s.x)*40); }
    }
}

// ============================================================
//  BOSS — THE GREAT ONI (3x scale, 5x HP, special attacks)
// ============================================================
class BossOni extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            prefix: 'oni_f', label: '', labelColor: '#ff2222',
            hp: 600, scale: 0.84, attackDmg: 25, knockback: 400,
            speed: 80, chaseRange: 600, attackRange: 80,
            attackDur: 600, attackCooldown: 1500,
            hpColor: 0xff2222, hpBorderColor: 0x880000,
            bodyWRatio: 0.30, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: BossOni.dims,
            anims: { idle:{frames:[0,1,2,3],fps:4,loop:true}, walk:{frames:[4,5,6,7],fps:6,loop:true}, attack:{frames:[8,9,10,11],fps:10,loop:false}, special:{frames:[12,13,14,15],fps:8,loop:false} }
        });
        this.specialTimer = 5000; // first special in 5s
        this.isDashing = false;
        this.dashTimer = 0;
        this.isSlamming = false;
        this.slamTimer = 0;
        this.typeLabel.setAlpha(0); // Boss has its own HUD
    }

    drawHP() {
        // Boss doesn't use floating HP bar — uses top HUD
        this.hpGfx.clear();
        if (bossHpGfx) {
            bossHpGfx.clear();
            const z = 1.6;
            const bx = (W/z/2) - 120, by = 58, bw = 240, bh = 10;
            const ratio = Math.max(0, this.hp / this.maxHp);
            const fillW = Math.floor((bw - 4) * ratio);
            // Dark bg
            bossHpGfx.fillStyle(0x1a0000, 0.9); bossHpGfx.fillRoundedRect(bx, by, bw, bh, 5);
            bossHpGfx.lineStyle(1, 0xff2222, 0.6); bossHpGfx.strokeRoundedRect(bx, by, bw, bh, 5);
            if (fillW > 0) {
                let color = ratio > 0.5 ? 0xcc2222 : ratio > 0.25 ? 0xff4400 : 0xff0000;
                bossHpGfx.fillStyle(color, 0.9); bossHpGfx.fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 3);
                bossHpGfx.lineStyle(1, 0xffffff, 0.1); bossHpGfx.lineBetween(bx + 5, by + 3, bx + 2 + fillW - 3, by + 3);
                // Pulsing glow at low HP
                if (ratio < 0.3) {
                    bossHpGfx.lineStyle(2, 0xff0000, 0.3 + Math.sin(Date.now() * 0.005) * 0.2);
                    bossHpGfx.strokeRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 6);
                }
            }
            if (bossHpText) bossHpText.setText(Math.ceil(this.hp) + ' / ' + this.maxHp);
        }
    }

    die() {
        this.dead = true; this.sprite.body.enable = false;
        const s = this.sprite;
        // Epic death — big explosion
        for (let i = 0; i < 30; i++) {
            const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360)), r = Phaser.Math.Between(10, 40);
            const px = s.x + Math.cos(a)*r, py = s.y + Math.sin(a)*r;
            const sp = gameScene.add.rectangle(px, py, Phaser.Math.Between(3, 10), Phaser.Math.Between(3, 10),
                Math.random() < 0.5 ? 0xff2222 : 0xff8844, 1).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + Math.cos(a)*Phaser.Math.Between(50, 150), y: py + Math.sin(a)*Phaser.Math.Between(50, 150) - 30,
                alpha: 0, rotation: Phaser.Math.Between(-5, 5), duration: Phaser.Math.Between(500, 1200), onComplete: () => sp.destroy() });
        }
        // Flash
        const fl = gameScene.add.circle(s.x, s.y, 80, 0xffffff, 0.6).setDepth(50);
        gameScene.tweens.add({ targets: fl, scaleX: 4, scaleY: 4, alpha: 0, duration: 600, onComplete: () => fl.destroy() });
        gameScene.cameras.main.shake(500, 0.015);
        gameScene.tweens.add({ targets: s, alpha: 0, scaleX: 0, scaleY: 0, duration: 800, ease: 'Power3',
            onComplete: () => { s.destroy(); this.hpGfx.destroy(); this.typeLabel.destroy(); }
        });
        // Victory text
        const z = 1.6;
        const vt = gameScene.add.text(W/z/2, H/z/2 - 20, 'VICTORY!', { fontFamily: 'monospace', fontSize: '28px', color: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: vt, alpha: 1, duration: 800, delay: 600 });
        const st = gameScene.add.text(W/z/2, H/z/2 + 15, 'The Great Oni has fallen.', { fontFamily: 'monospace', fontSize: '10px', color: '#ccaa44' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: st, alpha: 1, duration: 800, delay: 1200 });
        if (bossNameText) bossNameText.setText('DEFEATED');
    }

    updateAI(delta) {
        const s = this.sprite, dx = player.x - s.x, dist = Math.sqrt(dx*dx + (player.y-s.y)**2);

        // Special attack timer
        this.specialTimer -= delta;
        if (this.specialTimer <= 0 && this.state !== 'attack' && !this.isDashing && !this.isSlamming) {
            if (Math.random() < 0.5) this.startSlam();
            else this.startDashAttack();
            this.specialTimer = 4000 + Math.random() * 2000;
            return;
        }

        // Slam
        if (this.isSlamming) {
            this.slamTimer -= delta;
            this.playAnim('special');
            if (this.slamTimer <= 0) { this.isSlamming = false; s.clearTint(); }
            s.body.setVelocityX(0);
            return;
        }

        // Dash attack
        if (this.isDashing) {
            this.dashTimer -= delta;
            this.playAnim('attack'); s.setTint(0xff4400);
            if (this.dashTimer <= 0) { this.isDashing = false; s.body.setVelocityX(0); s.clearTint(); this.attackCd = 1000; }
            // Check hit during dash
            if (Math.abs(player.x - s.x) < 60 && Math.abs(player.y - s.y) < 60) this.checkHitPlayer();
            return;
        }

        // Normal melee
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('attack');
            if (this.attackTimer < this.config.attackDur*0.3) { s.setTint(0xff2222); if (this.attackTimer < this.config.attackDur*0.25 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < this.config.attackRange && this.attackCd <= 0) {
            this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0);
        } else if (dist < this.config.chaseRange) {
            this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed);
        } else {
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0);
        }
    }

    startSlam() {
        this.isSlamming = true; this.slamTimer = 800;
        this.playAnim('special'); this.sprite.setTint(0xff8800);
        this.sprite.body.setVelocityX(0);
        playSlamSound();

        // Delayed slam impact
        gameScene.time.delayedCall(400, () => {
            if (this.dead) return;
            gameScene.cameras.main.shake(300, 0.012);
            // Shockwave
            const sx = this.sprite.x, sy = this.sprite.y + 20;
            const wave = gameScene.add.graphics().setDepth(14);
            wave.lineStyle(4, 0xff4400, 0.6); wave.strokeCircle(sx, sy, 30);
            wave.lineStyle(2, 0xffaa00, 0.4); wave.strokeCircle(sx, sy, 60);
            gameScene.tweens.add({ targets: wave, scaleX: 3, scaleY: 1.5, alpha: 0, duration: 500, onComplete: () => wave.destroy() });
            // Ground debris
            for (let i = 0; i < 10; i++) {
                const px = sx + Phaser.Math.Between(-100, 100), py = sy;
                const db = gameScene.add.rectangle(px, py, Phaser.Math.Between(3, 8), Phaser.Math.Between(3, 8), 0x664422, 1).setDepth(14);
                gameScene.tweens.add({ targets: db, y: py - Phaser.Math.Between(30, 80), x: px + Phaser.Math.Between(-30, 30), alpha: 0, duration: 600, onComplete: () => db.destroy() });
            }
            // Damage nearby player
            if (!isDashing && playerHurtTimer <= 0 && playerHP > 0) {
                const pdist = Math.abs(player.x - sx);
                if (pdist < 150 && Math.abs(player.y - sy) < 80) {
                    playerHP -= 20; playerHurtTimer = PLAYER_HURT_IFRAMES;
                    playHurtSound();
                    player.body.setVelocityY(-300);
                    player.body.setVelocityX((player.x > sx ? 1 : -1) * 350);
                    player.setTint(0xff4444);
                    gameScene.cameras.main.shake(100, 0.008);
                    updateHUD();
                    if (playerHP <= 0) playerDeath();
                }
            }
        });
    }

    startDashAttack() {
        this.isDashing = true; this.dashTimer = 500;
        const dir = this.facingRight ? 1 : -1;
        this.sprite.body.setVelocityX(dir * 600);
        this.sprite.setTint(0xff4400);
        this.playAnim('attack');
        // Dash trail
        for (let i = 0; i < 4; i++) {
            gameScene.time.delayedCall(i * 80, () => {
                if (this.dead) return;
                const ghost = gameScene.add.sprite(this.sprite.x, this.sprite.y, this.sprite.texture.key)
                    .setScale(this.sprite.scaleX).setFlipX(!this.facingRight).setDepth(8).setTint(0xff2200).setAlpha(0.4);
                gameScene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
            });
        }
    }
}

// ============================================================
//  PROJECTILES
// ============================================================
function updateProjectiles(delta) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life -= delta; p.x += p.vx*(delta/1000); p.y += p.vy*(delta/1000);
        p.gfx.setPosition(p.x, p.y);
        if (!isDashing && playerHurtTimer <= 0 && playerHP > 0) {
            if (Math.abs(p.x-player.x)<20 && Math.abs(p.y-player.y)<30) {
                playerHP -= p.dmg; playerHurtTimer = PLAYER_HURT_IFRAMES; playHurtSound();
                player.body.setVelocityX((p.vx>0?1:-1)*150); player.body.setVelocityY(-80);
                player.setTint(0xff4444); gameScene.cameras.main.shake(60,0.003);
                updateHUD(); if (playerHP<=0) playerDeath();
                p.gfx.destroy(); projectiles.splice(i,1); continue;
            }
        }
        if (p.life<=0||p.x<-50||p.x>W+50) { p.gfx.destroy(); projectiles.splice(i,1); }
    }
}

// ============================================================
//  PLATFORMS — NEON GOLD, alpha 0.6
// ============================================================
function makePlatform(scene, x, y, w, h, type) {
    const key = 'p_' + x + '_' + y + '_' + currentRoom;
    const g = scene.add.graphics();
    if (type === 'ground') {
        g.fillStyle(0x1a1408, 1); g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0xccaa44, 0.7); g.lineBetween(0, 0, w, 0);
        g.lineStyle(1, 0x886622, 0.4); g.lineBetween(0, h - 1, w, h - 1);
    } else {
        // Neon gold platform
        g.fillStyle(0x1a1408, 1); g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0xddaa33, 0.8); g.lineBetween(0, 0, w, 0);
        g.lineStyle(1, 0xffcc44, 0.3); g.lineBetween(2, 1, w - 2, 1);
        g.lineStyle(1, 0x886622, 0.5); g.lineBetween(0, h - 1, w, h - 1);
    }
    g.generateTexture(key, w, h); g.destroy();
    const plat = platforms.create(x, y, key);
    plat.setAlpha(0.6);
    plat.body.setSize(w - 4, h - 2).setOffset(2, 1);
    plat.refreshBody();
}

function makeWall(scene, x, y, w, h) {
    const key = 'w_' + x + '_' + y + '_' + currentRoom;
    const g = scene.add.graphics();
    g.fillStyle(0x0e0e18, 1); g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h); g.destroy();
    const wall = walls.create(x, y, key);
    wall.setAlpha(0.2);
    wall.body.setSize(w - 6, h).setOffset(3, 0);
    wall.refreshBody();
}

// ============================================================
//  HUD
// ============================================================
function createHUD(scene) {
    const z = 1.6;
    scene.add.text(16, 16, 'A/D Move  W/SPACE Jump(x2)  SHIFT Dash  X Attack  C Parry', {
        fontFamily: 'monospace', fontSize: '10px', color: '#445566'
    }).setDepth(100).setScrollFactor(0);
    scene.add.text(W / z - 16, 16, "RONIN'S REDEMPTION", {
        fontFamily: 'monospace', fontSize: '13px', color: '#334455', fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(100).setScrollFactor(0);
    hpBarGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
    hpText = scene.add.text(92, 36, '100', { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff' }).setOrigin(0.5, 0.5).setDepth(102).setScrollFactor(0);
    scene.comboText = scene.add.text(W/z/2, H/z - 40, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.parryText = scene.add.text(W/z/2, H/z - 65, '', { fontFamily: 'monospace', fontSize: '14px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    drawPlayerHP();
}

function drawPlayerHP() {
    const g = hpBarGfx; g.clear();
    const bx = 16, by = 30, bw = 160, bh = 12;
    const ratio = Math.max(0, playerHP / playerMaxHP);
    const fillW = Math.floor((bw - 4) * ratio);
    g.fillStyle(0x0a0a1a, 0.85); g.fillRoundedRect(bx, by, bw, bh, 6);
    g.lineStyle(1, 0x334466, 0.7); g.strokeRoundedRect(bx, by, bw, bh, 6);
    if (fillW > 0) {
        let fc = ratio > 0.6 ? 0x22cc55 : ratio > 0.3 ? 0xcccc22 : 0xcc2222;
        g.fillStyle(fc, 0.9); g.fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 4);
        g.lineStyle(1, 0xffffff, 0.15); g.lineBetween(bx + 6, by + 3, bx + 2 + fillW - 4, by + 3);
        if (fillW > 8) { g.fillStyle(0xffffff, 0.1); g.fillRoundedRect(bx + 2, by + 2, fillW, (bh - 4) / 2, {tl:4,tr:4,bl:0,br:0}); }
    }
    if (hpText) hpText.setText(Math.ceil(playerHP));
}
function updateHUD() { drawPlayerHP(); }

// ============================================================
//  PLAYER ANIMATION (3x3 = 9 frames, trimmed)
// ============================================================
const ANIMS = {
    idle:      { frames: [0, 1, 2], fps: 5, loop: true },
    run:       { frames: [3, 4, 5], fps: 9, loop: true },
    attack:    { frames: [6, 7, 8], fps: 12, loop: false },
    jump:      { frames: [3], fps: 1, loop: false },
    fall:      { frames: [4], fps: 1, loop: false },
    wallslide: { frames: [5], fps: 1, loop: false },
    dash:      { frames: [6], fps: 1, loop: false },
    parry:     { frames: [1], fps: 1, loop: false }
};

function playAnim(name) {
    if (!player || player.currentAnim === name) return;
    player.currentAnim = name; player.animFrame = 0; player.animTimer = 0;
    player.setTexture('sam_f' + ANIMS[name].frames[0]);
}

function updateAnimation(delta) {
    if (!player) return;
    const anim = ANIMS[player.currentAnim];
    if (!anim || anim.frames.length <= 1) return;
    player.animTimer += delta;
    if (player.animTimer >= 1000 / anim.fps) {
        player.animTimer -= 1000 / anim.fps; player.animFrame++;
        if (player.animFrame >= anim.frames.length) player.animFrame = anim.loop ? 0 : anim.frames.length - 1;
        player.setTexture('sam_f' + anim.frames[player.animFrame]);
    }
}

// ============================================================
//  PLAYER DEATH
// ============================================================
function playerDeath() {
    playerHP = 0; updateHUD();
    const fl = gameScene.add.rectangle(W/2, H/2, W, H, 0xff0000, 0.3).setDepth(200).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
    const z = 1.6;
    const dt = gameScene.add.text(W/z/2, H/z/2, 'DEATH', { fontFamily:'monospace', fontSize:'32px', color:'#ff2222', fontStyle:'bold' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: dt, alpha: 1, duration: 500 });
    const rt = gameScene.add.text(W/z/2, H/z/2+30, 'Press R to revive', { fontFamily:'monospace', fontSize:'12px', color:'#888888' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: rt, alpha: 1, duration: 500, delay: 500 });
    const rKey = gameScene.input.keyboard.addKey('R');
    const reviveHandler = () => {
        playerHP = playerMaxHP; playerHurtTimer = PLAYER_HURT_IFRAMES; updateHUD();
        player.setAlpha(1).clearTint(); player.setPosition(currentRoom==='boss'?80:640, 600); player.body.setVelocity(0,0);
        dt.destroy(); rt.destroy(); rKey.off('down', reviveHandler);
    };
    rKey.on('down', reviveHandler);
}

// ============================================================
//  UPDATE
// ============================================================
function update(time, delta) {
    if (!player || !player.body) return;
    if (playerHP <= 0) return;
    if (transitioning) return;

    emberTimer -= delta;
    if (emberTimer <= 0) { spawnEmber(gameScene); emberTimer = Phaser.Math.Between(80, 200); }
    if (playerGlow) playerGlow.setPosition(player.x, player.y - 10);

    if (playerHurtTimer > 0) {
        playerHurtTimer -= delta;
        player.setAlpha(playerHurtTimer % 80 > 40 ? 0.4 : 0.9);
        if (playerHurtTimer <= 0) player.setAlpha(1).clearTint();
    }
    if (hitstopTimer > 0) { hitstopTimer -= delta; return; }

    enemies.forEach(e => e.update(delta));
    updateProjectiles(delta);
    updateParry(delta);
    if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) resetCombo(); }

    // Portal check
    if (currentRoom === 'main' && portalZone && !transitioning) {
        const px = player.x, py = player.y;
        if (px > 1220 && py > 560 && py < 720) {
            transitionToRoom('boss');
            return;
        }
    }

    if (isAttacking) {
        attackTimer -= delta; updateAnimation(delta);
        if (attackTimer <= 0) { isAttacking = false; clearSlash(); }
        else return;
    }

    const body = player.body;
    const onGround = body.blocked.down || body.touching.down;
    const onL = body.blocked.left, onR = body.blocked.right;
    onWall = !onGround && (onL || onR);

    if (onGround) { jumpCount = 0; coyoteTimer = COYOTE_TIME; }
    else if (coyoteTimer > 0) coyoteTimer -= delta;
    if (jumpBufferTimer > 0) jumpBufferTimer -= delta;

    if (isDashing) { dashTime -= delta; if (dashTime <= 0) endDash(); else { spawnDashGhost(gameScene); return; } }

    const mL = keys.A.isDown || cursors.left.isDown;
    const mR = keys.D.isDown || cursors.right.isDown;
    const wantJump = Phaser.Input.Keyboard.JustDown(keys.SPACE) || Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(keys.W);
    const holdJump = keys.W.isDown || keys.SPACE.isDown || cursors.up.isDown;

    if (onWall && !onGround) {
        wallDirection = onL ? -1 : 1;
        if (body.velocity.y > WALL_SLIDE) body.setVelocityY(WALL_SLIDE);
        jumpCount = 0;
        if (mL && !onL) { body.setVelocityX(-MOVE_SPEED); facingRight = false; }
        else if (mR && !onR) { body.setVelocityX(MOVE_SPEED); facingRight = true; }
        else body.setVelocityX(0);
    } else if (!isParrying) {
        if (mL) { body.setVelocityX(-MOVE_SPEED); facingRight = false; }
        else if (mR) { body.setVelocityX(MOVE_SPEED); facingRight = true; }
        else {
            const decel = onGround ? GROUND_DECEL : AIR_DECEL;
            const vx = body.velocity.x;
            if (Math.abs(vx) < 10) body.setVelocityX(0);
            else body.setVelocityX(vx - Math.sign(vx) * decel * (delta / 1000));
        }
    }
    player.setFlipX(!facingRight);

    if (wantJump) jumpBufferTimer = JUMP_BUFFER;
    if (holdJump && onGround && jumpCount === 0 && jumpBufferTimer <= 0) jumpBufferTimer = JUMP_BUFFER;
    if (jumpBufferTimer > 0) {
        if (onWall && !onGround) { body.setVelocityX((wallDirection===-1?1:-1)*WALL_JUMP_X); body.setVelocityY(WALL_JUMP_Y); facingRight=wallDirection===-1; jumpCount=0; onWall=false; jumpBufferTimer=0; }
        else if (onGround||coyoteTimer>0) { body.setVelocityY(JUMP_FORCE); jumpCount=1; jumpBufferTimer=0; coyoteTimer=0; }
        else if (jumpCount>0&&jumpCount<maxJumps) { body.setVelocityY(DOUBLE_JUMP_FORCE); jumpCount=maxJumps; jumpBufferTimer=0; spawnJumpPuff(gameScene,player.x,player.y+30); }
    }

    if (!isAttacking && !isDashing && !isParrying) {
        if (onWall && !onGround) playAnim('wallslide');
        else if (!onGround) { body.velocity.y < 0 ? playAnim('jump') : playAnim('fall'); }
        else if (mL || mR) playAnim('run');
        else playAnim('idle');
    }
    updateAnimation(delta);

    if (Phaser.Input.Keyboard.JustDown(keys.SHIFT) && canDash && !isDashing) startDash(gameScene);
    if (Phaser.Input.Keyboard.JustDown(keys.X)) triggerAttack();
    if (Phaser.Input.Keyboard.JustDown(keys.C)) triggerParry();
}

function spawnJumpPuff(scene, x, y) {
    for (let i = 0; i < 4; i++) {
        const px = x + Phaser.Math.Between(-10, 10);
        const p = scene.add.circle(px, y, Phaser.Math.Between(2, 5), 0x8888aa, 0.4).setDepth(8);
        scene.tweens.add({ targets: p, y: y + 15, scaleX: 2, scaleY: 0.3, alpha: 0, duration: 250, onComplete: () => p.destroy() });
    }
}

// ============================================================
//  COMBAT
// ============================================================
function triggerAttack() {
    if (!canAttack || isDashing || isParrying || playerHP <= 0) return;
    isAttacking = true; canAttack = false;
    const step = comboStep % 3, atk = ATTACKS[step], dir = facingRight ? 1 : -1;
    playAnim('attack'); attackTimer = atk.dur;
    playSlashSound();
    const hx = player.x + atk.hb.ox * dir, hy = player.y + atk.hb.oy;
    drawBladeTrail(gameScene, hx, hy, atk, dir, step);
    spawnEnergyWave(gameScene, hx, hy, atk, dir, step);
    spawnBladeParticles(gameScene, hx, hy, dir, step);
    player.body.setVelocityX(dir * atk.lunge);
    enemies.forEach(e => {
        if (e.dead || e.hurtTimer > 0) return;
        const hitRange = e instanceof BossOni ? atk.hb.w + 40 : atk.hb.w;
        const hitH = e instanceof BossOni ? atk.hb.h + 60 : atk.hb.h + 20;
        if (Math.abs(e.sprite.x - hx) < hitRange && Math.abs(e.sprite.y - hy) < hitH) {
            if (e.canTakeDamage(dir)) e.takeDamage(atk.dmg, dir);
        }
    });
    hitstopTimer = HITSTOP_MS;
    player.setTint(0xffffff);
    gameScene.time.delayedCall(HITSTOP_MS + 40, () => { if (!isParrying && !onWall && playerHurtTimer <= 0) player.clearTint(); });
    gameScene.cameras.main.shake(80, atk.shake);
    const colors = ['#eeeeff', '#ff8899', '#ff3322'];
    gameScene.comboText.setText(atk.name).setColor(colors[step]).setAlpha(1).setScale(step === 2 ? 1.5 : 1.1);
    gameScene.tweens.add({ targets: gameScene.comboText, alpha: 0, duration: 700, ease: 'Power2' });
    comboStep = step + 1; comboTimer = COMBO_WINDOW;
    gameScene.time.delayedCall(atk.dur + atk.cd, () => { canAttack = true; });
    if (comboStep >= 3) gameScene.time.delayedCall(atk.dur + 50, () => resetCombo());
}

function spawnEnergyWave(scene, x, y, atk, dir, step) {
    const g = scene.add.graphics().setDepth(13); const t = atk.trail;
    const sa = Phaser.Math.DegToRad(t.sa*dir), ea = Phaser.Math.DegToRad(t.ea*dir), ccw = dir < 0, r = t.r + 20;
    g.lineStyle(step===2?18:12, 0xff1100, 0.15); g.beginPath(); g.arc(x,y,r+15,sa,ea,ccw); g.strokePath();
    g.lineStyle(step===2?12:8, 0xff2200, 0.25); g.beginPath(); g.arc(x,y,r+8,sa,ea,ccw); g.strokePath();
    g.lineStyle(step===2?6:4, 0xff4422, 0.5); g.beginPath(); g.arc(x,y,r,sa,ea,ccw); g.strokePath();
    g.lineStyle(2, 0xff8866, 0.7); g.beginPath(); g.arc(x,y,r-3,sa,ea,ccw); g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: step===2?350:250, ease: 'Power2', onComplete: () => g.destroy() });
    if (step===2) { const ring=scene.add.graphics().setDepth(12); ring.lineStyle(3,0xff2200,0.4); ring.strokeCircle(x,y,20); ring.lineStyle(1,0xff6644,0.6); ring.strokeCircle(x,y,12); scene.tweens.add({targets:ring,scaleX:3,scaleY:3,alpha:0,duration:300,ease:'Power3',onComplete:()=>ring.destroy()}); }
    for (let i=0;i<(step===2?10:5);i++) { const ang=Phaser.Math.FloatBetween(Math.min(sa,ea),Math.max(sa,ea)),pr=r+Phaser.Math.Between(-5,10),px=x+Math.cos(ang)*pr,py=y+Math.sin(ang)*pr; const ep=scene.add.circle(px,py,Phaser.Math.Between(1,3),0xff3311,0.8).setDepth(14); scene.tweens.add({targets:ep,x:px+Math.cos(ang)*Phaser.Math.Between(15,45),y:py+Math.sin(ang)*Phaser.Math.Between(15,45),alpha:0,duration:Phaser.Math.Between(150,350),onComplete:()=>ep.destroy()}); }
}

function drawBladeTrail(scene, x, y, atk, dir, step) {
    clearSlash(); const g = scene.add.graphics().setDepth(15); slashGfx.push(g); const t = atk.trail;
    const sa=Phaser.Math.DegToRad(t.sa*dir),ea=Phaser.Math.DegToRad(t.ea*dir),ccw=dir<0;
    g.lineStyle(t.w+6,0xff3322,0.15); g.beginPath(); g.arc(x,y,t.r+8,sa,ea,ccw); g.strokePath();
    g.lineStyle(t.w,0xffeedd,0.9); g.beginPath(); g.arc(x,y,t.r,sa,ea,ccw); g.strokePath();
    g.lineStyle(Math.max(2,t.w-3),0xffffff,1); g.beginPath(); g.arc(x,y,t.r-3,sa,ea,ccw); g.strokePath();
    const tx=x+Math.cos(ea)*t.r,ty=y+Math.sin(ea)*t.r;
    g.fillStyle(0xffffff,0.9); g.fillCircle(tx,ty,step===2?6:4);
    g.fillStyle(0xff4422,0.3); g.fillCircle(tx,ty,step===2?14:10);
    scene.tweens.add({targets:g,alpha:0,duration:step===2?280:200,ease:'Power3',onComplete:()=>g.destroy()});
}

function spawnBladeParticles(scene, x, y, dir, step) {
    for (let i=0;i<(step===2?14:8);i++) { const px=x+Phaser.Math.Between(-15,15),py=y+Phaser.Math.Between(-20,20); const wh=Math.random()<0.4; const c=wh?0xffffff:(Math.random()<0.5?0xff3322:0xff6644); const s=Phaser.Math.Between(1,wh?3:5); const p=scene.add.rectangle(px,py,s,s,c,wh?1:0.8).setDepth(16); scene.tweens.add({targets:p,x:px+dir*Phaser.Math.Between(20,80),y:py+Phaser.Math.Between(-35,25),alpha:0,scaleX:0,scaleY:0,duration:Phaser.Math.Between(150,400),ease:'Power2',onComplete:()=>p.destroy()}); }
    if (step===2) { const fl=scene.add.circle(x,y,20,0xffffff,0.4).setDepth(13); scene.tweens.add({targets:fl,scaleX:2.5,scaleY:2.5,alpha:0,duration:200,ease:'Power3',onComplete:()=>fl.destroy()}); }
}

function clearSlash() { slashGfx.forEach(g => { if (g && g.scene) g.destroy() }); slashGfx = []; }
function resetCombo() { comboStep = 0; comboTimer = 0; }

// ============================================================
//  DASH
// ============================================================
function startDash(scene) {
    isDashing=true; canDash=false; dashTime=DASH_DURATION;
    player.body.allowGravity=false; player.body.setVelocityY(0); playAnim('dash');
    player.body.setVelocityX(DASH_SPEED*(facingRight?1:-1)); playDashSound();
    const fl=scene.add.circle(player.x,player.y,30,0xffffff,0.5).setDepth(9); scene.tweens.add({targets:fl,scaleX:3,scaleY:3,alpha:0,duration:200,ease:'Power3',onComplete:()=>fl.destroy()});
    const d=facingRight?-1:1; for(let i=0;i<6;i++){const ly=player.y+Phaser.Math.Between(-30,30),lx=player.x+d*Phaser.Math.Between(10,40);const ln=scene.add.rectangle(lx,ly,Phaser.Math.Between(20,50),1,0xffffff,0.6).setDepth(8);scene.tweens.add({targets:ln,x:lx+d*80,alpha:0,scaleX:0.3,duration:200,ease:'Power2',onComplete:()=>ln.destroy()});}
    scene.cameras.main.shake(100,0.004); spawnDashGhost(scene);
    scene.time.addEvent({delay:25,repeat:Math.floor(DASH_DURATION/25)-1,callback:()=>{if(isDashing)spawnDashGhost(scene);}});
    scene.time.delayedCall(DASH_COOLDOWN,()=>{canDash=true;});
}
function endDash() { isDashing=false; dashTime=0; player.body.allowGravity=true; player.body.setVelocityX(player.body.velocity.x*0.2); const fl=gameScene.add.circle(player.x,player.y,15,0xff4422,0.3).setDepth(9); gameScene.tweens.add({targets:fl,scaleX:2,scaleY:2,alpha:0,duration:150,onComplete:()=>fl.destroy()}); }
function spawnDashGhost(scene) {
    const curTex=player.texture.key,sc=player.scaleX;
    const wg=scene.add.sprite(player.x,player.y,curTex).setScale(sc).setFlipX(!facingRight).setDepth(8).setTint(0xffffff).setAlpha(0.5);
    scene.tweens.add({targets:wg,alpha:0,scaleX:sc*1.05,scaleY:sc*1.05,duration:180,ease:'Power2',onComplete:()=>wg.destroy()});
    const rg=scene.add.sprite(player.x,player.y,curTex).setScale(sc).setFlipX(!facingRight).setDepth(7).setTint(0xff2200).setAlpha(0.3);
    scene.tweens.add({targets:rg,alpha:0,scaleX:sc*1.1,scaleY:sc*1.1,duration:280,ease:'Power2',onComplete:()=>rg.destroy()});
}

// ============================================================
//  PARRY
// ============================================================
function triggerParry() {
    if(parryCooldown>0||isParrying||isDashing||isAttacking||playerHP<=0) return;
    isParrying=true; parryTimer=PARRY_TOTAL; parryWindow=PARRY_ACTIVE; parryCooldown=PARRY_CD;
    player.body.setVelocityX(0); playAnim('parry'); player.setTint(0x00ffaa);
    const dir=facingRight?1:-1; parryFlash=gameScene.add.graphics().setDepth(12);
    const cx=player.x+30*dir,cy=player.y-10;
    parryFlash.lineStyle(3,0x00ffaa,0.6); parryFlash.strokeCircle(cx,cy,28);
    parryFlash.lineStyle(1.5,0xffffff,0.8); parryFlash.strokeCircle(cx,cy,18);
    parryFlash.lineStyle(2,0x00ffaa,0.9); parryFlash.lineBetween(cx-5,cy-6,cx+5,cy+6); parryFlash.lineBetween(cx-5,cy+2,cx+5,cy+2);
    gameScene.tweens.add({targets:parryFlash,alpha:0,duration:PARRY_ACTIVE,ease:'Power2'});
    gameScene.parryText.setText('PARRY').setAlpha(1); gameScene.tweens.add({targets:gameScene.parryText,alpha:0,duration:PARRY_ACTIVE+100});
}
function updateParry(delta) {
    if(parryWindow>0){parryWindow-=delta;if(parryWindow<=0&&playerHurtTimer<=0)player.setTint(0x338866);}
    if(parryTimer>0){parryTimer-=delta;if(parryTimer<=0)endParry();}
    if(parryCooldown>0&&!isParrying)parryCooldown-=delta;
}
function endParry(){isParrying=false;parryTimer=0;parryWindow=0;if(playerHurtTimer<=0)player.clearTint();if(parryFlash){parryFlash.destroy();parryFlash=null;}}
function triggerParrySuccess(scene) {
    scene.cameras.main.shake(150,0.008); hitstopTimer=120;
    const fl=scene.add.rectangle(player.x,player.y,400,400,0xffffff,0.3).setDepth(50); scene.tweens.add({targets:fl,alpha:0,duration:100,onComplete:()=>fl.destroy()});
    for(let i=0;i<14;i++){const a=Phaser.Math.DegToRad(Phaser.Math.Between(0,360));const px=player.x+Math.cos(a)*10,py=player.y+Math.sin(a)*10;const sp=scene.add.rectangle(px,py,3,3,Math.random()<0.5?0x00ffaa:0xffffff,1).setDepth(16);scene.tweens.add({targets:sp,x:px+Math.cos(a)*50,y:py+Math.sin(a)*50,alpha:0,duration:Phaser.Math.Between(100,300),onComplete:()=>sp.destroy()});}
    scene.parryText.setText('PERFECT PARRY!').setColor('#00ffaa').setAlpha(1).setScale(1.4);
    scene.tweens.add({targets:scene.parryText,alpha:0,scale:1,duration:800});
    canAttack=true; comboStep=0; endParry();
}

// ============================================================
//  EMBERS
// ============================================================
function spawnEmber(scene) {
    const x=Phaser.Math.Between(50,W-50),y=Phaser.Math.Between(350,H);
    const c=Math.random()<0.7?(Math.random()<0.5?0xff3322:0xff6644):0xffaa77;
    const em=scene.add.circle(x,y,Phaser.Math.Between(1,3),c,Phaser.Math.FloatBetween(0.3,0.7)).setDepth(1);
    scene.tweens.add({targets:em,x:x+Phaser.Math.Between(-30,30),y:y-Phaser.Math.Between(80,250),alpha:0,duration:Phaser.Math.Between(2000,4000),ease:'Sine.easeOut',onComplete:()=>em.destroy()});
}
function onLand(p){if(p.body.blocked.down||p.body.touching.down)jumpCount=0;}
