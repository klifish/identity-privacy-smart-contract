const { ethers } = require("hardhat");
const fs = require('fs');
const { alchemyProvider, signer } = require('../scripts/constants');
const path = require('path');

const API_URL = process.env.API_URL;

async function getUserOperationByHash(hash) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'eth_getUserOperationByHash',
                params: [hash]
            })
        });
        const json = await res.json();
        if (json.result && json.result.transactionHash) {
            console.log('transactionHash:', json.result.transactionHash);
            return json.result.transactionHash;
        } else {
            console.log('No transactionHash found in result');
            return null;
        }
    } catch (err) {
        console.error('Error fetching user op:', err);
    }
}

async function getTransactionByHash(hash, fileName = null) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'debug_traceTransaction',
                params: [hash, {
                    tracer: "callTracer",
                    timeout: "5s"
                }]
            })
        });
        const json = await res.json();

        // console.log('Transaction:', json.result);

        if (fileName) {
            fs.writeFileSync(path.join(__dirname, "data", fileName), JSON.stringify(json, null, 2));
        }
        return json.result;
    }

    // console.log('Transaction:', json.result);
    catch (err) {
        console.error('Error fetching user op:', err);
    }
}

function buildDotGraph(txJson) {
    let dot = 'digraph TransactionGraph {\n';
    let count = 0;
    function addNode(from, to, type) {
        const fromLabel = `"${from}"`;
        const toLabel = `"${to}"`;
        dot += `  ${fromLabel} -> ${toLabel} [label="${type}"];\n`;
    }

    function traverse(node) {
        if (!node || !node.to || !node.from) return;
        addNode(node.from, node.to, node.type || 'CALL');
        if (Array.isArray(node.calls)) {
            node.calls.forEach(child => traverse(child));
        }
    }

    traverse(txJson);
    dot += '}\n';
    fs.writeFileSync(path.join(__dirname, 'transactionGraph.dot'), dot);
    console.log('DOT file written to transactionGraph.dot');
}

async function main() {
    const userOpHash = '0x0ceb2919b315251a1939eb55a07fc928b19408ead78101795d9e9d5b45c8a629'; // Replace with your transaction hash
    txHash = await getUserOperationByHash(userOpHash);
    txJson = await getTransactionByHash(txHash);
    buildDotGraph(txJson);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });