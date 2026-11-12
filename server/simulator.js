const http = require('http');
const TARGET = 24;
const INTERVAL_MS = 60000;

const units = [
  { id: 1, name: 'LAB A' },
  { id: 2, name: 'LAB B' },
];

const state = {};
units.forEach(u => {
  const isOn = Math.random() > 0.3;
  state[u.id] = {
    ac: isOn ? 'ON' : 'OFF',
    temp: TARGET + 3 + Math.random() * 5,
    nextChangeAt: Date.now() + (isOn ? randomOnMS() : randomOffMS()),
  };
});

function randomOnMS()  { return (2 * 60 + Math.random() * 3 * 60) * 1000; }
function randomOffMS() { return (2 * 60 + Math.random() * 3 * 60) * 1000; }

function simulate() {
  units.forEach(u => {
    const s = state[u.id];
    const now = Date.now();

    if (now >= s.nextChangeAt) {
      const newState = s.ac === 'ON' ? 'OFF' : 'ON';
      const dur = newState === 'ON' ? randomOnMS() : randomOffMS();
      console.log(`[${u.name}] ${s.ac} → ${newState} | next in ${Math.round(dur/60000)}min`);
      s.ac = newState;
      s.nextChangeAt = now + dur;
    }

    if (s.ac === 'ON') {
      s.temp += (TARGET - s.temp) * 0.12 + (Math.random() - 0.5) * 0.6;
    } else {
      s.temp += 0.2 + Math.random() * 0.3;
    }
    s.temp = Math.round(Math.max(18, Math.min(40, s.temp)) * 10) / 10;

    const current = s.ac === 'ON' ? 2.5 + Math.random() * 3 : Math.random() * 0.1;
    const humidity = 55 + Math.random() * 15;

    const payload = JSON.stringify({
      unit_id: u.id,
      temperature: s.temp,
      humidity: Math.round(humidity * 10) / 10,
      current_a: Math.round(current * 100) / 100,
      ac_status: s.ac
    });

    const port = parseInt(process.env.PORT, 10) || 8080;
    const opts = {
      hostname: 'localhost',
      port,
      path: '/api/v1/readings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };
    const req = http.request(opts);
    req.write(payload);
    req.end();
    req.on('error', () => {});

    const minLeft = Math.max(0, Math.round((s.nextChangeAt - now) / 60000));
    process.stdout.write(`\r\x1b[K${u.name}: ${s.ac} | ${s.temp}°C | change in ${minLeft}min | ${Math.round(current*100)/100}A `);
  });
}

console.log(`ESP32 Simulator (target: ${TARGET}°C, ON: 10-30min, OFF: 5-15min)`);
simulate();
setInterval(simulate, INTERVAL_MS);
