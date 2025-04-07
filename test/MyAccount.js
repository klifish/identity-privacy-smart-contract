const path = require("path");
const snarkjs = require("snarkjs");

const { expect } = require("chai");
const { ethers } = require("hardhat");
const ffjavascript = require("ffjavascript");
const { fillUserOpDefaults, parseProof, computePedersenHash } = require("../scripts/utils");
const { groth16ExportSolidityCallData } = require("../scripts/utils");
const e = require("express");

describe('MyAccount Smart Contract', function () {
    const commitmentValue = 42;
    const secret = "secret";
    const countIdInitial = 0;
    const salt = 1;
    let accounts;
    let entryPoint;
    let verifier;
    let myAccountFactory
    let myAccount

    before(async () => {
        const EntryPointFactoryContract = await ethers.getContractFactory("EntryPointFactory");
        entryPointFactory = await EntryPointFactoryContract.deploy();

        entryPointFactoryAddress = await entryPointFactory.getAddress();
    });

    it("Should deploy the Verifier", async () => {
        const VerifierContract = await ethers.getContractFactory("CommitmentGroth16Verifier");
        verifier = await VerifierContract.deploy();

        const verifierAddress = await verifier.getAddress();

        expect(verifierAddress).to.be.a.properAddress;
    });

    it("Should deploy the EntryPoint", async () => {
        const EntryPointFactoryContract = await ethers.getContractFactory("EntryPointFactory");
        entryPointFactory = await EntryPointFactoryContract.deploy();

        await entryPointFactory.deployEntryPoint();

        const filter = entryPointFactory.filters.EntryPointDeployed();
        const events = await entryPointFactory.queryFilter(filter);

        entryPoint = events[0].args.entryPointAddress;

        expect(events.length).to.be.equal(1);
        expect(events[0].args.entryPointAddress).to.be.a.properAddress;

    });

    it("Should deploy the MyAccountFactory", async () => {
        const MyAccountFactoryContract = await ethers.getContractFactory("MyAccountFactory");
        myAccountFactory = await MyAccountFactoryContract.deploy(entryPoint, await verifier.getAddress(), 0);

        const myAccountFactoryAddress = await myAccountFactory.getAddress();

        expect(myAccountFactoryAddress).to.be.a.properAddress;

        const accountImplementationAddress = await myAccountFactory.accountImplementation();
        expect(accountImplementationAddress).to.be.a.properAddress;
    });

    it("Should get different account addresses for different salts", async () => {
        const commitment1 = await computePedersenHash(secret);
        const commitment2 = await computePedersenHash(secret + "1")

        const salt1 = 1;
        const salt2 = 2;

        // getAddress function in ethers contract class overides the function in the contract
        const accountAddress = await myAccountFactory.getAddress(commitment1, salt1);

        const accountAddress1 = await myAccountFactory.getAddress(commitment1, salt2);

        const accountAddress2 = await myAccountFactory.getAddress(commitment2, salt1);

        const accountAddress3 = await myAccountFactory.getAddress(commitment2, salt2);
    });

    it("Should create a new MyAccount", async () => {

        const commitment = await computePedersenHash(secret + countIdInitial);
        const salt = 1;

        await myAccountFactory.createAccount(commitment, salt);

        let filter = myAccountFactory.filters.AccountCreated();
        let events = await myAccountFactory.queryFilter(filter);
        const eventLength1 = events.length;

        const MyAccount = await ethers.getContractFactory("MyAccount");
        myAccount = MyAccount.attach(events[events.length - 1].args.accountAddress);

        const entryPointAddress = await myAccount.entryPoint();
        expect(entryPointAddress).to.be.equal(entryPoint);

        // Try to create another account with the same commitment and salt
        await myAccountFactory.createAccount(commitment, salt);
        filter = myAccountFactory.filters.AccountCreated();
        events = await myAccountFactory.queryFilter(filter);
        const eventLength2 = events.length;
        expect(eventLength2).to.be.equal(eventLength1); // No more new account should be created

        // Try to create another account with same commitment and different salt
        const saltNew = 2;
        await myAccountFactory.createAccount(commitment, saltNew);
        filter = myAccountFactory.filters.AccountCreated();
        events = await myAccountFactory.queryFilter(filter);
        const eventLength3 = events.length;
        expect(eventLength3).to.be.equal(eventLength2 + 1); // More new account should be created


        // Try to create another account with different commitment and same salt
        const commitmentNew = await computePedersenHash(secret + "1" + countIdInitial);
        await myAccountFactory.createAccount(commitmentNew, salt);
        filter = myAccountFactory.filters.AccountCreated();
        events = await myAccountFactory.queryFilter(filter);
        const eventLength4 = events.length;
        expect(eventLength4).to.be.equal(eventLength3 + 1); // More new account should be created

    });

    it("Should be able to verify the ownership of the account", async () => {

        wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
        zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");

        const encodedMessage = new TextEncoder().encode(secret + "0");
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);

        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);
        const tx = await myAccount.verifyOwnership(serializedProofandPublicSignals);
        const receipt = await tx.wait();


        const filter = myAccount.filters.OwnershipVerified();
        const events = await myAccount.queryFilter(filter);
        expect(events[0].args.isValid).to.be.true;

    })

    it("Should be able to update the commitment", async () => {
        const countId = await myAccount.GetCountId();
        // generate proof
        wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
        zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");

        const encodedMessage = new TextEncoder().encode(secret + (Number(countId) - 1));
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);
        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);

        // update commitment
        const commitmentOld = await myAccount.GetCommitment();

        const commitmentToBeUpdated = await computePedersenHash(secret + countId);

        await myAccount.UpdateCommitment(proof, commitmentToBeUpdated)

        const commitmentUpdated = await myAccount.GetCommitment();

        expect(commitmentUpdated).to.be.equal(commitmentToBeUpdated);
        expect(commitmentOld).to.be.not.equal(commitmentUpdated);

    });

    // it("Should not be able to use the same proof twice", async () => {
    //     const countId = await myAccount.GetCountId();
    //     // generate proof
    //     wasm = path.join(__dirname, "..", "build", "circuits", "commitment_js", "commitment.wasm");
    //     zkey = path.join(__dirname, "..", "build", "circuits", "commitment_final.zkey");

    //     const encodedMessage = new TextEncoder().encode(secret + (Number(countId) - 1));
    //     const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

    //     const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);
    //     let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
    //     const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);

    //     // verify the proof for the first time
    //     const tx = await myAccount.verifyOwnership(proof);
    //     const receipt = await tx.wait();

    //     // verify the proof for the second time
    //     try {
    //         await myAccount.verifyOwnership(proof);
    //         // expect.fail("Should have thrown an error");
    //     } catch (error) {
    //         expect(error.message).to.contain("Proof already verified");
    //     }
    // });

    it('Should be able to call transfer', async () => {

        // signer -> myAccount -> signer1
        const signer = await ethers.provider.getSigner(0);
        const signer1 = await ethers.provider.getSigner(1);
        myAccountAddress = await myAccount.getAddress();

        // Send 10 ETH to myAccount
        tx = await signer.sendTransaction({
            to: myAccountAddress,
            value: ethers.parseEther("10")
        });

        receipt = await tx.wait();

        // Send 1 ETH from myAccount to signer1
        const balanceBefore = await ethers.provider.getBalance(signer1.address);
        tx = await myAccount.execute(signer1.address, ethers.parseEther("1"), '0x');
        receipt = await tx.wait();

        const balanceAfter = await ethers.provider.getBalance(signer1.address);
        expect(balanceAfter - balanceBefore).to.be.equal(ethers.parseEther("1"));
    })

    it('Should be able to deploy a new contract', async () => {
        const signer = await ethers.provider.getSigner(0);
        myAccountAddress = await myAccount.getAddress();

        tx = await signer.sendTransaction({
            to: myAccountAddress,
            value: ethers.parseEther("10")
        });

        const userDataContract = await ethers.getContractFactory("UserData");
        const verifierAddress = await verifier.getAddress();
        const secret = "secret";
        const commitment = await computePedersenHash(secret);
        const deployUserData = await userDataContract.getDeployTransaction(verifierAddress, commitment, "My User Data");
        const userData = deployUserData.data;
        const func = userData;

        tx = await myAccount.execute(ethers.ZeroAddress, ethers.parseEther("0"), func);
        await tx.wait();
        // console.log("receipt", receipt.logs);

        const filter = myAccount.filters.ContractDeployed();
        const events = await myAccount.queryFilter(filter);
        console.log("Events:", events);

    });
});