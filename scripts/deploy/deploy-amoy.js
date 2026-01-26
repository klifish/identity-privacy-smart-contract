/**
 * Deploy contracts to Polygon Amoy network
 *
 * Usage: npx hardhat run scripts/deploy/deploy-amoy.js --network polygonAmoy
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Amoy configuration
const AMOY_RPC_URL = "https://polygon-amoy.g.alchemy.com/v2/VG6iwUaOlQPYcDCb3AlkyAxrAXF7UzU9";
const PRIVATE_KEY = "15e0c4872f8cc5b022a6782baa434eefde01947d1ea3b553eae1e3eed3954b31";
const MERKLE_TREE_LEVEL = 20;
const ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Existing Hasher on Amoy (doesn't need redeployment)
const HASHER_ADDRESS = "0xC59A250aAE62a1871376b7619C22beDAc9F434CE";

const deployedContractsPath = path.join(__dirname, './deployedContracts-amoy.json');

function saveDeployed(contracts) {
    fs.writeFileSync(deployedContractsPath, JSON.stringify(contracts, null, 2));
}

function loadDeployed() {
    if (fs.existsSync(deployedContractsPath)) {
        return JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    }
    return {};
}

async function main() {
    console.log("=".repeat(60));
    console.log("Deploying contracts to Polygon Amoy");
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deployer address:", signer.address);
    const balance = await provider.getBalance(signer.address);
    console.log("Balance:", ethers.formatEther(balance), "MATIC");

    if (balance < ethers.parseEther("0.1")) {
        throw new Error("Insufficient balance for deployment. Need at least 0.1 MATIC");
    }

    const deployed = loadDeployed();
    deployed.Hasher = HASHER_ADDRESS;

    // 1. Deploy RegisterGroth16Verifier
    console.log("\n[1/4] Deploying RegisterGroth16Verifier...");
    const RegisterVerifierFactory = await ethers.getContractFactory("RegisterGroth16Verifier", signer);
    const registerVerifier = await RegisterVerifierFactory.deploy();
    await registerVerifier.waitForDeployment();
    const registerVerifierAddress = await registerVerifier.getAddress();
    console.log("RegisterGroth16Verifier deployed at:", registerVerifierAddress);
    deployed.RegisterVerifier = registerVerifierAddress;
    saveDeployed(deployed);

    // 2. Deploy MerkleRegistry
    console.log("\n[2/4] Deploying MerkleRegistry...");
    const RegistryFactory = await ethers.getContractFactory("MerkleRegistry", signer);
    const registry = await RegistryFactory.deploy(MERKLE_TREE_LEVEL, HASHER_ADDRESS, registerVerifierAddress);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("MerkleRegistry deployed at:", registryAddress);
    deployed.Registry = registryAddress;
    saveDeployed(deployed);

    // 3. Deploy RunnerFactory
    console.log("\n[3/4] Deploying RunnerFactory...");
    const RunnerFactoryFactory = await ethers.getContractFactory("RunnerFactory", signer);
    const runnerFactory = await RunnerFactoryFactory.deploy(ENTRY_POINT_ADDRESS, registryAddress);
    await runnerFactory.waitForDeployment();
    const runnerFactoryAddress = await runnerFactory.getAddress();
    console.log("RunnerFactory deployed at:", runnerFactoryAddress);
    deployed.RunnerFactory = runnerFactoryAddress;
    saveDeployed(deployed);

    // 4. Create a Runner instance
    console.log("\n[4/4] Creating Runner instance...");
    const runnerFactoryContract = await ethers.getContractAt("RunnerFactory", runnerFactoryAddress, signer);

    // Check if runner already exists for this signer
    const predictedAddress = await runnerFactoryContract.getAddress(signer.address, 0);
    const code = await provider.getCode(predictedAddress);

    let runnerAddress;
    if (code !== '0x') {
        console.log("Runner already exists at:", predictedAddress);
        runnerAddress = predictedAddress;
    } else {
        const tx = await runnerFactoryContract.createAccount(signer.address, 0);
        await tx.wait();
        runnerAddress = predictedAddress;
        console.log("Runner created at:", runnerAddress);
    }
    deployed.Runner = runnerAddress;
    saveDeployed(deployed);

    // Get current block for MERKLE_REGISTRY_DEPLOY_BLOCK
    const currentBlock = await provider.getBlockNumber();
    deployed.DeployBlock = currentBlock;
    saveDeployed(deployed);

    console.log("\n" + "=".repeat(60));
    console.log("Deployment complete!");
    console.log("=".repeat(60));
    console.log("\nDeployed contracts:");
    console.log(JSON.stringify(deployed, null, 2));

    console.log("\n\nUpdate ui/lib/contracts.ts with:");
    console.log(`export const MERKLE_REGISTRY_ADDRESS = "${registryAddress}";`);
    console.log(`export const RUNNER_FACTORY_ADDRESS = "${runnerFactoryAddress}";`);
    console.log(`export const RUNNER_ADDRESS = "${runnerAddress}";`);

    console.log("\nUpdate ui/.env.local with:");
    console.log(`MERKLE_REGISTRY_DEPLOY_BLOCK="${currentBlock}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
