const { Router } = require('express');

const WARN_TEMP = 23;

function localDateStr(d) {
  const v = d || new Date();
  return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
}

function localDateTimeStr(d) {
  const v = d || new Date();
  return localDateStr(v) + ' ' + String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0') + ':' + String(v.getSeconds()).padStart(2, '0');
}

function localDateDaysAgo(n) {
  return localDateStr(new Date(Date.now() - n * 86400000));
}

module.exports = function (io) {
  const router = Router();

  function db() { return require('./db').getDB(); }

  router.post('/readings', (req, res) => {
    const { unit_id, temperature, humidity, current_a, ac_status } = req.body;
    if (!unit_id || !ac_status) {
      return res.status(400).json({ error: 'unit_id and ac_status are required' });
    }

    const unit = db().prepare('SELECT * FROM units WHERE id = ? AND is_active = 1').get(unit_id);
    if (!unit) return res.status(404).json({ error: 'Unit not found or inactive' });

    db().prepare(`INSERT INTO readings (unit_id, temperature, humidity, current_a, ac_status)
                  VALUES (?, ?, ?, ?, ?)`).run(unit_id, temperature, humidity, current_a, ac_status);

    const last = db().prepare(`SELECT ac_status FROM readings WHERE unit_id = ?
                               ORDER BY recorded_at DESC LIMIT 1 OFFSET 1`).get(unit_id);

    if (!last || last.ac_status !== ac_status) {
      db().prepare('INSERT INTO ac_events (unit_id, event_type, temperature) VALUES (?, ?, ?)')
        .run(unit_id, ac_status, temperature);
    }

    require('./db').save();
    io.emit('reading', { unit_id, temperature, humidity, current_a, ac_status });

    res.json({ ok: true });
  });

  router.get('/units', (req, res) => {
    const units = db().prepare('SELECT * FROM units WHERE is_active = 1').all();
    const today = localDateStr();

    const result = units.map(u => {
      const lastReading = db().prepare(`SELECT temperature, humidity, current_a, ac_status, recorded_at
                                        FROM readings WHERE unit_id = ? ORDER BY recorded_at DESC LIMIT 1`).get(u.id);

      const todayHours = db().prepare(`
        SELECT COALESCE(SUM(
          CAST(strftime('%s', e2.event_time) AS REAL) - CAST(strftime('%s', e1.event_time) AS REAL)
        ) / 3600.0, 0) AS hours
        FROM ac_events e1
        JOIN ac_events e2 ON e2.id = (
          SELECT MIN(id) FROM ac_events WHERE unit_id = e1.unit_id AND id > e1.id AND event_type = 'OFF'
        )
        WHERE e1.unit_id = ? AND e1.event_type = 'ON'
          AND date(e1.event_time) = ? AND date(e2.event_time) = ?
      `).get(u.id, today, today);

      const lastOn = db().prepare(`SELECT event_time FROM ac_events WHERE unit_id = ?
                                    AND event_type = 'ON' ORDER BY event_time DESC LIMIT 1`).get(u.id);
      const lastOff = db().prepare(`SELECT event_time FROM ac_events WHERE unit_id = ?
                                     AND event_type = 'OFF' ORDER BY event_time DESC LIMIT 1`).get(u.id);

      let runningNow = lastOn && (!lastOff || lastOn.event_time > lastOff.event_time);

      let runningMinutes = 0;
      if (runningNow && lastOn) {
        const start = new Date(lastOn.event_time).getTime();
        const now = Date.now();
        runningMinutes = Math.floor((now - start) / 60000);
      }

      const temp = lastReading?.temperature ?? null;
      const warning = temp !== null && temp <= WARN_TEMP;

      function fmtTime(sqliteDt) {
        if (!sqliteDt) return null;
        const date = new Date(sqliteDt.replace(' ', 'T'));
        let h = date.getHours();
        const m = String(date.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      }

      return {
        id: u.id,
        room_name: u.room_name,
        building: u.building,
        description: u.description,
        target_temp: u.target_temp ?? 24,
        temperature: temp,
        humidity: lastReading?.humidity ?? null,
        current_a: lastReading?.current_a ?? null,
        ac_status: lastReading?.ac_status ?? 'OFF',
        last_updated: lastReading?.recorded_at ?? null,
        last_on_time: fmtTime(lastOn?.event_time),
        last_off_time: fmtTime(lastOff?.event_time),
        today_hours: Math.round((todayHours?.hours || 0) * 100) / 100,
        running_now: runningNow,
        running_minutes: runningMinutes,
        warning: warning ? { message: `Low temperature: ${temp}°C (below ${WARN_TEMP}°C)`, temp } : null
      };
    });

    res.json({ units: result });
  });

  router.get('/units/:id', (req, res) => {
    const unit = db().prepare('SELECT * FROM units WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const lastReading = db().prepare(`SELECT * FROM readings WHERE unit_id = ?
                                      ORDER BY recorded_at DESC LIMIT 1`).get(unit.id);
    const recentEvents = db().prepare(`SELECT * FROM ac_events WHERE unit_id = ?
                                       ORDER BY event_time DESC LIMIT 20`).all(unit.id);

    const temp = lastReading?.temperature ?? null;
    const warning = temp !== null && temp <= WARN_TEMP;

    res.json({
      unit: { ...unit, target_temp: unit.target_temp ?? 24 },
      last_reading: lastReading,
      recent_events: recentEvents,
      warning: warning ? { message: `Low temperature: ${temp}°C (below ${WARN_TEMP}°C)`, temp } : null
    });
  });

  router.get('/units/:id/readings', (req, res) => {
    const { from, to, limit = 500 } = req.query;
    const fromDate = from || localDateTimeStr(new Date(Date.now() - 24 * 3600000));
    const toDate = to || localDateTimeStr();

    const rows = db().prepare(`
      SELECT * FROM readings
      WHERE unit_id = ? AND recorded_at >= ? AND recorded_at <= ?
      ORDER BY recorded_at ASC LIMIT ?
    `).all(req.params.id, fromDate, toDate, Number(limit));

    res.json({ readings: rows });
  });

  router.get('/units/:id/hours', (req, res) => {
    const { from, to } = req.query;
    const fromDate = from || localDateDaysAgo(7);
    const toDate = to || localDateStr();

    const events = db().prepare(`
      SELECT e1.event_time AS on_time, MIN(e2.event_time) AS off_time
      FROM ac_events e1
      LEFT JOIN ac_events e2 ON e2.unit_id = e1.unit_id AND e2.id > e1.id AND e2.event_type = 'OFF'
      WHERE e1.unit_id = ? AND e1.event_type = 'ON'
        AND date(e1.event_time) >= ? AND date(e1.event_time) <= ?
      GROUP BY e1.id
      ORDER BY e1.event_time
    `).all(req.params.id, fromDate, toDate);

    const now = new Date();
    const daily = {};

    events.forEach(e => {
      const off = e.off_time ? new Date(e.off_time) : now;
      const duration = (off - new Date(e.on_time)) / 3600000;
      const de = new Date(e.on_time.replace(' ', 'T'));
      const day = de.getFullYear() + '-' + String(de.getMonth() + 1).padStart(2, '0') + '-' + String(de.getDate()).padStart(2, '0');
      daily[day] = (daily[day] || 0) + duration;
    });

    const records = Object.entries(daily).map(([date, hours]) => ({
      date, hours: Math.round(hours * 100) / 100
    })).sort((a, b) => a.date.localeCompare(b.date));

    const total = records.reduce((s, r) => s + r.hours, 0);

    res.json({
      unit_id: Number(req.params.id),
      period: { from: fromDate, to: toDate },
      records,
      total_hours: Math.round(total * 100) / 100
    });
  });

  router.get('/report', (req, res) => {
    const { from, to, unit_ids, format = 'json' } = req.query;
    const fromDate = from || localDateDaysAgo(30);
    const toDate = to || localDateStr();

    function fmtClock(sqliteDt) {
      const date = new Date(sqliteDt.replace(' ', 'T'));
      let h = date.getHours();
      const m = String(date.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }

    let units;
    if (unit_ids) {
      const ids = String(unit_ids).split(',').map(Number);
      const placeholders = ids.map(() => '?').join(',');
      units = db().prepare(`SELECT * FROM units WHERE id IN (${placeholders})`).all(...ids);
    } else {
      units = db().prepare('SELECT * FROM units WHERE is_active = 1').all();
    }

    const report = units.map(u => {
      const events = db().prepare(`
        SELECT e1.event_time AS on_time, MIN(e2.event_time) AS off_time
        FROM ac_events e1
        LEFT JOIN ac_events e2 ON e2.unit_id = e1.unit_id AND e2.id > e1.id AND e2.event_type = 'OFF'
        WHERE e1.unit_id = ? AND e1.event_type = 'ON'
          AND date(e1.event_time) >= ? AND date(e1.event_time) <= ?
        GROUP BY e1.id ORDER BY e1.event_time
      `).all(u.id, fromDate, toDate);

      const now = new Date();
      let totalHours = 0;
      let onCycles = 0;
      const daily = {};

      events.forEach(e => {
        const off = e.off_time ? new Date(e.off_time) : now;
        const dur = (off - new Date(e.on_time)) / 3600000;
        totalHours += dur;
        onCycles++;
        const de = new Date(e.on_time.replace(' ', 'T'));
      const day = de.getFullYear() + '-' + String(de.getMonth() + 1).padStart(2, '0') + '-' + String(de.getDate()).padStart(2, '0');
        daily[day] = (daily[day] || 0) + dur;
      });

      const avgTemp = db().prepare(`
        SELECT AVG(temperature) AS avg_t FROM readings
        WHERE unit_id = ? AND recorded_at >= ? AND recorded_at <= ?
      `).get(u.id, fromDate, toDate + 'T23:59:59');

      const warnReadings = db().prepare(`
        SELECT COUNT(*) AS cnt, MIN(temperature) AS min_t FROM readings
        WHERE unit_id = ? AND recorded_at >= ? AND recorded_at <= ? AND temperature <= ?
      `).get(u.id, fromDate, toDate + 'T23:59:59', WARN_TEMP);

      return {
        unit_id: u.id,
        room_name: u.room_name,
        building: u.building,
        total_hours: Math.round(totalHours * 100) / 100,
        on_cycles: onCycles,
        avg_temperature: avgTemp?.avg_t ? Math.round(avgTemp.avg_t * 10) / 10 : null,
        warnings: warnReadings?.cnt > 0 ? {
          count: warnReadings.cnt,
          lowest_temp: Math.round(warnReadings.min_t * 10) / 10
        } : null,
        daily_breakdown: (function () {
          const filled = [];
          const start = new Date(fromDate + 'T00:00:00');
          const end = new Date(toDate + 'T00:00:00');
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            filled.push({ date: key, hours: Math.round((daily[key] || 0) * 100) / 100 });
          }
          return filled;
        })()
      };
    });

    const grandTotal = report.reduce((s, u) => s + u.total_hours, 0);

    const result = {
      generated_at: new Date().toISOString(),
      period: { from: fromDate, to: toDate },
      summary: {
        total_units: report.length,
        total_hours: Math.round(grandTotal * 100) / 100,
        avg_hours_per_unit: report.length ? Math.round(grandTotal / report.length * 100) / 100 : 0
      },
      units: report
    };

    if (format === 'csv') {
      let csv = '';
      const sep = ',';

      // ── Header ──
      csv += `"ACTime - Air Conditioner Operating Hours Report"\n`;
      csv += `"Period","${fromDate} to ${toDate}"\n`;
      csv += `"Generated","${new Date().toLocaleString()}"\n`;
      csv += `"Rooms Monitored","${report.length}"\n`;
      csv += `"Total Operating Hours","${Math.round(grandTotal * 100) / 100}"\n`;
      csv += `"Avg Hours Per Room","${report.length ? Math.round(grandTotal / report.length * 100) / 100 : 0}"\n`;
      csv += '\n';

      // ── Air-Conditioning Unit Monitoring Checklist ──
      const allDays = [...new Set(report.flatMap(u => (u.daily_breakdown || []).map(d => d.date)))].sort();
      csv += `"AIR-CONDITIONING UNIT MONITORING CHECKLIST"\n`;
      csv += `"No.","Rooms"${allDays.map(day => sep + '"' + day + ' ON"' + sep + '"' + day + ' OFF"').join('')}\n`;
      report.forEach((u, idx) => {
        const eventsByDay = {};
        const chk = db().prepare(`
          SELECT e1.event_time AS on_time, MIN(e2.event_time) AS off_time
          FROM ac_events e1
          LEFT JOIN ac_events e2 ON e2.unit_id = e1.unit_id AND e2.id > e1.id AND e2.event_type = 'OFF'
          WHERE e1.unit_id = ? AND e1.event_type = 'ON'
            AND date(e1.event_time) >= ? AND date(e1.event_time) <= ?
          GROUP BY e1.id ORDER BY e1.event_time
        `).all(u.unit_id, fromDate, toDate);
        chk.forEach(e => {
          const d = new Date(e.on_time.replace(' ', 'T'));
          const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          if (!eventsByDay[day]) eventsByDay[day] = [];
          eventsByDay[day].push({
            on: fmtClock(e.on_time),
            off: e.off_time ? fmtClock(e.off_time) : 'Running'
          });
        });
        const cells = allDays.map(day => {
          const evts = eventsByDay[day];
          if (evts && evts.length) {
            const onStr = evts.map(e => e.on).join('\n');
            const offStr = evts.map(e => e.off).join('\n');
            return sep + '"' + onStr + '"' + sep + '"' + offStr + '"';
          }
          return sep + '"—"' + sep + '"—"';
        }).join('');
        csv += `${idx + 1},"${u.room_name}"${cells}\n`;
      });
      csv += '\n';

      // ── Room Summary ──
      csv += `"ROOM SUMMARY"\n`;
      csv += `"Room","Building","Total Hours","ON Cycles","Avg Temp (°C)","Low Temp Warnings","Lowest Temp (°C)"\n`;
      report.forEach(u => {
        const wCount = u.warnings ? u.warnings.count : 0;
        const wLow = u.warnings ? u.warnings.lowest_temp : '';
        csv += `"${u.room_name}","${u.building}",${u.total_hours},${u.on_cycles},${u.avg_temperature || ''},${wCount},${wLow}\n`;
      });
      csv += '\n';

      // ── Daily Breakdown ──
      if (allDays.length) {
        csv += `"DAILY BREAKDOWN (hours)"\n`;
        csv += `"Date"${report.map(u => sep + '"' + u.room_name + '"').join('')}${sep}"Total"\n`;
        allDays.forEach(day => {
          const vals = report.map(u => {
            const found = (u.daily_breakdown || []).find(d => d.date === day);
            return found ? found.hours : 0;
          });
          const total = vals.reduce((a, b) => a + b, 0);
          csv += `"${day}"${vals.map(v => sep + v.toFixed(1)).join('')}${sep}${total.toFixed(1)}\n`;
        });
        csv += '\n';
      }

      // ── Warnings ──
      const warned = report.filter(u => u.warnings);
      if (warned.length) {
        csv += `"LOW TEMPERATURE WARNINGS (temp ≤ 23°C)"\n`;
        csv += `"Room","Warning Count","Lowest Temp (°C)"\n`;
        warned.forEach(u => {
          csv += `"${u.room_name}",${u.warnings.count},${u.warnings.lowest_temp}\n`;
        });
        csv += '\n';
      }

      csv += `"--- END OF REPORT ---"\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="actime-report-${fromDate}-to-${toDate}.csv"`);
      return res.send(csv);
    }

    res.json(result);
  });

  /* ───── Monitoring Checklist ───── */
  router.get('/checklist', (req, res) => {
    const { from, to } = req.query;
    const fromDate = from || localDateDaysAgo(7);
    const toDate = to || localDateStr();

    const units = db().prepare('SELECT * FROM units WHERE is_active = 1').all();

    const allDates = [];
    const d = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    while (d <= end) {
      allDates.push(localDateStr(d));
      d.setDate(d.getDate() + 1);
    }

    const result = units.map(u => {
      const events = db().prepare(`
        SELECT e1.event_time AS on_time, MIN(e2.event_time) AS off_time
        FROM ac_events e1
        LEFT JOIN ac_events e2 ON e2.unit_id = e1.unit_id AND e2.id > e1.id AND e2.event_type = 'OFF'
        WHERE e1.unit_id = ? AND e1.event_type = 'ON'
          AND date(e1.event_time) >= ? AND date(e1.event_time) <= ?
        GROUP BY e1.id ORDER BY e1.event_time
      `).all(u.id, fromDate, toDate);

      const days = {};
      events.forEach(e => {
        const de = new Date(e.on_time.replace(' ', 'T'));
        const day = de.getFullYear() + '-' + String(de.getMonth() + 1).padStart(2, '0') + '-' + String(de.getDate()).padStart(2, '0');
        const onStr = formatTime(e.on_time);
        const offStr = e.off_time ? formatTime(e.off_time) : 'Running';
        if (!days[day]) days[day] = [];
        days[day].push({ on: onStr, off: offStr });
      });

      const lastOn = db().prepare(`SELECT event_time FROM ac_events WHERE unit_id = ? AND event_type = 'ON' ORDER BY event_time DESC LIMIT 1`).get(u.id);
      const lastOff = db().prepare(`SELECT event_time FROM ac_events WHERE unit_id = ? AND event_type = 'OFF' ORDER BY event_time DESC LIMIT 1`).get(u.id);
      const runningNow = lastOn && (!lastOff || lastOn.event_time > lastOff.event_time);
      const lastReading = db().prepare(`SELECT temperature, humidity, current_a FROM readings WHERE unit_id = ? ORDER BY recorded_at DESC LIMIT 1`).get(u.id);

      return {
        id: u.id,
        room_name: u.room_name,
        building: u.building,
        current_status: runningNow ? 'ON' : 'OFF',
        temperature: lastReading?.temperature ?? null,
        current_a: lastReading?.current_a ?? null,
        days
      };
    });

    function formatTime(sqliteDt) {
      const date = new Date(sqliteDt.replace(' ', 'T'));
      let h = date.getHours();
      const m = String(date.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }

    res.json({ period: { from: fromDate, to: toDate }, dates: allDates, units: result });
  });

  return router;
};
