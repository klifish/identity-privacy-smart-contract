// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
import "../Commitment.sol";

contract UserData {
    string private data;
    Commitment public commitment;
    mapping(bytes32 => bool) public verifiedProofs;
    event UserDataCreated(address userDataAddress, address sender);

    constructor(IVerifier _verifier, uint256 _commitment, string memory _data) {
        data = _data;
        commitment = new Commitment(_verifier, _commitment);
        emit UserDataCreated(address(this), msg.sender);
    }

    modifier onlyVerified(bytes calldata proof) {
        bytes32 proofHash = keccak256(proof);
        require(verifiedProofs[proofHash] == false, "Proof already verified");
        verifiedProofs[proofHash] = true;
        require(commitment.verify(proof), "Proof verification failed");
        _;
    }

    function verify(bytes calldata _proof) public view returns (bool) {
        bytes32 proofHash = keccak256(_proof);
        if (verifiedProofs[proofHash]) {
            return true;
        }

        bool isVerified = commitment.verify(_proof);
        return isVerified;
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
