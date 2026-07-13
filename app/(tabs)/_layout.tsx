import { Tabs } from "expo-router";

const TabLayout = () => (
  <Tabs screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="index" options={{ title: "Home" }} />
    <Tabs.Screen name="products" options={{ title: "Products" }} />
    <Tabs.Screen name="invoices" options={{ title: "Invoices" }} />
    <Tabs.Screen name="analytics" options={{ title: "Analytics" }} />
    <Tabs.Screen name="settings" options={{ title: "Settings" }} />
  </Tabs>
);

export default TabLayout;
