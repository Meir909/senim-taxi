import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Notif = Database["public"]["Tables"]["notifications"]["Row"];

/** Subscribe to the user's notifications and surface them as toasts +
 *  (when permission granted) browser notifications. Returns helpers. */
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, []);

  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (p) => {
          const n = p.new as Notif;
          if (seen.current.has(n.id)) return;
          seen.current.add(n.id);
          toast(n.title, { description: n.body ?? undefined });
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            try {
              new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
            } catch {
              /* noop */
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { permission, requestPermission };
}
