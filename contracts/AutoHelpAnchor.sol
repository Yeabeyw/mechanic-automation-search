// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AutoHelp Lesotho ledger anchor
/// @notice Stores checkpoints of the AutoHelp hash-chain on a public blockchain.
/// Only the head block hash is published - no personal data ever touches the chain.
contract AutoHelpAnchor {
    address public immutable owner;
    uint256 public checkpointCount;
    uint256 public latestIndex;
    mapping(uint256 => bytes32) public checkpoints;

    event Checkpoint(uint256 indexed blockIndex, bytes32 blockHash, uint256 timestamp);

    error NotOwner();
    error AlreadyAnchored(uint256 blockIndex);
    error NotNewer(uint256 blockIndex, uint256 latest);

    constructor() {
        owner = msg.sender;
    }

    function anchor(uint256 blockIndex, bytes32 blockHash) external {
        if (msg.sender != owner) revert NotOwner();
        if (checkpoints[blockIndex] != bytes32(0)) revert AlreadyAnchored(blockIndex);
        if (checkpointCount > 0 && blockIndex <= latestIndex) revert NotNewer(blockIndex, latestIndex);
        checkpoints[blockIndex] = blockHash;
        latestIndex = blockIndex;
        checkpointCount += 1;
        emit Checkpoint(blockIndex, blockHash, block.timestamp);
    }
}