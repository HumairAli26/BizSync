import "@/global.css";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-xl font-bold text-text">
        Welcome to Nativewind!
      </Text>
      <Link
        href="/(auth)/sign-in"
        className="mt-4 text-lg text-text bg-primary p-2 rounded-lg"
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
    </View>
  );
}
