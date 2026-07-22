import ChangeIndicator from "@/Components/RevenueTrend";
import { auth, db } from "@/config/firebaseConfig";
import { icons } from "@/constants/icons";
import { Colors, Spacing } from "@/constants/theme";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

const DollarIcon = icons.dollarsign;
const Products = icons.products;
const Invoices = icons.invoices;
const TrendUp = icons.trendup;

// Pakistani Rupee formatting (Rs. 1,23,456 style) — matches invoices/customers
const formatPKR = (amount: number | null | undefined) => {
  const value = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const fixed = Math.round(Math.abs(value)).toString();
  let lastThree = fixed.slice(-3);
  const otherNumbers = fixed.slice(0, -3);
  if (otherNumbers !== "") lastThree = "," + lastThree;
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `Rs. ${formattedInt}`;
};

const DashboardCards = () => {
  const [orgId, setOrgId] = useState<string>("");
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState<number>(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [pendingInvoices, setPendingInvoices] = useState<number>(0);
  const [totalProducts, setTotalProducts] = useState<number>(0);

  // Step 1: get the current user's orgId
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        setOrgId(snapshot.data().orgId);
      }
    });

    return unsubscribe;
  }, []);

  // Step 2: once we have orgId, listen to sales for revenue numbers
  useEffect(() => {
    if (!orgId) return;

    const salesQuery = query(
      collection(db, "sales"),
      where("orgId", "==", orgId),
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const now = new Date();
      const todayStr = now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      let todayTotal = 0;
      let yesterdayTotal = 0;
      let monthTotal = 0;

      snapshot.docs.forEach((docSnap) => {
        const sale = docSnap.data();
        const amount = sale.amount ?? 0;
        const saleDate: Date = sale.createdAt?.toDate
          ? sale.createdAt.toDate()
          : new Date(sale.createdAt);

        if (saleDate.toDateString() === todayStr) todayTotal += amount;
        if (saleDate.toDateString() === yesterdayStr) yesterdayTotal += amount;
        if (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        ) {
          monthTotal += amount;
        }
      });

      setTodayRevenue(todayTotal);
      setYesterdayRevenue(yesterdayTotal);
      setMonthlyRevenue(monthTotal);
    });

    return unsubscribe;
  }, [orgId]);

  // Step 3: "still owed" invoices — pending, overdue, or partially paid
  useEffect(() => {
    if (!orgId) return;

    const invoicesQuery = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      where("status", "in", ["pending", "overdue", "partial"]),
    );

    const unsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
      setPendingInvoices(snapshot.docs.length);
    });

    return unsubscribe;
  }, [orgId]);

  // Step 4: total products count
  useEffect(() => {
    if (!orgId) return;

    const productsQuery = query(
      collection(db, "products"),
      where("orgId", "==", orgId),
    );

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      setTotalProducts(snapshot.docs.length);
    });

    return unsubscribe;
  }, [orgId]);

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
              {formatPKR(todayRevenue)}
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
              {formatPKR(monthlyRevenue)}
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
