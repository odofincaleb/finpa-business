import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { ApiError, sendBusinessChat } from "../lib/api";
import { formatMoney } from "../lib/currency";
import { parseBusinessMessage } from "../lib/parseBusiness";
import type { Debtor, Expense, Sale } from "../types";

const CLARIFY = "I didn't understand that. Try: Sold 5 shirts ₦75k POS";

export type BusinessChatResult = {
  ok: boolean;
  summary: string;
  sale?: Sale | null;
  expense?: Expense | null;
  debtor?: Debtor | null;
};

function isSummaryQuestion(text: string) {
  return /\b(how much|what's my|what is my|who owes|profit|sell today|sold today)\b/i.test(text);
}

export function useBusinessChat() {
  const { token, profile } = useAuth();
  const {
    addSale,
    addExpense,
    addDebtor,
    categories,
    dashboard,
    ingestCreated,
    refresh,
  } = useBusiness();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (message: string): Promise<BusinessChatResult> => {
      const text = message.trim();
      if (!text) return { ok: false, summary: CLARIFY };

      setError(null);
      setSending(true);
      try {
        if (isSummaryQuestion(text)) {
          const currency = profile?.preferred_currency ?? "NGN";
          const summary = `Today: sales ${formatMoney(dashboard.todaySales, currency)}, expenses ${formatMoney(dashboard.todayExpenses, currency)}, profit ${formatMoney(dashboard.estimatedProfit, currency)}. Open debtors: ${dashboard.openDebtors}.`;
          return { ok: true, summary };
        }

        const local = parseBusinessMessage(text);
        if (local) {
          let sale: Sale | null = null;
          let expense: Expense | null = null;
          let debtor: Debtor | null = null;

          if (local.intent === "debtor") {
            debtor = await addDebtor({
              customer_name: local.debtor_name || "Customer",
              total_amount: local.debtor_total || local.items[0]?.amount || 0,
              amount_paid: local.debtor_paid || 0,
              notes: text,
            });
          } else if (local.intent === "expense") {
            for (const item of local.items) {
              expense = await addExpense({
                amount: item.amount,
                category: item.category || "Miscellaneous",
                payment_method: item.payment_method || "cash",
                notes: item.notes || text,
              });
            }
          } else {
            for (const item of local.items) {
              sale = await addSale({
                amount: item.amount,
                item_or_service: item.item_or_service || "Sale",
                payment_method: item.payment_method || "cash",
                customer_name: item.customer_name ?? null,
                quantity: item.quantity ?? 1,
                notes: item.notes || text,
              });
            }
          }

          return { ok: true, summary: local.summary, sale, expense, debtor };
        }

        if (!token) {
          setError(CLARIFY);
          return { ok: false, summary: CLARIFY };
        }

        try {
          const result = await sendBusinessChat(
            token,
            text,
            categories.map((c) => c.name),
          );
          if (result.ok && result.action === "create") {
            const sales = result.sales?.length ? result.sales : result.sale ? [result.sale] : [];
            const expenses = result.expenses?.length
              ? result.expenses
              : result.expense
                ? [result.expense]
                : [];
            ingestCreated({ sales, expenses, debtor: result.debtor });
            void refresh();
          }
          if (!result.ok) setError(result.summary || CLARIFY);
          return {
            ok: result.ok,
            summary: result.summary || CLARIFY,
            sale: result.sale,
            expense: result.expense,
            debtor: result.debtor,
          };
        } catch (err) {
          const summary =
            err instanceof ApiError && err.code === "SUBSCRIPTION_REQUIRED"
              ? err.message
              : CLARIFY;
          setError(summary);
          return { ok: false, summary };
        }
      } finally {
        setSending(false);
      }
    },
    [
      addDebtor,
      addExpense,
      addSale,
      categories,
      dashboard.estimatedProfit,
      dashboard.openDebtors,
      dashboard.todayExpenses,
      dashboard.todaySales,
      ingestCreated,
      profile?.preferred_currency,
      refresh,
      token,
    ],
  );

  return { send, sending, error, setError };
}
