const fs = require("fs");
const path = require("path");

const contractsDir = path.join(__dirname, "../contracts");

const verifiers = [
    { file: "RegisterGroth16Verifier.sol", name: "RegisterGroth16Verifier" },
    { file: "CommitmentGroth16Verifier.sol", name: "CommitmentGroth16Verifier" },
];

function updateContractName(filePath, contractName) {
    try {
        let content = fs.readFileSync(filePath, "utf8");
        const newContent = content.replace(/contract\s+\w+\s+{/g, `contract ${contractName} {`);

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, "utf8");
            console.log(`Updated contract name in ${filePath} to: ${contractName}`);
        } else {
            console.log(`No changes needed for ${filePath}`);
        }
    } catch (error) {
        console.error(`Error updating ${filePath}:`, error.message);
    }
}

verifiers.forEach(({ file, name }) => {
    const filePath = path.join(contractsDir, file);
    updateContractName(filePath, name);
});