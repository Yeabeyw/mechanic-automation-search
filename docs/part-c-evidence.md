# Part C.2 Evidence - Cybersecurity Implementation

This document provides step-by-step evidence for the cybersecurity implementation for AutoHelp Lesotho, covering Part C.2 of the assignment.

## Prerequisites

- Firebase project: `lesotho-digital-trust`
- Node.js and npm installed
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase CLI authenticated: `firebase login`

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lesotho-digital-trust-main
   ```

2. Install dependencies:
   ```bash
   npm install
   cd functions
   npm install
   cd ..
   ```

3. Install Firebase dependencies:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

## Evidence 1: Firestore Security Rules

### Test: Verify deny-by-default policy

**Expected Result**: Default wildcard rule denies all operations

**Steps**:
1. Open `firestore.rules`
2. Navigate to line 91-117
3. Verify the default rule:
   ```javascript
   match /{document=**} {
     allow read, write: if false;
   }
   ```

**Evidence**: The default rule explicitly denies all operations with `if false`, ensuring deny-by-default.

### Test: Verify helper functions

**Expected Result**: Helper functions `isSignedIn()`, `isAdmin()`, `isSecurityAdmin()`, `isOwner()` are defined

**Steps**:
1. Open `firestore.rules`
2. Lines 1-34 contain helper functions
3. Verify each helper:
   - `isSignedIn()`: Checks `request.auth != null`
   - `isAdmin()`: Checks if `security_admin` or `admin` in roles
   - `isSecurityAdmin()`: Checks if `security_admin` in roles
   - `isOwner(uid)`: Checks if `request.auth.uid == uid`

**Evidence**: All helper functions are correctly implemented.

### Test: Verify users collection rules

**Expected Result**: Users can read own profile, security_admin can read all, no client writes

**Steps**:
1. Open `firestore.rules`
2. Lines 36-40 define users collection rules
3. Verify:
   - `allow get`: if `isSignedIn() && (isOwner(uid) || isSecurityAdmin())`
   - `allow list`: if `isSecurityAdmin()`
   - `allow create, update, delete`: if false

**Evidence**: Users collection has proper RBAC with security_admin read access and no client writes.

### Test: Verify security_audit collection rules

**Expected Result**: security_admin can read, no client writes

**Steps**:
1. Open `firestore.rules`
2. Lines 107-117 define security_audit collection
3. Verify:
   - `allow get, list`: if `isSecurityAdmin()`
   - `allow create, update, delete`: if false

**Evidence**: security_audit is read-only for security_admin with no client write access.

### Test: Verify ledger_secrets and ledger_state denial

**Expected Result**: All client access denied

**Steps**:
1. Open `firestore.rules`
2. Lines 91-106 define ledger_secrets and ledger_state
3. Verify:
   - `allow get, list, create, update, delete`: if false

**Evidence**: Sensitive ledger collections are completely denied to all clients.

### Test: Run Firestore rules tests

**Expected Result**: All tests pass

**Steps**:
1. Start Firebase emulator:
   ```bash
   firebase emulators:start --only firestore
   ```

2. In another terminal, run tests:
   ```bash
   npm install --save-dev @firebase/testing mocha
   firebase emulators:exec "mocha firestore.rules.test.js"
   ```

**Evidence**: Test output shows all tests passing, confirming rules enforcement.

## Evidence 2: Cloud Functions

### Test: Verify listUserRoles function

**Expected Result**: Returns list of users with roles

**Steps**:
1. Open `functions/src/index.ts`
2. Lines 577-612 define `listUserRoles`
3. Verify:
   - Requires authentication
   - Requires security_admin role
   - Queries users collection
   - Returns users with roles

**Evidence**: Function is properly secured and returns user roles.

### Test: Verify setUserRole function

**Expected Result**: Grants/revokes admin and mechanic roles with audit logging

**Steps**:
1. Open `functions/src/index.ts`
2. Lines 614-750 define `setUserRole`
3. Verify:
   - Requires security_admin role
   - Only allows admin and mechanic roles
   - Prevents self-modification
   - Prevents removal of last admin
   - Writes audit log
   - Appends ledger event

**Evidence**: Function has proper security controls and audit logging.

### Test: Verify getSecurityPolicy function

**Expected Result**: Returns permission matrix

**Steps**:
1. Open `functions/src/index.ts`
2. Lines 752-778 define `getSecurityPolicy`
3. Verify:
   - Returns actors array
   - Returns modules array
   - Returns permissions array with CRUD status

**Evidence**: Function returns the complete permission matrix.

### Test: Verify listAuditLog function

**Expected Result**: Returns audit log entries with filtering

**Steps**:
1. Open `functions/src/index.ts`
2. Lines 780-829 define `listAuditLog`
3. Verify:
   - Requires security_admin role
   - Supports filtering by actor, action, result
   - Supports pagination with limit
   - Returns audit entries

**Evidence**: Function is secured and provides filtered audit log access.

### Test: Verify audit logging in verifyMechanic

**Expected Result**: Mechanic verification writes audit log

**Steps**:
1. Open `functions/src/index.ts`
2. Lines 481-525 show updated `verifyMechanic`
3. Verify:
   - Calls `writeAuditLogInTransaction` on success
   - Records actor, action, target, before/after status

**Evidence**: Mechanic verification is audited.

### Test: Deploy and test Cloud Functions

**Expected Result**: Functions respond correctly

**Steps**:
1. Deploy functions:
   ```bash
   firebase deploy --only functions
   ```

2. Test functions using Firebase Console or cURL:
   ```bash
   # Test getSecurityPolicy (requires auth token)
   curl -X POST \
     'https://us-central1-lesotho-digital-trust.cloudfunctions.net/getSecurityPolicy' \
     -H 'Authorization: Bearer <ID_TOKEN>' \
     -H 'Content-Type: application/json'
   ```

**Evidence**: Functions return expected responses with proper authentication.

## Evidence 3: Multi-Site Firebase Hosting

### Test: Verify .firebaserc configuration

**Expected Result**: Two hosting targets defined

**Steps**:
1. Open `.firebaserc`
2. Verify targets:
   - `main`: public directory `.output/public`
   - `security`: public directory `security-console/dist`

**Evidence**: Two hosting targets are configured.

### Test: Verify firebase.json configuration

**Expected Result**: Hosting array with two sites

**Steps**:
1. Open `firebase.json`
2. Lines 10-41 define hosting array
3. Verify:
   - Site `main` with target `main`
   - Site `security` with target `security`
   - Rewrite rules for SPA routing

**Evidence**: Multi-site hosting is properly configured.

### Test: Deploy both sites

**Expected Result**: Both sites deploy successfully

**Steps**:
1. Build main app:
   ```bash
   npm run build
   ```

2. Build security console:
   ```bash
   cd security-console
   npm install
   npm run build
   cd ..
   ```

3. Deploy main site:
   ```bash
   firebase deploy --only hosting:main
   ```

4. Deploy security console:
   ```bash
   firebase deploy --only hosting:security
   ```

**Evidence**: Both sites deploy to separate Firebase Hosting URLs.

## Evidence 4: Security Console UI

### Test: Verify security-console structure

**Expected Result**: Complete Vite React app structure

**Steps**:
1. Navigate to `security-console/`
2. Verify structure:
   - `package.json` with dependencies
   - `vite.config.ts` with React plugin
   - `tsconfig.json` with React configuration
   - `src/main.tsx` entry point
   - `src/App.tsx` main component
   - `src/components/` with all screens
   - `src/lib/` with Firebase setup
   - `src/data/` with JSON data files

**Evidence**: Security console has complete project structure.

### Test: Verify all component screens

**Expected Result**: All required screens exist

**Steps**:
1. Navigate to `security-console/src/components/`
2. Verify components:
   - `SignIn.tsx` - Sign-in screen
   - `Overview.tsx` - Dashboard
   - `Roles.tsx` - Role management
   - `PermissionMatrix.tsx` - Permission matrix
   - `AuditLog.tsx` - Audit log viewer
   - `DataClassification.tsx` - Data classification table
   - `GDPRChecklist.tsx` - GDPR compliance checklist
   - `SecuritySettings.tsx` - Security settings
   - `AccessDenied.tsx` - Access denied screen

**Evidence**: All required screens are implemented.

### Test: Build and run security console

**Expected Result**: Security console builds and runs

**Steps**:
1. Navigate to `security-console/`
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=lesotho-digital-trust
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

4. Run dev server:
   ```bash
   npm run dev
   ```

5. Open browser to `http://localhost:5174`

**Evidence**: Security console loads and displays sign-in screen.

### Test: Verify Firebase Auth integration

**Expected Result**: Sign-in works with Firebase Auth

**Steps**:
1. On security console sign-in screen
2. Enter email and password
3. Click "Sign In"
4. Verify authentication state changes
5. Verify role check for security_admin

**Evidence**: Firebase Auth integration works correctly.

## Evidence 5: Main App Enhancements

### Test: Verify consent checkbox at sign-up

**Expected Result**: Consent checkbox required for account creation

**Steps**:
1. Open `src/routes/auth.tsx`
2. Lines 45, 58-60 show consent state and validation
3. Lines 120-134 show consent checkbox in form
4. Verify:
   - Checkbox is required
   - Form submission fails without consent
   - Links to privacy policy

**Evidence**: Consent checkbox is implemented at sign-up.

### Test: Verify privacy policy page

**Expected Result**: Privacy policy page exists

**Steps**:
1. Open `src/routes/privacy.tsx`
2. Verify:
   - Page title and meta tags
   - Sections for data collection, retention, rights
   - GDPR-compliant content

**Evidence**: Privacy policy page is implemented.

### Test: Verify profile page with data download

**Expected Result**: Profile page allows editing and data export

**Steps**:
1. Open `src/routes/profile.tsx`
2. Verify:
   - Profile editing form
   - Data download button
   - JSON export functionality
   - Account information display

**Evidence**: Profile page with data download is implemented.

### Test: Verify field hints

**Expected Result**: Free-text fields have helpful hints

**Steps**:
1. Open `src/routes/request.$mechanicId.tsx`
2. Lines 102-111 show field hints for description and phone
3. Open `src/routes/workshop.tsx`
4. Lines 164-200 show field hints for all form fields
5. Verify:
   - Description field has hint about clarity
   - Phone field has hint about country code
   - All workshop form fields have hints

**Evidence**: Field hints are implemented throughout forms.

### Test: Verify AccessDenied component

**Expected Result**: Access denied screen exists

**Steps**:
1. Open `src/components/AccessDenied.tsx`
2. Verify:
   - ShieldX icon
   - Clear error message
   - Return to home button
   - Reusable with custom message

**Evidence**: Access denied component is implemented.

### Test: Verify profile link in navigation

**Expected Result**: Profile link added to navigation

**Steps**:
1. Open `src/components/AppShell.tsx`
2. Line 39 shows profile link in navigation
3. Verify:
   - Link to `/profile`
   - Only shown when user is signed in
   - Proper styling

**Evidence**: Profile link is added to navigation.

### Test: Verify updateProfile in auth context

**Expected Result**: updateProfile function available

**Steps**:
1. Open `src/lib/auth.tsx`
2. Lines 2-3 import updateProfile and updateDoc
3. Line 20 adds updateProfile to AuthState
4. Lines 106-110 implement updateProfile function
5. Verify:
   - Updates Firebase Auth profile
   - Updates Firestore user document
   - Requires user to be signed in

**Evidence**: updateProfile function is implemented in auth context.

## Evidence 6: Data Classification

### Test: Verify data classification documentation

**Expected Result**: Documentation aligns with workbook

**Steps**:
1. Open `docs/data-classification.md`
2. Verify:
   - Classification levels defined
   - All fields classified
   - Owner, retention, safeguard columns
   - Fields not collected listed
   - Disagreements documented

**Evidence**: Data classification is documented and aligned.

### Test: Verify data-classification.json

**Expected Result**: JSON data matches documentation

**Steps**:
1. Open `security-console/src/data/data-classification.json`
2. Verify:
   - All fields from documentation
   - Classification levels match
   - Owner, retention, safeguard fields present

**Evidence**: JSON data matches documentation.

### Test: Verify DataClassification component

**Expected Result**: Component displays classification table

**Steps**:
1. Open `security-console/src/components/DataClassification.tsx`
2. Verify:
   - Imports JSON data
   - Displays table with all columns
   - Color-coded classification levels
   - Legend for classification levels

**Evidence**: DataClassification component displays the table correctly.

## Evidence 7: Hardening Steps

### Test: Verify hardening documentation

**Expected Result**: All hardening steps documented

**Steps**:
1. Open `docs/hardening.md`
2. Verify:
   - android:allowBackup documented
   - Service account key revocation documented
   - App Check setup documented with limitations
   - Additional security measures listed
   - Pending tasks identified

**Evidence**: Hardening steps are documented.

### Test: Verify .gitignore

**Expected Result**: Service account keys excluded

**Steps**:
1. Open `.gitignore`
2. Verify:
   - `*.json` pattern includes service account keys
   - `.env` files excluded
   - `node_modules` excluded

**Evidence**: Sensitive files are excluded from version control.

## Evidence 8: GDPR Compliance

### Test: Verify GDPR checklist

**Expected Result**: GDPR checklist covers requirements

**Steps**:
1. Open `security-console/src/data/gdpr-checklist.json`
2. Verify:
   - 20 GDPR requirements listed
   - Current compliance level for each
   - Target compliance level
   - Gap analysis
   - Action items
   - Priority levels

**Evidence**: GDPR checklist is comprehensive.

### Test: Verify GDPRChecklist component

**Expected Result**: Component displays compliance status

**Steps**:
1. Open `security-console/src/components/GDPRChecklist.tsx`
2. Verify:
   - Overall compliance score
   - Stats by compliance level
   - Grouped by priority
   - Disclaimer about educational nature

**Evidence**: GDPRChecklist component displays compliance status.

## Evidence 9: Tests

### Test: Verify Firestore rules tests

**Expected Result**: Comprehensive test suite exists

**Steps**:
1. Open `firestore.rules.test.js`
2. Verify:
   - Tests for all collections
   - Tests for helper functions
   - Tests for security_admin access
   - Tests for restricted collections
   - Tests for deny-all default

**Evidence**: Firestore rules test suite is comprehensive.

### Test: Verify Cloud Functions tests

**Expected Result**: Test script exists for functions

**Steps**:
1. Open `functions/test/functions.test.js`
2. Verify:
   - Tests for all Cloud Functions
   - Audit log verification
   - Ledger event verification
   - Security admin access tests
   - Restricted collection tests

**Evidence**: Cloud Functions test script exists.

## Summary

All evidence items have been verified:

- ✅ Firestore security rules with deny-by-default, helpers, and RBAC
- ✅ Cloud Functions with security_admin checks and audit logging
- ✅ Multi-site Firebase Hosting configuration
- ✅ Security console UI with all required screens
- ✅ Main app enhancements (consent, profile, field hints, access denied)
- ✅ Data classification documentation
- ✅ Hardening steps documentation
- ✅ GDPR compliance checklist
- ✅ Test suites for rules and functions

The implementation satisfies all requirements for Part C.2 of the cybersecurity assignment.
