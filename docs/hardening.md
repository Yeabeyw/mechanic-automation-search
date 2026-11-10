# Hardening Steps

This document outlines the hardening steps implemented for AutoHelp Lesotho to improve security posture.

## Implemented Hardening

### 1. android:allowBackup

**Status**: Documented for Android implementation

For the Android version of AutoHelp Lesotho, the `android:allowBackup` attribute should be set to `false` in the `AndroidManifest.xml` file to prevent backup of application data.

```xml
<application
    android:allowBackup="false"
    ...>
```

This prevents:
- Unauthorized backup of app data via ADB
- Data extraction from backup files
- Potential data leakage through backup services

**Note**: This is a configuration step for the Android app. The current implementation is web-based, so this applies when/if an Android app is developed.

### 2. Service Account Key Revocation

**Status**: Documented

Service account keys should be:
- Never committed to version control
- Rotated regularly (every 90 days recommended)
- Revoked immediately if exposed
- Stored securely in environment variables or secret management systems

**Current Status**:
- The `.gitignore` file should include `*.json` for service account keys
- No service account keys are committed to the repository
- Keys should be loaded from environment variables in production

**Action Required**:
1. Verify that `adminsdk.json` or any service account keys are in `.gitignore`
2. If any keys were previously committed, rotate them immediately
3. Use Firebase CLI with authenticated session instead of service account keys when possible

### 3. App Check Setup

**Status**: Documented (not implemented due to Spark plan limitations)

Firebase App Check provides protection against:
- Abuse of your backend resources
- Billing fraud
- Phishing attacks
- Unauthorized API access

**Current Limitation**:
- App Check requires the Blaze (pay-as-you-go) Firebase plan
- The project is currently on the Spark (free) plan
- App Check cannot be enabled without upgrading

**Compensating Controls**:
- Firestore security rules enforce deny-by-default access
- Cloud Functions perform server-side role checks
- Audit logging tracks all security-relevant actions
- Rate limiting can be implemented at the Cloud Functions level

**Future Implementation** (when upgrading to Blaze):
1. Enable App Check for web apps using reCAPTCHA v3
2. Enable App Check for Android apps using Play Integrity API
3. Configure App Check in Firebase Console
4. Update Cloud Functions to verify App Check tokens
5. Update Firestore rules to check App Check tokens

## Additional Security Measures

### 4. Firestore Security Rules

**Status**: Implemented

- Deny-by-default policy
- Explicit CRUD permissions for each collection
- Role-based access control (RBAC)
- Helper functions for common checks
- Security audit collection with restricted access

### 5. Cloud Functions Security

**Status**: Implemented

- Server-side role verification
- Audit logging for sensitive operations
- Ledger event append for immutable records
- Separation of duties (Admin cannot grant roles, Security Admin cannot verify mechanics)

### 6. Authentication Security

**Status**: Implemented

- Email/password authentication with Firebase Auth
- Google Sign-In support
- Password policy enforced by Firebase Auth
- Session management with configurable duration

**Note**: Multi-factor authentication (MFA) is not available on the Spark plan. As a compensating control, Security Admins should enable Google 2-Step Verification on their Google accounts.

### 7. Data Encryption

**Status**: Implemented by Firebase

- Data encrypted at rest in Firestore
- Data encrypted in transit via HTTPS
- Firebase manages encryption keys

### 8. Separation of Security Console

**Status**: Implemented

- Separate Firebase Hosting site for security console
- Separate Firebase Auth session
- Custom domain for security console (to be configured)
- Access restricted to security_admin role only

## Pending Hardening Tasks

1. **Upgrade to Blaze Plan**: Required for App Check implementation
2. **Custom Domain Configuration**: Set up DNS records for security console domain
3. **Rate Limiting**: Implement rate limiting on Cloud Functions
4. **Monitoring**: Set up Firebase Monitoring and alerting
5. **Regular Security Audits**: Schedule periodic security reviews

## References

- [Firebase Security Best Practices](https://firebase.google.com/docs/security)
- [Android Security Guidelines](https://developer.android.com/topic/security/best-practices)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
