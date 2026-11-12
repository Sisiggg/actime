const params = new URLSearchParams(location.search);
const unitId = params.get('id');
const socket = io();

if (!unitId) { document.getElementById('detailContent').innerHTML = '<div class="error-state">No room ID specified.</div>'; }

let tempChart = null;
let hoursChart = null;

function chartTheme() {
  const styles = getComputedStyle(document.body);
  const v = name => styles.getPropertyValue(name).trim();
  return {
    text: v('--text-secondary'),
    grid: v('--border-light'),
    primary: v('--primary'),
    danger: v('--danger'),
    surface: v('--surface'),
    border: v('--border')
  };
}

function fetchDetail() {
  if (!unitId) return;
  fetch(`/api/v1/units/${unitId}`)
    .then(r => r.json())
    .then(data => renderHeader(data))
    .catch(() => {});
}

function renderHeader(data) {
  const u = data.unit;
  const lr = data.last_reading;
  const statusClass = lr?.ac_status === 'ON' ? 'on' : (lr?.ac_status === 'OFF' ? 'off' : 'unknown');
  const statusText = lr?.ac_status || 'No data';

  document.getElementById('detailContent').innerHTML = `
    ${data.warning ? `<div class="warning-banner">${data.warning.message}</div>` : ''}
    <div class="detail-header">
      <div class="info">
        <h2>${u.room_name}</h2>
        <p>${u.building}${u.description ? ' · ' + u.description : ''}</p>
        <p class="detail-target">Target: ${u.target_temp ?? 24}°C</p>
      </div>
      <div class="status-panel">
        <div class="meta-label">Status</div>
        <div class="big-status ${statusClass}">${statusText}</div>
        <div class="detail-status-sub">${lr?.temperature ?? '—'}°C · ${lr?.humidity ?? '—'}% · ${lr?.current_a ?? '—'}A</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-container">
        <div class="chart-title">Temperature (Last 24h)</div>
        <canvas id="tempChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">Daily Operating Hours (Last 30 Days)</div>
        <canvas id="hoursChart"></canvas>
      </div>
    </div>

    <div class="chart-container">
      <div class="chart-title">Air-Conditioning Unit Monitoring Checklist</div>
      <div id="checklistWrap" class="table-scroll-x"></div>
    </div>

  `;

  fetchReadings();
  fetchHours();
  fetchChecklist();
}

function fetchChecklist() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  const f = toLocalDate(from);
  const t = toLocalDate(to);

  fetch(`/api/v1/checklist?from=${f}&to=${t}`)
    .then(r => r.json())
    .then(data => renderChecklist(data))
    .catch(() => {});
}

function toLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderChecklist(data) {
  const wrap = document.getElementById('checklistWrap');
  if (!wrap) return;
  if (!data.units || !data.units.length) {
    wrap.innerHTML = '<div class="empty-state">No checklist data available.</div>';
    return;
  }

  let html = `<table class="checklist-table">
    <thead>
      <tr>
        <th rowspan="2" class="col-index">No.</th>
        <th rowspan="2" class="col-room">Rooms</th>`;

  data.dates.forEach(date => {
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    html += `<th colspan="2" class="date-head">${label}</th>`;
  });

  html += `</tr><tr>`;
  data.dates.forEach(() => {
    html += `<th class="cell-head">ON</th>
             <th class="cell-head">OFF</th>`;
  });
  html += `</tr></thead><tbody>`;

  data.units.forEach((u, idx) => {
    html += `<tr>
      <td class="col-index">${idx + 1}</td>
      <td class="col-room">${u.room_name}</td>`;

    data.dates.forEach(date => {
      const dayEvents = u.days[date];
      if (dayEvents && dayEvents.length > 0) {
        const onLines = dayEvents.map(e => e.on).join('<br>');
        const offLines = dayEvents.map(e =>
          e.off === 'Running'
            ? '<span class="check-running">Running</span>'
            : e.off
        ).join('<br>');
        html += `<td class="check-cell">${onLines}</td>
                 <td class="check-cell">${offLines}</td>`;
      } else {
        html += `<td class="check-cell check-empty">—</td>
                 <td class="check-cell check-empty">—</td>`;
      }
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  html += `<p class="checklist-period">Period: ${data.period.from} to ${data.period.to}</p>`;

  wrap.innerHTML = html;
}

function fetchReadings() {
  const from = toLocalDate(new Date(Date.now() - 24 * 3600000)) + ' 00:00:00';
  fetch(`/api/v1/units/${unitId}/readings?from=${encodeURIComponent(from)}`)
    .then(r => r.json())
    .then(data => {
      const readings = data.readings || [];
      if (tempChart) tempChart.destroy();
      const ctx = document.getElementById('tempChart');
      if (!ctx) return;
      const t = chartTheme();
      const warnLine = { warn: 23 };
      tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: readings.map(r => new Date(r.recorded_at.replace(' ', 'T')).toLocaleTimeString()),
          datasets: [{
            label: 'Temperature (°C)',
            data: readings.map(r => r.temperature),
            borderColor: t.primary,
            backgroundColor: t.primary + '1f',
            fill: true,
            tension: .3,
            pointRadius: 2,
            pointBackgroundColor: t.primary,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: t.surface,
              titleColor: t.text,
              bodyColor: t.text,
              borderColor: t.border,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.text, maxTicksLimit: 8 }
            },
            y: {
              title: { display: true, text: '°C', color: t.text },
              ticks: { color: t.text },
              grid: { color: t.grid }
            }
          }
        },
        plugins: [{
          id: 'warnLine',
          afterDraw(ch) {
            const yScale = ch.scales.y;
            const y = yScale.getPixelForValue(warnLine.warn);
            const ctx2 = ch.ctx;
            ctx2.save();
            ctx2.setLineDash([5, 5]);
            ctx2.strokeStyle = t.danger;
            ctx2.lineWidth = 1.5;
            ctx2.beginPath();
            ctx2.moveTo(ch.chartArea.left, y);
            ctx2.lineTo(ch.chartArea.right, y);
            ctx2.stroke();
            ctx2.fillStyle = t.danger;
            ctx2.font = '11px sans-serif';
            ctx2.textAlign = 'right';
            ctx2.fillText('Warning ≤ 23°C', ch.chartArea.right - 6, y - 6);
            ctx2.restore();
          }
        }]
      });
    })
    .catch(() => {});
}

function fetchHours() {
  const from = toLocalDate(new Date(Date.now() - 30 * 86400000));
  fetch(`/api/v1/units/${unitId}/hours?from=${from}`)
    .then(r => r.json())
    .then(data => {
      const records = data.records || [];
      if (hoursChart) hoursChart.destroy();
      const ctx = document.getElementById('hoursChart');
      if (!ctx) return;
      const t = chartTheme();
      hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: records.map(r => r.date.slice(5)),
          datasets: [{
            label: 'Hours',
            data: records.map(r => r.hours),
            backgroundColor: t.primary,
            borderRadius: 5,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: t.surface,
              titleColor: t.text,
              bodyColor: t.text,
              borderColor: t.border,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: { label: c => c.parsed.y.toFixed(1) + ' hours' }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: t.text } },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Hours', color: t.text },
              ticks: { color: t.text },
              grid: { color: t.grid }
            }
          }
        }
      });
    })
    .catch(() => {});
}

socket.on('reading', (data) => {
  if (data.unit_id == unitId) {
    fetchDetail();
  }
});

new MutationObserver(function () {
  if (document.getElementById('tempChart')) fetchReadings();
  if (document.getElementById('hoursChart')) fetchHours();
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

fetchDetail();
setInterval(fetchDetail, 15000);
