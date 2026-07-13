import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const SignIn = () => (
  <View>
    <Text>sign_in</Text>
    <Link href="/(auth)/sign-up" className="text-lg text-primary">
      Create an account
    </Link>
    <Link href="/(tabs)/index" className="text-lg text-primary">
      Home
    </Link>
  </View>
);

export default SignIn;
