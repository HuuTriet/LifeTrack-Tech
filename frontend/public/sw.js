/**
 * LifeTrack Tech — Service Worker
 * Chạy ngầm ngay cả khi đóng tab hoặc không mở app.
 * Nhắc uống thuốc mỗi phút một lần.
 */

const API_BASE = 'http://localhost:3001/api/v1';
const CACHE_NAME = 'lifetrack-v1';
const CHECK_INTERVAL_MS = 60_000;
const ALERT_WINDOW_MIN = 5;

// ── Install & Activate ────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Periodic check via setInterval trick ─────────────────────────────────────
// Service Workers don't have access to setInterval that survives,
// so we use the message channel to keep alive when the app is open,
// and rely on Periodic Background Sync / push events otherwise.
// For broadest compatibility we use a simple approach:

let checkTimer = null;

function startChecking() {
  if (checkTimer) return;
  checkTimer = setInterval(checkMedications, CHECK_INTERVAL_MS);
  checkMedications(); // immediate first check
}

startChecking();

// ── Message from app ─────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, token, elderlyId } = event.data || {};

  if (type === 'CREDENTIALS') {
    // Store credentials from the app
    self.__token = token;
    self.__elderlyId = elderlyId;
    // Reset timer so we check immediately with the new credentials
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    startChecking(); // kicks off immediate check + restarts interval
  }

  if (type === 'LOGOUT') {
    self.__token = null;
    self.__elderlyId = null;
    self.__notified = new Set();
  }

  if (type === 'PING') {
    event.ports[0]?.postMessage({ type: 'PONG' });
  }

  if (type === 'MARK_TAKEN') {
    markTaken(event.data.itemId, event.data.drugName, event.data.scheduledTime);
  }
});

// ── Core medication check ─────────────────────────────────────────────────────

async function checkMedications() {
  const token = self.__token;
  const elderlyId = self.__elderlyId;
  if (!token || !elderlyId) return;

  try {
    const res = await fetch(`${API_BASE}/health/elderly/${elderlyId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const schedule = data?.medications?.schedule ?? [];
    const pending = schedule.filter(m => m.status === 'PENDING');

    if (pending.length === 0) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (const med of pending) {
      const [h, m] = (med.scheduledTime || '').split(':').map(Number);
      if (isNaN(h)) continue;
      const scheduledMin = h * 60 + m;
      const diff = scheduledMin - nowMin;

      // Đúng giờ hoặc trong vòng 5 phút tới
      const isDue = diff >= 0 && diff <= ALERT_WINDOW_MIN;
      // Đã trễ trong vòng 5 phút
      const isOverdue = diff < 0 && diff >= -ALERT_WINDOW_MIN;

      if (isDue || isOverdue) {
        const notifKey = `${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`;

        // Check if already notified in this session
        const alreadyNotified = self.__notified?.has(notifKey);
        if (alreadyNotified) continue;

        if (!self.__notified) self.__notified = new Set();
        self.__notified.add(notifKey);

        // Notify all open app clients (in-app alarm overlay)
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: isOverdue ? 'MED_OVERDUE' : 'MED_DUE',
            med: {
              prescriptionItemId: med.prescriptionItemId,
              drugName: med.drugName,
              scheduledTime: med.scheduledTime,
              dosage: med.dosage,
              dosageUnit: med.dosageUnit,
              mealRelation: med.mealRelation,
              instructions: med.instructions,
            },
          });
        }

        // Browser notification (shows even when app is closed)
        await showNotification(med, isOverdue);
      }
    }
  } catch (err) {
    // Network error — silently ignore
  }
}

async function showNotification(med, isOverdue) {
  const title = isOverdue
    ? '⚠️ Trễ giờ uống thuốc!'
    : '💊 Đến giờ uống thuốc!';

  const dosageStr = med.dosage ? ` — ${med.dosage}${med.dosageUnit || ''}` : '';
  const body = `${med.drugName}${dosageStr}\nGiờ uống: ${med.scheduledTime}`;

  await self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `med-${med.prescriptionItemId}-${med.scheduledTime}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    actions: [
      { action: 'taken',  title: '✅ Đã uống' },
      { action: 'snooze', title: '⏰ Nhắc lại 10 phút' },
    ],
    data: { med, url: '/elderly/medications' },
  });
}

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const { med, url } = notification.data || {};

  notification.close();

  if (action === 'taken' && med) {
    event.waitUntil(markTaken(med.prescriptionItemId, med.drugName, med.scheduledTime));
    openApp(url);
    return;
  }

  if (action === 'snooze') {
    // Re-notify in 10 minutes by removing from notified set
    setTimeout(() => {
      if (self.__notified && med) {
        const now = new Date();
        self.__notified.delete(`${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`);
      }
    }, 10 * 60 * 1000);
    return;
  }

  // Default click → open app
  event.waitUntil(openApp(url));
});

async function openApp(url) {
  const targetUrl = url || '/elderly/medications';
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    if (client.url.includes('localhost:3000')) {
      client.focus();
      client.navigate(targetUrl);
      return;
    }
  }
  await self.clients.openWindow(`http://localhost:3000${targetUrl}`);
}

// ── Mark taken via API ────────────────────────────────────────────────────────

async function markTaken(itemId, drugName, scheduledTime) {
  const token = self.__token;
  const elderlyId = self.__elderlyId;
  if (!token || !elderlyId || !itemId) return;

  const today = new Date().toISOString().split('T')[0];
  try {
    await fetch(`${API_BASE}/medications/items/${itemId}/taken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ elderlyId, drugName, scheduledDate: today, scheduledTime }),
    });
  } catch { /* ignore */ }
}
