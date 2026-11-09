import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import {
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseMutationsEnabled,
} from "@/integrations/firebase/client";
import { ensureUserProfile } from "@/lib/firebase-data";

export type AppRole = "customer" | "mechanic" | "admin" | "security_admin";

type AuthState = {
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Firebase authentication failed.";
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
          if (isFirebaseMutationsEnabled()) {
            await ensureUserProfile(currentUser.displayName ?? undefined);
          }
          const profile = await getDoc(doc(getFirebaseDb(), "users", currentUser.uid));
          if (!active) return;
          if (!profile.exists()) {
            throw new Error(
              "Your Firebase user profile is not available. New profiles require the secure Firebase backend, which is currently disabled in read-only mode.",
            );
          }
          const profileRoles: unknown = profile.data()["roles"];
          if (
            !Array.isArray(profileRoles) ||
            !profileRoles.every(
              (role): role is AppRole =>
                role === "customer" ||
                role === "mechanic" ||
                role === "admin" ||
                role === "security_admin",
            )
          ) {
            throw new Error("Your Firebase user profile has invalid role data.");
          }
          setRoles(profileRoles);
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
