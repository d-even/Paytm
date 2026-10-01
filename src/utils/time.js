const config = require('../config');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_HI = ['Ravivaar', 'Somvaar', 'Mangalwar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];

// All business-day maths happens in the merchant's local time zone (IST by default),
// otherwise a 11:30 PM sale would land on the wrong day.
function localParts(date, tz = config.agent.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wk = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  return { dayKey: `${get('year')}-${get('month')}-${get('day')}`, weekday: wk, hour: parseInt(get('hour'), 10) % 24 };
}

// Midnight (local time in `tz`) of the day containing `date`, as a UTC Date.
function startOfLocalDay(date, tz = config.agent.timezone) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t) => parseInt(p.find((x) => x.type === t).value, 10);
  const localAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  const offsetMs = localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day')) - offsetMs);
}

function daysAgo(n, from = new Date()) {
  return new Date(from.getTime() - n * 24 * 60 * 60 * 1000);
}

function hoursBetween(a, b) {
  return Math.abs(b.getTime() - a.getTime()) / 36e5;
}

module.exports = { DAY_NAMES, DAY_NAMES_HI, localParts, startOfLocalDay, daysAgo, hoursBetween };
