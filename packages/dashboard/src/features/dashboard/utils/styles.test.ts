import { describe, expect, it } from 'vitest'
import { pillButtonStyles, surfaceStyles } from './styles'

describe('dashboard style merging', () => {
  it('keeps CSS variable colors and responsive padding when a caller overrides vertical padding', () => {
    const classes = surfaceStyles({ tone: 'strong', padding: 'header', class: 'py-0' }).split(' ')

    expect(classes).toEqual(expect.arrayContaining([
      'border',
      'border-(--dashboard-border-strong)',
      'bg-(--dashboard-panel-strong)',
      'shadow-(--dashboard-shadow)',
      'px-4',
      'md:px-5',
      'py-0',
    ]))
    expect(classes).not.toContain('py-4')
  })

  it('preserves button typography and explicit overrides without leaking the active variant', () => {
    const active = pillButtonStyles({ kind: 'nav', active: true, class: 'h-8 py-0' }).split(' ')
    expect(active).toEqual(expect.arrayContaining([
      'border',
      'border-(--dashboard-accent)',
      'text-(--dashboard-text)',
      'text-sm',
      'px-3.5',
      'py-0',
    ]))
    expect(active).not.toContain('py-1.5')

    const inactive = pillButtonStyles().split(' ')
    expect(inactive).toEqual(expect.arrayContaining([
      'border-(--dashboard-border)',
      'text-(--dashboard-text-soft)',
      'py-1.5',
    ]))
    expect(inactive).not.toContain('border-(--dashboard-accent)')
  })
})
