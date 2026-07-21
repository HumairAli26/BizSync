import { icons } from "@/constants/icons";
import { Spacing } from "@/constants/theme";
import { styled } from "nativewind";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const DollarIcon = icons.dollarsign;
const Products = icons.products;
const Invoices = icons.invoices;
const TrendUp = icons.trendup;

const SafeAreaView = styled(RNSafeAreaView);

const analytics = () => {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <View className="home-header">
        <View className="flex-row justify-between items-center w-full">
          <View>
            <Text
              style={{ fontSize: Spacing[7] }}
              className=" text-text font-inter-bold"
            >
              Analytics
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <TouchableOpacity className="list-action p-3">
              <Text
                style={{ paddingHorizontal: 20 }}
                className="text-text font-inter-bold"
              >
                July 2026
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View
          style={{ height: 120 }}
          className="items-center home-balance-card"
        >
          <Text className="items-center text-text-muted">Coming Soon</Text>
        </View>
        <View style={{ height: 120 }} className="home-balance-card">
          <Text className="items-center text-text-muted">Coming Soon</Text>
        </View>
        <View style={{ height: 120 }} className="home-balance-card">
          <Text className="items-center text-text-muted">Coming Soon</Text>
        </View>
      </View>

      <View style={{ height: 100 }} className="items-center home-balance-card">
        <Text className="items-center text-text-muted">Coming Soon</Text>
      </View>
      <View style={{ height: 100 }} className="items-center home-balance-card">
        <Text className="items-center text-text-muted">Coming Soon</Text>
      </View>
      <View style={{ height: 100 }} className="items-center home-balance-card">
        <Text className="items-center text-text-muted">Coming Soon</Text>
      </View>
    </SafeAreaView>
  );
};

export default analytics;
