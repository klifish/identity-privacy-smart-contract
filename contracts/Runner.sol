// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "./MerkleRegistry.sol";
import "hardhat/console.sol";

interface IRegistry {
    function verify(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

contract Runner is BaseAccount, Initializable {
    IEntryPoint private immutable _entryPoint;
    IRegistry private immutable _registry;

    address private _owner;

    mapping(bytes32 => bool) public verifiedProofs;
    mapping(bytes32 => bytes32) public proofHashToUserOpHash;
    // Anti-replay: nullifierHash extracted from proof public signals.
    // NOTE: This contract treats pubSignals[1] as the nullifierHash.
    // If the circuit changes, update this index.
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => bytes32) public proofHashToNullifierHash;
    event ContractDeployed(address indexed newContract);
    event ValidateSignature(
        bytes32 indexed userOpHash,
        bytes32 indexed proofHash,
        bool isPreverification
    );
    event NullifierMarked(
        bytes32 indexed nullifierHash,
        bytes32 indexed proofHash
    );

    constructor(IEntryPoint anEntryPoint, IRegistry aRegistry) {
        _entryPoint = anEntryPoint;
        _registry = aRegistry;
        _owner = msg.sender;
        _disableInitializers();
    }

    event SignatureVerified(bool isValid);

    // Signature encoding versions:
    // v1: abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[2] pubSignals)
    // v2: v1 + bytes32 embeddedUserOpHash
    uint256 private constant _SIG_V1_LEN = 10 * 32; // 2 + 4 + 2 + 2 = 10 words
    uint256 private constant _SIG_V2_LEN = 11 * 32; // v1 + 1 word

    receive() external payable {}

    modifier onlyVerified(bytes calldata signature) {
        require(_verifyProof(signature), "Invalid signature");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    function registry() public view returns (IRegistry) {
        return _registry;
    }

    function initialize(address newOwner) public initializer {
        _owner = newOwner;
    }

    function _requireFromEntryPointOrOwner() internal view {
        require(
            msg.sender == address(entryPoint()) || msg.sender == _owner,
            "account: not Owner or EntryPoint"
        );
    }

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        // _call(dest, value, func);
        if (dest == address(0)) {
            address newContract = _deployContract(func);
            emit ContractDeployed(newContract);
        } else {
            _call(dest, value, func);
        }
    }

    function _deployContract(
        bytes memory code
    ) internal returns (address addr) {
        assembly {
            addr := create(0, add(code, 0x20), mload(code))
        }
        require(addr != address(0), "Deployment failed");
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function _deserializeProofAndPublicSignals(
        bytes calldata signature
    )
        public
        pure
        returns (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[2] memory _pubSignals
        )
    {
        (_pA, _pB, _pC, _pubSignals) = abi.decode(
            signature,
            (uint[2], uint[2][2], uint[2], uint[2])
        );
    }

    function _deserializeProofPublicSignalsAndEmbeddedOpHash(
        bytes calldata signature
    )
        internal
        pure
        returns (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[2] memory _pubSignals,
            bytes32 embeddedUserOpHash,
            bool hasEmbeddedUserOpHash
        )
    {
        if (signature.length == _SIG_V2_LEN) {
            (_pA, _pB, _pC, _pubSignals, embeddedUserOpHash) = abi.decode(
                signature,
                (uint[2], uint[2][2], uint[2], uint[2], bytes32)
            );
            hasEmbeddedUserOpHash = true;
        } else {
            (_pA, _pB, _pC, _pubSignals) = _deserializeProofAndPublicSignals(
                signature
            );
            embeddedUserOpHash = bytes32(0);
            hasEmbeddedUserOpHash = false;
        }
    }

    function verifyProof(bytes calldata signature) public view returns (bool) {
        return _verifyProof(signature);
    }

    function _verifyProof(
        bytes calldata signature
    ) internal view returns (bool) {
        (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[2] memory _pubSignals,
            ,

        ) = _deserializeProofPublicSignalsAndEmbeddedOpHash(signature);
        bool result = _registry.verify(_pA, _pB, _pC, _pubSignals);

        // emit SignatureVerified(result);
        return result;
    }

    // validate the signature of the user operation
    // verify if the userOp is submitted by a registered user
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        bytes32 proofHash = keccak256(userOp.signature);
        emit ValidateSignature(userOpHash, proofHash, false);
        require(verifiedProofs[proofHash], "Signature not pre-verified");
        require(
            proofHashToUserOpHash[proofHash] == userOpHash,
            "Proof does not match operation"
        );
        return SIG_VALIDATION_SUCCESS;
    }

    function validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 /* userOpHash */
    ) public virtual returns (uint256 validationData) {
        bytes32 proofHash = keccak256(userOp.signature);
        require(verifiedProofs[proofHash], "Signature not pre-verified");
        return SIG_VALIDATION_SUCCESS;
    }

    function preVerifySignature(
        bytes calldata signature,
        bytes32 userOpHash
    ) external {
        require(_verifyProof(signature), "Invalid signature");
        bytes32 proofHash = keccak256(signature);

        // If the signature embeds a userOpHash (v2), enforce it matches the provided userOpHash.
        // This prevents a third party from rebinding an observed proof to a different operation.
        (
            ,
            ,
            ,
            uint[2] memory _unusedPubSignals,
            bytes32 embeddedUserOpHash,
            bool hasEmbedded
        ) = _deserializeProofPublicSignalsAndEmbeddedOpHash(signature);
        // silence unused variable warning (pubSignals not used after v2 binding change)
        if (_unusedPubSignals[0] == 0) {
            // no-op
        }
        if (hasEmbedded) {
            require(
                embeddedUserOpHash == userOpHash,
                "Embedded userOpHash mismatch"
            );
        } else {
            // Backward compatibility: v1 signatures can be front-run/rebound.
            // Prefer upgrading clients to v2.
            require(
                signature.length == _SIG_V1_LEN,
                "Invalid signature length"
            );
        }

        // Idempotency: allow re-calling with the same binding, but prevent rebinding.
        if (verifiedProofs[proofHash]) {
            require(
                proofHashToUserOpHash[proofHash] == userOpHash,
                "Proof already bound to different operation"
            );
            return;
        }

        bytes32 nullifierHash = keccak256(abi.encodePacked(userOpHash));
        require(!usedNullifiers[nullifierHash], "Nullifier already used");
        usedNullifiers[nullifierHash] = true;

        verifiedProofs[proofHash] = true;
        proofHashToUserOpHash[proofHash] = userOpHash;
        proofHashToNullifierHash[proofHash] = nullifierHash;

        emit NullifierMarked(nullifierHash, proofHash);

        emit ValidateSignature(userOpHash, proofHash, true);
    }
}
