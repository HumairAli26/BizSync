import { auth, db } from "@/config/firebaseConfig";
import { Colors } from "@/constants/theme";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

type ChartPoint = {
  value: number;
  label: string;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getLastNMonths(
  n: number,
): { label: string; month: number; year: number }[] {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      label: MONTH_LABELS[d.getMonth()],
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return result;
}

// Total horizontal padding/margin eaten by the card + its own inner
// padding, so the chart doesn't overflow the card's edges. Adjust this if
// your "chart-card" class uses a different horizontal padding value.
const DESKTOP_CHART_MAX_WIDTH = 1200;
const CARD_HORIZONTAL_PADDING = 48;

const RevenueGraph = () => {
  const { width: windowWidth } = useWindowDimensions();
  const [orgId, setOrgId] = useState<string>("");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [rangeLabel, setRangeLabel] = useState<string>("");
  const chartWidth = Math.min(
    Math.max(windowWidth - CARD_HORIZONTAL_PADDING, 0),
    DESKTOP_CHART_MAX_WIDTH,
  );

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

  useEffect(() => {
    if (!orgId) return;

    const salesQuery = query(
      collection(db, "sales"),
      where("orgId", "==", orgId),
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const months = getLastNMonths(7);
      const totals = months.map(() => 0);

      snapshot.docs.forEach((docSnap) => {
        const sale = docSnap.data();
        const amount = sale.amount ?? 0;
        const saleDate: Date = sale.createdAt?.toDate
          ? sale.createdAt.toDate()
          : new Date(sale.createdAt);

        const idx = months.findIndex(
          (m) =>
            m.month === saleDate.getMonth() &&
            m.year === saleDate.getFullYear(),
        );
        if (idx !== -1) totals[idx] += amount;
      });

      setData(
        months.map((m, i) => ({
          value: totals[i],
          label: m.label,
        })),
      );

      if (months.length > 0) {
        setRangeLabel(
          `${months[0].label} - ${months[months.length - 1].label} ${months[months.length - 1].year}`,
        );
      }
    });

    return unsubscribe;
  }, [orgId]);

  return (
    <View
      className="chart-card"
      style={{
        minHeight: 420,
        width: "100%",
        maxWidth: DESKTOP_CHART_MAX_WIDTH,
        alignSelf: "center",
      }}
    >
      <View className="chart-header" style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text className="chart-title" style={{ fontSize: 24 }}>
            Revenue Overview
          </Text>
          <Text className="chart-subtitle">{rangeLabel}</Text>
        </View>

        <View className="chart-legend">
          <View className="chart-legend-item">
            <View
              className="size-3 rounded-full"
              style={{ backgroundColor: Colors.success }}
            />
            <Text className="chart-legend-text">Revenue</Text>
          </View>
        </View>
      </View>

      {/* This wrapper's only job is to report how wide the chart is allowed
          to be. alignSelf: "stretch" forces it to fill the cross-axis of
          its parent regardless of how chart-card sizes itself, and
          onLayout refines chartWidth with the real pixel value once known. */}
      <View style={{ width: "100%", alignSelf: "center", marginTop: 16 }}>
        <LineChart
          data={data}
          width={chartWidth}
          height={280}
          areaChart
          curved
          animateOnDataChange
          thickness={3}
          color={Colors.warning}
          startFillColor={Colors.success}
          endFillColor={Colors.success}
          startOpacity={0.25}
          endOpacity={0.02}
          hideDataPoints
          hideRules={true}
          hideAxesAndRules={false}
          spacing={56}
          initialSpacing={20}
          endSpacing={20}
          xAxisColor="transparent"
          yAxisColor="transparent"
          textColor={Colors.textSecondary}
          xAxisLabelTextStyle={{
            color: Colors.textSecondary,
            fontSize: 12,
          }}
          yAxisTextStyle={{
            color: Colors.textSecondary,
            fontSize: 12,
          }}
        />
      </View>
    </View>
  );
};

export default RevenueGraph;
