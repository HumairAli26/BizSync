import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import React, { useState } from "react";
import { TextInput, View } from "react-native";

const SearchIcon = icons.search;

const SearchBar = () => {
  const [search, setSearch] = useState("");
  return (
    <View className="search-container">
      <SearchIcon color={Colors.textMuted} className="search-icon" />
      <TextInput
        placeholder="Search products, invoices..."
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
  );
};

export default SearchBar;
