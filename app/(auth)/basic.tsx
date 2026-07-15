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
      <View className="flex-row gap-9 mt-6">
        <Link
          href="/(auth)/sign-in"
          className=" mt-5 text-lg text-text bg-primary p-2 rounded-lg"
        >
          Sign In
        </Link>
        <Link
          href="/(auth)/sign-up"
          className=" mt-5 text-lg text-text bg-primary p-2 rounded-lg"
        >
          Sign Up
        </Link>
      </View>
    </View>
  );
};

export default basic;
