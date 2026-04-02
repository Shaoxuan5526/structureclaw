import { describe, expect, it } from 'vitest'

import {
  createPreferencesSlice,
  initialPreferencesState,
  type PreferencesSlice,
} from '@/lib/stores/slices/preferences'

describe('Preferences Slice (STAT-04)', () => {
  it('createPreferencesSlice returns initial state with locale', () => {
    const slice = createPreferencesSlice(() => {}, () => ({} as any), {} as any)

    expect(slice.locale).toBe('en')
    expect(typeof slice.setLocale).toBe('function')
  })

  it('setLocale updates locale value', () => {
    let state: PreferencesSlice = createPreferencesSlice(
      (partial) => {
        state = { ...state, ...(partial as Partial<PreferencesSlice>) }
      },
      () => state,
      {} as any
    )

    state.setLocale('zh')
    expect(state.locale).toBe('zh')
  })
})

describe('Preference defaults', () => {
  it('locale defaults to english', () => {
    expect(initialPreferencesState.locale).toBe('en')
  })
})
