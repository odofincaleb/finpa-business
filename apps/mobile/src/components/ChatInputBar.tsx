import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Mic, Send } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/colors";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

type Props = {
  onSend: (message: string) => void;
  sending?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  /** When true, sits inside the home scroll (not a sticky footer). */
  embedded?: boolean;
  /** Parent can lock ScrollView while holding the mic */
  onListeningChange?: (listening: boolean) => void;
  placeholder?: string;
  hint?: string;
};

export function ChatInputBar({
  onSend,
  sending,
  disabled,
  disabledHint,
  embedded,
  onListeningChange,
  placeholder,
  hint,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState("");
  const { listening, transcript, start, stop } = useVoiceRecorder((finalText) => {
    setText("");
    onSend(finalText);
  });

  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  useEffect(() => {
    if (listening && transcript) {
      setText(transcript);
    }
  }, [listening, transcript]);

  const submit = () => {
    const value = text.trim();
    if (!value || sending || disabled) return;
    setText("");
    onSend(value);
  };

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <View
        style={[
          styles.bar,
          listening && styles.barListening,
          disabled && styles.barDisabled,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={
            disabled
              ? "Connect to use AI chat"
              : listening
                ? "Listening…"
                : placeholder || "Sold 5 shirts ₦75k POS to Mr Ade"
          }
          placeholderTextColor={colors.mistMuted}
          style={styles.input}
          multiline
          editable={!sending && !disabled}
          onSubmitEditing={submit}
        />
        <Pressable
          onPressIn={disabled ? undefined : start}
          onPressOut={disabled ? undefined : stop}
          delayLongPress={200}
          hitSlop={12}
          disabled={disabled}
          style={[
            styles.mic,
            listening && styles.micActive,
            disabled && styles.sendDisabled,
          ]}
          accessibilityLabel="Hold to talk"
        >
          <Mic size={20} color={listening ? colors.ink : colors.mist} />
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={disabled || sending || !text.trim()}
          style={[
            styles.send,
            (disabled || !text.trim() || sending) && styles.sendDisabled,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <Send size={18} color={colors.ink} />
          )}
        </Pressable>
      </View>
      {disabled ? (
        <Text style={styles.hint}>
          {disabledHint || "Offline — switch to Manual to log expenses"}
        </Text>
      ) : listening ? (
        <Text style={styles.hint}>Release to send · hold mic to talk</Text>
      ) : (
        <Text style={styles.hint}>
          {hint || "Chat a sale, expense, or credit · hold mic to talk"}
        </Text>
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.line,
      backgroundColor: c.inkSoft,
    },
    wrapEmbedded: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      borderTopWidth: 0,
      backgroundColor: "transparent",
    },
    bar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      backgroundColor: c.inkCard,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.line,
    },
    barListening: {
      borderColor: c.sage,
    },
    barDisabled: {
      opacity: 0.75,
    },
    input: {
      flex: 1,
      color: c.mist,
      fontFamily: "DMSans_400Regular",
      fontSize: 15,
      maxHeight: 96,
      paddingVertical: 8,
    },
    mic: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.chipActiveBg,
    },
    micActive: {
      backgroundColor: c.sageBright,
      transform: [{ scale: 1.06 }],
    },
    send: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.sageBright,
    },
    sendDisabled: {
      opacity: 0.4,
    },
    hint: {
      marginTop: 6,
      textAlign: "center",
      color: c.mistMuted,
      fontFamily: "DMSans_400Regular",
      fontSize: 11,
    },
  });
}
