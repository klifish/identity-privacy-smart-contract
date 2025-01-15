const circomlibjs = require("circomlibjs");
const { expect } = require("chai");
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
        const rounds = 220;

        const contractResult = await mimc.MiMCSponge(input1, input2, rounds);
        const jsResult = mimcJS.hash(input1, input2, rounds);

        expect(contractResult.xL.toString()).to.equal(mimcJS.F.toString(jsResult.xL));
        expect(contractResult.xR.toString()).to.equal(mimcJS.F.toString(jsResult.xR));

    });
});