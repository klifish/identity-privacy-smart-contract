const circomlibjs = require("circomlibjs");
const ffjavascript = require("ffjavascript");

const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

async function setupHasher() {
    return await circomlibjs.buildMimcSponge();
}

const hashLeftRight = (hasher, left, right) => {
    const F = hasher.F;
    const leftBigInt = BigInt(left);
    // console.log("leftBigInt", leftBigInt);

    const rightBigInt = BigInt(right);
    // console.log("rightBigInt", rightBigInt);

    if (leftBigInt >= FIELD_SIZE) throw new Error("_left should be inside the field");
    if (rightBigInt >= FIELD_SIZE) throw new Error("_right should be inside the field");


    let R = F.zero;
    let C = F.zero;


    R = F.add(R, F.e(leftBigInt));
    let S = hasher.hash(R, C, 0);
    R = S.xL;
    C = S.xR;

    R = F.add(R, F.e(rightBigInt));
    S = hasher.hash(R, C, 0);
    R = S.xL;

    return F.toObject(R);
};

// const hashLeftRight = (hasher, left, right) => {
//     const leftValue = BigInt(left);

//     const rightValue = BigInt(right);

//     if (leftValue >= FIELD_SIZE) throw new Error("_left should be inside the field");
//     if (rightValue >= FIELD_SIZE) throw new Error("_right should be inside the field");

//     let xL = leftValue;
//     let xR = BigInt(0);

//     ({ xL, xR } = hasher.hash(xL, xR, 0));
//     xL = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xL));
//     xR = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xR));

//     xR = (xR + rightValue) % FIELD_SIZE;
//     ({ xL, xR } = hasher.hash(xL, xR, 0));
//     xL = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xL));
//     xR = ffjavascript.utils.unstringifyBigInts(hasher.F.toString(xR));

//     return xL;
// };

const hashLeftRightNew = (hasher, left, right) => {
    const leftBigInt = BigInt(left);
    const rightBigInt = BigInt(right);
    const Fr = hasher.F;


    const hash = hasher.multiHash([leftBigInt, rightBigInt], 0, 1);

    return Fr.toObject(hash); // Return the hash as BigInt
};

module.exports = { setupHasher, hashLeftRight, hashLeftRightNew };