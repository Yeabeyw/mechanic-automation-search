<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Firebase Authentication and Cloud Firestore are the app's only backend. Maintain Firestore rules, indexes, and Cloud Functions; do not add alternate backend integrations or SQL database migrations.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Blockchain records are appended only by database triggers via `public.ledger_append` (hash-chain in `ledger_blocks`); `src/lib/ledger.ts` must mirror its hashing formula exactly — why: browser re-verification depends on byte-identical inputs.
- Never put personal data (names, phones, emails, vehicle details, free text) into ledger payloads — why: on-chain data cannot be erased (GDPR Art. 17).
- Status transitions and admin-only fields are enforced by DB triggers (`requests_guard`, `mechanics_guard`), not the UI — why: role permissions must hold for any client.
