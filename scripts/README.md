# Seed Data Scripts

This directory contains scripts for seeding Firebase with test data.

## seed-firebase.js

Seeds Firebase Firestore with test data for development and testing.

### Prerequisites

1. Download a service account key from Firebase Console:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `service-account-key.json` in the project root
   - **Important**: Add `service-account-key.json` to `.gitignore`

2. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

### Usage

```bash
node scripts/seed-firebase.js
```

### Seeded Data

The script seeds the following data:

- **6 Users**: 3 customers, 1 mechanic, 1 admin, 1 security_admin
- **6 Mechanics**: 3 verified, 3 unverified
- **1 Mechanic Owner**: Links mechanic to user account
- **6 Service Requests**: Various statuses (sent, accepted, in_progress, completed)
- **6 Reviews**: Ratings and comments for mechanics
- **Ledger Secrets**: Salt for hashing
- **Ledger State**: Initial ledger head

### Test Accounts

After seeding, you'll have these test accounts (you'll need to set passwords in Firebase Authentication console):

- **Customer**: thabo@example.com (user001)
- **Mechanic**: lerato@example.com (mech001)
- **Admin**: admin@autohelp.co.ls (admin001)
- **Security Admin**: security@autohelp.co.ls (sec001)

### Setting Passwords

1. Go to Firebase Console → Authentication
2. Click "Add user"
3. Use the email addresses above and set passwords
4. The UIDs must match the ones in the seed script

### Important Notes

- This script is for development/testing only
- Do not run this on production data
- Always keep service account keys secure
- The script overwrites existing data with matching document IDs
