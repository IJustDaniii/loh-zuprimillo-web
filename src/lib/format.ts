export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const compactNumber = (value: number) =>
  new Intl.NumberFormat("es-ES", { notation: "compact" }).format(value);
export const levelForXp = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const localDateTimeValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
