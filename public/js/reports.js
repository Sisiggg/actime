let currentReport = null;

function toLocalDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function init() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  document.getElementById('reportTo').value = toLocalDateStr(today);
  document.getElementById('reportFrom').value = toLocalDateStr(monthAgo);

  fetch('/api/v1/units')
    .then(r => r.json())
    .then(data => {
      const sel = document.getElementById('reportUnit');
      (data.units || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.room_name + ' - ' + u.building;
        sel.appendChild(opt);
      });
    })
    .catch(() => {});
}

function generateReport() {
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  const unitId = document.getElementById('reportUnit').value;

  const results = document.getElementById('reportResults');

  if (!from || !to) {
    results.style.display = 'block';
    results.innerHTML = '<div class="error-state">Select both a start and end date.</div>';
    return;
  }

  let url = `/api/v1/report?from=${from}&to=${to}`;
  if (unitId) url += `&unit_ids=${unitId}`;

  results.style.display = 'block';
  results.innerHTML = '<div class="loading"><div class="spinner"></div>Generating report...</div>';

  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      currentReport = data;
      renderReport(data);
    })
    .catch(() => {
      results.innerHTML = '<div class="error-state">Failed to generate report. Make sure the server is running, then try again.</div>';
    });
}

function renderReport(data) {
  const div = document.getElementById('reportResults');
  const units = data.units || [];

  div.innerHTML = `
    <div class="report-summary">
      <div class="r-item"><div class="r-value">${data.summary.total_units}</div><div class="r-label">Rooms</div></div>
      <div class="r-item"><div class="r-value">${data.summary.total_hours.toFixed(1)}</div><div class="r-label">Total Hours</div></div>
      <div class="r-item"><div class="r-value">${data.summary.avg_hours_per_unit.toFixed(1)}</div><div class="r-label">Avg Hours/Room</div></div>
    </div>
    ${units.some(u => u.warnings) ? `<div class="warning-banner">Low temperature warnings detected — see table below</div>` : ''}
    <p class="report-period">Period: ${data.period.from} to ${data.period.to}</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Room</th><th>Building</th><th>Total Hours</th><th>ON Cycles</th><th>Avg Temp</th><th>Warnings</th></tr></thead>
        <tbody>
          ${units.map(u => {
            const warnHtml = u.warnings
              ? `<span class="report-warn">${u.warnings.count}× (lowest ${u.warnings.lowest_temp}°C)</span>`
              : '<span class="text-faint">None</span>';
            return `<tr class="${u.warnings ? 'row-warn' : ''}">
              <td><strong>${u.room_name}</strong></td>
              <td>${u.building}</td>
              <td>${u.total_hours.toFixed(1)}</td>
              <td>${u.on_cycles}</td>
              <td>${u.avg_temperature !== null ? u.avg_temperature + '°C' : '—'}</td>
              <td>${warnHtml}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="report-block">
      <div class="table-wrap">
        <div class="table-title">Daily Breakdown (hours)</div>
        <div class="table-scroll-y">
          <table>
            <thead><tr><th>Date</th>${units.map(u => `<th>${u.room_name}</th>`).join('')}<th>Total</th></tr></thead>
            <tbody id="breakdownBody"></tbody>
          </table>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Daily Hours Chart</div>
        <canvas id="reportChart"></canvas>
      </div>
    </div>
    <div class="report-generated">
      Generated: ${new Date(data.generated_at).toLocaleString()}
    </div>
  `;

  document.getElementById('exportBtn').disabled = false;
  renderBreakdownTable(units);
  renderReportChart(units);
}

let reportChart = null;

function renderBreakdownTable(units) {
  const tbody = document.getElementById('breakdownBody');
  if (!tbody) return;
  const allDays = [...new Set(units.flatMap(u => (u.daily_breakdown||[]).map(d => d.date)))].sort().reverse();
  if (!allDays.length) {
    tbody.innerHTML = '<tr><td colspan="' + (units.length + 2) + '" style="text-align:center;color:var(--text-muted);">No daily data available.</td></tr>';
    return;
  }
  tbody.innerHTML = allDays.map(day => {
    const vals = units.map(u => {
      const found = (u.daily_breakdown||[]).find(d => d.date === day);
      return found ? found.hours : 0;
    });
    const total = vals.reduce((a,b) => a+b, 0);
    const cells = [day.slice(5), ...vals.map(v => v.toFixed(1)), total.toFixed(1)];
    return '<tr>' + cells.map((c, i) => '<td' + (i === 0 ? ' class="date-cell"' : '') + '>' + c + (i > 0 ? 'h' : '') + '</td>').join('') + '</tr>';
  }).join('');
}

function renderReportChart(units) {
  const days = new Set();
  units.forEach(u => (u.daily_breakdown || []).forEach(d => days.add(d.date)));
  const sortedDays = [...days].sort();

  const isDark = document.body.classList.contains('dark-mode');
  const palette = isDark ? [
    { fill: 'rgba(96,165,250,0.8)',  border: '#60a5fa', hover: 'rgba(96,165,250,0.95)' },
    { fill: 'rgba(74,222,128,0.8)',  border: '#4ade80', hover: 'rgba(74,222,128,0.95)' },
    { fill: 'rgba(251,191,36,0.8)',  border: '#fbbf24', hover: 'rgba(251,191,36,0.95)' },
    { fill: 'rgba(248,113,113,0.8)', border: '#f87171', hover: 'rgba(248,113,113,0.95)' },
  ] : [
    { fill: 'rgba(37,99,235,0.78)',  border: '#2563eb', hover: 'rgba(37,99,235,0.92)' },
    { fill: 'rgba(22,163,74,0.78)',  border: '#16a34a', hover: 'rgba(22,163,74,0.92)' },
    { fill: 'rgba(217,119,6,0.78)',  border: '#d97706', hover: 'rgba(217,119,6,0.92)' },
    { fill: 'rgba(220,38,38,0.78)',  border: '#dc2626', hover: 'rgba(220,38,38,0.92)' },
  ];

  const styles = getComputedStyle(document.body);
  const cssVar = name => styles.getPropertyValue(name).trim();
  const textColor = cssVar('--text-secondary');
  const gridColor = cssVar('--border-light');
  const tooltipBg = cssVar('--surface');
  const tooltipBorder = cssVar('--border');
  const avgColor = cssVar('--warning');

  const datasets = units.map((u, i) => {
    const map = {};
    (u.daily_breakdown || []).forEach(d => map[d.date] = d.hours);
    const c = palette[i % palette.length];
    return {
      label: u.room_name,
      data: sortedDays.map(d => map[d] || 0),
      backgroundColor: c.fill,
      borderColor: c.border,
      borderWidth: 2,
      hoverBackgroundColor: c.hover,
      borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: false,
    };
  });

  if (reportChart) reportChart.destroy();
  const ctx = document.getElementById('reportChart');
  if (!ctx || !sortedDays.length) return;

  const allValues = datasets.flatMap(d => d.data);
  const avg = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

  reportChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: sortedDays.map(d => d.slice(5)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            boxWidth: 14,
            boxHeight: 14,
            padding: 20,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { weight: '500' }
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4,
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + ' hours';
            },
            afterBody: function (items) {
              const total = items.reduce((s, i) => s + i.parsed.y, 0);
              return 'Total: ' + total.toFixed(1) + ' hours';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 12 } },
          categoryPercentage: 0.6,
          barPercentage: 0.7,
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Operating Hours', color: textColor, font: { size: 12, weight: '500' } },
          ticks: { color: textColor, font: { size: 12 }, callback: v => v.toFixed(1) + 'h' },
          grid: { color: gridColor, drawBorder: false },
        }
      }
    },
    plugins: [{
      id: 'avgLine',
      afterDraw(ch) {
        if (avg === 0) return;
        const yScale = ch.scales.y;
        const y = yScale.getPixelForValue(avg);
        const ctx2 = ch.ctx;
        ctx2.save();
        ctx2.setLineDash([6, 4]);
        ctx2.strokeStyle = avgColor;
        ctx2.lineWidth = 1.5;
        ctx2.beginPath();
        ctx2.moveTo(ch.chartArea.left, y);
        ctx2.lineTo(ch.chartArea.right, y);
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.fillStyle = avgColor;
        ctx2.font = '11px sans-serif';
        ctx2.textAlign = 'right';
        ctx2.fillText('Avg ' + avg.toFixed(1) + 'h', ch.chartArea.right - 6, y - 6);
        ctx2.restore();
      }
    }]
  });
}

new MutationObserver(function () {
  if (currentReport && currentReport.units && reportChart) {
    renderReportChart(currentReport.units);
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function exportCSV() {
  if (!currentReport) { generateReport(); return; }
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  const unitId = document.getElementById('reportUnit').value;

  let url = `/api/v1/report?from=${from}&to=${to}&format=csv`;
  if (unitId) url += `&unit_ids=${unitId}`;
  window.open(url, '_blank');
}

init();
