// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./MerkleRegistry.sol";
import "hardhat/console.sol";

interface IRegistry {
    function verify(
        uint256[24] calldata _proof,
        uint256[2] calldata _pubSignals
    ) external returns (bool);
}

contract Runner is BaseAccount, Initializable {
    IEntryPoint private immutable _entryPoint;
    IRegistry private immutable _registry;

    constructor(IEntryPoint anEntryPoint, IRegistry aRegistry) {
        _entryPoint = anEntryPoint;
        _registry = aRegistry;
        _disableInitializers();
    }

    // function initialize(
    //     IEntryPoint anEntryPoint,
    //     IRegistry aRegistry
    // ) public initializer {
    //     _entryPoint = anEntryPoint;
    //     _registry = aRegistry;
    // }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    function registry() public view returns (IRegistry) {
        return _registry;
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
        // _requireFromEntryPointOrOwner();
        _call(dest, value, func);
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
        returns (uint256[24] memory proof, uint256[2] memory publicSignals)
    {
        (proof, publicSignals) = abi.decode(
            signature,
            (uint256[24], uint256[2])
        );
    }

    function verifyProof(bytes calldata signarute) public returns (bool) {
        return _verifyProof(signarute);
    }

    function _verifyProof(bytes calldata signature) internal returns (bool) {
        (
            uint256[24] memory proof,
            uint256[2] memory publicSignals
        ) = _deserializeProofAndPublicSignals(signature);
        bool result = _registry.verify(proof, publicSignals);
        console.log("Proof verified: %s", result);
        return result;
    }

    // validate the signature of the user operation
    // verify if the userOp is submitted by a registered user
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        require(_verifyProof(userOp.signature), "Invalid signature");
    }
}
