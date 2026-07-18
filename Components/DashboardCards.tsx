import ChangeIndicator from "@/Components/RevenueTrend";
import { icons } from "@/constants/icons";
import {
    monthlyRevenue,
    pendingInvoices,
    todayRevenue,
    totalProducts,
    totalRevenue,
    yesterdayRevenue,
} from "@/constants/stats";
import { Colors, Spacing } from "@/constants/theme";
import { formatCurrency } from "@/lib/utils";
import React from "react";
import { Text, View } from "react-native";

const DollarIcon = icons.dollarsign;
const Products = icons.products;
const Invoices = icons.invoices;
const TrendUp = icons.trendup;

const DashboardCards = () => {
  return (
    <View>
      <View className="flex-row gap-3">
        <View className="home-balance-card">
          <View className="flex-row">
            <View
              style={{ borderRadius: 12 }}
              className="card-icon bg-green-bg"
            >
              <DollarIcon color={Colors.green} />
            </View>
            <View className="flex-row justify-between items-center w-full">
              <View className="ml-3 flex-row items-center">
                <View className="mr-2 p-3">
                  <ChangeIndicator
                    today={todayRevenue}
                    yesterday={yesterdayRevenue}
                  />
                </View>
              </View>
            </View>
          </View>
          <View className="home-balance-row">
            <Text
              style={{ fontSize: Spacing[4.5] }}
              className="home-balance-amount"
            >
              {formatCurrency(totalRevenue)}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted">Today's Revenue</Text>
          </View>
        </View>
        <View className="home-balance-card">
          <View className="flex-row">
            <View
              style={{ borderRadius: 12 }}
              className="card-icon bg-yellow-bg"
            >
              <Invoices color={Colors.yellow} />
            </View>
            <View className="flex-row justify-between items-center w-full">
              <View className="ml-3 flex-row items-center">
                <View className="mr-2 p-3">
                  <ChangeIndicator
                    today={todayRevenue}
                    yesterday={yesterdayRevenue}
                  />
                </View>
              </View>
            </View>
          </View>
          <View className="home-balance-row">
            <Text
              style={{ fontSize: Spacing[4.5] }}
              className="home-balance-amount"
            >
              {pendingInvoices}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted">Pending Invoices</Text>
          </View>
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="home-balance-card">
          <View className="flex-row">
            <View style={{ borderRadius: 12 }} className="card-icon bg-blue-bg">
              <Products color={Colors.blue} />
            </View>
            <View className="flex-row justify-between items-center w-full">
              <View className="ml-3 flex-row items-center">
                <View className="mr-2 p-3">
                  <ChangeIndicator
                    today={todayRevenue}
                    yesterday={yesterdayRevenue}
                  />
                </View>
              </View>
            </View>
          </View>
          <View className="home-balance-row">
            <Text
              style={{ fontSize: Spacing[4.5] }}
              className="home-balance-amount"
            >
              {totalProducts}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted">Total Products</Text>
          </View>
        </View>
        <View className="home-balance-card">
          <View className="flex-row">
            <View
              style={{ borderRadius: 12 }}
              className="card-icon bg-purple-bg"
            >
              <TrendUp color={Colors.purple} />
            </View>
            <View className="flex-row justify-between items-center w-full">
              <View className="ml-3 flex-row items-center">
                <View className="mr-2 p-3">
                  <ChangeIndicator
                    today={todayRevenue}
                    yesterday={yesterdayRevenue}
                  />
                </View>
              </View>
            </View>
          </View>
          <View className="home-balance-row">
            <Text
              style={{ fontSize: Spacing[4.5] }}
              className="home-balance-amount"
            >
              {formatCurrency(monthlyRevenue)}
            </Text>
          </View>
          <View>
            <Text className="text-text-muted">Monthly Revenue</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default DashboardCards;
