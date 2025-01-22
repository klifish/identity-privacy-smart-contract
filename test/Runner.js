const { register } = require("module");
const path = require("path");
const { expect } = require("chai");
const exp = require("constants");
const circomlibjs = require("circomlibjs");
const { ethers } = require("hardhat");
const ffjavascript = require("ffjavascript");
const utils = require('../scripts/utils');

describe('Runner', function () {
    const SEED = "mimcsponge";
    const MERKLE_TREE_LEVEL = process.env.MERKLE_TREE_LEVEL
    const SECRET = "secret";

    let registerPlonkVerifier;
    let entryPoint;
    let runnerFactory;
    let registry;
    let hasher;
    let signer;
    let treeOffChain;

    let babyjub;
    let F;
    before(async () => {
        signer = (await ethers.getSigners())[0];
        babyjub = await circomlibjs.buildBabyjub();
        F = babyjub.F;

    });

    it("Should deploy the RegisterPlonkVerifier", async () => {
        const RegisterPlonkVerifierContract = await ethers.getContractFactory("RegisterPlonkVerifier");

        registerPlonkVerifier = await RegisterPlonkVerifierContract.deploy();

        const registerPlonkVerifierAddress = await registerPlonkVerifier.getAddress();

        expect(registerPlonkVerifierAddress).to.be.a.properAddress;
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
        const verifierAddress = await registerPlonkVerifier.getAddress();
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
        runnerFactory = await RunnerFactoryContract.deploy(entryPoint, await registry.getAddress());

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








});