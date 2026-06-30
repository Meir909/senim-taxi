import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  canManagePassengerChildren,
  type PassengerChild,
  type PassengerProfile,
} from "@/lib/passenger-children";

export function usePassengerChildren(userId: string | null | undefined) {
  const [profile, setProfile] = useState<PassengerProfile | null>(null);
  const [children, setChildren] = useState<PassengerChild[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setChildren([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: profileData }, { data: childData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("passenger_children")
        .select("*")
        .eq("mother_id", userId)
        .order("birth_date", { ascending: false }),
    ]);

    setProfile(profileData ?? null);
    setChildren(childData ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    profile,
    children,
    loading,
    eligibleMother: canManagePassengerChildren(profile),
    reload,
  };
}
