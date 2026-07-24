import { auth } from "@/config/firebaseConfig";
import { tabs } from "@/constants/data";
import { icons } from "@/constants/icons";
import { Colors, components } from "@/constants/theme";
import clsx from "clsx";
import { Redirect, Slot, Tabs, router, usePathname } from "expo-router";
import { User, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabBar = components.tabBar;

// Below this width: phone-style bottom tab bar (unchanged behavior).
// At or above it: persistent left sidebar, like a real desktop app.
const DESKTOP_BREAKPOINT = 900;

const TabLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoaded(true);
    });
    return unsubscribe;
  }, []);

  if (!loaded) {
    return null;
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const TabIcon = ({ focused, icon }: TabIconProps) => {
    const Icon = icon;

    return (
      <View className="tabs-icon  bg-background">
        <View className={clsx("tabs-pill")}>
          <Icon size={20} color={focused ? "#fff" : Colors.textMuted} />
        </View>
      </View>
    );
  };

  // ---------------- Desktop: persistent left sidebar ----------------
  if (isDesktop) {
    const SettingsIcon = icons.settings;
    const settingsActive = pathname === "/settings";

    return (
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: Colors.background,
          padding: 16,
          gap: 16,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: 240,
            backgroundColor: Colors.sidebar,
            borderRightWidth: 1,
            borderRightColor: Colors.sidebarBorder,
            borderRadius: 28,
            paddingTop: 28,
            paddingBottom: 20,
            paddingHorizontal: 14,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              color: Colors.sidebarText,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 28,
              paddingHorizontal: 10,
            }}
          >
            BizSync
          </Text>

          {tabs.map((tab) => {
            const Icon = tab.icons;
            const href = tab.name === "index" ? "/" : `/${tab.name}`;
            const isActive = pathname === href;

            return (
              <Pressable
                key={tab.name}
                onPress={() => router.push(href as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  marginBottom: 4,
                  backgroundColor: isActive
                    ? Colors.sidebarActive
                    : "transparent",
                }}
              >
                <Icon size={20} color={isActive ? "#fff" : Colors.textMuted} />
                <Text
                  style={{
                    color: isActive ? "#fff" : Colors.textMuted,
                    fontWeight: isActive ? "700" : "500",
                    fontSize: 14,
                  }}
                >
                  {tab.title}
                </Text>
              </Pressable>
            );
          })}

          <View
            style={{
              height: 1,
              backgroundColor: Colors.sidebarBorder,
              marginVertical: 16,
            }}
          />

          <Pressable
            onPress={() => router.push("/settings" as any)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: settingsActive
                ? Colors.sidebarActive
                : "transparent",
            }}
          >
            <SettingsIcon
              size={20}
              color={settingsActive ? "#fff" : Colors.textMuted}
            />
            <Text
              style={{
                color: settingsActive ? "#fff" : Colors.textMuted,
                fontWeight: settingsActive ? "700" : "500",
                fontSize: 14,
              }}
            >
              Settings
            </Text>
          </Pressable>
        </View>

        {/* Content area — capped width so it doesn't stretch edge-to-edge
            on very wide windows, centered in the remaining space. */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 1100,
              alignSelf: "center",
              borderRadius: 28,
              overflow: "hidden",
              paddingVertical: 8,
            }}
          >
            <Slot />
          </View>
        </View>
      </View>
    );
  }

  // ---------------- Mobile / narrow: original bottom tab bar ----------------
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarStyle: {
          backgroundColor: Colors.background,
          position: "absolute",
          bottom: Math.min(insets.bottom, tabBar.horizontalInset),
        },
        tabBarItemStyle: {
          paddingVertical: tabBar.height / 2 - tabBar.iconFrame / 1.6,
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon={tab.icons} />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
};

export default TabLayout;
