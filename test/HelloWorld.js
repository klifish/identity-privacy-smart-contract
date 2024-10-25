const {loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { ethers } = require("hardhat");
const assert = require('assert');

describe('HelloWorld Smart Contract', function () {

    async function fixture() {
        const HelloWorld = await ethers.getContractFactory("HelloWorld");
        const helloWorld = await HelloWorld.deploy("Hello World!");

        return {helloWorld};
    }

    it ("Should return 'Hello World!'", async function() {
        const {helloWorld} = await loadFixture(fixture);

        const message = await helloWorld.message();

        assert.strictEqual(message, "Hello World!");
    })

    it ('Should change the message', async function() {
        const {helloWorld} = await loadFixture(fixture);

        await helloWorld.update("Hello, Hardhat!");

        const message = await helloWorld.message();

        assert.strictEqual(message, "Hello, Hardhat!");
    })
})