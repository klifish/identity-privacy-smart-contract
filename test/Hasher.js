const circomlibjs = require("circomlibjs");
const { expect } = require("chai");
const { hashLeftRightNew, hashLeftRight, hashLeftRightNewHash } = require("../scripts/utilities/hasher");
const SEED = "mimcsponge";
describe("MiMC Sponge Smart contract test", () => {
    let mimc;
    let mimcJS;
    let signer;

    before(async () => {
        const signers = await ethers.getSigners();
        signer = signers[0];
        mimcJS = await circomlibjs.buildMimcSponge();
    });

    it("Should deploy the contract", async () => {

        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        const C = new ethers.ContractFactory(
            abi,
            bytecode,
            signer
        );

        mimc = await C.deploy();

        const contractAddress = await mimc.getAddress();
        expect(contractAddress).to.be.properAddress;

    });

    it("Shold calculate the mimc correctly", async () => {

        const input1 = 1;
        const input2 = 2;
        const k = 0;

        // Calculate the hash using the contract
        const contractResult = await mimc.MiMCSponge(input1, input2, k);

        // Calculate the hash using the circomlibjs implementation
        const jsResult = mimcJS.hash(input1, input2, k);

        expect(contractResult[0]).to.equal(mimcJS.F.toObject(jsResult.xL));
        expect(contractResult[1]).to.equal(mimcJS.F.toObject(jsResult.xR));


    });

    it("Should hash left right correctly", async () => {
        const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");


        const input1 = 1;
        const input2 = 2;
        const k = 0;

        // Calculate the hash using the hashLeftRight function
        const hashLeftRightResult = hashLeftRight(mimcJS, input1, input2);

        const hashLeftRightNewResult = hashLeftRightNew(mimcJS, input1, input2);
        expect(hashLeftRightResult).to.equal(hashLeftRightNewResult);
    });
});