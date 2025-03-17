const { ethers } = require('hardhat');
const { getVerifyingPaymsaterAddress } = require('./isDeployed.js');

async function play() {
    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    console.log("verifyingPaymasterAddress", verifyingPaymasterAddress);

    const paymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);
    const owner = await paymaster.owner();
    console.log("paymaster owner", owner);


    // const deposit = await paymaster.deposit({ value: ethers.parseEther("1") });
    // await deposit.wait();

    // const getDeposit = await paymaster.getDeposit();

    // const withdrawTo = await paymaster.withdrawTo(owner, getDeposit);
    // await withdrawTo.wait();

    const addStake = await paymaster.addStake(90000);
    await addStake.wait();

    // const unlockStake = await paymaster.unlockStake();
    // await unlockStake.wait();

    // const withdrawStake = await paymaster.withdrawStake(owner);
    // await withdrawStake.wait();
}

play()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

