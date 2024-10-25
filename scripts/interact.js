// interact.js

const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ethers = require('ethers');

const contract = require("../artifacts/contracts/HelloWorld.sol/HelloWorld.json");

// provider - Alchemy
const alchemyProvider = new ethers.providers.JsonRpcProvider(API_URL);

// signer - you
const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// contract instance
const helloWorldContract = new ethers.Contract(CONTRACT_ADDRESS, contract.abi, signer);

async function main() {
    const message = await helloWorldContract.message();
    console.log("The message is: " + message); 

    console.log("Updating the message...");
    const tx = await helloWorldContract.update("this is the new message", { 
        gasLimit: ethers.utils.hexlify(1000000),  // Adjust gas limit if needed
        maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),  // Update to match network's gas tip
        maxFeePerGas: ethers.utils.parseUnits('40', 'gwei')  });
    await tx.wait();

    const newMessage = await helloWorldContract.message();
    console.log("The new message is: " + newMessage); 
}

main();