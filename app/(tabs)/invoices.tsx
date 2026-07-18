import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { Link } from "expo-router";
import { styled } from "nativewind";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SearchIcon = icons.search;

const SafeAreaView = styled(RNSafeAreaView);

const invoices = () => {
  const [search, setSearch] = useState("");
  const [isToggledall, setIsToggledall] = useState(true);
  const [isToggledpaid, setIsToggledpaid] = useState(false);
  const [isToggledpending, setIsToggledpending] = useState(false);
  const [isToggledoverdue, setIsToggledoverdue] = useState(false);
  const [isToggleddraft, setIsToggleddraft] = useState(false);
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <View className="home-header">
        <View className="flex-row justify-between items-center w-full">
          <View>
            <Text
              style={{ fontSize: Spacing[7] }}
              className=" text-text font-inter-bold"
            >
              Invoices
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
                + New Invoice
              </Text>
            </Link>
          </View>
        </View>
      </View>
      <View className="search-container">
        <SearchIcon color={Colors.textMuted} className="search-icon" />
        <TextInput
          placeholder="Search invoices..."
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
                className="text-yellow-300 font-inter-bold"
              >
                1,024
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Total Due
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <Text
                style={{ fontSize: Spacing[5] }}
                className="font-inter-bold text-red-800"
              >
                6
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Overdue
              </Text>
            </View>
          </View>
          <View className="home-balance-card">
            <View className="items-center">
              <Text
                style={{ fontSize: Spacing[5] }}
                className=" font-inter-bold text-green-400"
              >
                1,024
              </Text>
              <Text
                style={{ fontSize: Spacing[3] }}
                className="text-text-muted"
              >
                Collected
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View className="flex-row items-center mt-5 gap-1">
        <Pressable
          onPress={() => {
            setIsToggledall(!isToggledall);
            setIsToggledoverdue(false);
            setIsToggledpending(false);
            setIsToggledpaid(false);
            setIsToggleddraft(false);
          }}
          style={[isToggledall ? styles.buttonActive : styles.buttonInactive]}
          className="list-action"
        >
          <Text className="list-action-text">All</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setIsToggledpaid(!isToggledpaid);
            setIsToggledoverdue(false);
            setIsToggledpending(false);
            setIsToggleddraft(false);
            setIsToggledall(false);
          }}
          style={[isToggledpaid ? styles.buttonActive : styles.buttonInactive]}
          className="list-action"
        >
          <Text className="list-action-text">Paid</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setIsToggledpending(!isToggledpending);
            setIsToggleddraft(false);
            setIsToggledall(false);
            setIsToggledoverdue(false);
            setIsToggledpaid(false);
          }}
          style={[
            isToggledpending ? styles.buttonActive : styles.buttonInactive,
          ]}
          className="list-action"
        >
          <Text className="list-action-text">Pending</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setIsToggledoverdue(!isToggledoverdue);
            setIsToggleddraft(false);
            setIsToggledall(false);
            setIsToggledpending(false);
            setIsToggledpaid(false);
          }}
          style={[
            isToggledoverdue ? styles.buttonActive : styles.buttonInactive,
          ]}
          className="list-action"
        >
          <Text className="list-action-text">Overdue</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setIsToggleddraft(!isToggleddraft);
            setIsToggledall(false);
            setIsToggledoverdue(false);
            setIsToggledpending(false);
            setIsToggledpaid(false);
          }}
          style={[isToggleddraft ? styles.buttonActive : styles.buttonInactive]}
          className="list-action"
        >
          <Text className="list-action-text">Draft</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default invoices;

const styles = StyleSheet.create({
  buttonInactive: {
    backgroundColor: Colors.background,
  },
  buttonActive: {
    backgroundColor: Colors.primary, // Darker Blue when clicked
  },
});
