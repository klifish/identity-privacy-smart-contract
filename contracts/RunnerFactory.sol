// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Runner.sol";

contract RunnerFactory {
    Runner public immutable runnerImplementation;
    address public admin;

    event RunnerCreated(address runnerAddress);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    constructor(IEntryPoint _entryPoint, IRegistry aRegistry) {
        admin = msg.sender;
        runnerImplementation = new Runner(_entryPoint, aRegistry);
    }

    function createRunner() public onlyAdmin returns (Runner ret) {
        ret = Runner(
            payable(
                new ERC1967Proxy(
                    address(runnerImplementation),
                    abi.encodeWithSignature(
                        "initialize(address)",
                        address(this)
                    )
                )
            )
        );
        emit RunnerCreated(address(ret));
    }

    function withdrawFromRunner(
        address payable runnerAddress,
        uint256 amount
    ) public onlyAdmin {
        Runner(runnerAddress).execute(admin, amount, new bytes(0));
    }

    function createAccount() public onlyAdmin returns (Runner ret) {
        ret = createRunner();
    }
}
