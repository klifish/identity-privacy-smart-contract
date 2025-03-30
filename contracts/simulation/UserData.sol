// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
import "../Commitment.sol";

contract UserData {
    string private data;
    Commitment public commitment;
    uint256 public counter = 0;
    mapping(bytes32 => bool) public verifiedProofs;

    constructor(IVerifier _verifier, uint256 _commitment, string memory _data) {
        data = _data;
        commitment = new Commitment(_verifier, _commitment);
    }

    modifier onlyVerified(bytes calldata proof, uint256 _newCommitment) {
        bytes32 proofHash = keccak256(proof);
        require(verifiedProofs[proofHash] == false, "Proof already verified");
        verifiedProofs[proofHash] = true;
        require(commitment.verify(proof), "Proof verification failed");
        commitment.UpdateCommitment(proof, _newCommitment);
        counter++;
        _;
    }

    function verify(bytes calldata _proof) public view returns (bool) {
        return commitment.verify(_proof);
    }

    function update(
        string calldata _data,
        bytes calldata _proof
    ) external onlyVerified(_proof) {
        data = _data;
    }

    function read() external view returns (string memory) {
        return data;
    }
}
