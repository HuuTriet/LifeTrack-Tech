/**
 * Browser Notification + Medication Reminder Service
 * - Requests browser notification permission
 * - Polls medication schedule every minute
 * - Fires browser notification + sound when a medication is due
 */

const STORAGE_KEY = 'lifetrack-notified'; // tracks which slots were already notified
const POLL_INTERVAL_MS = 60_000; // every minute
const ALERT_WINDOW_MINUTES = 5; // notify if within 5 minutes of scheduled time

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Sound ─────────────────────────────────────────────────────────────────────

export function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Simple beep: 880Hz for 0.3s, then 660Hz for 0.3s
    [880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    });
  } catch {
    // AudioContext not available
  }
}

// ── Notification ──────────────────────────────────────────────────────────────

function showMedicationNotification(drugName: string, scheduledTime: string, dosage?: string) {
  if (Notification.permission !== 'granted') return;

  const body = dosage
    ? `Đã đến giờ uống ${drugName} — ${dosage}\nGiờ uống: ${scheduledTime}`
    : `Đã đến giờ uống ${drugName}\nGiờ uống: ${scheduledTime}`;

  const n = new Notification('💊 LifeTrack — Nhắc uống thuốc', {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `med-${drugName}-${scheduledTime}`,
    requireInteraction: true,
  });

  n.onclick = () => {
    window.focus();
    window.location.href = '/elderly/medications';
    n.close();
  };

  playAlertSound();
}

// ── Already-notified tracking ─────────────────────────────────────────────────

function getNotifiedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markNotified(key: string) {
  const set = getNotifiedSet();
  set.add(key);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

// ── Check due medications ─────────────────────────────────────────────────────

export interface PendingMed {
  prescriptionItemId: string;
  drugName: string;
  dosage?: string;
  scheduledTime: string; // "HH:mm"
  status: string;
}

export function checkDueMedications(meds: PendingMed[]) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const med of meds) {
    if (med.status !== 'PENDING') continue;

    const [h, m] = med.scheduledTime.split(':').map(Number);
    const scheduledMinutes = h * 60 + m;
    const diff = scheduledMinutes - nowMinutes;

    // Due within alert window (0 to +ALERT_WINDOW_MINUTES minutes ahead)
    if (diff >= 0 && diff <= ALERT_WINDOW_MINUTES) {
      const notifKey = `${med.prescriptionItemId}-${med.scheduledTime}-${now.toDateString()}`;
      if (!getNotifiedSet().has(notifKey)) {
        markNotified(notifKey);
        showMedicationNotification(med.drugName, med.scheduledTime, med.dosage);
      }
    }
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────

let _getMeds: (() => PendingMed[]) | null = null;

export function startMedicationReminders(getMeds: () => PendingMed[]) {
  _getMeds = getMeds;
  if (pollTimer) return; // already running
  // Check immediately, then every minute
  checkDueMedications(getMeds());
  pollTimer = setInterval(() => {
    if (_getMeds) checkDueMedications(_getMeds());
  }, POLL_INTERVAL_MS);
}

export function stopMedicationReminders() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  _getMeds = null;
}
