const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "9-noyabr, 2026, 15:09" (manual: browser ICU data for uz is unreliable). */
export const formatDate = (input: Date | string) => {
  const d = new Date(input);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
