import { Share } from "react-native";

export type ShareablePin = {
  code: string;
  period: string;
  duration_days: number;
  notes?: string;
};

function pinLine(p: ShareablePin) {
  const plan = p.period === "annual" ? "annual (365 days)" : "monthly (30 days)";
  return `${p.code} — ${plan}`;
}

export function formatPinShareMessage(pins: ShareablePin[]): string {
  if (!pins.length) return "";
  if (pins.length === 1) {
    const p = pins[0];
    return [
      "Your FINPA Business activation code:",
      "",
      p.code,
      "",
      `Plan: ${p.period} · ${p.duration_days} days`,
      p.notes ? `Note: ${p.notes}` : null,
      "",
      "Open FINPA Business → enter this code on the Activate PIN screen.",
    ]
      .filter((x) => x != null)
      .join("\n");
  }

  return [
    "Your FINPA Business activation codes:",
    "",
    ...pins.map((p, i) => `${i + 1}. ${pinLine(p)}`),
    "",
    "Open FINPA Business → Activate PIN and enter a code.",
  ].join("\n");
}

export async function sharePins(pins: ShareablePin[]) {
  const message = formatPinShareMessage(pins);
  if (!message) return;
  await Share.share({ message, title: "FINPA Business activation PIN" });
}
