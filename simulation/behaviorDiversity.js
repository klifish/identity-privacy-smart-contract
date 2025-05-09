// simulation_behavior_diversity.js
// -------------------------------------------------------------
// Behaviour‑diversity trace generator (Node >= 18).
// Generates heterogeneous UserOperation stubs for account‑abstraction
// privacy‑entropy simulations.
// -------------------------------------------------------------
// HOW TO RUN (default: 30 users, 1 day, 8 actions per user)
//   node simulation_behavior_diversity.js
// or customise:
//   node simulation_behavior_diversity.js --users 500 --days 7 --actions 10 --seed 42
// Output → trace_features.jsonl  (one JSON per line)

const fs = require("fs");
const { randomInt, randomUUID } = require("crypto");

// ---------------------------
//  Utility helpers
// ---------------------------
function gauss(mu = 0, sigma = 1) {
    // Box–Muller
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function choice(arr) {
    return arr[randomInt(arr.length)];
}

function weightedChoice(weights) {
    const entries = Object.entries(weights);
    const sum = entries.reduce((acc, [, w]) => acc + w, 0);
    let r = Math.random() * sum;
    for (const [k, w] of entries) {
        if (r < w) return k;
        r -= w;
    }
    return entries.at(-1)[0];
}

// ---------------------------
//  Role templates (Layer A)
// ---------------------------
const ROLES = {
    doctor: {
        actionMix: { deploy: 0, share: 6, claim: 0 },
        activeHours: [...Array(10).keys()].map((i) => i + 8), // 08–17
    },
    analyst: {
        actionMix: { deploy: 0, share: 4, claim: 0 },
        activeHours: [...Array(6).keys()], // 00–05
    },
    insurer: {
        actionMix: { deploy: 1, share: 0, claim: 3 },
        activeHours: [...Array(6).keys()].map((i) => i + 10), // 10–15
    },
    researcher: {
        actionMix: { deploy: 0, share: 5, claim: 0 },
        activeHours: [...Array(8).keys()].map((i) => i + 12), // 12–19
    },
};


const GAS_LOOKUP = {
    deploy: [150_000, 250_000],
    share: [500_000, 800_000],
    claim: [200_000, 400_000],
};

function randomGasRange([min, max]) {
    return randomInt(min, max + 1);
}

// ---------------------------
//  Population + trace
// ---------------------------
function createUser(uid) {
    const roleName = choice(Object.keys(ROLES));
    const role = ROLES[roleName];
    return {
        uid,
        role: roleName,
        activeHours: role.activeHours,
        actionMix: role.actionMix,
    };
}

function generatePopulation(n) {
    return Array.from({ length: n }, (_, i) => createUser(i));
}

function sampleTimestamp(baseDate, hourArray) {
    const hour = choice(hourArray);
    const minute = randomInt(60);
    const second = randomInt(60);
    const jitter = gauss(0, 300); // ±5 min
    const date = new Date(baseDate);
    date.setUTCHours(hour, minute, second, 0);
    date.setUTCSeconds(date.getUTCSeconds() + jitter);
    return Math.max(baseDate.getTime() / 1, date.getTime());
}

function emitUserOp(user, action, timestamp) {
    const [minGas, maxGas] = GAS_LOOKUP[action];
    return {
        uid: user.uid,
        role: user.role,
        action,
        gas: randomGasRange([minGas, maxGas]),
        timestamp: Math.floor(timestamp / 1000),
        txHash: randomUUID(), // stub placeholder
    };
}

function generateTrace(population, { days = 1, actionsPerDay = 8 } = {}) {
    const baseDate = new Date();
    baseDate.setUTCHours(0, 0, 0, 0);
    const trace = [];
    for (let d = 0; d < days; d++) {
        const dayBase = new Date(baseDate.getTime() + d * 864e5);
        population.forEach((user) => {
            for (let i = 0; i < actionsPerDay; i++) {
                const action = weightedChoice(user.actionMix);
                const ts = sampleTimestamp(dayBase, user.activeHours);
                trace.push(emitUserOp(user, action, ts));
            }
        });
    }
    return trace.sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------
//  CLI glue
// ---------------------------
const argv = process.argv.slice(2);
function arg(name, def) {
    const idx = argv.indexOf("--" + name);
    return idx === -1 ? def : Number(argv[idx + 1]);
}

const USERS = arg("users", 10);
const DAYS = arg("days", 1);
const ACTIONS = arg("actions", 8);

const population = generatePopulation(USERS);
const trace = generateTrace(population, { days: DAYS, actionsPerDay: ACTIONS });

fs.writeFileSync(
    "./simulation/trace_features.jsonl",
    trace.map((t) => JSON.stringify(t)).join("\n") + "\n",
    "utf8"
);

console.log(
    `[behaviour‑diversity] wrote ${trace.length} user operations for ${population.length} users → trace_features.jsonl`
);
