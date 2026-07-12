import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const SignIn = () => {
  return (
    <View>
      <Text>sign_in</Text>
      <Link href="/(auth)/sign-up" className="text-lg text-primary">
        Create an account
      </Link>
    </View>
  );
};

export default SignIn;
