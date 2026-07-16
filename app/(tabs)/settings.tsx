import { Link } from "expo-router";
import { styled } from "nativewind";
import React from "react";
import { Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const settings = () => {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <Text className="text-text">settings</Text>
      <Link
        href="/(auth)/basic"
        className="mt-4 text-lg text-text bg-primary p-2 rounded-lg"
      >
        Main Page
      </Link>
    </SafeAreaView>
  );
};

export default settings;
