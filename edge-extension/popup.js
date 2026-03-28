const API = 'http://localhost:3000/api/v1';

const $ = id => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────────────────────

let dashboard = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const { token, elderlyId } = await getStorage(['token', 'elderlyId']);
  if (token && elderlyId) {
    showDashboard();
    loadDashboard(token, elderlyId);
  } else {
    showLogin();
  }

  $('btn-login').addEventListener('click', handleLogin);
  $('btn-logout').addEventListener('click', handleLogout);

  $('email').addEventListener('keydown', e => e.key === 'Enter' && $('password').focus());
  $('password').addEventListener('keydown', e => e.key === 'Enter' && handleLogin());
});

// ── Login / Logout ────────────────────────────────────────────────────────────

async function handleLogin() {
  const email = $('email').value.trim();
  const password = $('password').value;
  $('login-error').style.display = 'none';

  if (!email || !password) {
    showError('Vui lòng nhập email và mật khẩu.');
    return;
  }

  $('btn-login').disabled = true;
  $('btn-login').innerHTML = '<span class="spinner"></span> Đang đăng nhập...';

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      showError(msg || 'Đăng nhập thất bại.');
      return;
    }

    const { user, accessToken } = data;
    const elderlyId = user.elderlyId;

    if (user.role !== 'ELDERLY') {
      showError('Extension chỉ dành cho người dùng ELDERLY.');
      return;
    }
    if (!elderlyId) {
      showError('Không tìm thấy hồ sơ sức khỏe. Vui lòng đăng nhập qua ứng dụng web trước.');
      return;
    }

    await setStorage({ token: accessToken, elderlyId, userName: user.name || user.fullName });
    showDashboard();
    loadDashboard(accessToken, elderlyId);

    // Notify background worker
    chrome.runtime.sendMessage({ type: 'credentials_updated' });

  } catch {
    showError('Không thể kết nối đến máy chủ. Đảm bảo backend đang chạy.');
  } finally {
    $('btn-login').disabled = false;
    $('btn-login').textContent = 'Đăng nhập';
  }
}

function handleLogout() {
  chrome.storage.local.remove(['token', 'elderlyId', 'userName']);
  chrome.action.setBadgeText({ text: '' });
  showLogin();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard(token, elderlyId) {
  try {
    const res = await fetch(`${API}/health/elderly/${elderlyId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) { handleLogout(); return; }
    if (!res.ok) throw new Error('API error');

    dashboard = await res.json();
    renderDashboard(dashboard);

  } catch {
    $('med-list').innerHTML = '<div class="empty">Không thể tải dữ liệu. Kiểm tra kết nối.</div>';
  }
}

function renderDashboard(data) {
  const meds = data?.medications?.schedule ?? [];
  const total   = data?.medications?.total   ?? 0;
  const taken   = data?.medications?.taken   ?? 0;
  const pending = data?.medications?.pending ?? 0;
  const rate    = data?.medications?.adherenceRate ?? 0;

  $('stat-total').textContent   = total;
  $('stat-taken').textContent   = taken;
  $('stat-pending').textContent = pending;
  $('progress-pct').textContent = `${rate}%`;
  $('progress-fill').style.width = `${rate}%`;
  $('progress-fill').style.background =
    rate === 100 ? '#52B788' : rate >= 60 ? '#4A8FB8' : '#F59E0B';

  const now = new Date();
  $('last-updated').textContent = 'Cập nhật: ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // User name
  getStorage(['userName']).then(({ userName }) => {
    if (userName) $('header-sub').textContent = `Xin chào, ${userName.split(' ').pop()}`;
  });

  // Med list
  const sorted = [...meds].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (sorted.length === 0) {
    $('med-list').innerHTML = '<div class="empty">🎉 Không có thuốc hôm nay</div>';
    return;
  }

  $('med-list').innerHTML = sorted.map(med => {
    const [h, m] = med.scheduledTime.split(':').map(Number);
    const schedMin = h * 60 + m;
    const overdue = med.status === 'PENDING' && schedMin < nowMin;
    const cls = med.status === 'TAKEN' ? 'taken' : overdue ? 'overdue' : 'pending';

    const timeClass = overdue ? 'med-time overdue' : 'med-time';
    const dosageStr = med.dosage ? `${med.dosage}${med.dosageUnit || ''}` : '';
    const statusLabel = med.status === 'TAKEN' ? '✓ Đã uống'
      : overdue ? '⚠️ Trễ giờ'
      : `⏰ ${med.scheduledTime}`;

    return `
      <div class="med-item ${cls}">
        <div class="${timeClass}">${med.scheduledTime}</div>
        <div style="flex:1">
          <div class="med-name">${med.drugName}${dosageStr ? ` — ${dosageStr}` : ''}</div>
          <div class="med-status">${statusLabel}</div>
        </div>
        ${med.status === 'TAKEN'
          ? '<span class="check-icon">✓</span>'
          : `<button class="btn-sm btn-success" onclick="markTaken('${med.prescriptionItemId}','${med.drugName}','${med.scheduledTime}')">Đã uống</button>`
        }
      </div>`;
  }).join('');
}

// ── Mark taken ────────────────────────────────────────────────────────────────

async function markTaken(itemId, drugName, scheduledTime) {
  const { token, elderlyId } = await getStorage(['token', 'elderlyId']);
  if (!token) return;

  const today = new Date().toISOString().split('T')[0];
  try {
    await fetch(`${API}/medications/items/${itemId}/taken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ elderlyId, drugName, scheduledDate: today, scheduledTime }),
    });
    loadDashboard(token, elderlyId);
  } catch { /* ignore */ }
}

// Make markTaken global for onclick handlers
window.markTaken = markTaken;

// ── UI helpers ────────────────────────────────────────────────────────────────

function showLogin() {
  $('login-section').style.display = 'flex';
  $('dashboard-section').style.display = 'none';
}

function showDashboard() {
  $('login-section').style.display = 'none';
  $('dashboard-section').style.display = 'block';
}

function showError(msg) {
  $('login-error').textContent = msg;
  $('login-error').style.display = 'block';
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}
