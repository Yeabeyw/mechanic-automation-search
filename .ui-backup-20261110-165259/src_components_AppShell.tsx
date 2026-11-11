import { Link } from "@tanstack/react-router";
import { Home, Search, ClipboardList, Link2, User, Wrench, ShieldCheck, Database } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getFirebaseSetupError, isFirebaseMutationsEnabled } from "@/integrations/firebase/client";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <Wrench className="size-5 text-primary-foreground" />
      </span>
      <span className="font-display text-lg font-bold leading-none">
        AutoHelp <span className="text-gradient">Lesotho</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, hasRole, signOut, error } = useAuth();
  const firebaseError = getFirebaseSetupError() ?? error;
  const navLink =
    "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors";
  const active = { className: "rounded-lg px-3 py-2 text-sm bg-accent text-foreground" };

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/mechanics" className={navLink} activeProps={active}>
              Find a mechanic
            </Link>
            {user && (
              <Link to="/requests" className={navLink} activeProps={active}>
                My requests
              </Link>
            )}
            {user && (
              <Link to="/workshop" className={navLink} activeProps={active}>
                Mechanic workspace
              </Link>
            )}
            {user && (
              <Link to="/profile" className={navLink} activeProps={active}>
                Profile
              </Link>
            )}
            {hasRole("admin") && (
              <Link to="/admin" className={navLink} activeProps={active}>
                Admin
              </Link>
            )}
            <Link to="/ledger" className={navLink} activeProps={active}>
              Ledger
            </Link>
            <Link to="/dataset" className={navLink} activeProps={active}>
              AI Dataset
            </Link>
            <Link to="/ai-dashboards" className={navLink} activeProps={active}>
              AI Dashboards
            </Link>
            <Link to="/project" className={navLink} activeProps={active}>
              Assignment evidence
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="glass" size="sm" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <Button asChild variant="hero" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      {firebaseError && (
        <div role="alert" className="mx-auto mt-4 max-w-6xl px-4">
          <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            {firebaseError}
          </p>
        </div>
      )}
      {!isFirebaseMutationsEnabled() && (
        <div role="status" className="mx-auto mt-4 max-w-6xl px-4">
          <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            Limited mode: Firebase Authentication and account profiles work, and public information
            is available. Service requests, mechanic applications, profile edits, and other
            protected updates need Cloud Functions, which are not enabled on this free-plan
            deployment.
          </p>
        </div>
      )}
      <main>{children}</main>
      <footer className="mx-auto hidden max-w-6xl px-4 py-10 text-xs text-muted-foreground md:block">
        AutoHelp Lesotho · BIDT3110 group project · Mechanic profiles marked “Demo” are sample data.
      </footer>
      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl py-2 md:hidden">
        <BottomLink to="/" icon={<Home />} label="Home" />
        <BottomLink to="/mechanics" icon={<Search />} label="Find" />
        <BottomLink to="/requests" icon={<ClipboardList />} label="Requests" />
        <BottomLink to="/ledger" icon={<Link2 />} label="Ledger" />
        <BottomLink to="/dataset" icon={<Database />} label="Dataset" />
      </nav>
    </div>
  );
}

function BottomLink({
  to,
  icon,
  label,
}: {
  to: "/" | "/mechanics" | "/requests" | "/ledger" | "/dataset" | "/admin" | "/workshop" | "/auth";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground [&_svg]:size-5"
      activeProps={{
        className:
          "flex flex-col items-center gap-0.5 px-2 text-[11px] text-primary [&_svg]:size-5",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
