import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const CompareSchema = z.object({
  selfie: z.string().min(20).max(8_000_000), // data URL
  reference: z.string().min(20).max(8_000_000),
  context: z.enum(["passenger_selfie_only", "driver_license"]),
});

type CompareOutput = {
  confidence: number; // 0..1
  same_person: boolean;
  reason: string;
  liveness_ok: boolean;
};

/**
 * Compares a live selfie with a reference image (another selfie capture for
 * passengers, a driver license photo for drivers). Uses the OpenAI vision
 * API. Returns a confidence score that the caller stores alongside the
 * verification request — final approval is never based on this score alone.
 */
export const compareFaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CompareSchema.parse(d))
  .handler(async ({ data }): Promise<CompareOutput> => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured");

    const system = [
      "You are a strict KYC face-matching assistant.",
      "Compare the LIVE SELFIE with the REFERENCE image.",
      "Also assess basic liveness from the selfie (real human face, eyes visible, not a screen/photo of a photo, adequate light).",
      'Reply ONLY with a compact JSON object: {"confidence":0..1,"same_person":bool,"liveness_ok":bool,"reason":"short"}.',
      "Be conservative: if either image is unclear, set confidence below 0.6.",
    ].join(" ");

    const userText =
      data.context === "driver_license"
        ? "Reference is a Kazakhstan driver license. Match the face on the license to the selfie."
        : "Both are selfies captured a moment apart. Same person should match nearly perfectly.";

    const body = {
      model: OPENAI_VISION_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: data.selfie } },
            { type: "image_url", image_url: { url: data.reference } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    };

    const res = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Превышен лимит ИИ-сервиса. Повторите через минуту.");
    if (res.status === 402)
      throw new Error("Закончились кредиты ИИ. Пополните баланс в настройках.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<CompareOutput> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // model returned something else
      parsed = {};
    }
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    return {
      confidence,
      same_person: Boolean(parsed.same_person),
      liveness_ok: Boolean(parsed.liveness_ok),
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  });
