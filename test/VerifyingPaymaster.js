const { expect } = require("chai");
const { ethers } = require("hardhat");
const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight } = require('../scripts/utilities/hasher');
const { buildZeros } = require('../scripts/buildZeros');
const utils = require('../scripts/utils');
const path = require('path');
const snarkjs = require("snarkjs");
const { fillAndSign, packUserOp, fillSignAndPack, simulateValidation } = require('../scripts/userOp');

const SEED = "mimcsponge";
const MOCK_VALID_UNTIL = '0x00000000deadbeef'
const MOCK_VALID_AFTER = '0x0000000000001234'

describe("VerifyingPaymaster", function () {
    let offchainSigner;
    let entryPoint;
    let verifyingPaymasterFactory;

    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL

    let pedersen;
    let babyjub;
    let F

    let hasher;
    let RegisterVerifierContract;
    let registerVerifier;

    let RegistryContract;
    let registry

    let HasherContract;
    let hasherOnChain;

    let leafToInsert;
    let treeOffChain;

    before(async function () {
        offchainSigner = (await ethers.getSigners())[0];

        hasher = await setupHasher();
        RegisterVerifierContract = await ethers.getContractFactory("RegisterGroth16Verifier");
        RegistryContract = await ethers.getContractFactory("MerkleRegistry")
        pedersen = await circomlibjs.buildPedersenHash();
        babyjub = await circomlibjs.buildBabyjub();
        F = babyjub.F;

        const signers = await ethers.getSigners();
        const signer0 = signers[0];
        address0 = "0xECc88Cc6a3c93AD477C6b72A486C14653803D044";

        const secret = "hello world"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 0n;

        const src = [address0, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])
        leafToInsert = hp1;
    });

    it("Should deploy a hasher on chain", async () => {
        const signers = await ethers.getSigners();
        const signer = signers[0];

        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        HasherContract = new ethers.ContractFactory(
            abi,
            bytecode,
            signer
        );

        hasherOnChain = await HasherContract.deploy();

        const contractAddress = await hasherOnChain.getAddress();
        expect(contractAddress).to.be.properAddress;

    });

    it('Should deploy RegisterVerifier smart contract', async function () {
        registerVerifier = await RegisterVerifierContract.deploy();
        const contractAddress = await registerVerifier.getAddress();

        expect(contractAddress).to.be.properAddress;
    });

    it('Should deploy the Registry smart contract', async function () {
        const hasherOnChainAddress = await hasherOnChain.getAddress();
        const verifierAddress = await registerVerifier.getAddress();
        registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherOnChainAddress, verifierAddress);

        const registryAddress = await registry.getAddress();
        expect(registryAddress).to.be.properAddress;
        const levels = await registry.getLevels();
        expect(levels).to.equal(MERKLE_TREE_LEVEL);
    })

    it("Should deploy the EntryPoint", async () => {
        const EntryPointFactoryContract = await ethers.getContractFactory("EntryPointFactory");
        entryPointFactory = await EntryPointFactoryContract.deploy();

        await entryPointFactory.deployEntryPoint();

        const filter = entryPointFactory.filters.EntryPointDeployed();
        const events = await entryPointFactory.queryFilter(filter);

        entryPointAddress = events[0].args.entryPointAddress;
        entryPoint = await ethers.getContractAt("EntryPoint", entryPointAddress);

        expect(events.length).to.be.equal(1);
        expect(events[0].args.entryPointAddress).to.be.a.properAddress;

    });

    it("Should deploy the RunnerFactory", async () => {
        const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory");
        const registryAddress = await registry.getAddress()
        runnerFactory = await RunnerFactoryContract.deploy(await entryPoint.getAddress(), registryAddress);

        const runnerFactoryAddress = await runnerFactory.getAddress();
        expect(runnerFactoryAddress).to.be.a.properAddress;

        const runnerImplementationAddress = await runnerFactory.runnerImplementation();
        expect(runnerImplementationAddress).to.be.a.properAddress;
    });

    it("Should create a new Runner by admin", async () => {
        const runnerFactoryAddress = await runnerFactory.getAddress();
        await runnerFactory.createAccount();


        const filter = runnerFactory.filters.RunnerCreated();
        const events = await runnerFactory.queryFilter(filter);

        if (events.length === 0) {
            console.log("No RunnerCreated event found");
            return;
        }

        const latestEvent = events[events.length - 1];

        const runnerAddress = latestEvent.args.runnerAddress;
        const RunnerContract = await ethers.getContractFactory("Runner");
        runner = RunnerContract.attach(runnerAddress);

        const entryPointAddress = await runner.entryPoint();
        expect(entryPointAddress).to.be.equal(entryPoint);

        const registryAddress = await runner.registry();
        expect(registryAddress).to.be.equal(await registry.getAddress());

        const owner = await runner.owner();
        expect(owner).to.be.equal(runnerFactoryAddress);
    });


    it("Should deploy the VerifyingPaymaster", async function () {
        const VerifyingPaymasterFactoryContract = await ethers.getContractFactory("VerifyingPaymasterFactory");
        verifyingPaymasterFactory = await VerifyingPaymasterFactoryContract.deploy();
        const tx = await verifyingPaymasterFactory.deployVerifyingPaymaster(await entryPoint.getAddress(), await offchainSigner.getAddress());
        await tx.wait();

        const filter = verifyingPaymasterFactory.filters.VerifyingPaymasterDeployed();
        const events = await verifyingPaymasterFactory.queryFilter(filter);
        verifyingPaymaster = await ethers.getContractAt("VerifyingPaymaster", events[0].args.verifyingPaymasterAddress);

        const entryPointAddress = await verifyingPaymaster.entryPoint();
        expect(entryPointAddress).to.be.equal(await entryPoint.getAddress());
    });

    it("Should deposit to the entry point", async function () {
        const amount = ethers.parseEther("1");

        const tx = await verifyingPaymaster.deposit({ value: amount });
        await tx.wait();

        const balance = await verifyingPaymaster.getDeposit();
        expect(balance).to.be.equal(amount);


    });

    it("Should add stake to the entry point", async function () {
        const amount = ethers.parseEther("1");

        let tx = await entryPoint.addStake(10, { value: amount });
        await tx.wait();

        tx = await verifyingPaymasterFactory.addStake(10, { value: amount });
        await tx.wait();

    });

    it("succeed with valid signature", async function () {


        // const userOp1 = await fillAndSign({
        //     sender: await runner.getAddress(),
        //     paymaster: await verifyingPaymaster.getAddress(),
        //     paymasterData: ethers.concat(
        //         [ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), '0x' + '00'.repeat(65)])
        // }, offchainSigner, entryPoint);

        // console.log("packUserOp(userOp1):", packUserOp(userOp1));

        // const hash = await verifyingPaymaster.getHash(packUserOp(userOp1), MOCK_VALID_UNTIL, MOCK_VALID_AFTER)
        // const sig = await offchainSigner.signMessage(ethers.toBeHex(hash))
        // const userOp = await fillSignAndPack({
        //     ...userOp1,
        //     paymaster: await verifyingPaymaster.getAddress(),
        //     paymasterData: ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig])
        // }, offchainSigner, entryPoint)

        // const res = await simulateValidation(userOp, await entryPoint.getAddress())

        let userOp = {
            sender: '0x9Bd7561782e1BC4BE0fD72BED1591B804a971869',
            nonce: 0n,
            initCode: "0x",
            callData: '0xb61d27f600000000000000000000000059d0d591b90ac342752ea7872d52cdc3c573ab71000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000004d09de08a00000000000000000000000000000000000000000000000000000000',
            callGasLimit: '0x7A1200',
            verificationGasLimit: '0x927C0',
            preVerificationGas: '0x15F90',
            maxFeePerGas: '0x956703D00',
            maxPriorityFeePerGas: '0x13AB668000',
            paymaster: await verifyingPaymaster.getAddress(),
            paymasterData: '0x00000000000000000000000000000000000000000000000000000000deadbeef00000000000000000000000000000000000000000000000000000000000012342fb8d9cc1a555daa244a27a84abe7bc499384f3aa6e859d5cb068a6d8b5783dc7612ba676bfed7eeea09358b5b0e64718586738ab49279b721c80920f63357b01b',
            paymasterVerificationGasLimit: '0x927C0',
            paymasterPostOpGasLimit: '0x927C0',
            signature: '0x0c64a5dc4b518972b10b6e34a1953de7aa6130377639213faa56946b6936673619a3fbe56dfe829c998b889c2d49cd4c88338f00ec1c68475385134ec070126902370fec3a7964b960bf10bcd9038f25f14747d0d56fad15ad532fa6ac896d902598d9c25326c1a663917de1e92a73ed7297b39e44ec3aff522938817d81909825f87f44c8573370ada1d3f4177dc372ee19c279e0b356b333b0bf83c0637e9e2b9d10511f78d8764a0e9eed8d90b9e22037f09f6ed328337a2a8e9e897025a41e075dab7c0cbb4f7250a7a37ac4c6cd060f35dad70f182a3ecab8028a6c411a19f0f1637129ceb3205e78a1369404b3fb3f1d82a6882c021ada430c1a15c7bc10420954d7b180d86960107c39156ba484c5fd3af2e7baad1740b54aa58e4435000000000000000000000000000000000000000000000000000000003ade68b1'
        }

        let packedUserOp = packUserOp(userOp);
        const hash = await verifyingPaymaster.getHash(packedUserOp, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
        console.log("hash:", BigInt(hash));

        const sig = await offchainSigner.signMessage(ethers.getBytes(hash))
        console.log("sig:", BigInt(sig));
        const recoveredAddress = ethers.verifyMessage(ethers.getBytes(hash), sig);
        console.log("recoveredAddress:", recoveredAddress);

        userOp.paymasterData = ethers.concat([ethers.AbiCoder.defaultAbiCoder().encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), sig]);
        console.log("paymasterData", userOp.paymasterData);

        packedUserOp = packUserOp(userOp);

        const valid = await verifyingPaymaster.validatePaymasterUserOpKun(packedUserOp, "0x0000000000000000000000000000000000000000000000000000000000000000", 0)
        // console.log("valid:", valid);


    });
});