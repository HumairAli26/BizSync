import { Link } from "expo-router";
import { styled } from "nativewind";
import React from "react";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const SignUp = () => {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background p-5">
      <Link
        href="/(auth)/sign-in"
        className=" mt-5 text-lg text-text bg-primary p-2 rounded-lg"
      >
        Sign In
      </Link>
    </SafeAreaView>
  );
};

export default SignUp;
