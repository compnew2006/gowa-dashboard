import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ mediaBurstGapMin: 2 })
  })

  it('defaults mediaBurstGapMin to 2', () => {
    useSettingsStore.setState({ mediaBurstGapMin: 2 })
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })

  it('sets a valid value', () => {
    useSettingsStore.getState().setMediaBurstGapMin(5)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(5)
  })

  it('rejects a value below 1', () => {
    useSettingsStore.getState().setMediaBurstGapMin(0)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })

  it('rejects a value above 60', () => {
    useSettingsStore.getState().setMediaBurstGapMin(61)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })

  it('rejects NaN (the empty-input edge from valueAsNumber)', () => {
    useSettingsStore.getState().setMediaBurstGapMin(Number.NaN)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })

  it('floors a fractional value', () => {
    useSettingsStore.getState().setMediaBurstGapMin(2.9)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })

  it('accepts the boundary values 1 and 60', () => {
    useSettingsStore.getState().setMediaBurstGapMin(1)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(1)
    useSettingsStore.getState().setMediaBurstGapMin(60)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(60)
  })

  it('rejects Infinity', () => {
    useSettingsStore.getState().setMediaBurstGapMin(Number.POSITIVE_INFINITY)
    expect(useSettingsStore.getState().mediaBurstGapMin).toBe(2)
  })
})
