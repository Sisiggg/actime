# ACTime — Context Diagram

**IoT-Based Air Conditioner Operating Hours Monitoring System**
**Guimaras State University – Mosqueda Campus**

---

## 1. Context Diagram (Level-0 DFD)

```
        ┌──────────────────────────────────────┐
        │           AC UNITS (Rooms)           │
        │        LAB A   •   LAB B             │
        │     (Air Conditioner Units)          │
        └─────────────────┬────────────────────┘
                          │  Power draw
                          │  (physical current)
                          ▼
        ┌──────────────────────────────────────┐
        │           ESP32 DEVICE               │
        │  ┌────────────────────────────────┐  │
        │  │  ┌──────────┐  ┌────────────┐  │  │
        │  │  │  DHT22   │  │  SCT-013   │  │  │
        │  │  │ Temp &   │  │  Current   │  │  │
        │  │  │ Humidity │  │  Sensor    │  │  │
        │  │  └──────────┘  └────────────┘  │  │
        │  └────────────────────────────────┘  │
        │  (reads sensors, transmits via Wi-Fi) │
        └─────────────────┬────────────────────┘
                          │  Sensor readings
                          │  (temperature, humidity,
                          │   current, AC status)
                          │  HTTP POST /api/v1/readings
                          ▼
        ┌──────────────────────────────────────────────────┐
        │                 ACTIME SYSTEM                     │
        │  ┌────────────┐  ┌────────────┐  ┌─────────────┐ │
        │  │  Web API   │  │  Database  │  │  Dashboard  │ │
        │  │  (Express) │  │  (SQLite)  │  │   (HTML/JS) │ │
        │  └────────────┘  └────────────┘  └─────────────┘ │
        │  • Stores readings        • Calculates hours     │
        │  • Detects ON/OFF        • Generates reports     │
        │  • Flags warnings (≤23°C)                        │
        └──────────┬──────────────────┬────────────────────┘
                   │                  │
        Dashboard view,          Report request
        warnings (≤23°C)         (date range)
                   │                  │
                   ▼                  ▼
        ┌──────────────────────────────────────┐
        │           SCHOOL ADMINISTRATOR       │
        │         (Dashboard & Reports)        │
        └──────────────────────────────────────┘
```

---

## 2. External Entities & Data Flows

### 2.1 AC Units (Monitored Equipment)

**Description:** The physical air conditioners in LAB A and LAB B whose operation is monitored. The SCT-013 sensor clamps onto the AC power wire to detect current draw without modifying the wiring.

| Data Flow | Direction | Contents |
|-----------|-----------|----------|
| Power Draw | AC Units → ESP32 Device | Electrical current (physical, via SCT-013 clamp) |

### 2.2 ESP32 Device (Data Source)

**Description:** The hardware node in each room. It integrates the **DHT22** (temperature & humidity) and **SCT-013** (current) sensors, processes the readings, and transmits them to the system over Wi-Fi.

| Data Flow | Direction | Contents |
|-----------|-----------|----------|
| Sensor Readings | ESP32 Device → System | Temperature, humidity, current draw, AC status (HTTP POST /api/v1/readings) |

### 2.3 School Administrator (User)

**Description:** University personnel who monitor room usage, review reports, and make energy management decisions.

| Data Flow | Direction | Contents |
|-----------|-----------|----------|
| Dashboard View | System → Admin | Live room status, temperature, operating hours, warnings |
| Temperature Warning | System → Admin | Alert when temperature ≤ 23°C |
| Report Request | Admin → System | Date range and room filter (GET /api/v1/report) |
| Generated Report | System → Admin | Room summary, daily breakdown, warnings (JSON/CSV) |

---

## 3. Summary of Data Flows

| # | Flow | From | To | Data |
|---|------|------|-----|------|
| 1 | Power Draw | AC Units | ESP32 Device | Electrical current (physical) |
| 2 | Sensor Readings | ESP32 Device | ACTime System | Temp, humidity, current, AC status |
| 3 | Dashboard View | ACTime System | School Admin | Live room status, hours |
| 4 | Temperature Warning | ACTime System | School Admin | Alert when temp ≤ 23°C |
| 5 | Report Request | School Admin | ACTime System | Date range, room filter |
| 6 | Generated Report | ACTime System | School Admin | Summary, daily breakdown, CSV |

---

## 4. System Boundary

The **ACTime System** box represents the automated monitoring solution:

- **Web API** — receives sensor data and serves the dashboard (Express, `/api/v1`)
- **Database** — stores units, readings, and ON/OFF events (SQLite)
- **Dashboard** — displays live status, charts, reports, and warnings to the administrator

Only these three internal components sit inside the system boundary. All sensors, hardware, and users are external entities that interact with the system through the defined data flows.

---

<p align="center">
  <strong>Guimaras State University – Mosqueda Campus</strong><br>
  <em>ACTime Context Diagram</em>
</p>
