const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");

const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

async function setupHasher() {
    return await circomlibjs.buildMimcSponge();
}

const hashLeftRight = (hasher, left, right) => {
    const leftValue = BigInt(left);
    console.log("leftValue:", leftValue);
    
    const rightValue = BigInt(right);
    console.log("rightValue:", rightValue);

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
    console.log("hashValue:", xL);

    return xL;
};

const hashLeftRightNew = (hasher, left, right) => {
    const leftBigInt = BigInt(left);
    const rightBigInt = BigInt(right);
    const Fr = hasher.F;

    // Initialize MiMC Sponge with 2 inputs, 220 rounds, and key=0
    // const mimcSponge = await circomlibjs.buildMimcSponge();

    // Hash the inputs
    const hashArray = hasher.multiHash([leftBigInt, rightBigInt], 0, 220);
    const firstHash = Fr.toObject(hashArray[0])
    // console.log("hasher.multiHash([leftBigInt, rightBigInt], 0, 220):", hasher.multiHash([leftBigInt, rightBigInt], 0, 220)[0])
    const hash = hasher.F.toObject(
        hasher.multiHash([leftBigInt, rightBigInt], 0, 220)
    );

    return firstHash; // Return the hash as BigInt
};

module.exports = { setupHasher, hashLeftRight,hashLeftRightNew };