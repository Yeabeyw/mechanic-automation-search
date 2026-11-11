# Part B - Blockchain evidence

## Design
1. **Firestore hash-chain** (`ledger_blocks`): every business event is appended by Cloud Functions as a block
   `block_hash = SHA-256(index | prev_hash | data_hash | ts)`. Browsers re-verify the whole chain.
2. **On-chain ledger** (`AutoHelpLedger.sol`, Ethereum Sepolia): every block's event type and block hash is
   stored in contract storage, in order and gap-free (`npm run ledger:publish`). Anyone can read it with
   `getEntry(blockIndex)` and compare it with Firestore.
3. **On-chain anchor** (`AutoHelpAnchor.sol`): periodic head checkpoints (`npm run anchor`).

## Why no personal data is on-chain (GDPR Art. 17)
Record fingerprints are `SHA-256(private_salt | canonical_record)`. The salt lives in `ledger_secrets`
(denied to every client). When a user deletes their account (`deleteUser`) or a request passes the
12-month retention limit (`anonymizeOldRequests`), the matching salts are deleted. The public hash can then
no longer be linked to a person or recomputed, while the chain itself stays intact and verifiable.

## Commands
    npm run ledger:deploy     # once: deploy AutoHelpLedger
    npm run ledger:publish    # after new actions: write new blocks on-chain + read-back verification
    npm run anchor            # publish head checkpoint
Evidence files: `public/ledger-onchain.json`, `public/anchors.json`.