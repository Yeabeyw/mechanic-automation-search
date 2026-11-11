import { createFileRoute, Link } from "@tanstack/react-router";
import classification from "../../security-console/src/data/data-classification.json";

export const Route = createFileRoute("/data-classification")({
  head: () => ({ meta: [{ title: "Data Classification — AutoHelp Lesotho" }] }),
  component: DataClassificationPage,
});

function DataClassificationPage() {
  const rows = classification as Array<Record<string, string>>;
  const columns = [
    "Data item",
    "Example field",
    "Why",
    "Data owner",
    "Who may write",
    "Storage location",
    "Retention",
    "Key safeguards",
    "On-chain? (Y/N)",
    "Evidence/status",
    "tier",
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Data classification</h1>
        <p className="mt-2 text-muted-foreground">Authentication, requests, reviews, ledger, and audit data.</p>
        <Link to="/project" className="mt-3 inline-block text-primary underline">Back to Project evidence</Link>
      </header>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[1600px] text-left text-sm">
          <thead><tr>{columns.map((column) => <th className="p-3" key={column}>{column === "tier" ? "Classification tier" : column}</th>)}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr className="border-t align-top" key={row["Data item"]}>
              {columns.map((column) => <td className="p-3" key={column}>{row[column]}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        Firebase Authentication manages password credentials and session tokens; the app cannot read password hashes. Scheduled anonymisation and backend audit functions are not active until deployed.
      </p>
    </main>
  );
}
