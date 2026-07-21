import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { Link } from "expo-router";
import { styled } from "nativewind";
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SearchIcon = icons.search;
const SafeAreaView = styled(RNSafeAreaView);

const customers = () => {
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
              Customers
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
          placeholder="Search customers..."
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
    </SafeAreaView>
  );
};

export default customers;
