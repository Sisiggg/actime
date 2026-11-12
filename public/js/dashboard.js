const socket = io();

function fetchUnits() {
  fetch('/api/v1/units')
    .then(r => r.json())
    .then(data => renderDashboard(data.units))
    .catch(() => {
      const grid = document.getElementById('roomGrid');
      if (grid && !grid.dataset.loaded) {
        grid.innerHTML = '<div class="error-state">Could not load room data. Make sure the server is running, then reload.</div>';
      }
    });
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

  grid.dataset.loaded = '1';

  if (!units.length) {
    grid.innerHTML = '<div class="empty-state">No rooms reporting yet. Data will appear once a device sends a reading.</div>';
    return;
  }

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

    return `<a class="room-card ${cardClass}" href="/room.html?id=${u.id}">
      <span class="running-indicator ${runningClass}" aria-hidden="true"></span>
      <div class="room-head">
        <span class="room-name">${u.room_name}</span>
        <span class="status-badge ${statusClass}">${u.ac_status || 'OFFLINE'}</span>
      </div>
      <div class="building">${u.building}</div>
      <div class="stats">
        <div class="stat-item">
          <div class="s-label">Temp / Target</div>
          <div class="s-value">${u.temperature !== null ? u.temperature + '°' : '—'}<span class="s-sub"> / ${u.target_temp}°</span></div>
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
      <div class="running-text">${runningText}</div>
    </a>`;
  }).join('');
}

socket.on('reading', () => fetchUnits());
fetchUnits();
setInterval(fetchUnits, 15000);
