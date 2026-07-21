import { Colors, Spacing } from "@/constants/theme";
import { Link } from "expo-router";
import { Box } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";

const basic = () => {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <View className="p-6 rounded-4xl items-center justify-center bg-primary">
        <Box size={Spacing[18]} color={Colors.text} />
      </View>
      <Text
        style={{ fontSize: 38, fontWeight: "bold" }}
        className="p-2 font-bold text-text"
      >
        BizSync
      </Text>
      <Text
        style={{ color: Colors.textMuted, fontSize: 14 }}
        className="justify-center"
      >
        Inventory & Billing
      </Text>
      <Text
        style={{ color: Colors.textMuted, fontSize: 14 }}
        className="justify-center"
      >
        Made Simple
      </Text>
      <View className="gap-5 mt-6">
        <Link
          href="/(auth)/sign-in"
          className="items-center text-lg text-text bg-primary p-2 rounded-lg"
          style={{ borderRadius: 12, paddingHorizontal: 24 }}
        >
          <Text style={{ paddingHorizontal: 16 }}>Join an Organization</Text>
        </Link>
        <Link
          href="/(auth)/sign-up"
          className="items-center text-lg text-text bg-primary p-2 rounded-lg"
          style={{ borderRadius: 12, paddingHorizontal: 16 }}
        >
          <Text style={{ paddingHorizontal: 16 }}>Create an Organization</Text>
        </Link>
      </View>
    </View>
  );
};

export default basic;
