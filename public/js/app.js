/**
 * Ninja_hattori - IoT Web Application Frontend Script
 * Designed and Developed by Akash-Parth-Suraj, Dept. of Electrical Engineering, GCOEY.
 */

// Application State
let currentUser = null;
let authToken = localStorage.getItem('ninja_token') || null;
let currentTab = 'env';
let currentPage = 1;
let totalPages = 1;
let sensorChartInstance = null;
let countdownSeconds = 10;
let countdownTimerInterval = null;
let ledCurrentState = 0;

const TIMEZONE = 'Asia/Kolkata'; // +05:30
const API_BASE = ''; // Same origin

// -------------------------------------------------------------
// 1. INITIALIZATION & CLOCK
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Setup Clock
  startIstClock();

  // Check saved authentication
  checkUserAuth();

  // Initialize Chart
  initSensorChart();

  // Load Initial Data
  fetchSensorData();
  fetchLcdState();
  fetchLedState();

  // Start 10-second polling cycle
  startSyncCountdown();

  // Auto-fill preset characters count
  updateLcdPreview();
});

// Live clock formatted in Asia/Kolkata
function startIstClock() {
  const clockEl = document.getElementById('ist-clock');
  const updateClock = () => {
    const now = new Date();
    const optionsTime = {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    const optionsDate = {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    const timeStr = now.toLocaleTimeString('en-IN', optionsTime);
    const dateStr = now.toLocaleDateString('en-IN', optionsDate);
    if (clockEl) {
      clockEl.textContent = `${timeStr} (IST) | ${dateStr}`;
    }
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// -------------------------------------------------------------
// 2. TAB NAVIGATION
// -------------------------------------------------------------
function switchTab(tabName) {
  currentTab = tabName;

  const tabs = ['env', 'lcd', 'led'];
  tabs.forEach(t => {
    const content = document.getElementById(`content-tab-${t}`);
    const navBtn = document.getElementById(`nav-tab-${t}`);
    
    if (t === tabName) {
      content.classList.remove('hidden');
      navBtn.className = 'tab-btn flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10';
    } else {
      content.classList.add('hidden');
      navBtn.className = 'tab-btn flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent';
    }
  });

  if (tabName === 'lcd') {
    fetchLcdState();
  } else if (tabName === 'led') {
    fetchLedState();
  } else if (tabName === 'env') {
    fetchSensorData(false);
  }

  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// 3. AUTHENTICATION (LOGIN / REGISTER / SESSION)
// -------------------------------------------------------------
let authMode = 'login'; // 'login' or 'register'

function checkUserAuth() {
  const authContainer = document.getElementById('auth-actions');
  const storedUser = localStorage.getItem('ninja_user');

  if (authToken && storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      renderUserProfile(currentUser);
      return;
    } catch (e) {
      // Invalid JSON
    }
  }

  // Render Guest / Login button
  authContainer.innerHTML = `
    <button onclick="openAuthModal('login')" class="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition">
      <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
      <span>Sign In</span>
    </button>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderUserProfile(user) {
  const authContainer = document.getElementById('auth-actions');
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  authContainer.innerHTML = `
    <div class="flex items-center space-x-2 bg-darkgreen-900/80 pl-2 pr-1.5 py-1 rounded-xl border border-emerald-500/30">
      <div class="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-darkgreen-950 font-black text-xs flex items-center justify-center">
        ${initial}
      </div>
      <div class="hidden sm:block text-left text-xs leading-tight">
        <div class="font-bold text-emerald-200 truncate max-w-[100px]">${escapeHtml(user.name || 'User')}</div>
        <div class="text-[10px] text-emerald-400/80">Online</div>
      </div>
      <button onclick="logoutUser()" title="Logout" class="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-emerald-950 transition">
        <i data-lucide="log-out" class="w-4 h-4"></i>
      </button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  document.getElementById('auth-modal').classList.remove('hidden');
  hideAuthError();
  if (window.lucide) lucide.createIcons();
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function setAuthMode(mode) {
  authMode = mode;
  const nameContainer = document.getElementById('auth-name-container');
  const modalTitle = document.getElementById('auth-modal-title');
  const modalSubtitle = document.getElementById('auth-modal-subtitle');
  const submitText = document.getElementById('auth-submit-text');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');

  hideAuthError();

  if (mode === 'register') {
    nameContainer.classList.remove('hidden');
    modalTitle.textContent = 'Create an Account';
    modalSubtitle.textContent = 'Join Ninja_hattori IoT Platform';
    submitText.textContent = 'Create Account';
    tabRegister.className = 'flex-1 py-2 rounded-md transition text-center bg-emerald-600 text-white';
    tabLogin.className = 'flex-1 py-2 rounded-md transition text-center text-slate-400 hover:text-white';
  } else {
    nameContainer.classList.add('hidden');
    modalTitle.textContent = 'Sign In to Ninja_hattori';
    modalSubtitle.textContent = 'Access IoT control dashboard and telemetry history';
    submitText.textContent = 'Sign In';
    tabLogin.className = 'flex-1 py-2 rounded-md transition text-center bg-emerald-600 text-white';
    tabRegister.className = 'flex-1 py-2 rounded-md transition text-center text-slate-400 hover:text-white';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const submitBtn = document.getElementById('auth-submit-btn');

  const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const bodyData = authMode === 'register' ? { name, email, password } : { email, password };

  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-70', 'cursor-not-allowed');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.error || 'Authentication failed.');
      return;
    }

    // Success
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('ninja_token', authToken);
    localStorage.setItem('ninja_user', JSON.stringify(currentUser));

    renderUserProfile(currentUser);
    closeAuthModal();
    // Refresh records table
    fetchSensorRecords(currentPage);
  } catch (err) {
    showAuthError('Network error. Could not connect to server.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
  }
}

function logoutUser() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('ninja_token');
  localStorage.removeItem('ninja_user');
  checkUserAuth();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error-alert');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAuthError() {
  const el = document.getElementById('auth-error-alert');
  el.classList.add('hidden');
}

// -------------------------------------------------------------
// 4. TAB 1: SENSOR DATA, INNOVATIVE GAUGES & CHARTS
// -------------------------------------------------------------
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 65; // ~408.4

function updateTemperatureGauge(temp) {
  const displayVal = document.getElementById('temp-display-val');
  const displayF = document.getElementById('temp-display-f');
  const circle = document.getElementById('temp-gauge-circle');
  const seekBar = document.getElementById('temp-seek-bar');
  const badge = document.getElementById('temp-status-badge');

  if (!temp && temp !== 0) {
    displayVal.textContent = '--';
    displayF.textContent = '-- °F';
    return;
  }

  const tempVal = parseFloat(temp);
  displayVal.textContent = tempVal.toFixed(1);
  displayF.textContent = `${((tempVal * 9/5) + 32).toFixed(1)} °F`;

  // Scale: 0 to 50 Celsius
  const percent = Math.min(Math.max(tempVal / 50, 0), 1);
  const offset = GAUGE_CIRCUMFERENCE * (1 - percent);
  circle.style.strokeDashoffset = offset;

  // Update Seek Bar width
  seekBar.style.width = `${percent * 100}%`;

  // Color & Badge based on temperature
  if (tempVal < 20) {
    badge.textContent = 'Cool';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    circle.setAttribute('stroke', '#06b6d4');
  } else if (tempVal <= 30) {
    badge.textContent = 'Optimal';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    circle.setAttribute('stroke', '#10b981');
  } else if (tempVal <= 38) {
    badge.textContent = 'Warm';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
    circle.setAttribute('stroke', '#f59e0b');
  } else {
    badge.textContent = 'High Heat';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30';
    circle.setAttribute('stroke', '#f43f5e');
  }
}

function updateHumidityGauge(hum) {
  const displayVal = document.getElementById('hum-display-val');
  const comfortEl = document.getElementById('hum-comfort-status');
  const circle = document.getElementById('hum-gauge-circle');
  const seekBar = document.getElementById('hum-seek-bar');
  const badge = document.getElementById('hum-status-badge');

  if (!hum && hum !== 0) {
    displayVal.textContent = '--';
    return;
  }

  const humVal = parseFloat(hum);
  displayVal.textContent = humVal.toFixed(1);

  // Scale: 0 to 100%
  const percent = Math.min(Math.max(humVal / 100, 0), 1);
  const offset = GAUGE_CIRCUMFERENCE * (1 - percent);
  circle.style.strokeDashoffset = offset;

  // Update Seek Bar
  seekBar.style.width = `${percent * 100}%`;

  // Comfort indicator
  if (humVal < 30) {
    comfortEl.textContent = 'Comfort: Dry Air';
    badge.textContent = 'Dry';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
    circle.setAttribute('stroke', '#f59e0b');
  } else if (humVal <= 65) {
    comfortEl.textContent = 'Comfort: Healthy (Ideal)';
    badge.textContent = 'Ideal';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30';
    circle.setAttribute('stroke', '#2dd4bf');
  } else {
    comfortEl.textContent = 'Comfort: High Humidity';
    badge.textContent = 'Humid';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    circle.setAttribute('stroke', '#06b6d4');
  }
}

// Polling and fetching Sensor data
async function fetchSensorData(manual = false) {
  try {
    // 1. Fetch latest sensor reading
    const res = await fetch('/api/sensor/latest');
    if (res.ok) {
      const data = await res.json();
      if (data && data.temperature !== undefined) {
        updateTemperatureGauge(data.temperature);
        updateHumidityGauge(data.humidity);

        const updatedTime = formatIstTime(data.timestamp);
        document.getElementById('temp-last-updated').textContent = `Updated: ${updatedTime}`;
        document.getElementById('hum-last-updated').textContent = `Updated: ${updatedTime}`;
      }
    }

    // 2. Fetch history for graph
    fetchSensorChartHistory();

    // 3. Fetch paginated table records
    fetchSensorRecords(currentPage);

    if (manual) {
      resetCountdown();
    }
  } catch (err) {
    console.error('Error fetching sensor data:', err);
  }
}

// 10-Second Countdown timer
function startSyncCountdown() {
  countdownSeconds = 10;
  if (countdownTimerInterval) clearInterval(countdownTimerInterval);

  countdownTimerInterval = setInterval(() => {
    countdownSeconds--;
    const timerEl = document.getElementById('countdown-timer');
    if (timerEl) {
      timerEl.textContent = `${countdownSeconds}s`;
    }

    if (countdownSeconds <= 0) {
      countdownSeconds = 10;
      fetchSensorData();
      fetchLcdState();
      fetchLedState();
    }
  }, 1000);
}

function resetCountdown() {
  countdownSeconds = 10;
  const timerEl = document.getElementById('countdown-timer');
  if (timerEl) timerEl.textContent = '10s';
}

// -------------------------------------------------------------
// 5. CHART.JS GRAPH VISUALIZATION
// -------------------------------------------------------------
function initSensorChart() {
  const ctx = document.getElementById('sensorChart').getContext('2d');

  // Aurora gradients
  const tempGradient = ctx.createLinearGradient(0, 0, 0, 300);
  tempGradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
  tempGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  const humGradient = ctx.createLinearGradient(0, 0, 0, 300);
  humGradient.addColorStop(0, 'rgba(45, 212, 191, 0.35)');
  humGradient.addColorStop(1, 'rgba(45, 212, 191, 0.0)');

  sensorChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: tempGradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#34d399',
          pointBorderColor: '#064e3b',
          pointHoverRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#2dd4bf',
          backgroundColor: humGradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#5eead4',
          pointBorderColor: '#134e4a',
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(3, 19, 13, 0.9)',
          titleColor: '#6ee7b7',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(52, 211, 153, 0.3)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(52, 211, 153, 0.08)'
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(52, 211, 153, 0.08)'
          },
          ticks: {
            color: '#34d399',
            font: { size: 11 },
            callback: (val) => `${val}°C`
          },
          suggestedMin: 15,
          suggestedMax: 45
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#2dd4bf',
            font: { size: 11 },
            callback: (val) => `${val}%`
          },
          suggestedMin: 20,
          suggestedMax: 100
        }
      }
    }
  });
}

async function fetchSensorChartHistory() {
  try {
    const res = await fetch('/api/sensor/history?limit=25');
    if (!res.ok) return;
    const history = await res.json();

    const labels = history.map(item => formatIstTimeOnly(item.timestamp));
    const temps = history.map(item => item.temperature);
    const hums = history.map(item => item.humidity);

    if (sensorChartInstance) {
      sensorChartInstance.data.labels = labels;
      sensorChartInstance.data.datasets[0].data = temps;
      sensorChartInstance.data.datasets[1].data = hums;
      sensorChartInstance.update('none'); // Update without full redraw animation
    }
  } catch (err) {
    console.error('Error updating chart history:', err);
  }
}

// -------------------------------------------------------------
// 6. SECTION 2: SAVED RECORDS TABLE (20 items/page, pagination, delete)
// -------------------------------------------------------------
async function fetchSensorRecords(page = 1) {
  currentPage = page;
  try {
    const res = await fetch(`/api/sensor/records?page=${page}&limit=20`);
    if (!res.ok) return;
    const data = await res.json();

    totalPages = data.pagination.totalPages;
    document.getElementById('total-records-count').textContent = data.pagination.total;
    document.getElementById('current-page-num').textContent = data.pagination.page;
    document.getElementById('total-pages-num').textContent = totalPages;

    renderRecordsTable(data.records);
    renderPaginationButtons(data.pagination.page, totalPages);
  } catch (err) {
    console.error('Error fetching records table:', err);
  }
}

function renderRecordsTable(records) {
  const tbody = document.getElementById('sensor-records-tbody');
  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-400">
          No sensor records found in database. Send telemetry from ESP8266 or click "Simulate Sensor".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const istTime = formatIstTimeOnly(r.timestamp);
    const istDate = formatIstDateOnly(r.timestamp);

    return `
      <tr class="hover:bg-emerald-950/40 transition">
        <td class="px-4 py-3 font-mono text-xs text-slate-400">#${r.id}</td>
        <td class="px-4 py-3 font-semibold text-emerald-300">
          ${r.temperature.toFixed(1)} &deg;C
        </td>
        <td class="px-4 py-3 font-semibold text-teal-300">
          ${r.humidity.toFixed(1)} %
        </td>
        <td class="px-4 py-3 text-xs text-slate-300 font-mono">
          ${istTime}
        </td>
        <td class="px-4 py-3 text-xs text-slate-300">
          ${istDate}
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="deleteRecord(${r.id})" title="Delete Record #${r.id}" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderPaginationButtons(current, total) {
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  const pagesContainer = document.getElementById('pagination-pages');

  prevBtn.disabled = current <= 1;
  nextBtn.disabled = current >= total;

  let html = '';
  // Generate smart pagination page numbers
  const maxButtons = 5;
  let startPage = Math.max(1, current - 2);
  let endPage = Math.min(total, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    if (p === current) {
      html += `<span class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/30">${p}</span>`;
    } else {
      html += `<button onclick="goToPage(${p})" class="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-slate-300 hover:text-emerald-200 text-xs border border-emerald-500/20">${p}</button>`;
    }
  }

  pagesContainer.innerHTML = html;
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    fetchSensorRecords(page);
  }
}

async function deleteRecord(id) {
  if (!authToken) {
    alert('Please sign in to delete records.');
    openAuthModal('login');
    return;
  }

  if (!confirm(`Are you sure you want to delete sensor record #${id}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/sensor/records/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await res.json();
    if (res.ok) {
      // Re-fetch current page
      fetchSensorRecords(currentPage);
      fetchSensorChartHistory();
    } else {
      alert(data.error || 'Failed to delete record.');
    }
  } catch (err) {
    alert('Network error while deleting record.');
  }
}

// -------------------------------------------------------------
// 7. TAB 2: SMART LCD (16x2 I2C)
// -------------------------------------------------------------
async function fetchLcdState() {
  try {
    const res = await fetch('/api/lcd');
    if (!res.ok) return;
    const data = await res.json();

    const row1 = data.row1 || '';
    const row2 = data.row2 || '';

    // If input fields are not focused, update them
    const r1Input = document.getElementById('lcd-row1-input');
    const r2Input = document.getElementById('lcd-row2-input');
    if (document.activeElement !== r1Input && document.activeElement !== r2Input) {
      r1Input.value = row1;
      r2Input.value = row2;
      updateLcdPreview();
    }

    if (data.updated_at) {
      document.getElementById('lcd-preview-sync-time').textContent = `SYNCED ${formatIstTimeOnly(data.updated_at)}`;
    }
  } catch (err) {
    console.error('Error fetching LCD state:', err);
  }
}

function updateLcdPreview() {
  const r1 = document.getElementById('lcd-row1-input').value;
  const r2 = document.getElementById('lcd-row2-input').value;

  document.getElementById('lcd-row1-count').textContent = `${r1.length} / 16 chars`;
  document.getElementById('lcd-row2-count').textContent = `${r2.length} / 16 chars`;

  // Pad to 16 chars for realistic LCD look
  const pad1 = (r1 + ' '.repeat(16)).substring(0, 16);
  const pad2 = (r2 + ' '.repeat(16)).substring(0, 16);

  document.getElementById('lcd-preview-row1').textContent = pad1;
  document.getElementById('lcd-preview-row2').textContent = pad2;
}

function setLcdPreset(row1, row2) {
  document.getElementById('lcd-row1-input').value = row1;
  document.getElementById('lcd-row2-input').value = row2;
  updateLcdPreview();
}

async function handleLcdUpdate(e) {
  e.preventDefault();
  if (!authToken) {
    alert('Please sign in to update the LCD display.');
    openAuthModal('login');
    return;
  }

  const row1 = document.getElementById('lcd-row1-input').value;
  const row2 = document.getElementById('lcd-row2-input').value;
  const alertEl = document.getElementById('lcd-update-alert');
  const btn = document.getElementById('btn-update-lcd');

  btn.disabled = true;
  btn.classList.add('opacity-75');

  try {
    const res = await fetch('/api/lcd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ row1, row2 })
    });

    const data = await res.json();
    if (res.ok) {
      alertEl.textContent = 'LCD Screen updated! ESP8266 will display this on next sync.';
      alertEl.className = 'p-3 rounded-lg text-xs font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 block';
      setTimeout(() => alertEl.classList.add('hidden'), 4000);
      fetchLcdState();
    } else {
      alertEl.textContent = data.error || 'Failed to update LCD.';
      alertEl.className = 'p-3 rounded-lg text-xs font-medium bg-rose-950/80 border border-rose-500/40 text-rose-200 block';
    }
  } catch (err) {
    alertEl.textContent = 'Network error communicating with server.';
    alertEl.className = 'p-3 rounded-lg text-xs font-medium bg-rose-950/80 border border-rose-500/40 text-rose-200 block';
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-75');
  }
}

// -------------------------------------------------------------
// 8. TAB 3: LED AUTOMATION (PIN D6)
// -------------------------------------------------------------
async function fetchLedState() {
  try {
    const res = await fetch('/api/led');
    if (!res.ok) return;
    const data = await res.json();
    ledCurrentState = data.state;
    updateLedUi(ledCurrentState, data.updated_at);
  } catch (err) {
    console.error('Error fetching LED state:', err);
  }
}

function updateLedUi(state, updatedAt) {
  const bulbGlow = document.getElementById('led-bulb-glow');
  const bulbContainer = document.getElementById('led-bulb-icon-container');
  const bulbIcon = document.getElementById('led-bulb-icon');
  const statusBadge = document.getElementById('led-status-badge');
  const statusText = document.getElementById('led-status-text');
  const voltageText = document.getElementById('led-voltage-text');
  const btnLabel = document.getElementById('led-btn-label');
  const toggleBtn = document.getElementById('led-toggle-btn');
  const updatedEl = document.getElementById('led-updated-at');

  if (updatedAt) {
    updatedEl.textContent = formatIstTime(updatedAt);
  }

  if (state === 1) {
    // LED ON
    bulbGlow.className = 'absolute w-36 h-36 rounded-full blur-2xl transition-all duration-500 bg-emerald-500/60 animate-aurora-pulse';
    bulbContainer.className = 'relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-darkgreen-900 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/50';
    bulbIcon.classList.add('text-emerald-300');
    bulbIcon.classList.remove('text-slate-500');

    statusBadge.className = 'inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    statusText.textContent = 'LED IS CURRENTLY ON';
    voltageText.textContent = '3.3V (HIGH)';

    btnLabel.textContent = 'TURN LED OFF';
    toggleBtn.className = 'group relative px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-xl border flex items-center space-x-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border-rose-400/40 shadow-rose-600/20';
  } else {
    // LED OFF
    bulbGlow.className = 'absolute w-36 h-36 rounded-full blur-2xl transition-all duration-500 bg-slate-700/20';
    bulbContainer.className = 'relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-slate-900 border-slate-700 text-slate-500';
    bulbIcon.classList.add('text-slate-500');
    bulbIcon.classList.remove('text-emerald-300');

    statusBadge.className = 'inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-bold bg-slate-800 text-slate-400 border border-slate-700';
    statusText.textContent = 'LED IS CURRENTLY OFF';
    voltageText.textContent = '0.0V (LOW)';

    btnLabel.textContent = 'TURN LED ON';
    toggleBtn.className = 'group relative px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-xl border flex items-center space-x-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40 shadow-emerald-600/30';
  }

  if (window.lucide) lucide.createIcons();
}

async function toggleLed() {
  if (!authToken) {
    alert('Please sign in to toggle the hardware LED.');
    openAuthModal('login');
    return;
  }

  const newState = ledCurrentState === 1 ? 0 : 1;
  const btn = document.getElementById('led-toggle-btn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/led', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ state: newState })
    });

    const data = await res.json();
    if (res.ok) {
      ledCurrentState = data.state;
      updateLedUi(ledCurrentState, new Date().toISOString());
    } else {
      alert(data.error || 'Failed to toggle LED.');
    }
  } catch (err) {
    alert('Network error communicating with server.');
  } finally {
    btn.disabled = false;
  }
}

// -------------------------------------------------------------
// 9. SENSOR SIMULATOR MODAL (For testing without hardware)
// -------------------------------------------------------------
function openSimulationModal() {
  document.getElementById('sim-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSimulationModal() {
  document.getElementById('sim-modal').classList.add('hidden');
}

async function handleSimulateSensor(e) {
  e.preventDefault();
  const temp = document.getElementById('sim-temp').value;
  const hum = document.getElementById('sim-hum').value;

  try {
    const res = await fetch('/api/sensor/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: temp, humidity: hum })
    });

    if (res.ok) {
      closeSimulationModal();
      fetchSensorData(true);
    } else {
      alert('Failed to simulate sensor data.');
    }
  } catch (err) {
    alert('Network error while posting simulated data.');
  }
}

// -------------------------------------------------------------
// 10. DATE & TIME HELPERS (ASIA/KOLKATA +05:30)
// -------------------------------------------------------------
function formatIstTime(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
  return d.toLocaleString('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatIstTimeOnly(isoStr) {
  if (!isoStr) return '--:--:--';
  const d = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
  return d.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatIstDateOnly(isoStr) {
  if (!isoStr) return '--/--/----';
  const d = new Date(isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z');
  return d.toLocaleDateString('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
