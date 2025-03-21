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

    mapping(bytes32 => bool) public verifiedProofs;

    event MyAccountInitialized(
        IEntryPoint indexed entryPoint,
        uint256 indexed commitmentModule
    );
    event OwnershipVerified(bool indexed isValid);

    constructor(IEntryPoint anEntryPoint, IVerifier aVerifier) {
        _entryPoint = anEntryPoint;
        _verifier = aVerifier;
        _disableInitializers();
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    function CommitmentModule() public view virtual returns (Commitment) {
        return commitmentModule;
    }

    function GetCommitment() public view virtual returns (uint256) {
        return commitmentModule.GetCommitment();
    }

    modifier onlyVerified(bytes calldata proof) {
        require(commitmentModule.verify(proof), "Proof verification failed");
        _;
    }

    function verifyOwnership(bytes calldata proof) external {
        bool isValid = commitmentModule.verify(proof);
        console.log("Ownership verified: %s", isValid);
        emit OwnershipVerified(isValid);
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
    ) internal virtual override returns (uint256 validationData) {
        bytes32 proofHash = keccak256(userOp.signature);
        require(verifiedProofs[proofHash], "Signature not pre-verified");
        userOpHash;
        return SIG_VALIDATION_SUCCESS;
    }

    function initialize(uint256 aCommitment) public virtual initializer {
        _initialize(aCommitment);
    }

    function _initialize(uint256 _commitment) internal virtual {
        commitmentModule = new Commitment(_verifier, _commitment);
        emit MyAccountInitialized(_entryPoint, _commitment);
    }

    function preVerifySignature(bytes calldata signature) external {
        require(_verifyProof(signature), "Invalid signature");
        bytes32 proofHash = keccak256(signature);
        verifiedProofs[proofHash] = true;
    }

    function _verifyProof(bytes calldata signature) internal returns (bool) {
        bool result = commitmentModule.verify(signature);
        return result;
    }

    // Solidity code in MyAccount.sol
    receive() external payable {}
}
