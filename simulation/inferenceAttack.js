const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const NUM_USERS = 10;
const { alchemyProvider, signer } = require('../scripts/constants');
const { getCommitmentVerifierAddress, getVerifyingPaymsaterAddress } = require('../scripts/isDeployed');
const { computePedersenHash, groth16ExportSolidityCallData } = require("../scripts/utils");
const { createSmartAccount, getSender } = require('../scripts/userManagement/createSmartAccount');
const { calculateLeaf, registerUserWithLeaf, generateProof } = require('../scripts/registerUser');
const { getUserOpHash, getDefaultUserOp, getCallData, fillUserOp, packUserOp } = require('../scripts/userOp');
const ffjavascript = require("ffjavascript");
const entryPointAbi = JSON.parse(fs.readFileSync("abi/entryPoint.json", "utf8")).abi;

const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'
const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT;

const wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
const zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");



const walletsFilePath = "./simulation/wallets.json";


function generateWallets(num_users) {

    if (fs.existsSync(walletsFilePath)) {
        console.log("wallets.json already exists. Aborting wallet generation to avoid overwriting.");
        console.log("If you want to regenerate the wallets, please delete the existing wallets.json file.");
        return;
    }
    const wallets = [];

    for (let i = 0; i < num_users; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            index: i,
            address: wallet.address,
            privateKey: wallet.privateKey
        });
    }

    fs.writeFileSync(walletsFilePath, JSON.stringify(wallets));
}


async function createAndRegisterSmartWallets() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {
        const commitment = await computePedersenHash(wallet.secret);

        const address = await getSender(commitment, 1);
        await createSmartAccount(commitment);
        console.log("Smart account created at address:", address);
        wallet.smartAccountAddress = address;

        // register a user
        const nullifier = 0n;
        const leafToInsert = await calculateLeaf(address, wallet.secret, nullifier);
        await registerUserWithLeaf(leafToInsert);
        console.log("User registered");
    }
    fs.writeFileSync(walletsFilePath, JSON.stringify(wallets, null, 2));
    console.log("Updated wallets.json with smart account addresses.");
}

function generateSecrets() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    let updated = false;
    for (let wallet of wallets) {

        if (!wallet.secret) {
            const secret = "secret" + wallet.index;
            wallet.secret = secret;
            updated = true;
        }
    }

    if (updated) {
        fs.writeFileSync(walletsFilePath, JSON.stringify(wallets));
        console.log("Secrets generated and saved to wallets.json");
    } else {
        console.log("Secrets already exist. No changes made.");
    }
}

async function fund() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));

    for (let w of wallets) {
        const tx = await signer.sendTransaction({
            to: w.address,
            value: ethers.parseEther("0.1")
        });

        const balance = await alchemyProvider.getBalance(w.address);

        console.log(`Funded wallet ${w.index} at ${w.address} with 0.1 Token and balance is ${ethers.formatEther(balance)}`);

        await tx.wait();
    }
}

async function deployUserDataWithSmartAccount() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));
    for (let wallet of wallets) {
        const secret = wallet.secret;
        const encodedMessage = new TextEncoder().encode(secret);
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);
        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);
        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);
        const proof = serializedProofandPublicSignals

        const myAccountAddress = wallet.smartAccountAddress;
        const myAccount = await ethers.getContractAt("MyAccount", myAccountAddress);

        const runnerAddress = myAccountAddress;
        const runner = myAccount;

        const paymaster = await getVerifyingPaymsaterAddress();
        const userOperation = getDefaultUserOp(runnerAddress, paymaster);

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

        // const tx = await myAccount.verifyOwnership(serializedProofandPublicSignals);
        // const receipt = await tx.wait();


        // const filter = myAccount.filters.OwnershipVerified();
        // const events = await myAccount.queryFilter(filter);
        // console.log(events)

        break;
    }
}

async function deployUserDataContractWithPrivacy() {
    const secret = "hello my world";
    const countId = 0;
    const accountCommitment = await computePedersenHash(secret + countId);
    // Create smart account for the user baesd on the secret
    const salt = 1;
    const accountAddress = await getSender(accountCommitment, salt);

    await createSmartAccount(accountCommitment); // in this function, the salt is hardcoded to 1. It should be input as a parameter, but now I have no time to change it
    console.log("Smart account created at address:", accountAddress);

    // Register the user
    const nullifier = 0n;
    const leafToInsert = await calculateLeaf(accountAddress, secret, nullifier);
    await registerUserWithLeaf(leafToInsert);
    console.log("User registered");

    const proof = await generateProof(accountAddress, secret, nullifier);
    console.log("Proof generated: ", proof);

    const senderAddress = accountAddress;
    const sender = await ethers.getContractAt("MyAccount", senderAddress);
    const paymaster = await getVerifyingPaymsaterAddress();
    const userOperation = getDefaultUserOp(senderAddress, paymaster);

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

    const packedUserOp = packUserOp(userOp1);
    const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);

    const sig = await signer.signMessage(ethers.getBytes(hash));

    const UserOp = await fillUserOp({
        ...userOperation,
        paymaster: verifyingPaymasterAddress,
        paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])

    }, entryPoint)


    UserOp.nonce = "0x" + UserOp.nonce.toString();

    const tx = await runner.preVerifySignature(userOperation.signature, userOpHashLocal);
    await tx.wait();
    console.log("User operation signature verified");

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

async function deployUserDataContractTraditional(wallet) {
    const secret = wallet.secret;

    const encodedMessage = new TextEncoder().encode(secret);
    const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

    // const commitment = await computePedersenHash(secret);
    // const signer = new ethers.Wallet(wallet.privateKey, alchemyProvider);


    // const UserDataContract = await ethers.getContractFactory("UserData", signer);
    // const verifierAddress = await getCommitmentVerifierAddress();

    // const contract = await UserDataContract.deploy(verifierAddress, commitment, "My User Data");
    // await contract.waitForDeployment();
    // console.log(`Deployed UserData contract for wallet ${signer.address} at ${contract.target}`);
    // return contract.target;
}

async function deployUserDataContractTraditionalBatch() {
    const wallets = JSON.parse(fs.readFileSync(walletsFilePath));

    for (let w of wallets) {
        const signer_wallet = new ethers.Wallet(w.privateKey, alchemyProvider);

        const secret = w.secret;
        const commitment = await computePedersenHash(secret);

        const deployedAddress = await deployUserDataContractTraditional(commitment, signer_wallet);
        console.log(`Deployed UserData contract for wallet ${w.index} at ${deployedAddress}`);

        // const UserData = await ethers.getContractFactory("UserData", signer_wallet);
        // const contract = await UserData.deploy(verifierAddress, commitment, "My User Data");
        // await contract.waitForDeployment();

        // console.log(`Deployed UserData contract for wallet ${w.index} at ${contract.target}`);
        // break;
    }
}

async function main() {
    // generateWallets(NUM_USERS);
    // generateSecrets();
    // await fund();
    // await deployUserDataContractTraditionalBatch();
    // await deployUserDataContractWithPrivacy();
    // await createAndRegisterSmartWallets();
    await deployUserDataWithSmartAccount();
}

main().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

