import { auth, db } from "@/config/firebaseConfig";
import { Colors } from "@/constants/theme";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
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

const RevenueGraph = () => {
  const [orgId, setOrgId] = useState<string>("");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [rangeLabel, setRangeLabel] = useState<string>("");

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
    <View className="chart-card">
      <View className="chart-header">
        <View>
          <Text className="chart-title">Revenue Overview</Text>
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

      <LineChart
        data={data}
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
        spacing={42}
        initialSpacing={10}
        endSpacing={10}
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
  );
};

export default RevenueGraph;
