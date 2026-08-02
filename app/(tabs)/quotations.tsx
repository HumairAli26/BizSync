import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { styled } from "nativewind";
import React, { useState } from "react";
import {
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);
const DESKTOP_BREAKPOINT = 900;

const SearchIcon = icons.search;
const DownloadIcon = icons.download;
const MoreIcon = icons.moreVertical ?? icons.more;

const quotations = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [search, setSearch] = useState("");
  const [chooseTypeVisible, setChooseTypeVisible] = useState(false);

  const openNewInvoicePicker = () => {
    setChooseTypeVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      {/* Header */}
      <View className="home-header">
        <View className="flex-row justify-between items-center w-full">
          <View>
            <Text
              style={{ fontSize: Spacing[7] }}
              className="text-text font-inter-bold"
            >
              Quotations
            </Text>
          </View>
          <View className="ml-3 flex-row items-center">
            <TouchableOpacity
              onPress={openNewQuotationPicker}
              style={{
                borderRadius: 12,
                paddingHorizontal: 25,
                paddingVertical: 12,
              }}
              className="bg-primary"
            >
              <Text
                style={{ fontSize: Spacing[4] }}
                className="text-text font-inter-bold"
              >
                + New Quotation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View
        className="search-container"
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...(isDesktop
            ? {
                alignSelf: "flex-start",
                width: "100%",
                maxWidth: 420,
                height: 48,
                overflow: "hidden",
                marginBottom: 24,
              }
            : null),
        }}
      >
        <SearchIcon
          color={Colors.textMuted}
          size={Spacing[5]}
          style={{ marginRight: Spacing[2], flexShrink: 0 }}
        />
        <TextInput
          placeholder="Search quotations..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
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

export default quotations;
