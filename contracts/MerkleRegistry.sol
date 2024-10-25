// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./MerkleTreeWithHistory.sol";
import "hardhat/console.sol";

contract MerkleRegistry is MerkleTreeWithHistory {
    mapping(bytes32 => bool) public usedNullifiers; // Track used nullifiers to prevent proof reuse

    // Events
    event UserRegistered(bytes32 leaf, uint32 index);
    // event ProofVerified(bytes32 nullifier);

    constructor(uint32 _levels, IHasher _hasher) MerkleTreeWithHistory(_levels, _hasher) {}

    // Function to register a new user by inserting a new leaf into the Merkle tree
    function registerUser(bytes32 _leaf) external {
        // console.log("Registering leaf: %s", _leaf);

        uint32 index = _insert(_leaf);
        // console.log("Leaf inserted at index:", index);
        emit UserRegistered(_leaf, index);
    }

    function getLevels() external view returns (uint32) {
        return levels;
    }

    function setLevels(uint32 _levels) external {
        levels = _levels;
    }
    // Function to verify a proof that a user is registered
    // function verifyProof(
    //     bytes32 nullifier, // Nullifier to ensure one-time proof usage
    //     bytes32 leaf, // The user's hashed identifier (leaf in the Merkle tree)
    //     bytes32[] memory proof, // Merkle proof showing the user's identifier is part of the tree
    //     uint256[] memory positions // Indicates left (0) or right (1) sibling nodes in each proof level
    // ) external {
    //     require(!usedNullifiers[nullifier], "Nullifier has already been used");

    //     // Verify the Merkle proof
    //     require(verifyMerkleProof(leaf, proof, positions), "Invalid Merkle proof");

    //     // Mark the nullifier as used
    //     usedNullifiers[nullifier] = true;

    //     // Emit an event indicating the proof was successfully verified
    //     emit ProofVerified(nullifier);
    // }

    // // Function to verify the Merkle proof on-chain
    // function verifyMerkleProof(
    //     bytes32 leaf,
    //     bytes32[] memory proof,
    //     uint256[] memory positions
    // ) public view returns (bool) {
    //     bytes32 computedHash = leaf;

    //     for (uint256 i = 0; i < proof.length; i++) {
    //         if (positions[i] == 0) {
    //             computedHash = hashLeftRight(hasher, computedHash, proof[i]);
    //         } else {
    //             computedHash = hashLeftRight(hasher, proof[i], computedHash);
    //         }
    //     }

    //     // Check if the computed hash matches the current Merkle root
    //     return isKnownRoot(computedHash);
    // }
}
