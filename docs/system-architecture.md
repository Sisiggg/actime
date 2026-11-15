# ACTime

## An IoT-Based Air Conditioner Operating Hours Monitoring System

**Technical Architecture & Hardware Specification Document**

---

**Prepared for:** Guimaras State University – Mosqueda Campus

**Document Version:** 1.0  
**Date:** July 2026  
**Status:** Final

---

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Hardware Components](#4-hardware-components)
5. [Technical Specifications](#5-technical-specifications)
6. [Wiring & Interface Configuration](#6-wiring--interface-configuration)
7. [AC Operation Detection Logic](#7-ac-operation-detection-logic)
8. [Data Communication Protocol](#8-data-communication-protocol)
9. [Power Consumption Analysis](#9-power-consumption-analysis)
10. [Bill of Materials & Procurement](#10-bill-of-materials--procurement)
11. [Deployment Requirements](#11-deployment-requirements)
12. [Future Hardware Enhancements](#12-future-hardware-enhancements)
13. [References](#13-references)

---

---

## 1. Executive Summary

ACTime is an Internet of Things (IoT) based monitoring system developed to track the operating hours of air conditioning units at **Guimaras State University – Mosqueda Campus**. The system integrates environmental and electrical sensing hardware with a centralized web-based monitoring dashboard to support energy management and preventive maintenance planning.

Each monitored room is equipped with:

- An **ESP32 microcontroller** that processes and transmits data
- A **DHT22 sensor** that measures room temperature and humidity
- An **SCT-013 current transformer** that non-invasively detects when the air conditioner is operating

Data is transmitted over Wi-Fi to a central web server, where it is stored in a database, analyzed, and presented through a live dashboard accessible to administrators and maintenance personnel.

**Key Benefits:**

- Real-time visibility into air conditioner usage across the campus
- Automatic recording of ON/OFF timestamps and cumulative operating hours
- Data-driven reports for energy conservation and maintenance scheduling
- Identification of low-temperature anomalies (≤ 23°C) indicating overcooling
- Low deployment cost (~₱1,500 per room) and minimal power consumption

---

## 2. System Overview

### 2.1 Problem Statement

Educational institutions face significant operational costs from HVAC (Heating, Ventilation, and Air Conditioning) systems. Without usage monitoring, common inefficiencies arise:

- Air conditioners left running during unoccupied hours
- Unplanned equipment failures due to delayed maintenance
- Inability to attribute energy consumption to specific rooms
- No historical data for resource allocation decisions

### 2.2 Proposed Solution

ACTime addresses these challenges by instrumenting each monitored room with sensing hardware that automatically tracks AC usage. The system records every ON and OFF transition with precise timestamps, calculates total operating hours, and provides actionable reports — enabling proactive maintenance and informed energy management.

### 2.3 Scope

The system currently monitors **two (2) rooms** — **LAB A** and **LAB B** — with an architecture designed to scale to additional rooms and buildings as needed.

---

## 3. System Architecture Diagram

### Figure 1. End-to-End System Architecture

```
              PERCEPTION LAYER  (Monitoring Room)
       ┌────────────────────────────────────────────┐
       │                                            │
       │   ┌─────────────┐     ┌─────────────────┐  │
       │   │    DHT22    │     │    SCT-013      │  │
       │   │ Temperature │     │   Current       │  │
       │   │    Sensor   │     │    Sensor       │  │
       │   └──────┬──────┘     └───────┬─────────┘  │
       │          │  Data              │  Data       │
       │          ▼                    ▼             │
       │   ┌────────────────────────────────────┐    │
       │   │              ESP32                │    │
       │   │          Microcontroller          │    │
       │   │          (Wi-Fi Enabled)          │    │
       │   └────────────────────────────────────┘    │
       │              ▲  Power                      │
       │              │  5V DC                      │
       │   ┌─────────────────────┐                  │
       │   │ Centralized Power   │                  │
       │   │       Supply        │                  │
       │   └─────────────────────┘                  │
       └────────────────────────────────────────────┘
                              │  Wi-Fi (HTTP/JSON)
                              ▼
              ┌──────────────────────────┐
              │      NETWORK LAYER       │
              │    School Wi-Fi Router   │
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    APPLICATION LAYER     │
              │                          │
              │   Web Server (Node.js)   │
              │          │               │
              │   Database (SQLite)      │
              │          │               │
              │   Web Dashboard          │
              └────────────┬─────────────┘
                           │  Browser Access
                           ▼
              ┌──────────────────────────┐
              │      Administrator       │
              │      Web Dashboard       │
              └──────────────────────────┘
```

### Figure 2. Three-Layer Architecture Model

| Layer | Components | Function |
|-------|-----------|----------|
| **Perception Layer** | DHT22, SCT-013, ESP32 | Sensor data acquisition and preprocessing |
| **Network Layer** | Wi-Fi infrastructure, HTTP protocol | Data transmission to the server |
| **Application Layer** | Web server, SQLite database, Dashboard | Data storage, processing, and visualization |

---

## 4. Hardware Components

### 4.1 Component Overview

**Table 1. Hardware Bill of Materials (per monitored room)**

| # | Component | Model / Type | Qty | Primary Function |
|---|-----------|--------------|-----|------------------|
| 1 | Microcontroller | ESP32 DevKit V1 (ESP-WROOM-32) | 1 | Data acquisition, processing, and Wi-Fi transmission |
| 2 | Temperature Sensor | DHT22 (AM2302) | 1 | Measures room temperature and humidity |
| 3 | Current Sensor | SCT-013-030 (Split-Core, 30A) | 1 | Non-invasive detection of AC operation |
| 4 | Power Supply | Centralized Power Supply (5V DC) | 1 | Powers the ESP32 and sensors |
| 5 | Voltage Divider | 100kΩ + 10kΩ resistors (1%) | 2 pcs | Scales SCT-013 output to 0–3.3V ADC range |
| 6 | Filter Capacitor | 10µF Electrolytic | 1 | Smooths analog current signal |
| 7 | Prototyping Board | Half-size Breadboard | 1 | Circuit assembly during development |
| 8 | Jumper Wires | Male-to-Male / Male-to-Female | 15 pcs | Electrical connections |
| 9 | Enclosure | ABS Project Box (80×60×30 mm) | 1 | Protective housing for electronics |
| 10 | Power Cable | 2-core DC cable | 1 | 5V DC connection to ESP32 |

---

## 5. Technical Specifications

### 5.1 ESP32 Microcontroller

| Parameter | Specification |
|-----------|---------------|
| Processor | ESP-WROOM-32, Dual-Core Xtensa LX6 |
| Clock Speed | 240 MHz |
| Flash Memory | 4 MB |
| SRAM | 520 KB |
| Wi-Fi | 802.11 b/g/n (2.4 GHz) |
| Bluetooth | BLE 4.2 |
| ADC Resolution | 12-bit (2 × SAR ADC) |
| Digital I/O Pins | 34 programmable GPIO |
| Operating Voltage | 3.3V (5V tolerant via VIN) |
| Deep Sleep Mode | ~10 µA (power saving) |
| Operating Temperature | -40°C to +85°C |

### 5.2 DHT22 Temperature & Humidity Sensor

| Parameter | Specification |
|-----------|---------------|
| Temperature Range | -40°C to +80°C |
| Temperature Accuracy | ±0.5°C |
| Humidity Range | 0–100% RH |
| Humidity Accuracy | ±2% RH |
| Resolution | 0.1°C / 0.1% RH |
| Interface | Single-Wire Digital (OneWire) |
| Maximum Sampling Rate | 0.5 Hz (once every 2 s) |
| Supply Voltage | 3.3V – 5V DC |
| Power Consumption | 1.5 mA (typical) |

### 5.3 SCT-013-030 Current Sensor

| Parameter | Specification |
|-----------|---------------|
| Type | Split-Core Current Transformer |
| Rated Current | 0 – 30A AC |
| Output Signal | 0 – 1V Analog (AC) |
| Turns Ratio | 1:1800 |
| Clamp Aperture | 13 mm |
| Accuracy | ±3% |
| Installation | Clamp-on (non-invasive, no wiring modification) |
| Load Resistance | Built-in burden resistor |

---

## 6. Wiring & Interface Configuration

### 6.1 ESP32 Pin Assignment

**Table 2. Pin Connection Matrix**

| ESP32 Pin | Connected Component | Signal Type |
|-----------|--------------------|-------------|
| GPIO 4 | DHT22 DATA | Digital (OneWire) |
| GPIO 34 | SCT-013 output (via voltage divider) | Analog (ADC1_CH6) |
| 3.3V | DHT22 VCC | Power Supply |
| GND | DHT22 GND / SCT-013 GND | Ground |
| VIN (5V) | Centralized Power Supply | Power Input |

### 6.2 Wiring Schematic

```
                         ESP32 DevKit V1
        ┌──────────────────────────────────────────┐
        │                                          │
        │  3.3V ──────┬──────────────── DHT22 VCC  │
        │             │                           │
        │  GPIO4 ─────┴──────────────── DHT22 DATA │
        │                                          │
        │  GND ──────────────── DHT22 GND ──────── │
        │              └─────── SCT-013 GND        │
        │                                          │
        │  GPIO34 ──┬─── 100kΩ ──┬─── SCT-013 OUT  │
        │           │            │                │
        │           ├─── 10kΩ    │                │
        │           │     │      │                │
        │          GND   10µF    │                │
        │                  │     │                │
        │                 GND    │                │
        │                        │                │
        │  VIN ────── 5V DC      │                │
        │                        └── SCT-013 CLAMP │
        │                        ┌──────┴──────┐   │
        │                        │   AC POWER   │   │
        │                        │    WIRE      │   │
        │                        └─────────────┘   │
        └──────────────────────────────────────────┘
```

### 6.3 Signal Conditioning Circuit

The SCT-013 outputs a 0–1V AC signal centered on its internal reference. To interface with the ESP32's 0–3.3V ADC:

1. A **voltage divider (100kΩ/10kΩ)** shifts the signal reference to 1.65V
2. A **10µF capacitor** removes high-frequency noise
3. The conditioned signal is read on **GPIO 34** at 12-bit resolution

**Conversion Formula:**

```
I_primary = (V_adc − 1.65V) × 30A / 1V
```

Where:
- `V_adc` = measured ADC voltage
- `I_primary` = current drawn by the air conditioner

---

## 7. AC Operation Detection Logic

### 7.1 Threshold-Based Detection

The system determines AC status by comparing the measured current against a calibrated threshold:

**Figure 3. Current Threshold Detection**

```
        Current (A)
          │
       3.0│     ┌───┐          ┌───┐
          │     │   │          │   │
       0.5│─────┘   └──────────┘   └─────   ← Detection Threshold (0.5A)
          │
          └────────────────────────────────────►  Time
             AC ON      AC OFF      AC ON
```

### 7.2 Detection Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Current Threshold | 0.5A | Current above this = AC is ON |
| Debounce Period | 30 s | Sustained time required before confirming state change |
| Sampling Interval | 10 s | Period between sensor readings |

### 7.3 State Transition Logic

| Current Reading | Previous State | New State | Action |
|----------------|----------------|-----------|--------|
| > 0.5A | OFF | ON | Record ON timestamp |
| < 0.5A | ON | OFF | Record OFF timestamp, calculate duration |
| > 0.5A | ON | ON | No change (continue logging) |
| < 0.5A | OFF | OFF | No change (continue logging) |

---

## 8. Data Communication Protocol

### 8.1 Transmission Format

Each sensor reading is packaged as a JSON payload and sent via HTTP POST:

```json
{
  "unit_id": 1,
  "temperature": 24.5,
  "humidity": 60.2,
  "current_a": 3.1,
  "ac_status": "ON"
}
```

### 8.2 Communication Sequence

```
ESP32                          Server
  │                              │
  ├── Connect to Wi-Fi ──────────┤
  │                              │
  ├── HTTP POST /api/v1/readings │
  │     (JSON payload)           │
  │                              ├── Validate & store in database
  │                              ├── Detect state change
  │                              ├── Update dashboard (WebSocket)
  │◄── HTTP 200 OK ──────────────┤
  │                              │
  │  (Wait 10 seconds)           │
  │                              │
```

### 8.3 Error Handling

| Failure Scenario | Recovery Mechanism |
|------------------|-------------------|
| Wi-Fi disconnection | Automatic reconnect every 10 seconds; readings buffered locally |
| Server unavailable | Exponential backoff retry (1s → 2s → 4s → up to 60s) |
| Invalid payload | Server returns HTTP 400 with error description |

---

## 9. Power Consumption Analysis

**Table 3. Estimated Power Consumption per Room**

| Component | Current Draw | Daily Energy (8-hr Operation) |
|-----------|-------------|-------------------------------|
| ESP32 (active + Wi-Fi) | 240 mA @ 3.3V | ~6.3 Wh |
| DHT22 | 1.5 mA @ 3.3V | ~0.04 Wh |
| SCT-013 | Passive | 0 Wh |
| **Total** | **~241.5 mA** | **~6.4 Wh/day** |

The monitoring hardware adds negligible load to the electrical circuit — approximately equivalent to a single LED night light.

---

## 10. Bill of Materials & Procurement

### 10.1 Cost Breakdown (per monitored room)

**Table 4. Estimated Cost in Philippine Pesos**

| Component | Source | Unit Cost (₱) |
|-----------|--------|---------------|
| ESP32 DevKit V1 | Shopee / Lazada / Alexan | 250 – 400 |
| DHT22 Sensor | Shopee / Lazada | 150 – 250 |
| SCT-013-030 | Shopee / Lazada | 350 – 500 |
| Centralized power supply | Local electronics store | 100 – 150 |
| Resistors + Capacitor | Local electronics store | 50 |
| Breadboard + Wires | Shopee / Lazada | 150 – 250 |
| ABS Project Box | Shopee / Lazada | 100 – 200 |
| **Total per Room** | | **₱1,150 – ₱1,800** |

### 10.2 Total Project Cost (2 Rooms)

| Item | Cost (₱) |
|------|----------|
| Hardware for LAB A | 1,150 – 1,800 |
| Hardware for LAB B | 1,150 – 1,800 |
| Server (existing PC/laptop) | 0 |
| **Project Total** | **₱2,300 – ₱3,600** |

---

## 11. Deployment Requirements

| Requirement | Specification |
|-------------|---------------|
| Rooms to Monitor | LAB A, LAB B (scalable) |
| Hardware per Room | ESP32 + DHT22 + SCT-013 + power supply |
| Network | School Wi-Fi with coverage in both laboratories |
| Server | Any PC or laptop with Node.js installed |
| Database | SQLite (single portable file) |
| Dashboard Access | Web browser on desktop or mobile device |

### 11.1 Scaling Considerations

| Addition | Hardware Required |
|----------|------------------|
| Each new room | 1× ESP32, 1× DHT22, 1× SCT-013, 1× power supply |
| New building | Ensure Wi-Fi coverage; add router/access point if needed |
| Larger deployment | Consider dedicated server or cloud hosting |

---

## 12. Future Hardware Enhancements

| Enhancement | Component | Benefit |
|-------------|-----------|---------|
| Remote Control | IR Blaster (KY-005) | Automatically switch off AC units after prolonged inactivity |
| Energy Metering | PZEM-004T | Measure actual kWh consumption (not just ON/OFF) |
| Local Display | OLED (SSD1306) | Show real-time readings on the device itself |
| Power Backup | Li-Po Battery + Solar | Continued operation during power interruptions |
| Extended Range | LoRa Module | Communication for buildings without Wi-Fi coverage |
| Anomaly Detection | Software (ML) | Flag unusual usage patterns automatically |

---

## 13. References

1. Espressif Systems. *ESP32 Series Datasheet*. Available: https://www.espressif.com
2. Aosong Electronics. *DHT22 Digital Temperature and Humidity Sensor Datasheet*.
3. YHDC. *SCT-013 Non-invasive AC Current Sensor Datasheet*.
4. Express.js. *Node.js Web Application Framework Documentation*. https://expressjs.com
5. Socket.IO. *Real-time Engine Documentation*. https://socket.io

---

---

**Document Control**

| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.0 | July 2026 | ACTime Project Team | Initial release |

---

<p align="center">
  <strong>Guimaras State University – Mosqueda Campus</strong><br>
  San Miguel, Jordan, Guimaras, Philippines<br>
  <em>ACTime Project Documentation</em>
</p>
