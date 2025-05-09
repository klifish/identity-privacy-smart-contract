const {
    deployUserDataWithSmartAccountSingle,
    updateUserDataWithSmartAccount,
} = require("./userDataDeployer");
const fs = require("fs");

// ---- persistent log file ----
const LOG_PATH = "./simulation/replay.log";
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    logStream.write(line + "\n");
}

// ---------------------------
// CLI helper & time‑compression factor
// Usage:  --realtime <minutes>  (real‑world minutes that equal 24 simulated hours)
// Example: --realtime 10  → 1 day compressed into 10 minutes
// ---------------------------
function cliArg(flag, def) {
    const idx = process.argv.indexOf("--" + flag);
    if (idx === -1 || idx + 1 >= process.argv.length) return def;
    return Number(process.argv[idx + 1]);
}
const REAL_MIN_PER_DAY = cliArg("realtime", 10);     // default 10
const SCALE = 1440 / REAL_MIN_PER_DAY;               // compression ratio


// ---------- load heterogeneous trace ----------
const TRACE_PATH = "./simulation/trace_features.jsonl";
const traceLines = fs.readFileSync(TRACE_PATH, "utf8").trim().split("\n");
const trace = traceLines.map(JSON.parse).sort((a, b) => a.timestamp - b.timestamp);

// --- ensure all timestamps are in the future ---
const NOW_SEC = Math.floor(Date.now() / 1000);
// push everything at least 5 seconds into the future
const offsetSec = NOW_SEC + 5 - trace[0].timestamp;
if (offsetSec > 0) {
    trace.forEach(op => { op.timestamp += offsetSec; });
    log(`Applied +${offsetSec}s offset so first op starts in 5 s`);
}
const firstSimTs = trace[0].timestamp;   // baseline for relative timing

async function main() {
    const walletsFilePath = "./simulation/wallets.json";
    const walletsArr = JSON.parse(fs.readFileSync(walletsFilePath, "utf8"));
    // build quick lookup: uid -> wallet object
    const walletByUid = Object.fromEntries(
        walletsArr.map((w, idx) => [w.uid ?? idx, w])
    );

    for (const op of trace) {
        const now = Math.floor(Date.now() / 1000);
        const scaledTs = firstSimTs + Math.floor((op.timestamp - firstSimTs) / SCALE);

        const waitSec = scaledTs - now;
        if (waitSec > 0) {
            log(`[${op.uid}] waiting ${waitSec}s until ${new Date(op.timestamp * 1000).toISOString()}`);
            await new Promise((res) => setTimeout(res, waitSec * 1000));
        }
        const wallet = walletByUid[op.uid];
        if (!wallet) {
            console.warn(`No wallet entry for uid ${op.uid}; skipping`);
            continue;
        }

        if (op.action === "deploy") {
            if (wallet.userDataAddress) {
                log(`[${op.uid}] already has contract; skip deploy`);
            } else {
                userDataAddress = await deployUserDataWithSmartAccountSingle(
                    wallet.secret,
                    wallet.smartAccountAddress
                );
                wallet.userDataAddress = userDataAddress;
                log(`[${op.uid}] deploy -> ${userDataAddress}`);
            }
        } else if (op.action === "share" || op.action === "upload") {
            // ensure the user has a contract; deploy lazily if not present
            let targetContract = wallet.userDataAddress;
            if (!targetContract) {
                targetContract = await deployUserDataWithSmartAccountSingle(
                    wallet.secret,
                    wallet.smartAccountAddress
                );
                wallet.userDataAddress = targetContract;
                log(`[${op.uid}] lazy-deployed contract -> ${targetContract}`);
            }

            await updateUserDataWithSmartAccount(
                wallet.secret,
                wallet.smartAccountAddress,
                targetContract
            );
            log(`[${op.uid}] share/update`);
        }
        break;
    }

    // persist any newly created contract addresses
    fs.writeFileSync(walletsFilePath, JSON.stringify(walletsArr, null, 2));
    log("wallets.json updated with new contract addresses");
}

main()
    .then(() => {
        logStream.end();
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });