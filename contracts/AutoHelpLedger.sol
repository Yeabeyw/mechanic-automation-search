// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AutoHelp Lesotho on-chain ledger
/// @notice Stores one entry per Firestore ledger block (event type + block hash) in contract storage.
/// Entries must be appended in block order, so the on-chain list is a gap-free copy of the hash-chain.
/// No personal data is ever written: block hashes are salted SHA-256 digests (GDPR Art. 17 safe).
contract AutoHelpLedger {
    struct Entry {
        bytes32 blockHash;
        uint64 timestamp;
        string eventType;
    }

    address public immutable owner;
    uint256 public recordCount;
    mapping(uint256 => Entry) private entries;

    event RecordEvent(uint256 indexed blockIndex, string eventType, bytes32 blockHash, uint256 timestamp);

    error NotOwner();
    error OutOfOrder(uint256 blockIndex, uint256 expected);
    error LengthMismatch();
    error NotRecorded(uint256 blockIndex);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordEvent(uint256 blockIndex, string calldata eventType, bytes32 blockHash) external onlyOwner {
        _record(blockIndex, eventType, blockHash);
    }

    function recordBatch(
        uint256[] calldata blockIndexes,
        string[] calldata eventTypes,
        bytes32[] calldata blockHashes
    ) external onlyOwner {
        if (blockIndexes.length != eventTypes.length || blockIndexes.length != blockHashes.length) {
            revert LengthMismatch();
        }
        for (uint256 i = 0; i < blockIndexes.length; i++) {
            _record(blockIndexes[i], eventTypes[i], blockHashes[i]);
        }
    }

    function getEntry(uint256 blockIndex)
        external
        view
        returns (bytes32 blockHash, uint64 timestamp, string memory eventType)
    {
        if (blockIndex >= recordCount) revert NotRecorded(blockIndex);
        Entry storage e = entries[blockIndex];
        return (e.blockHash, e.timestamp, e.eventType);
    }

    function _record(uint256 blockIndex, string calldata eventType, bytes32 blockHash) internal {
        if (blockIndex != recordCount) revert OutOfOrder(blockIndex, recordCount);
        entries[blockIndex] = Entry({
            blockHash: blockHash,
            timestamp: uint64(block.timestamp),
            eventType: eventType
        });
        recordCount = blockIndex + 1;
        emit RecordEvent(blockIndex, eventType, blockHash, block.timestamp);
    }
}