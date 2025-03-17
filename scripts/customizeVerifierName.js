// const fs = require("fs");

// const registerPlonkVerifierPath = "contracts/RegisterPlonkVerifier.sol";
// let registerPlonkVerifierContent = fs.readFileSync(registerPlonkVerifierPath, "utf8");
// const registerPlonkVerifierName = "RegisterPlonkVerifier";
// registerPlonkVerifierContent = registerPlonkVerifierContent.replace(/contract\s+\w+\s+{/g, `contract ${registerPlonkVerifierName} {`);
// fs.writeFileSync(registerPlonkVerifierPath, registerPlonkVerifierContent, "utf8");
// console.log(`Updated contract name to: ${registerPlonkVerifierName}`);

// const commitmentPlonkVerifierPath = "contracts/CommitmentPlonkVerifier.sol";
// let commitmentPlonkVerifierContent = fs.readFileSync(commitmentPlonkVerifierPath, "utf8");
// const commitmentPlonkVerifierName = "CommitmentPlonkVerifier";
// commitmentPlonkVerifierContent = commitmentPlonkVerifierContent.replace(/contract\s+\w+\s+{/g, `contract ${commitmentPlonkVerifierName} {`);
// fs.writeFileSync(commitmentPlonkVerifierPath, commitmentPlonkVerifierContent, "utf8");
// console.log(`Updated contract name to: ${commitmentPlonkVerifierName}`);

// const registerGroth16VerifierPath = "contracts/RegisterGroth16Verifier.sol";
// let registerGroth16VerifierContent = fs.readFileSync(registerGroth16VerifierPath, "utf8");
// const registerGroth16VerifierName = "RegisterGroth16Verifier";
// registerGroth16VerifierContent = registerGroth16VerifierContent.replace(/contract\s+\w+\s+{/g, `contract ${registerGroth16VerifierName} {`);
// fs.writeFileSync(registerGroth16VerifierPath, registerGroth16VerifierContent, "utf8");
// console.log(`Updated contract name to: ${registerGroth16VerifierName}`);

// const commitmentGroth16VerifierPath = "contracts/CommitmentGroth16Verifier.sol";
// let commitmentGroth16VerifierContent = fs.readFileSync(commitmentGroth16VerifierPath, "utf8");
// const commitmentGroth16VerifierName = "CommitmentGroth16Verifier";
// commitmentGroth16VerifierContent = commitmentGroth16VerifierContent.replace(/contract\s+\w+\s+{/g, `contract ${commitmentGroth16VerifierName} {`);
// fs.writeFileSync(commitmentGroth16VerifierPath, commitmentGroth16VerifierContent, "utf8");
// console.log(`Updated contract name to: ${commitmentGroth16VerifierName}`);

const fs = require("fs");
const path = require("path");

const contractsDir = path.join(__dirname, "../contracts");

const verifiers = [
    { file: "RegisterPlonkVerifier.sol", name: "RegisterPlonkVerifier" },
    { file: "CommitmentPlonkVerifier.sol", name: "CommitmentPlonkVerifier" },
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