// Components/OfflineBanner.tsx
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import React from "react";
import { Text, View } from "react-native";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: "rgba(245,158,11,0.15)",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 13, color: "#f59e0b", fontWeight: "600" }}>
        You're offline — changes will sync when you reconnect.
      </Text>
    </View>
  );
}
