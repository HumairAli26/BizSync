import { Spacing } from "@/constants/theme";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const ListHeadings = ({ title, button }: ListHeadingProp) => {
  return (
    <View className="list-head w-full">
      <Text style={{ fontSize: Spacing[6] }} className="transactions-title">
        {title}
      </Text>
      <TouchableOpacity className="list-action">
        <Text style={{ fontSize: 15 }} className="list-action-text">
          {button}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ListHeadings;
