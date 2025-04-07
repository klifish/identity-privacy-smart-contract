const { ethers } = require("hardhat");
const fs = require('fs');
const { alchemyProvider, signer } = require('../scripts/constants');
const path = require('path');
const { execSync } = require('child_process');

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

        if (fileName) {
            fs.writeFileSync(path.join(__dirname, "data", fileName), JSON.stringify(json, null, 2));
        }
        return json.result;
    } catch (err) {
        console.error('Error fetching user op:', err);
    }
}

function buildDotGraph(txJson, outputName = 'transactionGraph') {
    const imageDir = path.join(__dirname, "image");
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
    }
    let dot = 'digraph TransactionGraph {\n';
    const edges = new Set();

    function addEdge(from, to, label) {
        const edge = `"${from}" -> "${to}"`;
        if (!edges.has(edge + label)) {
            edges.add(edge + label);
            dot += `  ${edge} [label="${label}", labelfontsize=10];\n`;
        }
    }

    function traverse(node, depth = 0, indexPath = []) {
        if (!node || !node.to || !node.from) return;
        const label = `${node.type || 'CALL'} (${indexPath.join('.') || '1'})`;
        addEdge(node.from, node.to, label);

        if (Array.isArray(node.calls)) {
            node.calls.forEach((child, index) => {
                traverse(child, depth + 1, [...indexPath, index + 1]);
            });
        }
    }

    traverse(txJson);
    dot += '}\n';
    const dotFilePath = path.join(imageDir, `${outputName}.dot`);
    fs.writeFileSync(dotFilePath, dot);
    console.log('DOT file written to', `${outputName}.dot`);

    const svgFilePath = path.join(imageDir, `${outputName}.svg`);
    try {
        execSync(`dot -Tsvg "${dotFilePath}" -o "${svgFilePath}"`);
        console.log('SVG file written to', `${outputName}.svg`);
    } catch (error) {
        console.error('Error generating SVG from DOT:', error.message);
    }
}

async function drawTransactionGraphOfUserOp(userOpHash, fileName) {
    txHash = await getUserOperationByHash(userOpHash);
    txJson = await getTransactionByHash(txHash);
    buildDotGraph(txJson, fileName); // Replace with desired output name
}

async function main() {
    // const userOpHash = '0x0ceb2919b315251a1939eb55a07fc928b19408ead78101795d9e9d5b45c8a629'; // Replace with your transaction hash
    await drawTransactionGraphOfUserOp("0x0ceb2919b315251a1939eb55a07fc928b19408ead78101795d9e9d5b45c8a629", "SmartAccountOp");
    await drawTransactionGraphOfUserOp("0xd3049fa9bd32d093f3d55e39a1d5bd79a0b6003c9e07cb0969271d78a43805d9", "IdentityPrivacyOp");

}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });