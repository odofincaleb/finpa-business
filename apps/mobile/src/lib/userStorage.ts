import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Per-user AsyncStorage keys so multiple accounts on one device stay isolated.
 */
export function userStoragePrefix(userId: string): string {
  const safe = (userId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `finpa-business.u.${safe}`;
}

export function txKey(userId: string) {
  return `${userStoragePrefix(userId)}.tx`;
}

export function customCategoriesKey(userId: string) {
  return `${userStoragePrefix(userId)}.customCategories`;
}

export function budgetKey(userId: string, year: number, month: number) {
  return `${userStoragePrefix(userId)}.budgets.${year}-${String(month).padStart(2, "0")}`;
}

export function syncQueueKey(userId: string) {
  return `${userStoragePrefix(userId)}.syncQueue`;
}

/**
 * Remove pre-scoping device-global finance keys so they cannot leak across accounts.
 * Safe: server remains source of truth; only unsynced legacy offline rows are dropped.
 */
export async function purgeLegacySharedFinanceKeys(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter(
      (k) =>
        k === "finpa.tx" ||
        k === "finpa.customCategories" ||
        k === "finpa.syncQueue" ||
        /^finpa\.budgets\.\d{4}-\d{2}$/.test(k),
    );
    if (legacy.length) await AsyncStorage.multiRemove(legacy);
  } catch {
    // ignore
  }
}
