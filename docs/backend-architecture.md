# ACTime — Backend Architecture

**IoT-Based Air Conditioner Operating Hours Monitoring System**
**Guimaras State University – Mosqueda Campus**

**Document Version:** 1.0  
**Date:** July 2026

---

## 1. Backend Overview

The ACTime backend is a lightweight, single-process web server built with **Node.js** and **Express**. It receives sensor data from ESP32 devices, processes AC ON/OFF state transitions, stores historical records in a **SQLite** database, and serves a real-time web dashboard.

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18.x / 20.x |
| Web Framework | Express | 4.21 |
| Real-time Engine | Socket.IO | 4.7 |
| Database | SQLite (via sql.js) | 1.14 |
| CORS Middleware | cors | 2.8 |

---

## 2. Backend Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        ACTIME BACKEND                               │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    HTTP / WebSocket                         │  │
│   │                        (Port 3000)                          │  │
│   └───────────────┬──────────────────────────┬──────────────────┘  │
│                   │                          │                      │
│                   ▼                          ▼                      │
│   ┌───────────────────────┐    ┌───────────────────────┐          │
│   │   REST API Layer      │    │  WebSocket (Socket.IO)│          │
│   │   /api/v1/*           │    │  Real-time Updates    │          │
│   └───────────┬───────────┘    └───────────┬───────────┘          │
│               │                           │                        │
│               ▼                           ▼                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                  Business Logic Layer                        │  │
│   │  • Reading validation & storage                              │  │
│   │  • AC state-change (ON/OFF) detection                        │  │
│   │  • Operating hours calculation                               │  │
│   │  • Report & daily breakdown generation                       │  │
│   │  • Low-temperature warning detection (≤ 23°C)                │  │
│   └───────────────────────────────┬─────────────────────────────┘  │
│                                   │                                │
│                                   ▼                                │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    Data Access Layer                         │  │
│   │                    (SQLite / sql.js)                         │  │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │  │
│   │  │  units   │ │ readings │ │ac_events │ │daily_summary │    │  │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │              Static File Serving Layer                       │  │
│   │            (public/ — dashboard HTML/CSS/JS)                 │  │
│   └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Components

### 3.1 Server Entry Point — `server/index.js`

Responsibilities:
- Initializes the database connection
- Configures Express middleware (CORS, JSON parsing, static files)
- Mounts the REST API under `/api/v1`
- Sets up Socket.IO for real-time push updates
- Starts the HTTP server on the configured port
- Optionally launches the ESP32 simulator

### 3.2 REST API Layer — `server/api.js`

Defines all HTTP endpoints consumed by the dashboard frontend.

### 3.3 Database Layer — `server/db.js`

Wraps sql.js to provide a SQLite interface with:
- Automatic table creation
- Seed data insertion (LAB A, LAB B)
- Persistent file storage (`data/actime_{port}.db`)

### 3.4 Device Simulator — `server/simulator.js`

Emulates ESP32 hardware for testing and demonstration:
- Generates realistic temperature, humidity, and current readings
- Simulates AC ON/OFF cycles (10–30 min ON, 5–15 min OFF)
- Sends data to the server exactly like real hardware

---

## 4. REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/readings` | Submit a sensor reading from an ESP32 |
| GET | `/api/v1/units` | List all monitored rooms with live status |
| GET | `/api/v1/units/:id` | Get a single room's details, latest reading, and recent events |
| GET | `/api/v1/units/:id/readings` | Get historical temperature readings (time range) |
| GET | `/api/v1/units/:id/hours` | Get operating hours (daily aggregation) |
| GET | `/api/v1/report` | Generate a usage report (JSON or CSV export) |
| GET | `/api/v1/checklist` | Get ON/OFF event times grouped by date for the monitoring checklist |

---

## 5. Data Flow: Sensor Reading Processing

When an ESP32 device submits a reading, the backend executes this sequence:

```
POST /api/v1/readings
        │
        ▼
┌─────────────────────┐
│ 1. Validate payload │  unit_id + ac_status required
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 2. Verify unit      │  unit must exist and be active
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 3. Store reading    │  INSERT INTO readings
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 4. Detect change    │  Compare with previous reading
└─────────┬───────────┘
          │  status changed?
          ▼  yes
┌─────────────────────┐
│ 5. Record event     │  INSERT INTO ac_events (ON/OFF)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 6. Persist database │  save() → write file
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 7. Push update      │  Socket.IO → dashboard
└─────────────────────┘
```

---

## 6. Database Schema

### 6.1 Table: `units`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| room_name | TEXT | Room designation (LAB A, LAB B) |
| building | TEXT | Building name |
| description | TEXT | AC unit details |
| threshold | REAL | Current threshold for ON detection (0.5A) |
| target_temp | REAL | Target temperature (24°C) |
| is_active | INTEGER | Monitoring status (0/1) |
| created_at | TEXT | Registration timestamp |

### 6.2 Table: `readings`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Reading ID |
| unit_id | INTEGER | FK → units.id |
| temperature | REAL | Room temperature (°C) |
| humidity | REAL | Humidity (%) |
| current_a | REAL | Current draw (A) |
| ac_status | TEXT | 'ON' or 'OFF' |
| recorded_at | TEXT | Timestamp |

### 6.3 Table: `ac_events`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Event ID |
| unit_id | INTEGER | FK → units.id |
| event_type | TEXT | 'ON' or 'OFF' transition |
| temperature | REAL | Temperature at transition |
| event_time | TEXT | Timestamp of transition |

### 6.4 Indexes

```
idx_readings_unit_time  ON readings(unit_id, recorded_at)
idx_events_unit_time    ON ac_events(unit_id, event_time)
```

---

## 7. Core Business Logic

### 7.1 AC State-Change Detection

Each incoming reading is compared against the previous reading for the same unit:

| Previous Status | New Status | Action |
|----------------|-----------|--------|
| OFF | ON | Record ON event |
| ON | OFF | Record OFF event |
| ON | ON | No event (continuous operation) |
| OFF | OFF | No event |

### 7.2 Operating Hours Calculation

Operating hours are computed from paired ON/OFF events:

```
Duration = OFF_time − ON_time

Example:
  ON at 10:08 AM, OFF at 4:30 PM
  → Operating hours = 6.37 hours
```

Hours are aggregated per day for daily breakdowns and totals.

### 7.3 Low-Temperature Warning

When the room temperature drops to **≤ 23°C**, a warning is generated:

- **Dashboard:** Red warning badge on the room card
- **Room Detail:** Red banner + dashed threshold line on the chart
- **Reports:** Warning count and lowest temperature in the report table

### 7.4 Report Generation

The `/api/v1/report` endpoint produces:

| Section | Contents |
|---------|----------|
| Header | Period, generation date, summary stats |
| Room Summary | Total hours, ON cycles, avg temp per room |
| Daily Breakdown | Hours per day per room with totals |
| Warnings | Rooms with low-temp warnings |
| Export | CSV format for Excel/Sheets |

---

## 8. Real-Time Updates (Socket.IO)

The backend pushes live updates to connected dashboard clients:

| Event | Payload | Trigger |
|-------|---------|---------|
| `reading` | `{ unit_id, temperature, humidity, current_a, ac_status }` | Every new sensor reading |
| `join-room` | `unitId` | Client subscribes to a specific room |

The dashboard updates room cards, temperature charts, and event lists instantly without page refresh.

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Unauthorized sensor writes | API key validation (production) |
| CORS restrictions | `cors` middleware with configurable origins |
| SQL injection | Parameterized prepared statements |
| Data integrity | Foreign key constraints + CHECK constraints |
| Port exposure | Bind to internal network; firewall rules |

---

## 10. File Structure

```
actime/
├── server/
│   ├── index.js          # Server entry point (Express + Socket.IO)
│   ├── api.js            # REST API routes & business logic
│   ├── db.js             # SQLite database layer (sql.js)
│   └── simulator.js      # ESP32 device simulator
├── public/
│   ├── index.html        # Dashboard page
│   ├── room.html         # Room detail page
│   ├── reports.html      # Reports page
│   ├── css/style.css     # Styling (light/dark themes)
│   └── js/               # Frontend scripts
├── data/                 # SQLite database files
└── package.json          # Dependencies & scripts
```

---

## 11. Deployment

### 11.1 Local Deployment

```bash
npm install
ENABLE_SIMULATOR=true npm start
# Server runs on http://localhost:3000
```

### 11.2 Cloud Deployment (Render)

| Setting | Value |
|---------|-------|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Env: ENABLE_SIMULATOR | `true` |
| Env: NODE_VERSION | `20` |

---

**Document Control**

| Revision | Date | Description |
|----------|------|-------------|
| 1.0 | July 2026 | Initial release |

---

<p align="center">
  <strong>Guimaras State University – Mosqueda Campus</strong><br>
  <em>ACTime Backend Architecture</em>
</p>
