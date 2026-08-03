export const getCurrentMonthYear = (): string => {
  const now = new Date();

  return now.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};
