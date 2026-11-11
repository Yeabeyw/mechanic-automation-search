import { Link } from "@tanstack/react-router";
import {
  Home,
  Search,
  ClipboardList,
  Link2,
  User,
  LogIn,
  Wrench,
  Hammer,
  ShieldCheck,
  Database,
  BarChart3,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getFirebaseSetupError } from "@/integrations/firebase/client";

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
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
              Blockchain ledger
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
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted-foreground">
        <p>AutoHelp Lesotho · BIDT3110 group project · Mechanic profiles marked “Demo” are sample data.</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/gdpr" className="hover:text-foreground">GDPR</Link>
          <Link to="/data-classification" className="hover:text-foreground">Data classification</Link>
          <Link to="/project" className="hover:text-foreground">Assignment evidence</Link>
        </p>
      </footer>
      <nav
        aria-label="Primary"
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex overflow-x-auto rounded-2xl py-2 [scrollbar-width:none] md:hidden"
      >
        <BottomLink to="/" icon={<Home />} label="Home" />
        <BottomLink to="/mechanics" icon={<Search />} label="Find" />
        <BottomLink to="/requests" icon={<ClipboardList />} label="Requests" />
        <BottomLink to="/dataset" icon={<Database />} label="Dataset" />
        <BottomLink to="/ai-dashboards" icon={<BarChart3 />} label="AI" />
        {user && <BottomLink to="/workshop" icon={<Hammer />} label="Workshop" />}
        <BottomLink to="/ledger" icon={<Link2 />} label="Chain" />
        {hasRole("admin") && <BottomLink to="/admin" icon={<ShieldCheck />} label="Admin" />}
        {user ? (
          <BottomLink to="/profile" icon={<User />} label="Profile" />
        ) : (
          <BottomLink to="/auth" icon={<LogIn />} label="Sign in" />
        )}
      </nav>
    </div>
  );
}

function BottomLink({
  to,
  icon,
  label,
}: {
  to: "/" | "/mechanics" | "/requests" | "/ledger" | "/dataset" | "/ai-dashboards" | "/admin" | "/workshop" | "/auth" | "/profile";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex min-w-[4.25rem] flex-1 flex-col items-center gap-0.5 px-2 py-1 text-[11px] text-muted-foreground [&_svg]:size-5"
      activeProps={{
        className:
          "flex min-w-[4.25rem] flex-1 flex-col items-center gap-0.5 px-2 py-1 text-[11px] text-primary [&_svg]:size-5",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}