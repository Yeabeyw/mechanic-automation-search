// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AutoHelpLedger {
    event RecordEvent(
        string eventType,
        bytes32 recordHash,
        uint256 timestamp
    );

    function recordEvent(
        string calldata eventType,
        bytes32 recordHash
    ) external {
        emit RecordEvent(eventType, recordHash, block.timestamp);
    }
}
