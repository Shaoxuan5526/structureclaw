import { type StateCreator } from 'zustand'

export type AppLocale = 'en' | 'zh'

/**
 * Preferences State Interface
 *
 * Note: Theme persistence is handled by next-themes (see src/app/providers.tsx).
 * next-themes provides:
 * - localStorage persistence
 * - Cross-tab sync via browser 'storage' event
 * - System preference detection
 *
 * This slice is reserved for future preferences that need Zustand state management.
 */
export interface PreferencesState {
  locale: AppLocale
}

export interface PreferencesActions {
  setLocale: (locale: AppLocale) => void
}

export type PreferencesSlice = PreferencesState & PreferencesActions

/**
 * Initial preferences state.
 * Currently empty - theme is handled by next-themes.
 */
export const initialPreferencesState: PreferencesState = {
  locale: 'en',
}

/**
 * Create preferences slice for Zustand store.
 * Currently empty stub for future expansion.
 */
export const createPreferencesSlice: StateCreator<
  PreferencesSlice,
  [],
  [],
  PreferencesSlice
> = (set) => ({
  ...initialPreferencesState,
  setLocale: (locale) => set({ locale }),
})
