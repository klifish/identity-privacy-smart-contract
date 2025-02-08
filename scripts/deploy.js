const { ethers } = require("hardhat");
const { deployHasher } = require("./deployHasher.js");

async function main() {

    // 0xb52EB40826970b9C2903715E670E18504a06B3ab
    // await deployHasher(); // No need to deploy the hasher contract again
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});