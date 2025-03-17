// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/samples/VerifyingPaymaster.sol";
import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/core/UserOperationLib.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract VerifyingPaymasterFactory is Ownable {
    using UserOperationLib for PackedUserOperation;
    VerifyingPaymaster public paymaster;
    event VerifyingPaymasterDeployed(address verifyingPaymasterAddress);

    constructor() Ownable(msg.sender) {}

    function deployVerifyingPaymaster(
        IEntryPoint entryPoint,
        address offchainSigner
    ) public onlyOwner returns (address) {
        paymaster = new VerifyingPaymaster(entryPoint, offchainSigner);
        emit VerifyingPaymasterDeployed(address(paymaster));
        return address(paymaster);
    }

    function addStake(uint32 unstakeDelaySec) public payable onlyOwner {
        paymaster.addStake{value: msg.value}(unstakeDelaySec);
    }
}
