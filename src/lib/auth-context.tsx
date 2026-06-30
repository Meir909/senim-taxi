import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type DriverVerification = Database["public"]["Enums"]["driver_verification"];

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  /** Driver role granted AND verification approved. Use this to gate driver-only UI. */
  isDriver: boolean;
  /** A driver application/profile row exists (regardless of approval state). */
  hasDriverApplication: boolean;
  /** Current driver verification status, or null if no application. */
  driverVerification: DriverVerification | null;
  refreshDriver: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driverVerification, setDriverVerification] = useState<DriverVerification | null>(null);
  const [hasDriverApplication, setHasDriverApplication] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAccount(uid: string) {
      const [{ data: roleRows }, { data: driverRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("drivers").select("verification").eq("id", uid).maybeSingle(),
      ]);
      if (!mounted) return;
      setRoles((roleRows ?? []).map((r) => r.role));
      setHasDriverApplication(Boolean(driverRow));
      setDriverVerification(driverRow?.verification ?? null);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => void loadAccount(s.user.id), 0);
      } else {
        setRoles([]);
        setDriverVerification(null);
        setHasDriverApplication(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadAccount(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasDriverRole = roles.includes("driver");
  const isDriver = hasDriverRole && driverVerification === "approved";

  async function refreshDriver() {
    const uid = session?.user?.id;
    if (!uid) return;
    const [{ data: roleRows }, { data: driverRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("drivers").select("verification").eq("id", uid).maybeSingle(),
    ]);
    setRoles((roleRows ?? []).map((r) => r.role));
    setHasDriverApplication(Boolean(driverRow));
    setDriverVerification(driverRow?.verification ?? null);
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        roles,
        loading,
        isDriver,
        hasDriverApplication,
        driverVerification,
        refreshDriver,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
