import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AutoHelp Lesotho" },
      { name: "description", content: "AutoHelp Lesotho privacy policy and data handling practices." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="glass rounded-3xl p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Who We Are</h2>
          <p className="text-muted-foreground">
            AutoHelp Lesotho is a vehicle repair assistance platform connecting customers with local mechanics in Lesotho.
            We collect and process personal data to facilitate service requests and improve our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">What Data We Collect</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Account information:</strong> Name, email address, user ID</li>
            <li><strong>Mechanic profiles:</strong> Workshop name, location, specialties, experience</li>
            <li><strong>Service requests:</strong> Vehicle details, repair category, description, contact phone</li>
            <li><strong>Reviews:</strong> Ratings and comments on completed services</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Why We Collect It</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>To process service requests and connect customers with mechanics</li>
            <li>To verify mechanic credentials and maintain quality standards</li>
            <li>To provide reviews and ratings for service quality</li>
            <li>To maintain an immutable ledger of service transactions</li>
            <li>To comply with legal and regulatory requirements</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">How Long We Keep It</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>User profiles:</strong> Until account deletion</li>
            <li><strong>Service requests:</strong> 2 years after completion (automated deletion not yet implemented)</li>
            <li><strong>Reviews:</strong> Indefinite (public)</li>
            <li><strong>Security audit log:</strong> 7 years (automated deletion not yet implemented)</li>
            <li><strong>Ledger blocks:</strong> Indefinite (immutable)</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">Note: Automated data deletion based on retention periods is not yet implemented. Data is retained until manually deleted or when automated deletion is implemented.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
          <p className="text-muted-foreground mb-3">
            Under the Lesotho Data Protection Act 2021 and GDPR principles, you have the right to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Access your personal data (implemented via Profile page)</li>
            <li>Correct inaccurate data (implemented via Profile page)</li>
            <li>Request deletion of your account and data (not yet implemented - contact support)</li>
            <li>Object to processing of your data (not yet implemented - contact support)</li>
            <li>Data portability (export your data as JSON - implemented via Profile page)</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">For requests not yet implemented in the app, please contact our support team.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Where We Store It</h2>
          <p className="text-muted-foreground">
            Your data is stored securely in Google Cloud Firestore (Africa South region) with role-based access controls.
            Security audit logs are restricted to Security Administrators only. Ledger secrets are never accessible to clients.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
          <p className="text-muted-foreground">
            For questions about this privacy policy or your data rights, please contact us through the app or at our support email.
          </p>
        </section>

        <div className="text-sm text-muted-foreground">
          <p>Last updated: November 2026</p>
          <p>This policy is part of our GDPR compliance efforts and may be updated as regulations change.</p>
        </div>
      </div>
    </div>
  );
}
