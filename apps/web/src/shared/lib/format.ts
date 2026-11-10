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

/** "3 daqiqa oldin" / "kecha" style hints for feeds; falls back to a date after a week. */
export const formatRelative = (input: Date | string, now = new Date()) => {
  const d = new Date(input);
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (sec < 45) return "hozirgina";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.round(hours / 24);
  if (days === 1) return "kecha";
  if (days < 7) return `${days} kun oldin`;
  return formatDate(d);
};

/** "9-noy": compact day label for chart axes. */
export const formatDay = (input: Date | string) => {
  const d = new Date(input);
  return `${d.getDate()}-${MONTHS[d.getMonth()]?.slice(0, 3)}`;
};
