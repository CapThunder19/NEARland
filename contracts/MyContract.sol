// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MyContract {
    string public name;

    constructor() {
        name = "QIE Exchange Contract";
    }

    function getName() public view returns (string memory) {
        return name;
    }
}
