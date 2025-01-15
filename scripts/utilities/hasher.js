const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");

const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

async function setupHasher() {
    return await circomlibjs.buildMimcSponge();
}

const hashLeftRight = (hasher, left, right) => {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);

    if (leftValue >= FIELD_SIZE) throw new Error("_left should be inside the field");
    if (rightValue >= FIELD_SIZE) throw new Error("_right should be inside the field");

    let xL = leftValue;
    let xR = BigInt(0);

    ({ xL, xR } = hasher.hash(xL, xR, 220));
    xL = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xL));
    xR = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xR));

    xR = (xR + rightValue) % FIELD_SIZE;
    ({ xL, xR } = hasher.hash(xL, xR, 220));
    xL = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xL));
    xR = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xR));

    return xL;
};

module.exports = { setupHasher, hashLeftRight };