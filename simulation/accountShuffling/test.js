const fs = require("fs");
const path = require("path");
const readline = require("readline");

const logPath = path.resolve(__dirname, "test.log");
const logStream = fs.createWriteStream(logPath, { flags: "a" });

function log(message) {
    console.log(message);
    logStream.write(`${new Date().toISOString()} ${message}\n`);
}

const tracePath = path.resolve(__dirname, "../trace_features.jsonl");

const rl = readline.createInterface({
    input: fs.createReadStream(tracePath),
    crlfDelay: Infinity,
});


async function main() {
    const traces = [];
    for await (const line of rl) {
        log(`[DEBUG] Read line: ${line}`);
        if (!line.trim()) continue;
        traces.push(JSON.parse(line));
    }
    log(`[INFO] Total traces read: ${traces.length}`);
}

main().then(() => {
    logStream.end();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

