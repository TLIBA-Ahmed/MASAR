export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const isoNow = () => new Date().toISOString();
export function addDays(date: string, days: number) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function ageAt(birth: string, date: string) {
  const b = new Date(birth),
    d = new Date(date);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (
    d.getUTCMonth() < b.getUTCMonth() ||
    (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())
  )
    age--;
  return age;
}
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
