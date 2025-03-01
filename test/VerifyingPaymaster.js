const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerifyingPaymaster", function () {
    let offchainSigner;
    let entryPoint;
    let verifyingPaymasterFactory;

    before(async function () {
        offchainSigner = (await ethers.getSigners())[0];
    });

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
        // console.log(balance.toString());
        expect(balance).to.be.equal(amount);


    });

    it("Should add stake to the entry point", async function () {
        const amount = ethers.parseEther("1");

        let tx = await entryPoint.addStake(10, { value: amount });
        await tx.wait();

        tx = await verifyingPaymasterFactory.addStake(10, { value: amount });
        await tx.wait();

    });
});