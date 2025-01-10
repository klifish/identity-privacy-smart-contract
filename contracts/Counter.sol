// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;

    // Event to emit when the counter is updated
    event CounterUpdated(uint256 newCount);

    // Constructor to initialize the counter (optional, defaults to 0)
    constructor(uint256 initialCount) {
        count = initialCount;
    }

    // Function to get the current count
    function getCount() public view returns (uint256) {
        return count;
    }

    // Function to increment the counter
    function increment() public {
        count += 1;
        emit CounterUpdated(count);
    }
}