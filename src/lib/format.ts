export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const compactNumber = (value: number) =>
  new Intl.NumberFormat("es-ES", { notation: "compact" }).format(value);
export const formatBytes = (value: number) => {
  const bytes = Math.max(0, value);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unit = -1;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: amount >= 100 ? 0 : 1,
  }).format(amount)} ${units[unit]}`;
};
export const levelForXp = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const localDateTimeValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
