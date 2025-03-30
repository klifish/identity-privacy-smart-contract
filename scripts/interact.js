// interact.js
const API_URL = process.env.API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const { ethers } = require("hardhat");
const utils = require('./utils');
const { createSmartAccount, getSender } = require('./userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('./registerUser');
const { getVerifyingPaymsaterAddress, getFirstRunnerAddress, getAccountFactoryAddress } = require('./isDeployed');
const { fillAndSign, packUserOp, fillAndPcak, simulateValidation, fillUserOp } = require('../scripts/userOp');
const fs = require("fs");
const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT;
const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;
const { alchemyProvider, signer } = require('./constants');
// const alchemyProvider = new ethers.JsonRpcProvider(API_URL);
// const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

// // provider - Alchemy
// const alchemyProvider = new ethers.providers.JsonRpcProvider(API_URL);

// // signer - you
// const signer = new ethers.Wallet(PRIVATE_KEY, alchemyProvider);

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

    // generate proof
    const proof = await generateProof(address, secret, nullifier);
    console.log("Proof generated: ", proof);

    // prepare user operation
    const runnerAddress = await getFirstRunnerAddress();
    const runner = await ethers.getContractAt("Runner", runnerAddress);
    const paymaster = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(runnerAddress, paymaster);

    userOperation.signature = proof;
    const tx = await runner.preVerifySignature(userOperation.signature);
    await tx.wait();
    console.log("User operation signature verified");

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
    console.log("userOperation", userOperation);
    // delete userOperation.nonce;
    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)


    UserOp.nonce = "0x" + UserOp.nonce.toString();
    console.log("User operation:", UserOp);
    delete UserOp.initCode

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




}

function getCallData(dest, value, func) {
    const runnerExecuteInterfact = new ethers.Interface([
        "function execute(address dest,uint256 value,bytes calldata func) external"
    ]);

    const callData = runnerExecuteInterfact.encodeFunctionData("execute", [dest, value, func]);
    return callData;
}

function getDefaultUserOp(sender, paymaster) {
    return {
        sender: sender,
        callData: "0xb61d27f600000000000000000000000043f6bfbe9dad44cf0a60570c30c307d949be4cd40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000645c833bfd000000000000000000000000613c64104b98b048b93289ed20aefd80912b3cde0000000000000000000000000000000000000000000000000de123e8a84f9901000000000000000000000000c9371ea30dea5ac745b71e191ba8cde2c4e66df500000000000000000000000000000000000000000000000000000000",
        callGasLimit: "0x7A1200",
        verificationGasLimit: "0x927C0",
        preVerificationGas: "0x15F90",
        maxFeePerGas: "0x956703D00",
        maxPriorityFeePerGas: "0x13AB668000",
        paymasterVerificationGasLimit: "0x927C0",
        paymasterPostOpGasLimit: "0x927C0",
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
        paymaster: paymaster,
        paymasterData: ethers.concat(
            [
                ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
                '0x' + '00'.repeat(65)
            ]
        )
    }
}
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });