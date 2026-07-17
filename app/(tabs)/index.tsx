import DashboardCards from "@/Components/DashboardCards";
import ListHeadings from "@/Components/ListHeadings";
import MainHeader from "@/Components/MainHeader";
import RevenueGraph from "@/Components/RevenueGraph";
import SearchBar from "@/Components/SearchBar";
import "@/global.css";
import { styled } from "nativewind";

import { FlatList, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  return (
    /*Header Section*/
    <SafeAreaView className="flex-1 bg-background p-5">
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={() => (
          <View>
            <MainHeader />
            <SearchBar />
            <DashboardCards />
            <RevenueGraph />

            {/*Recent Transactions*/}
            <View>
              <ListHeadings
                title="Recent Transactions"
                button="See All"
              ></ListHeadings>
            </View>
            <View className="transactions-card"></View>

            {/*Best Selling*/}
            <View>
              <ListHeadings
                title="Best Selling"
                button="View All"
              ></ListHeadings>
            </View>
            <View>
              <View className="product-card"></View>
              <View className="product-card"></View>
              <View className="product-card"></View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
