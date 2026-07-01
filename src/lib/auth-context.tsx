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

<<<<<<< HEAD
const EMPTY_ACCOUNT_STATE = {
  roles: [] as AppRole[],
  driverVerification: null as DriverVerification | null,
  hasDriverApplication: false,
  isBlocked: false,
  blockedReason: null as string | null,
};

=======
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driverVerification, setDriverVerification] = useState<DriverVerification | null>(null);
  const [hasDriverApplication, setHasDriverApplication] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

<<<<<<< HEAD
  async function loadAccount(uid: string) {
    const [{ data: roleRows }, { data: driverRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("drivers").select("verification").eq("id", uid).maybeSingle(),
      supabase.from("profiles").select("blocked_at, blocked_reason").eq("id", uid).maybeSingle(),
    ]);

    setRoles((roleRows ?? []).map((row) => row.role));
    setHasDriverApplication(Boolean(driverRow));
    setDriverVerification(driverRow?.verification ?? null);
    setIsBlocked(Boolean(profileRow?.blocked_at));
    setBlockedReason(profileRow?.blocked_reason ?? null);
  }

  function resetAccountState() {
    setRoles(EMPTY_ACCOUNT_STATE.roles);
    setDriverVerification(EMPTY_ACCOUNT_STATE.driverVerification);
    setHasDriverApplication(EMPTY_ACCOUNT_STATE.hasDriverApplication);
    setIsBlocked(EMPTY_ACCOUNT_STATE.isBlocked);
    setBlockedReason(EMPTY_ACCOUNT_STATE.blockedReason);
  }

  useEffect(() => {
    let mounted = true;

=======
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

>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
<<<<<<< HEAD
        setLoading(true);
        setTimeout(() => {
          void loadAccount(s.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        }, 0);
      } else {
        resetAccountState();
        setLoading(false);
=======
        setTimeout(() => void loadAccount(s.user.id), 0);
      } else {
        setRoles([]);
        setDriverVerification(null);
        setHasDriverApplication(false);
        setIsBlocked(false);
        setBlockedReason(null);
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
<<<<<<< HEAD
        loadAccount(data.session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        resetAccountState();
=======
        loadAccount(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
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
<<<<<<< HEAD
    await loadAccount(uid);
=======
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
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
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

<<<<<<< HEAD
// eslint-disable-next-line react-refresh/only-export-components
=======
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
