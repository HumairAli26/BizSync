import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { getGreeting } from "@/lib/greetings";
import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const greeting = getGreeting();
const BellIcon = icons.bell;

const MainHeader = () => {
  return (
    <View className="home-header">
      <View className="flex-row justify-between items-center w-full">
        <View>
          <Text style={{ fontSize: Spacing[4] }} className=" text-text-muted">
            {greeting}
          </Text>
          <Text
            style={{ fontSize: Spacing[6] }}
            className=" text-text font-inter-bold"
          >
            Alex Morgan
          </Text>
        </View>
        <View className="ml-3 flex-row items-center">
          <View className="mr-2 bg-overlay p-3" style={{ borderRadius: 12 }}>
            <BellIcon
              size={Spacing[6.5]}
              color={Colors.text}
              className="bg-overlay"
            />
          </View>
          <Link
            href="/(tabs)/settings"
            style={{
              fontSize: Spacing[4],
              borderRadius: 12,
            }}
            className="bg-primary p-3"
          >
            <Text className="text-text font-inter-bold">AM</Text>
          </Link>
        </View>
      </View>
    </View>
  );
};

export default MainHeader;
