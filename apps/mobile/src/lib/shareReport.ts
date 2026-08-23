import { Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { ReportRange } from "../types";

export async function shareCsvFile(csv: string, type: ReportRange, stamp: string) {
  const filename = `finpa-business-${type}-${stamp}.csv`;
  try {
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (dir && (await Sharing.isAvailableAsync())) {
      const path = `${dir}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: "Export FINPA Business CSV",
        UTI: "public.comma-separated-values-text",
      });
      return;
    }
  } catch {
    // fall through
  }
  await Share.share({ title: filename, message: csv });
}

export async function sharePlainReport(text: string) {
  await Share.share({ title: "FINPA Business report", message: text });
}
