// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "./Commitment.sol";
import "hardhat/console.sol";



contract MyAccount is BaseAccount, Initializable {
    Commitment public commitmentModule;
    uint256 public immutable countId;

    IEntryPoint private immutable _entryPoint;
    IVerifier private immutable _verifier;

    event MyAccountInitialized(IEntryPoint indexed entryPoint, uint256 indexed commitmentModule);

    constructor(IEntryPoint anEntryPoint, IVerifier aVerifier) {
        _entryPoint = anEntryPoint;
        _verifier = aVerifier;
        _disableInitializers();
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    modifier onlyVerified(uint256[24] calldata proof) {
        require(commitmentModule.verify(proof), "Proof verification failed");
        _;
    }

        /**
     * execute a transaction (called directly from owner, or by entryPoint)
     * @param dest destination address to call
     * @param value the value to pass in this call
     * @param func the calldata to pass in this call
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
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
    /// implement template method of BaseAccount
    // function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    // internal override virtual returns (uint256 validationData) {
    //     bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
    //     if (owner != ECDSA.recover(hash, userOp.signature))
    //         return SIG_VALIDATION_FAILED;
    //     return SIG_VALIDATION_SUCCESS;
    // }
    
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override virtual returns (uint256 validationData) {
        if (commitmentModule.verify(commitmentModule.convertBytesToUint256Array(userOp.signature))) {
            return SIG_VALIDATION_SUCCESS;
        }

        userOpHash; // currently unused

        return SIG_VALIDATION_FAILED;
    }

    function initialize(uint256 aCommitment) public virtual initializer {
        _initialize(aCommitment);   
    }

    function _initialize(uint256 _commitment) internal virtual {
        commitmentModule = new Commitment(_verifier, _commitment);
        emit MyAccountInitialized(_entryPoint, _commitment);
    }

    // Solidity code in MyAccount.sol
    receive() external payable {}
}