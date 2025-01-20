pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/pedersen.circom";

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

    log(WSHasher.out[1]);
    
    commitment <== WSHasher.out[1];
    
}

component main = WalletAndSecretHasher();