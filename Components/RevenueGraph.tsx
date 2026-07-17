import { chartRev } from "@/constants/data";
import { Colors } from "@/constants/theme";
import { Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

const data = chartRev.map((item) => ({
  value: item.rev,
  label: item.m,
}));

const RevenueGraph = () => {
  return (
    <View className="chart-card">
      <View className="chart-header">
        <View>
          <Text className="chart-title">Revenue Overview</Text>
          <Text className="chart-subtitle">Jan - Jul 2024</Text>
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
        hideRules
        hideYAxisText
        hideAxesAndRules
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
      />
    </View>
  );
};

export default RevenueGraph;
