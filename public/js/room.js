const params = new URLSearchParams(location.search);
const unitId = params.get('id');
const socket = io();

if (!unitId) { document.getElementById('detailContent').innerHTML = '<div class="error-state">No room ID specified.</div>'; }

let tempChart = null;
let hoursChart = null;

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
  const statusClass = lr?.ac_status === 'ON' ? 'on' : 'off';
  const statusText = lr?.ac_status || 'No data';

  document.getElementById('detailContent').innerHTML = `
    ${data.warning ? `<div class="warning-banner">${data.warning.message}</div>` : ''}
    <div class="detail-header">
      <div class="info">
        <h2>${u.room_name}</h2>
        <p>${u.building} · ${u.description || ''}</p>
        <p style="font-size:13px;color:#1a73e8;margin-top:4px;">Target: ${u.target_temp ?? 24}°C</p>
      </div>
      <div>
        <div style="font-size:12px;color:#888;text-align:right;">Status</div>
        <div class="big-status ${statusClass}">${statusText}</div>
        <div style="font-size:12px;color:#888;text-align:right;">${lr?.temperature ?? '—'}°C · ${lr?.humidity ?? '—'}% · ${lr?.current_a ?? '—'}A</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
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
      <div id="checklistWrap" style="overflow-x:auto;">
        <div class="loading" style="padding:20px;"><div class="spinner" style="width:24px;height:24px;"></div></div>
      </div>
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
  const f = from.toISOString().slice(0, 10);
  const t = to.toISOString().slice(0, 10);

  fetch(`/api/v1/checklist?from=${f}&to=${t}`)
    .then(r => r.json())
    .then(data => renderChecklist(data))
    .catch(() => {});
}

function renderChecklist(data) {
  const wrap = document.getElementById('checklistWrap');
  if (!wrap) return;
  if (!data.units || !data.units.length) {
    wrap.innerHTML = '<div class="empty-state">No checklist data available.</div>';
    return;
  }

  const isDark = document.body.classList.contains('dark-mode');
  const borderColor = isDark ? '#333' : '#000';
  const headBg = isDark ? '#1a1a2e' : '#fff';
  const textColor = isDark ? '#e0e0e0' : '#1a1a2e';
  const dashColor = isDark ? '#666' : '#999';

  let html = `<table style="border-collapse:collapse;font-size:13px;min-width:700px;border:1px solid ${borderColor};">
    <thead>
      <tr style="background:${headBg};">
        <th rowspan="2" style="border:1px solid ${borderColor};padding:10px 8px;text-align:center;font-weight:700;font-size:13px;color:${textColor};width:40px;">No.</th>
        <th rowspan="2" style="border:1px solid ${borderColor};padding:10px 12px;text-align:center;font-weight:700;font-size:13px;color:${textColor};width:100px;">Offices</th>`;

  data.dates.forEach(date => {
    const d = new Date(date + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    html += `<th colspan="2" style="border:1px solid ${borderColor};padding:8px 4px;text-align:center;font-weight:700;font-size:12px;color:${textColor};">${label}</th>`;
  });

  html += `</tr><tr style="background:${headBg};">`;
  data.dates.forEach(() => {
    html += `<th style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-weight:600;font-size:11px;color:${textColor};width:60px;">ON</th>
             <th style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-weight:600;font-size:11px;color:${textColor};width:60px;">OFF</th>`;
  });
  html += `</tr></thead><tbody>`;

  data.units.forEach((u, idx) => {
    const rowBg = isDark ? (idx % 2 === 0 ? '#1a1a2e' : '#151525') : (idx % 2 === 0 ? '#fff' : '#fafafa');
    html += `<tr style="background:${rowBg};">
      <td style="border:1px solid ${borderColor};padding:8px 6px;text-align:center;font-weight:600;color:${textColor};">${idx + 1}</td>
      <td style="border:1px solid ${borderColor};padding:8px 12px;text-align:left;font-weight:600;color:${textColor};">${u.room_name}</td>`;

    data.dates.forEach(date => {
      const dayEvents = u.days[date];
      if (dayEvents && dayEvents.length > 0) {
        const onTimes = dayEvents.map(e => e.on).join('<br>');
        const offTimes = dayEvents.map(e => e.off === 'Running' ? '<span style="color:#34a853;font-style:italic;">Running</span>' : e.off).join('<br>');
        html += `<td style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-size:12px;color:${textColor};line-height:1.6;">${onTimes}</td>
                 <td style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-size:12px;color:${textColor};line-height:1.6;">${offTimes}</td>`;
      } else {
        html += `<td style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-size:12px;color:${dashColor};">—</td>
                 <td style="border:1px solid ${borderColor};padding:6px 4px;text-align:center;font-size:12px;color:${dashColor};">—</td>`;
      }
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  html += `<p style="font-size:11px;color:${dashColor};margin-top:8px;text-align:right;">Period: ${data.period.from} to ${data.period.to}</p>`;

  wrap.innerHTML = html;
}

function fetchReadings() {
  const from = new Date(Date.now() - 24 * 3600000).toISOString();
  fetch(`/api/v1/units/${unitId}/readings?from=${from}`)
    .then(r => r.json())
    .then(data => {
      const readings = data.readings || [];
      if (tempChart) tempChart.destroy();
      const ctx = document.getElementById('tempChart');
      if (!ctx) return;
      const warnLine = { warn: 23 };
      tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: readings.map(r => new Date(r.recorded_at.replace(' ', 'T') + 'Z').toLocaleTimeString()),
          datasets: [{
            label: 'Temperature (°C)',
            data: readings.map(r => r.temperature),
            borderColor: '#ea4335',
            backgroundColor: 'rgba(234,67,53,.08)',
            fill: true,
            tension: .3,
            pointRadius: 2,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              title: { display: true, text: '°C' },
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
            ctx2.strokeStyle = '#ea4335';
            ctx2.lineWidth = 1.5;
            ctx2.beginPath();
            ctx2.moveTo(ch.chartArea.left, y);
            ctx2.lineTo(ch.chartArea.right, y);
            ctx2.stroke();
            ctx2.fillStyle = '#ea4335';
            ctx2.font = '11px sans-serif';
            ctx2.fillText('Warning ≤ 23°C', ch.chartArea.right - 100, y - 4);
            ctx2.restore();
          }
        }]
      });
    })
    .catch(() => {});
}

function fetchHours() {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10);
  fetch(`/api/v1/units/${unitId}/hours?from=${from}`)
    .then(r => r.json())
    .then(data => {
      const records = data.records || [];
      if (hoursChart) hoursChart.destroy();
      const ctx = document.getElementById('hoursChart');
      if (!ctx) return;
      hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: records.map(r => r.date.slice(5)),
          datasets: [{
            label: 'Hours',
            data: records.map(r => r.hours),
            backgroundColor: '#1a73e8',
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { title: { display: true, text: 'Hours' }, beginAtZero: true } }
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

fetchDetail();
setInterval(fetchDetail, 15000);
