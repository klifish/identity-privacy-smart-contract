const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { alchemyProvider } = require("../../scripts/constants");

const logPath = path.resolve(__dirname, "accountShufflingSimulation.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

function log(message) {
    console.log(message);
    logStream.write(`${new Date().toISOString()} ${message}\n`);
}

const { deployUserDataWithSmartAccountSingle, updateUserDataWithSmartAccount } = require("../userDataDeployer");
const wallets = require("../wallets_with_shuffling.json");

function getWalletByUid(uid) {
    return wallets.find(w => w.index === uid);
}

function getRandomSmartAccount(wallet) {
    const accounts = [
        { address: wallet.smartAccountAddress, secret: wallet.secret },
        ...wallet.accountShuffling.map(a => ({ address: a.smartAccountAddress, secret: a.secret }))
    ];
    return accounts[Math.floor(Math.random() * accounts.length)];
}


async function processTraceFile() {
    const MAX_TRACE = 40;
    let processedCount = 0;

    const deployedUsers = new Set();
    const userDataContracts = new Map();

    const startBlock = await alchemyProvider.getBlockNumber();
    log(`[INFO] Start block number: ${startBlock}`);

    const tracePath = path.resolve(__dirname, "../trace_features.jsonl");
    const rl = readline.createInterface({
        input: fs.createReadStream(tracePath),
        crlfDelay: Infinity,
    });

    // Read all lines and parse traces
    const traces = [];
    for await (const line of rl) {
        if (!line.trim()) continue;
        traces.push(JSON.parse(line));
    }
    log(`[INFO] Read ${traces.length} traces from file`);
    traces.sort((a, b) => a.timestamp - b.timestamp);

    if (traces.length === 0) {
        log(`[ERROR] No valid trace entries found in file: ${tracePath}`);
        return;
    }

    const startTimestamp = traces[0].timestamp;
    const endTimestamp = traces[traces.length - 1].timestamp;
    const timeSpan = endTimestamp - startTimestamp;
    const simulationDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
    const scaleFactor = simulationDuration / timeSpan;
    const simulationStartTime = Date.now();

    for (const trace of traces) {
        log(`[DEBUG] Processing trace: UID=${trace.uid}, Action=${trace.action}, Timestamp=${trace.timestamp}`);
        const originalTime = trace.timestamp;
        const delay = Math.floor((originalTime - startTimestamp) * scaleFactor);
        const now = Date.now();
        const targetTime = simulationStartTime + delay;
        const waitTime = targetTime - now;
        if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));

        const wallet = getWalletByUid(trace.uid);
        if (!wallet) {
            log(`[ERROR] UID ${trace.uid} => Wallet not found`);
            continue;
        }
        const selected = getRandomSmartAccount(wallet);
        const selectedAddress = selected.address;
        const selectedSecret = selected.secret;

        if (trace.action === "deploy") {
            if (!deployedUsers.has(trace.uid)) {
                const userDataAddress = await deployUserDataWithSmartAccountSingle(selectedSecret, selectedAddress);
                deployedUsers.add(trace.uid);
                userDataContracts.set(trace.uid, userDataAddress);
                log(`[DEPLOY] UID ${trace.uid} | Address: ${selectedAddress} | Action: deploy | Result: ${userDataAddress}`);
            } else {
                log(`[SKIP] UID ${trace.uid} | Already deployed`);
            }
        } else {
            if (!deployedUsers.has(trace.uid)) {
                log(`[INFO] UID ${trace.uid} | Not explicitly deployed yet, checking for lazy deploy`);
            }
            let userDataAddress = userDataContracts.get(trace.uid);
            if (!userDataAddress) {
                log(`[INFO] UID ${trace.uid} | No contract found, deploying before update`);
                userDataAddress = await deployUserDataWithSmartAccountSingle(selectedSecret, selectedAddress);
                userDataContracts.set(trace.uid, userDataAddress);
                deployedUsers.add(trace.uid);
                log(`[DEPLOY] UID ${trace.uid} | Address: ${selectedAddress} | Action: lazy-deploy | Result: ${userDataAddress}`);
            }
            await updateUserDataWithSmartAccount(selectedSecret, selectedAddress, userDataAddress);
            log(`[UPDATE] UID ${trace.uid} | Address: ${selectedAddress} | Action: ${trace.action} | Contract: ${userDataAddress} | Result: update completed`);
        }
        if (++processedCount >= MAX_TRACE) break;
    }

    const endBlock = await alchemyProvider.getBlockNumber();
    log(`[INFO] End block number: ${endBlock}`);
}

async function processTraceFileByRole() {
    const MAX_TRACE = 40;
    let processedCount = 0;

    const deployedRoles = new Set();
    const userDataContracts = new Map();

    const startBlock = await alchemyProvider.getBlockNumber();
    log(`[INFO] Start block number: ${startBlock}`);

    const tracePath = path.resolve(__dirname, "../trace_features.jsonl");
    const rl = readline.createInterface({
        input: fs.createReadStream(tracePath),
        crlfDelay: Infinity,
    });

    const traces = [];
    for await (const line of rl) {
        if (!line.trim()) continue;
        traces.push(JSON.parse(line));
    }
    log(`[INFO] Read ${traces.length} traces from file`);
    traces.sort((a, b) => a.timestamp - b.timestamp);

    if (traces.length === 0) {
        log(`[ERROR] No valid trace entries found in file: ${tracePath}`);
        return;
    }

    const startTimestamp = traces[0].timestamp;
    const endTimestamp = traces[traces.length - 1].timestamp;
    const timeSpan = endTimestamp - startTimestamp;
    const simulationDuration = 60 * 60 * 1000;
    const scaleFactor = simulationDuration / timeSpan;
    const simulationStartTime = Date.now();

    log(`[CONFIG] MAX_TRACE = ${MAX_TRACE}`);
    log(`[CONFIG] Simulation duration = ${simulationDuration / 1000}s`);
    log(`[CONFIG] Trace count = ${traces.length}`);
    log(`[CONFIG] Time span (realistic): ${startTimestamp} → ${endTimestamp} (${timeSpan}s)`);
    log(`[CONFIG] Scale factor: ${scaleFactor.toFixed(4)}`);

    const roleWallets = require("./role_merged_wallets.json");

    const getRoleWallet = (role) => {
        const entry = roleWallets.find(r => r.role === role);
        if (!entry) return null;
        const accounts = entry.addresses.map(a => ({
            address: a.smartAccountAddress,
            secret: a.secret
        }));
        return accounts;
    };

    const roleUpdateCounter = new Map();

    for (const trace of traces) {
        const role = trace.role;
        log(`[DEBUG] Processing trace: Role=${role}, Action=${trace.action}, Timestamp=${trace.timestamp}`);
        const originalTime = trace.timestamp;
        const delay = Math.floor((originalTime - startTimestamp) * scaleFactor);
        const now = Date.now();
        const targetTime = simulationStartTime + delay;
        const waitTime = targetTime - now;
        log(`[TRACE] Role=${role} | OriginalTime=${originalTime} | Delay=${delay}ms | Now=${now} | Target=${targetTime} | Wait=${waitTime}ms`);
        if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));

        const accounts = getRoleWallet(role);
        if (!accounts || accounts.length === 0) {
            log(`[ERROR] Role ${role} => No wallets found`);
            continue;
        }
        const selected = accounts[Math.floor(Math.random() * accounts.length)];
        const selectedAddress = selected.address;
        const selectedSecret = selected.secret;

        // Log actual system time before sending a transaction
        log(`[SEND] Role=${role} | Timestamp=${new Date().toISOString()} | Action=${trace.action} | Selected=${selectedAddress}`);

        if (trace.action === "deploy") {
            if (!deployedRoles.has(role)) {
                const userDataAddress = await deployUserDataWithSmartAccountSingle(selectedSecret, selectedAddress);
                deployedRoles.add(role);
                userDataContracts.set(role, userDataAddress);
                log(`[DEPLOY] Role ${role} | Address: ${selectedAddress} | Action: deploy | Result: ${userDataAddress}`);
            } else {
                log(`[SKIP] Role ${role} | Already deployed`);
            }
        } else {
            if (!deployedRoles.has(role)) {
                log(`[INFO] Role ${role} | Not explicitly deployed yet, checking for lazy deploy`);
            }
            let userDataAddress = userDataContracts.get(role);
            if (!userDataAddress) {
                log(`[INFO] Role ${role} | No contract found, deploying before update`);
                userDataAddress = await deployUserDataWithSmartAccountSingle(selectedSecret, selectedAddress);
                userDataContracts.set(role, userDataAddress);
                deployedRoles.add(role);
                log(`[DEPLOY] Role ${role} | Address: ${selectedAddress} | Action: lazy-deploy | Result: ${userDataAddress}`);
            }
            await updateUserDataWithSmartAccount(selectedSecret, selectedAddress, userDataAddress);
            const count = roleUpdateCounter.get(role) || 0;
            roleUpdateCounter.set(role, count + 1);
            log(`[UPDATE] Role=${role} | Update #${roleUpdateCounter.get(role)} | Address: ${selectedAddress} | Contract: ${userDataAddress}`);
        }

        if (++processedCount >= MAX_TRACE) break;
    }

    log(`[SUMMARY] Total processed: ${processedCount}`);
    log(`[SUMMARY] Contracts deployed: ${[...userDataContracts.keys()].length}`);
    log(`[SUMMARY] Roles deployed: ${[...deployedRoles].join(", ")}`);
    log(`[SUMMARY] Update counts per role: ${JSON.stringify(Object.fromEntries(roleUpdateCounter))}`);

    const endBlock = await alchemyProvider.getBlockNumber();
    log(`[INFO] End block number: ${endBlock}`);
}

processTraceFileByRole()
    .then(() => {
        logStream.end();
        process.exit(0);
    })
    .catch((err) => {
        console.error("Unhandled error in processTraceFile:", err);
        process.exit(1);
    });