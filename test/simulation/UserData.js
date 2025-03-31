const { ethers } = require("hardhat");
const path = require("path");
const ffjavascript = require("ffjavascript");
const snarkjs = require("snarkjs");
const { fillUserOpDefaults, parseProof, computePedersenHash } = require("../../scripts/utils");
const { groth16ExportSolidityCallData } = require("../../scripts/utils");
const { expect } = require("chai");

describe("UserData", function () {

    let verifierAddress;
    let verifier;
    let wasm;
    let zkey;
    let secret = "hello world";
    let userDataAddress;
    let userData;

    before(async function () {
        wasm = path.join(__dirname, "..", "..", "build", "circuits", "commitment_js", "commitment.wasm");
        zkey = path.join(__dirname, "..", "..", "build", "circuits", "commitment_final.zkey");
    })

    it("Should be able deploy a Commitment Verifier", async function () {
        const VerifierContract = await ethers.getContractFactory("CommitmentGroth16Verifier");
        verifier = await VerifierContract.deploy();
        await verifier.waitForDeployment();
        verifierAddress = verifier.target;
    })

    it("Should be able to deploy a UserData contract", async function () {
        const commitment = await computePedersenHash(secret);
        const UserDataContract = await ethers.getContractFactory("UserData");
        userData = await UserDataContract.deploy(verifierAddress, commitment, "My User Data");
        await userData.waitForDeployment();
        userDataAddress = userData.target;
    })

    it("Should be able to verify a commitment", async function () {
        const encodedMessage = new TextEncoder().encode(secret);
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);

        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);

        const verified = await userData.verify(serializedProofandPublicSignals)
        expect(verified).to.equal(true);

    })

    it("Should revert with commitment", async function () {
        const encodedMessage = new TextEncoder().encode(secret + "1");
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);

        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);
        try {
            const tx = await userData.verify(serializedProofandPublicSignals)
        } catch (error) {
            expect(error.message).to.include("Invalid commitment");
        }
    })

    it("Should be able to update the data", async function () {
        const oldData = await userData.read();
        const newData = "My New User Data";

        // generate the proof
        const encodedMessage = new TextEncoder().encode(secret);
        const encodedMessageBigInt = ffjavascript.utils.leBuff2int(encodedMessage);

        const { proof: proofJson, publicSignals: publicInputs } = await snarkjs.groth16.fullProve({ secret: encodedMessageBigInt }, wasm, zkey);

        let { pA, pB, pC, pubSignals } = await groth16ExportSolidityCallData(proofJson, publicInputs);
        const serializedProofandPublicSignals = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint[1]"], [pA, pB, pC, pubSignals]);

        // update the data
        const tx = await userData.update(newData, serializedProofandPublicSignals);
        await tx.wait();
        const updatedData = await userData.read();
        expect(updatedData).to.equal(newData);
    })
});