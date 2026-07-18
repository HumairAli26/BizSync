import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { Link } from "expo-router";
import { styled } from "nativewind";
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SearchIcon = icons.search;
const SafeAreaView = styled(RNSafeAreaView);

const products = () => {
  const [search, setSearch] = useState("");
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <View className="home-header">
        <View className="flex-row justify-between items-center w-full">
          <View>
            <Text
              style={{ fontSize: Spacing[7] }}
              className=" text-text font-inter-bold"
            >
              Inventory
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <Link
              href="/(tabs)/settings"
              style={{
                fontSize: Spacing[4],
                borderRadius: 12,
                paddingHorizontal: 25,
              }}
              className="bg-primary p-3"
            >
              <Text
                style={{ paddingHorizontal: 20 }}
                className="text-text font-inter-bold"
              >
                + Add
              </Text>
            </Link>
          </View>
        </View>
      </View>
      <View className="search-container">
        <SearchIcon color={Colors.textMuted} className="search-icon" />
        <TextInput
          placeholder="Search products..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            fontSize: Spacing[4],
            color: Colors.text,
            paddingVertical: 0,
          }}
        />
      </View>
      <View>
        <View className="flex-row gap-3">
          <View className="home-balance-card">
            <View className="items-center">
              <Text
                style={{ fontSize: Spacing[5] }}
                className="text-blue-400 font-inter-bold"
              >
                1,024
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Total
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <Text
                style={{ fontSize: Spacing[5] }}
                className="text-yellow-300 font-inter-bold"
              >
                6
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Low Stock
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <Text
                style={{ fontSize: Spacing[5] }}
                className=" font-inter-bold text-red-700"
              >
                1,024
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Out of Stock
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default products;
