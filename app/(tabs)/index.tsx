import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import "@/global.css";
import { getGreeting } from "@/lib/greetings";
import { Link } from "expo-router";
import { styled } from "nativewind";
import { Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);
const greeting = getGreeting();
const BellIcon = icons.bell;

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
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
    </SafeAreaView>
  );
}
