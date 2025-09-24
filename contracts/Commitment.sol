// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

// Interface definition for a Zero-Knowledge Proof verifier.
interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[1] calldata _pubSignals
    ) external view returns (bool);
}

// This contract allows a data provider to send and store cryptographic commitments of data sets.
// The stored commitments can then be used to verify the ownership of the provided data sets using Zero-Knowledge Proofs.
contract Commitment {
    uint256 commitment;

    IVerifier public immutable verifier;

    constructor(IVerifier _verifier, uint256 _commitment) {
        verifier = _verifier;
        commitment = _commitment;
    }

    function GetCommitment() public view returns (uint256) {
        return commitment;
    }

    function UpdateCommitment(
        bytes calldata _proof,
        uint256 _commitment
    ) public onlyVerified(_proof) {
        commitment = _commitment;
    }

    function _deserializeProofAndPublicSignals(
        bytes calldata _proofAndPubSignals
    )
        public
        pure
        returns (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[1] memory _pubSignals
        )
    {
        (_pA, _pB, _pC, _pubSignals) = abi.decode(
            _proofAndPubSignals,
            (uint[2], uint[2][2], uint[2], uint[1])
        );
    }

    function verify(
        bytes calldata _proofAndPubSignals
    ) public view returns (bool) {
        (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[1] memory _pubSignals
        ) = _deserializeProofAndPublicSignals(_proofAndPubSignals);
        require(_pubSignals[0] == commitment, "Invalid commitment");
        return verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
    }

    modifier onlyVerified(bytes calldata _proof) {
        require(verify(_proof), "Proof verification failed");
        _;
    }

    function convertBytesToUint256Array(
        bytes memory signature
    ) public pure returns (uint256[24] memory) {
        require(signature.length == 768, "Invalid signature length");

        uint256[24] memory result;
        for (uint256 i = 0; i < 24; i++) {
            uint256 word;
            assembly {
                word := mload(add(signature, add(32, mul(i, 32))))
            }
            result[i] = word;
        }
        return result;
    }
}
