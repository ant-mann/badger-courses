export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHour < 24) return `Updated ${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  return `Updated ${diffDay} ${diffDay === 1 ? "day" : "days"} ago`;
}
