const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./db');
const api = require('./api');

async function main() {
  await db.init();
  console.log('Database initialized');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/v1', api(io));

  io.on('connection', (socket) => {
    socket.on('join-room', (unitId) => socket.join(`unit:${unitId}`));
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`ACTime server running on http://localhost:${PORT}`);

    if (process.env.ENABLE_SIMULATOR === 'true') {
      console.log('Starting ESP32 simulator...');
      require('./simulator');
    }
  });
}

main().catch(err => { console.error(err); process.exit(1); });
