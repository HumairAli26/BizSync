import "@/global.css";
import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-xl font-bold text-success">
        Welcome to Nativewind!
      </Text>
      <Link
        href="/inventory"
        className="mt-4 text-lg text-primary bg-surface-elevated p-2 rounded-lg"
      >
        Go to Inventory
      </Link>
      <Link
        href="/(auth)/sign-in"
        className="mt-4 text-lg text-primary bg-surface-elevated p-2 rounded-lg"
      >
        Sign In
      </Link>
      <Link
        href="/(auth)/sign-up"
        className="mt-4 text-lg text-primary bg-surface-elevated p-2 rounded-lg"
      >
        Sign Up
      </Link>
    </View>
  );
}
