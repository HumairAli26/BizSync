import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { getGreeting } from "@/lib/greetings";
import { Link } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

const greeting = getGreeting();
const BellIcon = icons.bell;

const MainHeader = () => {
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserName(data.name);
      }
    });

    return unsubscribe;
  }, []);

  return (
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
            {userName}
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
            <Text className="text-text font-inter-bold">
              {userName
                ? userName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                : "?"}
            </Text>
          </Link>
        </View>
      </View>
    </View>
  );
};

export default MainHeader;
