import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AutoHelp Lesotho" },
      {
        name: "description",
        content: "AutoHelp Lesotho privacy policy and data handling practices.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <article className="glass space-y-8 rounded-3xl p-8">
        <header>
          <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            How AutoHelp Lesotho processes account and repair-service information.
          </p>
        </header>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Data we collect and why</h2>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            <li>Account identifiers and profile name to create and secure your account.</li>
            <li>Mechanic workshop details to list verified repair providers.</li>
            <li>
              Repair request details, vehicle information, and contact phone to coordinate the
              requested service.
            </li>
            <li>Ratings and review comments to describe completed services.</li>
            <li>
              Security event metadata to investigate access and role changes. Password hashes and
              session tokens are managed by Firebase Authentication and are not readable by
              AutoHelp.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Lawful basis</h2>
          <p className="text-muted-foreground">
            The proposed basis for handling a repair request is necessity to provide the service you
            request (GDPR Art. 6(1)(b)). Consent (Art. 6(1)(a)) is recorded with a server timestamp
            when a basic customer profile is created. Security logging may rely on legitimate
            interests (Art. 6(1)(f)) only after the controller documents and approves a balancing
            assessment. The controller must confirm these bases for each purpose under the Lesotho
            Data Protection Act 2021 and applicable law; this notice is not legal advice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Who may see your data</h2>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            <li>
              You can see your own profile and requests. Before accepting a job, a mechanic sees
              only its category and reference; vehicle, problem, customer name, and phone details
              are available only to the mechanic who accepts it.
            </li>
            <li>Business administrators can review business records for service operations.</li>
            <li>
              Security Administrators can review security audit records but are denied access to
              business request records by Firestore rules.
            </li>
            <li>
              Visitors can see verified mechanic directory information, public reviews, and public
              ledger proofs. Do not put personal or sensitive details in review comments.
            </li>
            <li>
              Google Firebase processes authentication and database hosting for the project. Records
              are configured for Firestore in the Africa South region.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Retention</h2>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            <li>
              <strong>Accounts:</strong> until deletion is requested and processed.
            </li>
            <li>
              <strong>Service requests:</strong> 12 months from creation, followed by anonymisation.
            </li>
            <li>
              <strong>Reviews:</strong> no automated deletion period is implemented; review comments
              may be public and should not contain personal details.
            </li>
            <li>
              <strong>Security audit logs:</strong> 7 years is the documented target; automated
              deletion is not configured.
            </li>
            <li>
              <strong>Ledger proofs:</strong> hash fingerprints may remain indefinitely to preserve
              tamper evidence.
            </li>
          </ul>
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            The 12-month rule is the intended retention policy. Its scheduled anonymisation function
            is source-only and has not been deployed; do not treat automatic deletion as active.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Your rights and requests</h2>
          <p className="text-muted-foreground">
            Subject to applicable law, you may request access, correction, erasure, restriction,
            portability, or object to processing. You can edit profile details and export available
            records on the{" "}
            <Link to="/profile" className="text-primary underline">
              Profile / My data
            </Link>{" "}
            page. Account deletion requires a secure server function and remains unavailable until
            that backend is deployed; contact the project administrator to make a request in the
            meantime.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Deletion and the ledger</h2>
          <p className="text-muted-foreground">
            Deleting an account can remove or anonymise profile and service data, but cannot reverse
            an already published cryptographic hash. Ledger entries are designed to contain only
            minimised metadata and salted hashes, not names, email, phone numbers, passwords,
            session tokens, or free text. A retained hash may still be linkable in some
            circumstances; this risk needs review before real production use.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Security and status</h2>
          <p className="text-muted-foreground">
            Firestore rules deny direct business-record writes and deny access by default; they
            allow a signed-in user to create only their own basic customer profile with consent,
            without granting roles. Sign-in, registration, and consent persistence work
            independently of Cloud Functions. Service updates, profile corrections, audit events,
            account deletion, and scheduled anonymisation still require deployed Cloud Functions and
            remain unavailable in this free-plan deployment.
          </p>
        </section>

        <footer className="text-sm text-muted-foreground">
          <p>
            Data protection framework: Lesotho Data Protection Act 2021; GDPR articles are
            referenced in the{" "}
            <Link to="/gdpr" className="text-primary underline">
              readiness checklist
            </Link>
            .
          </p>
          <p className="mt-2">
            Last updated: March 2026. A controller contact address must be supplied before public
            production use.
          </p>
        </footer>
      </article>
    </div>
  );
}
