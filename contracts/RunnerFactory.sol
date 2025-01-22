// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Runner.sol";

contract RunnerFactory {
    Runner public immutable runnerImplementation;

    event RunnerCreated(address runnerAddress);

    constructor(IEntryPoint _entryPoint, IRegistry aRegistry) {
        runnerImplementation = new Runner(_entryPoint, aRegistry);
    }

    function createRunner() public returns (Runner ret) {
        ret = Runner(
            payable(new ERC1967Proxy(address(runnerImplementation), ""))
        );
        emit RunnerCreated(address(ret));
    }

    function createAccount() public returns (Runner ret) {
        ret = createRunner();
    }
}
