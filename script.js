// ============================================================
//  RONIN'S REDEMPTION — v9
//  The player is the itch.io samurai. The court is the cast from hazır assetler.zip.
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
let specialMeter = 0;
const SPECIAL_MAX = 100;
const SPECIAL_COST = 34; // full bar ≈ three leaps
let specialLeapT = 0;
let lastSpecialTarget = null;
let enemyDropCooldown = 0;
// Short buffers so presses during hitstop / a swing still land.
let atkBuffer = 0, dashBuffer = 0, specialBuffer = 0, parryBuffer = 0;
const INPUT_BUFFER_MS = 140;
let slideIntentT = 0; // Down+X: don't fall through the ledge under the Kayma
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
let reinforceQueue = [];
let reinforceSide = 0;

// ===================== UPGRADE STATE =====================
let upgradeActive = false;
let storyActive = false;
let storyObjects = [];
let upgradeObjects = [];
let upgradesPicked = 0;
let katanaDmgBonus = 0;
let comboSpeedBonus = 0;
let moveSpeedBonus = 0;

// ===================== HEAL PICKUPS =====================
let heals = [];
let healSpawnTimers = [];
const HEAL_MAX_ACTIVE = 2;
const HEAL_PICK_R = 34;
const HEAL_AMT_MIN = 18;
const HEAL_AMT_MAX = 34;

// ===================== AUDIO =====================
let audioCtx = null;

// ===================== HUD =====================
let hpBarGfx, hpText;
let killCountText = null;

// ===================== SPRITE SHEET GRID =====================
const PLAYER_HEIGHT = 140;
const BIT_W = 64, BIT_H = 48, BIT_OX = 26, BIT_OY = 44, BIT_SCALE = 3;
const BIT_DIMS = {
    fw: BIT_W, fh: BIT_H,
    originX: BIT_OX / BIT_W, originY: BIT_OY / BIT_H,
    bodyW: 12, bodyH: 18
};
// Itch.io samurai, realigned so every frame's foot sits on (48, 80).
const SAM_W = 96, SAM_H = 96, SAM_OX = 48, SAM_OY = 80, SAM_SCALE = 3;
const RONIN_SCALE = SAM_SCALE;
const SAMURAI = {
    idle: { key: 'samurai_idle', frames: [1, 2, 3, 2] },
    hurt: { key: 'samurai_idle', frames: [0] },
    run:  { key: 'samurai_walk', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    jump: { key: 'samurai_dash', frames: [3] },
    fall: { key: 'samurai_dash', frames: [11] },
    wall: { key: 'samurai_idle', frames: [3] },
    dash: { key: 'samurai_dash', frames: [0, 2, 4, 6, 8, 10, 12, 14] },
    parry:{ key: 'samurai_atk', frames: [0] },
    death:{ key: 'samurai_death', frames: [0, 1, 2, 3, 4, 5] },
    slide:{ key: 'samurai_slide', frames: [0, 1, 2, 3, 4] },
    jab:  { key: 'samurai_atk', frames: [0, 1, 2, 3, 4, 5, 6] },
    cross:{ key: 'samurai_atk', frames: [0, 1, 2, 3, 4, 5, 6] },
    hook: { key: 'samurai_atk', frames: [0, 1, 2, 3, 4, 5, 6] },
    upper:{ key: 'samurai_atk', frames: [1, 2, 3, 4, 5, 6] },
    heavy:{ key: 'samurai_atk', frames: [0, 1, 2, 3, 4, 5, 6] },
    runattack: { key: 'samurai_atk', frames: [2, 3, 4, 5, 6] },
    airattack: { key: 'samurai_atk', frames: [2, 3, 4, 5, 6] },
    // Chain leap: dash frames for the dash, atk frames for the cut (picked in selectRoninFrame).
    chain: { key: 'samurai_dash', frames: [2, 4, 6, 8, 10, 12] }
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
const SPECIAL_WIND_MS = 80;
const SPECIAL_TRAVEL_MS = 150;
const SPECIAL_STRIKE_MS = 170;
const SPECIAL_LEAP_MS = SPECIAL_WIND_MS + SPECIAL_TRAVEL_MS + SPECIAL_STRIKE_MS;
const SPECIAL_DMG = 40;
const SPECIAL_CHAIN_CANCEL = 0.35; // fraction of strike after which C can leap again

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
// Ground slide. Speed eases off so the cut skates along the floor.
const SLIDE_ATTACK = { name: 'KAYMA', pose: 'slide', dur: 440, cd: 90, hb:{ox:50,oy:-22,w:86,h:36}, lunge: 660, trail:{sa:-6,ea:16,r:36,w:6}, shake: 0.004, dmg: 24 };
const AIR_ATTACK = { name: 'AIR SLASH', pose: 'airattack', dur: 200, cd: 60, hb:{ox:52,oy:-48,w:78,h:50}, lunge: 100, trail:{sa:30,ea:-40,r:50,w:6}, shake: 0.004, dmg: 20 };

// ============================================================
//  AUDIO
// ============================================================
// Local Kenney CC0 SFX + short synthesized room loops (see audio/LICENSE.txt).
let soundReady = false;
let bgmSound = null;
let currentBgmKey = null;
const SFX_KEYS = [
    'sfx_slash', 'sfx_slash2', 'sfx_slash3', 'sfx_hit', 'sfx_hit2', 'sfx_hit_heavy',
    'sfx_hurt', 'sfx_dash', 'sfx_parry', 'sfx_block', 'sfx_arrow', 'sfx_portal',
    'sfx_upgrade', 'sfx_death', 'sfx_slam', 'sfx_ui', 'sfx_ui2', 'sfx_special', 'sfx_foot'
];
function initAudio() {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    soundReady = !!(gameScene && gameScene.sound);
}
function playSfx(key, vol) {
    if (!gameScene || !gameScene.sound || !gameScene.cache.audio.exists(key)) return;
    try { gameScene.sound.play(key, { volume: vol == null ? 0.35 : vol }); } catch (e) {}
}
function playSlashSound() {
    const keys = ['sfx_slash', 'sfx_slash2', 'sfx_slash3'];
    playSfx(keys[(Math.random() * keys.length) | 0], 0.28 + Math.random() * 0.12);
}
function playHitSound() { playSfx(Math.random() < 0.35 ? 'sfx_hit_heavy' : (Math.random() < 0.5 ? 'sfx_hit' : 'sfx_hit2'), 0.4); }
function playHurtSound() { playSfx('sfx_hurt', 0.38); }
function playDashSound() { playSfx('sfx_dash', 0.32); }
function playBlockSound() { playSfx('sfx_block', 0.35); }
function playArrowSound() { playSfx('sfx_arrow', 0.3); }
function playPortalSound() { playSfx('sfx_portal', 0.45); }
function playUpgradeSound() { playSfx('sfx_upgrade', 0.42); playSfx('sfx_ui', 0.3); }
function playHealSound() { playSfx('sfx_ui2', 0.38); playSfx('sfx_upgrade', 0.22); }
function playSlamSound() { playSfx('sfx_slam', 0.5); }
function playDeathSound() { playSfx('sfx_death', 0.55); }
function playSpecialSound() { playSfx('sfx_special', 0.4); }
function playParrySound() { playSfx('sfx_parry', 0.45); }
let bgmStarted = false;
function startBGM() {
    if (bgmStarted) return;
    bgmStarted = true;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (gameScene && gameScene.sound && gameScene.sound.context && gameScene.sound.context.state === 'suspended') {
        gameScene.sound.context.resume().catch(() => {});
    }
    setRoomBgm(ROOMS[currentRoom] && ROOMS[currentRoom].bgm);
}
function setRoomBgm(key) {
    if (!key || !gameScene || !gameScene.sound) return;
    if (!gameScene.cache.audio.exists(key)) return;
    if (currentBgmKey === key && bgmSound && bgmSound.isPlaying) return;
    if (bgmSound) { try { bgmSound.stop(); bgmSound.destroy(); } catch (e) {} bgmSound = null; }
    currentBgmKey = key;
    bgmSound = gameScene.sound.add(key, { loop: true, volume: 0.16 });
    try { bgmSound.play(); } catch (e) { bgmStarted = false; }
}

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
    if (player) {
        // The fall and the slide are drawn into the frames. The sprite stays upright.
        player.setRotation(0);
        if (!playerDead) {
            const dy = player._wantDy || 0;
            if (dy) { player.y += dy; player._appliedDy = dy; }
        }
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
const touch = { left: false, right: false, jump: false, atk: false, dash: false, parry: false, special: false };
const touchPads = [];

function hitTouchPad(x, y) {
    for (let i = 0; i < touchPads.length; i++) {
        const p = touchPads[i];
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
}

function createTouchControls(scene) {
    // Hidden for now — web keyboard play only. Call site kept so mobile pads can return later.
}

// ============================================================
//  THE BROKEN OATH — one cast, seven gates
//  Frames are 128px. The foot sits on the last pixel row.
// ============================================================
const FOE_HEIGHT = 188; // a touch taller than the samurai, not a tower
const CAST = {
    fighter:    { label: 'YUMRUKÇU', color: '#e07040', ox: 62, head: 46, hp: 100, speed: 150, range: 64,  dmg: 14, kind: 'melee',  frames: { idle: 6, walk: 8,  attack: 4,  dead: 3 } },
    shinobi:    { label: 'SHINOBI',  color: '#88aacc', ox: 66, head: 49, hp: 75,  speed: 210, range: 62,  dmg: 16, kind: 'melee',  frames: { idle: 6, walk: 8,  attack: 5,  dead: 4 } },
    sarcher:    { label: 'OKÇU',     color: '#c4a060', ox: 66, head: 14, hp: 70,  speed: 120, range: 280, dmg: 10, kind: 'archer', proj: 'sarcher_arrow', handX: 104, handY: 62, frames: { idle: 9, walk: 8, attack: 14, dead: 5 } },
    gorgon1:    { label: 'YILAN',    color: '#66cc66', ox: 50, head: 48, hp: 140, speed: 110, range: 96,  dmg: 16, kind: 'melee',  frames: { idle: 7, walk: 13, attack: 7, dead: 3 } },
    gorgon2:    { label: 'YILAN',    color: '#88dd66', ox: 62, head: 48, hp: 140, speed: 110, range: 96,  dmg: 16, kind: 'melee',  frames: { idle: 7, walk: 13, attack: 7, dead: 3 } },
    gorgon3:    { label: 'YILAN',    color: '#44aa66', ox: 54, head: 48, hp: 150, speed: 100, range: 96,  dmg: 18, kind: 'melee',  frames: { idle: 7, walk: 13, attack: 7, dead: 3 } },
    skelwar:    { label: 'KEMİK',    color: '#ddddcc', ox: 55, head: 68, hp: 90,  speed: 120, range: 66,  dmg: 14, kind: 'melee',  tall: 274, frames: { idle: 7, walk: 7,  attack: 5,  dead: 4 } },
    skelspear:  { label: 'MIZRAK',   color: '#ccccbb', ox: 58, head: 44, hp: 110, speed: 130, range: 84,  dmg: 16, kind: 'melee',  frames: { idle: 7, walk: 7,  attack: 4,  dead: 5 } },
    skelarch:   { label: 'KEMİK OK', color: '#bbbb99', ox: 62, head: 50, hp: 70,  speed: 110, range: 300, dmg: 10, kind: 'archer', tall: 248, proj: 'skelarch_arrow', handX: 100, handY: 86, frames: { idle: 7, walk: 8, attack: 15, dead: 5 } },
    satyr1:     { label: 'SATİR',    color: '#c4884a', ox: 61, head: 52, hp: 120, speed: 160, range: 66,  dmg: 15, kind: 'melee',  tall: 214, frames: { idle: 7, walk: 12, attack: 4, dead: 4 } },
    satyr2:     { label: 'SATİR',    color: '#d49858', ox: 61, head: 38, hp: 130, speed: 150, range: 70,  dmg: 16, kind: 'melee',  frames: { idle: 7, walk: 12, attack: 8, dead: 4 } },
    satyr3:     { label: 'SATİR',    color: '#b07040', ox: 64, head: 50, hp: 110, speed: 170, range: 66,  dmg: 14, kind: 'melee',  tall: 211, frames: { idle: 6, walk: 12, attack: 9, dead: 4 } },
    fire:       { label: 'ATEŞ',     color: '#ff6633', ox: 51, head: 58, hp: 80,  speed: 100, range: 270, dmg: 12, kind: 'mage', tall: 240, bolt: 'fire', handX: 92, handY: 88, frames: { idle: 7, walk: 6, attack: 4, dead: 6 } },
    light:      { label: 'ŞİMŞEK',   color: '#88ccff', ox: 55, head: 60, hp: 80,  speed: 110, range: 290, dmg: 12, kind: 'mage', tall: 252, bolt: 'lightning', handX: 92, handY: 90, frames: { idle: 7, walk: 7, attack: 10, dead: 5 } },
    wanderer:   { label: 'GEZGİN',   color: '#ccaaee', ox: 63, head: 58, hp: 100, speed: 125, range: 72,  dmg: 16, kind: 'melee',  tall: 240, frames: { idle: 8, walk: 7,  attack: 7,  dead: 4 } },
    kunoichi:   { label: 'KUNOICHI', color: '#cc6688', ox: 62, head: 60, hp: 80,  speed: 200, range: 62,  dmg: 15, kind: 'melee',  tall: 248, frames: { idle: 9, walk: 8,  attack: 6,  dead: 5 } },
    vgirl:      { label: 'VAMPİR',   color: '#cc4466', ox: 65, head: 54, hp: 100, speed: 160, range: 64,  dmg: 16, kind: 'melee',  tall: 226, frames: { idle: 5, walk: 6,  attack: 5,  dead: 10 } },
    converted:  { label: 'DÖNMÜŞ',   color: '#aa6688', ox: 64, head: 48, hp: 150, speed: 130, range: 68,  dmg: 18, kind: 'melee',  tall: 208, frames: { idle: 5, walk: 8,  attack: 5,  dead: 8 } },
    commander:  { label: 'KOMUTAN',  color: '#d8c49a', ox: 63, head: 34, hp: 260, speed: 95,  range: 72,  dmg: 20, kind: 'melee',  miniBoss: true, frames: { idle: 5, walk: 9, attack: 4, dead: 6 } },
    countess:   { label: 'KONTES',   color: '#ff4466', ox: 64, head: 52, hp: 560, speed: 100, range: 78,  dmg: 22, kind: 'melee', boss: true, tall: 250, frames: { idle: 5, walk: 6, attack: 6, dead: 8 } }
};

// Extra sheets unpacked from hazır assetler.zip (hurt / jump / shield / special).
const CAST_EXTRA = {
    fighter: { hurt: 3, jump: 10, shield: 2 },
    shinobi: { hurt: 2, jump: 12, shield: 4 },
    commander: { hurt: 2, jump: 7, shield: 2 },
    sarcher: { hurt: 3, jump: 9 },
    gorgon1: { hurt: 3, special: 5 },
    gorgon2: { hurt: 3, special: 5 },
    gorgon3: { hurt: 3, special: 5 },
    satyr1: { hurt: 4, special: 10 },
    satyr2: { hurt: 4, special: 8 },
    satyr3: { hurt: 4, special: 11 },
    skelwar: { hurt: 2, shield: 1 },
    skelspear: { hurt: 3, shield: 2 },
    skelarch: { hurt: 2, jump: 6 },
    fire: { hurt: 3, jump: 9, special: 12 },
    light: { hurt: 3, jump: 8, special: 10 },
    wanderer: { hurt: 4, jump: 8 },
    kunoichi: { hurt: 2, jump: 10 },
    vgirl: { hurt: 2, jump: 6 },
    converted: { hurt: 1, jump: 7, shield: 2 },
    countess: { hurt: 2, jump: 6 }
};
Object.keys(CAST_EXTRA).forEach((id) => {
    if (CAST[id]) Object.assign(CAST[id].frames, CAST_EXTRA[id]);
});

const CASTLE_CROP = { x: 0, y: 115, w: 1023, h: 793 };

// Per-gate live atmosphere: grade, fog, shafts, particles, mid layer, platform skin.
const ROOM_ATMO = {
    courtyard: {
        mid: 'mid_courtyard', plat: 'stone',
        grade: 0xff9966, gradeA: 0.05,
        fog: 0x2a1810, fogA: 0.32,
        shaft: 0xffc080, shaftCount: 2,
        mote: 0xffb070, moteRate: 90, moteKind: 'ember',
        haze: 0x1a0c08
    },
    garden: {
        mid: 'mid_garden', plat: 'wood',
        grade: 0x66aa55, gradeA: 0.05,
        fog: 0x204028, fogA: 0.28,
        shaft: 0xc8ff90, shaftCount: 1,
        mote: 0xe07090, moteRate: 70, moteKind: 'petal',
        haze: 0x102818
    },
    crypt: {
        mid: 'mid_crypt', plat: 'balcony',
        grade: 0x6688cc, gradeA: 0.07,
        fog: 0x101828, fogA: 0.4,
        shaft: 0x88bbff, shaftCount: 2,
        mote: 0xaaccff, moteRate: 110, moteKind: 'dust',
        haze: 0x081018
    },
    ridge: {
        mid: 'mid_ridge', plat: 'stone',
        grade: 0xff8844, gradeA: 0.06,
        fog: 0x402010, fogA: 0.28,
        shaft: 0xffcc88, shaftCount: 2,
        mote: 0xffd080, moteRate: 80, moteKind: 'ash',
        haze: 0x281408
    },
    tower: {
        mid: 'mid_tower', plat: 'balcony',
        grade: 0xaa66dd, gradeA: 0.08,
        fog: 0x201030, fogA: 0.36,
        shaft: 0xcc88ff, shaftCount: 2,
        mote: 0xdd99ff, moteRate: 75, moteKind: 'spark',
        haze: 0x140820
    },
    night: {
        mid: 'mid_night', plat: 'wood',
        grade: 0x4466aa, gradeA: 0.07,
        fog: 0x081020, fogA: 0.38,
        shaft: 0x8899cc, shaftCount: 1,
        mote: 0xffe080, moteRate: 100, moteKind: 'firefly',
        haze: 0x060c18
    },
    throne: {
        mid: 'mid_throne', plat: 'balcony',
        grade: 0xcc3344, gradeA: 0.08,
        fog: 0x280808, fogA: 0.4,
        shaft: 0xff5533, shaftCount: 1,
        mote: 0xff4422, moteRate: 85, moteKind: 'ash',
        haze: 0x1a0408
    }
};

const ROOMS = {
    courtyard: {
        title: 'Dış Avlu',
        line: 'Komutan avluyu tutuyor. Yukarı çık, yedekleri seyrek bırak. Kapı, hepsi bitince açılır.',
        bg: 'bg_courtyard', layout: 'castle', bgm: 'bgm_courtyard', atmo: 'courtyard',
        spawn: { x: 430, y: 590 },
        portal: { x: 640, y: 470, w: 90, h: 50 },
        next: 'garden',
        foes: [
            ['commander', 640, 600],
            ['fighter', 140, 500], ['shinobi', 1060, 490],
            ['sarcher', 220, 360], ['sarcher', 1080, 350]
        ],
        reserves: ['fighter', 'sarcher']
    },
    garden: {
        title: 'Yılan Bahçesi',
        line: 'Yılanlar zemini tutmuş. Peronlar alçak ve geniş. Aşağı + X ile kayarak kes.',
        bg: 'bg_garden', layout: 'garden', bgm: 'bgm_garden', atmo: 'garden',
        spawn: { x: 640, y: 590 },
        portal: { x: 700, y: 590, w: 80, h: 55 },
        next: 'crypt',
        foes: [['gorgon1', 220, 510], ['gorgon2', 980, 515], ['gorgon3', 480, 600], ['gorgon1', 860, 600]],
        reserves: ['gorgon2', 'gorgon3']
    },
    crypt: {
        title: 'Kemik Mahzeni',
        line: 'Tavan basık. Okçular alçak galeriden aşağı bakar. Aşağı in, V oku keser.',
        bg: 'bg_crypt', layout: 'crypt', bgm: 'bgm_crypt', atmo: 'crypt',
        spawn: { x: 480, y: 580 },
        portal: { x: 1160, y: 592, w: 70, h: 46 },
        next: 'ridge',
        foes: [
            ['skelspear', 520, 590], ['skelwar', 780, 590],
            ['skelarch', 260, 470], ['skelarch', 1040, 470], ['skelwar', 640, 590]
        ],
        reserves: ['skelwar', 'skelarch']
    },
    ridge: {
        title: 'Yabani Sırt',
        line: 'Taş basamaklar sırta çıkar. Satirler yolu keser; zirvedeki boynuz aşağı bakar.',
        bg: 'bg_ridge', layout: 'ridge', bgm: 'bgm_ridge', atmo: 'ridge',
        spawn: { x: 160, y: 590 },
        portal: { x: 640, y: 180, w: 80, h: 50 },
        next: 'tower',
        foes: [
            ['satyr1', 320, 600], ['satyr2', 1080, 490],
            ['satyr3', 640, 320], ['satyr1', 420, 400], ['satyr2', 860, 400]
        ],
        reserves: ['satyr3', 'satyr1', 'satyr2']
    },
    tower: {
        title: 'Büyü Kulesi',
        line: 'Ateş sol galeride, şimşek sağda. Gezgin zemini kesiyor. Büyü yukarıdan iner.',
        bg: 'bg_tower', layout: 'hall', bgm: 'bgm_tower', atmo: 'tower',
        spawn: { x: 210, y: 580 },
        portal: { x: 1160, y: 592, w: 70, h: 46 },
        next: 'night',
        foes: [
            ['wanderer', 700, 590],
            ['fire', 237, 428], ['light', 1046, 428],
            ['fire', 416, 268], ['light', 890, 268]
        ],
        reserves: ['wanderer', 'fire', 'light', 'fire']
    },
    night: {
        title: 'Gece İç Avlu',
        line: 'Vampirler zeminde. Kunoichi yan raylarda. Özel barı doldur, C ile zincirle.',
        bg: 'bg_night', layout: 'night', bgm: 'bgm_night', atmo: 'night',
        spawn: { x: 200, y: 590 },
        portal: { x: 1000, y: 530, w: 80, h: 50 },
        next: 'throne',
        foes: [
            ['vgirl', 480, 600], ['converted', 900, 600],
            ['kunoichi', 300, 370], ['kunoichi', 980, 370],
            ['kunoichi', 640, 250], ['vgirl', 500, 440]
        ],
        reserves: ['kunoichi', 'vgirl', 'converted', 'kunoichi']
    },
    throne: {
        title: 'Taht',
        line: 'Kontes salonun ortasında. Kanı yarıya inince iki yanından biri girer.',
        bg: 'bg_throne', layout: 'throne', bgm: 'bgm_throne', atmo: 'throne',
        spawn: { x: 280, y: 580 },
        final: true,
        foes: [['countess', 680, 590]],
        reserves: ['vgirl', 'converted', 'kunoichi']
    }
};

// ============================================================
//  PRELOAD
// ============================================================
function preload() {
    this.load.image('bg_castle', 'background.jpg');
    this.load.image('bg_boss', 'background_boss.png');
    ['courtyard', 'garden', 'crypt', 'ridge', 'tower', 'night', 'throne'].forEach((r) => {
        this.load.image('bg_' + r, 'art/bg/bg_' + r + '.png?v=81');
        this.load.image('mid_' + r, 'art/mid/mid_' + r + '.png?v=81');
        this.load.audio('bgm_' + r, 'audio/bgm_' + r + '.ogg');
    });
    SFX_KEYS.forEach((k) => this.load.audio(k, 'audio/' + k + '.ogg'));
    const vfx = { frameWidth: 32, frameHeight: 32 };
    this.load.spritesheet('vfx_spark', 'art/vfx/spark.png?v=80', vfx);
    this.load.spritesheet('vfx_slash', 'art/vfx/slash.png?v=80', vfx);
    this.load.spritesheet('vfx_dash', 'art/vfx/dash_dust.png?v=80', vfx);
    this.load.spritesheet('vfx_hit', 'art/vfx/hit_burst.png?v=80', vfx);
    this.load.image('ui_gate', 'art/ui/gate.png?v=80');
    this.load.image('ui_heart', 'art/ui/heart.png?v=80');
    this.load.image('ui_special', 'art/ui/special.png?v=80');
    const sam = { frameWidth: SAM_W, frameHeight: SAM_H };
    const cell = { frameWidth: 128, frameHeight: 128 };
    this.load.spritesheet('samurai_idle', 'samurai_idle.png?v=45', sam);
    this.load.spritesheet('samurai_walk', 'samurai_walk.png?v=45', sam);
    this.load.spritesheet('samurai_atk', 'samurai_atk.png?v=45', sam);
    this.load.spritesheet('samurai_dash', 'samurai_dash.png?v=45', sam);
    this.load.spritesheet('samurai_slide', 'samurai_slide.png?v=60', sam);
    this.load.spritesheet('samurai_death', 'samurai_death.png?v=60', sam);
    Object.keys(CAST).forEach((id) => {
        const def = CAST[id];
        Object.keys(def.frames).forEach((anim) => {
            this.load.spritesheet(id + '_' + anim, 'art/cast/' + id + '_' + anim + '.png?v=80', cell);
        });
        if (def.proj) this.load.image(def.proj, 'art/cast/' + def.proj + '.png?v=50');
    });
}

// ============================================================
//  CREATE
// ============================================================
function create() {
    gameScene = this;

    makeSpellBolts(this);

    // Feet sit on the texture origin, so flips and landings stay put.
    // Body is centered on that origin, so facing left does not shift the hitbox.
    player = this.physics.add.sprite(250, 620, 'samurai_idle', 1);
    playerHurtTimer = 1400;
    player._hurtPose = 0;
    player.setScale(SAM_SCALE).setBounce(0).setCollideWorldBounds(true).setDepth(10);
    player.setOrigin(SAM_OX / SAM_W, SAM_OY / SAM_H);
    player.body.setSize(10, 22);
    player.body.setOffset(SAM_OX - 5, SAM_OY - 22);
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
        W: this.input.keyboard.addKey('W'), S: this.input.keyboard.addKey('S'),
        SPACE: this.input.keyboard.addKey('SPACE'),
        SHIFT: this.input.keyboard.addKey('SHIFT'),
        X: this.input.keyboard.addKey('X'), C: this.input.keyboard.addKey('C'),
        V: this.input.keyboard.addKey('V')
    };
    createTouchControls(this);
    this.input.on('pointerdown', (pointer) => {
        if (!audioCtx) initAudio(); startBGM();
        // A tap on open ground still swings. Pads handle their own actions.
        if (hitTouchPad(pointer.x, pointer.y)) return;
        if (storyActive) { dismissStory(); return; }
        if (pointer.leftButtonDown() && !playerDead && !upgradeActive && !transitioning && !storyActive) {
            atkBuffer = INPUT_BUFFER_MS;
            if (dropHeld()) slideIntentT = 160;
        }
    });

    // --- HUD ---
    createHUD(this);
    initAudio();
    this.input.keyboard.on('keydown', () => { startBGM(); });

    // --- THE FIRST GATE ---
    storyActive = true;
    buildRoom(this, 'courtyard');
    showOpening(this);
}

// ============================================================
//  ROOM SYSTEM
// ============================================================
function clearRoom() {
    enemies.forEach(e => {
        if (e.sprite && e.sprite.scene) e.sprite.destroy();
        if (e.hpGfx && e.hpGfx.scene) e.hpGfx.destroy();
        if (e.typeLabel && e.typeLabel.scene) e.typeLabel.destroy();
        if (e._aimGfx && e._aimGfx.scene) e._aimGfx.destroy();
    });
    enemies = [];
    projectiles.forEach(p => { if (p.gfx && p.gfx.scene) p.gfx.destroy(); });
    projectiles = [];
    clearHeals();
    roomObjects.forEach(obj => { if (obj && obj.scene) obj.destroy(); });
    roomObjects = [];
    if (gameScene && gameScene._roomHits) {
        gameScene._roomHits.forEach(c => c.destroy());
        gameScene._roomHits = [];
    }
    if (platforms) platforms.clear(true, true);
    if (walls) walls.clear(true, true);
    if (bossHpGfx) { bossHpGfx.destroy(); bossHpGfx = null; }
    if (bossHpText) { bossHpText.destroy(); bossHpText = null; }
    if (bossNameText) { bossNameText.destroy(); bossNameText = null; }
    if (portalGfx) { portalGfx.destroy(); portalGfx = null; }
    if (portalZone) { if (portalZone.destroy) portalZone.destroy(); portalZone = null; }
    portalActive = false;
    boss = null;
    reinforceQueue = [];
    reinforceSide = 0;
    activeAttackers = [];
    if (gameScene) {
        gameScene._atmo = null;
        gameScene._atmoFogGfx = null;
        gameScene._atmoShaftGfx = null;
        gameScene._atmoMid = null;
    }
    // Clear player combat locks so a room change never leaves a stuck leap/swing.
    if (player) {
        player._specialLeap = false;
        player._chainTarget = null;
        player._slide = false;
        player._atkRef = null;
        if (player.body) player.body.allowGravity = true;
        player.setAlpha(1);
        player.clearTint();
        player.setScale(SAM_SCALE);
    }
    specialLeapT = 0;
    isAttacking = false;
    attackTimer = 0;
    canAttack = true;
    hitstopTimer = 0;
    atkBuffer = 0; dashBuffer = 0; specialBuffer = 0; parryBuffer = 0;
    slideIntentT = 0;
    lastSpecialTarget = null;
}

function platSkin() {
    const a = roomAtmo(ROOMS[currentRoom]);
    return a.plat || 'stone';
}

function layCastle(scene) {
    const p = platSkin();
    // Palace art is cover-fit, so the courtyard sits at the bottom of the frame.
    // Each rise is one jump. Floors overlap so a standing jump reaches the next roof.
    makeVisiblePlatform(scene, 640, 627 + 14, 1500, 28, 'ground');
    makeVisiblePlatform(scene, 140, 538 + 4, 200, 8, p);
    makeVisiblePlatform(scene, 220, 398 + 4, 280, 8, p);
    makeVisiblePlatform(scene, 180, 258 + 4, 220, 8, p);
    makeVisiblePlatform(scene, 220, 150 + 4, 180, 8, p);
    makeVisiblePlatform(scene, 640, 500 + 4, 280, 8, p);
    makeVisiblePlatform(scene, 1060, 530 + 4, 200, 8, p);
    makeVisiblePlatform(scene, 1080, 390 + 4, 240, 8, p);
    makeVisiblePlatform(scene, 1040, 250 + 4, 200, 8, p);
}

function layGarden(scene) {
    const p = platSkin();
    makeVisiblePlatform(scene, 640, 627 + 14, 1500, 28, 'ground');
    makeVisiblePlatform(scene, 320, 548 + 4, 420, 8, p);
    makeVisiblePlatform(scene, 980, 552 + 4, 400, 8, p);
}

function layCrypt(scene) {
    const p = platSkin();
    makeVisiblePlatform(scene, 640, 616 + 16, 1500, 32, 'ground');
    makeVisiblePlatform(scene, 260, 508 + 3, 200, 6, p);
    makeVisiblePlatform(scene, 1040, 508 + 3, 200, 6, p);
}

function layThrone(scene) {
    makeVisiblePlatform(scene, 640, 616 + 16, 1500, 32, 'ground');
}

function layRidge(scene) {
    const p = platSkin();
    makeVisiblePlatform(scene, 640, 627 + 14, 1500, 28, 'ground');
    makeVisiblePlatform(scene, 200, 520 + 4, 180, 8, p);
    makeVisiblePlatform(scene, 420, 430 + 4, 160, 8, p);
    makeVisiblePlatform(scene, 640, 350 + 4, 180, 8, p);
    makeVisiblePlatform(scene, 860, 430 + 4, 160, 8, p);
    makeVisiblePlatform(scene, 1080, 520 + 4, 180, 8, p);
    makeVisiblePlatform(scene, 640, 210 + 4, 140, 8, p);
}

function layNight(scene) {
    const p = platSkin();
    makeVisiblePlatform(scene, 640, 627 + 14, 1500, 28, 'ground');
    makeVisiblePlatform(scene, 280, 560 + 4, 240, 8, p);
    makeVisiblePlatform(scene, 1000, 560 + 4, 240, 8, p);
    makeVisiblePlatform(scene, 500, 470 + 4, 220, 8, p);
    makeVisiblePlatform(scene, 300, 400 + 4, 200, 8, p);
    makeVisiblePlatform(scene, 980, 400 + 4, 200, 8, p);
    makeVisiblePlatform(scene, 640, 280 + 4, 180, 8, p);
}

function layHall(scene) {
    const p = platSkin();
    makeVisiblePlatform(scene, 640, 616 + 16, 1500, 32, 'ground');
    makeVisiblePlatform(scene, 237, 452 + 3, 130, 6, p);
    makeVisiblePlatform(scene, 1046, 452 + 3, 130, 6, p);
    makeVisiblePlatform(scene, 604, 454 + 3, 200, 6, p);
    makeVisiblePlatform(scene, 416, 292 + 3, 120, 6, p);
    makeVisiblePlatform(scene, 890, 292 + 3, 120, 6, p);
    makeVisiblePlatform(scene, 180, 540 + 3, 100, 6, p);
    makeVisiblePlatform(scene, 1120, 530 + 3, 100, 6, p);
}

function buildRoom(scene, roomName) {
    clearRoom();
    const room = ROOMS[roomName] || ROOMS.courtyard;
    currentRoom = roomName;
    platforms = scene.physics.add.staticGroup();
    walls = scene.physics.add.staticGroup();

    const backdrop = addFittedBackdrop(scene, room.bg, room.crop || null);
    if (room.tint && backdrop) backdrop.setTint(room.tint);
    applyRoomAtmosphere(scene, room);
    if (bgmStarted) setRoomBgm(room.bgm);
    if (room.layout === 'garden') layGarden(scene);
    else if (room.layout === 'crypt') layCrypt(scene);
    else if (room.layout === 'throne') layThrone(scene);
    else if (room.layout === 'ridge') layRidge(scene);
    else if (room.layout === 'night') layNight(scene);
    else if (room.layout === 'hall') layHall(scene);
    else layCastle(scene);
    makeInvisibleWall(scene, 8, 360, 16, 720);
    makeInvisibleWall(scene, 1272, 360, 16, 720);

    room.foes.forEach(([id, x, y]) => spawnFoe(scene, id, x, y));
    reinforceQueue = (room.reserves || []).slice();
    reinforceSide = 0;
    totalEnemiesInRoom = enemies.length + reinforceQueue.length;

    if (boss) {
        const title = boss.config.boss ? 'KONTES' : (boss.config.label || 'KOMUTAN');
        const col = boss.config.boss ? '#ff4466' : '#d8c49a';
        bossNameText = scene.add.text(W / 2, 50, title, {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: col, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
        bossHpGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
        bossHpText = scene.add.text(W / 2, 69, '', {
            fontFamily: 'monospace', fontSize: '7px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0);
    }

    if (scene._roomHits) scene._roomHits.forEach(c => c.destroy());
    scene._roomHits = [
        scene.physics.add.collider(player, platforms, onLand, oneWay),
        scene.physics.add.collider(player, walls)
    ];

    scene.cameras.main.setZoom(1);
    scene.cameras.main.removeBounds();
    scene.cameras.main.setScroll(0, 0);
    if (!storyActive) showRoomCard(room);
    scheduleRoomHeals(scene, room);
}

// ============================================================
//  MYSTIC PORTAL — Opens when all enemies are dead
// ============================================================
function spawnFoe(scene, id, x, y) {
    const e = new SheetEnemy(scene, x, y, id);
    enemies.push(e);
    if (e.config.boss || e.config.miniBoss) boss = e;
    scene.physics.add.collider(e.sprite, platforms, null, oneWay);
    scene.physics.add.collider(e.sprite, walls);
    return e;
}

// Replacements walk in from the wings until the room's reserve is spent.
function beginCountessPhase(bossEnemy) {
    bossEnemy.config.speed = Math.round(bossEnemy.config.speed * 1.5);
    bossEnemy.config.attackCooldown = 680;
    if (bossNameText) bossNameText.setText('KONTES · KAN');
    let n = 0;
    while (reinforceQueue.length && n < 2) {
        sendReinforcement();
        n++;
    }
    if (!gameScene) return;
    const fl = gameScene.add.rectangle(W / 2, H / 2, W, H, 0x660011, 0.35).setDepth(180).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0, duration: 420, onComplete: () => fl.destroy() });
    playSlamSound();
}

function beginCommanderPhase(bossEnemy) {
    bossEnemy.config.speed = Math.round(bossEnemy.config.speed * 1.35);
    bossEnemy.config.attackCooldown = 780;
    bossEnemy.config.attackDmg = Math.round(bossEnemy.config.attackDmg * 1.15);
    if (bossNameText) bossNameText.setText('KOMUTAN · EMİR');
    let n = 0;
    while (reinforceQueue.length && n < 2) {
        sendReinforcement();
        n++;
    }
    if (!gameScene) return;
    const fl = gameScene.add.rectangle(W / 2, H / 2, W, H, 0x443311, 0.3).setDepth(180).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0, duration: 380, onComplete: () => fl.destroy() });
    playSlamSound();
}

function sendReinforcement() {
    if (!reinforceQueue.length || !gameScene) return null;
    const id = reinforceQueue.shift();
    const fromLeft = (reinforceSide++ % 2) === 0;
    const room = ROOMS[currentRoom];
    const low = room && (room.layout === 'hall' || room.layout === 'crypt' || room.layout === 'throne');
    const e = spawnFoe(gameScene, id, fromLeft ? 90 : 1190, low ? 590 : 600);
    e.entering = fromLeft ? 1 : -1;
    return e;
}

function clearHeals() {
    heals.forEach((h) => {
        if (h.gfx && h.gfx.scene) h.gfx.destroy();
        if (h.glow && h.glow.scene) h.glow.destroy();
        if (h.ring && h.ring.scene) h.ring.destroy();
    });
    heals = [];
    healSpawnTimers.forEach((t) => { if (t && t.remove) t.remove(false); });
    healSpawnTimers = [];
}

function pickUncertainHealSpot() {
    if (!platforms) return null;
    const kids = platforms.getChildren().filter((p) => p && p.body && p.active);
    if (!kids.length) return null;
    // Prefer ledges / mid decks; sometimes the ground so it's still "somewhere".
    const ledges = kids.filter((p) => p.body.width < 900);
    const pool = (ledges.length && Math.random() < 0.82) ? ledges : kids;
    const plat = Phaser.Utils.Array.GetRandom(pool);
    const half = plat.body.width * 0.5;
    // Bias toward platform edges / odd offsets — not dead center.
    const edgeBias = Math.random() < 0.65 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const jitter = edgeBias
        ? edgeBias * (half * Phaser.Math.FloatBetween(0.45, 0.88))
        : Phaser.Math.FloatBetween(-half * 0.55, half * 0.55);
    const x = Phaser.Math.Clamp(plat.x + jitter, 50, W - 50);
    const top = plat.y - plat.body.height * 0.5;
    const y = top - Phaser.Math.Between(16, 28);
    // Reject if almost on top of another heal.
    for (let i = 0; i < heals.length; i++) {
        if (Math.hypot(heals[i].x - x, heals[i].y - y) < 70) return null;
    }
    return { x, y };
}

function spawnHealPickup(scene, opts) {
    if (!scene || !player || playerDead || storyActive || upgradeActive || transitioning) return null;
    if (heals.length >= HEAL_MAX_ACTIVE) return null;
    if (playerHP >= playerMaxHP && !(opts && opts.force)) return null;
    const spot = pickUncertainHealSpot();
    if (!spot) return null;
    const amt = Phaser.Math.Between(HEAL_AMT_MIN, HEAL_AMT_MAX);
    const glow = scene.add.circle(spot.x, spot.y, 16, 0xff6688, 0.22).setDepth(12)
        .setBlendMode(Phaser.BlendModes.ADD);
    const ring = scene.add.circle(spot.x, spot.y, 10, 0xffffff, 0).setDepth(12);
    ring.setStrokeStyle(1.5, 0xffa0b0, 0.55);
    let gfx;
    if (scene.textures.exists('ui_heart')) {
        gfx = scene.add.image(spot.x, spot.y, 'ui_heart').setDepth(13).setScale(1.7);
    } else {
        gfx = scene.add.circle(spot.x, spot.y, 7, 0xff4466, 0.95).setDepth(13);
    }
    // Soft blink so the spot stays a little uncertain until you notice it.
    gfx.setAlpha(0.35);
    scene.tweens.add({
        targets: [gfx, glow, ring],
        alpha: { from: 0.25, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => {
            if (gfx.active) gfx.setAlpha(1);
            if (glow.active) glow.setAlpha(0.28);
            if (ring.active) ring.setAlpha(1);
        }
    });
    scene.tweens.add({
        targets: [gfx, glow, ring],
        y: spot.y - 7,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    const heal = { x: spot.x, y: spot.y, amt, gfx, glow, ring, life: 22000, bob: 0 };
    heals.push(heal);
    return heal;
}

function scheduleRoomHeals(scene, room) {
    clearHeals();
    if (!scene || !room) return;
    // First drip after the room settles — not always, not always soon.
    if (Math.random() < 0.7) {
        healSpawnTimers.push(scene.time.delayedCall(Phaser.Math.Between(2800, 7000), () => {
            spawnHealPickup(scene);
        }));
    }
    // A later, rarer second chance while the fight is still going.
    if (Math.random() < 0.45) {
        healSpawnTimers.push(scene.time.delayedCall(Phaser.Math.Between(12000, 22000), () => {
            if (playerHP < playerMaxHP * 0.85) spawnHealPickup(scene);
        }));
    }
    // Boss / mini-boss rooms get a slightly kinder mid-fight roll.
    if (room.final || (room.foes && room.foes.some(([id]) => CAST[id] && (CAST[id].boss || CAST[id].miniBoss)))) {
        healSpawnTimers.push(scene.time.delayedCall(Phaser.Math.Between(8000, 14000), () => {
            if (playerHP < playerMaxHP * 0.55) spawnHealPickup(scene, { force: true });
        }));
    }
}

function maybeDropHealOnKill(scene) {
    if (!scene || playerHP >= playerMaxHP) return;
    // Uncertain drop — not every kill, more likely when hurt.
    const hurtFactor = 1 - (playerHP / playerMaxHP);
    const chance = 0.08 + hurtFactor * 0.22;
    if (Math.random() < chance) spawnHealPickup(scene);
}

function collectHeal(heal) {
    if (!heal || !gameScene) return;
    const before = playerHP;
    playerHP = Math.min(playerMaxHP, playerHP + heal.amt);
    const gained = Math.ceil(playerHP - before);
    playHealSound();
    updateHUD();
    if (heal.gfx && heal.gfx.scene) {
        gameScene.tweens.add({
            targets: [heal.gfx, heal.glow, heal.ring].filter(Boolean),
            y: heal.y - 40, alpha: 0, scale: 1.8, duration: 280,
            onComplete: () => {
                if (heal.gfx && heal.gfx.destroy) heal.gfx.destroy();
                if (heal.glow && heal.glow.destroy) heal.glow.destroy();
                if (heal.ring && heal.ring.destroy) heal.ring.destroy();
            }
        });
    }
    const txt = gameScene.add.text(heal.x, heal.y - 20, '+' + gained, {
        fontFamily: 'monospace', fontSize: '14px', color: '#66ff99', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(40);
    gameScene.tweens.add({ targets: txt, y: txt.y - 28, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sp = gameScene.add.circle(heal.x, heal.y, 2, 0xff8899, 0.9).setDepth(14);
        gameScene.tweens.add({
            targets: sp,
            x: heal.x + Math.cos(a) * 28,
            y: heal.y + Math.sin(a) * 28 - 10,
            alpha: 0, duration: 320, onComplete: () => sp.destroy()
        });
    }
}

function tickHeals(delta) {
    if (!player || playerDead || storyActive || upgradeActive || transitioning) return;
    for (let i = heals.length - 1; i >= 0; i--) {
        const h = heals[i];
        h.life -= delta;
        if (h.life <= 0) {
            if (h.gfx && h.gfx.scene) {
                gameScene.tweens.add({
                    targets: [h.gfx, h.glow, h.ring].filter(Boolean),
                    alpha: 0, duration: 400,
                    onComplete: () => {
                        if (h.gfx && h.gfx.destroy) h.gfx.destroy();
                        if (h.glow && h.glow.destroy) h.glow.destroy();
                        if (h.ring && h.ring.destroy) h.ring.destroy();
                    }
                });
            }
            heals.splice(i, 1);
            continue;
        }
        // Fade warn near expiry
        if (h.life < 4000 && h.gfx) {
            h.gfx.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(h.life * 0.012)));
        }
        const dx = player.x - h.x, dy = (player.y - 20) - h.y;
        if (dx * dx + dy * dy < HEAL_PICK_R * HEAL_PICK_R) {
            heals.splice(i, 1);
            collectHeal(h);
        }
    }
}

function checkAllEnemiesDead() {
    if (portalActive || transitioning || storyActive || upgradeActive) return;
    const aliveCount = enemies.filter(e => !e.dead).length;
    // Pull a reserve only when the floor has thinned — not on every kill.
    if (reinforceQueue.length && aliveCount > 0 && aliveCount < MAX_ACTIVE_ATTACKERS) {
        sendReinforcement();
    }
    if (aliveCount === 0 && reinforceQueue.length) {
        sendReinforcement();
    }
    const still = enemies.filter(e => !e.dead).length;
    if (still === 0 && !reinforceQueue.length && enemies.length > 0) {
        const room = ROOMS[currentRoom];
        if (room && room.final) showEnding();
        else openMysticPortal();
    }
}

function openMysticPortal() {
    portalActive = true;
    playPortalSound();

    const room = ROOMS[currentRoom];
    const gate = room && room.portal ? room.portal : { x: 640, y: 520, w: 58, h: 42 };
    const px = gate.x, py = gate.y;

    portalGfx = gameScene.add.graphics().setDepth(5);
    // Mystical energy circle
    portalGfx.lineStyle(3, 0x9944ff, 0.8);
    portalGfx.strokeCircle(px, py, 30);
    portalGfx.lineStyle(2, 0xcc66ff, 0.5);
    portalGfx.strokeCircle(px, py, 22);
    portalGfx.fillStyle(0x6622cc, 0.15);
    portalGfx.fillCircle(px, py, 28);
    roomObjects.push(portalGfx);
    if (gameScene.textures.exists('ui_gate')) {
        const gateIcon = gameScene.add.image(px, py - 2, 'ui_gate').setDepth(7).setScale(1.6).setAlpha(0.95);
        gameScene.tweens.add({ targets: gateIcon, y: py - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        roomObjects.push(gateIcon);
    }

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
    const lbl = gameScene.add.text(px, py - 45, 'KAPI AÇIK', {
        fontFamily: 'Georgia, serif', fontSize: '8px', color: '#cc66ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6);
    gameScene.tweens.add({ targets: lbl, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    roomObjects.push(lbl);

    portalZone = { x: px, y: py, w: gate.w, h: gate.h };

    // Camera flash
    gameScene.cameras.main.flash(400, 100, 50, 200);

    // Announcement
    const ann = gameScene.add.text(W/2, H/2 - 40, 'YOL AÇILDI', {
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
            const dest = ROOMS[targetRoom];
            const spawn = dest && dest.spawn ? dest.spawn : { x: 190, y: 600 };
            player.setPosition(spawn.x, spawn.y);
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
        { name: '連 COMBO MASTER', desc: 'Kombo penceresi +200ms\nVuruşlar %12 hızlı', color: 0x44aaff, icon: '連',
          apply: () => { COMBO_WINDOW += 200; comboSpeedBonus += 1; } },
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

    // Pickup spark burst
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        spawnVfxBurst('vfx_spark', W / 2 + Math.cos(a) * 20, H / 2 + Math.sin(a) * 12, Math.cos(a));
    }
    gameScene.cameras.main.shake(70, 0.004);

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

function spawnVfxBurst(key, x, y, dir) {
    if (!gameScene || !gameScene.textures.exists(key)) return;
    const tex = gameScene.textures.get(key);
    const frames = Object.keys(tex.frames).filter((k) => k !== '__BASE');
    const max = Math.max(0, frames.length - 1);
    const spr = gameScene.add.sprite(x, y, key, 0).setDepth(16).setScale(1.4);
    if (dir < 0) spr.setFlipX(true);
    let frame = 0;
    if (max > 0) {
        gameScene.time.addEvent({
            delay: 45, repeat: max,
            callback: () => {
                frame++;
                if (frame <= max) spr.setFrame(frame);
            }
        });
    }
    gameScene.tweens.add({
        targets: spr, alpha: 0, x: x + (dir || 0) * 18, duration: 260,
        onComplete: () => { if (spr.active) spr.destroy(); }
    });
}

// ============================================================
//  INVISIBLE PLATFORMS
// ============================================================
// Platform visual styles
const PLAT_STYLES = {
    ground:  { fill: 0x1a0e0a, border: 0xc45a3a, highlight: 0xffc2a8, alpha: 0.45 },
    stone:   { fill: 0x1a1824, border: 0xb0a090, highlight: 0xffe8d0, alpha: 0.72 },
    wood:    { fill: 0x2a180c, border: 0xd09058, highlight: 0xffd8a8, alpha: 0.78 },
    balcony: { fill: 0x201018, border: 0xd07080, highlight: 0xffc0c8, alpha: 0.78 }
};

function makeVisiblePlatform(scene, x, y, w, h, style) {
    const st = PLAT_STYLES[style] || PLAT_STYLES.stone;
    const atmo = roomAtmo(ROOMS[currentRoom]);
    // Draw a thicker board than the physics slab so ledges read as wood/stone beams.
    const visH = style === 'ground' ? Math.max(h, 22) : Math.max(h, 16);
    const key = 'vp_' + x + '_' + y + '_' + w + '_' + visH + '_' + currentRoom + '_v2';
    if (!scene.textures.exists(key)) {
        const g = scene.add.graphics();
        // Soft under-shadow
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(2, 4, w - 4, visH - 2, 3);
        // Main beam
        g.fillStyle(st.fill, Math.min(0.92, st.alpha + 0.12));
        g.fillRoundedRect(0, 0, w, visH, Math.min(4, visH / 2));
        // Top lit edge tinted by room shaft color
        g.lineStyle(2, atmo.shaft, 0.55);
        g.lineBetween(3, 2, w - 3, 2);
        g.lineStyle(1, st.highlight, 0.85);
        g.lineBetween(4, 1, w - 4, 1);
        // Bottom rim
        g.lineStyle(1, st.border, 0.7);
        g.lineBetween(2, visH - 2, w - 2, visH - 2);
        g.strokeRoundedRect(0, 0, w, visH, Math.min(4, visH / 2));
        // Plank / brick marks — skip on the full-width ground so it doesn't read as a grid.
        if (w > 40 && w < 900) {
            g.lineStyle(1, st.highlight, 0.18);
            for (let lx = 18; lx < w - 10; lx += 26) {
                g.lineBetween(lx, 3, lx, visH - 3);
            }
            if (style === 'wood' || style === 'balcony') {
                g.lineStyle(1, st.border, 0.25);
                g.lineBetween(6, Math.floor(visH / 2), w - 6, Math.floor(visH / 2));
            }
        } else if (style === 'ground') {
            g.fillStyle(atmo.haze, 0.35);
            g.fillRect(0, 0, w, visH);
            g.lineStyle(1, atmo.shaft, 0.2);
            g.lineBetween(0, 1, w, 1);
        }
        // End brackets on ledges
        if (style !== 'ground' && w < 900) {
            g.fillStyle(st.border, 0.55);
            g.fillRect(0, visH - 2, 6, 8);
            g.fillRect(w - 6, visH - 2, 6, 8);
        }
        g.generateTexture(key, w, visH + (style !== 'ground' ? 8 : 0));
        g.destroy();
    }
    const plat = platforms.create(x, y, key);
    plat.setDepth(3);
    plat.setData('ledge', style !== 'ground');
    // Keep a thin physical top so jumps / one-way feel crisp.
    plat.body.setSize(w, Math.max(8, h));
    plat.body.setOffset(0, 0);
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
    // The palace crop is taller than the screen. Cover the frame and pin the
    // courtyard to the bottom so the side bars go and the stairs stay in view.
    // The hall is already wide; contain keeps the beams where the platforms are.
    const cover = !!crop;
    const scale = cover ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const cnv = document.createElement('canvas');
    cnv.width = W;
    cnv.height = H;
    const ctx = cnv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const ox = Math.round((W - dw) / 2);
    const oy = cover ? (H - dh) : Math.round((H - dh) / 2);
    ctx.drawImage(src, sx, sy, sw, sh, ox, oy, dw, dh);
    const tkey = key + '_fit_' + (crop ? crop.y : 0) + (cover ? '_c' : '');
    if (scene.textures.exists(tkey)) scene.textures.remove(tkey);
    scene.textures.addCanvas(tkey, cnv);
    const img = scene.add.image(W / 2, H / 2, tkey).setDepth(0);
    roomObjects.push(img);
    return img;
}

function roomAtmo(room) {
    const key = (room && room.atmo) || currentRoom || 'courtyard';
    return ROOM_ATMO[key] || ROOM_ATMO.courtyard;
}

function applyRoomAtmosphere(scene, room) {
    const atmo = roomAtmo(room);
    scene._atmo = atmo;
    scene._atmoMoteT = 0;
    scene._atmoFogPhase = 0;

    // Mid silhouette / accent layer — sits above backdrop, under platforms/actors.
    if (atmo.mid && scene.textures.exists(atmo.mid)) {
        const mid = scene.add.image(W / 2, H / 2, atmo.mid).setDepth(1).setAlpha(0.55);
        roomObjects.push(mid);
        scene.tweens.add({
            targets: mid, x: W / 2 + 10, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        scene._atmoMid = mid;
    }

    // Ground haze
    const haze = scene.add.graphics().setDepth(2);
    haze.fillGradientStyle(atmo.haze, atmo.haze, atmo.haze, atmo.haze, 0, 0, atmo.fogA, atmo.fogA);
    haze.fillRect(0, 520, W, 220);
    roomObjects.push(haze);

    // Soft color grade wash (normal + additive so dark rooms stay readable)
    const grade = scene.add.rectangle(W / 2, H / 2, W, H, atmo.grade, atmo.gradeA * 0.55).setDepth(3);
    roomObjects.push(grade);
    const glow = scene.add.rectangle(W / 2, H * 0.35, W, H * 0.7, atmo.shaft, 0.04)
        .setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    roomObjects.push(glow);

    // Animated fog bands
    const fogBand = scene.add.graphics().setDepth(4).setAlpha(0.55);
    roomObjects.push(fogBand);
    scene._atmoFogGfx = fogBand;
    redrawAtmoFog(scene, 0);

    // Light shafts
    const shafts = scene.add.graphics().setDepth(5).setAlpha(0.35);
    roomObjects.push(shafts);
    scene._atmoShaftGfx = shafts;
    const positions = atmo.shaftCount === 1 ? [W * 0.55] : [W * 0.22, W * 0.78];
    shafts.fillStyle(atmo.shaft, 0.22);
    positions.forEach((x) => {
        shafts.fillTriangle(x - 18, 0, x + 18, 0, x + 70, H * 0.78);
        shafts.fillTriangle(x - 18, 0, x + 18, 0, x - 70, H * 0.78);
    });
    scene.tweens.add({
        targets: shafts, alpha: 0.18, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Strong cinematic vignette
    const v = scene.add.graphics().setDepth(91).setScrollFactor(0);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0); v.fillRect(0, 0, W, 100);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.62, 0.62); v.fillRect(0, H - 130, W, 130);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0, 0, 0.35); v.fillRect(0, 0, 48, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.35, 0.35, 0); v.fillRect(W - 48, 0, 48, H);
    roomObjects.push(v);

    // Seed a few motes so the room feels alive immediately.
    for (let i = 0; i < 8; i++) spawnAtmoMote(scene, true);
}

function redrawAtmoFog(scene, phase) {
    const g = scene._atmoFogGfx;
    const atmo = scene._atmo || ROOM_ATMO.courtyard;
    if (!g) return;
    g.clear();
    g.fillStyle(atmo.fog, 0.12);
    for (let i = 0; i < 4; i++) {
        const y = 390 + i * 48 + Math.sin(phase * 0.7 + i) * 10;
        const xOff = Math.sin(phase * 0.35 + i * 1.3) * 40;
        g.fillEllipse(W * 0.25 + xOff, y, 420, 46);
        g.fillEllipse(W * 0.72 - xOff, y + 12, 380, 40);
    }
}

function spawnAtmoMote(scene, seed) {
    const atmo = scene._atmo || ROOM_ATMO.courtyard;
    if (!scene) return;
    const kind = atmo.moteKind || 'dust';
    const x = Phaser.Math.Between(20, W - 20);
    const y = seed ? Phaser.Math.Between(80, H - 80) : Phaser.Math.Between(-20, H * 0.55);
    let p;
    if (kind === 'petal') {
        p = scene.add.ellipse(x, y, Phaser.Math.Between(4, 7), Phaser.Math.Between(2, 4), atmo.mote, 0.75).setDepth(6);
        scene.tweens.add({
            targets: p,
            x: x + Phaser.Math.Between(-80, 80),
            y: y + Phaser.Math.Between(120, 280),
            angle: Phaser.Math.Between(-90, 90),
            alpha: 0, duration: Phaser.Math.Between(2200, 3800),
            ease: 'Sine.easeIn', onComplete: () => p.destroy()
        });
    } else if (kind === 'firefly') {
        p = scene.add.circle(x, y, Phaser.Math.Between(1, 2), atmo.mote, 0.9).setDepth(6);
        scene.tweens.add({
            targets: p,
            x: x + Phaser.Math.Between(-60, 60),
            y: y + Phaser.Math.Between(-40, 40),
            alpha: 0.15, duration: Phaser.Math.Between(900, 1600),
            yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
            onComplete: () => p.destroy()
        });
    } else if (kind === 'spark') {
        p = scene.add.rectangle(x, y, 2, 2, atmo.mote, 0.85).setDepth(6);
        scene.tweens.add({
            targets: p,
            y: y - Phaser.Math.Between(40, 120),
            x: x + Phaser.Math.Between(-30, 30),
            alpha: 0, duration: Phaser.Math.Between(700, 1400),
            onComplete: () => p.destroy()
        });
    } else if (kind === 'ash' || kind === 'ember') {
        p = scene.add.circle(x, y, Phaser.Math.Between(1, 3), atmo.mote, Phaser.Math.FloatBetween(0.35, 0.8)).setDepth(6);
        scene.tweens.add({
            targets: p,
            x: x + Phaser.Math.Between(-40, 40),
            y: y - Phaser.Math.Between(60, 220),
            alpha: 0, duration: Phaser.Math.Between(1800, 3600),
            ease: 'Sine.easeOut', onComplete: () => p.destroy()
        });
    } else {
        p = scene.add.circle(x, y, Phaser.Math.Between(1, 2), atmo.mote, 0.35).setDepth(6);
        scene.tweens.add({
            targets: p,
            x: x + Phaser.Math.Between(-50, 50),
            y: y + Phaser.Math.Between(40, 160),
            alpha: 0, duration: Phaser.Math.Between(2400, 4200),
            onComplete: () => p.destroy()
        });
    }
}

function tickRoomAtmosphere(scene, delta) {
    if (!scene || !scene._atmo || storyActive || upgradeActive || transitioning) return;
    scene._atmoFogPhase = (scene._atmoFogPhase || 0) + delta * 0.0012;
    if ((scene._atmoFogTick = (scene._atmoFogTick || 0) - delta) <= 0) {
        scene._atmoFogTick = 80;
        redrawAtmoFog(scene, scene._atmoFogPhase);
    }
    scene._atmoMoteT = (scene._atmoMoteT || 0) - delta;
    if (scene._atmoMoteT <= 0) {
        spawnAtmoMote(scene, false);
        scene._atmoMoteT = scene._atmo.moteRate || 100;
    }
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
        }).setOrigin(0.5).setDepth(23).setAlpha(0);
    }

    headY() {
        const s = this.sprite;
        const dims = this.config.dims;
        if (dims && dims.headTop != null) {
            return s.y - (dims.fh * dims.originY - dims.headTop) * s.scaleY;
        }
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
        // Labels stay quiet unless the foe is close or hurt — keeps the stage readable.
        const near = player && Math.hypot(player.x - s.x, player.y - s.y) < 210;
        const showLab = !!(this.config.boss || this.config.miniBoss || this.hurtTimer > 0 || near);
        this.typeLabel.setPosition(s.x, head - 16).setAlpha(showLab ? 0.7 : 0);
        if (!showLab && this.hp >= this.maxHp) {
            // Hide pristine far HP bars too — only silhouettes at distance.
            g.clear();
        }
    }

    showFrame(anim, index) {
        const s = this.sprite;
        if (!s || !anim) return;
        const frame = anim.frames[Math.min(index, anim.frames.length - 1)];
        const key = anim.key || this.config.sheet;
        const switched = s.texture.key !== key;
        if (switched) s.setTexture(key, frame);
        else if (String(s.frame.name) !== String(frame)) s.setFrame(frame);
        if (switched) {
            const dims = this.config.dims;
            const scale = (this.config.pixelHeight || ENEMY_HEIGHT) / dims.fh;
            s.setScale(scale).setFlipX(!this.facingRight);
            applyFeetBody(s, dims, 0.55);
        }
    }

    playAnim(name) {
        if (this.animName === name) return;
        const anim = this.config.anims[name];
        if (!anim) return;
        this.animName = name; this.animFrame = 0; this.animTimer = 0;
        this.showFrame(anim, 0);
    }

    updateAnim(delta) {
        const anim = this.config.anims[this.animName];
        if (!anim || !anim.frames.length) return;
        this._wantDy = 0;
        if (anim.frames.length === 1) {
            this.showFrame(anim, 0);
            return;
        }
        const fps = anim.fps;
        this.animTimer += delta;
        if (this.animTimer >= 1000 / fps) {
            this.animTimer -= 1000 / fps;
            this.animFrame++;
            if (this.animFrame >= anim.frames.length) this.animFrame = anim.loop ? 0 : anim.frames.length - 1;
            this.showFrame(anim, this.animFrame);
        }
    }

    takeDamage(dmg, dir, opts) {
        if (this.dead || !this.sprite || !this.sprite.body) return;
        const finalDmg = dmg + katanaDmgBonus;
        this.hp -= finalDmg;
        // Short rehit lock so jabs can chain instead of bouncing off a long stun.
        this.hurtTimer = (opts && opts.fromSpecial) ? 160 : 90;
        this.sprite.body.setVelocityX(dir * ((opts && opts.fromSpecial) ? 340 : 220));
        this.sprite.body.setVelocityY((opts && opts.fromSpecial) ? -140 : -70);
        playHitSound();
        if (this.config.anims.hurt) this.playAnim('hurt');
        spawnVfxBurst('vfx_hit', this.sprite.x, this.headY() + 24, dir);
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
        if (!(opts && opts.fromSpecial)) chargeSpecial(14 + Math.min(18, finalDmg * 0.45));
        if (this.config.boss && !this._phase2 && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
            this._phase2 = true;
            beginCountessPhase(this);
        } else if (this.config.miniBoss && !this._phase2 && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
            this._phase2 = true;
            beginCommanderPhase(this);
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
        gameScene.tweens.add({ targets: s, alpha: 0, duration: 280, ease: 'Power2',
            onComplete: () => { s.destroy(); this.hpGfx.destroy(); this.typeLabel.destroy(); }
        });
        const kt = gameScene.add.text(s.x, s.y - 40, 'SLAIN', { fontFamily: 'monospace', fontSize: '12px', color: '#ff6644', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
        gameScene.tweens.add({ targets: kt, y: kt.y - 30, alpha: 0, duration: 1000, onComplete: () => kt.destroy() });
        maybeDropHealOnKill(gameScene);
        // Check if all enemies dead -> open portal
        gameScene.time.delayedCall(500, () => checkAllEnemiesDead());
    }

    checkHitPlayer() {
        if (isDashing || playerHurtTimer > 0 || playerHP <= 0 || playerDead) return;
        const dx = Math.abs(player.x - this.sprite.x), dy = Math.abs(player.y - this.sprite.y);
        const reach = this.config.kind === 'melee' ? Math.min(this.config.attackRange || 64, 110) : 56;
        if (dx < reach && dy < 72) {
            if (isParrying && parryWindow > 0) {
                triggerParrySuccess(gameScene);
                this.hurtTimer = 300; this.sprite.body.setVelocityX((this.facingRight ? -1 : 1) * 300);
                return;
            }
            playerHP -= this.config.attackDmg; playerHurtTimer = PLAYER_HURT_IFRAMES; player._hurtPose = 180;
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
        if (!s || !s.body || !s.active) return;
        if (this.hurtTimer > 0) {
            this._wantDy = 0;
            this.hurtTimer -= delta;
            s.setTint(this.hurtTimer % 100 > 50 ? 0xffffff : 0xff4444);
            if (this.config.anims.hurt) this.playAnim('hurt');
            this.drawHP(); this.updateAnim(delta); return;
        }
        s.clearTint();
        if (this.attackCd > 0) this.attackCd -= delta;
        this.facingRight = player.x > s.x;
        s.setFlipX(!this.facingRight);
        if (this.tickDrop(delta)) {
            this.updateAnim(delta);
            this.drawHP();
            return;
        }
        this.updateAI(delta);
        const vxBefore = s.body.velocity.x;
        this.stayOnLedge();
        // Ledge-pinned chasers were holding party slots forever. Free the slot, then drop if the samurai is below.
        if (this.state === 'chase' && Math.abs(vxBefore) > 8 && Math.abs(s.body.velocity.x) < 8
            && (s.body.blocked.down || s.body.touching.down)) {
            this._stuckT = (this._stuckT || 0) + delta;
            if (this._stuckT > 320) {
                this.releaseAttackSlot();
                if (player.y > s.y + 55 && this.onLedgePlatform()) {
                    this.dropping = true;
                    this._dropPlat = null;
                    s.body.setVelocityY(240);
                }
                this._stuckT = 0;
            }
        } else {
            this._stuckT = 0;
        }
        const grounded = s.body.blocked.down || s.body.touching.down;
        if (!grounded && this.state !== 'attack' && this.config.anims.jump) {
            this.playAnim('jump');
        }
        this.updateAnim(delta);
        this.drawHP();
    }

    onLedgePlatform() {
        const s = this.sprite;
        if (!s || !s.body || !platforms) return false;
        const kids = platforms.getChildren();
        for (let i = 0; i < kids.length; i++) {
            const p = kids[i];
            if (!p.body || !p.getData('ledge')) continue;
            const left = p.x - p.body.width / 2;
            const right = p.x + p.body.width / 2;
            const top = p.y - p.body.height / 2;
            if (s.x >= left - 6 && s.x <= right + 6 && Math.abs(s.body.bottom - top) <= 12) return true;
        }
        return false;
    }

    // After the room thins out, perched foes drop to the floor the samurai is on.
    tickDrop(delta) {
        const s = this.sprite;
        if (this.dropping) {
            this.shootTimer = 0;
            if (this._aimGfx) this._aimGfx.clear();
            s.body.setVelocityX(0);
            if (s.body.velocity.y < 160) s.body.setVelocityY(220);
            this.playAnim('walk');
            const grounded = s.body.blocked.down || s.body.touching.down;
            if (grounded) {
                // Ground ends the drop. A mid ledge only holds them if the player is no longer below.
                if (!this.onLedgePlatform() || player.y < s.y + 70) {
                    this.dropping = false;
                    this._dropPlat = null;
                }
            }
            return true;
        }
        if (this.config.boss || this.state === 'attack') return false;
        if (enemyDropCooldown > 0 || !roomThinned()) return false;
        if (!(s.body.blocked.down || s.body.touching.down)) return false;
        if (player.y < s.y + 70) return false;
        if (!this.onLedgePlatform()) return false;
        this.dropping = true;
        this._dropPlat = null;
        this.state = 'idle';
        this.shootTimer = 0;
        s.body.setVelocityX(0);
        s.body.setVelocityY(240);
        enemyDropCooldown = 480;
        return true;
    }

    // These sheets have no jump. Walking off a roof dumps everyone onto the player.
    stayOnLedge() {
        const s = this.sprite;
        if (this.dropping) return;
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
//  SHEET FOES — one class, the whole court
// ============================================================
class SheetEnemy extends Enemy {
    constructor(scene, x, y, id) {
        const def = CAST[id];
        const dims = {
            fw: 128, fh: 128,
            originX: def.ox / 128, originY: 1,
            bodyW: def.kind === 'melee' && id.startsWith('gorgon') ? 28 : 22,
            bodyH: 44,
            headTop: def.head
        };
        const anims = {};
        Object.keys(def.frames).forEach((name) => {
            const n = def.frames[name];
            anims[name] = {
                key: id + '_' + name,
                frames: Array.from({ length: n }, (_, i) => i),
                fps: name === 'attack' || name === 'special' ? 12 : name === 'walk' || name === 'jump' ? 10 : name === 'hurt' ? 8 : 6,
                loop: name === 'idle' || name === 'walk' || name === 'shield'
            };
        });
        const attackFrames = def.frames.attack || 4;
        const specialFrames = def.frames.special || 0;
        super(scene, x, y, {
            sheet: id + '_idle',
            label: def.label, labelColor: def.color,
            hp: def.hp, pixelHeight: def.tall || FOE_HEIGHT,
            attackDmg: def.dmg, knockback: def.boss || def.miniBoss ? 340 : 220,
            speed: def.speed,
            chaseRange: def.kind === 'melee' ? 340 : 460,
            attackRange: def.range,
            fleeRange: def.kind === 'melee' ? 0 : 90,
            attackDur: Math.round((attackFrames / 12) * 1000),
            specialDur: specialFrames ? Math.round((specialFrames / 11) * 1000) : 0,
            attackCooldown: def.boss ? 1100 : def.miniBoss ? 1000 : def.kind === 'melee' ? 900 : 1600,
            dims: dims,
            anims: anims,
            kind: def.kind,
            boss: !!def.boss,
            miniBoss: !!def.miniBoss,
            proj: def.proj || null,
            bolt: def.bolt || null,
            handX: def.handX || 96,
            handY: def.handY || 72
        });
        this.shootTimer = 0;
        this._fired = false;
        this._usingSpecial = false;
    }

    drawHP() {
        super.drawHP();
        if ((!this.config.boss && !this.config.miniBoss) || !bossHpGfx) return;
        bossHpGfx.clear();
        const bx = (W / 2) - 120, by = 58, bw = 240, bh = 10;
        const ratio = Math.max(0, this.hp / this.maxHp);
        const fillW = Math.floor((bw - 4) * ratio);
        const edge = this.config.boss ? 0xff4466 : 0xd8c49a;
        const fill = this.config.boss ? 0xcc2244 : 0xc4a060;
        bossHpGfx.fillStyle(0x1a0008, 0.9);
        bossHpGfx.fillRoundedRect(bx, by, bw, bh, 5);
        bossHpGfx.lineStyle(1, edge, 0.7);
        bossHpGfx.strokeRoundedRect(bx, by, bw, bh, 5);
        if (fillW > 0) bossHpGfx.fillStyle(fill, 0.95).fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 3);
        if (bossHpText) bossHpText.setText(Math.ceil(this.hp) + ' / ' + this.maxHp);
    }

    die() {
        if (this._aimGfx) { this._aimGfx.destroy(); this._aimGfx = null; }
        const anim = this.config.anims.dead;
        if (anim) {
            this.animName = 'dead';
            this.showFrame(anim, anim.frames.length - 1);
        }
        if (this.config.boss && bossNameText) bossNameText.setText('DÜŞTÜ');
        super.die();
    }

    updateAI(delta) {
        if (this.entering) {
            const s = this.sprite;
            const cfg = this.config;
            s.body.setVelocityX(this.entering * cfg.speed);
            this.state = 'chase';
            this.playAnim('walk');
            const dist = Math.hypot(player.x - s.x, player.y - s.y);
            if (dist < cfg.chaseRange) this.entering = 0;
            return;
        }
        if (this.config.kind === 'melee') this.updateMelee(delta);
        else this.updateRanged(delta);
    }

    updateMelee(delta) {
        const s = this.sprite;
        const dx = player.x - s.x;
        const dist = Math.hypot(dx, player.y - s.y);
        const cfg = this.config;
        if (this.state === 'attack') {
            this.attackTimer -= delta;
            this.playAnim(this._usingSpecial && cfg.anims.special ? 'special' : 'attack');
            const dur = this._usingSpecial && cfg.specialDur ? cfg.specialDur : cfg.attackDur;
            const hitAt = dur * (this._usingSpecial ? 0.38 : 0.45);
            if (this.attackTimer < hitAt && this.attackTimer > hitAt - delta - 8) {
                const saved = cfg.attackDmg;
                if (this._usingSpecial) cfg.attackDmg = Math.round(saved * 1.45);
                this.checkHitPlayer();
                cfg.attackDmg = saved;
            }
            if (this.attackTimer <= 0) {
                this.state = 'idle';
                this._usingSpecial = false;
                this.attackCd = cfg.attackCooldown;
                this.releaseAttackSlot();
            }
            s.body.setVelocityX(0);
            return;
        }
        if (dist > cfg.chaseRange * 1.45) {
            this.state = 'idle';
            this.playAnim(cfg.anims.shield ? 'shield' : 'idle');
            s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < cfg.attackRange && this.attackCd <= 0 && (cfg.boss || cfg.miniBoss || this.isActiveAttacker())) {
            this._usingSpecial = !!(cfg.anims.special && Math.random() < (cfg.miniBoss || cfg.boss ? 0.38 : 0.26));
            this.state = 'attack';
            this.attackTimer = this._usingSpecial && cfg.specialDur ? cfg.specialDur : cfg.attackDur;
            this.playAnim(this._usingSpecial ? 'special' : 'attack');
            if (this._usingSpecial) playSpecialSound();
            s.body.setVelocityX(0);
        } else if (dist < cfg.chaseRange && (cfg.boss || cfg.miniBoss || this.isActiveAttacker())) {
            this.state = 'chase'; this.playAnim('walk');
            s.body.setVelocityX((dx > 0 ? 1 : -1) * cfg.speed);
        } else {
            this.state = 'idle';
            const holding = activeAttackers.includes(this);
            this.playAnim(cfg.anims.shield && !holding ? 'shield' : 'idle');
            s.body.setVelocityX(0);
        }
    }

    updateRanged(delta) {
        const s = this.sprite;
        const dx = player.x - s.x;
        const dist = Math.hypot(dx, player.y - s.y);
        const cfg = this.config;
        if (this.shootTimer > 0 && dist >= cfg.fleeRange) {
            this.shootTimer -= delta;
            this.playAnim('attack');
            s.body.setVelocityX(0);
            if (!this._fired && this.shootTimer <= cfg.attackDur * 0.32) {
                this._fired = true;
                this.fireBolt();
                this.releaseAttackSlot();
            }
            if (this.shootTimer <= 0) this.state = 'idle';
            this.drawAim();
            return;
        }
        if (dist < cfg.fleeRange) {
            this.shootTimer = 0;
            this.state = 'flee'; this.playAnim('walk');
            s.body.setVelocityX((dx > 0 ? -1 : 1) * cfg.speed * 1.25);
        } else if (dist > cfg.chaseRange * 1.4) {
            this.state = 'idle'; this.playAnim('idle'); s.body.setVelocityX(0); this.releaseAttackSlot();
        } else if (dist < cfg.attackRange && this.attackCd <= 0 && this.isActiveAttacker()) {
            this.state = 'shoot';
            this._usingSpecial = !!(cfg.anims.special && Math.random() < 0.3);
            this.shootTimer = this._usingSpecial && cfg.specialDur ? cfg.specialDur : cfg.attackDur;
            this._fired = false;
            this.playAnim(this._usingSpecial ? 'special' : 'attack');
            if (this._usingSpecial) playSpecialSound();
            s.body.setVelocityX(0);
            this.attackCd = cfg.attackCooldown;
        } else if (dist < cfg.chaseRange && dist > cfg.attackRange * 0.72 && this.isActiveAttacker()) {
            this.state = 'chase'; this.playAnim('walk');
            s.body.setVelocityX((dx > 0 ? 1 : -1) * cfg.speed * 0.6);
        } else {
            this.state = 'idle'; this.playAnim('idle'); s.body.setVelocityX(0);
        }
        this.drawAim();
    }

    handPoint() {
        const dir = this.facingRight ? 1 : -1;
        const scale = this.sprite.scaleY;
        const dims = this.config.dims;
        return {
            x: this.sprite.x + dir * (this.config.handX - dims.fw * dims.originX) * scale,
            y: this.sprite.y - (dims.fh - this.config.handY) * scale,
            dir: dir
        };
    }

    drawAim() {
        if (this.dead) return;
        if (!this._aimGfx) this._aimGfx = gameScene.add.graphics().setDepth(14);
        this._aimGfx.clear();
        if (!(this.shootTimer > 0 && !this._fired)) return;
        const hand = this.handPoint();
        const chestY = player.y - 40;
        this._aimGfx.lineStyle(2, 0xffcc88, 0.55);
        this._aimGfx.lineBetween(hand.x, hand.y, player.x, chestY);
    }

    fireBolt() {
        const hand = this.handPoint();
        const ax = hand.x;
        const ay = hand.y;
        const chestY = player.y - 40;
        let dx = player.x - ax;
        let dy = chestY - ay;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 460;
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;
        // Tip sits on the right of the image. Rotation aims it; flip would turn it over.
        const ang = Math.atan2(vy, vx);
        let gfx;
        if (this.config.proj) {
            gfx = gameScene.add.sprite(ax, ay, this.config.proj).setScale(2).setRotation(ang).setDepth(16);
        } else {
            const key = this.config.bolt === 'lightning' ? 'bolt_lightning' : 'bolt_fire';
            gfx = gameScene.add.sprite(ax, ay, key).setScale(2).setRotation(ang).setDepth(15);
        }
        projectiles.push({ gfx: gfx, x: ax, y: ay, vx: vx, vy: vy, life: 2200, dmg: this.config.attackDmg });
        if (typeof playArrowSound === 'function') playArrowSound();
    }
}

function makeSpellBolts(scene) {
    const paint = (key, rows) => {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 8;
        const g = c.getContext('2d');
        rows.forEach((hex, i) => {
            g.fillStyle = hex;
            g.fillRect(i * 2, 2, 2, 4);
        });
        g.fillRect(14, 1, 2, 6);
        if (scene.textures.exists(key)) scene.textures.remove(key);
        scene.textures.addCanvas(key, c);
    };
    paint('bolt_fire', ['#4a1408', '#a02808', '#e05010', '#ffb040', '#ffe080', '#fff6c8', '#ffd080', '#ff8020']);
    paint('bolt_lightning', ['#102040', '#2060a0', '#60c0ff', '#d8f4ff', '#ffffff', '#c0e8ff', '#70b0ff', '#3080e0']);
}

function showRoomCard(room) {
    if (!room || !gameScene) return;
    const veil = gameScene.add.rectangle(W / 2, 108, 520, 64, 0x08060a, 0.45)
        .setDepth(179).setScrollFactor(0);
    const title = gameScene.add.text(W / 2, 92, room.title, {
        fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f3e6cc', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(180).setScrollFactor(0);
    const line = gameScene.add.text(W / 2, 112, room.line, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cbb896', align: 'center',
        wordWrap: { width: 480 }
    }).setOrigin(0.5, 0).setDepth(180).setScrollFactor(0);
    roomObjects.push(veil, title, line);
    gameScene.tweens.add({
        targets: [veil, title, line], alpha: 0, delay: 2400, duration: 600,
        onComplete: () => {
            if (veil.scene) veil.destroy();
            if (title.scene) title.destroy();
            if (line.scene) line.destroy();
        }
    });
}

function showOpening(scene) {
    storyActive = true;
    scene.physics.pause();
    const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x07060a, 0.78).setDepth(400).setScrollFactor(0);
    const title = scene.add.text(W / 2, 168, 'KIRIK YEMİN', {
        fontFamily: 'Georgia, serif', fontSize: '36px', color: '#f3e6cc', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(410).setScrollFactor(0);
    const body = scene.add.text(W / 2, 220,
        'Bu kapıda yeminini bozmuştu. Kale hâlâ ayakta.\nİçinde yürüyenler artık onun adamları değil.\n\nLanet kapı kapı bölünmüş. Her kapı başka bir beden bulmuş:\nyumruk, yılan, kemik, boynuz, büyü ve kan.',
        {
            fontFamily: 'Georgia, serif', fontSize: '15px', color: '#d8c49a', align: 'center',
            wordWrap: { width: 820 }, lineSpacing: 5
        }
    ).setOrigin(0.5, 0).setDepth(410).setScrollFactor(0);
    const controls = scene.add.text(W / 2, 400,
        'A / D  yürü   ·   W / Space  zıpla   ·   X  vur\nAşağı + X  kayma   ·   Shift  dash   ·   V  parry   ·   C  özel zincir',
        {
            fontFamily: 'monospace', fontSize: '13px', color: '#c4b090', align: 'center',
            lineSpacing: 8
        }
    ).setOrigin(0.5, 0).setDepth(410).setScrollFactor(0);
    const hint = scene.add.text(W / 2, 560, 'Devam etmek için tıkla', {
        fontFamily: 'monospace', fontSize: '13px', color: '#aa9977'
    }).setOrigin(0.5).setDepth(410).setScrollFactor(0);
    scene.tweens.add({ targets: hint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });
    storyObjects = [veil, title, body, controls, hint];
}

function dismissStory() {
    if (!storyActive) return;
    storyActive = false;
    storyObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
    storyObjects = [];
    if (gameScene && gameScene.physics) gameScene.physics.resume();
    showRoomCard(ROOMS[currentRoom]);
}

function showEnding() {
    if (storyActive) return;
    storyActive = true;
    gameScene.physics.pause();
    const veil = gameScene.add.rectangle(W / 2, H / 2, W, H, 0x07060a, 0.72).setDepth(400).setScrollFactor(0);
    const title = gameScene.add.text(W / 2, 240, 'YEMİN KAPANDI', {
        fontFamily: 'Georgia, serif', fontSize: '32px', color: '#f3e6cc', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(410).setScrollFactor(0);
    const body = gameScene.add.text(W / 2, 310,
        'Kontes düştü. Kale bir anlığına sessiz kaldı.\nRonin kılıcını indirdi. Bu sefer bırakmak için değil.',
        {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#d8c49a', align: 'center',
            wordWrap: { width: 760 }, lineSpacing: 6
        }
    ).setOrigin(0.5, 0).setDepth(410).setScrollFactor(0);
    storyObjects = [veil, title, body];
}

// ============================================================
//  PROJECTILES
// ============================================================
function updateProjectiles(delta) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.life -= delta; p.x += p.vx*(delta/1000); p.y += p.vy*(delta/1000);
        p.gfx.setPosition(p.x, p.y);
        if (isParrying && parryWindow > 0 && Math.abs(p.x - player.x) < 48 && Math.abs(p.y - (player.y - 30)) < 46) {
            p.gfx.destroy(); projectiles.splice(i, 1);
            triggerParrySuccess(gameScene);
            continue;
        }
        if (!isDashing && playerHurtTimer <= 0 && playerHP > 0 && !playerDead) {
            // A slide keeps the body low, so a chest-high arrow passes over it.
            const bodyTop = player.y - (player._slide ? 26 : PLAYER_HEIGHT * 0.85);
            if (Math.abs(p.x - player.x) < 26 && p.y < player.y && p.y > bodyTop) {
                playerHP -= p.dmg; playerHurtTimer = PLAYER_HURT_IFRAMES; player._hurtPose = 180; playHurtSound();
                player.body.setVelocityX((p.vx>0?1:-1)*150); player.body.setVelocityY(-80);
                player.setTint(0xff4444); gameScene.cameras.main.shake(60,0.003);
                updateHUD(); if (playerHP<=0) playerDeath();
                p.gfx.destroy(); projectiles.splice(i,1); continue;
            }
        }
        if (p.life<=0||p.x<-50||p.x>W+50||p.y<-60||p.y>H+40) { p.gfx.destroy(); projectiles.splice(i,1); }
    }
}

// ============================================================
//  HUD
// ============================================================
function createHUD(scene) {
    hpBarGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
    if (scene.textures.exists('ui_heart')) {
        scene.add.image(26, 21, 'ui_heart').setDepth(102).setScrollFactor(0).setScale(1.15);
    }
    if (scene.textures.exists('ui_special')) {
        scene.add.image(26, 38, 'ui_special').setDepth(102).setScrollFactor(0).setScale(1.05);
    }
    hpText = scene.add.text(108, 22, '100', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 0.5).setDepth(102).setScrollFactor(0);
    scene.comboText = scene.add.text(W/2, 150, '', { fontFamily: 'monospace', fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.parryText = scene.add.text(W/2, 118, '', { fontFamily: 'monospace', fontSize: '18px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5).setDepth(100).setAlpha(0).setScrollFactor(0);
    scene.comboCountText = scene.add.text(W - 16, 50, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ff8844', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(100).setScrollFactor(0).setAlpha(0);
    killCountText = scene.add.text(40, 52, '', { fontFamily: 'monospace', fontSize: '11px', color: '#c4b090' }).setDepth(100).setScrollFactor(0);
    drawPlayerHP();
}

function chargeSpecial(amount) {
    if (playerDead || amount <= 0) return;
    const was = specialMeter;
    specialMeter = Math.min(SPECIAL_MAX, specialMeter + amount);
    if (gameScene && gameScene.parryText) {
        if (was < SPECIAL_COST && specialMeter >= SPECIAL_COST) {
            gameScene.parryText.setText('ÖZEL · C').setColor('#ffcc66').setAlpha(1).setScale(1.1);
            gameScene.tweens.add({ targets: gameScene.parryText, alpha: 0, duration: 700, ease: 'Power2' });
        } else if (was < SPECIAL_MAX && specialMeter >= SPECIAL_MAX) {
            gameScene.parryText.setText('ÖZEL DOLU · C').setColor('#ffe088').setAlpha(1).setScale(1.2);
            gameScene.tweens.add({ targets: gameScene.parryText, alpha: 0, duration: 900, ease: 'Power2' });
        }
    }
    updateHUD();
}

function pickSpecialTarget() {
    let best = null, bestD = 1e9;
    const others = enemies.filter(e => !e.dead && e !== lastSpecialTarget);
    const pool = others.length ? others : enemies.filter(e => !e.dead);
    for (let i = 0; i < pool.length; i++) {
        const e = pool[i];
        if (!e.sprite) continue;
        const d = Math.hypot(e.sprite.x - player.x, e.sprite.y - player.y);
        if (d < bestD) { bestD = d; best = e; }
    }
    return best;
}

function spawnChainGhost(x, y, dir) {
    if (!gameScene || !player) return;
    const ghost = gameScene.add.sprite(x, y, player.texture.key, player.frame.name)
        .setOrigin(SAM_OX / SAM_W, SAM_OY / SAM_H)
        .setScale(SAM_SCALE)
        .setFlipX(dir < 0)
        .setTint(0xffe088)
        .setAlpha(0.55)
        .setDepth(11);
    gameScene.tweens.add({
        targets: ghost, alpha: 0, scaleX: SAM_SCALE * 1.08, scaleY: SAM_SCALE * 0.92,
        duration: 180, ease: 'Power2', onComplete: () => ghost.destroy()
    });
}

function spawnChainBurst(x, y, dir) {
    if (!gameScene) return;
    const ring = gameScene.add.graphics().setDepth(14);
    ring.lineStyle(3, 0xffe088, 0.85);
    ring.strokeCircle(x, y - 40, 18);
    ring.lineStyle(1.5, 0xffffff, 0.7);
    ring.strokeCircle(x, y - 40, 28);
    gameScene.tweens.add({
        targets: ring, alpha: 0, scaleX: 2.4, scaleY: 2.4,
        duration: 260, ease: 'Cubic.easeOut', onComplete: () => ring.destroy()
    });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = x + Math.cos(a) * 10;
        const py = y - 40 + Math.sin(a) * 10;
        const sp = gameScene.add.circle(px, py, Phaser.Math.Between(2, 4), i % 2 ? 0xffe088 : 0xffffff, 0.95).setDepth(15);
        gameScene.tweens.add({
            targets: sp,
            x: px + Math.cos(a) * Phaser.Math.Between(36, 70) * (0.6 + Math.abs(dir) * 0.2),
            y: py + Math.sin(a) * Phaser.Math.Between(20, 50) - 10,
            alpha: 0, duration: 280, ease: 'Power2', onComplete: () => sp.destroy()
        });
    }
}

function finishChainStrike() {
    const target = player._chainTarget;
    const dir = player._chainDir || 1;
    if (!target || target.dead || !target.sprite || !target.sprite.body) return;
    playSlashSound();
    const hx = player.x + 54 * dir;
    const hy = player.y - 52;
    // Gold-tinted heavy cut, bigger than a normal slash.
    const atk = {
        trail: { sa: -40, ea: 55, r: 72, w: 10 },
        hb: ATTACKS[4].hb
    };
    clearSlash();
    const g = gameScene.add.graphics().setDepth(15);
    slashGfx.push(g);
    const sa = Phaser.Math.DegToRad(atk.trail.sa * dir);
    const ea = Phaser.Math.DegToRad(atk.trail.ea * dir);
    const ccw = dir < 0;
    g.lineStyle(16, 0xffaa22, 0.18); g.beginPath(); g.arc(hx, hy, atk.trail.r + 10, sa, ea, ccw); g.strokePath();
    g.lineStyle(8, 0xffe088, 0.75); g.beginPath(); g.arc(hx, hy, atk.trail.r, sa, ea, ccw); g.strokePath();
    g.lineStyle(3, 0xffffff, 1); g.beginPath(); g.arc(hx, hy, atk.trail.r - 4, sa, ea, ccw); g.strokePath();
    gameScene.tweens.add({ targets: g, alpha: 0, duration: 280, ease: 'Power2', onComplete: () => g.destroy() });
    spawnBladeParticles(gameScene, hx, hy, dir, 4);
    spawnChainBurst(player.x, player.y, dir);
    target.takeDamage(SPECIAL_DMG, dir, { fromSpecial: true });
    gameScene.cameras.main.shake(110, 0.008);
    if (gameScene.comboText) {
        gameScene.comboText.setText('ZİNCİR').setColor('#ffcc66').setAlpha(1).setScale(1.35);
        gameScene.tweens.add({ targets: gameScene.comboText, alpha: 0, duration: 550, ease: 'Power2' });
    }
}

function triggerSpecialLeap() {
    if (!player || playerDead || playerDeadFrozen || upgradeActive || storyActive || transitioning) return;
    if (specialLeapT > 0 || isParrying || isDashing) return;
    if (specialMeter < SPECIAL_COST) return;
    const target = pickSpecialTarget();
    if (!target || !target.sprite) return;
    playSpecialSound();

    specialMeter = Math.max(0, specialMeter - SPECIAL_COST);
    lastSpecialTarget = target;
    specialLeapT = SPECIAL_LEAP_MS;
    player._specialLeap = true;
    player._chainHit = false;
    player._chainGhostT = 0;
    isAttacking = false;
    player._slide = false;
    canAttack = false;
    playerHurtTimer = Math.max(playerHurtTimer, SPECIAL_LEAP_MS + 80);

    const dir = target.sprite.x >= player.x ? 1 : -1;
    facingRight = dir > 0;
    player._chainDir = dir;
    player._chainTarget = target;
    player._chainFromX = player.x;
    player._chainFromY = player.y;
    player._chainToX = Phaser.Math.Clamp(target.sprite.x - dir * 44, 40, W - 40);
    player._chainToY = target.sprite.y;

    player.body.setVelocity(0, 0);
    player.body.allowGravity = false;
    player.setFlipX(!facingRight);
    player.setAlpha(1);
    player.setTint(0xffe8a0);
    player._atkDur = SPECIAL_LEAP_MS;
    playAnim('chain');
    player.currentAnim = 'chain';
    selectRoninFrame();

    // Departure mark — a short gold pulse where he leaves.
    spawnChainBurst(player._chainFromX, player._chainFromY, dir);
    const aim = gameScene.add.graphics().setDepth(13);
    aim.lineStyle(2, 0xffe088, 0.5);
    aim.lineBetween(player._chainFromX, player._chainFromY - 44, player._chainToX, player._chainToY - 44);
    gameScene.tweens.add({ targets: aim, alpha: 0, duration: SPECIAL_WIND_MS + SPECIAL_TRAVEL_MS, onComplete: () => aim.destroy() });

    gameScene.time.delayedCall(SPECIAL_LEAP_MS + 40, () => { canAttack = true; });
    updateHUD();
}

function tickSpecialLeap(delta) {
    if (specialLeapT <= 0) return false;
    specialLeapT -= delta;
    const elapsed = SPECIAL_LEAP_MS - Math.max(0, specialLeapT);
    player.body.setVelocity(0, 0);
    player.body.allowGravity = false;
    player.setFlipX(player._chainDir < 0);

    if (elapsed < SPECIAL_WIND_MS) {
        // Wind-up: crouch in place, gold tint.
        player.setPosition(player._chainFromX, player._chainFromY);
        player.setAlpha(1);
        player.setTint(0xffe8a0);
        player.setScale(SAM_SCALE * 1.02, SAM_SCALE * 0.94);
    } else if (elapsed < SPECIAL_WIND_MS + SPECIAL_TRAVEL_MS) {
        // Travel: arc across to the foe with afterimages.
        const u = (elapsed - SPECIAL_WIND_MS) / SPECIAL_TRAVEL_MS;
        const e = u * u * (3 - 2 * u);
        const x = Phaser.Math.Linear(player._chainFromX, player._chainToX, e);
        const y = Phaser.Math.Linear(player._chainFromY, player._chainToY, e) - Math.sin(e * Math.PI) * 56;
        player.setPosition(x, y);
        player.setScale(SAM_SCALE);
        player.setAlpha(0.45 + 0.55 * Math.sin(u * Math.PI));
        player.setTint(0xfff0c0);
        player._chainGhostT -= delta;
        if (player._chainGhostT <= 0) {
            spawnChainGhost(x, y, player._chainDir);
            player._chainGhostT = 26;
        }
    } else {
        // Strike: land beside the foe and cut once.
        player.setPosition(player._chainToX, player._chainToY);
        player.setScale(SAM_SCALE);
        player.setAlpha(1);
        player.clearTint();
        if (!player._chainHit) {
            player._chainHit = true;
            finishChainStrike();
        }
        // After the cut lands, C can chain again without waiting out the full pose.
        const strikeU = (elapsed - SPECIAL_WIND_MS - SPECIAL_TRAVEL_MS) / SPECIAL_STRIKE_MS;
        if (player._chainHit && strikeU >= SPECIAL_CHAIN_CANCEL && specialMeter >= SPECIAL_COST
            && (specialBuffer > 0 || Phaser.Input.Keyboard.JustDown(keys.C) || touch.special)) {
            specialBuffer = 0;
            touch.special = false;
            specialLeapT = 0;
            player._specialLeap = false;
            player.body.allowGravity = true;
            player.setAlpha(1);
            player.clearTint();
            player.setScale(SAM_SCALE);
            triggerSpecialLeap();
            return true;
        }
    }

    if (specialLeapT <= 0) {
        player._specialLeap = false;
        player._chainTarget = null;
        player.body.allowGravity = true;
        player.setAlpha(1);
        player.clearTint();
        player.setScale(SAM_SCALE);
        if (specialMeter < SPECIAL_COST) lastSpecialTarget = null;
        playAnim('idle');
    }
    return true;
}

function drawPlayerHP() {
    const g = hpBarGfx; g.clear();
    const bx = 38, by = 14, bw = 168, bh = 14;
    const ratio = Math.max(0, playerHP / playerMaxHP);
    const fillW = Math.floor((bw - 4) * ratio);
    g.fillStyle(0x0a0a1a, 0.9); g.fillRoundedRect(bx, by, bw, bh, 7);
    g.lineStyle(1, 0x6688aa, 0.55); g.strokeRoundedRect(bx, by, bw, bh, 7);
    if (fillW > 0) {
        let fc = ratio > 0.6 ? 0x33dd66 : ratio > 0.3 ? 0xddcc33 : 0xdd3333;
        g.fillStyle(fc, 0.92); g.fillRoundedRect(bx + 2, by + 2, fillW, bh - 4, 5);
        g.lineStyle(1, 0xffffff, 0.18); g.lineBetween(bx + 6, by + 3, bx + 2 + fillW - 4, by + 3);
        if (ratio < 0.3) {
            const pulse = 0.2 + Math.sin(Date.now() * 0.006) * 0.15;
            g.lineStyle(2, 0xff2222, pulse); g.strokeRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 8);
        }
    }
    // Special meter under the life bar. Full → gold pulse, C leaps between foes.
    const sx = bx, sy = by + bh + 4, sw = bw, sh = 9;
    const sRatio = Math.max(0, specialMeter / SPECIAL_MAX);
    const sFill = Math.floor((sw - 4) * sRatio);
    g.fillStyle(0x0a0a1a, 0.9); g.fillRoundedRect(sx, sy, sw, sh, 4);
    g.lineStyle(1, specialMeter >= SPECIAL_COST ? 0xccaa55 : 0x554433, 0.75); g.strokeRoundedRect(sx, sy, sw, sh, 4);
    if (sFill > 0) {
        const canLeap = specialMeter >= SPECIAL_COST;
        const full = specialMeter >= SPECIAL_MAX;
        const col = full ? 0xffcc44 : canLeap ? 0xe0a030 : 0xc4882a;
        g.fillStyle(col, full ? 0.95 : 0.85); g.fillRoundedRect(sx + 2, sy + 2, sFill, sh - 4, 3);
        if (canLeap) {
            const pulse = 0.2 + Math.sin(Date.now() * 0.01) * 0.18;
            g.lineStyle(1.5, full ? 0xffe088 : 0xffcc66, pulse); g.strokeRoundedRect(sx - 1, sy - 1, sw + 2, sh + 2, 5);
        }
    }
    if (hpText) hpText.setText(Math.ceil(playerHP));
    // Kill count
    if (killCountText) {
        const alive = enemies.filter(e => !e.dead).length + reinforceQueue.length;
        const place = ROOMS[currentRoom] ? ROOMS[currentRoom].title : '';
        killCountText.setText(place + '   ' + alive + '/' + totalEnemiesInRoom);
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

function showSamurai(key, frame) {
    const id = key + '#' + frame;
    if (player._roninFrame === id) return;
    const switched = player.texture.key !== key;
    if (switched) player.setTexture(key, frame);
    else player.setFrame(frame);
    player.setOrigin(SAM_OX / SAM_W, SAM_OY / SAM_H);
    player.setScale(SAM_SCALE);
    if (switched && player.body) {
        player.body.setSize(10, 22);
        player.body.setOffset(SAM_OX - 5, SAM_OY - 22);
    }
    player._roninFrame = id;
}

function selectRoninFrame() {
    if (!player) return;
    if (player._hurtPose > 0 && !playerDead && !player._specialLeap) {
        showSamurai(SAMURAI.hurt.key, SAMURAI.hurt.frames[0]);
        player.clearTint();
        return;
    }
    const anim = player.currentAnim || 'idle';
    if (anim === 'chain' && player._specialLeap) {
        const elapsed = SPECIAL_LEAP_MS - Math.max(0, specialLeapT);
        if (elapsed < SPECIAL_WIND_MS) {
            showSamurai('samurai_dash', 2);
        } else if (elapsed < SPECIAL_WIND_MS + SPECIAL_TRAVEL_MS) {
            const u = (elapsed - SPECIAL_WIND_MS) / SPECIAL_TRAVEL_MS;
            const frames = SAMURAI.chain.frames;
            showSamurai('samurai_dash', frames[Math.min(frames.length - 1, Math.floor(u * frames.length))]);
        } else {
            const u = (elapsed - SPECIAL_WIND_MS - SPECIAL_TRAVEL_MS) / SPECIAL_STRIKE_MS;
            const frames = [2, 3, 4, 5, 6];
            showSamurai('samurai_atk', frames[Math.min(frames.length - 1, Math.floor(Math.max(0, u) * frames.length))]);
        }
        return;
    }
    if (anim === 'death' && player._deathT0) {
        const slotD = SAMURAI.death;
        const now = performance.now();
        const onG = player.body && (player.body.blocked.down || player.body.touching.down);
        let i;
        if (!player._startedOnGround && !onG && (now - player._deathT0) < 1000) {
            i = Math.min(3, Math.floor((now - player._deathT0) / 90));
        } else {
            if (!player._deathLand) player._deathLand = player._startedOnGround ? player._deathT0 : now;
            const t = now - player._deathLand;
            i = player._startedOnGround
                ? Math.min(slotD.frames.length - 1, Math.floor(t / 120))
                : Math.min(slotD.frames.length - 1, 3 + Math.floor(t / 130));
            if (onG && player.body) {
                player.body.setVelocity(0, 0);
                player.body.allowGravity = false;
            }
        }
        showSamurai(slotD.key, slotD.frames[i]);
        return;
    }
    const slot = SAMURAI[anim] || SAMURAI.idle;
    let frame = slot.frames[0];
    if (anim === 'idle') {
        frame = slot.frames[Math.floor(performance.now() / 360) % slot.frames.length];
    } else if (anim === 'run') {
        const cycle = Math.PI * 2;
        const phase = ((player._runPhase % cycle) + cycle) % cycle;
        frame = slot.frames[Math.floor((phase / cycle) * slot.frames.length) % slot.frames.length];
    } else if (anim === 'dash') {
        const t = 1 - Math.max(0, dashTime) / DASH_DURATION;
        frame = slot.frames[Math.min(slot.frames.length - 1, Math.floor(Math.max(0, t) * slot.frames.length))];
    } else if (slot.frames.length > 1) {
        const dur = player._atkDur || 1;
        const p = isAttacking ? Math.min(1, Math.max(0, 1 - attackTimer / dur)) : 1;
        frame = slot.frames[Math.min(slot.frames.length - 1, Math.floor(p * slot.frames.length))];
    }
    showSamurai(slot.key, frame);
}

// ============================================================
//  PLAYER DEATH
// ============================================================
let deathUI = [];
function playerDeath() {
    if (playerDead) return;
    playerDead = true; playerHP = 0; updateHUD();
    playDeathSound();
    player._deathT0 = performance.now();
    player._deathLand = 0;
    player._startedOnGround = !!(player.body.blocked.down || player.body.touching.down);
    player._slide = false;
    player.setAlpha(1).setRotation(0);
    playAnim('death');
    playerDeadFrozen = true;
    player.body.setVelocityX(0);
    if (player._startedOnGround) player.body.setVelocityY(0);

    const fl = gameScene.add.rectangle(W/2, H/2, W * 2, H * 2, 0xff0000, 0.4).setDepth(200).setScrollFactor(0);
    gameScene.tweens.add({ targets: fl, alpha: 0.1, duration: 1000 });
    deathUI.push(fl);
    const overlay = gameScene.add.rectangle(W/2, H/2, W * 2, H * 2, 0x000000, 0).setDepth(199).setScrollFactor(0);
    gameScene.tweens.add({ targets: overlay, alpha: 0.55, duration: 900, delay: 520 });
    deathUI.push(overlay);

    const dt = gameScene.add.text(W/2, H/2 - 5, 'DÜŞTÜN', {
        fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '40px', color: '#8b0000', fontStyle: 'bold',
        stroke: '#2a0000', strokeThickness: 4,
        shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 15, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0).setAlpha(0).setScale(0.7);
    gameScene.tweens.add({ targets: dt, alpha: 1, scaleX: 1.05, scaleY: 1.05, duration: 700, delay: 620, ease: 'Sine.easeInOut',
        onComplete: () => { gameScene.tweens.add({ targets: dt, alpha: 0.6, duration: 1800, yoyo: true, repeat: -1 }); }
    });
    deathUI.push(dt);
    const rt = gameScene.add.text(W/2, H/2 + 50, 'Tekrar denemek için tıkla', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#666655', fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0).setAlpha(0);
    gameScene.tweens.add({ targets: rt, alpha: 0.8, duration: 700, delay: 1100 });
    deathUI.push(rt);

    gameScene.time.delayedCall(1500, () => {
        const reviveHandler = () => {
            playerDead = false; playerDeadFrozen = false; playerHP = playerMaxHP; playerHurtTimer = PLAYER_HURT_IFRAMES; updateHUD();
            player.setAlpha(1).clearTint().setScale(RONIN_SCALE).setRotation(0);
            player._deathT0 = 0; player._deathLand = 0; player._slide = false; player._specialLeap = false;
            specialLeapT = 0; specialMeter = 0; lastSpecialTarget = null;
            const back = (ROOMS[currentRoom] && ROOMS[currentRoom].spawn) || { x: 300, y: 600 };
            player.setPosition(back.x, back.y); player.body.setVelocity(0, 0); player.currentAnim = ''; playAnim('idle');
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
    if (transitioning || upgradeActive || storyActive) return;

    tickRoomAtmosphere(gameScene, delta);
    tickHeals(delta);
    if (playerGlow) playerGlow.setPosition(player.x, player.y - 48);

    if (playerHurtTimer > 0) {
        playerHurtTimer -= delta;
        if (player._hurtPose > 0) player._hurtPose -= delta;
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

    // Latch combat presses even during hitstop / swing so links don't eat inputs.
    if (Phaser.Input.Keyboard.JustDown(keys.X) || touch.atk) {
        atkBuffer = INPUT_BUFFER_MS;
        if (dropHeld()) slideIntentT = 160;
    }
    touch.atk = false;
    if (Phaser.Input.Keyboard.JustDown(keys.SHIFT) || touch.dash) dashBuffer = INPUT_BUFFER_MS;
    touch.dash = false;
    if (Phaser.Input.Keyboard.JustDown(keys.C) || touch.special) specialBuffer = INPUT_BUFFER_MS;
    touch.special = false;
    if (Phaser.Input.Keyboard.JustDown(keys.V) || touch.parry) parryBuffer = INPUT_BUFFER_MS;
    touch.parry = false;
    if (atkBuffer > 0) atkBuffer -= delta;
    if (dashBuffer > 0) dashBuffer -= delta;
    if (specialBuffer > 0) specialBuffer -= delta;
    if (parryBuffer > 0) parryBuffer -= delta;
    if (slideIntentT > 0) slideIntentT -= delta;

    if (hitstopTimer > 0) {
        hitstopTimer -= delta;
        selectRoninFrame();
        return;
    }

    updatePartySystem();
    enemies.forEach(e => e.update(delta));
    if (playerDead) {
        touch.jump = false; touch.atk = false; touch.dash = false; touch.parry = false; touch.special = false;
        return;
    }
    if (enemyDropCooldown > 0) enemyDropCooldown -= delta;
    updateProjectiles(delta);
    updateParry(delta);
    if (comboTimer > 0) { comboTimer -= delta; if (comboTimer <= 0) resetCombo(); }

    // Portal check — walk into portal to transition
    if (portalActive && portalZone && !transitioning) {
        const room = ROOMS[currentRoom];
        if (room && room.next && Math.abs(player.x - portalZone.x) < portalZone.w && Math.abs(player.y - portalZone.y) < portalZone.h) {
            if (currentRoom === 'courtyard' && upgradesPicked === 0) {
                if (!upgradeActive) showUpgradeSelection();
                return;
            }
            transitionToRoom(room.next);
            return;
        }
    }

    // C can cut into a leap even mid-swing once the meter has enough charge.
    if (specialBuffer > 0) {
        const before = specialLeapT;
        triggerSpecialLeap();
        if (specialLeapT > before || player._specialLeap) specialBuffer = 0;
    }
    if (tickSpecialLeap(delta)) {
        selectRoninFrame();
        // showSamurai resets scale — reapply the wind-up squash after the frame pick.
        const elapsed = SPECIAL_LEAP_MS - Math.max(0, specialLeapT);
        if (player._specialLeap && elapsed < SPECIAL_WIND_MS) {
            player.setScale(SAM_SCALE * 1.06, SAM_SCALE * 0.9);
        }
        return;
    }

    if (isAttacking) {
        attackTimer -= delta;
        if (player._slide) tickSlide(delta);
        // Late active frames for standing/air cuts — catch foes that walked in mid-swing.
        if (!player._slide && !player._atkConnected && player._atkDur > 0) {
            const p = 1 - attackTimer / player._atkDur;
            if (p >= 0.28 && p <= 0.62) {
                const dir = facingRight ? 1 : -1;
                const atk = player._atkRef;
                if (atk) {
                    const hx = player.x + atk.hb.ox * dir, hy = player.y + atk.hb.oy;
                    enemies.forEach(e => {
                        if (e.dead || e.hurtTimer > 90) return;
                        const hitRange = e.config && e.config.boss ? atk.hb.w + 30 : atk.hb.w;
                        const hitH = e.config && e.config.boss ? atk.hb.h + 36 : atk.hb.h + 20;
                        if (Math.abs(e.sprite.x - hx) < hitRange && Math.abs(e.sprite.y - hy) < hitH) {
                            if (e.canTakeDamage(dir)) {
                                e.takeDamage(atk.dmg, dir);
                                player._atkConnected = true;
                                hitstopTimer = Math.floor(HITSTOP_MS * 0.7);
                            }
                        }
                    });
                }
            }
        }
        if (attackTimer <= 0) {
            isAttacking = false; player._slide = false; player._atkRef = null; canAttack = true; clearSlash();
        } else return;
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

    if (dashBuffer > 0 && canDash && !isDashing) { dashBuffer = 0; startDash(gameScene); }
    if (atkBuffer > 0) {
        const before = isAttacking;
        triggerAttack(isMoving, onGround);
        if (isAttacking && !before) atkBuffer = 0;
    }
    if (parryBuffer > 0 && !isParrying) { parryBuffer = 0; triggerParry(); }
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
//  Moving + X: DASH CUT | Down + X: KAYMA (low) | Air + X: AIR SLASH
// ============================================================
function triggerAttack(isMoving, onGround) {
    if (!canAttack || isDashing || isParrying || playerHP <= 0 || playerDead || upgradeActive || player._specialLeap) return;
    isAttacking = true; canAttack = false;

    const dir = facingRight ? 1 : -1;
    let atk, animName;
    const speedMul = 1 + comboSpeedBonus * 0.12;

    player._slide = false;
    player._atkConnected = false;
    if (!onGround) {
        atk = AIR_ATTACK;
        animName = atk.pose;
        comboStep = 0; comboTimer = 0;
    } else if (dropHeld() || slideIntentT > 0) {
        // Low cut only while Down/S is held (or just pressed with X).
        atk = SLIDE_ATTACK;
        animName = atk.pose;
        comboStep = 0; comboTimer = 0;
        player._slide = true;
        player._slideHits = [];
        player._slideDust = 0;
        slideIntentT = 0;
        player._dropPlat = null;
        player.body.setVelocityY(Math.max(0, player.body.velocity.y));
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
    const dur = Math.max(90, Math.round(atk.dur / speedMul));
    attackTimer = dur;
    player._atkDur = dur;
    player._atkRef = atk;
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
    if (player._slide) {
        hitSomething = slideStrike();
    } else {
        enemies.forEach(e => {
            if (e.dead || e.hurtTimer > 90) return;
            const hitRange = e.config && e.config.boss ? atk.hb.w + 30 : atk.hb.w;
            const hitH = e.config && e.config.boss ? atk.hb.h + 36 : atk.hb.h + 20;
            if (Math.abs(e.sprite.x - hx) < hitRange && Math.abs(e.sprite.y - hy) < hitH) {
                if (e.canTakeDamage(dir)) { e.takeDamage(atk.dmg, dir); hitSomething = true; }
            }
        });
    }
    player._atkConnected = hitSomething;

    // Hitstop only on contact — whiffs stay snappy.
    if (hitSomething) hitstopTimer = HITSTOP_MS;
    gameScene.cameras.main.shake(hitSomething ? 100 : 40, hitSomething ? atk.shake : atk.shake * 0.4);

    // Show combo name
    const colors = ['#ccddff', '#aabbff', '#ff8899', '#ffaa44', '#ff3322'];
    const colorIdx = (!onGround) ? 2 : (player._slide ? 4 : (isMoving ? 3 : Math.min(comboStep - 1, 4)));
    gameScene.comboText.setText(atk.name).setColor(colors[colorIdx]).setAlpha(1).setScale(comboStep >= 4 ? 1.5 : 1.1);
    gameScene.tweens.add({ targets: gameScene.comboText, alpha: 0, duration: 700, ease: 'Power2' });

    if (comboStep >= 5) gameScene.time.delayedCall(dur + 50, () => resetCombo());
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
    spawnVfxBurst(step >= 3 ? 'vfx_spark' : 'vfx_slash', x, y, dir);
    const count = step >= 3 ? 12 : 6;
    for (let i=0;i<count;i++) { const px=x+Phaser.Math.Between(-12,12),py=y+Phaser.Math.Between(-18,18); const c=Math.random()<0.4?0xffffff:(Math.random()<0.5?0xff3322:0xff6644); const s=Phaser.Math.Between(1,4); const p=scene.add.rectangle(px,py,s,s,c,0.8).setDepth(16); scene.tweens.add({targets:p,x:px+dir*Phaser.Math.Between(15,60),y:py+Phaser.Math.Between(-25,20),alpha:0,scaleX:0,scaleY:0,duration:Phaser.Math.Between(120,350),ease:'Power2',onComplete:()=>p.destroy()}); }
}

function tickSlide(delta) {
    const dir = facingRight ? 1 : -1;
    const u = Math.max(0, attackTimer / (player._atkDur || 1));
    player.body.setVelocityX(dir * (210 + 450 * u));
    if (player.body.velocity.y < 0) player.body.setVelocityY(0);
    player._slideDust -= delta;
    if (player._slideDust <= 0) {
        spawnFootDust(gameScene, player.x, player.y);
        player._slideDust = 45;
    }
    if (slideStrike()) {
        hitstopTimer = HITSTOP_MS;
        gameScene.cameras.main.shake(80, 0.004);
    }
}

function slideStrike() {
    const dir = facingRight ? 1 : -1;
    const hx = player.x + dir * 46;
    let hit = false;
    if (!player._slideHits) player._slideHits = [];
    enemies.forEach(e => {
        if (e.dead || e.hurtTimer > 90 || player._slideHits.indexOf(e) !== -1) return;
        if (Math.abs(e.sprite.x - hx) < 60 && Math.abs(e.sprite.y - player.y) < 46) {
            if (e.canTakeDamage(dir)) {
                e.takeDamage(SLIDE_ATTACK.dmg, dir);
                player._slideHits.push(e);
                hit = true;
            }
        }
    });
    return hit;
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
    spawnVfxBurst('vfx_dash', player.x - (facingRight ? 1 : -1) * 18, player.y - 8, facingRight ? 1 : -1);
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
        const g = scene.add.sprite(player.x, player.y, player.texture.key, frame)
            .setOrigin(player.originX, player.originY)
            .setScale(sc).setFlipX(player.flipX).setDepth(depth).setTint(tint).setAlpha(alpha);
        scene.tweens.add({
            targets: g, alpha: 0, duration: dur, ease: 'Power2',
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
    playParrySound();
    spawnVfxBurst('vfx_spark', player.x, player.y - 30, facingRight ? 1 : -1);
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
function dropHeld() {
    return (cursors && cursors.down && cursors.down.isDown) || (keys && keys.S && keys.S.isDown);
}

function roomThinned() {
    if (!totalEnemiesInRoom) return false;
    const left = enemies.filter(e => !e.dead).length + reinforceQueue.length;
    // After the opening rush: a few bodies left, or under ~half the roster.
    return left <= 4 || left <= Math.floor(totalEnemiesInRoom * 0.55);
}

function oneWay(obj, plat) {
    if (!obj.body || !plat.body) return false;
    const ledge = plat.getData && plat.getData('ledge');
    if (ledge && obj === player) {
        // Hold down to keep falling through ledges. A tap still clears the one underfoot.
        // Down+X is the low slide — slideIntent covers the frame before _slide latches.
        if (dropHeld() && !player._slide && !(slideIntentT > 0) && obj.body.bottom <= plat.body.bottom + 4) {
            player._dropPlat = plat;
            if (obj.body.velocity.y < 80) obj.body.setVelocityY(220);
            return false;
        }
        if (player._dropPlat === plat) {
            if (obj.body.top > plat.body.bottom + 6) player._dropPlat = null;
            else return false;
        }
    } else if (ledge) {
        const foe = enemies.find(e => e.sprite === obj);
        if (foe && foe.dropping && obj.body.bottom <= plat.body.bottom + 4) {
            foe._dropPlat = plat;
            if (obj.body.velocity.y < 80) obj.body.setVelocityY(220);
            return false;
        }
        if (foe && foe._dropPlat === plat) {
            if (obj.body.top > plat.body.bottom + 6) foe._dropPlat = null;
            else return false;
        }
    }
    const prevBottom = obj.body.bottom - obj.body.deltaY();
    return obj.body.velocity.y >= 0 && prevBottom <= plat.body.top + 8;
}

function onLand(p){if(p.body.blocked.down||p.body.touching.down)jumpCount=0;}
