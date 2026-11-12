# ACTime — Backend Diagram

**IoT-Based Air Conditioner Operating Hours Monitoring System**
**Guimaras State University – Mosqueda Campus**

**Document Version:** 1.0  
**Date:** July 2026

---

## 1. Backend Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACTIME BACKEND                                     │
│                              (Node.js)                                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         HTTP / WebSocket                              │  │
│  │                            (Port 3000)                                │  │
│  └───────────────┬───────────────────────────────────┬───────────────────┘  │
│                  │                                   │                      │
│                  ▼                                   ▼                      │
│  ┌─────────────────────────────┐   ┌───────────────────────────────┐       │
│  │    Express Middleware       │   │   Socket.IO Server            │       │
│  │  • cors                     │   │   (Real-time Engine)          │       │
│  │  • express.json()           │   │   • emits 'reading' event     │       │
│  │  • express.static(public/)  │   │   • handles 'join-room'       │       │
│  └──────────────┬──────────────┘   └───────────────────────────────┘       │
│                 │                                                          │
│                 ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      REST API Routes (/api/v1)                        │  │
│  │                                                                       │  │
│  │   POST /readings            →  receive sensor data                    │  │
│  │   GET  /units               →  list rooms + live status               │  │
│  │   GET  /units/:id           →  room detail + events                   │  │
│  │   GET  /units/:id/readings  →  historical readings                    │  │
│  │   GET  /units/:id/hours     →  operating hours aggregation            │  │
│  │   GET  /report              →  generate report (JSON/CSV)             │  │
│  │   GET  /checklist           →  monitoring checklist data              │  │
│  └──────────────────────┬───────────────────────────────────────────────┘  │
│                         │                                                 │
│                         ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Business Logic Layer                              │  │
│  │                                                                       │  │
│  │  • VALIDATE input  (unit_id, ac_status required)                      │  │
│  │  • VERIFY unit     (exists & active)                                  │  │
│  │  • STORE reading   (INSERT INTO readings)                             │  │
│  │  • DETECT change   (compare with previous status)                     │  │
│  │  • RECORD event    (INSERT INTO ac_events)                            │  │
│  │  • CALCULATE hours (OFF_time − ON_time)                               │  │
│  │  • DETECT warning  (temperature ≤ 23°C)                               │  │
│  │  • GENERATE report (summary + daily breakdown)                        │  │
│  └──────────────────────┬───────────────────────────────────────────────┘  │
│                         │                                                 │
│                         ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Data Access Layer (db.js)                       │  │
│  │                        (SQLite via sql.js)                           │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │  │
│  │  │   units     │  │  readings   │  │  ac_events  │                    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                    │  │
│  │  • prepare()  • get()  • all()  • run()  • save()                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Device Simulator (simulator.js)                   │  │
│  │   (optional; started when ENABLE_SIMULATOR=true)                      │  │
│  │   Emulates ESP32: sends readings every 8s                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema (ER Diagram)

```
┌───────────────────────┐        ┌───────────────────────┐
│        units          │        │       readings        │
├───────────────────────┤        ├───────────────────────┤
│ id        INT  (PK)   │──────┐ │ id        INT  (PK)   │
│ room_name TEXT        │      ├─│ unit_id   INT  (FK)   │
│ building  TEXT        │      │ │ temperature REAL      │
│ description TEXT      │      │ │ humidity   REAL       │
│ threshold  REAL       │      │ │ current_a  REAL       │
│ target_temp REAL      │      │ │ ac_status  TEXT       │
│ is_active  INT        │      │ │ recorded_at TEXT      │
│ created_at TEXT       │      │ └───────────────────────┘
└───────────────────────┘      │
                               │   ┌───────────────────────┐
                               └───│       ac_events       │
                                   ├───────────────────────┤
                                   │ id        INT  (PK)   │
                                   │ unit_id   INT  (FK)   │
                                   │ event_type TEXT       │
                                   │ temperature REAL      │
                                   │ event_time TEXT       │
                                   └───────────────────────┘
```

**Relations:**
- `units.id` → `readings.unit_id` (one unit → many readings)
- `units.id` → `ac_events.unit_id` (one unit → many events)

**Indexes:**
```
idx_readings_unit_time  ON readings(unit_id, recorded_at)
idx_events_unit_time    ON ac_events(unit_id, event_time)
```

---

## 3. Request Processing Flows

### 3.1 Sensor Reading Ingestion — `POST /api/v1/readings`

This is the core write path used by ESP32 devices.

```
ESP32 sends JSON:
{ unit_id: 1, temperature: 24.5, humidity: 60,
  current_a: 3.1, ac_status: "ON" }
        │
        ▼
┌────────────────────────────────────────────┐
│ STEP 1  VALIDATE                           │
│ if !unit_id || !ac_status → 400            │
└────────────────────────────────────────────┘
        ▼
┌────────────────────────────────────────────┐
│ STEP 2  VERIFY UNIT                        │
│ SELECT * FROM units WHERE id=? AND active=1│
│ if not found → 404                         │
└────────────────────────────────────────────┘
        ▼
┌────────────────────────────────────────────┐
│ STEP 3  STORE READING                      │
│ INSERT INTO readings                       │
│  (unit_id, temp, humidity, current, status)│
└────────────────────────────────────────────┘
        ▼
┌────────────────────────────────────────────┐
│ STEP 4  DETECT STATE CHANGE                │
│ SELECT ac_status FROM readings             │
│  ORDER BY recorded_at DESC LIMIT 1 OFFSET 1│
│ (compare with incoming ac_status)          │
└───────────────┬────────────────────────────┘
                │  status changed?
                ▼  yes
┌────────────────────────────────────────────┐
│ STEP 5  RECORD EVENT                       │
│ INSERT INTO ac_events                      │
│  (unit_id, event_type, temperature)        │
└────────────────────────────────────────────┘
        ▼
┌────────────────────────────────────────────┐
│ STEP 6  PERSIST + PUSH                     │
│ 1. db.save()  → write to disk              │
│ 2. io.emit('reading', payload) → dashboard │
└────────────────────────────────────────────┘
        ▼
        HTTP 200 { ok: true }
```

### 3.2 Data Retrieval — `GET /api/v1/units`

Builds the live dashboard payload for every room.

```
Query all active units
        ▼
For each unit:
  ├─ Get latest reading  (ORDER BY recorded_at DESC LIMIT 1)
  ├─ Calculate today's hours
  │    (SUM of paired ON→OFF event durations)
  ├─ Get last ON  event
  ├─ Get last OFF event
  ├─ Determine running_now  (last ON > last OFF)
  ├─ Compute running_minutes
  ├─ Check warning  (temperature ≤ 23°C?)
  └─ Format ON/OFF times (12-hour clock)
        ▼
Return JSON: { units: [ { room_name, temperature,
                ac_status, today_hours, last_on_time,
                last_off_time, warning, ... } ] }
```

### 3.3 Report Generation — `GET /api/v1/report`

```
Query units (all active OR specified by unit_ids)
        ▼
For each unit:
  ├─ Pair ON→OFF events within date range
  ├─ Calculate total_hours
  ├─ Count on_cycles
  ├─ Compute avg_temperature
  ├─ Count low-temp warnings (≤ 23°C)
  └─ Build daily_breakdown (fill all days with hours)
        ▼
Aggregate grand total
        ▼
┌──────────────────────────────┬──────────────────┐
│ format=json                  │ format=csv       │
│ Return structured JSON       │ Return CSV file  │
│ (header, summary, units)     │ (header, room    │
│                              │  summary, daily  │
│                              │  breakdown,      │
│                              │  warnings)       │
└──────────────────────────────┴──────────────────┘
```

---

## 4. Real-Time Update Flow (Socket.IO)

```
┌──────────────┐    POST /readings    ┌─────────────────┐
│   ESP32 /    │ ─────────────────────►│                 │
│  Simulator   │                       │  Express        │
│              │                       │  (api.js)       │
└──────────────┘                       └────────┬────────┘
                                                │  io.emit('reading',
                                                │   payload)
                                                ▼
                                   ┌─────────────────────┐
                                   │  Dashboard (Client)  │
                                   │  socket.io client    │
                                   │                     │
                                   │  socket.on('reading',│
                                   │    → update UI)      │
                                   └─────────────────────┘
```

Events handled by the server:
| Event | Direction | Purpose |
|-------|-----------|---------|
| `reading` | Server → Client | Push new sensor reading to update dashboard |
| `join-room` | Client → Server | Client subscribes to a specific unit's updates |

---

## 5. File Structure

```
actime/
├── server/
│   ├── index.js          # Entry point: Express + Socket.IO setup, middleware
│   ├── api.js            # REST API routes + business logic (WARN_TEMP = 23)
│   ├── db.js             # SQLite data layer (sql.js wrapper: prepare/get/all/run/save)
│   └── simulator.js      # ESP32 emulator (reads + POST every 8s)
├── public/               # Static frontend files (served by Express)
└── data/                 # SQLite database file
```

---

## 6. Key Constants & Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Warning Temperature | 23°C (≤ triggers warning) | `api.js` — `WARN_TEMP` |
| Target Temperature | 24°C | `db.js` — `units.target_temp` |
| Current Threshold | 0.5A | `db.js` — `units.threshold` |
| Default Port | 3000 | `index.js` |
| Simulator Interval | 8000 ms | `simulator.js` |
| Readings Limit | 500 | `api.js` — `/units/:id/readings` |

---

<p align="center">
  <strong>Guimaras State University – Mosqueda Campus</strong><br>
  <em>ACTime Backend Diagram</em>
</p>