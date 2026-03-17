// ============================================================
//  RONIN'S REDEMPTION — Full Combat + Sprite Enemies + Audio
//  Player: samurai_sheet.jpg (4x3, 12 frames)
//  Enemy:  enemy_sheet.jpg   (4x3, 12 frames)
//  Audio:  Web Audio API procedural sound effects
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

// ===================== ENEMY STATE =====================
let enemies = [];
let playerHP = 100, playerMaxHP = 100;
let playerHurtTimer = 0;
const PLAYER_HURT_IFRAMES = 600;

// ===================== AUDIO =====================
let audioCtx = null;

// ===================== HUD =====================
let hpBarBg, hpBarFill, hpBarBorder, hpText;

// ===================== SPRITE SHEET =====================
const SHEET_COLS = 4, SHEET_ROWS = 3;

const CHAR_SCALE = 0.32;
const BODY_W = 100, BODY_H = 200, BODY_OX = 78, BODY_OY = 80;

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

// ===================== ONI CONFIG =====================
const ONI = {
    hp: 100, speed: 120, chaseRange: 300, attackRange: 55,
    attackDur: 500, attackCd: 1200, attackDmg: 15, knockback: 250,
    scale: 0.25,
    // Enemy body: character in frames sits roughly x=60..200, y=100..310
    bodyW: 80, bodyH: 180, bodyOX: 88, bodyOY: 100
};

const ONI_ANIMS = {
    idle:   { frames: [0, 1, 2, 3], fps: 5, loop: true },
    walk:   { frames: [4, 5, 6, 7], fps: 8, loop: true },
    attack: { frames: [8, 9, 10, 11], fps: 10, loop: false }
};

// ============================================================
//  WEB AUDIO — Procedural Sound Effects (no external files)
// ============================================================
function initWebAudio() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
}

function playSlashSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    // White noise burst + high-pass = sword whoosh
    const dur = 0.12 + Math.random() * 0.06;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        const env = 1 - (i / data.length);
        data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2000 + Math.random() * 2000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(gain).connect(audioCtx.destination);
    src.start(t); src.stop(t + dur);
}

function playHitSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    // Low thud + short noise
    const osc = audioCtx.createOscillator();
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.15);
    // Impact noise
    const dur = 0.06;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const ns = audioCtx.createBufferSource(); ns.buffer = buf;
    const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    ns.connect(ng).connect(audioCtx.destination); ns.start(t); ns.stop(t + dur);
}

function playHurtSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    // Descending tone = pain
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.25);
}

function playDashSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    // Fast whoosh
    const dur = 0.1;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        const p = i / data.length;
        data[i] = (Math.random() * 2 - 1) * Math.sin(p * Math.PI) * 0.8;
    }
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.5;
    const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.2, t);
    src.connect(bp).connect(gain).connect(audioCtx.destination);
    src.start(t); src.stop(t + dur);
}

// BGM: simple ambient loop using oscillators
let bgmNodes = null;
function startBGM() {
    if (!audioCtx || bgmNodes) return;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.04;
    gain.connect(audioCtx.destination);
    const notes = [110, 146.83, 164.81, 130.81]; // Am chord tones
    const oscs = notes.map((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = i < 2 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const g = audioCtx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.3;
        // Slow LFO for atmosphere
        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 0.1 + i * 0.05;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.15;
        lfo.connect(lfoGain).connect(g.gain);
        lfo.start();
        osc.connect(g).connect(gain);
        osc.start();
        return { osc, lfo };
    });
    bgmNodes = { gain, oscs };
}

// ============================================================
//  SCENE
// ============================================================
function preload() {
    this.load.image('bg_castle', 'background.png');
    this.load.image('samurai_raw', 'samurai_sheet.jpg');
    this.load.image('enemy_raw', 'enemy_sheet.jpg');
}

function chromaKeyTexture(scene, srcKey, destKey, keyColor, tol) {
    const src = scene.textures.get(srcKey).getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const dr = Math.abs(d[i] - keyColor.r);
        const dg = Math.abs(d[i + 1] - keyColor.g);
        const db = Math.abs(d[i + 2] - keyColor.b);
        if (dr < tol && dg < tol && db < tol) d[i + 3] = 0;
    }
    ctx.putImageData(imgData, 0, 0);
    scene.textures.addCanvas(destKey, c);
}

function sliceSpriteSheet(scene, sheetKey, prefix) {
    const src = scene.textures.get(sheetKey).getSourceImage();
    const fw = Math.floor(src.width / SHEET_COLS);
    const fh = Math.floor(src.height / SHEET_ROWS);
    for (let row = 0; row < SHEET_ROWS; row++) {
        for (let col = 0; col < SHEET_COLS; col++) {
            const idx = row * SHEET_COLS + col;
            const c = document.createElement('canvas');
            c.width = fw; c.height = fh;
            const ctx = c.getContext('2d');
            ctx.drawImage(src, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
            scene.textures.addCanvas(prefix + idx, c);
        }
    }
}

function create() {
    gameScene = this;

    // Process sprite sheets
    chromaKeyTexture(this, 'samurai_raw', 'samurai_clean', { r: 0, g: 0, b: 0 }, 15);
    sliceSpriteSheet(this, 'samurai_clean', 'sam_f');
    chromaKeyTexture(this, 'enemy_raw', 'enemy_clean', { r: 8, g: 8, b: 8 }, 18);
    sliceSpriteSheet(this, 'enemy_clean', 'oni_f');

    // --- BACKGROUND ---
    drawBackground(this);

    // --- PLATFORMS (semi-transparent, visible) ---
    platforms = this.physics.add.staticGroup();
    makePlatform(this, 640, 694, 1280, 32, 'ground');
    makePlatform(this, 200, 560, 180, 12, 'wood');
    makePlatform(this, 500, 480, 200, 12, 'wood');
    makePlatform(this, 820, 530, 160, 12, 'wood');
    makePlatform(this, 1060, 440, 200, 12, 'wood');
    makePlatform(this, 360, 350, 160, 12, 'wood');
    makePlatform(this, 700, 290, 220, 12, 'wood');
    makePlatform(this, 1010, 240, 180, 12, 'wood');
    makePlatform(this, 200, 200, 140, 12, 'wood');
    makePlatform(this, 560, 150, 160, 12, 'wood');

    // --- WALLS (slightly visible edges) ---
    walls = this.physics.add.staticGroup();
    makeWall(this, 16, 360, 24, 720);
    makeWall(this, 1264, 360, 24, 720);
    makeWall(this, 640, 590, 18, 220);

    // --- PLAYER ---
    player = this.physics.add.sprite(640, 600, 'sam_f0');
    player.setScale(CHAR_SCALE).setBounce(0).setCollideWorldBounds(true).setDepth(10);
    player.body.setSize(BODY_W, BODY_H).setOffset(BODY_OX, BODY_OY);
    player.body.setMaxVelocityY(900);
    player.animFrame = 0;
    player.animTimer = 0;
    player.currentAnim = 'idle';

    // --- PLAYER GLOW ---
    const gc = document.createElement('canvas');
    gc.width = 300; gc.height = 300;
    const gctx = gc.getContext('2d');
    const grad = gctx.createRadialGradient(150, 150, 0, 150, 150, 150);
    grad.addColorStop(0, 'rgba(110,150,240,0.35)');
    grad.addColorStop(0.2, 'rgba(90,120,220,0.2)');
    grad.addColorStop(0.5, 'rgba(60,90,180,0.08)');
    grad.addColorStop(1, 'rgba(40,60,140,0)');
    gctx.fillStyle = grad; gctx.fillRect(0, 0, 300, 300);
    this.textures.addCanvas('glow', gc);
    playerGlow = this.add.image(player.x, player.y, 'glow').setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    // --- SPAWN ENEMIES ---
    spawnOni(this, 900, 640);
    spawnOni(this, 350, 640);
    spawnOni(this, 1100, 380);

    // --- COLLIDERS ---
    this.physics.add.collider(player, platforms, onLand, null, this);
    this.physics.add.collider(player, walls);
    enemies.forEach(e => {
        this.physics.add.collider(e.sprite, platforms);
        this.physics.add.collider(e.sprite, walls);
    });

    // --- CAMERA ---
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(60, 30);
    this.cameras.main.setBounds(0, 0, W, H);

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
        // Unlock Web Audio on first click
        if (!audioCtx) { initWebAudio(); startBGM(); }
    });

    // --- HUD ---
    createHUD(this);

    // --- AUDIO (Web Audio API) ---
    initWebAudio();
    // BGM starts on first user interaction (browser policy)
    this.input.keyboard.on('keydown', () => { if (audioCtx && !bgmNodes) startBGM(); });
}

// ============================================================
//  PLATFORMS (semi-transparent, bg-matching)
// ============================================================
function makePlatform(scene, x, y, w, h, type) {
    const key = 'p_' + x + '_' + y;
    const g = scene.add.graphics();
    if (type === 'ground') {
        // Dark ground strip — blends with background
        g.fillStyle(0x0e0e18, 1); g.fillRect(0, 0, w, h);
        g.lineStyle(1, 0x222244, 0.5); g.lineBetween(0, 0, w, 0);
    } else {
        // Wood platforms — subtle, translucent
        g.fillStyle(0x1a1420, 1); g.fillRect(0, 0, w, h);
        g.lineStyle(1, 0x332844, 0.7); g.lineBetween(0, 0, w, 0);
        g.lineStyle(1, 0x0e0a14, 0.5); g.lineBetween(0, h - 1, w, h - 1);
    }
    g.generateTexture(key, w, h); g.destroy();
    const plat = platforms.create(x, y, key);
    plat.setAlpha(type === 'ground' ? 0.6 : 0.35);
    plat.body.setSize(w - 4, h - 2).setOffset(2, 1);
    plat.refreshBody();
}

function makeWall(scene, x, y, w, h) {
    const key = 'w_' + x + '_' + y;
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

    hpBarBg = scene.add.rectangle(16, 32, 152, 14, 0x111122, 0.8).setOrigin(0, 0).setDepth(100).setScrollFactor(0);
    hpBarFill = scene.add.rectangle(17, 33, 150, 12, 0x22cc44, 1).setOrigin(0, 0).setDepth(101).setScrollFactor(0);
    hpBarBorder = scene.add.rectangle(16, 32, 152, 14).setOrigin(0, 0).setDepth(102).setScrollFactor(0).setStrokeStyle(1, 0x446655, 0.8).setFillStyle(0, 0);
    hpText = scene.add.text(92, 33, '100', { fontFamily: 'monospace', fontSize: '9px', color: '#ffffff' }).setOrigin(0.5, 0).setDepth(102).setScrollFactor(0);

    scene.comboText = scene.add.text(W / z / 2, H / z - 40, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.parryText = scene.add.text(W / z / 2, H / z - 65, '', { fontFamily: 'monospace', fontSize: '14px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
}

function updateHUD() {
    const ratio = Math.max(0, playerHP / playerMaxHP);
    hpBarFill.setDisplaySize(150 * ratio, 12);
    if (ratio > 0.5) hpBarFill.setFillStyle(0x22cc44, 1);
    else if (ratio > 0.25) hpBarFill.setFillStyle(0xcccc22, 1);
    else hpBarFill.setFillStyle(0xcc2222, 1);
    hpText.setText(Math.ceil(playerHP));
}

// ============================================================
//  ONI ENEMY SYSTEM (sprite sheet)
// ============================================================
function spawnOni(scene, x, y) {
    const sprite = scene.physics.add.sprite(x, y, 'oni_f0');
    sprite.setScale(ONI.scale).setDepth(10).setBounce(0).setCollideWorldBounds(true);
    sprite.body.setSize(ONI.bodyW, ONI.bodyH).setOffset(ONI.bodyOX, ONI.bodyOY);
    sprite.body.setMaxVelocityY(900);

    const enemy = {
        sprite, hp: ONI.hp, maxHp: ONI.hp,
        state: 'idle', attackTimer: 0, attackCd: 0, hurtTimer: 0,
        facingRight: false, dead: false,
        animName: 'idle', animFrame: 0, animTimer: 0,
        hpBg: scene.add.rectangle(x, y - 40, 36, 5, 0x220000, 0.8).setDepth(20),
        hpFill: scene.add.rectangle(x, y - 40, 34, 3, 0xcc2222, 1).setDepth(21)
    };
    enemies.push(enemy);
    return enemy;
}

function oniPlayAnim(e, name) {
    if (e.animName === name) return;
    e.animName = name; e.animFrame = 0; e.animTimer = 0;
    e.sprite.setTexture('oni_f' + ONI_ANIMS[name].frames[0]);
}

function oniUpdateAnim(e, delta) {
    const anim = ONI_ANIMS[e.animName];
    if (!anim || anim.frames.length <= 1) return;
    e.animTimer += delta;
    if (e.animTimer >= 1000 / anim.fps) {
        e.animTimer -= 1000 / anim.fps;
        e.animFrame++;
        if (e.animFrame >= anim.frames.length) e.animFrame = anim.loop ? 0 : anim.frames.length - 1;
        e.sprite.setTexture('oni_f' + anim.frames[e.animFrame]);
    }
}

function updateEnemies(delta) {
    enemies.forEach(e => {
        if (e.dead) return;
        const s = e.sprite;
        if (!s || !s.body) return;

        if (e.hurtTimer > 0) {
            e.hurtTimer -= delta;
            s.setTint(e.hurtTimer % 100 > 50 ? 0xffffff : 0xff4444);
            updateEnemyHPBar(e); oniUpdateAnim(e, delta);
            return;
        }
        s.clearTint();
        if (e.attackCd > 0) e.attackCd -= delta;

        const dx = player.x - s.x, dy = player.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        e.facingRight = dx > 0;
        s.setFlipX(!e.facingRight);

        if (e.state === 'attack') {
            e.attackTimer -= delta;
            oniPlayAnim(e, 'attack');
            if (e.attackTimer < ONI.attackDur * 0.3) {
                s.setTint(0xff6644);
                if (e.attackTimer < ONI.attackDur * 0.25 && e.attackTimer > ONI.attackDur * 0.15) checkOniHitPlayer(e);
            }
            if (e.attackTimer <= 0) { e.state = 'idle'; e.attackCd = ONI.attackCd; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < ONI.attackRange && e.attackCd <= 0) {
            e.state = 'attack'; e.attackTimer = ONI.attackDur; s.body.setVelocityX(0);
        } else if (dist < ONI.chaseRange) {
            e.state = 'chase'; oniPlayAnim(e, 'walk');
            s.body.setVelocityX((dx > 0 ? 1 : -1) * ONI.speed);
        } else {
            e.state = 'idle'; oniPlayAnim(e, 'idle');
            s.body.setVelocityX(Math.sin(Date.now() * 0.001 + s.x) * 30);
        }
        oniUpdateAnim(e, delta);
        updateEnemyHPBar(e);
    });
}

function updateEnemyHPBar(e) {
    const s = e.sprite;
    e.hpBg.setPosition(s.x, s.y - 42);
    const ratio = Math.max(0, e.hp / e.maxHp);
    e.hpFill.setPosition(s.x - 17 + 17 * ratio, s.y - 42);
    e.hpFill.setDisplaySize(34 * ratio, 3);
}

function checkOniHitPlayer(e) {
    if (isDashing || playerHurtTimer > 0 || playerHP <= 0) return;
    const dx = Math.abs(player.x - e.sprite.x), dy = Math.abs(player.y - e.sprite.y);
    if (dx < 50 && dy < 50) {
        if (isParrying && parryWindow > 0) {
            triggerParrySuccess(gameScene);
            e.hurtTimer = 300; e.sprite.body.setVelocityX((e.facingRight ? -1 : 1) * 300);
            return;
        }
        playerHP -= ONI.attackDmg; playerHurtTimer = PLAYER_HURT_IFRAMES;
        playHurtSound();
        player.body.setVelocityX((e.facingRight ? -1 : 1) * ONI.knockback);
        player.body.setVelocityY(-150);
        player.setTint(0xff4444);
        gameScene.time.delayedCall(200, () => { if (playerHurtTimer > 0) player.setAlpha(0.6); });
        gameScene.cameras.main.shake(80, 0.005);
        updateHUD();
        for (let i = 0; i < 6; i++) {
            const px = player.x + Phaser.Math.Between(-10, 10), py = player.y + Phaser.Math.Between(-15, 15);
            const sp = gameScene.add.circle(px, py, 2, 0xff2222, 0.8).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + Phaser.Math.Between(-30, 30), y: py - Phaser.Math.Between(10, 40), alpha: 0, duration: 300, onComplete: () => sp.destroy() });
        }
        if (playerHP <= 0) playerDeath();
    }
}

function damageEnemy(e, dmg, dir) {
    if (e.dead) return;
    e.hp -= dmg; e.hurtTimer = 200;
    e.sprite.body.setVelocityX(dir * 300); e.sprite.body.setVelocityY(-100);
    playHitSound();
    const txt = gameScene.add.text(e.sprite.x, e.sprite.y - 30, '-' + dmg, { fontFamily: 'monospace', fontSize: '14px', color: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    gameScene.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, ease: 'Power2', onComplete: () => txt.destroy() });
    for (let i = 0; i < 5; i++) {
        const px = e.sprite.x + Phaser.Math.Between(-8, 8), py = e.sprite.y + Phaser.Math.Between(-15, 10);
        const sp = gameScene.add.circle(px, py, Phaser.Math.Between(1, 3), 0xff4422, 0.9).setDepth(15);
        gameScene.tweens.add({ targets: sp, x: px + dir * Phaser.Math.Between(10, 40), y: py + Phaser.Math.Between(-20, 10), alpha: 0, duration: 250, onComplete: () => sp.destroy() });
    }
    if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
    e.dead = true; e.sprite.body.enable = false;
    const fl = gameScene.add.circle(e.sprite.x, e.sprite.y, 30, 0xff2200, 0.5).setDepth(15);
    gameScene.tweens.add({ targets: fl, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 300, onComplete: () => fl.destroy() });
    for (let i = 0; i < 12; i++) {
        const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360)), r = Phaser.Math.Between(5, 15);
        const px = e.sprite.x + Math.cos(a) * r, py = e.sprite.y + Math.sin(a) * r;
        const sp = gameScene.add.rectangle(px, py, Phaser.Math.Between(2, 6), Phaser.Math.Between(2, 6), Math.random() < 0.5 ? 0xcc2222 : 0xff6644, 1).setDepth(15);
        gameScene.tweens.add({ targets: sp, x: px + Math.cos(a) * Phaser.Math.Between(30, 80), y: py + Math.sin(a) * Phaser.Math.Between(30, 80) - 20, alpha: 0, rotation: Phaser.Math.Between(-3, 3), duration: Phaser.Math.Between(300, 600), onComplete: () => sp.destroy() });
    }
    gameScene.tweens.add({ targets: e.sprite, alpha: 0, scaleX: 0, scaleY: 0, duration: 400, ease: 'Power3', onComplete: () => { e.sprite.destroy(); e.hpBg.destroy(); e.hpFill.destroy(); } });
    const kt = gameScene.add.text(e.sprite.x, e.sprite.y - 40, 'SLAIN', { fontFamily: 'monospace', fontSize: '12px', color: '#ff6644', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    gameScene.tweens.add({ targets: kt, y: kt.y - 30, alpha: 0, duration: 1000, onComplete: () => kt.destroy() });
    gameScene.time.delayedCall(5000, () => {
        const idx = enemies.indexOf(e);
        if (idx !== -1) enemies.splice(idx, 1);
        const ne = spawnOni(gameScene, Phaser.Math.Between(200, 1080), 640);
        gameScene.physics.add.collider(ne.sprite, platforms);
        gameScene.physics.add.collider(ne.sprite, walls);
    });
}

function playerDeath() {
    playerHP = 0; updateHUD();
    const fl = gameScene.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.3).setDepth(200).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
    const z = 1.6;
    const dt = gameScene.add.text(W / z / 2, H / z / 2, 'DEATH', { fontFamily: 'monospace', fontSize: '32px', color: '#ff2222', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: dt, alpha: 1, duration: 500 });
    const rt = gameScene.add.text(W / z / 2, H / z / 2 + 30, 'Press R to revive', { fontFamily: 'monospace', fontSize: '12px', color: '#888888' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: rt, alpha: 1, duration: 500, delay: 500 });
    const rKey = gameScene.input.keyboard.addKey('R');
    const reviveHandler = () => {
        playerHP = playerMaxHP; playerHurtTimer = PLAYER_HURT_IFRAMES; updateHUD();
        player.setAlpha(1).clearTint(); player.setPosition(640, 600); player.body.setVelocity(0, 0);
        dt.destroy(); rt.destroy(); rKey.off('down', reviveHandler);
    };
    rKey.on('down', reviveHandler);
}

// ============================================================
//  SPRITE ANIMATION (player)
// ============================================================
const ANIMS = {
    idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
    run: { frames: [4, 5, 6, 7], fps: 10, loop: true },
    attack: { frames: [8, 9, 10, 11], fps: 12, loop: false },
    jump: { frames: [4], fps: 1, loop: false },
    fall: { frames: [5], fps: 1, loop: false },
    wallslide: { frames: [6], fps: 1, loop: false },
    dash: { frames: [8], fps: 1, loop: false },
    parry: { frames: [1], fps: 1, loop: false }
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
        player.animTimer -= 1000 / anim.fps;
        player.animFrame++;
        if (player.animFrame >= anim.frames.length) player.animFrame = anim.loop ? 0 : anim.frames.length - 1;
        player.setTexture('sam_f' + anim.frames[player.animFrame]);
    }
}

// ============================================================
//  BACKGROUND
// ============================================================
function drawBackground(scene) {
    scene.add.image(W / 2, H / 2, 'bg_castle').setDepth(0).setDisplaySize(W, H);
    const fogG = scene.add.graphics().setDepth(1);
    fogG.fillGradientStyle(0x000000, 0x000000, 0x0a0404, 0x0a0404, 0, 0, 0.3, 0.3);
    fogG.fillRect(0, 550, W, 170);
    const v = scene.add.graphics().setDepth(90).setScrollFactor(0);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0.4, 0, 0); v.fillRect(0, 0, W, 100);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5); v.fillRect(0, H - 120, W, 120);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0, 0, 0.35); v.fillRect(0, 0, 80, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.35, 0.35, 0); v.fillRect(W - 80, 0, 80, H);
}

// ============================================================
//  UPDATE
// ============================================================
function update(time, delta) {
    if (!player || !player.body) return;
    if (playerHP <= 0) return;

    emberTimer -= delta;
    if (emberTimer <= 0) { spawnEmber(gameScene); emberTimer = Phaser.Math.Between(80, 200); }
    if (playerGlow) playerGlow.setPosition(player.x, player.y - 10);

    if (playerHurtTimer > 0) {
        playerHurtTimer -= delta;
        player.setAlpha(playerHurtTimer % 80 > 40 ? 0.4 : 0.9);
        if (playerHurtTimer <= 0) player.setAlpha(1).clearTint();
    }

    if (hitstopTimer > 0) { hitstopTimer -= delta; return; }

    updateEnemies(delta);
    updateParry(delta);
    if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) resetCombo(); }

    if (isAttacking) {
        attackTimer -= delta;
        updateAnimation(delta);
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

    if (isDashing) {
        dashTime -= delta;
        if (dashTime <= 0) endDash();
        else { spawnDashGhost(gameScene); return; }
    }

    // --- INPUT (all keys read independently) ---
    const mL = keys.A.isDown || cursors.left.isDown;
    const mR = keys.D.isDown || cursors.right.isDown;
    const wantJump = Phaser.Input.Keyboard.JustDown(keys.SPACE) || Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(keys.W);
    const holdJump = keys.W.isDown || keys.SPACE.isDown || cursors.up.isDown;

    // Horizontal (always works, even mid-air)
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

    // Jump (independent, hold = auto-jump on land)
    if (wantJump) jumpBufferTimer = JUMP_BUFFER;
    if (holdJump && onGround && jumpCount === 0 && jumpBufferTimer <= 0) jumpBufferTimer = JUMP_BUFFER;

    if (jumpBufferTimer > 0) {
        if (onWall && !onGround) {
            body.setVelocityX((wallDirection === -1 ? 1 : -1) * WALL_JUMP_X);
            body.setVelocityY(WALL_JUMP_Y);
            facingRight = wallDirection === -1;
            jumpCount = 0; onWall = false; jumpBufferTimer = 0;
        } else if (onGround || coyoteTimer > 0) {
            body.setVelocityY(JUMP_FORCE); jumpCount = 1; jumpBufferTimer = 0; coyoteTimer = 0;
        } else if (jumpCount > 0 && jumpCount < maxJumps) {
            body.setVelocityY(DOUBLE_JUMP_FORCE); jumpCount = maxJumps; jumpBufferTimer = 0;
            spawnJumpPuff(gameScene, player.x, player.y + 30);
        }
    }

    // Animation
    if (!isAttacking && !isDashing && !isParrying) {
        if (onWall && !onGround) playAnim('wallslide');
        else if (!onGround) { body.velocity.y < 0 ? playAnim('jump') : playAnim('fall'); }
        else if (mL || mR) playAnim('run');
        else playAnim('idle');
    }
    updateAnimation(delta);

    // Actions
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
        if (Math.abs(e.sprite.x - hx) < atk.hb.w && Math.abs(e.sprite.y - hy) < atk.hb.h + 20) damageEnemy(e, atk.dmg, dir);
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
    const g = scene.add.graphics().setDepth(13);
    const t = atk.trail;
    const sa = Phaser.Math.DegToRad(t.sa * dir), ea = Phaser.Math.DegToRad(t.ea * dir), ccw = dir < 0;
    const r = t.r + 20;
    g.lineStyle(step === 2 ? 18 : 12, 0xff1100, 0.15); g.beginPath(); g.arc(x, y, r + 15, sa, ea, ccw); g.strokePath();
    g.lineStyle(step === 2 ? 12 : 8, 0xff2200, 0.25); g.beginPath(); g.arc(x, y, r + 8, sa, ea, ccw); g.strokePath();
    g.lineStyle(step === 2 ? 6 : 4, 0xff4422, 0.5); g.beginPath(); g.arc(x, y, r, sa, ea, ccw); g.strokePath();
    g.lineStyle(2, 0xff8866, 0.7); g.beginPath(); g.arc(x, y, r - 3, sa, ea, ccw); g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: step === 2 ? 350 : 250, ease: 'Power2', onComplete: () => g.destroy() });
    if (step === 2) {
        const ring = scene.add.graphics().setDepth(12);
        ring.lineStyle(3, 0xff2200, 0.4); ring.strokeCircle(x, y, 20);
        ring.lineStyle(1, 0xff6644, 0.6); ring.strokeCircle(x, y, 12);
        scene.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 300, ease: 'Power3', onComplete: () => ring.destroy() });
    }
    const n = step === 2 ? 10 : 5;
    for (let i = 0; i < n; i++) {
        const ang = Phaser.Math.FloatBetween(Math.min(sa, ea), Math.max(sa, ea));
        const pr = r + Phaser.Math.Between(-5, 10);
        const px = x + Math.cos(ang) * pr, py = y + Math.sin(ang) * pr;
        const ep = scene.add.circle(px, py, Phaser.Math.Between(1, 3), 0xff3311, 0.8).setDepth(14);
        scene.tweens.add({ targets: ep, x: px + Math.cos(ang) * Phaser.Math.Between(15, 45), y: py + Math.sin(ang) * Phaser.Math.Between(15, 45), alpha: 0, duration: Phaser.Math.Between(150, 350), onComplete: () => ep.destroy() });
    }
}

function drawBladeTrail(scene, x, y, atk, dir, step) {
    clearSlash();
    const g = scene.add.graphics().setDepth(15); slashGfx.push(g);
    const t = atk.trail;
    const sa = Phaser.Math.DegToRad(t.sa * dir), ea = Phaser.Math.DegToRad(t.ea * dir), ccw = dir < 0;
    g.lineStyle(t.w + 6, 0xff3322, 0.15); g.beginPath(); g.arc(x, y, t.r + 8, sa, ea, ccw); g.strokePath();
    g.lineStyle(t.w, 0xffeedd, 0.9); g.beginPath(); g.arc(x, y, t.r, sa, ea, ccw); g.strokePath();
    g.lineStyle(Math.max(2, t.w - 3), 0xffffff, 1); g.beginPath(); g.arc(x, y, t.r - 3, sa, ea, ccw); g.strokePath();
    const tx = x + Math.cos(ea) * t.r, ty = y + Math.sin(ea) * t.r;
    g.fillStyle(0xffffff, 0.9); g.fillCircle(tx, ty, step === 2 ? 6 : 4);
    g.fillStyle(0xff4422, 0.3); g.fillCircle(tx, ty, step === 2 ? 14 : 10);
    scene.tweens.add({ targets: g, alpha: 0, duration: step === 2 ? 280 : 200, ease: 'Power3', onComplete: () => g.destroy() });
}

function spawnBladeParticles(scene, x, y, dir, step) {
    const n = step === 2 ? 14 : 8;
    for (let i = 0; i < n; i++) {
        const px = x + Phaser.Math.Between(-15, 15), py = y + Phaser.Math.Between(-20, 20);
        const wh = Math.random() < 0.4;
        const c = wh ? 0xffffff : (Math.random() < 0.5 ? 0xff3322 : 0xff6644);
        const s = Phaser.Math.Between(1, wh ? 3 : 5);
        const p = scene.add.rectangle(px, py, s, s, c, wh ? 1 : 0.8).setDepth(16);
        scene.tweens.add({ targets: p, x: px + dir * Phaser.Math.Between(20, 80), y: py + Phaser.Math.Between(-35, 25), alpha: 0, scaleX: 0, scaleY: 0, duration: Phaser.Math.Between(150, 400), ease: 'Power2', onComplete: () => p.destroy() });
    }
    if (step === 2) {
        const fl = scene.add.circle(x, y, 20, 0xffffff, 0.4).setDepth(13);
        scene.tweens.add({ targets: fl, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 200, ease: 'Power3', onComplete: () => fl.destroy() });
    }
}

function clearSlash() { slashGfx.forEach(g => { if (g && g.scene) g.destroy() }); slashGfx = []; }
function resetCombo() { comboStep = 0; comboTimer = 0; }

// ============================================================
//  DASH
// ============================================================
function startDash(scene) {
    isDashing = true; canDash = false; dashTime = DASH_DURATION;
    player.body.allowGravity = false; player.body.setVelocityY(0);
    playAnim('dash');
    player.body.setVelocityX(DASH_SPEED * (facingRight ? 1 : -1));
    playDashSound();

    const fl = scene.add.circle(player.x, player.y, 30, 0xffffff, 0.5).setDepth(9);
    scene.tweens.add({ targets: fl, scaleX: 3, scaleY: 3, alpha: 0, duration: 200, ease: 'Power3', onComplete: () => fl.destroy() });
    const d = facingRight ? -1 : 1;
    for (let i = 0; i < 6; i++) {
        const ly = player.y + Phaser.Math.Between(-30, 30), lx = player.x + d * Phaser.Math.Between(10, 40);
        const ln = scene.add.rectangle(lx, ly, Phaser.Math.Between(20, 50), 1, 0xffffff, 0.6).setDepth(8);
        scene.tweens.add({ targets: ln, x: lx + d * 80, alpha: 0, scaleX: 0.3, duration: 200, ease: 'Power2', onComplete: () => ln.destroy() });
    }
    scene.cameras.main.shake(100, 0.004);
    spawnDashGhost(scene);
    scene.time.addEvent({ delay: 25, repeat: Math.floor(DASH_DURATION / 25) - 1, callback: () => { if (isDashing) spawnDashGhost(scene); } });
    scene.time.delayedCall(DASH_COOLDOWN, () => { canDash = true; });
}

function endDash() {
    isDashing = false; dashTime = 0;
    player.body.allowGravity = true;
    player.body.setVelocityX(player.body.velocity.x * 0.2);
    const fl = gameScene.add.circle(player.x, player.y, 15, 0xff4422, 0.3).setDepth(9);
    gameScene.tweens.add({ targets: fl, scaleX: 2, scaleY: 2, alpha: 0, duration: 150, onComplete: () => fl.destroy() });
}

function spawnDashGhost(scene) {
    const curTex = player.texture.key, sc = player.scaleX;
    const wg = scene.add.sprite(player.x, player.y, curTex).setScale(sc).setFlipX(!facingRight).setDepth(8).setTint(0xffffff).setAlpha(0.5);
    scene.tweens.add({ targets: wg, alpha: 0, scaleX: sc * 1.05, scaleY: sc * 1.05, duration: 180, ease: 'Power2', onComplete: () => wg.destroy() });
    const rg = scene.add.sprite(player.x, player.y, curTex).setScale(sc).setFlipX(!facingRight).setDepth(7).setTint(0xff2200).setAlpha(0.3);
    scene.tweens.add({ targets: rg, alpha: 0, scaleX: sc * 1.1, scaleY: sc * 1.1, duration: 280, ease: 'Power2', onComplete: () => rg.destroy() });
    const d = facingRight ? -1 : 1;
    for (let i = 0; i < 2; i++) {
        const px = player.x + d * Phaser.Math.Between(5, 25), py = player.y + Phaser.Math.Between(-20, 20);
        const em = scene.add.circle(px, py, Phaser.Math.Between(1, 3), Math.random() < 0.5 ? 0xff4422 : 0xffaa66, 0.8).setDepth(6);
        scene.tweens.add({ targets: em, x: px + d * Phaser.Math.Between(10, 40), y: py - Phaser.Math.Between(5, 20), alpha: 0, duration: Phaser.Math.Between(150, 300), onComplete: () => em.destroy() });
    }
}

// ============================================================
//  PARRY
// ============================================================
function triggerParry() {
    if (parryCooldown > 0 || isParrying || isDashing || isAttacking || playerHP <= 0) return;
    isParrying = true; parryTimer = PARRY_TOTAL; parryWindow = PARRY_ACTIVE; parryCooldown = PARRY_CD;
    player.body.setVelocityX(0); playAnim('parry'); player.setTint(0x00ffaa);
    const dir = facingRight ? 1 : -1;
    parryFlash = gameScene.add.graphics().setDepth(12);
    const cx = player.x + 30 * dir, cy = player.y - 10;
    parryFlash.lineStyle(3, 0x00ffaa, 0.6); parryFlash.strokeCircle(cx, cy, 28);
    parryFlash.lineStyle(1.5, 0xffffff, 0.8); parryFlash.strokeCircle(cx, cy, 18);
    parryFlash.lineStyle(2, 0x00ffaa, 0.9);
    parryFlash.lineBetween(cx - 5, cy - 6, cx + 5, cy + 6);
    parryFlash.lineBetween(cx - 5, cy + 2, cx + 5, cy + 2);
    gameScene.tweens.add({ targets: parryFlash, alpha: 0, duration: PARRY_ACTIVE, ease: 'Power2' });
    gameScene.parryText.setText('PARRY').setAlpha(1);
    gameScene.tweens.add({ targets: gameScene.parryText, alpha: 0, duration: PARRY_ACTIVE + 100 });
}

function updateParry(delta) {
    if (parryWindow > 0) { parryWindow -= delta; if (parryWindow <= 0 && playerHurtTimer <= 0) player.setTint(0x338866); }
    if (parryTimer > 0) { parryTimer -= delta; if (parryTimer <= 0) endParry(); }
    if (parryCooldown > 0 && !isParrying) parryCooldown -= delta;
}

function endParry() {
    isParrying = false; parryTimer = 0; parryWindow = 0;
    if (playerHurtTimer <= 0) player.clearTint();
    if (parryFlash) { parryFlash.destroy(); parryFlash = null; }
}

function triggerParrySuccess(scene) {
    scene.cameras.main.shake(150, 0.008); hitstopTimer = 120;
    const fl = scene.add.rectangle(player.x, player.y, 400, 400, 0xffffff, 0.3).setDepth(50);
    scene.tweens.add({ targets: fl, alpha: 0, duration: 100, onComplete: () => fl.destroy() });
    for (let i = 0; i < 14; i++) {
        const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
        const px = player.x + Math.cos(a) * 10, py = player.y + Math.sin(a) * 10;
        const sp = scene.add.rectangle(px, py, 3, 3, Math.random() < 0.5 ? 0x00ffaa : 0xffffff, 1).setDepth(16);
        scene.tweens.add({ targets: sp, x: px + Math.cos(a) * 50, y: py + Math.sin(a) * 50, alpha: 0, duration: Phaser.Math.Between(100, 300), onComplete: () => sp.destroy() });
    }
    scene.parryText.setText('PERFECT PARRY!').setColor('#00ffaa').setAlpha(1).setScale(1.4);
    scene.tweens.add({ targets: scene.parryText, alpha: 0, scale: 1, duration: 800 });
    canAttack = true; comboStep = 0; endParry();
}

// ============================================================
//  EMBERS
// ============================================================
function spawnEmber(scene) {
    const x = Phaser.Math.Between(50, W - 50), y = Phaser.Math.Between(350, H);
    const c = Math.random() < 0.7 ? (Math.random() < 0.5 ? 0xff3322 : 0xff6644) : 0xffaa77;
    const em = scene.add.circle(x, y, Phaser.Math.Between(1, 3), c, Phaser.Math.FloatBetween(0.3, 0.7)).setDepth(1);
    scene.tweens.add({ targets: em, x: x + Phaser.Math.Between(-30, 30), y: y - Phaser.Math.Between(80, 250), alpha: 0, duration: Phaser.Math.Between(2000, 4000), ease: 'Sine.easeOut', onComplete: () => em.destroy() });
}

function onLand(p) { if (p.body.blocked.down || p.body.touching.down) jumpCount = 0; }
