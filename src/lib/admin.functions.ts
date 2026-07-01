import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ userId: z.string().uuid() });

/**
 * Permanently deletes a user from auth.users. Cascades through profiles,
 * wallets, user_roles, drivers, driver_documents (all have ON DELETE CASCADE).
 * Caller must be an admin.
 */
export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
<<<<<<< HEAD
  .validator((d: unknown) => Input.parse(d))
=======
  .inputValidator((d: unknown) => Input.parse(d))
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Только для администраторов");
    if (data.userId === context.userId) throw new Error("Нельзя удалить себя");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
