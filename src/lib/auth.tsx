import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/integrations/firebase/client";
import { ensureUserProfile, updateMyProfile } from "@/lib/firebase-data";

export type AppRole = "customer" | "admin" | "security_admin";

type AuthState = {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: (uid?: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Firebase authentication failed.";
}

function getProfileRoles(value: unknown): AppRole[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (role): role is AppRole =>
        role === "customer" || role === "admin" || role === "security_admin" || role === "mechanic",
    )
  ) {
    throw new Error("Your Firebase user profile has invalid role data.");
  }
  return (value as string[]).filter((role): role is AppRole => role !== "mechanic");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setRoles([]);
        setError(null);
        if (!currentUser) {
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const consentAccepted =
            typeof window !== "undefined" &&
            window.sessionStorage.getItem("autohelp-privacy-consent") === "accepted";
          if (consentAccepted) {
            await ensureUserProfile(currentUser.displayName ?? undefined, true);
            window.sessionStorage.removeItem("autohelp-privacy-consent");
          }
          const profile = await getDoc(doc(getFirebaseDb(), "users", currentUser.uid));
          if (!active) return;
          if (!profile.exists()) {
            throw new Error(
              "Your AutoHelp profile is missing. Accept the Privacy Policy during sign-in to create a basic customer profile.",
            );
          }
          setRoles(getProfileRoles(profile.data()["roles"]));
        } catch (profileError) {
          console.error("[Firebase] Could not load the signed-in user's profile.", profileError);
          if (active) setError(errorMessage(profileError));
        } finally {
          if (active) setLoading(false);
        }
      });
    } catch (initializationError) {
      console.error("[Firebase] Could not initialize authentication.", initializationError);
      setError(errorMessage(initializationError));
      setLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        loading,
        error,
        hasRole: (role) => roles.includes(role),
        signOut: async () => {
          await signOut(getFirebaseAuth());
        },
        refreshProfile: async (uid) => {
          const profileUid = uid ?? user?.uid;
          if (!profileUid) throw new Error("Sign in before refreshing your profile.");
          setLoading(true);
          setError(null);
          try {
            const profile = await getDoc(doc(getFirebaseDb(), "users", profileUid));
            if (!profile.exists()) throw new Error("Your AutoHelp profile could not be found.");
            setRoles(getProfileRoles(profile.data()["roles"]));
          } catch (profileError) {
            setError(errorMessage(profileError));
            throw profileError;
          } finally {
            setLoading(false);
          }
        },
        updateProfile: async (name: string) => {
          if (!user) throw new Error("No user signed in");
          await updateMyProfile(name);
          await updateFirebaseProfile(user, { displayName: name });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
