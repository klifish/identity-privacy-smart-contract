pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";
include "merkleTree.circom";

// computes Pedersen(nullifier + secret)
// template CommitmentHasher() {
//     signal input nullifier;
//     signal input secret;
//     signal output commitment;
//     signal output nullifierHash;

//     component commitmentHasher = Pedersen(496);
//     component nullifierHasher = Pedersen(248);

//     component nullifierBits = Num2Bits(248);
//     component secretBits = Num2Bits(248);
//     nullifierBits.in <== nullifier;
//     secretBits.in <== secret;
//     for (var i = 0; i < 248; i++) {
//         nullifierHasher.in[i] <== nullifierBits.out[i];
//         commitmentHasher.in[i] <== nullifierBits.out[i];
//         commitmentHasher.in[i + 248] <== secretBits.out[i];
//     }

//     commitment <== commitmentHasher.out[0];
//     nullifierHash <== nullifierHasher.out[0];
// }

template WalletAndSecretHasher() {
    signal input smartContractWalletAddress;
    signal input secret;
    signal input nullifier;
    signal output commitment;

    component smartContractWalletAddressBits = Num2Bits(256);
    component secretBits = Num2Bits(256);
    component nullifierBits = Num2Bits(256);
    
    smartContractWalletAddressBits.in <== smartContractWalletAddress;
    secretBits.in <== secret;
    nullifierBits.in <== nullifier;

    component WSHasher = Pedersen(256*3);
    for (var i = 0; i < 256; i++) {
        WSHasher.in[i] <== smartContractWalletAddressBits.out[i];
        // log(smartContractWalletAddressBits.out[i]);
        WSHasher.in[i + 256] <== secretBits.out[i];
        WSHasher.in[i + 512] <== nullifierBits.out[i];
    }
    
    commitment <== WSHasher.out[1];
    
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Register(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations

    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal input smartContractWalletAddress;

    // component hasher = CommitmentHasher();
    // hasher.nullifier <== nullifier;
    // hasher.secret <== secret;
    // hasher.nullifierHash === nullifierHash;

    component leafCommitmentHasher = WalletAndSecretHasher();
    leafCommitmentHasher.nullifier <== nullifier;
    leafCommitmentHasher.secret <== secret;
    leafCommitmentHasher.smartContractWalletAddress <== smartContractWalletAddress;
    // leafCommitmentHasher.secret <== smartContractWalletAddress + hasher.commitment;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== leafCommitmentHasher.commitment;
    log(leafCommitmentHasher.commitment);
    tree.root <== root;
    log(root);
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
}

component main {public [root, nullifierHash]}= Register(2);
// component main = WalletAndSecretHasher();
