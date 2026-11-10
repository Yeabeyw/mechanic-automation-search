# Data Classification Documentation

This document documents the data classification for AutoHelp Lesotho, covering Part C.1 of the cybersecurity assignment.

## Classification Levels

- **Public**: Data that can be freely shared with anyone
- **Private**: Data that belongs to the user and should only be accessible to the user and authorized parties
- **Confidential**: Sensitive data that requires restricted access (e.g., roles, verification status)
- **Restricted**: Highly sensitive data with very limited access (e.g., cryptographic secrets)

## Data Fields Classification

| Field | Classification | Owner | Retention Period | Safeguard |
|-------|---------------|--------|-----------------|-----------|
| User ID (uid) | Private | User | Until account deletion | Firestore with security rules |
| Full name | Private | User | Until account deletion | Firestore with security rules |
| Email address | Private | User | Until account deletion | Firebase Auth + Firestore |
| User roles (admin, mechanic, security_admin) | Confidential | System | Until account deletion | Firestore with security rules + Cloud Functions |
| Mechanic code | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Mechanic name | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Workshop name | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Town | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Experience years | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Specialties | Private (verified mechanics: Public) | Mechanic | Until account deletion | Firestore with security rules |
| Mechanic verification status | Confidential | System | Until account deletion | Firestore with security rules + audit log |
| Service request reference | Private | Customer | 2 years after completion | Firestore with security rules |
| Vehicle make/model/year | Private | Customer | 2 years after completion | Firestore with security rules |
| Repair category | Private | Customer | 2 years after completion | Firestore with security rules |
| Description | Private | Customer | 2 years after completion | Firestore with security rules |
| Contact phone | Private | Customer | 2 years after completion | Firestore with security rules |
| Request status | Private | System | 2 years after completion | Firestore with security rules |
| Review rating | Public | Customer | Indefinite | Firestore (public read) |
| Review comment | Public | Customer | Indefinite | Firestore (public read) |
| Ledger block hash | Public | System | Indefinite | Firestore (public read) |
| Ledger secrets (salt) | Restricted | System | Indefinite | Firestore (no client access) |
| Security audit log entries | Confidential | Security Admin | 7 years | Firestore (security_admin only) + append-only |

## Fields Not Currently Collected

The following fields are not currently collected by the application:

1. **Customer address** - Not collected; only town/area for mechanics
2. **Customer ID document** - Not collected; only Firebase UID used
3. **Mechanic license number** - Not collected; verification done by admin
4. **Mechanic business registration** - Not collected; verification done by admin
5. **Payment information** - Not collected; no payment processing in current scope
6. **Location coordinates** - Not collected; only town/area text

## Classification Decisions

The following decisions were made for data classification:

1. **Review rating/comment classified as Public**: These are displayed on mechanic profiles for transparency and trust-building. Users are informed that reviews are public when submitting them.

2. **Service request data retention**: 2 years after completion is used as a reasonable balance between business needs and data minimization. Note: Automated deletion is not yet implemented.

3. **Ledger block hash as Public**: The ledger is designed for transparency and verifiability. The hash alone does not reveal sensitive information.

4. **Verified mechanic profiles as Public**: Verified mechanic information is publicly accessible to allow customers to find and compare mechanics. Unverified mechanics remain private.

5. **No customer address collection**: Only town/area is collected for privacy reasons and because mechanics can contact customers directly via phone.

## Notes

- All classifications are implemented through Firestore security rules and Cloud Functions
- The `security_audit` collection is append-only and read-only for security_admin
- The `ledger_secrets` and `ledger_state` collections are completely denied to all clients
- User roles are managed through Cloud Functions with server-side security_admin checks
- Audit logging is performed for all role changes and mechanic verifications
- Retention periods are documented but automated deletion is not yet implemented
- This classification aligns with both GDPR and the Lesotho Data Protection Act 2021
