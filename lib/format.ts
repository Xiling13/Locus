const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function time(iso: string) {
  const d = new Date(iso);
  const m = String(d.getMinutes()).padStart(2, "0");
  const h24 = d.getHours();
  const h = h24 % 12 || 12;
  return `${h}:${m} ${h24 >= 12 ? "PM" : "AM"}`;
}

export function stamp(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time(iso)}`;
}

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  const hrs = Math.floor(s / 3600);
  if (s < 86400) return `${hrs} ${hrs === 1 ? "hr" : "hrs"} ago`;
  if (s < 86400 * 2) return "yesterday";
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return stamp(iso);
}

export function day(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
