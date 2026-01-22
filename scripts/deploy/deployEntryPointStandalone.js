const { ethers } = require("hardhat");

async function main() {
    try {
        console.log("Deploying EntryPoint...");
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        const entryPoint = await EntryPoint.deploy();
        await entryPoint.waitForDeployment();
        const address = await entryPoint.getAddress();
        console.log(`ENTRY_POINT_ADDRESS=${address}`);
    } catch (error) {
        console.error("Error deploying EntryPoint:", error);
        process.exit(1);
    }
}

main();
