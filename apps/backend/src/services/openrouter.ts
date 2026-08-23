import OpenAI from "openai";
import { AppError } from "../lib/errors";
import { buildCategoryEnum } from "../lib/categories";
import { resolveOpenRouterModel } from "../lib/openrouterModel";
import { resolveCategory } from "../lib/resolveCategory";
import type { AiChatResult, CurrencyCode } from "../types/transaction";

function buildExtractionSchema(categoryEnum: string[]) {
  const categoryProp = {
    type: "string" as const,
    enum: categoryEnum,
  };

  return {
    name: "finpa_expense_extraction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "clarify"],
        },
        summary: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              amount: { type: "number" },
              currency: { type: "string" },
              category: categoryProp,
              merchant: { type: "string" },
              type: { type: "string", enum: ["expense", "income"] },
              payment_method: { type: "string" },
              notes: { type: "string" },
            },
            required: [
              "amount",
              "currency",
              "category",
              "merchant",
              "type",
              "payment_method",
              "notes",
            ],
          },
        },
        update: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                match: { type: "string" },
                fields: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    amount: { type: "number" },
                    currency: { type: "string" },
                    category: categoryProp,
                    merchant: { type: "string" },
                    type: { type: "string", enum: ["expense", "income"] },
                    payment_method: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: [],
                },
              },
              required: ["match", "fields"],
            },
            { type: "null" },
          ],
        },
      },
      required: ["action", "summary", "items", "update"],
    },
  } as const;
}

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AppError(500, "INTERNAL", "OPENROUTER_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://finpa.app",
      "X-Title": "FINPA Business",
    },
  });
}

function buildSystemPrompt(
  preferredCurrency: CurrencyCode,
  categoryEnum: string[],
): string {
  const list = categoryEnum.join(", ");
  return `You are FINPA Business, a business sales and expense assistant.
Extract sales or expenses from natural language (English or Nigerian English).
Default currency is ${preferredCurrency} when the user omits a currency. Naira/NGN is common.
Split multi-item statements into separate items.
Pick category from this exact list only: ${list}.
Prefer the most specific match. If the user has a custom category that matches the spend (e.g. "School" for school fees), use that instead of "Other".
For corrections like "change that last gas purchase to 40" or "change that school fees to School", use action "update" with a match string (keywords from the original entry) and fields to change (e.g. category). Put an empty items array for updates. Never create a new item when the user is only changing category/amount on an existing entry.
Use action "clarify" when the message is not a transaction or correction.
Always return valid JSON matching the schema. Keep summary short and friendly.`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function extractTransactions(
  message: string,
  preferredCurrency: CurrencyCode,
  categories: string[] = [],
): Promise<AiChatResult> {
  const categoryEnum = buildCategoryEnum(categories);
  const schema = buildExtractionSchema(categoryEnum);
  const client = getClient();
  const model = resolveOpenRouterModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const messages = [
    {
      role: "system" as const,
      content: buildSystemPrompt(preferredCurrency, categoryEnum),
    },
    { role: "user" as const, content: message },
  ];

  const run = async (withSchema: boolean) =>
    client.chat.completions.create(
      {
        model,
        temperature: 0.1,
        messages,
        ...(withSchema
          ? {
              response_format: {
                type: "json_schema" as const,
                json_schema: schema as unknown as {
                  name: string;
                  strict?: boolean;
                  schema: Record<string, unknown>;
                },
              },
            }
          : {
              response_format: { type: "json_object" as const },
            }),
      },
      { signal: controller.signal },
    );

  try {
    let completion;
    try {
      completion = await run(true);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        await sleep(1200);
        completion = await run(true);
      } else {
        // Many free models reject json_schema — retry with json_object
        completion = await run(false);
      }
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new AppError(422, "PARSE_FAILED", "Empty response from AI");
    }

    let parsed: AiChatResult;
    try {
      parsed = JSON.parse(content) as AiChatResult;
    } catch {
      throw new AppError(422, "PARSE_FAILED", "AI returned invalid JSON");
    }

    if (!parsed.action || !parsed.summary || !Array.isArray(parsed.items)) {
      throw new AppError(422, "PARSE_FAILED", "AI response missing required fields");
    }

    parsed.items = parsed.items.map((item) => {
      const type = item.type === "income" ? "income" : "expense";
      const category = resolveCategory(
        message,
        item.category,
        categories,
        type,
      );
      return {
        ...item,
        type,
        category,
        currency: item.currency || preferredCurrency,
        merchant: item.merchant || "Unknown",
        payment_method: item.payment_method || "",
        notes: item.notes || "",
      };
    });

    if (parsed.update?.fields?.category) {
      const t =
        parsed.update.fields.type === "income" ? "income" : "expense";
      parsed.update.fields.category = resolveCategory(
        `${message} ${parsed.update.match || ""}`,
        parsed.update.fields.category,
        categories,
        t,
      );
    }

    return parsed;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;

    const name = (err as { name?: string })?.name;
    const status = (err as { status?: number })?.status;
    const messageText = err instanceof Error ? err.message : "Upstream error";

    if (name === "AbortError" || messageText.toLowerCase().includes("abort")) {
      throw new AppError(504, "UPSTREAM_TIMEOUT", "AI request timed out. Try again.");
    }
    if (status === 429) {
      throw new AppError(
        503,
        "RATE_LIMIT",
        "Free-tier rate limit reached. Wait a moment and try again.",
      );
    }
    throw new AppError(502, "INTERNAL", messageText);
  } finally {
    clearTimeout(timeout);
  }
}
