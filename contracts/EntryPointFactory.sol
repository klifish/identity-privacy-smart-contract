// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/EntryPoint.sol"; // Adjust this path based on where EntryPoint.sol is located
import "hardhat/console.sol";
contract EntryPointFactory {
    event EntryPointDeployed(address entryPointAddress);

    function deployEntryPoint() external returns (address) {
        EntryPoint entryPoint = new EntryPoint();
        // console.log("EntryPoint deployed at address: ", address(entryPoint));
        emit EntryPointDeployed(address(entryPoint));
        return address(entryPoint);
    }
}