import { create, StoreApi } from 'zustand';
import type { User } from '../types';

// ── Extended User type with backend fields ────────────────────────────────────

export interface AuthUser extends User {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  /** For ELDERLY role: the linked ElderlyProfile ID (set by backend on login) */
  elderlyId?: string;
  /** For CAREGIVER role: the list of assigned elderly profile IDs */
  assignedElderlyIds?: string[];
}

// ── State shape ───────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  token: string | null;

  /**
   * The currently selected elderly patient ID.
   *
   * - For ELDERLY users: automatically set to their own `elderlyId` on login.
   * - For CAREGIVER/ADMIN users: manually set via `selectElderly()` when navigating
   *   to a specific patient's data. Defaults to the first assigned elderly on login.
   */
  selectedElderlyId: string | null;

  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;

  /**
   * Select the active elderly patient context.
   * Used by caregiver/admin pages to scope data queries to one patient.
   */
  selectElderly: (elderlyId: string | null) => void;

  /**
   * Returns the effective elderly ID for the current session:
   * - ELDERLY role → their own elderlyId (from JWT profile)
   * - CAREGIVER/ADMIN → selectedElderlyId (manually chosen)
   */
  getElderlyId: () => string | null;
}

// ── Persistence helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = 'lifetrack-auth';

function loadFromStorage(): { user: AuthUser | null; selectedElderlyId: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { user: null, selectedElderlyId: null };
    const parsed = JSON.parse(stored) as {
      user: AuthUser;
      selectedElderlyId?: string | null;
    };
    return {
      user: parsed.user ?? null,
      selectedElderlyId: parsed.selectedElderlyId ?? null,
    };
  } catch {
    return { user: null, selectedElderlyId: null };
  }
}

function saveToStorage(user: AuthUser | null, selectedElderlyId: string | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, selectedElderlyId }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

type SetState = StoreApi<AuthState>['setState'];
type GetState = StoreApi<AuthState>['getState'];

const { user: storedUser, selectedElderlyId: storedElderlyId } = loadFromStorage();

export const useAuthStore = create<AuthState>()((set: SetState, get: GetState) => ({
  user: storedUser,
  token: localStorage.getItem('token'),
  selectedElderlyId: storedElderlyId,

  setAuth: (user: AuthUser, token: string) => {
    localStorage.setItem('token', token);

    // Determine initial selectedElderlyId based on role:
    // - ELDERLY: use their own elderlyId from the JWT profile
    // - CAREGIVER/ADMIN: default to first assigned elderly (if any)
    const role = user.role?.toLowerCase();
    let initialElderlyId: string | null = null;

    if (role === 'elderly' && user.elderlyId) {
      initialElderlyId = user.elderlyId;
    } else if ((role === 'caregiver' || role === 'admin') && user.assignedElderlyIds?.length) {
      initialElderlyId = user.assignedElderlyIds[0];
    }

    saveToStorage(user, initialElderlyId);
    set({ user, token, selectedElderlyId: initialElderlyId });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, token: null, selectedElderlyId: null });
  },

  isAuthenticated: () => !!get().token,

  selectElderly: (elderlyId: string | null) => {
    const { user } = get();
    saveToStorage(user, elderlyId);
    set({ selectedElderlyId: elderlyId });
  },

  getElderlyId: () => {
    const { user, selectedElderlyId } = get();
    if (!user) return null;
    const role = user.role?.toLowerCase();
    if (role === 'elderly') {
      return user.elderlyId ?? null;
    }
    return selectedElderlyId;
  },
}));
