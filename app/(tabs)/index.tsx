import "@/global.css";
import { Link } from "expo-router";
import { styled } from "nativewind";
import { Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <Text className="text-xl font-bold text-text">
        Welcome to Nativewind!
      </Text>
      <Link
        href="/(auth)/sign-in"
        className="mt-4 text-lg text-text justify-center bg-primary p-2 rounded-lg"
      >
        Sign In
      </Link>
      <Link
        href="/(auth)/sign-up"
        className="mt-4 text-lg text-text bg-primary p-2 rounded-lg"
      >
        Sign Up
      </Link>
      <Link
        href="/(auth)/basic"
        className="mt-4 text-lg text-text bg-primary p-2 rounded-lg"
      >
        Main Page
      </Link>
    </SafeAreaView>
  );
}
