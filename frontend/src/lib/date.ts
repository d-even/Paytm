/** Local calendar date, YYYY-MM-DD, so "today" follows the shop's clock rather than UTC. */
export function localDateKey(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
