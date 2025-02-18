// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
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

    event SignatureVerified(bool isValid);

    receive() external payable {}

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

    function verifyProof(bytes calldata signature) public returns (bool) {
        return _verifyProof(signature);
    }

    function _verifyProof(
        bytes calldata signature
    ) internal view returns (bool) {
        (
            uint[2] memory _pA,
            uint[2][2] memory _pB,
            uint[2] memory _pC,
            uint[2] memory _pubSignals
        ) = _deserializeProofAndPublicSignals(signature);
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
        require(_verifyProof(userOp.signature), "Invalid signature");
        return 0;
    }
}
