import { auth, db } from "@/config/firebaseConfig";
import { Colors } from "@/constants/theme";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

type ChartPoint = {
  // null = future month, not plotted yet. Combined with
  // interpolateMissingValues={false} on the chart below, this breaks the
  // line instead of drawing through months that haven't happened yet.
  value: number | null;
  label: string;
  hideDataPoint?: boolean;
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

// Always the current calendar year, Jan through Dec — not a rolling
// 12-month window. Every month gets a label (so the x-axis always reads
// Jan..Dec), and a flag for whether it's already happened.
function getCalendarYearMonths(): {
  label: string;
  month: number;
  year: number;
  isPast: boolean;
}[] {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  return MONTH_LABELS.map((label, month) => ({
    label,
    month,
    year,
    isPast: month <= currentMonth,
  }));
}

const DESKTOP_BREAKPOINT = 900;
const DESKTOP_CHART_MAX_WIDTH = 1200;

// Always shows all 12 months (Jan-Dec) as labels. Spacing between points is
// derived from the real measured container width (see containerWidth
// below) rather than a fixed value, so all 12 points+labels always fit the
// screen instead of overflowing on narrow phones.
const DESKTOP_EDGE_SPACING = 20;
const MOBILE_EDGE_SPACING = 6;
const DESKTOP_MIN_SPACING = 40;
const MOBILE_MIN_SPACING = 14;

const RevenueGraph = () => {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;

  const [orgId, setOrgId] = useState<string>("");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [expenseData, setExpenseData] = useState<ChartPoint[]>([]);
  const [rangeLabel, setRangeLabel] = useState<string>("");

  // Measured from the actual chart wrapper via onLayout — but a nested
  // View's reported layout width can occasionally come back larger than
  // what's actually visible on screen (e.g. once inside a FlatList header
  // with several nested Views, layout can settle before every ancestor's
  // width is fully resolved). That was letting the chart render wider than
  // the phone's screen, so the right edge (and the last month, Aug) got
  // sliced off by the card's rounded corners instead of ever being resized
  // down. Capping by the real window width as a hard ceiling means the
  // chart can never be wider than what's physically on screen, regardless
  // of what the container reports.
  const [containerWidth, setContainerWidth] = useState(0);
  const maxVisibleWidth = windowWidth - (isDesktop ? 0 : 16);
  const chartWidth = Math.min(
    containerWidth > 0 ? containerWidth : maxVisibleWidth,
    maxVisibleWidth,
    DESKTOP_CHART_MAX_WIDTH,
  );

  const edgeSpacing = isDesktop ? DESKTOP_EDGE_SPACING : MOBILE_EDGE_SPACING;
  const minSpacing = isDesktop ? DESKTOP_MIN_SPACING : MOBILE_MIN_SPACING;
  // Reserve room for the y-axis number column up front so a wide number
  // (e.g. "79490") can't silently push the plotted area past chartWidth —
  // that horizontal overflow is what was slicing off the right edge.
  const yAxisLabelWidth = isDesktop ? 56 : 34;
  const plottableWidth = Math.max(chartWidth - yAxisLabelWidth, 0);

  // Always 12 points (Jan-Dec). Spacing is derived from the measured width
  // so all 12 labels fit inside the plot area on any screen size.
  const monthCount = 12;
  const spacing = Math.max(
    (plottableWidth - edgeSpacing * 2) / (monthCount - 1),
    minSpacing,
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
      const months = getCalendarYearMonths();
      const revenueTotals = months.map(() => 0);
      const expenseTotals = months.map(() => 0);

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
        if (idx === -1) return;

        if (amount >= 0) {
          revenueTotals[idx] += amount;
        } else {
          expenseTotals[idx] += Math.abs(amount);
        }
      });

      setData(
        months.map((m, i) => ({
          value: m.isPast ? Math.max(revenueTotals[i], 0) : null,
          label: m.label,
          hideDataPoint: !m.isPast,
        })),
      );

      setExpenseData(
        months.map((m, i) => ({
          value: m.isPast ? Math.max(expenseTotals[i], 0) : null,
          label: m.label,
          hideDataPoint: !m.isPast,
        })),
      );

      setRangeLabel(`Jan - Dec ${months[0].year}`);
    });

    return unsubscribe;
  }, [orgId]);

  return (
    <View
      className="chart-card"
      style={{
        minHeight: isDesktop ? 420 : 320,
        width: "100%",
        maxWidth: DESKTOP_CHART_MAX_WIDTH,
        alignSelf: "center",
        overflow: "hidden",
      }}
    >
      <View className="chart-header" style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            className="chart-title"
            style={{ fontSize: isDesktop ? 24 : 18, color: "#fff" }}
          >
            Revenue Overview
          </Text>
          <Text className="chart-subtitle">{rangeLabel}</Text>
        </View>

        <View className="chart-legend">
          <View className="chart-legend-item">
            <View
              className="size-3 rounded-full"
              style={{ backgroundColor: Colors.chartRevenue }}
            />
            <Text className="chart-legend-text">Revenue</Text>
          </View>
          <View className="chart-legend-item">
            <View
              className="size-3 rounded-full"
              style={{ backgroundColor: Colors.chartExpenses }}
            />
            <Text className="chart-legend-text">Expenses</Text>
          </View>
        </View>
      </View>

      {/* This wrapper's only job is to report how wide the chart is allowed
          to be. onLayout measures the REAL rendered width of this box
          (after whatever padding chart-card actually applies), instead of
          guessing it from windowWidth. That's what keeps the chart from
          overflowing/clipping on both edges on mobile. We hold off
          rendering the LineChart until we have a real measurement so it
          never briefly renders at the wrong (0 or windowWidth) size. */}
      <View
        style={{ width: "100%", alignSelf: "center", marginTop: 16 }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {chartWidth > 0 && (
          <LineChart
            data={data as any}
            data2={expenseData as any}
            width={chartWidth}
            height={isDesktop ? 280 : 200}
            curved
            animateOnDataChange
            // Future months carry a null value. Without this flag the
            // library interpolates a value for them (drawing a fake
            // projected line); with it, the lines simply break after the
            // last real (past/current) month while all 12 month labels
            // still render along the x-axis.
            interpolateMissingValues={false}
            thickness={isDesktop ? 3 : 2}
            thickness2={isDesktop ? 3 : 2}
            color={Colors.chartRevenue}
            color2={Colors.chartExpenses}
            hideDataPoints={true}
            hideDataPoints2={true}
            hideRules={true}
            hideAxesAndRules={false}
            spacing={spacing}
            initialSpacing={edgeSpacing}
            endSpacing={edgeSpacing}
            xAxisColor="transparent"
            yAxisColor="transparent"
            textColor={Colors.textSecondary}
            xAxisLabelTextStyle={{
              color: Colors.textSecondary,
              fontSize: isDesktop ? 12 : 8,
            }}
            yAxisTextStyle={{
              color: Colors.textSecondary,
              fontSize: isDesktop ? 12 : 9,
            }}
            yAxisLabelWidth={yAxisLabelWidth}
          />
        )}
      </View>
    </View>
  );
};

export default RevenueGraph;
