// https://tornado.cash
/*
 * d888888P                                           dP              a88888b.                   dP
 *    88                                              88             d8'   `88                   88
 *    88    .d8888b. 88d888b. 88d888b. .d8888b. .d888b88 .d8888b.    88        .d8888b. .d8888b. 88d888b.
 *    88    88'  `88 88'  `88 88'  `88 88'  `88 88'  `88 88'  `88    88        88'  `88 Y8ooooo. 88'  `88
 *    88    88.  .88 88       88    88 88.  .88 88.  .88 88.  .88 dP Y8.   .88 88.  .88       88 88    88
 *    dP    `88888P' dP       dP    dP `88888P8 `88888P8 `88888P' 88  Y88888P' `88888P8 `88888P' dP    dP
 * ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
 */

// SPDX-License-Identifier: MIT
// Code adapted from https://github.com/tornadocash/tornado-core
pragma solidity >=0.7.0;

import "hardhat/console.sol";

interface IHasher {
    // 0xEA2F5117A7379F0844F7A500a550757755b84FB4
    function MiMCSponge(
        uint256 in_xL,
        uint256 in_xR,
        uint256 k
    ) external pure returns (uint256 xL, uint256 xR);
}

contract MerkleTreeWithHistory {
    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ZERO_VALUE =
        21663839004416932945382355908790599225266501822907911457504978515578255421292; // = keccak256("tornado") % FIELD_SIZE
    IHasher public immutable hasher;

    uint32 public levels;

    // the following variables are made public for easier testing and debugging and
    // are not supposed to be accessed in regular code

    // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
    // it removes index range check on every interaction
    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    uint32 public currentRootIndex = 0;
    uint32 public nextIndex = 0;

    constructor(uint32 _levels, IHasher _hasher) {
        require(_levels > 0, "_levels should be greater than zero");
        require(_levels < 32, "_levels should be less than 32");
        levels = _levels;
        hasher = _hasher;

        for (uint32 i = 0; i < _levels; i++) {
            require(
                uint256(zeros(i)) < FIELD_SIZE,
                "Zero value exceeds FIELD_SIZE"
            );
            filledSubtrees[i] = zeros(i);
        }

        roots[0] = zeros(_levels - 1);
    }

    /**
    @dev Hash 2 tree leaves, returns MiMC(_left, _right)
  */
    // function hashLeftRight(
    //   IHasher _hasher,
    //   bytes32 _left,
    //   bytes32 _right
    // ) public pure returns (bytes32) {
    //   console.log("_left:", uint256(_left));
    //   console.log("_right:", uint256(_right));
    //   require(uint256(_left) < FIELD_SIZE, "_left should be inside the field");
    //   require(uint256(_right) < FIELD_SIZE, "_right should be inside the field");

    //   uint256 R = uint256(_left);
    //   uint256 C = 0;

    //   (R, C) = _hasher.MiMCSponge(R, C, 220);
    //   R = addmod(R, uint256(_right), FIELD_SIZE);
    //   (R, C) = _hasher.MiMCSponge(R, C, 220);
    //   return bytes32(R);
    // }

    function hashLeftRight(
        IHasher _hasher,
        uint256 left,
        uint256 right
    ) public pure returns (uint256) {
        require(left < FIELD_SIZE, "Left input out of field size");
        require(right < FIELD_SIZE, "Right input out of field size");

        uint256 R = 0; // Initialize R (equivalent to F.zero in JS)
        uint256 C = 0; // Initialize C (equivalent to F.zero in JS)

        // Step 1: Add left input to R
        R = (R + left) % FIELD_SIZE;
        (R, C) = _hasher.MiMCSponge(R, C, 0); // First hash with MiMC Sponge

        // Step 2: Add right input to R
        R = (R + right) % FIELD_SIZE;
        (R, C) = _hasher.MiMCSponge(R, C, 0); // Second hash with MiMC Sponge

        return R; // Return xL as the final hash
    }

    function _insert(uint256 _leaf) internal returns (uint32 index) {
        // console.log("currentLevelHash:", uint256(hashLeftRight(hasher, _leaf, zeros(0))));
        uint32 _nextIndex = nextIndex;
        require(
            _nextIndex != uint32(2) ** levels,
            "Merkle tree is full. No more leaves can be added"
        );
        uint32 currentIndex = _nextIndex;
        uint256 currentLevelHash = _leaf;
        uint256 left;
        uint256 right;

        for (uint32 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros(i);

                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(hasher, left, right);

            currentIndex /= 2;
        }

        // console.log("currentLevelHash:", uint256(currentLevelHash));

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentLevelHash;
        nextIndex = _nextIndex + 1;
        return _nextIndex;
    }

    /**
    @dev Whether the root is present in the root history
  */
    function isKnownRoot(uint256 _root) public view returns (bool) {
        if (_root == 0) {
            return false;
        }
        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;
        do {
            if (_root == roots[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            }
            i--;
        } while (i != _currentRootIndex);
        return false;
    }

    /**
    @dev Returns the last root
  */
    function getLastRoot() public view returns (uint256) {
        return roots[currentRootIndex];
    }

    /// @dev provides Zero (Empty) elements for a MiMC MerkleTree. Up to 32 levels
    // function zeros(uint256 i) public pure returns (uint256) {
    //     if (i == 0)
    //         return
    //             uint256(
    //                 0x0000000000000000000000000000000000000000000000000000000000000000
    //             );
    //     else if (i == 1)
    //         return
    //             uint256(
    //                 0x2d9fea8398a61ea1997e7d748364c0fdb49412c4dbabc1578375ade642e85581
    //             );
    //     else if (i == 2)
    //         return
    //             uint256(
    //                 0x1234a304a6250851669d511fd01a93eef2fd88d84bbb8b089021393bd6314ace
    //             );
    //     else if (i == 3)
    //         return
    //             uint256(
    //                 0x11a759c3e46852e6ee14e3bb8f7158c62d9270217563f56726b3d5ae719e77cf
    //             );
    //     else if (i == 4) {
    //         return
    //             uint256(
    //                 0x2802b08e40189aad1966fe84660e04b0a92cd6a0c6a8845915244bb888d60cc1
    //             );
    //     } else revert("Index out of bounds");
    // }

    function zeros(uint256 i) public pure returns (uint256) {
        if (i == 0)
            return
                0x0000000000000000000000000000000000000000000000000000000000000000;
        else if (i == 1)
            return
                0x2d9fea8398a61ea1997e7d748364c0fdb49412c4dbabc1578375ade642e85581;
        else if (i == 2)
            return
                0x1234a304a6250851669d511fd01a93eef2fd88d84bbb8b089021393bd6314ace;
        else if (i == 3)
            return
                0x11a759c3e46852e6ee14e3bb8f7158c62d9270217563f56726b3d5ae719e77cf;
        else if (i == 4)
            return
                0x2802b08e40189aad1966fe84660e04b0a92cd6a0c6a8845915244bb888d60cc1;
        else if (i == 5)
            return
                0x278861ed6103a39717d415bec985d336cca450c01e5e2782c33949ba10b986a5;
        else if (i == 6)
            return
                0x20a474de93592d5b1127589ba705a0f0016ab559a799b0c7ce76429b3243b0a;
        else if (i == 7)
            return
                0x2116864224ac0352d9637a12017a5a9c87417becc8147bd0d7654d2c66ea25bf;
        else if (i == 8)
            return
                0x2343742077c09474f0309521118da4d25cc0b62c59ace9bb68872de00a6eabad;
        else if (i == 9)
            return
                0x2466b9845a16b0ebf5c7186e91005508b795731630fed543c3283ec5d6979d4d;
        else if (i == 10)
            return
                0x1a7857e456c4c61a08577945811e341c6aea2e9ffbc067ae2c6ba84e234274d8;
        else if (i == 11)
            return
                0x117f1149dee533f1fd19526b414b2d2bef7a58bf40700d9f2f20a48110245caf;
        else if (i == 12)
            return
                0x1f65c6939e8ea9cf0721305bdcb4d46f110e47d36cb7425c60548ed3ffd6dec4;
        else if (i == 13)
            return
                0x2a127272f233f9414c4db2bfb72da605681103e489c5c27344b3e3e05c9731d6;
        else if (i == 14)
            return
                0x1597270471e05f72ac53719b6fe4cb6ce6322a730706c34da70a98e6928f311f;
        else if (i == 15)
            return
                0x144e4dcfca8d432a7bf23d6c57ef2cc86f371ea4b32527388ea4ce26ecb0a8e8;
        else if (i == 16)
            return
                0x1a781c1159b0f76ac76b5d8fe1ddf457f75d0033fef4d6f44f2c7787825c3229;
        else if (i == 17)
            return
                0x16fb3e5ac86d9a09fc73706c4c778707cdb4e6fd15b7cbd8e83519b85968b13d;
        else if (i == 18)
            return
                0x2fc35be02fb43a8c4d17b79f104b5b53f4ade39d020702a96ba45af57a747ad4;
        else if (i == 19)
            return
                0x17a97f2fd44b04668cb9d53a7cd3ddcf4fa2f87e0eba8e080180f5848646363d;
        else if (i == 20)
            return
                0x231118223cad627f42312b09cc5c1d971028532ba718f4804ade66b62d69d0d8;
        else revert("Index out of bounds");
    }
}
