// interact.js

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS;
const ethers = require('ethers');
const hre = require("hardhat");

const contract = require("../artifacts/contracts/MerkleRegistry.sol/MerkleRegistry.json");

// provider - Alchemy
const alchemyProvider = new ethers.providers.JsonRpcProvider(API_URL);

// signer - you
// const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);


async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log(signer);

// contract instance 0xFEEd257f0482b61ECb53D68b953029e314Efba3D
    const merkleRegistryContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);
    
    const accountAddress = await signer.getAddress();
    console.log("The account address is: " + accountAddress);

    const levels = await merkleRegistryContract.getLevels();
    console.log("The levels is: " + levels); 

    // const tx = await merkleRegistryContract.setLevels(30, { 
    //         gasLimit: ethers.utils.hexlify(1000000),  // Adjust gas limit if needed
    //         maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),  // Update to match network's gas tip
    //         maxFeePerGas: ethers.utils.parseUnits('40', 'gwei')  });
    // console.log("Transaction hash:", tx.hash);

    // await tx.wait();
    // console.log("Levels set successfully!");

    const levels_updated = await merkleRegistryContract.getLevels();
    console.log("The levels is: " + levels_updated); 

    

    // accountAddress = await signer.getAddress();    
    const leaf = ethers.utils.hexZeroPad(accountAddress, 32);
    console.log(leaf)

    const tx = await merkleRegistryContract.registerUser(leaf, { 
        gasLimit: ethers.utils.hexlify(1000000),  // Adjust gas limit if needed
        maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),  // Update to match network's gas tip
        maxFeePerGas: ethers.utils.parseUnits('40', 'gwei')  });
    console.log("Transaction hash:", tx.hash);

    await tx.wait();
    console.log("User registered successfully!");

}

main();