// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./MyAccount.sol";
import "./Counter.sol";

/**
 * A sample factory contract for SimpleAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract MyAccountFactory {
    MyAccount public immutable accountImplementation;
    Counter private counter;
    

    event AccountCreated(address accountAddress);
    constructor(IEntryPoint _entryPoint, IVerifier aVerifier, uint256 _initialCount) {
        accountImplementation = new MyAccount(_entryPoint, aVerifier);
        counter = new Counter(_initialCount);
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(
        uint256 _commitment,
        uint256 salt
    ) public returns (MyAccount ret) {
        address addr = getAddress(_commitment, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return MyAccount(payable(addr));
        }

        ret = MyAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(MyAccount.initialize, (_commitment)
                    )
                )
            )
        );
        // console.log("Account created at address: %s", address(ret));
        emit AccountCreated(address(ret));
        // return ret;
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(
        uint256 _commitment,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(MyAccount.initialize, (_commitment))
                        )
                    )
                )
            );
    }
}
