import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import React, { useState } from "react";
import { TextInput, View } from "react-native";

const SearchIcon = icons.search;

const SearchBar = () => {
  const [search, setSearch] = useState("");
  return (
    <View
      className="search-container"
      style={{
        flexDirection: "row",
        alignItems: "center",
        // Explicit vertical padding overrides whatever "search-container"
        // sets, so this bar doesn't add extra breathing room on top of
        // the gap the dashboard's layout already provides between sections.
        paddingVertical: 14,
        marginVertical: 0,
      }}
    >
      {/*
        className-based sizing/spacing on third-party icon components
        (e.g. lucide-react-native) doesn't reliably apply on web — the
        icon falls back to its default block layout and stacks above the
        input instead of sitting inline. Set size/spacing via props and
        inline style instead, which every platform respects consistently.
      */}
      <SearchIcon
        color={Colors.textMuted}
        size={Spacing[5]}
        style={{ marginRight: Spacing[2], flexShrink: 0 }}
      />
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
