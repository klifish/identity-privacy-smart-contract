const { ethers } = require("hardhat");
const { signer } = require("../constants");

// commitment is the hash of the secret+countId; countId is the number of times the user has verified their identity
async function createSmartAccount(commitment) {
    console.log("Creating smart account");

    const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory", signer);
    const myAccountFactory = MyAccountFactoryContract.attach(await getAccountFactoryAddress());

    // const commitment = await computePedersenHash(secret);
    const salt = 1

    // Here, I am not sure why the following two calls of getAddress() return same address
    // is it because getAddress() is conflicting with the function in the contract? here the reuslt is the address of account factory
    // const accountAddress = await myAccountFactory.getAddress(commitment, salt);
    // console.log("Account address:", accountAddress);

    // const accountAddress1 = await myAccountFactory.getAddress("111", salt + 1);
    // console.log("Account address:", accountAddress1);

    const tx = await myAccountFactory.createAccount(commitment, salt);
    await tx.wait();

    const filter = myAccountFactory.filters.AccountCreated();
    const events = await myAccountFactory.queryFilter(filter);

    latestEvent = events[events.length - 1];
    console.log("MyAccount address:", latestEvent.args.accountAddress);
    return latestEvent.args.accountAddress;
}

// module.exports = { createSmartAccount }

async function main() {
    const secret = "hello world";
    const countId = 0;
    const commitment = await computePedersenHash(secret + countId);
    await createSmartAccount(commitment);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });