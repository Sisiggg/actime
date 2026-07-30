const socket = io();

function fetchUnits() {
  fetch('/api/v1/units')
    .then(r => r.json())
    .then(data => renderDashboard(data.units))
    .catch(() => {});
}

function renderDashboard(units) {
  const grid = document.getElementById('roomGrid');
  const totalOn = units.filter(u => u.ac_status === 'ON').length;
  const totalHours = units.reduce((s, u) => s + u.today_hours, 0);
  const temps = units.filter(u => u.temperature !== null).map(u => u.temperature);
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length) : 0;

  document.getElementById('totalRooms').textContent = units.length;
  document.getElementById('totalOn').textContent = totalOn;
  document.getElementById('totalHours').textContent = totalHours.toFixed(1);
  document.getElementById('avgTemp').textContent = avgTemp ? avgTemp.toFixed(1) + '°C' : '—';

  document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();

  grid.innerHTML = units.map(u => {
    const statusClass = u.ac_status === 'ON' ? 'on' : (u.last_updated ? 'off' : 'offline');
    const runningClass = u.running_now ? 'on' : (u.last_updated ? 'off' : 'offline');
    const cardClass = u.ac_status === 'ON' ? 'status-on' : (u.last_updated ? 'status-off' : 'status-offline');

    let runningText = '';
    if (u.running_now) {
      const h = Math.floor(u.running_minutes / 60);
      const m = u.running_minutes % 60;
      runningText = `${h}h ${m}m running`;
    } else if (u.last_updated) {
      runningText = 'Stopped';
    } else {
      runningText = 'Offline';
    }

    return `<div class="room-card ${cardClass}" onclick="location.href='/room.html?id=${u.id}'">
      <div class="running-indicator ${runningClass}"></div>
      <div class="room-name">${u.room_name} <span class="status-badge ${statusClass}" style="vertical-align:middle;margin-left:6px;">${u.ac_status || 'OFFLINE'}</span></div>
      <div class="building">${u.building} &middot; ${u.temperature !== null ? u.temperature + '°C' : '—'} / ${u.current_a !== null ? u.current_a + 'A' : '—'} &middot; ${u.humidity !== null ? u.humidity + '%' : '—'}</div>
      <div class="stats">
        <div class="stat-item">
          <div class="s-label">Temp / Target</div>
          <div class="s-value">${u.temperature !== null ? u.temperature + '°' : '—'}<span style="font-size:12px;color:#999;font-weight:400;"> / ${u.target_temp}°</span></div>
        </div>
        <div class="stat-item">
          <div class="s-label">Humidity</div>
          <div class="s-value">${u.humidity !== null ? u.humidity + '%' : '—'}</div>
        </div>
        <div class="stat-item">
          <div class="s-label">Current</div>
          <div class="s-value">${u.current_a !== null ? u.current_a + 'A' : '—'}</div>
        </div>
        <div class="stat-item">
          <div class="s-label">Today</div>
          <div class="s-value">${u.today_hours}h</div>
        </div>
      </div>
      ${u.warning ? `<div class="warning-badge">${u.warning.message}</div>` : ''}
      <div style="font-size:11px;color:#999;margin-top:8px;">${runningText}</div>
    </div>`;
  }).join('');
}

socket.on('reading', () => fetchUnits());
fetchUnits();
setInterval(fetchUnits, 15000);
