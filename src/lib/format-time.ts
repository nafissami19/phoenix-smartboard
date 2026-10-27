export function formatTime12(date: Date = new Date()): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const mm = String(Math.floor(minutes)).padStart(2, '0');
  return `${hours12}:${mm} ${ampm}`;
}
