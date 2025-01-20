const path = require("path");

const Scalar = require("ffjavascript").Scalar;

const buildPedersenHash = require("circomlibjs").buildPedersenHash;
const buildBabyJub = require("circomlibjs").buildBabyjub;

const wasm_tester = require("circom_tester").wasm;
const ffjavascript = require("ffjavascript");


describe("Wallet and secret hasher test", function () {
    let babyJub
    let pedersen;
    let F;
    let circuit;
    this.timeout(100000);
    before(async () => {

        babyJub = await buildBabyJub();
        F = babyJub.F;
        pedersen = await buildPedersenHash();
        circuit = await wasm_tester(path.join(__dirname, "circuits", "WalletAndSecretHasher.circom"));
    });
    it("Should pedersen at zero", async () => {
        const secret = "secret"
        const secretBuff = (new TextEncoder()).encode(secret)
        const secretBigInt = ffjavascript.utils.leBuff2int(secretBuff)

        const input = {
            "smartContractWalletAddress": "0xc6549a4e83CA4D3a3325886a1BaC4eAE6e6E1012",
            "secret": secretBigInt,
            "nullifier": 0n
        }

        let w;

        w = await circuit.calculateWitness(input, true);

        const b = Buffer.alloc(32);

        const h = pedersen.hash(b);
        const hP = babyJub.unpackPoint(h);

        await circuit.assertOut(w, { commitment: F.toObject(hP[0]) });

    });
});