import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SettingsStoreState {
  /** Media burst gap in minutes; used by the chat viewer to cluster incoming media. */
  mediaBurstGapMin: number
  setMediaBurstGapMin: (min: number) => void
  /**
   * Whether the desktop sidebar is collapsed to the icon rail. Ignored below
   * `md` (mobile always uses the Sheet drawer). Persisted so the user's choice
   * survives reloads across sessions.
   */
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

/**
 * Persisted dashboard settings. Modeled exactly on `device.ts`: `create` +
 * `persist` + `createJSONStorage(() => localStorage)` + a versioned `name`.
 * No `version` / `migrate` / `partialize` — the first version of this shape is
 * small enough to persist wholesale, and the `name` suffix `.v1` carries the
 * version. A future shape change adds `version: 2` + `migrate` then.
 *
 * `mediaBurstGapMin` defaults to 2 — the Vue `useMediaBurst` `maxGapMs ?? 120_000`
 * default, expressed in minutes. The setter clamps: `Math.floor` first (so
 * `2.9` becomes `2`), then store only when finite and within `[1, 60]`.
 * Out-of-range or non-finite values (including `NaN` from an empty input's
 * `valueAsNumber`) are ignored — the store is the source of truth and must
 * never hold a value the UI's `min`/`max` would reject.
 */
export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      mediaBurstGapMin: 2,
      setMediaBurstGapMin: (min) => {
        if (!Number.isFinite(min)) return
        const floored = Math.floor(min)
        if (floored < 1 || floored > 60) return
        set({ mediaBurstGapMin: floored })
      },
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'gowa-ui.settings.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
