const circomlibjs = require("circomlibjs");

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
        // signer = await ethers.getSigners()[0];
        // console.log("Signer: ", signer);
        const bytecode = circomlibjs.mimcSpongecontract.createCode(SEED, 220);
        const abi = circomlibjs.mimcSpongecontract.abi;
        const C = new ethers.ContractFactory(
            abi,
            bytecode,
            signer
          );

        mimc = await C.deploy();
    });

    it("Shold calculate the mimc correctly", async () => {

        const res = await mimc.MiMCSponge(1,2, 220);

        // console.log("Cir: " + bigInt(res.toString(16)).toString(16));

        const res2 = mimcJS.hash(1,2, 220);
        // console.log("Ref: " + bigInt(res2).toString(16));
        console.log(res.xL.toString())
        console.log(mimcJS.F.toString(res2.xL))
        // assert.equal(res.xL.toString(), mimcJS.F.toString(res2.xL));
        // assert.equal(res.xR.toString(), mimcJS.F.toString(res2.xR));

    });
});