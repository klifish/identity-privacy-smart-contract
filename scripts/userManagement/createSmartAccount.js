const { ethers } = require("hardhat");
const { computePedersenHash } = require("../utils");
const { signer } = require("../constants");
const { getAccountFactoryAddress } = require("../deploy/isDeployed");

// commitment is the hash of the secret+countId; countId is the number of times the user has verified their identity
async function createSmartAccount(commitment, options = {}) {
    console.log("Creating smart account");

    const { salt = 1, force = false } = options;
    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const myAccountFactory = MyAccountFactoryContract.attach(await getAccountFactoryAddress());

    const predictedAddress = await myAccountFactory.getSender(commitment, salt);
    const code = await signer.provider.getCode(predictedAddress);

    if (!force && code && code !== "0x") {
        console.log(`Smart account already deployed at ${predictedAddress}`);
        return { address: predictedAddress, deployed: false };
    }

    const tx = await myAccountFactory.createAccount(commitment, salt);
    await tx.wait();

    return { address: predictedAddress, deployed: true };
}

async function getSender(commitment, salt = 1) {
    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const accountFactoryAddress = await getAccountFactoryAddress();
    const myAccountFactory = MyAccountFactoryContract.attach(accountFactoryAddress);

    const accountAddress = await myAccountFactory.getSender(commitment, salt);
    return accountAddress;
}



async function main() {
    const secret = "hello world";
    const countId = 0;
    const commitment = await computePedersenHash(secret + countId);
    const { address, deployed } = await createSmartAccount(commitment);
    console.log(`Smart account ${deployed ? "created" : "already exists"} at address:`, address);
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