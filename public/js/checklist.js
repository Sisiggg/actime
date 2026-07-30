function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fetchChecklist() {
  fetch('/api/v1/checklist')
    .then(r => r.json())
    .then(data => renderChecklist(data))
    .catch(() => {
      document.getElementById('checklistContent').innerHTML = '<div class="error-state">Failed to load checklist.</div>';
    });
}

function renderChecklist(data) {
  const { dates, units } = data;
  const div = document.getElementById('checklistContent');

  if (!dates.length || !units.length) {
    div.innerHTML = '<div class="empty-state">No data available for the monitoring checklist yet.</div>';
    return;
  }

  const now = new Date().toLocaleTimeString();

  let html = `
    <div class="checklist-title">Air-Conditioning Unit Monitoring Checklist</div>
    <div class="checklist-period">Period: ${data.period.from} to ${data.period.to} &middot; Last updated: ${now}</div>
    <div class="checklist-wrap">
      <table class="checklist-table">
        <thead>
          <tr>
            <th rowspan="2" style="width:40px;">No.</th>
            <th rowspan="2" style="text-align:left;padding-left:12px;min-width:100px;">Offices</th>
            ${dates.map(d => `<th colspan="2" class="date-header" style="min-width:100px;">${fmtDate(d)}</th>`).join('')}
          </tr>
          <tr>
            ${dates.map(() => '<th class="col-header" style="width:50px;">ON</th><th class="col-header" style="width:50px;">OFF</th>').join('')}
          </tr>
        </thead>
        <tbody>
          ${units.map((u, idx) => {
            return `<tr>
              <td class="num">${idx + 1}</td>
              <td class="office">${u.room_name} &nbsp; <span class="status-badge ${u.current_status === 'ON' ? 'on' : 'off'}">${u.current_status}</span> <span style="font-size:11px;color:var(--text-muted);">${u.temperature !== null ? u.temperature + '°C' : '—'} / ${u.current_a !== null ? u.current_a + 'A' : '—'}</span></td>
              ${dates.map(d => {
                const dayEvents = u.days[d];
                if (dayEvents && dayEvents.length > 0) {
                  const onTimes = dayEvents.map(e => `<div>${e.on}</div>`).join('');
                  const offTimes = dayEvents.map(e => {
                    const cls = e.off === 'Running' ? 'running' : '';
                    return `<div class="${cls}">${e.off}</div>`;
                  }).join('');
                  return `<td class="time-val">${onTimes}</td><td class="time-val">${offTimes}</td>`;
                }
                return '<td class="dash">–</td><td class="dash">–</td>';
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  div.innerHTML = html;
}

fetchChecklist();
setInterval(fetchChecklist, 15000);
