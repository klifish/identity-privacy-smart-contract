const { register } = require("module");
const path = require("path");
const { expect } = require("chai");
const circomlibjs = require("circomlibjs");
const { ethers } = require("hardhat");
const ffjavascript = require("ffjavascript");
const utils = require('../scripts/utils');
const merkleTree = require('fixed-merkle-tree');
const { setupHasher, hashLeftRight } = require('../scripts/utilities/hasher');
const snarkjs = require("snarkjs");

describe('Runner', function () {
    const SEED = "mimcsponge";
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const SECRET = "secret";

    let registerPlonkVerifier;
    let entryPoint;
    let runnerFactory;
    let runner;
    let registry;
    let hasher;
    let hasherOffChain;
    let signer;
    let treeOffChain;

    let babyjub;
    let F;

    let wasm
    let zkey
    before(async () => {
        signer = (await ethers.getSigners())[0];
        babyjub = await circomlibjs.buildBabyjub();
        F = babyjub.F;

        wasm = path.join(__dirname, "..", "build", "circuits", "register_js", "register.wasm");
        zkey = path.join(__dirname, "..", "build", "circuits", "register_final.zkey");
        hasherOffChain = await setupHasher();

    });

    it("Should deploy the RegisterPlonkVerifier", async () => {
        const RegisterVerifierContract = await ethers.getContractFactory("RegisterGroth16Verifier");

        registerVerifier = await RegisterVerifierContract.deploy();

        const registerVerifierAddress = await registerVerifier.getAddress();

        expect(registerVerifierAddress).to.be.a.properAddress;
    });

    it("Should deploy a hasher", async () => {
        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        let HasherContract = new ethers.ContractFactory(
            abi,
            bytecode,
            signer
        );

        hasher = await HasherContract.deploy();
        const hasherAddress = await hasher.getAddress();
        expect(hasherAddress).to.be.a.properAddress;

    });

    it("Should deploy a registry", async () => {
        const hasherAddress = await hasher.getAddress();
        const verifierAddress = await registerVerifier.getAddress();
        const RegistryContract = await ethers.getContractFactory("MerkleRegistry");
        registry = await RegistryContract.deploy(MERKLE_TREE_LEVEL, hasherAddress, verifierAddress);

        const registryAddress = await registry.getAddress();
        expect(registryAddress).to.be.properAddress;

        const levels = await registry.getLevels();
        expect(levels).to.equal(MERKLE_TREE_LEVEL);
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

    it("Should deploy the RunnerFactory", async () => {
        const RunnerFactoryContract = await ethers.getContractFactory("RunnerFactory");
        const registryAddress = await registry.getAddress()
        runnerFactory = await RunnerFactoryContract.deploy(entryPoint, registryAddress);

        const runnerFactoryAddress = await runnerFactory.getAddress();
        expect(runnerFactoryAddress).to.be.a.properAddress;

        const runnerImplementationAddress = await runnerFactory.runnerImplementation();
        expect(runnerImplementationAddress).to.be.a.properAddress;
    });

    it("Should create a new Runner", async () => {
        await runnerFactory.createAccount();
        const filter = runnerFactory.filters.RunnerCreated();
        const events = await runnerFactory.queryFilter(filter);

        const runnerAddress = events[0].args.runnerAddress;
        const RunnerContract = await ethers.getContractFactory("Runner");
        runner = await RunnerContract.attach(runnerAddress);

        const entryPointAddress = await runner.entryPoint();
        expect(entryPointAddress).to.be.equal(entryPoint);

        const registryAddress = await runner.registry();
        expect(registryAddress).to.be.equal(await registry.getAddress());
    });

    it("Should register a new user", async () => {
        let userAddress = signer.address;

        const secret = SECRET;
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 0n;

        const src = [userAddress, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])

        await expect(registry.registerUser(hp1)).to.emit(registry, 'UserRegistered').withArgs(hp1, 0);

    });


    it("Should construct a Merkle tree off-chain", async () => {

        const events = await registry.queryFilter(registry.filters.UserRegistered());
        const sortedEvents = events.sort((a, b) => (a.args.index < b.args.index ? -1 : a.args.index > b.args.index ? 1 : 0));
        const leafs = sortedEvents.map(event => event.args.leaf);

        treeOffChain = new merkleTree.MerkleTree(MERKLE_TREE_LEVEL, leafs, { hashFunction: (left, right) => hashLeftRight(hasherOffChain, left, right) });
        const root = treeOffChain.root;
        const isValidRoot = await registry.isKnownRoot(root);
        expect(isValidRoot).to.be.true;

    });

    // it("Should generate a proof for the registered user", async () => {

    //     let userAddress = signer.address;

    //     const secret = SECRET;
    //     const secretBuff = (new TextEncoder()).encode(secret)
    //     const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

    //     const nullifier = 0n;

    //     const src = [userAddress, secretBigInt, nullifier]
    //     leaf = await utils.pedersenHashMultipleInputs(src)

    //     const hP = babyjub.unpackPoint(leaf);
    //     hp1 = F.toObject(hP[1])

    //     const merkleProof = treeOffChain.proof(hp1);

    //     const input = {
    //         "root": merkleProof.pathRoot,
    //         "nullifierHash": "987654321",
    //         "recipient": "100",
    //         "relayer": "50",
    //         "fee": "10",
    //         "refund": "5",
    //         "nullifier": nullifier,
    //         "secret": secretBigInt,
    //         "pathElements": merkleProof.pathElements,
    //         "pathIndices": merkleProof.pathIndices,
    //         "smartContractWalletAddress": userAddress
    //     }

    //     const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.plonk.fullProve(input, wasm, zkey);


    //     const parsedproof = utils.parseProof(proofJson);
    //     const tx = await registry.verify(parsedproof, publicInputs);
    //     const receipt = await tx.wait();

    //     const events = await registry.queryFilter(registry.filters.ProofVerified());
    //     expect(events[0].args.result).to.be.true;

    // });

    it("should be able to call transfer", async () => {
        const runnerAddress = await runner.getAddress();
        const balanceBefore = await ethers.provider.getBalance(runnerAddress);

        await signer.sendTransaction({ from: signer.address, to: runnerAddress, value: ethers.parseEther("1") });
        const balanceAfter = await ethers.provider.getBalance(runnerAddress);
        expect(balanceAfter).to.be.equal(balanceBefore + ethers.parseEther("1"));
    });

    it("Should validate the proof in Runner via _validateSignature", async () => {
        let userAddress = signer.address;

        const secret = SECRET;
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const nullifier = 0n;

        const src = [userAddress, secretBigInt, nullifier]
        leaf = await utils.pedersenHashMultipleInputs(src)

        const hP = babyjub.unpackPoint(leaf);
        hp1 = F.toObject(hP[1])

        const merkleProof = treeOffChain.proof(hp1);

        const input = {
            "root": merkleProof.pathRoot,
            "nullifierHash": "987654321",
            "recipient": "100",
            "relayer": "50",
            "fee": "10",
            "refund": "5",
            "nullifier": nullifier,
            "secret": secretBigInt,
            "pathElements": merkleProof.pathElements,
            "pathIndices": merkleProof.pathIndices,
            "smartContractWalletAddress": userAddress
        }

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve(input, wasm, zkey);

        let { pA, pB, pC, pubSignals } = await utils.groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[2]"], [pA, pB, pC, pubSignals]);
        // console.log("Available functions in Runner contract:", runner.functions);

        const decodedProof = await runner._deserializeProofAndPublicSignals(serializedProofandPublicSignals);
        console.log("Decoded proof:", decodedProof);

        await runner.verifyProof(serializedProofandPublicSignals)

    });
});