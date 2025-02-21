const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { ethers } = require("hardhat");
const assert = require('assert');

describe('HelloWorld Smart Contract', function () {

    async function fixture() {
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy("Hello World!");

        const Counter = await ethers.getContractFactory("Counter");
        const counter = await Counter.deploy(0);

        return { helloWorld, counter };
    }

    it("Should return 'Hello World!'", async function () {
        const { helloWorld } = await loadFixture(fixture);

        const message = await helloWorld.message();

        assert.strictEqual(message, "Hello World!");
    })

    it('Should change the message', async function () {
        const { helloWorld } = await loadFixture(fixture);

        await helloWorld.update("Hello, Hardhat!");

        const message = await helloWorld.message();

        assert.strictEqual(message, "Hello, Hardhat!");
    })

    it("Should call getCount() in counter", async function () {
        const { helloWorld, counter } = await loadFixture(fixture);
        const counterAddress = await counter.getAddress();

        const counterContract = await ethers.getContractAt("Counter", counterAddress);
        const func = counterContract.interface.encodeFunctionData("increment");

        const beforeCount = await counter.getCount();
        console.log("beforeCount:", beforeCount)
        const tx = await helloWorld.Execute(counterAddress, 0, func);
        await tx.wait();
        // console.log("tx:", tx);
        const afterCount = await counter.getCount();
        console.log("afterCount:", afterCount);

    });
})