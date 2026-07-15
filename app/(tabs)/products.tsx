import { styled } from "nativewind";
import React from "react";
import { Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const products = () => {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <Text className="text-text">products</Text>
    </SafeAreaView>
  );
};

export default products;
