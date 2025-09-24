// interact.js
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const { ethers } = require("hardhat");
const utils = require('./utils');
const { createSmartAccount, getSender } = require('./userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('./registerUser');
const { getVerifyingPaymsaterAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./isDeployed');
const { getUserOpHash, fillAndSign, packUserOp, fillAndPcak, simulateValidation, fillUserOp, getDefaultUserOp, getCallData } = require('../scripts/userOp');
const fs = require("fs");
const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT;
const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;
const { alchemyProvider, signer } = require('./constants');
const { get } = require("http");

async function main() {
    // user choose a secret
    const secret = "hello my world";
    const countId = 0;
    const commitment = await utils.computePedersenHash(secret + countId);
    const address = await getSender(commitment, 1);
    await createSmartAccount(commitment);
    console.log("Smart account created at address:", address);

    // register a user
    const nullifier = 0n;
    const leafToInsert = await calculateLeaf(address, secret, nullifier);
    await registerUserWithLeaf(leafToInsert);
    console.log("User registered");


    // prepare user operation
    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);
    const paymaster = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(runnerAddress, paymaster);
    // userOperation.verificationGasLimit = ethers.toBeHex(100000n);
    // userOperation.paymasterVerificationGasLimit = ethers.toBeHex(50000n);


    // generate registry proof
    const proof = await generateProof(address, secret, nullifier);
    console.log("Proof generated: ", proof);
    userOperation.signature = proof;

    // callData 
    const counterAddress = "0x59d0d591b90ac342752ea7872d52cdc3c573ab71"
    const counterContract = await ethers.getContractAt("Counter", counterAddress);
    const func = counterContract.interface.encodeFunctionData("increment");
    // const func = counterContract.interface.encodeFunctionData("increment", [arg1, arg2]);// if the function has arguments
    const callData = getCallData(counterAddress, 0, func);
    userOperation.callData = callData;

    const verifyingPaymasterAddress = await getVerifyingPaymsaterAddress();
    const verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", verifyingPaymasterAddress);

    const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, entryPointAbi, alchemyProvider);
    const userOp1 = await fillUserOp(userOperation, entryPoint, 'getNonce');
    // console.log("User operation:", userOp1.paymasterData);

    const packedUserOp = packUserOp(userOp1);
    // console.log("Packed user operation:", packedUserOp);

    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);

    const sig = await signer.signMessage(ethers.getBytes(hash));
    // console.log("userOperation", userOperation);
    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)



    console.log("User operation nonce:", UserOp.nonce);
    UserOp.nonce = ethers.toBeHex(UserOp.nonce);
    console.log("User operation:", UserOp);
    // delete UserOp.initCode

    // get user operation hash
    const userOpHash = await entryPoint.getUserOpHash(packUserOp(UserOp));
    console.log("User operation hash:", userOpHash);


    const userOpHashLocal = getUserOpHash(UserOp, ENTRY_POINT_ADDRESS, 80002);
    console.log("User operation hash local:", userOpHashLocal);

    runner.once("ValidateSignature", (userOpHash, proofHash, result, event) => {
        console.log("Caught ValidateSignature:", userOpHash, proofHash, result);
    });
    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.hash);
    console.log("User operation signature pre-verified", receipt.blockNumber);

    const options1 = {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_sendUserOperation',
            params: [UserOp, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
        })
    };

    try {

        const response = await fetch('https://polygon-amoy.g.alchemy.com/v2/VG6iwUaOlQPYcDCb3AlkyAxrAXF7UzU9', options1)
        // console.log("response:", response);
        const data = await response.json();
        console.log(data);
    }
    catch (error) {
        console.error(error);
        throw error;
    }

    const events = await runner.queryFilter("ValidateSignature");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });