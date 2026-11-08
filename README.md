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

## Record integrity ledger

The database appends a SHA-256 fingerprint when a mechanic is verified or updated, a service request is created or changes status, and a request is deleted. Fingerprints cover selected current-record fields; per-entry random salts stay in a private database table and are only returned to users allowed to read that record. Names, contact details, vehicle descriptions, and the salts are not placed in the public ledger payload or Solidity event. The audit view recomputes the fingerprint from the current record and compares it with the latest proof.

Apply [`drizzle/migrations/0001_record_fingerprints.sql`](./drizzle/migrations/0001_record_fingerprints.sql) to the connected Supabase database after the initial schema migration. This enables fingerprints for new records and appends a current-state proof for existing mechanics and requests. Until an RPC endpoint, deployed contract, and server-side wallet are configured, proofs are explicitly simulated in the database; no public-chain transaction hash is claimed.
