const {ethers} = require("hardhat");
const { expect } = require("chai");

describe('RegisterVerifierContract', function () {

    let RegisterVerifierContract, registerVerifier;

    before(async function () {
        RegisterVerifierContract = await ethers.getContractFactory("PlonkVerifier");
    });

    it('Should deploy RegisterVerifierContract', async function () {
        registerVerifier = await RegisterVerifierContract.deploy();
        const contractAddress = await registerVerifier.getAddress();

        expect(contractAddress).to.be.properAddress;
    });
});