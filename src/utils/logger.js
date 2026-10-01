// Tiny structured logger. Every line is tagged with the architecture layer it came from,
// so a demo run reads like the flowchart: [data] → [gateway] → [agent:observe] → ... → [channel:soundbox]
const COLORS = {
  data: 35, gateway: 34, pos: 33, db: 90, api: 90, scheduler: 90,
  'agent:observe': 36, 'agent:reason': 36, 'agent:decide': 36, 'agent:act': 31, 'agent:learn': 32,
  'agent:realtime': 31, 'channel:soundbox': 94, 'channel:whatsapp': 92, 'channel:dashboard': 94,
};

function fmt(level, tag, msg, extra) {
  const color = COLORS[tag] || 37;
  const time = new Date().toISOString().slice(11, 19);
  const tail = extra === undefined ? '' : ' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra));
  return `${time} \x1b[${color}m[${tag}]\x1b[0m ${level === 'error' ? '\x1b[31m' : ''}${msg}${level === 'error' ? '\x1b[0m' : ''}${tail}`;
}

const silent = process.env.NODE_ENV === 'test';

module.exports = {
  info: (tag, msg, extra) => { if (!silent) console.log(fmt('info', tag, msg, extra)); },
  warn: (tag, msg, extra) => { if (!silent) console.warn(fmt('warn', tag, msg, extra)); },
  error: (tag, msg, extra) => console.error(fmt('error', tag, msg, extra)),
};
