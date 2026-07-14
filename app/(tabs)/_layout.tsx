import { tabs } from "@/constants/data";
import "@/global.css";
import clsx from "clsx";
import { Tabs } from "expo-router";
import { type LucideIcon } from "lucide-react-native";
import { View } from "react-native";

type TabIconProps = {
  focused: boolean;
  icon: LucideIcon;
};

const TabLayout = () => {
  const TabIcon = ({ focused, icon }: TabIconProps) => {
    const Icon = icon;

    return (
      <View className="tabs-icon bg-background ">
        <View className={clsx("tabs-pill", focused && "tabs-active")}>
          <Icon size={20} color={focused ? "#fff" : "#6b7280"} />
        </View>
      </View>
    );
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        //tabBarShowLabel: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarStyle: {
          backgroundColor: "#121212",
          position: "absolute",
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
