import BestSelling from "@/Components/BestSelling";
import DashboardCards from "@/Components/DashboardCards";
import ListHeadings from "@/Components/ListHeadings";
import MainHeader from "@/Components/MainHeader";
import RecentTransactions from "@/Components/RecentTransactions";
import RevenueGraph from "@/Components/RevenueGraph";
import SearchBar from "@/Components/SearchBar";
import "@/global.css";
import { styled } from "nativewind";
import { FlatList, View, useWindowDimensions } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const DESKTOP_BREAKPOINT = 900;

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  return (
    /*Header Section*/
    <SafeAreaView className="flex-1 bg-background p-5">
      <FlatList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={() => (
          <View
            style={
              isDesktop
                ? {
                    width: "100%",
                    maxWidth: 1400,
                    alignSelf: "center",
                    paddingTop: 8,
                    paddingBottom: 24,
                    gap: 24,
                  }
                : { gap: 20, paddingVertical: 10 }
            }
          >
            <MainHeader />
            <SearchBar />
            <DashboardCards />

            {isDesktop ? (
              <View style={{ gap: 24 }}>
                <View style={{ width: "100%", alignItems: "center" }}>
                  <View style={{ width: "100%", maxWidth: 1200 }}>
                    <RevenueGraph />
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 24,
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ListHeadings
                      title="Recent Transactions"
                      button="See All"
                    />
                    <RecentTransactions />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ListHeadings title="Best Selling" button="View All" />
                    <BestSelling />
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 20 }}>
                <ListHeadings title="Recent Transactions" button="See All" />
                <RecentTransactions />
                <ListHeadings title="Best Selling" button="View All" />
                <BestSelling />
              </View>
            )}
          </View>
        )}
        contentContainerClassName={isDesktop ? "pb-2" : "pb-10"}
      />
    </SafeAreaView>
  );
}
