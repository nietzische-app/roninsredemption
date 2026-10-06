// ============================================================
//  RONIN'S REDEMPTION — v7
//  8-bit cast on one grid. Phone buttons sit on the same actions as the keys.
// ============================================================

const W = 1280, H = 720;
const config = {
    type: Phaser.AUTO, width: W, height: H,
    backgroundColor: '#07060a',
    physics: { default: 'arcade', arcade: { gravity: { y: 1400 }, debug: false } },
    scene: { preload, create, update },
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: W,
        height: H
    }
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
let playerDead = false;
let playerDeadFrozen = false; // true once death anim finishes — locks all anims

// ===================== ENEMY / ROOM STATE =====================
let enemies = [];
let projectiles = [];
let playerHP = 100, playerMaxHP = 100;
let playerHurtTimer = 0;
const PLAYER_HURT_IFRAMES = 600;
let currentRoom = 'main';
let transitioning = false;
let boss = null;
let bossHpGfx = null, bossHpText = null, bossNameText = null;
let roomObjects = [];
let totalComboHits = 0, comboDisplayTimer = 0;

// ===================== PARTY SYSTEM =====================
const MAX_ACTIVE_ATTACKERS = 3;
let activeAttackers = []; // enemies currently allowed to chase/attack

// ===================== PORTAL STATE =====================
let portalActive = false;
let portalGfx = null;
let portalZone = null;
let totalEnemiesInRoom = 0;

// ===================== UPGRADE STATE =====================
let upgradeActive = false;
let upgradeObjects = [];
let upgradesPicked = 0;
let katanaDmgBonus = 0;
let comboSpeedBonus = 0;
let moveSpeedBonus = 0;

// ===================== AUDIO =====================
let audioCtx = null;
let slashAudio = null, bgmAudio = null;

// ===================== HUD =====================
let hpBarGfx, hpText;
let killCountText = null;

// ===================== SPRITE SHEET GRID =====================
const PLAYER_HEIGHT = 140;
const BIT_W = 64, BIT_H = 48, BIT_OX = 26, BIT_OY = 44, BIT_SCALE = 3;
const RONIN_FW = BIT_W, RONIN_FH = BIT_H;
const RONIN_OX = BIT_OX, RONIN_OY = BIT_OY;
const RONIN_SCALE = BIT_SCALE;
const BIT_DIMS = {
    fw: BIT_W, fh: BIT_H,
    originX: BIT_OX / BIT_W, originY: BIT_OY / BIT_H,
    bodyW: 12, bodyH: 18
};
// Frame order matches art/make_ronin.py. Attack slots are [windup, strike].
const RONIN_FRAME = {
    idle: 0, idle2: 1,
    run: [2, 3, 4, 5, 6, 7],
    jump: 8, fall: 9, wall: 10, dash: 11, parry: 12, death: 13,
    jab: [14, 15], cross: [16, 17], hook: [18, 19],
    upper: [20, 21], heavy: [22, 23],
    runattack: 24, airattack: 25
};
let playerShadow = null;
const ENEMY_HEIGHT = BIT_H * BIT_SCALE;
const BOSS_HEIGHT = BIT_H * 5;

// ===================== TUNING =====================
const maxJumps = 2;
let MOVE_SPEED = 420;
const GROUND_DECEL = 2800, AIR_DECEL = 600;
let JUMP_FORCE = -660, DOUBLE_JUMP_FORCE = -560;
const WALL_SLIDE = 90, WALL_JUMP_X = 380, WALL_JUMP_Y = -560;
const DASH_SPEED = 900, DASH_DURATION = 150, DASH_COOLDOWN = 650;
const COYOTE_TIME = 80, JUMP_BUFFER = 100;
let COMBO_WINDOW = 800, HITSTOP_MS = 65;
const PARRY_ACTIVE = 200, PARRY_TOTAL = 400, PARRY_CD = 600;

// ===================== SF/TMNT COMBO ATTACKS =====================
// Hitboxes are measured from the feet. oy is upward.
const ATTACKS = [
    { name: 'JAB',        pose: 'jab',   dur: 160, cd: 40,  hb:{ox:48,oy:-58,w:62,h:40}, lunge: 120, trail:{sa:-10,ea:20,r:45,w:4}, shake: 0.002, dmg: 12 },
    { name: 'CROSS',      pose: 'cross', dur: 180, cd: 45,  hb:{ox:54,oy:-62,w:68,h:42}, lunge: 150, trail:{sa:15,ea:-25,r:50,w:5}, shake: 0.003, dmg: 15 },
    { name: 'HOOK',        pose: 'hook',  dur: 200, cd: 50,  hb:{ox:50,oy:-66,w:72,h:44}, lunge: 160, trail:{sa:-20,ea:35,r:52,w:5}, shake: 0.004, dmg: 18 },
    { name: 'UPPERCUT',   pose: 'upper', dur: 250, cd: 60,  hb:{ox:36,oy:-92,w:56,h:70}, lunge: 80,  trail:{sa:50,ea:-60,r:55,w:6}, shake: 0.006, dmg: 22 },
    { name: 'HEAVY SLASH', pose: 'heavy', dur: 320, cd: 100, hb:{ox:58,oy:-50,w:96,h:50}, lunge: 260, trail:{sa:-35,ea:55,r:65,w:8}, shake: 0.008, dmg: 35 }
];
const RUN_ATTACK = { name: 'DASH CUT', pose: 'runattack', dur: 220, cd: 70, hb:{ox:64,oy:-56,w:92,h:46}, lunge: 350, trail:{sa:-15,ea:25,r:60,w:7}, shake: 0.005, dmg: 28 };
const AIR_ATTACK = { name: 'AIR SLASH', pose: 'airattack', dur: 200, cd: 60, hb:{ox:52,oy:-48,w:78,h:50}, lunge: 100, trail:{sa:30,ea:-40,r:50,w:6}, shake: 0.004, dmg: 20 };

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
function playSlashSound() { if (slashAudio) { const s = slashAudio.cloneNode(); s.volume = 0.3 + Math.random() * 0.15; s.play().catch(() => {}); } }
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
function playPortalSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    [220, 330, 440, 550].forEach((freq, i) => {
        const osc = audioCtx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.12);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.15, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4);
        osc.connect(g).connect(audioCtx.destination); osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.4);
    });
}
function playUpgradeSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(440, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.5);
}
function playSlamSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(80, t); osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 0.4);
}
function playDeathSound() {
    if (!audioCtx) return; const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(60, t); osc.frequency.exponentialRampToValueAtTime(30, t + 1.5);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t + 1.5);
}
let bgmStarted = false;
function startBGM() { if (bgmStarted || !bgmAudio) return; bgmStarted = true; bgmAudio.play().catch(() => { bgmStarted = false; }); }

// ============================================================
//  SPRITE SHEET — gap slice, chroma key, shared foot anchor
//  Equal grids were cutting heads off and sliding the body
//  between frames, because these sheets are posed stills with
//  uneven padding, not a tight walk cycle.
// ============================================================
function bandsFromHist(hist, thresh) {
    const spans = [];
    let start = -1;
    for (let i = 0; i < hist.length; i++) {
        if (hist[i] > thresh && start < 0) start = i;
        else if (hist[i] <= thresh && start >= 0) {
            spans.push([start, i - 1]);
            start = -1;
        }
    }
    if (start >= 0) spans.push([start, hist.length - 1]);
    const merged = [];
    for (const s of spans) {
        if (!merged.length || s[0] - merged[merged.length - 1][1] > 12) merged.push([s[0], s[1]]);
        else merged[merged.length - 1][1] = s[1];
    }
    return merged.filter(s => s[1] - s[0] > 36);
}

function chromaKeyCanvas(ctx, tolerance) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > (255 - tolerance) && g > (255 - tolerance) && b > (255 - tolerance)) d[i + 3] = 0;
        else if (r > 205 && g > 205 && b > 205 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22) {
            const brightness = (r + g + b) / 3;
            d[i + 3] = Math.min(d[i + 3], Math.max(0, Math.floor((255 - brightness) * 3.2)));
        }
    }
    const d2 = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const pi = (y * w + x) * 4;
            if (d[pi + 3] === 0) continue;
            let tn = 0;
            if (d[((y - 1) * w + x) * 4 + 3] === 0) tn++;
            if (d[((y + 1) * w + x) * 4 + 3] === 0) tn++;
            if (d[(y * w + x - 1) * 4 + 3] === 0) tn++;
            if (d[(y * w + x + 1) * 4 + 3] === 0) tn++;
            if (tn > 0) {
                const br = (d[pi] + d[pi + 1] + d[pi + 2]) / 3;
                if (br > 180) d2[pi + 3] = Math.floor(d[pi + 3] * Math.max(0, 1 - tn * 0.3));
                else if (tn >= 2) d2[pi + 3] = Math.floor(d[pi + 3] * 0.65);
            }
        }
    }
    for (let i = 0; i < d.length; i++) d[i] = d2[i];
    ctx.putImageData(imgData, 0, 0);
}

function measureAnchor(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const d = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    const rowCount = new Uint16Array(h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] < 24) continue;
            count++;
            rowCount[y]++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (!count) return null;
    let top = minY;
    const headXs = [];
    const headLimit = Math.min(h - 1, top + 26);
    for (let y = top; y <= headLimit; y++) {
        for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] >= 24) headXs.push(x);
        }
    }
    headXs.sort((a, b) => a - b);
    const headX = headXs.length ? headXs[headXs.length >> 1] : (minX + maxX) >> 1;
    let footY = maxY;
    for (let y = h - 1; y >= 0; y--) {
        if (rowCount[y] >= 6) { footY = y; break; }
    }
    return { canvas: ctx.canvas, minX, minY, maxX, maxY, headX, footY };
}

function processAndSliceSheet(scene, rawKey, prefix, tolerance, cols, rows) {
    const src = scene.textures.get(rawKey).getSourceImage();
    const w = src.width, h = src.height;
    const probe = document.createElement('canvas');
    probe.width = w; probe.height = h;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(src, 0, 0);
    const pd = pctx.getImageData(0, 0, w, h).data;
    const rowC = new Uint32Array(h);
    const colC = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = pd[i], g = pd[i + 1], b = pd[i + 2];
            if (r > 236 && g > 236 && b > 236) continue;
            rowC[y]++; colC[x]++;
        }
    }
    let rb = bandsFromHist(rowC, Math.max(10, Math.floor(w * 0.012)));
    let cb = bandsFromHist(colC, Math.max(10, Math.floor(h * 0.012)));
    if (rb.length !== rows || cb.length !== cols) {
        const y0 = rb.length ? rb[0][0] : 0;
        const y1 = rb.length ? rb[rb.length - 1][1] : h - 1;
        const x0 = cb.length ? cb[0][0] : 0;
        const x1 = cb.length ? cb[cb.length - 1][1] : w - 1;
        rb = []; cb = [];
        for (let i = 0; i < rows; i++) {
            const a = Math.floor(y0 + (y1 - y0 + 1) * i / rows);
            const b = Math.floor(y0 + (y1 - y0 + 1) * (i + 1) / rows) - 1;
            rb.push([a, b]);
        }
        for (let i = 0; i < cols; i++) {
            const a = Math.floor(x0 + (x1 - x0 + 1) * i / cols);
            const b = Math.floor(x0 + (x1 - x0 + 1) * (i + 1) / cols) - 1;
            cb.push([a, b]);
        }
    }

    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x0 = cb[c][0], x1 = cb[c][1], y0 = rb[r][0], y1 = rb[r][1];
            const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
            const cnv = document.createElement('canvas');
            cnv.width = cw; cnv.height = ch;
            const ctx = cnv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
            chromaKeyCanvas(ctx, tolerance);
            cells.push(measureAnchor(ctx));
        }
    }

    let maxLeft = 8, maxRight = 8, maxUp = 8;
    cells.forEach(cell => {
        if (!cell) return;
        maxLeft = Math.max(maxLeft, cell.headX - cell.minX);
        maxRight = Math.max(maxRight, cell.maxX - cell.headX);
        maxUp = Math.max(maxUp, cell.footY - cell.minY);
    });
    const pad = 4;
    const fw = maxLeft + maxRight + pad * 2;
    const fh = maxUp + pad * 2;
    const originX = (pad + maxLeft) / fw;
    const originY = (fh - pad) / fh;
    cells.forEach((cell, idx) => {
        const cnv = document.createElement('canvas');
        cnv.width = fw; cnv.height = fh;
        if (cell) {
            const ctx = cnv.getContext('2d');
            ctx.drawImage(cell.canvas, pad + maxLeft - cell.headX, (fh - pad) - cell.footY);
        }
        if (scene.textures.exists(prefix + idx)) scene.textures.remove(prefix + idx);
        scene.textures.addCanvas(prefix + idx, cnv);
    });
    return { fw, fh, originX, originY };
}

function restoreVisualOffsets() {
    if (player && player._appliedDy) {
        player.y -= player._appliedDy;
        player._appliedDy = 0;
    }
    for (let i = 0; i < enemies.length; i++) {
        const s = enemies[i].sprite;
        if (s && s._appliedDy) { s.y -= s._appliedDy; s._appliedDy = 0; }
    }
}

function applyVisualOffsets() {
    if (player && !playerDead) {
        // Pixel frames stay axis-aligned. Lean lives in the drawing, not in a rotated texture.
        player.setRotation(0);
        const dy = player._wantDy || 0;
        if (dy) { player.y += dy; player._appliedDy = dy; }
    }
    if (playerShadow && player) {
        const air = player.body && Math.abs(player.body.velocity.y) > 80;
        playerShadow.setPosition(player.x, player.y + 3);
        playerShadow.setScale(air ? 0.4 : 1, air ? 0.45 : 1);
        playerShadow.setAlpha(playerDead ? 0 : (air ? 0.12 : 0.32));
    }
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const s = e.sprite;
        if (!s || e.dead || !s.body) continue;
        const dy = e._wantDy || 0;
        if (dy) { s.y += dy; s._appliedDy = dy; }
    }
    selectRoninFrame();
}

function applyFeetBody(sprite, dims, heightRatio) {
    sprite.setOrigin(dims.originX, dims.originY);
    const bw = dims.bodyW || Math.max(16, Math.round(dims.fh * 0.2));
    const bh = dims.bodyH || Math.max(20, Math.round(dims.fh * heightRatio));
    const footX = dims.fw * dims.originX;
    const footY = dims.fh * dims.originY;
    sprite.body.setSize(bw, bh);
    sprite.body.setOffset(Math.round(footX - bw / 2), Math.round(footY - bh));
    sprite.body.setMaxVelocityY(980);
}

// Phone pads write the same flags the keyboard reads.
const touch = { left: false, right: false, jump: false, atk: false, dash: false, parry: false };
const touchPads = [];

function hitTouchPad(x, y) {
    for (let i = 0; i < touchPads.length; i++) {
        const p = touchPads[i];
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
}

function createTouchControls(scene) {
    scene.input.addPointer(2);
    const mk = (x, y, w, h, label, key) => {
        const g = scene.add.graphics().setScrollFactor(0).setDepth(210);
        const paint = (hot) => {
            g.clear();
            g.fillStyle(hot ? 0x3a2858 : 0x120c18, hot ? 0.92 : 0.7);
            g.fillRect(x, y, w, h);
            g.lineStyle(2, 0xd8c49a, 1);
            g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        };
        paint(false);
        scene.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: 'monospace', fontSize: label.length > 1 ? '12px' : '16px', color: '#f3e6cc'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
        const zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setScrollFactor(0).setDepth(212).setInteractive();
        touchPads.push({ x, y, w, h });
        const hold = key === 'left' || key === 'right';
        zone.on('pointerdown', () => { paint(true); touch[key] = true; });
        const release = () => { paint(false); if (hold) touch[key] = false; };
        zone.on('pointerup', release);
        zone.on('pointerout', release);
        zone.on('pointerupoutside', release);
    };
    const y = H - 78;
    mk(16, y, 76, 62, 'A', 'left');
    mk(100, y, 76, 62, 'D', 'right');
    mk(W - 262, y - 70, 78, 56, 'DASH', 'dash');
    mk(W - 176, y - 70, 78, 56, 'C', 'parry');
    mk(W - 262, y, 78, 62, 'W', 'jump');
    mk(W - 176, y, 160, 62, 'X', 'atk');
}

// ============================================================
//  PRELOAD
// ============================================================
function preload() {
    this.load.image('bg_castle', 'background.jpg');
    this.load.image('bg_boss', 'background_boss.png');
    const frame = { frameWidth: BIT_W, frameHeight: BIT_H };
    this.load.spritesheet('ronin', 'ronin_sheet.png?v=44', frame);
    this.load.spritesheet('oni', 'oni_sheet.png?v=44', frame);
    this.load.spritesheet('archer', 'archer_sheet.png?v=44', frame);
    this.load.spritesheet('shield', 'shield_sheet.png?v=44', frame);
    this.load.spritesheet('assassin', 'assassin_sheet.png?v=44', frame);
}

// ============================================================
//  CREATE
// ============================================================
function create() {
    gameScene = this;

    EnemyOni.dims = BIT_DIMS;
    EnemyArcher.dims = BIT_DIMS;
    EnemyShield.dims = BIT_DIMS;
    EnemyAssassin.dims = BIT_DIMS;
    BossOni.dims = BIT_DIMS;

    // Feet sit on the texture origin, so flips and landings stay put.
    // Body is centered on that origin, so facing left does not shift the hitbox.
    player = this.physics.add.sprite(190, 600, 'ronin', 0);
    playerHurtTimer = 1400;
    player.setScale(RONIN_SCALE).setBounce(0).setCollideWorldBounds(true).setDepth(10);
    player.setOrigin(RONIN_OX / RONIN_FW, RONIN_OY / RONIN_FH);
    player.body.setSize(10, 18);
    player.body.setOffset(RONIN_OX - 5, RONIN_OY - 18);
    player.body.setMaxVelocityY(980);
    player.currentAnim = 'idle';
    player._atkDur = 180;
    player._roninFrame = -1;
    selectRoninFrame();
    player._wantDy = 0; player._wantRot = 0; player._appliedDy = 0; player._runPhase = 0; player._prevStep = 0;
    playerShadow = this.add.ellipse(190, 604, 44, 8, 0x000000, 0.32).setDepth(9);

    this.events.on('preupdate', restoreVisualOffsets);
    this.events.on('postupdate', applyVisualOffsets);

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
    createTouchControls(this);
    this.input.on('pointerdown', (pointer) => {
        if (!audioCtx) initAudio(); startBGM();
        // A tap on open ground still swings. Pads handle their own actions.
        if (hitTouchPad(pointer.x, pointer.y)) return;
        if (pointer.leftButtonDown() && !playerDead && !upgradeActive && !transitioning) {
            const body = player.body;
            const onGround = body.blocked.down || body.touching.down;
            const mL = keys.A.isDown || cursors.left.isDown || touch.left;
            const mR = keys.D.isDown || cursors.right.isDown || touch.right;
            triggerAttack(mL || mR, onGround);
        }
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
    enemies.forEach(e => {
        if (e.sprite && e.sprite.scene) e.sprite.destroy();
        if (e.hpGfx && e.hpGfx.scene) e.hpGfx.destroy();
        if (e.typeLabel && e.typeLabel.scene) e.typeLabel.destroy();
    });
    enemies = [];
    projectiles.forEach(p => { if (p.gfx && p.gfx.scene) p.gfx.destroy(); });
    projectiles = [];
    roomObjects.forEach(obj => { if (obj && obj.scene) obj.destroy(); });
    roomObjects = [];
    if (platforms) platforms.clear(true, true);
    if (walls) walls.clear(true, true);
    if (bossHpGfx) { bossHpGfx.destroy(); bossHpGfx = null; }
    if (bossHpText) { bossHpText.destroy(); bossHpText = null; }
    if (bossNameText) { bossNameText.destroy(); bossNameText = null; }
    if (portalGfx) { portalGfx.destroy(); portalGfx = null; }
    if (portalZone) { if (portalZone.destroy) portalZone.destroy(); portalZone = null; }
    portalActive = false;
    boss = null;
}

function buildRoom(scene, roomName) {
    currentRoom = roomName;
    platforms = scene.physics.add.staticGroup();
    walls = scene.physics.add.staticGroup();

    if (roomName === 'main') {
        // Castle art is 4:3 with black bars. Fit it, don't stretch it.
        // Crop source y 115-908 removes the letterbox baked into the jpg.
        addFittedBackdrop(scene, 'bg_castle', { x: 0, y: 115, w: 1023, h: 793 });
        drawFog(scene);

        // Walk lines sit on the painted courtyard, the stair, and the side roofs.
        // y values below are the TOP of each ledge. Centers are top + thickness/2.
        const groundTop = 652;
        makeVisiblePlatform(scene, 640, groundTop + 14, 1400, 28, 'ground');

        // Center stairs, wide at the courtyard, narrow at the door.
        makeVisiblePlatform(scene, 640, 624 + 6, 210, 12, 'stone');
        makeVisiblePlatform(scene, 640, 592 + 6, 168, 12, 'stone');
        makeVisiblePlatform(scene, 640, 560 + 6, 132, 12, 'stone');
        makeVisiblePlatform(scene, 640, 528 + 6, 104, 12, 'stone');

        // Side roofs. A lower perch makes the upper roof a single jump away.
        makeVisiblePlatform(scene, 310, 516 + 6, 150, 12, 'wood');
        makeVisiblePlatform(scene, 970, 516 + 6, 150, 12, 'wood');
        makeVisiblePlatform(scene, 340, 412 + 6, 180, 12, 'wood');
        makeVisiblePlatform(scene, 940, 412 + 6, 180, 12, 'wood');

        makeInvisibleWall(scene, 8, 360, 16, 720);
        makeInvisibleWall(scene, 1272, 360, 16, 720);

        totalEnemiesInRoom = 8;
        const spawnEnemy = (Type, x, y) => {
            const e = new Type(scene, x, y);
            enemies.push(e);
            scene.physics.add.collider(e.sprite, platforms, null, oneWay);
            scene.physics.add.collider(e.sprite, walls);
        };
        spawnEnemy(EnemyShield, 560, 620);
        spawnEnemy(EnemyOni, 980, 620);
        spawnEnemy(EnemyAssassin, 640, 590);
        spawnEnemy(EnemyAssassin, 310, 490);
        spawnEnemy(EnemyOni, 970, 490);
        spawnEnemy(EnemyArcher, 340, 390);
        spawnEnemy(EnemyArcher, 940, 390);
        spawnEnemy(EnemyOni, 700, 530);

    } else if (roomName === 'boss') {
        addFittedBackdrop(scene, 'bg_boss', null);
        drawFog(scene);

        // Ledges follow the painted balconies, the broken bridge, and the floor.
        const groundTop = 600;
        makeVisiblePlatform(scene, 640, groundTop + 16, 1400, 32, 'ground');
        makeVisiblePlatform(scene, 230, 514 + 6, 150, 12, 'wood');
        makeVisiblePlatform(scene, 1050, 514 + 6, 150, 12, 'wood');
        makeVisiblePlatform(scene, 300, 424 + 6, 230, 12, 'balcony');
        makeVisiblePlatform(scene, 980, 424 + 6, 230, 12, 'balcony');
        makeVisiblePlatform(scene, 640, 458 + 6, 170, 12, 'stone');
        makeVisiblePlatform(scene, 430, 300 + 6, 130, 12, 'stone');
        makeVisiblePlatform(scene, 850, 300 + 6, 130, 12, 'stone');
        makeInvisibleWall(scene, 8, 360, 16, 720);
        makeInvisibleWall(scene, 1272, 360, 16, 720);

        boss = new BossOni(scene, 900, 560);
        enemies.push(boss);
        scene.physics.add.collider(boss.sprite, platforms, null, oneWay);
        scene.physics.add.collider(boss.sprite, walls);
        totalEnemiesInRoom = 1;

        // Boss HUD
        bossNameText = scene.add.text(W / 2, 50, '⛩ THE GREAT ONI ⛩', {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
        bossHpGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
        bossHpText = scene.add.text(W / 2, 69, '', {
            fontFamily: 'monospace', fontSize: '7px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
    }

    // Colliders
    scene.physics.add.collider(player, platforms, onLand, oneWay);
    scene.physics.add.collider(player, walls);

    // Camera — no zoom, no bounds restriction
    scene.cameras.main.setZoom(1);
    scene.cameras.main.removeBounds();
    scene.cameras.main.setScroll(0, 0);
}

// ============================================================
//  MYSTIC PORTAL — Opens when all enemies are dead
// ============================================================
function checkAllEnemiesDead() {
    if (portalActive || transitioning) return;
    const aliveCount = enemies.filter(e => !e.dead).length;
    if (aliveCount === 0 && enemies.length > 0) {
        openMysticPortal();
    }
}

function openMysticPortal() {
    portalActive = true;
    playPortalSound();

    // Portal sits in the palace doorway, at the top of the stair.
    const px = 640, py = 490;

    portalGfx = gameScene.add.graphics().setDepth(5);
    // Mystical energy circle
    portalGfx.lineStyle(3, 0x9944ff, 0.8);
    portalGfx.strokeCircle(px, py, 30);
    portalGfx.lineStyle(2, 0xcc66ff, 0.5);
    portalGfx.strokeCircle(px, py, 22);
    portalGfx.fillStyle(0x6622cc, 0.15);
    portalGfx.fillCircle(px, py, 28);
    roomObjects.push(portalGfx);

    // Pulsing outer ring
    const outerRing = gameScene.add.graphics().setDepth(4);
    outerRing.lineStyle(2, 0xaa44ff, 0.3);
    outerRing.strokeCircle(px, py, 40);
    gameScene.tweens.add({ targets: outerRing, scaleX: 1.3, scaleY: 1.3, alpha: 0.1, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    roomObjects.push(outerRing);

    // Floating particles around portal
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const orbitR = 35;
        const particle = gameScene.add.circle(px + Math.cos(angle) * orbitR, py + Math.sin(angle) * orbitR, 2, 0xcc66ff, 0.8).setDepth(6);
        gameScene.tweens.add({
            targets: particle, angle: 360, duration: 3000, repeat: -1,
            onUpdate: () => {
                const a = Phaser.Math.DegToRad(particle.angle + i * 45);
                particle.x = px + Math.cos(a) * orbitR;
                particle.y = py + Math.sin(a) * orbitR;
            }
        });
        roomObjects.push(particle);
    }

    // Inner glow
    const innerGlow = gameScene.add.graphics().setDepth(4);
    innerGlow.fillStyle(0xaa44ff, 0.08);
    innerGlow.fillCircle(px, py, 45);
    gameScene.tweens.add({ targets: innerGlow, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    roomObjects.push(innerGlow);

    // Label
    const lbl = gameScene.add.text(px, py - 45, '⛩ PORTAL OPEN ⛩', {
        fontFamily: 'Georgia, serif', fontSize: '8px', color: '#cc66ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);
    gameScene.tweens.add({ targets: lbl, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    roomObjects.push(lbl);

    // Physics zone for portal collision
    // Feet land on the top step (y ≈ 528). w/h are half-extents.
    portalZone = { x: 640, y: 520, w: 58, h: 42 };

    // Camera flash
    gameScene.cameras.main.flash(400, 100, 50, 200);

    // Announcement
    const ann = gameScene.add.text(W/2, H/2 - 40, 'ALL ENEMIES SLAIN!', {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#cc66ff', fontStyle: 'bold',
        stroke: '#220044', strokeThickness: 3
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: ann, alpha: 1, duration: 500, yoyo: true, hold: 1500, onComplete: () => ann.destroy() });
}

function transitionToRoom(targetRoom) {
    if (transitioning) return;
    transitioning = true;
    const fade = gameScene.add.rectangle(W / 2, H / 2, W * 2, H * 2, 0x000000, 0).setDepth(500).setScrollFactor(0);
    gameScene.tweens.add({
        targets: fade, alpha: 1, duration: 400,
        onComplete: () => {
            clearRoom();
            player.setPosition(190, 600);
            player.body.setVelocity(0, 0);
            buildRoom(gameScene, targetRoom);
            gameScene.tweens.add({
                targets: fade, alpha: 0, duration: 400,
                onComplete: () => { fade.destroy(); transitioning = false; }
            });
        }
    });
}

// ============================================================
//  HADES-STYLE UPGRADE SYSTEM
// ============================================================
function showUpgradeSelection() {
    if (upgradeActive) return;
    upgradeActive = true;
    gameScene.physics.pause();

    const cw = W, ch = H;

    // Overlay
    const overlay = gameScene.add.rectangle(cw/2, ch/2, cw, ch, 0x000000, 0).setDepth(300).setScrollFactor(0);
    gameScene.tweens.add({ targets: overlay, alpha: 0.75, duration: 400 });
    upgradeObjects.push(overlay);

    // Title
    const title = gameScene.add.text(cw/2, 40, '⛩ CHOOSE YOUR PATH ⛩', {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffcc44', fontStyle: 'bold',
        stroke: '#332200', strokeThickness: 2
    }).setOrigin(0.5).setDepth(310).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: title, alpha: 1, duration: 600 });
    upgradeObjects.push(title);

    const upgrades = [
        { name: '刀 KATANA POWER', desc: 'Vurus hasari +8', color: 0xff4444, icon: '刀',
          apply: () => { katanaDmgBonus += 8; } },
        { name: '連 COMBO MASTER', desc: 'Kombo penceresi +200ms\nHitstop +15ms', color: 0x44aaff, icon: '連',
          apply: () => { COMBO_WINDOW += 200; HITSTOP_MS += 15; comboSpeedBonus += 1; } },
        { name: '速 SPEED/AGILITY', desc: 'Hiz +60, Ziplama +40', color: 0x44ff88, icon: '速',
          apply: () => { MOVE_SPEED += 60; JUMP_FORCE -= 40; DOUBLE_JUMP_FORCE -= 30; moveSpeedBonus += 1; } }
    ];

    const cardW = 120, cardH = 130, gap = 20;
    const startX = cw/2 - (cardW * 1.5 + gap);

    upgrades.forEach((upg, i) => {
        const cx = startX + i * (cardW + gap) + cardW/2;
        const cy = ch/2 + 10;

        // Card background
        const card = gameScene.add.graphics().setDepth(305).setScrollFactor(0);
        card.fillStyle(0x0a0a1a, 0.95);
        card.fillRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 8);
        card.lineStyle(2, upg.color, 0.7);
        card.strokeRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 8);
        card.setAlpha(0);
        gameScene.tweens.add({ targets: card, alpha: 1, duration: 400, delay: 200 + i * 150 });
        upgradeObjects.push(card);

        // Icon
        const icon = gameScene.add.text(cx, cy - 35, upg.icon, {
            fontFamily: 'serif', fontSize: '28px', color: '#' + upg.color.toString(16).padStart(6, '0')
        }).setOrigin(0.5).setDepth(310).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: icon, alpha: 1, duration: 400, delay: 300 + i * 150 });
        upgradeObjects.push(icon);

        // Name
        const name = gameScene.add.text(cx, cy + 5, upg.name, {
            fontFamily: 'Georgia, serif', fontSize: '8px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(310).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: name, alpha: 1, duration: 400, delay: 350 + i * 150 });
        upgradeObjects.push(name);

        // Description
        const desc = gameScene.add.text(cx, cy + 25, upg.desc, {
            fontFamily: 'monospace', fontSize: '6px', color: '#aaaaaa', align: 'center'
        }).setOrigin(0.5).setDepth(310).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: desc, alpha: 1, duration: 400, delay: 400 + i * 150 });
        upgradeObjects.push(desc);

        // Key hint
        const keyHint = gameScene.add.text(cx, cy + cardH/2 - 12, '[' + (i + 1) + ']', {
            fontFamily: 'monospace', fontSize: '9px', color: '#666666'
        }).setOrigin(0.5).setDepth(310).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: keyHint, alpha: 0.8, duration: 400, delay: 500 + i * 150 });
        upgradeObjects.push(keyHint);

        // Hover zone (interactive)
        const zone = gameScene.add.rectangle(cx, cy, cardW, cardH, 0xffffff, 0).setDepth(320).setScrollFactor(0).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { card.clear(); card.fillStyle(0x1a1a2a, 0.95); card.fillRoundedRect(cx-cardW/2, cy-cardH/2, cardW, cardH, 8); card.lineStyle(3, upg.color, 1); card.strokeRoundedRect(cx-cardW/2, cy-cardH/2, cardW, cardH, 8); });
        zone.on('pointerout', () => { card.clear(); card.fillStyle(0x0a0a1a, 0.95); card.fillRoundedRect(cx-cardW/2, cy-cardH/2, cardW, cardH, 8); card.lineStyle(2, upg.color, 0.7); card.strokeRoundedRect(cx-cardW/2, cy-cardH/2, cardW, cardH, 8); });
        zone.on('pointerdown', () => selectUpgrade(upg));
        upgradeObjects.push(zone);
    });

    // Keyboard selection
    const keyHandler1 = () => selectUpgrade(upgrades[0]);
    const keyHandler2 = () => selectUpgrade(upgrades[1]);
    const keyHandler3 = () => selectUpgrade(upgrades[2]);
    gameScene.input.keyboard.once('keydown-ONE', keyHandler1);
    gameScene.input.keyboard.once('keydown-TWO', keyHandler2);
    gameScene.input.keyboard.once('keydown-THREE', keyHandler3);
    upgradeObjects.push({ destroy: () => {
        gameScene.input.keyboard.off('keydown-ONE', keyHandler1);
        gameScene.input.keyboard.off('keydown-TWO', keyHandler2);
        gameScene.input.keyboard.off('keydown-THREE', keyHandler3);
    }});
}

function selectUpgrade(upg) {
    if (!upgradeActive) return;
    upgradeActive = false;
    playUpgradeSound();
    upg.apply();
    upgradesPicked++;

    // Flash effect
    const flash = gameScene.add.rectangle(W/2, H/2, W, H, 0xffffff, 0.4).setDepth(350).setScrollFactor(0);
    gameScene.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

    // Show selected text
    const sel = gameScene.add.text(W/2, H/2, upg.name + ' ACQUIRED!', {
        fontFamily: 'Georgia, serif', fontSize: '12px', color: '#ffcc44', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(360).setScrollFactor(0);
    gameScene.tweens.add({ targets: sel, y: sel.y - 30, alpha: 0, duration: 1200, onComplete: () => sel.destroy() });

    // Cleanup
    upgradeObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
    upgradeObjects = [];
    gameScene.physics.resume();
}

// ============================================================
//  INVISIBLE PLATFORMS
// ============================================================
// Platform visual styles
const PLAT_STYLES = {
    ground:  { fill: 0x1a0e0a, border: 0xc45a3a, highlight: 0xffc2a8, alpha: 0.55 },
    stone:   { fill: 0x16161e, border: 0x9a8a78, highlight: 0xffe2c4, alpha: 0.82 },
    wood:    { fill: 0x2a160c, border: 0xc47848, highlight: 0xffd0a0, alpha: 0.88 },
    balcony: { fill: 0x241010, border: 0xd06060, highlight: 0xffb0b0, alpha: 0.88 }
};

function makeVisiblePlatform(scene, x, y, w, h, style) {
    const st = PLAT_STYLES[style] || PLAT_STYLES.stone;
    const key = 'vp_' + x + '_' + y + '_' + w + '_' + currentRoom;
    if (!scene.textures.exists(key)) {
        const g = scene.add.graphics();
        // Main body
        g.fillStyle(st.fill, st.alpha);
        g.fillRoundedRect(0, 0, w, h, Math.min(3, h / 2));
        // Top highlight line
        g.lineStyle(2, st.highlight, 0.95);
        g.lineBetween(2, 1, w - 2, 1);
        // Bottom border
        g.lineStyle(1, st.border, 0.5);
        g.strokeRoundedRect(0, 0, w, h, Math.min(3, h / 2));
        // Wood grain / stone detail
        if (w > 40) {
            g.lineStyle(1, st.highlight, 0.15);
            for (let lx = 20; lx < w; lx += 30) {
                g.lineBetween(lx, 2, lx + 8, h - 2);
            }
        }
        g.generateTexture(key, w, h);
        g.destroy();
    }
    const plat = platforms.create(x, y, key);
    plat.setDepth(3);
    plat.body.setSize(w, h).setOffset(0, 0);
    plat.refreshBody();
}

function makeInvisiblePlatform(scene, x, y, w, h) {
    makeVisiblePlatform(scene, x, y, w, h, 'ground');
}

function makeInvisibleWall(scene, x, y, w, h) {
    const key = 'iw_' + x + '_' + y + '_' + currentRoom;
    if (!scene.textures.exists(key)) {
        const g = scene.add.graphics();
        g.fillStyle(0x1a1020, 0.3); g.fillRect(0, 0, w, h);
        g.generateTexture(key, w, h); g.destroy();
    }
    const wall = walls.create(x, y, key);
    wall.setDepth(3);
    wall.body.setSize(w, h).setOffset(0, 0);
    wall.refreshBody();
}

function addFittedBackdrop(scene, key, crop) {
    const src = scene.textures.get(key).getSourceImage();
    const sx = crop ? crop.x : 0;
    const sy = crop ? crop.y : 0;
    const sw = crop ? crop.w : src.width;
    const sh = crop ? crop.h : src.height;
    const scale = Math.min(W / sw, H / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const cnv = document.createElement('canvas');
    cnv.width = dw; cnv.height = dh;
    const ctx = cnv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
    const tkey = key + '_fit_' + (crop ? crop.y : 0);
    if (scene.textures.exists(tkey)) scene.textures.remove(tkey);
    scene.textures.addCanvas(tkey, cnv);
    const img = scene.add.image(Math.round((W - dw) / 2) + dw / 2, Math.round((H - dh) / 2) + dh / 2, tkey).setDepth(0);
    roomObjects.push(img);
}

function drawFog(scene) {
    const fogG = scene.add.graphics().setDepth(1);
    fogG.fillGradientStyle(0x000000, 0x000000, 0x0a0404, 0x0a0404, 0, 0, 0.25, 0.25);
    fogG.fillRect(0, 580, W, 140);
    roomObjects.push(fogG);
    const v = scene.add.graphics().setDepth(90).setScrollFactor(0);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0.35, 0, 0); v.fillRect(0, 0, W, 80);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.4, 0.4); v.fillRect(0, H - 100, W, 100);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0, 0, 0.3); v.fillRect(0, 0, 60, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.3, 0.3, 0); v.fillRect(W - 60, 0, 60, H);
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

        this.sprite = scene.physics.add.sprite(x, y, config.sheet, 0);
        const dims = config.dims || { fw: 256, fh: 256, originX: 0.5, originY: 0.92 };
        const targetH = config.pixelHeight || ENEMY_HEIGHT;
        this.sprite.setScale(targetH / dims.fh).setDepth(10).setBounce(0).setCollideWorldBounds(true);
        applyFeetBody(this.sprite, dims, 0.55);
        this._wantDy = 0;
        this._phase = Math.random() * 6;

        this.hpGfx = scene.add.graphics().setDepth(22);
        this.typeLabel = scene.add.text(x, y - 52, config.label || '', {
            fontFamily: 'monospace', fontSize: '7px', color: config.labelColor || '#ff6644'
        }).setOrigin(0.5).setDepth(23).setAlpha(0.8);
    }

    headY() {
        const s = this.sprite;
        return s.y - s.displayHeight * s.originY;
    }

    drawHP() {
        const s = this.sprite, g = this.hpGfx; g.clear();
        const head = this.headY();
        const bx = s.x - 24, by = head - 8, bw = 48, bh = 5;
        const ratio = Math.max(0, this.hp / this.maxHp);
        const fillW = Math.floor((bw - 2) * ratio);
        g.fillStyle(0x000000, 0.6); g.fillRoundedRect(bx, by, bw, bh, 2);
        g.lineStyle(1, 0x333355, 0.5); g.strokeRoundedRect(bx, by, bw, bh, 2);
        if (fillW > 0) {
            let color = ratio > 0.6 ? 0x22cc55 : ratio > 0.3 ? 0xcccc22 : 0xcc2222;
            g.fillStyle(color, 0.85); g.fillRoundedRect(bx + 1, by + 1, fillW, bh - 2, 1);
        }
        this.typeLabel.setPosition(s.x, head - 16);
    }

    playAnim(name) {
        if (this.animName === name) return;
        this.animName = name; this.animFrame = 0; this.animTimer = 0;
        const anim = this.config.anims[name];
        if (anim) this.sprite.setFrame(anim.frames[0]);
    }

    updateAnim(delta) {
        const anim = this.config.anims[this.animName];
        if (!anim || !anim.frames.length) return;
        this._wantDy = 0;
        if (anim.frames.length === 1) {
            this.sprite.setFrame(anim.frames[0]);
            return;
        }
        const fps = this.animName === 'idle' ? 2.2 : anim.fps;
        this.animTimer += delta;
        if (this.animTimer >= 1000 / fps) {
            this.animTimer -= 1000 / fps;
            this.animFrame++;
            if (this.animFrame >= anim.frames.length) this.animFrame = anim.loop ? 0 : anim.frames.length - 1;
            this.sprite.setFrame(anim.frames[this.animFrame]);
        }
    }

    takeDamage(dmg, dir) {
        if (this.dead) return;
        const finalDmg = dmg + katanaDmgBonus;
        this.hp -= finalDmg; this.hurtTimer = 200;
        this.sprite.body.setVelocityX(dir * 300); this.sprite.body.setVelocityY(-100);
        playHitSound();
        // Damage number
        const txt = gameScene.add.text(this.sprite.x, this.headY() + 10, '-' + finalDmg, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ff4444', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
        // Blood particles
        for (let i = 0; i < 5; i++) {
            const px = this.sprite.x + Phaser.Math.Between(-8, 8), py = this.sprite.y + Phaser.Math.Between(-15, 10);
            const sp = gameScene.add.circle(px, py, Phaser.Math.Between(1, 3), 0xff4422, 0.9).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + dir * Phaser.Math.Between(10, 40), y: py + Phaser.Math.Between(-20, 10), alpha: 0, duration: 250, onComplete: () => sp.destroy() });
        }
        // Combo counter
        totalComboHits++;
        comboDisplayTimer = 2000;
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
        gameScene.tweens.add({ targets: s, alpha: 0, duration: 280, ease: 'Power2',
            onComplete: () => { s.destroy(); this.hpGfx.destroy(); this.typeLabel.destroy(); }
        });
        const kt = gameScene.add.text(s.x, s.y - 40, 'SLAIN', { fontFamily: 'monospace', fontSize: '12px', color: '#ff6644', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({ targets: kt, y: kt.y - 30, alpha: 0, duration: 1000, onComplete: () => kt.destroy() });
        // Check if all enemies dead -> open portal
        gameScene.time.delayedCall(500, () => checkAllEnemiesDead());
    }

    checkHitPlayer() {
        if (isDashing || playerHurtTimer > 0 || playerHP <= 0 || playerDead) return;
        const dx = Math.abs(player.x - this.sprite.x), dy = Math.abs(player.y - this.sprite.y);
        const reach = this.config.attackRange ? Math.min(this.config.attackRange, this instanceof BossOni ? 100 : 62) : 56;
        if (dx < reach && dy < 72) {
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
            totalComboHits = 0; // Reset player combo on hit
            if (playerHP <= 0) playerDeath();
        }
    }

    update(delta) {
        if (this.dead) return;
        const s = this.sprite;
        if (!s || !s.body) return;
        if (this.hurtTimer > 0) {
            this._wantDy = 0;
            this.hurtTimer -= delta;
            s.setTint(this.hurtTimer % 100 > 50 ? 0xffffff : 0xff4444);
            this.drawHP(); this.updateAnim(delta); return;
        }
        s.clearTint();
        if (this.attackCd > 0) this.attackCd -= delta;
        this.facingRight = player.x > s.x;
        s.setFlipX(!this.facingRight);
        this.updateAI(delta);
        this.stayOnLedge();
        this.updateAnim(delta);
        this.drawHP();
    }

    // These sheets have no jump. Walking off a roof dumps everyone onto the player.
    stayOnLedge() {
        const s = this.sprite;
        if (!s.body || Math.abs(s.body.velocity.x) < 8) return;
        if (!(s.body.blocked.down || s.body.touching.down)) return;
        const dir = s.body.velocity.x > 0 ? 1 : -1;
        const ahead = s.x + dir * (s.body.width * 0.55 + 10);
        const probe = s.y + 10;
        const kids = platforms ? platforms.getChildren() : [];
        for (let i = 0; i < kids.length; i++) {
            const p = kids[i];
            if (!p.body) continue;
            const left = p.x - p.body.width / 2;
            const right = p.x + p.body.width / 2;
            const top = p.y - p.body.height / 2;
            if (ahead >= left && ahead <= right && probe >= top - 2 && probe <= top + 30) return;
        }
        s.body.setVelocityX(0);
    }

    updateAI(delta) {}

    // Check if this enemy is allowed to actively attack/chase
    isActiveAttacker() {
        if (activeAttackers.includes(this)) return true;
        if (activeAttackers.length < MAX_ACTIVE_ATTACKERS) {
            activeAttackers.push(this);
            return true;
        }
        return false;
    }

    // Release slot — only called when truly disengaging
    releaseAttackSlot() {
        const idx = activeAttackers.indexOf(this);
        if (idx !== -1) activeAttackers.splice(idx, 1);
    }

    // Check distance to player — used for idle behavior
    distToPlayer() {
        const dx = player.x - this.sprite.x, dy = player.y - this.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// Clean dead enemies from active attacker list each frame
function updatePartySystem() {
    activeAttackers = activeAttackers.filter(e => !e.dead);
}

// ============================================================
//  ONI
// ============================================================
class EnemyOni extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            sheet: 'oni', label: 'ONI', labelColor: '#cc66ff',
            hp: 120, pixelHeight: ENEMY_HEIGHT, attackDmg: 18, knockback: 280,
            speed: 110, chaseRange: 300, attackRange: 55,
            attackDur: 550, attackCooldown: 1300,
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
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); this.releaseAttackSlot(); }
            s.body.setVelocityX(0);
        } else if (dist > this.config.chaseRange * 1.5) {
            // Truly out of range — release slot and idle
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < this.config.attackRange && this.attackCd <= 0 && this.isActiveAttacker()) {
            this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0);
        } else if (dist < this.config.chaseRange && this.isActiveAttacker()) {
            this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed);
        } else {
            // In range but no slot — stand guard, don't chase
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0);
        }
    }
}

// ============================================================
//  ARCHER
// ============================================================
class EnemyArcher extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            sheet: 'archer', label: 'ARCHER', labelColor: '#44cc44',
            hp: 70, pixelHeight: ENEMY_HEIGHT, attackDmg: 10, knockback: 200,
            speed: 130, chaseRange: 400, attackRange: 250, fleeRange: 100,
            attackDur: 600, attackCooldown: 1800,
            bodyWRatio: 0.28, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: EnemyArcher.dims,
            anims: { idle:{frames:[0,1,2,3],fps:5,loop:true}, walk:{frames:[4,5,6,7],fps:8,loop:true}, shoot:{frames:[8,9,10,11],fps:8,loop:false}, flee:{frames:[12,13,14,15],fps:10,loop:true} }
        });
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x - s.x, dist = Math.sqrt(dx*dx + (player.y-s.y)**2);
        if (dist < this.config.fleeRange) { this.state='flee'; this.playAnim('flee'); s.body.setVelocityX((dx>0?-1:1)*this.config.speed*1.3); }
        else if (dist > this.config.chaseRange * 1.5) {
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < this.config.attackRange && this.attackCd <= 0 && this.isActiveAttacker()) {
            this.state='shoot'; this.playAnim('shoot'); s.body.setVelocityX(0); this.attackCd=this.config.attackCooldown;
            gameScene.time.delayedCall(300, () => { if (!this.dead) { this.fireArrow(); this.releaseAttackSlot(); } });
        } else if (dist < this.config.chaseRange && dist > this.config.attackRange*0.8 && this.isActiveAttacker()) {
            this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed*0.7);
        } else {
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0);
        }
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
            sheet: 'shield', label: 'SHIELD', labelColor: '#ff6644',
            hp: 200, pixelHeight: ENEMY_HEIGHT, attackDmg: 20, knockback: 350,
            speed: 55, chaseRange: 250, attackRange: 50,
            attackDur: 700, attackCooldown: 2000,
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
        const s = this.sprite;
        const bt = gameScene.add.text(s.x, s.y-40, 'BLOCKED!', {fontFamily:'monospace',fontSize:'10px',color:'#ff6644',fontStyle:'bold'}).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({targets:bt,y:bt.y-20,alpha:0,duration:600,onComplete:()=>bt.destroy()});
        player.body.setVelocityX((player.x>s.x?1:-1)*200);
    }
    updateAI(delta) {
        const s = this.sprite, dx = player.x-s.x, dist = Math.sqrt(dx*dx+(player.y-s.y)**2);
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('block');
            if (this.attackTimer < this.config.attackDur*0.3) { s.setTint(0xff6644); if (this.attackTimer < this.config.attackDur*0.25 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); this.releaseAttackSlot(); }
            s.body.setVelocityX(0);
        } else if (dist > this.config.chaseRange * 1.5) {
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < this.config.attackRange && this.attackCd <= 0 && this.isActiveAttacker()) {
            this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0);
        } else if (dist < this.config.chaseRange && this.isActiveAttacker()) {
            this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed);
        } else {
            this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0);
        }
    }
}

// ============================================================
//  ASSASSIN
// ============================================================
class EnemyAssassin extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            sheet: 'assassin', label: 'ASSASSIN', labelColor: '#44ddcc',
            hp: 80, pixelHeight: ENEMY_HEIGHT, attackDmg: 22, knockback: 200,
            speed: 220, chaseRange: 350, attackRange: 45,
            attackDur: 350, attackCooldown: 900,
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
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); this.releaseAttackSlot(); }
            s.body.setVelocityX(0);
        } else if (dist > this.config.chaseRange * 1.5) {
            this.state='idle'; this.playAnim(this.isInvisible?'vanish':'idle'); s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < this.config.attackRange && this.attackCd <= 0 && !this.isInvisible && this.isActiveAttacker()) {
            this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0);
        } else if (dist < this.config.chaseRange && this.isActiveAttacker()) {
            this.state='chase'; this.playAnim(this.isInvisible?'vanish':'run'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed);
        } else {
            this.state='idle'; this.playAnim(this.isInvisible?'vanish':'idle'); s.body.setVelocityX(0);
        }
    }
}

// ============================================================
//  BOSS ONI
// ============================================================
class BossOni extends Enemy {
    static dims = { fw: 256, fh: 256 };
    constructor(scene, x, y) {
        super(scene, x, y, {
            sheet: 'oni', label: '', labelColor: '#ff2222',
            hp: 600, pixelHeight: BOSS_HEIGHT, attackDmg: 25, knockback: 400,
            speed: 80, chaseRange: 600, attackRange: 80,
            attackDur: 600, attackCooldown: 1500,
            bodyWRatio: 0.30, bodyHRatio: 0.50, bodyYOffset: 0.30,
            dims: BossOni.dims,
            anims: { idle:{frames:[0,1,2,3],fps:4,loop:true}, walk:{frames:[4,5,6,7],fps:6,loop:true}, attack:{frames:[8,9,10,11],fps:10,loop:false}, special:{frames:[12,13,14,15],fps:8,loop:false} }
        });
        this.specialTimer = 4000;
        this.isDashing = false;
        this.dashTimer = 0;
        this.isSlamming = false;
        this.slamTimer = 0;
        this.typeLabel.setAlpha(0);
        this.spawned70 = false;
        this.spawned30 = false;
    }

    drawHP() {
        this.hpGfx.clear();
        if (bossHpGfx) {
            bossHpGfx.clear();
            const bx = (W/2) - 120, by = 58, bw = 240, bh = 10;
            const ratio = Math.max(0, this.hp / this.maxHp);
            const fillW = Math.floor((bw - 4) * ratio);
            bossHpGfx.fillStyle(0x1a0000, 0.9); bossHpGfx.fillRoundedRect(bx, by, bw, bh, 5);
            bossHpGfx.lineStyle(1, 0xff2222, 0.6); bossHpGfx.strokeRoundedRect(bx, by, bw, bh, 5);
            if (fillW > 0) {
                let color = ratio > 0.5 ? 0xcc2222 : ratio > 0.25 ? 0xff4400 : 0xff0000;
                bossHpGfx.fillStyle(color, 0.9); bossHpGfx.fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 3);
            }
            if (bossHpText) bossHpText.setText(Math.ceil(this.hp) + ' / ' + this.maxHp);
        }
    }

    die() {
        this.dead = true; this.sprite.body.enable = false;
        const s = this.sprite;
        for (let i = 0; i < 30; i++) {
            const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360)), r = Phaser.Math.Between(10, 40);
            const px = s.x + Math.cos(a)*r, py = s.y + Math.sin(a)*r;
            const sp = gameScene.add.rectangle(px, py, Phaser.Math.Between(3, 10), Phaser.Math.Between(3, 10),
                Math.random() < 0.5 ? 0xff2222 : 0xff8844, 1).setDepth(15);
            gameScene.tweens.add({ targets: sp, x: px + Math.cos(a)*Phaser.Math.Between(50, 150), y: py + Math.sin(a)*Phaser.Math.Between(50, 150) - 30,
                alpha: 0, rotation: Phaser.Math.Between(-5, 5), duration: Phaser.Math.Between(500, 1200), onComplete: () => sp.destroy() });
        }
        gameScene.cameras.main.shake(500, 0.015);
        gameScene.tweens.add({ targets: s, alpha: 0, scaleX: 0, scaleY: 0, duration: 800, ease: 'Power3',
            onComplete: () => { s.destroy(); this.hpGfx.destroy(); this.typeLabel.destroy(); }
        });
        const vt = gameScene.add.text(W/2, H/2 - 20, 'VICTORY!', { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);
        gameScene.tweens.add({ targets: vt, alpha: 1, duration: 800, delay: 600 });
        if (bossNameText) bossNameText.setText('DEFEATED');
    }

    updateAI(delta) {
        const s = this.sprite, dx = player.x - s.x, dist = Math.sqrt(dx*dx + (player.y-s.y)**2);
        this.specialTimer -= delta;
        if (this.specialTimer <= 0 && this.state !== 'attack' && !this.isDashing && !this.isSlamming) {
            if (Math.random() < 0.5) this.startSlam();
            else this.startDashAttack();
            this.specialTimer = 3500 + Math.random() * 1500;
            return;
        }
        if (this.isSlamming) { this.slamTimer -= delta; this.playAnim('special'); if (this.slamTimer <= 0) { this.isSlamming = false; s.clearTint(); } s.body.setVelocityX(0); return; }
        if (this.isDashing) { this.dashTimer -= delta; this.playAnim('attack'); s.setTint(0xff4400); if (this.dashTimer <= 0) { this.isDashing = false; s.body.setVelocityX(0); s.clearTint(); this.attackCd = 800; } if (Math.abs(player.x - s.x) < 60 && Math.abs(player.y - s.y) < 60) this.checkHitPlayer(); return; }
        if (this.state === 'attack') {
            this.attackTimer -= delta; this.playAnim('attack');
            if (this.attackTimer < this.config.attackDur*0.3) { s.setTint(0xff2222); if (this.attackTimer < this.config.attackDur*0.25 && this.attackTimer > this.config.attackDur*0.15) this.checkHitPlayer(); }
            if (this.attackTimer <= 0) { this.state='idle'; this.attackCd=this.config.attackCooldown; s.clearTint(); }
            s.body.setVelocityX(0);
        } else if (dist < this.config.attackRange && this.attackCd <= 0) { this.state='attack'; this.attackTimer=this.config.attackDur; s.body.setVelocityX(0); }
        else if (dist < this.config.chaseRange) { this.state='chase'; this.playAnim('walk'); s.body.setVelocityX((dx>0?1:-1)*this.config.speed); }
        else { this.state='idle'; this.playAnim('idle'); s.body.setVelocityX(0); }
    }

    startSlam() {
        this.isSlamming = true; this.slamTimer = 800;
        this.playAnim('special'); this.sprite.setTint(0xff8800);
        this.sprite.body.setVelocityX(0);
        playSlamSound();
        gameScene.time.delayedCall(400, () => {
            if (this.dead) return;
            gameScene.cameras.main.shake(300, 0.015);
            const sx = this.sprite.x, sy = this.sprite.y + 20;
            const wave = gameScene.add.graphics().setDepth(14);
            wave.lineStyle(4, 0xff4400, 0.7); wave.strokeCircle(sx, sy, 30);
            gameScene.tweens.add({ targets: wave, scaleX: 3, scaleY: 1.5, alpha: 0, duration: 500, onComplete: () => wave.destroy() });
            if (!isDashing && playerHurtTimer <= 0 && playerHP > 0 && !playerDead) {
                if (Math.abs(player.x - sx) < 180 && Math.abs(player.y - sy) < 100) {
                    playerHP -= 25; playerHurtTimer = PLAYER_HURT_IFRAMES; playHurtSound();
                    player.body.setVelocityY(-350); player.body.setVelocityX((player.x > sx ? 1 : -1) * 400);
                    player.setTint(0xff4444); gameScene.cameras.main.shake(100, 0.01);
                    updateHUD(); if (playerHP <= 0) playerDeath();
                }
            }
        });
    }

    startDashAttack() {
        this.isDashing = true; this.dashTimer = 450;
        const dir = this.facingRight ? 1 : -1;
        this.sprite.body.setVelocityX(dir * 700);
        this.sprite.setTint(0xff4400);
        this.playAnim('attack');
        gameScene.cameras.main.shake(80, 0.004);
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
        if (!isDashing && playerHurtTimer <= 0 && playerHP > 0 && !playerDead) {
            const bodyTop = player.y - PLAYER_HEIGHT * 0.85;
            if (Math.abs(p.x - player.x) < 26 && p.y < player.y && p.y > bodyTop) {
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
//  HUD
// ============================================================
function createHUD(scene) {
    hpBarGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
    hpText = scene.add.text(92, 22, '100', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 0.5).setDepth(102).setScrollFactor(0);
    scene.comboText = scene.add.text(W/2, 150, '', { fontFamily: 'monospace', fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.parryText = scene.add.text(W/2, 118, '', { fontFamily: 'monospace', fontSize: '18px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.comboCountText = scene.add.text(W - 16, 50, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ff8844', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(100).setScrollFactor(0).setAlpha(0);
    killCountText = scene.add.text(16, 36, '', { fontFamily: 'monospace', fontSize: '9px', color: '#666688' }).setDepth(100).setScrollFactor(0);
    drawPlayerHP();
}

function drawPlayerHP() {
    const g = hpBarGfx; g.clear();
    const bx = 16, by = 14, bw = 160, bh = 14;
    const ratio = Math.max(0, playerHP / playerMaxHP);
    const fillW = Math.floor((bw - 4) * ratio);
    g.fillStyle(0x0a0a1a, 0.85); g.fillRoundedRect(bx, by, bw, bh, 7);
    g.lineStyle(1, 0x334466, 0.5); g.strokeRoundedRect(bx, by, bw, bh, 7);
    if (fillW > 0) {
        let fc = ratio > 0.6 ? 0x22cc55 : ratio > 0.3 ? 0xcccc22 : 0xcc2222;
        g.fillStyle(fc, 0.9); g.fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 5);
        g.lineStyle(1, 0xffffff, 0.15); g.lineBetween(bx + 6, by + 3, bx + 2 + fillW - 4, by + 3);
        if (ratio < 0.3) {
            const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.15;
            g.lineStyle(2, 0xff2222, pulse); g.strokeRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 8);
        }
    }
    if (hpText) hpText.setText(Math.ceil(playerHP));
    // Kill count
    if (killCountText) {
        const alive = enemies.filter(e => !e.dead).length;
        killCountText.setText('Enemies: ' + alive + '/' + totalEnemiesInRoom);
    }
}
function updateHUD() { drawPlayerHP(); }

// ============================================================
//  PIXEL RONIN
//  Drawn facing right. FlipX mirrors the whole frame.
//  The foot line is the sprite origin, so the stride stays planted.
// ============================================================
function playAnim(name) {
    if (!player || playerDeadFrozen) return;
    if (player.currentAnim === name) return;
    player.currentAnim = name;
}

function selectRoninFrame() {
    if (!player) return;
    const anim = player.currentAnim || 'idle';
    let frame = RONIN_FRAME.idle;
    if (anim === 'idle') {
        frame = (Math.floor(performance.now() / 460) % 2) ? RONIN_FRAME.idle2 : RONIN_FRAME.idle;
    } else if (anim === 'run') {
        const cycle = Math.PI * 2;
        const phase = ((player._runPhase % cycle) + cycle) % cycle;
        frame = RONIN_FRAME.run[Math.floor((phase / cycle) * 6) % 6];
    } else if (Object.prototype.hasOwnProperty.call(RONIN_FRAME, anim)) {
        const slot = RONIN_FRAME[anim];
        if (Array.isArray(slot)) {
            const dur = player._atkDur || 1;
            const p = isAttacking ? (1 - attackTimer / dur) : 1;
            frame = (p >= 0.16 && p < 0.78) ? slot[1] : slot[0];
        } else {
            frame = slot;
        }
    }
    if (player._roninFrame !== frame) {
        player.setFrame(frame);
        player._roninFrame = frame;
    }
}

// ============================================================
//  PLAYER DEATH
// ============================================================
let deathUI = [];
function playerDeath() {
    if (playerDead) return;
    playerDead = true; playerHP = 0; updateHUD();
    playDeathSound(); playAnim('death');
    playerDeadFrozen = true;
    player.body.setVelocityX(0); player.body.setVelocityY(0);

    const fl = gameScene.add.rectangle(W/2, H/2, W * 2, H * 2, 0xff0000, 0.4).setDepth(200).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0.1, duration: 1000 });
    deathUI.push(fl);
    const overlay = gameScene.add.rectangle(W/2, H/2, W * 2, H * 2, 0x000000, 0).setDepth(199).setScrollFactor(0);
    gameScene.tweens.add({ targets: overlay, alpha: 0.6, duration: 1500 });
    deathUI.push(overlay);
    // Collapse: tilt the character sideways to show fallen ronin
    player.body.setVelocityX(0);
    player.body.setVelocityY(0);
    player.body.allowGravity = false;
    gameScene.tweens.add({ targets: player, alpha: 0.55, duration: 800, ease: 'Power2' });

    const dt = gameScene.add.text(W/2, H/2 - 5, 'YOU DIED', {
        fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '40px', color: '#8b0000', fontStyle: 'bold',
        stroke: '#2a0000', strokeThickness: 4,
        shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 15, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0).setAlpha(0).setScale(0.7);
    gameScene.tweens.add({ targets: dt, alpha: 1, scaleX: 1.05, scaleY: 1.05, duration: 2500, ease: 'Sine.easeInOut',
        onComplete: () => { gameScene.tweens.add({ targets: dt, alpha: 0.6, duration: 1800, yoyo: true, repeat: -1 }); }
    });
    deathUI.push(dt);
    const rt = gameScene.add.text(W/2, H/2 + 50, 'Tekrar Denemek Icin Tiklayin', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#666655', fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: rt, alpha: 0.8, duration: 1000, delay: 2800 });
    deathUI.push(rt);

    gameScene.time.delayedCall(1500, () => {
        const reviveHandler = () => {
            playerDead = false; playerDeadFrozen = false; playerHP = playerMaxHP; playerHurtTimer = PLAYER_HURT_IFRAMES; updateHUD();
            player.setAlpha(1).clearTint().setScale(RONIN_SCALE).setRotation(0);
            player.setPosition(190, 600); player.body.setVelocity(0, 0); player.currentAnim = ''; playAnim('idle');
            playerHurtTimer = 1400;
            player.setRotation(0);
            player.body.allowGravity = true;
            deathUI.forEach(obj => { if (obj && obj.destroy) obj.destroy(); }); deathUI = [];
            gameScene.input.off('pointerdown', reviveHandler);
        };
        gameScene.input.on('pointerdown', reviveHandler);
    });
}

// ============================================================
//  UPDATE
// ============================================================
function update(time, delta) {
    if (!player || !player.body) return;
    player._wantDy = 0;
    player._wantRot = 0;
    if (playerDead) return;
    if (playerHP <= 0) return;
    if (transitioning || upgradeActive) return;

    emberTimer -= delta;
    if (emberTimer <= 0) { spawnEmber(gameScene); emberTimer = Phaser.Math.Between(100, 250); }
    if (playerGlow) playerGlow.setPosition(player.x, player.y - 48);

    if (playerHurtTimer > 0) {
        playerHurtTimer -= delta;
        player.setAlpha(playerHurtTimer % 80 > 40 ? 0.4 : 0.9);
        if (playerHurtTimer <= 0) player.setAlpha(1).clearTint();
    }

    drawPlayerHP();

    // Combo display timer
    if (comboDisplayTimer > 0) {
        comboDisplayTimer -= delta;
        if (totalComboHits >= 2) {
            gameScene.comboCountText.setText(totalComboHits + ' HITS!').setAlpha(1);
        }
        if (comboDisplayTimer <= 0) { totalComboHits = 0; gameScene.comboCountText.setAlpha(0); }
    }

    if (hitstopTimer > 0) { hitstopTimer -= delta; return; }

    updatePartySystem();
    enemies.forEach(e => e.update(delta));
    if (playerDead) {
        touch.jump = false; touch.atk = false; touch.dash = false; touch.parry = false;
        return;
    }
    updateProjectiles(delta);
    updateParry(delta);
    if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) resetCombo(); }

    // Portal check — walk into portal to transition
    if (portalActive && portalZone && currentRoom === 'main' && !transitioning) {
        if (Math.abs(player.x - portalZone.x) < portalZone.w && Math.abs(player.y - portalZone.y) < portalZone.h) {
            // Show upgrade before boss if not yet picked
            if (upgradesPicked === 0) {
                if (!upgradeActive) showUpgradeSelection();
                return;
            }
            transitionToRoom('boss');
            return;
        }
    }

    if (isAttacking) {
        attackTimer -= delta;
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

    const mL = keys.A.isDown || cursors.left.isDown || touch.left;
    const mR = keys.D.isDown || cursors.right.isDown || touch.right;
    const wantJump = Phaser.Input.Keyboard.JustDown(keys.SPACE) || Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(keys.W) || touch.jump;
    touch.jump = false;
    const isMoving = mL || mR;

    if (onWall && !onGround) {
        wallDirection = onL ? -1 : 1;
        // 50% gravity feel — cap vertical speed to WALL_SLIDE (slow descent)
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
    if (jumpBufferTimer > 0) {
        if (onWall && !onGround) { body.setVelocityX((wallDirection===-1?1:-1)*WALL_JUMP_X); body.setVelocityY(WALL_JUMP_Y); facingRight=wallDirection===-1; jumpCount=0; onWall=false; jumpBufferTimer=0; }
        else if (onGround||coyoteTimer>0) { body.setVelocityY(JUMP_FORCE); jumpCount=1; jumpBufferTimer=0; coyoteTimer=0; }
        else if (jumpCount>0&&jumpCount<maxJumps) { body.setVelocityY(DOUBLE_JUMP_FORCE); jumpCount=maxJumps; jumpBufferTimer=0; spawnJumpPuff(gameScene,player.x,player.y); }
    }

    if (!isAttacking && !isDashing && !isParrying) {
        if (onWall && !onGround) playAnim('wall');
        else if (!onGround) playAnim(body.velocity.y < 0 ? 'jump' : 'fall');
        else if (isMoving) playAnim('run');
        else playAnim('idle');
    }

    // Motion that matches the velocity, instead of a fake frame cycle.
    const speed = Math.abs(body.velocity.x);
    if (onGround && speed > 30 && !isParrying && !isDashing) {
        player._runPhase += speed * delta * 0.000055;
        const step = Math.sin(player._runPhase);
        if (player._prevStep < 0 && step >= 0) spawnFootDust(gameScene, player.x, player.y);
        player._prevStep = step;
    }

    if ((Phaser.Input.Keyboard.JustDown(keys.SHIFT) || touch.dash) && canDash && !isDashing) startDash(gameScene);
    touch.dash = false;
    if (Phaser.Input.Keyboard.JustDown(keys.X) || touch.atk) triggerAttack(isMoving, onGround);
    touch.atk = false;
    if (Phaser.Input.Keyboard.JustDown(keys.C) || touch.parry) triggerParry();
    touch.parry = false;
}

function spawnFootDust(scene, x, y) {
    for (let i = 0; i < 3; i++) {
        const px = x + Phaser.Math.Between(-8, 8);
        const p = scene.add.circle(px, y - 2, Phaser.Math.Between(2, 3), 0x886655, 0.45).setDepth(8);
        scene.tweens.add({
            targets: p,
            x: px + (facingRight ? -1 : 1) * Phaser.Math.Between(6, 16),
            y: y - Phaser.Math.Between(2, 8),
            alpha: 0, duration: 220, onComplete: () => p.destroy()
        });
    }
}

function spawnJumpPuff(scene, x, y) {
    for (let i = 0; i < 4; i++) {
        const px = x + Phaser.Math.Between(-10, 10);
        const p = scene.add.circle(px, y, Phaser.Math.Between(2, 5), 0x8888aa, 0.4).setDepth(8);
        scene.tweens.add({ targets: p, y: y + 15, scaleX: 2, scaleY: 0.3, alpha: 0, duration: 250, onComplete: () => p.destroy() });
    }
}

// ============================================================
//  COMBAT — 5-HIT ARCADE COMBO (SF/TMNT Style)
//  Standing: JAB → CROSS → HOOK → UPPERCUT → HEAVY SLASH
//  Moving + X: DASH CUT | Air + X: AIR SLASH
// ============================================================
function triggerAttack(isMoving, onGround) {
    if (!canAttack || isDashing || isParrying || playerHP <= 0 || playerDead || upgradeActive) return;
    isAttacking = true; canAttack = false;

    const dir = facingRight ? 1 : -1;
    let atk, animName;

    if (!onGround) {
        atk = AIR_ATTACK;
        animName = atk.pose;
        comboStep = 0; comboTimer = 0;
    } else if (isMoving) {
        atk = RUN_ATTACK;
        animName = atk.pose;
        comboStep = 0; comboTimer = 0;
    } else {
        const step = comboStep % 5;
        atk = ATTACKS[step];
        animName = atk.pose;
        comboStep = step + 1;
        comboTimer = COMBO_WINDOW;
    }

    playAnim(animName);
    attackTimer = atk.dur;
    player._atkDur = atk.dur;
    playSlashSound();

    const hx = player.x + atk.hb.ox * dir, hy = player.y + atk.hb.oy;
    drawBladeTrail(gameScene, hx, hy, atk, dir, comboStep - 1);
    spawnEnergyWave(gameScene, hx, hy, atk, dir, comboStep - 1);
    spawnBladeParticles(gameScene, hx, hy, dir, comboStep - 1);
    player.body.setVelocityX(dir * atk.lunge);

    // Uppercut launches player up
    if (comboStep === 4) {
        player.body.setVelocityY(-300);
    }

    let hitSomething = false;
    enemies.forEach(e => {
        if (e.dead || e.hurtTimer > 0) return;
        const hitRange = e instanceof BossOni ? atk.hb.w + 40 : atk.hb.w;
        const hitH = e instanceof BossOni ? atk.hb.h + 60 : atk.hb.h + 20;
        if (Math.abs(e.sprite.x - hx) < hitRange && Math.abs(e.sprite.y - hy) < hitH) {
            if (e.canTakeDamage(dir)) { e.takeDamage(atk.dmg, dir); hitSomething = true; }
        }
    });

    // Enhanced hitstop on contact (SF feel)
    hitstopTimer = hitSomething ? HITSTOP_MS : Math.floor(HITSTOP_MS * 0.3);
    gameScene.cameras.main.shake(hitSomething ? 100 : 60, atk.shake);

    // Show combo name
    const colors = ['#ccddff', '#aabbff', '#ff8899', '#ffaa44', '#ff3322'];
    const colorIdx = (!onGround) ? 2 : (isMoving ? 4 : Math.min(comboStep - 1, 4));
    gameScene.comboText.setText(atk.name).setColor(colors[colorIdx]).setAlpha(1).setScale(comboStep >= 4 ? 1.5 : 1.1);
    gameScene.tweens.add({ targets: gameScene.comboText, alpha: 0, duration: 700, ease: 'Power2' });

    gameScene.time.delayedCall(atk.dur + atk.cd, () => { canAttack = true; });
    if (comboStep >= 5) gameScene.time.delayedCall(atk.dur + 50, () => resetCombo());
}

function spawnEnergyWave(scene, x, y, atk, dir, step) {
    const g = scene.add.graphics().setDepth(13); const t = atk.trail;
    const sa = Phaser.Math.DegToRad(t.sa*dir), ea = Phaser.Math.DegToRad(t.ea*dir), ccw = dir < 0, r = t.r + 20;
    g.lineStyle(step>=3?18:10, 0xff1100, 0.12); g.beginPath(); g.arc(x,y,r+12,sa,ea,ccw); g.strokePath();
    g.lineStyle(step>=3?8:5, 0xff4422, 0.4); g.beginPath(); g.arc(x,y,r,sa,ea,ccw); g.strokePath();
    g.lineStyle(2, 0xff8866, 0.7); g.beginPath(); g.arc(x,y,r-3,sa,ea,ccw); g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, duration: step>=3?350:200, ease: 'Power2', onComplete: () => g.destroy() });
    if (step>=4) { const ring=scene.add.graphics().setDepth(12); ring.lineStyle(3,0xff2200,0.4); ring.strokeCircle(x,y,20); scene.tweens.add({targets:ring,scaleX:3,scaleY:3,alpha:0,duration:300,onComplete:()=>ring.destroy()}); }
}

function drawBladeTrail(scene, x, y, atk, dir, step) {
    clearSlash(); const g = scene.add.graphics().setDepth(15); slashGfx.push(g); const t = atk.trail;
    const sa=Phaser.Math.DegToRad(t.sa*dir),ea=Phaser.Math.DegToRad(t.ea*dir),ccw=dir<0;
    g.lineStyle(t.w+4,0xff3322,0.12); g.beginPath(); g.arc(x,y,t.r+6,sa,ea,ccw); g.strokePath();
    g.lineStyle(t.w,0xffeedd,0.9); g.beginPath(); g.arc(x,y,t.r,sa,ea,ccw); g.strokePath();
    g.lineStyle(Math.max(2,t.w-2),0xffffff,1); g.beginPath(); g.arc(x,y,t.r-2,sa,ea,ccw); g.strokePath();
    scene.tweens.add({targets:g,alpha:0,duration:step>=3?280:180,ease:'Power3',onComplete:()=>g.destroy()});
}

function spawnBladeParticles(scene, x, y, dir, step) {
    const count = step >= 3 ? 12 : 6;
    for (let i=0;i<count;i++) { const px=x+Phaser.Math.Between(-12,12),py=y+Phaser.Math.Between(-18,18); const c=Math.random()<0.4?0xffffff:(Math.random()<0.5?0xff3322:0xff6644); const s=Phaser.Math.Between(1,4); const p=scene.add.rectangle(px,py,s,s,c,0.8).setDepth(16); scene.tweens.add({targets:p,x:px+dir*Phaser.Math.Between(15,60),y:py+Phaser.Math.Between(-25,20),alpha:0,scaleX:0,scaleY:0,duration:Phaser.Math.Between(120,350),ease:'Power2',onComplete:()=>p.destroy()}); }
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
    scene.cameras.main.shake(100,0.004); spawnDashGhost(scene);
    scene.time.addEvent({delay:25,repeat:Math.floor(DASH_DURATION/25)-1,callback:()=>{if(isDashing)spawnDashGhost(scene);}});
    scene.time.delayedCall(DASH_COOLDOWN,()=>{canDash=true;});
}
function endDash() { isDashing=false; dashTime=0; player.body.allowGravity=true; player.body.setVelocityX(player.body.velocity.x*0.2); }
function spawnDashGhost(scene) {
    const sc = player.scaleX;
    const frame = player.frame.name;
    const place = (tint, depth, alpha, grow, dur) => {
        const g = scene.add.sprite(player.x, player.y, 'ronin', frame)
            .setOrigin(player.originX, player.originY)
            .setScale(sc).setFlipX(player.flipX).setDepth(depth).setTint(tint).setAlpha(alpha);
        scene.tweens.add({
            targets: g, alpha: 0, scaleX: sc * grow, scaleY: sc * grow, duration: dur, ease: 'Power2',
            onComplete: () => g.destroy()
        });
    };
    place(0xffffff, 8, 0.5, 1.05, 180);
    place(0xff2200, 7, 0.3, 1.1, 280);
}

// ============================================================
//  PARRY
// ============================================================
function triggerParry() {
    if(parryCooldown>0||isParrying||isDashing||isAttacking||playerHP<=0||playerDead||upgradeActive) return;
    isParrying=true; parryTimer=PARRY_TOTAL; parryWindow=PARRY_ACTIVE; parryCooldown=PARRY_CD;
    player.body.setVelocityX(0); playAnim('parry'); player.setTint(0x00ffaa);
    const dir=facingRight?1:-1; parryFlash=gameScene.add.graphics().setDepth(12);
    const cx=player.x+30*dir,cy=player.y-10;
    parryFlash.lineStyle(3,0x00ffaa,0.6); parryFlash.strokeCircle(cx,cy,28);
    parryFlash.lineStyle(1.5,0xffffff,0.8); parryFlash.strokeCircle(cx,cy,18);
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
// Thin ledges only catch you from above, so a tall sprite can walk up to a step and jump onto it.
function oneWay(obj, plat) {
    if (!obj.body || !plat.body) return false;
    const prevBottom = obj.body.bottom - obj.body.deltaY();
    return obj.body.velocity.y >= 0 && prevBottom <= plat.body.top + 8;
}

function onLand(p){if(p.body.blocked.down||p.body.touching.down)jumpCount=0;}
