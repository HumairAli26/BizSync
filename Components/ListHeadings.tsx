import { Spacing } from "@/constants/theme";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const ListHeadings = ({ title, button }: ListHeadingProp) => {
  return (
    <View className="flex-row justify-between items-center w-full">
      <Text style={{ fontSize: Spacing[4] }} className="transactions-title">
        {title}
      </Text>
      <TouchableOpacity className="list-action">
        <Text className="list-action-text">{button}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ListHeadings;
