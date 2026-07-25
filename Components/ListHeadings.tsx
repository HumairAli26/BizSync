import { Spacing } from "@/constants/theme";
import React from "react";
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

const DESKTOP_BREAKPOINT = 900;

const ListHeadings = ({ title, button }: ListHeadingProp) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  return (
    <View
      className="list-head w-full"
      style={{
        paddingVertical: 0,
        // Tighter margins above and below to pull everything closer on mobile
        marginBottom: isDesktop ? 12 : -8,
        marginTop: isDesktop ? 0 : -6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{ fontSize: isDesktop ? Spacing[6] : 23, fontWeight: "700" }}
        className="transactions-title text-text"
      >
        {title}
      </Text>
      <TouchableOpacity className="list-action">
        <Text
          style={{ fontSize: isDesktop ? 14 : 15, fontWeight: "600" }}
          className="list-action-text text-text-muted"
        >
          {button}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ListHeadings;
