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
  isDriver: boolean;
  hasDriverApplication: boolean;
  driverVerification: DriverVerification | null;
  isBlocked: boolean;
  blockedReason: string | null;
  refreshDriver: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driverVerification, setDriverVerification] = useState<DriverVerification | null>(null);
  const [hasDriverApplication, setHasDriverApplication] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAccount(uid: string) {
      const [{ data: roleRows }, { data: driverRow }, { data: profileRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("drivers").select("verification").eq("id", uid).maybeSingle(),
        supabase.from("profiles").select("blocked_at, blocked_reason").eq("id", uid).maybeSingle(),
      ]);
      if (!mounted) return;
      setRoles((roleRows ?? []).map((r) => r.role));
      setHasDriverApplication(Boolean(driverRow));
      setDriverVerification(driverRow?.verification ?? null);
      setIsBlocked(Boolean(profileRow?.blocked_at));
      setBlockedReason(profileRow?.blocked_reason ?? null);
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
        setIsBlocked(false);
        setBlockedReason(null);
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
    const [{ data: roleRows }, { data: driverRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("drivers").select("verification").eq("id", uid).maybeSingle(),
      supabase.from("profiles").select("blocked_at, blocked_reason").eq("id", uid).maybeSingle(),
    ]);
    setRoles((roleRows ?? []).map((r) => r.role));
    setHasDriverApplication(Boolean(driverRow));
    setDriverVerification(driverRow?.verification ?? null);
    setIsBlocked(Boolean(profileRow?.blocked_at));
    setBlockedReason(profileRow?.blocked_reason ?? null);
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
        isBlocked,
        blockedReason,
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
