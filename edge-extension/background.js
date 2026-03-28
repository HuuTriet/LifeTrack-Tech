/**
 * LifeTrack Extension — Service Worker (background.js)
 *
 * Responsibilities:
 *  1. Poll /api/v1/health/elderly/:id/dashboard every minute via chrome.alarms
 *  2. Fire chrome.notifications when a medication is due
 *  3. Update badge count with number of pending meds
 *  4. Handle notification click → open app tab
 */

const API_BASE = 'http://localhost:3000/api/v1';
const ALARM_NAME = 'med-check';
const ALERT_WINDOW_MIN = 5; // notify if within 5 min of scheduled time

// ── Alarm setup ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  console.log('[LifeTrack] Service worker installed, alarm created.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkMedications();
});

// Also check on startup
chrome.runtime.onStartup.addListener(() => checkMedications());

// ── Core check ────────────────────────────────────────────────────────────────

async function checkMedications() {
  const { token, elderlyId } = await getCredentials();
  if (!token || !elderlyId) {
    setBadge(0);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/health/elderly/${elderlyId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearCredentials();
      return;
    }

    const data = await res.json();
    const schedule = data?.medications?.schedule ?? [];
    const pending = schedule.filter(m => m.status === 'PENDING');

    // Update badge
    setBadge(pending.length);

    // Notify due meds
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const notified = await getNotifiedSet();

    for (const med of pending) {
      const [h, m] = (med.scheduledTime || '').split(':').map(Number);
      if (isNaN(h)) continue;
      const scheduled = h * 60 + m;
      const diff = scheduled - nowMin;

      // Due now or in next ALERT_WINDOW_MIN minutes
      if (diff >= 0 && diff <= ALERT_WINDOW_MIN) {
        const key = `${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`;
        if (!notified.has(key)) {
          markNotified(key, notified);
          fireNotification(med.drugName, med.scheduledTime, med.dosage, med.dosageUnit);
        }
      }

      // Overdue (past scheduled time, not yet taken)
      if (diff < 0 && diff >= -ALERT_WINDOW_MIN) {
        const key = `overdue-${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`;
        if (!notified.has(key)) {
          markNotified(key, notified);
          fireOverdueNotification(med.drugName, med.scheduledTime);
        }
      }
    }
  } catch (err) {
    console.error('[LifeTrack] Check failed:', err);
  }
}

// ── Notification helpers ──────────────────────────────────────────────────────

function fireNotification(drugName, time, dosage, unit) {
  const desc = dosage ? `${dosage}${unit || 'mg'}` : '';
  chrome.notifications.create(`med-${drugName}-${time}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '💊 Đến giờ uống thuốc!',
    message: `${drugName}${desc ? ' — ' + desc : ''}\nGiờ uống: ${time}`,
    buttons: [{ title: '✅ Đã uống' }, { title: '⏭️ Bỏ qua' }],
    requireInteraction: true,
    priority: 2,
  });
}

function fireOverdueNotification(drugName, time) {
  chrome.notifications.create(`overdue-${drugName}-${time}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '⚠️ Quá giờ uống thuốc!',
    message: `Bạn chưa uống ${drugName}\nĐã qua giờ: ${time}`,
    requireInteraction: true,
    priority: 2,
  });
}

// ── Notification click → open app ─────────────────────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => {
  chrome.tabs.query({ url: 'http://localhost:3001/*' }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: 'http://localhost:3001/elderly/medications' });
    }
  });
  chrome.notifications.clear(notifId);
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  // Both actions just dismiss for now — ideally call API
  chrome.notifications.clear(notifId);
});

// ── Badge ─────────────────────────────────────────────────────────────────────

function setBadge(count) {
  const text = count > 0 ? String(count) : '';
  const color = count > 0 ? '#E76F51' : '#52B788';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'elderlyId'], resolve);
  });
}

function clearCredentials() {
  chrome.storage.local.remove(['token', 'elderlyId']);
}

async function getNotifiedSet() {
  return new Promise((resolve) => {
    chrome.storage.session?.get(['notified'], (res) => {
      resolve(new Set(res?.notified ?? []));
    }) ?? resolve(new Set());
  });
}

async function markNotified(key, existingSet) {
  const s = existingSet ?? await getNotifiedSet();
  s.add(key);
  chrome.storage.session?.set({ notified: [...s] });
}
