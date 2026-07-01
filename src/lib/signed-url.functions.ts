import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ userId: z.string().uuid() });

/**
 * Returns a short-lived signed URL for the target user's verification selfie.
 * Allowed when caller is admin, the target user themselves, or shares a
 * non-completed ride with the target.
 */
export const getUserAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const caller = context.userId;
    const target = data.userId;

    // Allow self
    let allowed = caller === target;

    if (!allowed) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: caller,
        _role: "admin",
      });
      allowed = Boolean(isAdmin);
    }

    if (!allowed) {
      // Shared ride check (caller-driver/target-passenger or vice versa)
      const { data: rides } = await context.supabase
        .from("rides")
        .select("id")
        .or(
          `and(driver_id.eq.${caller},passenger_id.eq.${target}),and(driver_id.eq.${target},passenger_id.eq.${caller})`,
        )
        .in("status", [
          "requested",
          "searching",
          "accepted",
          "driver_arriving",
          "driver_arrived",
          "in_progress",
          "completed",
        ])
        .limit(1);
      allowed = (rides?.length ?? 0) > 0;
    }

    if (!allowed) return { url: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try profiles.selfie_path then drivers.selfie_path
    const [{ data: p }, { data: d }] = await Promise.all([
      supabaseAdmin.from("profiles").select("selfie_path").eq("id", target).maybeSingle(),
      supabaseAdmin.from("drivers").select("selfie_path").eq("id", target).maybeSingle(),
    ]);
    const path = p?.selfie_path ?? d?.selfie_path ?? null;
    if (!path) return { url: null };

    const { data: signed, error } = await supabaseAdmin.storage
      .from("verification")
      .createSignedUrl(path, 600);
    if (error) return { url: null };
    return { url: signed.signedUrl };
  });
