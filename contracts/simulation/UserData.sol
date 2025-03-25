// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract UserData {
    string private data;

    function update(string calldata _data) external {
        data = _data;
    }

    function read() external view returns (string memory) {
        return data;
    }
}
