# Lesotho Digital Trust

Assignment: Using disruptive technologies – AI, Cybersecurity, and Blockchain to enhance digital solutions in a way that aligns to customers’ consumption needs in a digital era. Task Description This assignment is a continuation of Test 2 but with a different picture. The task is done in groups where members agree on the best design from the test, and be presented to the lecturer for approval. Below is an overview of activities to perform: PART A: SOFTWARE DEVELOPMENT 1. Implement an application and host it on the platform of your choice. [5] PART B: BLOCKCHAIN TECHNOLOGY Group Assignment 40% 1. For distributed processing, transparency, and integrity, store data records on a blockchain. [20] PART C: CYBERSECURITY 1. Classify the data that the application handles into public, private, confidential, and restricted. [8] 2. Configure read and write permissions on how the actors access different modules of the application. The application must have the security configuration module with a different domain. [8+4] 3. Highlight the application compliance levels with GDPR. [5] Note: 1 and 3 are completed on a spreadsheet PART D: ARTIFICIAL INTELLIGENCE 1. Considering the objective of the application; either being to increase sales, boost engagement on a streaming service, or enhance content discovery, find datasets relevant to your topic, and build your own dataset. [5] 2. Train an AI model using your dataset to perform analysis and predictions that align the objectives of the application. Note: build dashboards [20+15+10] 3. Ensure that you understand accuracy and saturation levels of the selected algorithms. [5]


I want us to go step by step start with part A and B then we will go further with it after
Remember this has to be Lesotho based

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/659f829f-55db-43fa-b876-984adb40c917).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Android app (Capacitor)

The Android project uses Capacitor 8. Its package ID is `ls.co.autohelp`, and the Android launcher icon and splash-screen resources are generated from [`assets/logo.svg`](./assets/logo.svg).

### Requirements

- Node.js 22 or later
- JDK 21 (Android Studio's embedded JDK is recommended)
- Android Studio with the Android SDK and an emulator or Android device

### Run the web app in the Android emulator

1. Install the project dependencies with `npm install` (or `bun install`).
2. In one terminal, start the Vite server: `npm run dev:android`.
3. In a second terminal, sync and open the Android project:

   ```sh
   npm run android:sync
   npm run android:open
   ```

4. In Android Studio, wait for Gradle sync, select an emulator or connected device, and press **Run**.

The default emulator URL is `http://10.0.2.2:5173`. This is a development-only live-reload setup; keep the Vite server running while testing. A physical Android device must use the computer's reachable LAN address instead:

```powershell
$env:CAPACITOR_SERVER_URL = "http://192.168.1.10:5173"
npm run android:sync
```

Replace the example address with the computer's LAN IP. For a deployed build, set `CAPACITOR_SERVER_URL` to the published HTTPS app URL before syncing. The development cleartext exception is enabled only for an `http://` server URL.

`capacitor-web/index.html` is a small local fallback required by Capacitor's project sync. The app itself is served from the configured Vite or published URL; this TanStack Start project does not produce a standalone static `index.html` bundle.

To regenerate the Android launcher and splash resources after changing the logo, run `npm run android:assets`, then `npm run android:sync`.

## Firebase setup for the Android app

The Android app uses Firebase Authentication and Cloud Firestore through the Firebase JavaScript SDK inside its Capacitor WebView. Registering a Firebase **Web app** in the project is needed to obtain that SDK configuration; it does not turn AutoHelp into a website or change the Android app target. `VITE_FIREBASE_MUTATIONS_ENABLED` defaults to `false`, so the app stays read-only and makes no Cloud Functions requests until a secure backend is deployed.

1. Use the `musolink-lesotho` Firebase project. Its registered Web app configuration is in your Firebase Console under **Project settings**.
2. Put the Web app SDK configuration in a local `.env` file based on [`.env.example`](./.env.example). These values identify the Firebase project and are not server credentials.
3. In **Authentication → Sign-in method**, enable Email/Password. Enable Google only if Google sign-in is required and complete its provider setup.
4. Create the Firestore database. Register the Android app as `ls.co.autohelp` (not the Firebase Console placeholder `com.company.appname`) and download its `google-services.json` into `android/app/`. Use the Web app configuration from step 2 for the JavaScript SDK; the Android config file is needed for native Google sign-in.
5. To enable app mutations, upgrade the Firebase project to the **Blaze (pay-as-you-go) plan** before deploying Cloud Functions. Functions use Firebase Admin SDK writes to enforce role and ownership checks, so they cannot be replaced with unrestricted client writes. Enable billing only if you accept Google Cloud usage charges. Until then, leave the app in read-only mode.
6. After upgrading, install the Firebase CLI, select the project, and build/deploy the backend:

   ```powershell
   npm install
   npm install --prefix functions
   npm run --prefix functions build
   npx --yes firebase-tools login
   npx --yes firebase-tools use --add
   npx --yes firebase-tools deploy --only firestore:rules,firestore:indexes,functions
   ```

   Cloud Functions are configured for `africa-south1`. The selected Firebase project must support deploying Functions in that region.
7. After a successful deployment, set `VITE_FIREBASE_MUTATIONS_ENABLED=true` in the local `.env`, then restart the app. Do not enable the flag before the callable functions are deployed.
8. Create an account in the app. The `ensureUserProfile` function creates a customer profile. To bootstrap the first administrator, find that account's UID in Firebase Authentication and add `"admin"` to the `roles` array on `users/{uid}` in Firestore. Do not grant roles from the client.
9. Run `npm run android:sync` to register the native Firebase plugin, then follow the Android development steps above. For a release, build the app with the Firebase `.env` values set, then sync and package it with Android Studio.

Firestore client writes are blocked by [`firestore.rules`](./firestore.rules); authenticated Cloud Functions validate and perform app mutations. Rules and required query indexes are deployed with the command above. Keep any Functions secrets out of the client `.env`.

If a browser reports CORS errors for `ensureUserProfile` or another callable function, first confirm Cloud Functions has been deployed to the configured project and `africa-south1` region. Callable functions handle CORS automatically; a 404 / missing `Access-Control-Allow-Origin` response usually means the endpoint is not deployed or its APIs are unavailable, not that browser CORS should be bypassed.

If a browser reports CORS errors for `ensureUserProfile` or another callable function, first confirm Cloud Functions has been deployed to the configured project and `africa-south1` region. Callable functions handle CORS automatically; a 404 / missing `Access-Control-Allow-Origin` response usually means the endpoint is not deployed or its APIs are unavailable, not that browser CORS should be bypassed.

Existing accounts and records are not automatically imported into Firebase. Any existing data needs a deliberate export/import; users may need to create new Firebase Authentication accounts.

## Record integrity ledger

Cloud Functions append SHA-256 fingerprints to a Firestore hash chain when mechanics or service requests are created or changed. Random salts are kept in a separate, client-inaccessible Firestore collection, and the public ledger payload excludes names, contact details, and vehicle descriptions. The audit view asks a callable function to verify a record fingerprint.

Historical ledger entries are not imported. To anchor new Firestore ledger checkpoints to Ethereum Sepolia, deploy the contract with `npm run anchor:deploy`, then set `ANCHOR_RPC_URL` and `ANCHOR_PRIVATE_KEY` in the ignored local `.env.anchor` file and run `npm run anchor`. The script reads publicly readable Firestore ledger blocks, verifies the full hash chain, then writes the transaction checkpoint to `public/anchors.json`. Never commit the private key. A Firestore hash-chain proof is not a public-chain anchor until the transaction succeeds.

The current TanStack Start build includes a server-rendered Nitro output and does not create a static Hosting `index.html`. Do not deploy `.output/public` as a standalone website; configure a compatible Firebase Hosting server backend before publishing the web build. The Android app can continue using Firebase directly.
