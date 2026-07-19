import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import "@/global.css";

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack />;
}
