// Curio Digital · Press The Button — vanilla-host build, perf v4
// Adds: bigger-button scaling, worker emoji animations, plus all v3 perf wins.

const {useState, useEffect, useCallback, useRef} = React;

// =====================================================================
// EMBEDDED DETECTION
// =====================================================================
const IS_EMBEDDED = (() => {
    try { return window.top !== window.self; }
    catch { return true; }
})();
const PRESS_THROTTLE_MS = IS_EMBEDDED ? 55 : 35;
const FX_SCALE          = IS_EMBEDDED ? 0.5 : 1;
const RUNAWAY_ENABLED   = !IS_EMBEDDED;

// =====================================================================
// AUDIO
// =====================================================================
const AUDIO = {ctx: null, masterGain: null, music: null};
const VOICE_CAPS = {click: 3, airhorn: 1, purchase: 2};
const liveVoices = {click: 0, airhorn: 0, purchase: 0};

function getCtx() {
    if (!AUDIO.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        AUDIO.ctx = new Ctor();
        AUDIO.masterGain = AUDIO.ctx.createGain();
        AUDIO.masterGain.gain.value = 0.18;
        AUDIO.masterGain.connect(AUDIO.ctx.destination);
    }
    if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume();
    return AUDIO.ctx;
}
function playClick() {
    if (liveVoices.click >= VOICE_CAPS.click) return;
    const ctx = getCtx(); if (!ctx) return;
    liveVoices.click++;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(AUDIO.masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.13);
    setTimeout(() => liveVoices.click--, 130);
}
function playAirhorn() {
    if (liveVoices.airhorn >= VOICE_CAPS.airhorn) return;
    const ctx = getCtx(); if (!ctx) return;
    liveVoices.airhorn++;
    const t = ctx.currentTime;
    [0, 0.08].forEach((delay) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t + delay);
        osc.frequency.linearRampToValueAtTime(120, t + delay + 0.18);
        gain.gain.setValueAtTime(0.0001, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.5, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.22);
        osc.connect(gain).connect(AUDIO.masterGain);
        osc.start(t + delay); osc.stop(t + delay + 0.24);
    });
    setTimeout(() => liveVoices.airhorn--, 320);
}
function playPurchase() {
    if (liveVoices.purchase >= VOICE_CAPS.purchase) return;
    const ctx = getCtx(); if (!ctx) return;
    liveVoices.purchase++;
    const t = ctx.currentTime;
    [988, 1318, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        gain.gain.setValueAtTime(0.0001, t + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.4, t + i * 0.06 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.12);
        osc.connect(gain).connect(AUDIO.masterGain);
        osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.13);
    });
    setTimeout(() => liveVoices.purchase--, 260);
}

const MUSIC_URL = './music.mp3';
function startMusic() {
    if (AUDIO.music) return; // already running — never start a second one
    getCtx();
    const audio = new Audio(MUSIC_URL);
    audio.preload = 'auto';
    audio.volume = 0.55;
    audio.loop = true; // file is pre-trimmed; let the element loop natively
    // `aborted` — lets stopMusic short-circuit the canplay handler if the user
    //   toggles music off before the initial play() resolves.
    let aborted = false;
    let started = false;
    audio.addEventListener('canplay', () => {
        if (aborted || started) return;
        started = true;
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
    });
    AUDIO.music = audio;
    AUDIO.musicAbort = () => { aborted = true; };
}
function stopMusic() {
    if (AUDIO.musicAbort) { AUDIO.musicAbort(); AUDIO.musicAbort = null; }
    if (AUDIO.music) {
        try {
            AUDIO.music.pause();
            // Force full unload so a pending play() promise can't bring it back
            AUDIO.music.removeAttribute('src');
            AUDIO.music.load();
        } catch {}
        AUDIO.music = null;
    }
}

// =====================================================================
// DATA
// =====================================================================
const UPGRADES = [
    {key:'bigger',  emoji:'🔘', name:'Bigger button',     desc:'+1 click per press · button grows', base:10,      mult:1.5, effect:'perClick',     amount:1},
    {key:'multi',   emoji:'✖️', name:'Multi-press combo',  desc:'×2 click power',     base:250,     mult:4,   effect:'perClickMult', amount:2},
    {key:'intern',  emoji:'👨‍💼', name:'Hire intern',         desc:'+1 click / sec · adds an intern',      base:50,      mult:1.5, effect:'perSecond',    amount:1},
    {key:'designer',emoji:'🎨', name:'Hire designer',       desc:'+5 clicks / sec · adds a designer',     base:300,     mult:1.6, effect:'perSecond',    amount:5},
    {key:'engineer',emoji:'👷', name:'Hire engineer',       desc:'+25 clicks / sec · adds an engineer',    base:2000,    mult:1.7, effect:'perSecond',    amount:25},
    {key:'ai',      emoji:'🤖', name:'AI button bot',       desc:'+100 clicks / sec · adds an AI bot',      base:12000,   mult:1.8, effect:'perSecond',    amount:100},
    {key:'quantum', emoji:'⚛️', name:'Quantum hyper-press', desc:'+500 clicks / sec · adds a particle',    base:100000,  mult:1.9, effect:'perSecond',    amount:500},
    {key:'curio',   emoji:'🪐', name:'Curio Digital boost', desc:'×10 click power · adds a planet',        base:1000000, mult:10,  effect:'perClickMult', amount:10},
];
const NEWS = [
    // ===== Curio-on-brand bangers =====
    'Curio just shipped another B2B SaaS site 🚀',
    'Webflow Enterprise badge: still earned 🏅',
    'Conversion rate up only 📈',
    'Series B closed thanks to one (1) button press 💸',
    'Designer says "the grid spoke to me" 🎨',
    'Motion design budget: maxed 🎬',
    'New Clutch review just dropped — 5 stars (again) ⭐⭐⭐⭐⭐',
    "Pixel-perfect doesn't begin to cover it",
    'CMS migration completed in record time ⚡️',
    'Strategy call ended early because we already nailed it 📞',
    'A/B test winner: option C 🤷',
    'Brand guidelines updated. Designers wept (with joy) 📐',
    'Conversion rate optimization: deployed 🎯',
    'Hourly support tickets: cleared in 23 seconds 💨',
    'Founder asked for "more pop". We delivered. 💥',
    "Site loaded in 0.6s. Lighthouse is jealous. 🔦",
    '$30M raised by clients pressing this exact button 💰',
    'Roadmap meeting cancelled — we already shipped it 🚢',
    'Webflow CMS: tamed 🧙',
    'Discovery call → proposal → kickoff in one afternoon ⏱️',
    'Your buyers are converting. You\'re welcome. 🤝',
    'Slack channel renamed to #shipping-only 📦',
    // ===== MLG / meme classics =====
    'BREAKING: Button presser elected mayor 👑',
    'Stocks surge on fresh button data 📈',
    'Local hero presses button again 🦸',
    'Coffee budget restored ☕️',
    'AI begs for a coffee break 🤖',
    'Server thanks you for your service 🫡',
    '360 NOSCOPE TRIPLE KILL 🎯💀',
    'GG EZ NO RE 😎',
    'MOM GET THE CAMERA 📸',
    'WOMBO COMBO! 🤘💯',
    'MOUNTAIN DEW SHORTAGE INCOMING 🥤',
    'DORITOS SUPPLY CHAIN: SECURE 🔺',
    'INTERNET POINTS: ALL OF THEM 🏆',
    'AIRHORN ARMY: DEPLOYED 📯',
];
const MLG_EMOJIS = ['🤘','💯','🔥','💥','💀','😎','🎯','🚨','💸','🍔','🌮','🍕','🎮','👹','😤','🥵','🤡','🔺','🥤','📯','💎','⚡️','🎉','✨','🤯','😈','🦅','🐍','🦖','👽','🛸','🪩','🍩','🌈','🍾','🦄','🤺','🥷','🐉'];
const HYPE_TEXTS = [
    // MLG classics
    'WOW!','GET REKT','NOSCOPE','MLG PRO','360 QUICKSCOPE','HEADSHOT','TRIPLE KILL','SAVAGE','BIG BRAIN','GG EZ','POG','POGGERS','LET’S GO','INSANE','COMBO!','WOMBO!','GOATED','CRACKED','TURBO','FLAWLESS','ABSOLUTE UNIT','NICE!','HYPE','CLUTCH','STONKS','MEGA','ULTRA','GIGA','YEET','KAPOW',
    // Curio brand
    'BOOK A CALL!','SHIP IT!','CONVERT!','ON BRAND!','CLUTCH UX!','PIXEL PERFECT!','5.0 CLUTCH!','SHIPPED!','RAISED $30M!','BIG W!','WEBFLOW!','SCALE UP!','GROWTH MODE!','CRO LEGEND!','UI ICON!',
];
const HYPE_COLORS = ['#FFBA05','#FF8DBC','#5B3BF4','#39CAFF','#FF6080','#FFFFFF','#A66FD5'];
const PARTICLE_COLORS = ['#5B3BF4','#FF8DBC','#A66FD5','#FFBA05','#39CAFF'];

// Workers — emoji + caps. Each owned upgrade spawns one persistent worker.
const WORKER_EMOJIS = {
    intern:   '👨‍💼',
    designer: '🎨',
    engineer: '👷',
    ai:       '🤖',
    quantum:  '⚛️',
    curio:    '🪐',
};
const WORKER_CAPS = IS_EMBEDDED
    ? {intern: 8,  designer: 6,  engineer: 4, ai: 3, quantum: 2, curio: 2}
    : {intern: 18, designer: 12, engineer: 8, ai: 5, quantum: 4, curio: 3};

const STAGES_INTRO = [
    {warn:'DO NOT PRESS', sub:"Seriously, don't."},
    {warn:'I said do not press.', sub:"You really shouldn't have."},
    {warn:'Final warning.', sub:'The button is becoming uneasy.'},
    {warn:'STOP.', sub:'Fine. Have it your way.'},
    {warn:'You absolute menace.', sub:'There are consequences.'},
    {warn:'Detected: 1 button presser.', sub:'Logging incident…'},
    {warn:'WARNING: Productivity at risk.', sub:'Your manager has been notified.'},
    {warn:'Curio support is on the line.', sub:'They are extremely disappointed.'},
    {warn:'Beginning self-destruct.', sub:'10… 9… 8…'},
    {warn:'Just kidding.', sub:'Now hire some interns.'},
];
const STAGES_BANK = [
    {warn:'Stonks 📈', sub:'Up 5,000% pre-market'},{warn:'Press X to doubt', sub:'X'},
    {warn:'GG EZ NO RE', sub:'Imagine being a button'},{warn:'NOSCOPE 360', sub:'Headshot confirmed'},
    {warn:'WOMBO COMBO', sub:'Off the top rope'},{warn:'POG', sub:'Champ'},
    {warn:'POGGERS', sub:'Absolutely cracked'},{warn:'Big brain time', sub:'Galaxy thoughts incoming'},
    {warn:'This is fine 🔥', sub:'Everything is on fire'},{warn:'AMOGUS', sub:'sus'},
    {warn:'The floor is lava', sub:"Don't touch the floor"},{warn:'Bonk', sub:'Go to horny jail'},
    {warn:'To the moon 🚀', sub:'Diamond hands'},{warn:'Skill issue', sub:'Git gud'},
    {warn:'Touch grass', sub:'The outside is calling'},{warn:'Mountain Dew acquired', sub:'Doritos pending delivery'},
    {warn:'Cope harder', sub:'Seethe'},{warn:'Mid', sub:'Peak fiction'},
    {warn:'Goated with the sauce', sub:'Drip dispensed'},{warn:'No cap', sub:'Fr fr ong'},
    {warn:'Bussin', sub:'🔥 emoji deployed'},{warn:'Slay', sub:'Werk'},
    {warn:'Yeet', sub:'Yote'},{warn:'F in the chat', sub:'rip'},
    {warn:'RIP bozo', sub:'L + ratio'},{warn:'Speedrun in progress', sub:'Any% glitchless'},
    {warn:'Sigma grindset', sub:'Alpha press'},{warn:'Sus', sub:'Ejected'},
    {warn:'Webflow approves', sub:'Squarespace seethes'},{warn:'Haha button go brrr', sub:'Money printer go brrr'},
    {warn:'1000 IQ play', sub:'Or 0 IQ — coin flip'},{warn:'Galaxy brain detected', sub:'Multiverse opened'},
    {warn:'NPC behavior', sub:'Side quest: press the button'},{warn:'Real ones know', sub:'Pressers recognize pressers'},
    {warn:'CEO of pressing', sub:'Ex-CEO as of just now'},{warn:'They should study you', sub:'In museums'},
    {warn:"Got 'em", sub:'Pranked'},{warn:'Gigachad press', sub:'Beta button has fled the chat'},
    {warn:'POV: you press', sub:'FPV: total chaos'},{warn:'Caught in 4K', sub:'Receipts have been gathered'},
    {warn:'Vibes only', sub:'No thoughts, head empty'},{warn:'Drip', sub:'Soaked'},
    {warn:'Slept on', sub:'Rude awakening'},{warn:'Lowkey iconic', sub:'Highkey iconic too'},
    {warn:'Rent free', sub:'Living in your head'},{warn:'Tried not to press', sub:'Cried instead'},
    {warn:'Glow up', sub:'Or glow down — your call'},{warn:"It's giving", sub:'Button energy'},
    {warn:'Built different', sub:'Press different'},{warn:'Skibidi press', sub:'Toilet sold separately'},
    {warn:'Final form', sub:'Press evolved'},{warn:'Achievement unlocked', sub:'[Pressed the button]'},
    {warn:'World record speed', sub:'1 press per nanosecond'},{warn:'Productivity −∞', sub:'Joy +∞'},
    {warn:'Stack overflow', sub:'Of clicks'},{warn:'404: Productivity not found', sub:'Reload not recommended'},
    {warn:'Ship it', sub:'No tests, no problems'},{warn:'Vibe shift detected', sub:'New vibe: pressing'},
    {warn:'Curio Digital approves', sub:'But quietly'},{warn:'Cmd+Z does not work here', sub:'There is no going back'},
    // ===== Curio brand-themed stages =====
    {warn:'Book an intro call', sub:"Your future site is calling"},
    {warn:'Webflow site shipped', sub:'#101 in the count'},
    {warn:'CRO consultant unlocked', sub:'Conversion rate go brrr'},
    {warn:'B2B SaaS detected', sub:'Pipeline filling up'},
    {warn:'Series B confirmed', sub:'Investors love a good button'},
    {warn:'Designer is "in the zone"', sub:'Do not disturb (or do — we ship fast)'},
    {warn:'5.0 on Clutch', sub:'Naturally'},
    {warn:'Pixel-perfect handoff', sub:"Don't tell QA — there's nothing left to find"},
    {warn:'Lighthouse score: 100', sub:'In every category. Yes, even SEO.'},
    {warn:'Conversion lifted', sub:'Up and to the right'},
    {warn:'Strategy call: 30 minutes', sub:'Action items: 47'},
    {warn:'Webflow Enterprise Partner', sub:"That's an Enterprise-level press"},
    {warn:'Discovery call ended early', sub:'We already get it'},
    {warn:'Brand system: bulletproof', sub:'Tested at 9am Monday'},
    {warn:'Motion design just dropped', sub:'Frame-by-frame fire 🔥'},
    {warn:'Site shipped Friday at 4:59pm', sub:'On purpose. Iconic.'},
    {warn:'CMS configured', sub:'Marketers can sleep tonight'},
    {warn:'Hourly retainer engaged', sub:'You break it, we already fixed it'},
    {warn:'Hero section: heroic', sub:'Subheadline: also heroic'},
    {warn:'Founder said "make it pop"', sub:'It pops'},
    {warn:'Roadmap unblocked', sub:'Two sprints ahead of schedule'},
    {warn:'CTAs converting at 12%', sub:'You did this with a button'},
    {warn:'A/B test concluded', sub:'Variant B wins by a landslide'},
    {warn:'Webflow CMS in 4D', sub:"Don't ask"},
    {warn:'Founder onboarded', sub:'Smiling. Possibly weeping.'},
    {warn:'Pricing page rewrite shipped', sub:'Average plan +$200/mo'},
    {warn:'Design system tokens: pristine', sub:"Tailwind would be proud"},
    {warn:'Curio is hiring', sub:'(They are not — they ship faster than they hire)'},
    {warn:'Press kit assembled', sub:'TechCrunch loves it already'},
    {warn:'Quarterly review prep done', sub:'In 11 minutes flat'},
];
function fmtNum(n) {
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1e6) return (n / 1000).toFixed(1) + 'K';
    if (n < 1e9) return (n / 1e6).toFixed(2) + 'M';
    if (n < 1e12) return (n / 1e9).toFixed(2) + 'B';
    return (n / 1e12).toFixed(2) + 'T';
}

// =====================================================================
// DOM POOL — for click bursts
// =====================================================================
const POOL_SIZES = {
    confetti: IS_EMBEDDED ? 24 : 50,
    emoji:    IS_EMBEDDED ? 18 : 36,
    hype:     IS_EMBEDDED ? 4  : 8,
};
const pools = {confetti: [], emoji: [], hype: []};
let poolsInited = false;
function initPools(host) {
    if (poolsInited || !host) return;
    poolsInited = true;
    for (let i = 0; i < POOL_SIZES.confetti; i++) {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;top:50%;left:50%;width:10px;height:10px;border-radius:50%;pointer-events:none;will-change:transform,opacity;opacity:0';
        el._busy = false; host.appendChild(el); pools.confetti.push(el);
    }
    for (let i = 0; i < POOL_SIZES.emoji; i++) {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;top:50%;left:50%;line-height:1;pointer-events:none;user-select:none;will-change:transform,opacity;opacity:0';
        el._busy = false; host.appendChild(el); pools.emoji.push(el);
    }
    for (let i = 0; i < POOL_SIZES.hype; i++) {
        const el = document.createElement('div');
        el.style.cssText = "position:absolute;top:40%;left:50%;font-size:clamp(28px,5vw,56px);font-weight:900;font-style:italic;text-shadow:3px 3px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000;letter-spacing:0.04em;pointer-events:none;user-select:none;font-family:Impact,'Arial Black',sans-serif;white-space:nowrap;will-change:transform,opacity;opacity:0";
        el._busy = false; host.appendChild(el); pools.hype.push(el);
    }
}
function leaseFromPool(kind) {
    const pool = pools[kind];
    for (let i = 0; i < pool.length; i++) {
        if (!pool[i]._busy) return pool[i];
    }
    return null;
}
function restartAnim(el, value) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = value;
}
function spawnConfetti(count) {
    for (let i = 0; i < count; i++) {
        const el = leaseFromPool('confetti'); if (!el) return;
        el._busy = true;
        const a = (i / count) * 360 + Math.random() * 30;
        const d = 80 + Math.random() * 200;
        el.style.background = PARTICLE_COLORS[i % 5];
        el.style.setProperty('--fx', `${Math.cos((a * Math.PI) / 180) * d}px`);
        el.style.setProperty('--fy', `${Math.sin((a * Math.PI) / 180) * d}px`);
        restartAnim(el, 'pb-confetti-fly 1.2s cubic-bezier(0.2,0.8,0.2,1) forwards');
        setTimeout(() => { el._busy = false; }, 1300);
    }
}
function spawnEmojis(count) {
    for (let i = 0; i < count; i++) {
        const el = leaseFromPool('emoji'); if (!el) return;
        el._busy = true;
        const a = Math.random() * 360;
        const d = 120 + Math.random() * 300;
        el.textContent = MLG_EMOJIS[(Math.random() * MLG_EMOJIS.length) | 0];
        el.style.fontSize = `${22 + Math.random() * 28}px`;
        el.style.setProperty('--fx', `${Math.cos((a * Math.PI) / 180) * d}px`);
        el.style.setProperty('--fy', `${Math.sin((a * Math.PI) / 180) * d}px`);
        el.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
        restartAnim(el, 'pb-emoji-fly 1.4s cubic-bezier(0.2,0.8,0.2,1) forwards');
        setTimeout(() => { el._busy = false; }, 1500);
    }
}
function spawnHype(count) {
    for (let i = 0; i < count; i++) {
        const el = leaseFromPool('hype'); if (!el) return;
        el._busy = true;
        el.textContent = HYPE_TEXTS[(Math.random() * HYPE_TEXTS.length) | 0];
        el.style.color = HYPE_COLORS[(Math.random() * HYPE_COLORS.length) | 0];
        el.style.setProperty('--hx', `${(Math.random() - 0.5) * 280}px`);
        el.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
        restartAnim(el, 'pb-hype 1.6s cubic-bezier(0.2,0.8,0.2,1) forwards');
        setTimeout(() => { el._busy = false; }, 1700);
    }
}

// =====================================================================
// WORKERS — persistent emoji wanderers per owned upgrade
// =====================================================================
function spawnWorker(host, emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    const size = 22 + Math.random() * 16;
    el.style.cssText = `position:absolute;font-size:${size}px;line-height:1;pointer-events:none;user-select:none;will-change:transform;z-index:0;text-shadow:0 1px 6px rgba(0,0,0,0.4);filter:drop-shadow(0 2px 4px rgba(91,59,244,0.3))`;
    // Random initial position within viewport
    el.style.left = `${5 + Math.random() * 90}%`;
    el.style.top  = `${15 + Math.random() * 75}%`;
    host.appendChild(el);

    // Build a unique 4-keyframe wandering path
    const dx1 = (Math.random() - 0.5) * 500;
    const dy1 = (Math.random() - 0.5) * 320;
    const dx2 = (Math.random() - 0.5) * 500;
    const dy2 = (Math.random() - 0.5) * 320;
    const dx3 = (Math.random() - 0.5) * 500;
    const dy3 = (Math.random() - 0.5) * 320;
    const r1 = (Math.random() - 0.5) * 30;
    const r2 = (Math.random() - 0.5) * 30;
    const dur = 9000 + Math.random() * 14000;
    if (el.animate) {
        el.animate(
            [
                {transform: 'translate(0, 0) rotate(0deg)'},
                {transform: `translate(${dx1}px, ${dy1}px) rotate(${r1}deg)`, offset: 0.33},
                {transform: `translate(${dx2}px, ${dy2}px) rotate(${r2}deg)`, offset: 0.66},
                {transform: `translate(${dx3}px, ${dy3}px) rotate(0deg)`},
            ],
            {duration: dur, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out'},
        );
    }
    // Subtle bobbing for visual life
    if (el.animate) {
        el.animate(
            [
                {textShadow: '0 1px 6px rgba(0,0,0,0.4)'},
                {textShadow: '0 1px 14px rgba(255, 141, 188, 0.5)'},
                {textShadow: '0 1px 6px rgba(0,0,0,0.4)'},
            ],
            {duration: 3000 + Math.random() * 2000, iterations: Infinity, easing: 'ease-in-out'},
        );
    }
    return el;
}

// =====================================================================
// APP
// =====================================================================
function App() {
    const [count, setCount] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [presses, setPresses] = useState(0);
    const [owned, setOwned] = useState({});
    const [musicOn, setMusicOn] = useState(false);
    const [sfxOn, setSfxOn] = useState(true);
    const [news, setNews] = useState(null);
    const rootRef = useRef(null);
    const fxLayerRef = useRef(null);
    const workerLayerRef = useRef(null);
    const workersRef = useRef({intern:[], designer:[], engineer:[], ai:[], quantum:[], curio:[]});
    const lastPressRef = useRef(0);
    const bgFlashTimerRef = useRef(null);

    useEffect(() => {
        if (fxLayerRef.current) initPools(fxLayerRef.current);
    }, []);

    // Worker sync — when owned changes, ensure correct worker count per type
    useEffect(() => {
        const host = workerLayerRef.current;
        if (!host) return;
        for (const key of Object.keys(WORKER_EMOJIS)) {
            const cap = WORKER_CAPS[key];
            const target = Math.min(cap, owned[key] || 0);
            const arr = workersRef.current[key];
            while (arr.length < target) {
                arr.push(spawnWorker(host, WORKER_EMOJIS[key]));
            }
            while (arr.length > target) {
                const el = arr.pop();
                if (el) {
                    // Explicitly cancel infinite animations so they don't leak
                    if (el.getAnimations) {
                        try { el.getAnimations().forEach((a) => a.cancel()); } catch {}
                    }
                    if (el.parentNode) el.parentNode.removeChild(el);
                }
            }
        }
    }, [owned]);

    const stats = (() => {
        let perClick = 1, perClickMult = 1, perSecond = 0;
        for (const u of UPGRADES) {
            const n = owned[u.key] || 0;
            if (!n) continue;
            if (u.effect === 'perClick') perClick += u.amount * n;
            if (u.effect === 'perClickMult') perClickMult *= Math.pow(u.amount, n);
            if (u.effect === 'perSecond') perSecond += u.amount * n;
        }
        return {perClick: perClick * perClickMult, perSecond};
    })();

    // Bigger button — width grows by 12px per Bigger upgrade, capped
    const bigCount = owned.bigger || 0;
    const buttonSize = Math.min(IS_EMBEDDED ? 320 : 380, 240 + bigCount * 12);
    const buttonSvgSize = Math.round(buttonSize * 130 / 240);

    const [stage, setStage] = useState(STAGES_INTRO[0]);
    useEffect(() => {
        if (presses === 0) setStage(STAGES_INTRO[0]);
        else if (presses < STAGES_INTRO.length) setStage(STAGES_INTRO[presses]);
        else setStage(STAGES_BANK[(Math.random() * STAGES_BANK.length) | 0]);
    }, [presses]);

    // Auto-tick at 5Hz (was 10Hz) — half the React renders, same total income.
    // Pauses while the tab is hidden to free up CPU.
    const [tabVisible, setTabVisible] = useState(typeof document !== 'undefined' ? !document.hidden : true);
    useEffect(() => {
        const onVis = () => setTabVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);
    useEffect(() => {
        if (stats.perSecond <= 0 || !tabVisible) return;
        const id = setInterval(() => {
            const inc = stats.perSecond / 5;
            setCount((c) => c + inc);
            setTotalEarned((t) => t + inc);
        }, 200);
        return () => clearInterval(id);
    }, [stats.perSecond, tabVisible]);

    useEffect(() => {
        if (totalEarned <= 0) return;
        const id = setInterval(() => {
            setNews(NEWS[(Math.random() * NEWS.length) | 0]);
            setTimeout(() => setNews(null), 4000);
        }, 12000);
        return () => clearInterval(id);
    }, [totalEarned > 0]);

    useEffect(() => { if (musicOn) startMusic(); else stopMusic(); }, [musicOn]);
    useEffect(() => () => stopMusic(), []);

    const press = useCallback(() => {
        const now = performance.now();
        if (now - lastPressRef.current < PRESS_THROTTLE_MS) return;
        const dt = now - lastPressRef.current;
        lastPressRef.current = now;

        const earned = stats.perClick;
        setCount((c) => c + earned);
        setTotalEarned((t) => t + earned);
        const newPress = presses + 1;
        setPresses(newPress);

        if (sfxOn) {
            playClick();
            if (newPress % 5 === 0) playAirhorn();
        }

        const root = rootRef.current;
        if (root && root.animate) {
            if (root.getAnimations) {
                for (const a of root.getAnimations()) {
                    if (a.id === 'pb-shake') a.cancel();
                }
            }
            const anim = root.animate(
                [
                    {transform: 'translate(0, 0) rotate(0deg)'},
                    {transform: 'translate(-7px, 4px) rotate(-0.5deg)', offset: 0.25},
                    {transform: 'translate(6px, -4px) rotate(0.5deg)', offset: 0.5},
                    {transform: 'translate(-3px, 2px) rotate(-0.3deg)', offset: 0.75},
                    {transform: 'translate(0, 0) rotate(0deg)'},
                ],
                {duration: 240, easing: 'ease-out', fill: 'none'}
            );
            anim.id = 'pb-shake';
        }

        if (root) {
            if (bgFlashTimerRef.current) clearTimeout(bgFlashTimerRef.current);
            root.style.background = 'radial-gradient(circle at center, #FF8DBC 0%, #5B3BF4 60%, #0D0533 100%)';
            bgFlashTimerRef.current = setTimeout(() => {
                if (root) {
                    root.style.background = 'radial-gradient(circle at top, #1a1033 0%, #0D0533 60%, #000 100%)';
                }
            }, 180);
        }

        spawnConfetti(Math.round(8 * FX_SCALE));
        spawnEmojis(Math.round((5 + Math.random() * 3) * FX_SCALE));
        if (Math.random() > 0.4) spawnHype(1);

        if (RUNAWAY_ENABLED && presses >= 3 && presses < 12 && dt > 200) {
            const btn = document.querySelector('.pb-press-btn');
            if (btn) {
                btn.style.transform = `translate(${(Math.random() - 0.5) * 240}px, ${(Math.random() - 0.5) * 100}px)`;
                setTimeout(() => { if (btn) btn.style.transform = ''; }, 500);
            }
        }
    }, [stats.perClick, sfxOn, presses]);

    const buy = (u) => {
        const n = owned[u.key] || 0;
        const cost = Math.ceil(u.base * Math.pow(u.mult, n));
        if (count < cost) return;
        setCount((c) => c - cost);
        setOwned((o) => ({...o, [u.key]: n + 1}));
        if (sfxOn) playPurchase();
    };

    const reset = () => {
        setCount(0); setTotalEarned(0); setPresses(0);
        setOwned({}); setNews(null);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.target?.tagName === 'INPUT') return;
            if (e.repeat) return;
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); }
            else if (e.key === 'r' || e.key === 'R') reset();
            else if (e.key === 'm' || e.key === 'M') setMusicOn((v) => !v);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [press]);

    return (
        <div
            ref={rootRef}
            className="min-h-screen relative overflow-hidden select-none"
            style={{
                background: 'radial-gradient(circle at top, #1a1033 0%, #0D0533 60%, #000 100%)',
                transition: 'background 0.18s',
            }}
        >
            <div className="relative z-20 px-6 py-4 flex items-center gap-3 border-b border-white/10 bg-black/30 backdrop-blur-md">
                <div className="flex items-center gap-3 text-white">
                    <div className="rounded-lg flex items-center justify-center shrink-0" style={{width:40,height:40,backgroundColor:'#0D0533'}}>
                        <svg viewBox="0 0 100 100" style={{width:26,height:26}}>
                            <path d="M 76 35 A 30 30 0 1 0 76 65" stroke="#5B3BF4" strokeWidth="14" fill="none" strokeLinecap="round" />
                            <path d="M 50 80 A 30 30 0 0 0 76 65" stroke="#A66FD5" strokeWidth="14" fill="none" strokeLinecap="round" />
                            <circle cx="72" cy="50" r="7" fill="#FF8DBC" />
                        </svg>
                    </div>
                    <span className="font-display font-bold text-lg tracking-tight">
                        Curio Clicker{IS_EMBEDDED ? ' · lite' : ''}
                    </span>
                </div>
                <div className="ml-auto flex items-center gap-2.5 text-white text-sm">
                    <button onClick={() => setMusicOn((v) => !v)} className={`px-4 py-2.5 rounded-full font-semibold border-2 transition-all ${musicOn ? 'bg-purple-purple border-purple-purple shadow-lg' : 'bg-white/5 border-white/15 hover:bg-white/15 hover:border-white/30'}`}>
                        {musicOn ? '🎵 Music · on' : '🎵 Music · off'}
                    </button>
                    <button onClick={() => setSfxOn((v) => !v)} className={`px-4 py-2.5 rounded-full font-semibold border-2 transition-all ${sfxOn ? 'bg-pink-pink border-pink-pink shadow-lg' : 'bg-white/5 border-white/15 hover:bg-white/15 hover:border-white/30'}`}>
                        {sfxOn ? '🔊 SFX · on' : '🔇 SFX · off'}
                    </button>
                    <button onClick={reset} className="px-4 py-2.5 rounded-full bg-white/5 border-2 border-white/15 hover:bg-white/15 text-white font-semibold transition-all">
                        ↺ Reset
                    </button>
                </div>
            </div>

            {news && (
                <div className="pb-news-toast absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-purple-purple text-white px-5 py-2 rounded-full font-semibold text-sm shadow-lg">
                    📰 {news}
                </div>
            )}

            <div className="flex" style={{minHeight: 'calc(100vh - 76px)'}}>
                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                    <div className="absolute top-6 right-8 text-right text-white font-mono z-10">
                        <div className="text-5xl font-bold tabular-nums" style={{textShadow: '0 2px 12px rgba(91, 59, 244, 0.6)'}}>{fmtNum(count)}</div>
                        <div className="text-xs text-white/60 mt-1 uppercase tracking-widest">+{fmtNum(stats.perClick)} / press · +{fmtNum(stats.perSecond)} /s</div>
                    </div>

                    {/* Worker layer (background, persistent emojis wandering) */}
                    <div ref={workerLayerRef} style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden'}} />

                    {/* FX layer (click bursts, on top of workers) */}
                    <div ref={fxLayerRef} style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, contain: 'layout style paint'}} />

                    <h1 className="font-display font-bold tracking-tight text-center relative z-10" style={{fontSize:'clamp(28px, 4vw, 56px)', color:'#fff', textShadow:'0 4px 24px rgba(91, 59, 244, 0.6)'}}>{stage.warn}</h1>
                    <p className="text-base text-white/70 mt-2 mb-10 text-center relative z-10">{stage.sub}</p>

                    <button
                        onClick={press}
                        aria-label="Press"
                        className="pb-press-btn relative z-10"
                        style={{
                            width: buttonSize, height: buttonSize, borderRadius:'50%', border:'none', cursor:'pointer',
                            background:'radial-gradient(circle at 32% 22%, #B49BFF 0%, #8B5BFF 25%, #5B3BF4 60%, #3617B0 100%)',
                            boxShadow:'0 16px 44px rgba(91, 59, 244, 0.7), 0 0 80px rgba(255, 141, 188, 0.3), inset 0 -10px 24px rgba(13, 5, 51, 0.55), inset 0 6px 12px rgba(255, 255, 255, 0.35)',
                            transition:'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease',
                            animation:'pb-pulse 2s ease-in-out infinite',
                            display:'flex', alignItems:'center', justifyContent:'center', padding:0,
                            willChange: 'transform',
                        }}
                    >
                        <svg viewBox="0 0 100 100" style={{width: buttonSvgSize, height: buttonSvgSize, filter:'drop-shadow(0 4px 8px rgba(13, 5, 51, 0.5))'}}>
                            <path d="M 76 35 A 30 30 0 1 0 76 65" stroke="#FFFFFF" strokeWidth="14" fill="none" strokeLinecap="round" />
                            <path d="M 50 80 A 30 30 0 0 0 76 65" stroke="#FFD3E0" strokeWidth="14" fill="none" strokeLinecap="round" />
                            <circle cx="72" cy="50" r="7" fill="#FF8DBC" />
                        </svg>
                    </button>

                    <div className="mt-6 text-xs text-white/40 text-center relative z-10">Spacebar = press · M = music · R = reset</div>
                </div>

                <aside className="w-80 bg-black/40 backdrop-blur-md border-l border-white/10 p-4 overflow-y-auto">
                    <h2 className="font-display font-bold text-lg text-white mb-1">Upgrades</h2>
                    <p className="text-xs text-white/50 mb-4">Spend clicks. Earn more clicks.</p>
                    <div className="space-y-2">
                        {UPGRADES.map((u) => {
                            const n = owned[u.key] || 0;
                            const cost = Math.ceil(u.base * Math.pow(u.mult, n));
                            const can = count >= cost;
                            const cap = WORKER_CAPS[u.key];
                            const atCap = cap != null && n >= cap;
                            return (
                                <button key={u.key} disabled={!can || atCap} onClick={() => buy(u)} className={`w-full text-left p-3 rounded-lg border transition-colors ${can && !atCap ? 'bg-white/5 hover:bg-white/15 border-white/10 cursor-pointer' : 'bg-white/0 border-white/5 opacity-50 cursor-not-allowed'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{u.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{u.name}</div>
                                            <div className="text-xs text-white/60">{u.desc}</div>
                                        </div>
                                        {n > 0 && (<span className="text-xs font-mono text-white/80 bg-white/10 px-1.5 py-0.5 rounded">×{n}{cap != null ? `/${cap}` : ''}</span>)}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className={`text-xs font-mono font-bold ${can && !atCap ? 'text-yellow-yellowLight1' : 'text-white/40'}`}>
                                            {atCap ? 'MAX' : `${fmtNum(cost)} clicks`}
                                        </span>
                                        {can && !atCap && (<span className="text-xs text-white font-semibold">Buy →</span>)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/40">Lifetime: {fmtNum(totalEarned)} clicks · {presses} presses · {IS_EMBEDDED ? 'lite mode' : 'full mode'}</div>
                </aside>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
