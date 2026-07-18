import { getRevenueChange } from "@/constants/stats";
import { Text, View } from "react-native";

type Props = {
  today: number;
  yesterday: number;
};

export default function ChangeIndicator({ today, yesterday }: Props) {
  const change = getRevenueChange(today, yesterday);
  const Icon = change.Icon;
  return (
    <View className="flex-row items-center gap-1">
      <Icon size={14} color={change.color} />

      <Text style={{ color: change.color }} className="font-inter-semibold">
        {change.value}
      </Text>
    </View>
  );
}
