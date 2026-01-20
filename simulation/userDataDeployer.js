const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { alchemyProvider, signer } = require('../scripts/constants');
const { getCommitmentVerifierAddress, getVerifyingPaymsaterAddress, getFirstRunnerAddress } = require('../scripts/deploy/isDeployed');
const { computePedersenHash, groth16ExportSolidityCallData } = require("../scripts/utils");
const { createSmartAccount, getSender } = require('../scripts/userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('../scripts/registerUser');
const { getUserOpHash, getDefaultUserOp, getCallData, fillUserOp, packUserOp } = require('../scripts/userOp');
const { waitForUserOperationToBePacked, waitForTransactionToBeMined, sendUserOperationToBundler } = require('./bundlerUtils');
const { 
    MOCK_VALID_UNTIL, 
    MOCK_VALID_AFTER, 
    ENTRY_POINT_ADDRESS, 
    wasm, 
    zkey, 
    walletsFilePath 
} = require('./constants');

const ffjavascript = require("ffjavascript");
const { ZeroAddress } = require("ethers");
const { c } = require("circom_tester");
const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;

async function generateUserCommitmentProof(secret) {
    const encodedMessage = new TextEncoder().encode(secret);
    const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);
    const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);
    let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
    const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);
    return serializedProofandPublicSignals
}

async function signUserOpByAdmin(hash) {
    const sig = await signer.signMessage(ethers.getBytes(hash));
    return sig;
}

async function updateUserDataWithPrivacySingle(secret, smartAccountAddress, userDataAddress, nullifier = 0n) {
    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);

    const paymaster = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(runnerAddress, paymaster);
    // userOperation.preVerificationGas = ethers.toBeHex(BigInt(userOperation.preVerificationGas) * 20n);
    userOperation.verificationGasLimit = ethers.toBeHex(BigInt(userOperation.verificationGasLimit) / 2n);

    const proof = await generateProof(smartAccountAddress, secret, nullifier); // generate registration proof
    userOperation.signature = proof;

    const contractName = "UserData";
    const userDataFactory = await ethers.getContractFactory(contractName);
    const userDataInterface = userDataFactory.interface;
    const userDataCommitmentProof = await generateUserCommitmentProof(secret + contractName);

    const updateFunc = userDataInterface.encodeFunctionData("update", ["new data", userDataCommitmentProof]);
    const updateUserDataCallData = getCallData(userDataAddress, 0, updateFunc);
    userOperation.callData = updateUserDataCallData;


    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    const packedUserOp = packUserOp(userOp1);

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);
    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
    const sig = await signUserOpByAdmin(hash); // Admin sign the UserOp to request the paymaster to pay

    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)

    UserOp.nonce = ethers.toBeHex(UserOp.nonce);
    console.log("User operation:", UserOp);
    // delete UserOp.initCode

    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");

    const currentBlock = await alchemyProvider.getBlockNumber();

    try {
        const data = await sendUserOperationToBundler(UserOp);
        console.log(data);
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}

async function updateUserDataWithSmartAccount(secret, smartAccountAddress, userDataAddress) {
    // get runner
    const myAccountAddress = smartAccountAddress;
    const myAccount = await ethers.getContractAt("MyAccount", myAccountAddress);

    const runnerAddress = myAccountAddress;
    const runner = myAccount;

    const paymasterAddress = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(runnerAddress, paymasterAddress);
    userOperation.preVerificationGas = ethers.toBeHex(BigInt(userOperation.preVerificationGas) * 20n);
    userOperation.verificationGasLimit = ethers.toBeHex(BigInt(userOperation.verificationGasLimit) * 4n);

    // generate user commitment proof to execute the user operation
    const proof = await generateUserCommitmentProof(secret);
    userOperation.signature = proof;

    const contractName = "UserData";
    const userDataFactory = await ethers.getContractFactory(contractName);
    const userDataInterface = userDataFactory.interface;
    const userDataCommitmentProof = await generateUserCommitmentProof(secret + contractName);
    // const userDataCommitmentProof = proof;


    const updateFunc = userDataInterface.encodeFunctionData("update", ["new data", userDataCommitmentProof]);
    const updateUserDataCallData = getCallData(userDataAddress, 0, updateFunc);
    userOperation.callData = updateUserDataCallData;

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    const packedUserOp = packUserOp(userOp1);

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);
    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
    const sig = await signUserOpByAdmin(hash); // Admin sign the UserOp to request the paymaster to pay

    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)

    UserOp.nonce = ethers.toBeHex(UserOp.nonce);
    // console.log("User operation:", UserOp);
    // delete UserOp.initCode

    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");

    const currentBlock = await alchemyProvider.getBlockNumber();

    try {
        const data = await sendUserOperationToBundler(UserOp);
        console.log(data);
        if (data.result) {
            const uoHash = data.result;
            console.log("User Operation hash:", uoHash);
            const txHash = await waitForUserOperationToBePacked(uoHash);
            console.log("Transaction hash:", txHash);

            const receipt = await waitForTransactionToBeMined(txHash);
        }
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}

async function deployUserDataWithSmartAccountSingle(secret, smartAccountAddress) {

    // get runner
    const myAccountAddress = smartAccountAddress;
    const myAccount = await ethers.getContractAt("MyAccount", myAccountAddress);

    const runnerAddress = myAccountAddress;
    const runner = myAccount;

    const paymasterAddress = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(runnerAddress, paymasterAddress);
    userOperation.preVerificationGas = ethers.toBeHex(BigInt(userOperation.preVerificationGas) * 20n);
    userOperation.verificationGasLimit = ethers.toBeHex(BigInt(userOperation.verificationGasLimit) * 4n);

    // generate user commitment proof to execute the user operation
    const proof = await generateUserCommitmentProof(secret);
    userOperation.signature = proof;

    // callData of deploying a UserData contract
    const contractName = "UserData";
    const userDataContract = await ethers.getContractFactory(contractName);
    const verifierAddress = await getCommitmentVerifierAddress();
    const commitment = await computePedersenHash(secret + contractName);
    // const commitment = await computeDomainSeparateCommitment(secret, contractName);
    const deployUserData = await userDataContract.getDeployTransaction(verifierAddress, commitment, "My User Data");
    const deployFunc = deployUserData.data;
    const userDataCallData = getCallData(ZeroAddress, 0, deployFunc);

    userOperation.callData = userDataCallData;

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    const packedUserOp = packUserOp(userOp1);

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);
    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
    const sig = await signUserOpByAdmin(hash); // Admin sign the UserOp to request the paymaster to pay

    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)

    UserOp.nonce = ethers.toBeHex(UserOp.nonce);
    // console.log("User operation:", UserOp);
    // delete UserOp.initCode

    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");

    const currentBlock = await alchemyProvider.getBlockNumber();

    try {
        const data = await sendUserOperationToBundler(UserOp);

        if (data.result) {
            const uoHash = data.result;
            console.log("User Operation hash:", uoHash);
            const txHash = await waitForUserOperationToBePacked(uoHash);
            console.log("Transaction hash:", txHash);

            const receipt = await waitForTransactionToBeMined(txHash);
        }
    }
    catch (error) {
        console.error(error);
        throw error;
    }

    // Wait for the ContractDeployed event
    const filter = myAccount.filters.ContractDeployed();
    let events = [];
    let retries = 15;

    while (retries > 0) {
        const latestBlock = await alchemyProvider.getBlockNumber();
        events = await myAccount.queryFilter(filter, currentBlock, latestBlock);
        if (events.length > 0) break;

        console.log("Waiting for ContractDeployed event...");
        await new Promise(res => setTimeout(res, 3000));
        retries--;
    }

    if (events.length === 0) {
        console.log("Event not found after retries.");
    }
    const event = events[events.length - 1];
    const userDataAddress = event.args[0];
    return userDataAddress;
}

async function deployUserDataWithSmartAccount() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {
        await deployUserDataWithSmartAccountSingle(wallet.secret, wallet.smartAccountAddress);
        break; // Remove this line to deploy for all wallets
    }
}

async function deployUserDataContractWithPrivacySingle(secret, smartAccountAddress, nullifier = 0n) {
    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);

    const paymaster = await getVerifyingPaymsaterAddress();

    const userOperation = getDefaultUserOp(runnerAddress, paymaster);
    // userOperation.preVerificationGas = ethers.toBeHex(BigInt(userOperation.preVerificationGas));
    userOperation.verificationGasLimit = ethers.toBeHex(BigInt(userOperation.verificationGasLimit) / 2n);

    const proof = await generateProof(smartAccountAddress, secret, nullifier); // generate registration proof
    userOperation.signature = proof;

    // callData of deploying a UserData contract
    const contractName = "UserData";
    const userDataContract = await ethers.getContractFactory(contractName);
    const verifierAddress = await getCommitmentVerifierAddress();
    const commitment = await computePedersenHash(secret + contractName);
    const deployUserData = await userDataContract.getDeployTransaction(verifierAddress, commitment, "My User Data");
    const deployFunc = deployUserData.data;
    const userDataCallData = getCallData(ZeroAddress, 0, deployFunc);
    userOperation.callData = userDataCallData;

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    const packedUserOp = packUserOp(userOp1);

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);
    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
    const sig = await signUserOpByAdmin(hash); // Admin sign the UserOp to request the paymaster to pay

    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)

    UserOp.nonce = ethers.toBeHex(UserOp.nonce);
    // delete UserOp.initCode

    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");

    const currentBlock = await alchemyProvider.getBlockNumber();

    try {
        const data = await sendUserOperationToBundler(UserOp);
        console.log(data);
    }
    catch (error) {
        console.error(error);
        throw error;
    }

    // Wait for the ContractDeployed event
    const filter = runner.filters.ContractDeployed();
    let events = [];
    let retries = 15;

    while (retries > 0) {
        const latestBlock = await alchemyProvider.getBlockNumber();
        events = await runner.queryFilter(filter, currentBlock, latestBlock);
        if (events.length > 0) break;

        console.log("Waiting for ContractDeployed event...");
        await new Promise(res => setTimeout(res, 3000));
        retries--;
    }

    if (events.length === 0) {
        console.log("Event not found after retries.");
    } else {
        console.log("New event(s):", events);
    }
    const event = events[events.length - 1];
    const userDataAddress = event.args[0];
    return userDataAddress;

}

async function deployUserDataContractWithPrivacy() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {
        const secret = wallet.secret;
        const nullifier = 0n;
        const accountAddress = wallet.smartAccountAddress;
        const proof = await generateProof(accountAddress, secret, nullifier);

        const runnerAddress = await getFirstRunnerAddress();
        const runner = await ethers.getContractAt("Runner", runnerAddress);

        const paymaster = await getVerifyingPaymsaterAddress();
        const userOperation = getDefaultUserOp(runnerAddress, paymaster);

        userOperation.signature = proof;


        // callData of deploying a UserData contract
        const userDataContract = await ethers.getContractFactory("UserData");
        const verifierAddress = await getCommitmentVerifierAddress();
        const commitment = await computePedersenHash(secret);
        const deployUserData = await userDataContract.getDeployTransaction(verifierAddress, commitment, "My User Data");
        const deployFunc = deployUserData.data;
        const userDataCallData = getCallData(ZeroAddress, 0, deployFunc);
        // callData 
        // const counterAddress = "0x59d0d591b90ac342752ea7872d52cdc3c573ab71"
        // const counterContract = await ethers.getContractAt("Counter", counterAddress);
        // const func = counterContract.interface.encodeFunctionData("increment");
        // // const func = counterContract.interface.encodeFunctionData("increment", [arg1, arg2]);// if the function has arguments
        // const callData = getCallData(counterAddress, 0, func);
        // userOperation.callData = callData;
        userOperation.callData = userDataCallData;

        const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
        const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);

        const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
        const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');

        const packedUserOp = packUserOp(userOp1);

        const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);

        const sig = await signer.signMessage(ethers.getBytes(hash));
        console.log("userOperation", userOperation);
        // delete userOperation.nonce;
        const UserOp = await fillUserOp({
            ...userOperation,
            paymaster: verifyingPaymasterAddress,
            paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

        }, entryPoint)


        UserOp.nonce = "0x" + UserOp.nonce.toString();
        console.log("User operation:", UserOp);
        // delete UserOp.initCode

        // get user operation hash
        // const userOpHash = await entryPoint.getUserOpHash(packUserOp(UserOp));
        // console.log("User operation hash:", userOpHash);

        const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
        console.log("User operation hash local:", userOpHashLocal);

        const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
        await tx.wait();
        console.log("User operation signature verified");

        const currentBlock = await alchemyProvider.getBlockNumber();

        try {
            const data = await sendUserOperationToBundler(UserOp);
            console.log(data);
        }
        catch (error) {
            console.error(error);
            throw error;
        }

        const filter = runner.filters.ContractDeployed();
        let events = [];
        let retries = 15;

        while (retries > 0) {
            const latestBlock = await alchemyProvider.getBlockNumber();
            events = await runner.queryFilter(filter, currentBlock, latestBlock);  // 限制起始区块
            if (events.length > 0) break;

            console.log("Waiting for ContractDeployed event...");
            await new Promise(res => setTimeout(res, 3000));
            retries--;
        }

        if (events.length === 0) {
            console.log("Event not found after retries.");
        } else {
            console.log("New event(s):", events);
        }
        const event = events[events.length - 1];
        const userDataAddress = event.args[0];
        console.log("UserData contract deployed at address:", userDataAddress);

        break;
    }

}

module.exports = {
    deployUserDataWithSmartAccount,
    deployUserDataContractWithPrivacy,
    deployUserDataWithSmartAccountSingle,
    deployUserDataContractWithPrivacySingle,
    updateUserDataWithSmartAccount,
    updateUserDataWithPrivacySingle
}