const { ethers } = require("hardhat");
const { computePedersenHash } = require("../utils");
const { signer } = require("../constants");
const { getAccountFactoryAddress } = require("../isDeployed");

// commitment is the hash of the secret+countId; countId is the number of times the user has verified their identity
async function createSmartAccount(commitment) {
    console.log("Creating smart account");

    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const myAccountFactory = MyAccountFactoryContract.attach(await getAccountFactoryAddress());

    const salt = 1

    const tx = await myAccountFactory.createAccount(commitment, salt);
    await tx.wait();
}

async function getSender(commitment, salt) {
    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const myAccountFactory = MyAccountFactoryContract.attach(await getAccountFactoryAddress());

    const accountAddress = await myAccountFactory.getSender(commitment, salt);
    return accountAddress;
}



async function main() {
    const secret = "hello world";
    const countId = 0;
    const commitment = await computePedersenHash(secret + countId);
    const address = await createSmartAccount(commitment);
    console.log("Smart account created at address:", address);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { createSmartAccount, getSender };