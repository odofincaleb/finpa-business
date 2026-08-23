import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme/colors";

const logo = require("../../assets/logo.jpg");

type Props = {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

/** FINPA Business logo (includes wordmark in the artwork). Optional tagline beside/under. */
export function BrandMark({
  size = 56,
  showWordmark = false,
  tagline,
  style,
  imageStyle,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={logo}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.22,
          },
          imageStyle,
        ]}
        resizeMode="cover"
        accessibilityLabel="FINPA Business"
      />
      {showWordmark || tagline ? (
        <View style={styles.textCol}>
          {showWordmark ? <Text style={styles.brand}>FINPA Business</Text> : null}
          {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    textCol: {
      flexShrink: 1,
    },
    brand: {
      color: c.mist,
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 28,
      letterSpacing: -0.5,
    },
    tagline: {
      color: c.sageBright,
      fontFamily: "DMSans_500Medium",
      fontSize: 12,
      marginTop: 2,
    },
  });
}
