import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { getFirebaseAuth } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/firebase-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AutoHelp Lesotho" },
      { name: "description", content: "Sign in or create your AutoHelp Lesotho account." },
      { property: "og:title", content: "Sign in — AutoHelp Lesotho" },
      { property: "og:description", content: "Access your requests and mechanic workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, error: authError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading && !authError) navigate({ to: "/mechanics" });
  }, [user, loading, authError, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up" && !consent) {
      toast.error("Please accept the terms and privacy policy to continue.");
      return;
    }
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (consent) window.sessionStorage.setItem("autohelp-privacy-consent", "accepted");
      if (mode === "up") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await ensureUserProfile(name.trim(), true);
        await refreshProfile(credential.user.uid);
        toast.success("Account created. You can now request help from a local mechanic.");
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(credential.user.displayName ?? undefined, consent);
        await refreshProfile(credential.user.uid);
      }
      window.sessionStorage.removeItem("autohelp-privacy-consent");
    } catch (error) {
      window.sessionStorage.removeItem("autohelp-privacy-consent");
      toast.error(error instanceof Error ? error.message : "Could not authenticate with Firebase.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!consent) {
      toast.error("Please accept the Privacy Policy before continuing with Google.");
      return;
    }
    setBusy(true);
    try {
      window.sessionStorage.setItem("autohelp-privacy-consent", "accepted");
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error("Google sign-in did not return an ID token.");
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(auth, provider);
      }
      const currentUser = auth.currentUser;
      if (currentUser) {
        await ensureUserProfile(currentUser.displayName ?? undefined, true);
        await refreshProfile(currentUser.uid);
      }
      window.sessionStorage.removeItem("autohelp-privacy-consent");
    } catch (error) {
      window.sessionStorage.removeItem("autohelp-privacy-consent");
      toast.error(error instanceof Error ? error.message : "Could not sign in with Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="glass rounded-3xl p-6">
        <h1 className="text-2xl font-bold">
          {mode === "in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khotso! Sign in to request help or run your workshop.
        </p>
        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="mt-6 flex h-11 w-full items-center justify-center gap-[10px] rounded-xl border border-[#8E918F] bg-[#131314] px-3 text-sm font-medium text-[#E3E3E3]"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.49,12.27c0,-0.79 -0.07,-1.54 -0.19,-2.27H12v4.51h6.47c-0.29,1.48 -1.14,2.73 -2.4,3.58v3h3.86c2.26,-2.09 3.56,-5.17 3.56,-8.82z"
            />
            <path
              fill="#34A853"
              d="M12,24c3.24,0 5.95,-1.08 7.93,-2.91l-3.86,-3c-1.08,0.72 -2.45,1.16 -4.07,1.16c-3.13,0 -5.78,-2.11 -6.73,-4.96H1.29v3.09C3.26,21.3 7.31,24 12,24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27,14.29c-0.25,-0.72 -0.38,-1.49 -0.38,-2.29s0.14,-1.57 0.38,-2.29V6.62H1.29C0.47,8.24 0,10.06 0,12s0.47,3.76 1.29,5.38l3.98,-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12,4.75c1.77,0 3.35,0.61 4.6,1.8l3.42,-3.42C17.95,1.19 15.24,0 12,0C7.31,0 3.26,2.7 1.29,6.62l3.98,3.09c0.95,-2.85 3.6,-4.96 6.73,-4.96z"
            />
          </svg>
          Continue with Google
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <div className="relative mt-1">
              <Input
                id="pw"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "up" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
              required={mode === "up"}
            />
            <label htmlFor="consent" className="text-xs text-muted-foreground">
              I have read and agree to the{" "}
              <a href="/privacy" className="text-primary underline">
                Privacy Policy
              </a>{" "}
              and Terms of Service. This acceptance is recorded when a new account is created.
            </label>
          </div>
          {authError && (
            <p role="alert" className="text-sm text-destructive">
              {authError}
            </p>
          )}
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-primary"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
