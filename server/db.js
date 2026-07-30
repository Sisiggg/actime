const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DB_PATH = path.join(__dirname, '..', 'data', `actime_${PORT}.db`);
let db = null;

function wrap(dbRaw) {
  const api = {
    prepare(sql) {
      let stmt = null;
      try {
        stmt = dbRaw.prepare(sql);
      } catch (e) {
        // SQL.js throws on prepare for some statements — fallback to run/exec
      }

      function ensureStmt() {
        if (!stmt) stmt = dbRaw.prepare(sql);
        return stmt;
      }

      return {
        get(...params) {
          const s = ensureStmt();
          s.bind(params);
          if (s.step()) {
            const row = s.getAsObject();
            s.reset();
            return row;
          }
          s.reset();
          return undefined;
        },
        all(...params) {
          const s = ensureStmt();
          if (params.length) s.bind(params);
          const rows = [];
          while (s.step()) rows.push(s.getAsObject());
          s.reset();
          return rows;
        },
        run(...params) {
          try {
            if (stmt) {
              stmt.bind(params);
              stmt.step();
              stmt.reset();
            } else {
              dbRaw.run(sql, params);
            }
          } catch (e) {
            dbRaw.run(sql, params);
          }
          api._dirty = true;
        }
      };
    },
    exec(sql) {
      dbRaw.exec(sql);
      api._dirty = true;
    },
    _dirty: false,
    _raw: dbRaw
  };
  return api;
}

async function init() {
  const SQL = await initSqlJs();
  let buf;
  if (fs.existsSync(DB_PATH)) {
    buf = fs.readFileSync(DB_PATH);
    db = wrap(new SQL.Database(buf));
  } else {
    db = wrap(new SQL.Database());
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      room_name   TEXT NOT NULL,
      building    TEXT NOT NULL,
      description TEXT,
      threshold   REAL DEFAULT 0.5,
      target_temp REAL DEFAULT 24,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id      INTEGER NOT NULL,
      temperature  REAL,
      humidity     REAL,
      current_a    REAL,
      ac_status    TEXT CHECK(ac_status IN ('ON','OFF')),
      recorded_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );
    CREATE TABLE IF NOT EXISTS ac_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id     INTEGER NOT NULL,
      event_type  TEXT CHECK(event_type IN ('ON','OFF')),
      temperature REAL,
      event_time  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );
    CREATE INDEX IF NOT EXISTS idx_readings_unit_time ON readings(unit_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_events_unit_time  ON ac_events(unit_id, event_time);
  `);
  save();

  const count = db.prepare('SELECT COUNT(*) AS c FROM units').get();
  if (count.c === 0) {
    const ins = db.prepare('INSERT INTO units (room_name, building, description) VALUES (?, ?, ?)');
    ins.run('LAB A', 'Main Building', 'Computer Laboratory \u2013 2.5 HP Split Type');
    ins.run('LAB B', 'Main Building', 'Computer Laboratory \u2013 1.5 HP Split Type');
    save();
  }

  return db;
}

function save() {
  if (!db) return;
  const data = db._raw.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db._dirty = false;
}

function getDB() { return db; }

module.exports = { init, getDB, save };
