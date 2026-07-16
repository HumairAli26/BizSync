import { tabs } from "@/constants/data";
import { Colors, components } from "@/constants/theme";
import clsx from "clsx";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabBar = components.tabBar;

const TabLayout = () => {
  const insets = useSafeAreaInsets();
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
    </Tabs>
  );
};

export default TabLayout;
