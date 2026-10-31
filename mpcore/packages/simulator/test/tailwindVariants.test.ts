import { describe, expect, it } from 'vitest'
import { pill, sectionCard } from '../../../demos/web/src/lib/ui'

describe('simulator style merging', () => {
  it('keeps section variants in their own slots across successive selections', () => {
    const standalone = sectionCard({ tone: 'standalone' })
    expect(standalone.base().split(' ')).toEqual(expect.arrayContaining([
      'border',
      'border-(--sim-border)',
      'bg-(--sim-panel)',
      'text-(--sim-text)',
    ]))
    expect(standalone.header().split(' ')).not.toContain('border-b')

    const embedded = sectionCard()
    expect(embedded.header().split(' ')).toEqual(expect.arrayContaining([
      'border-b',
      'border-(--sim-divider)',
      'pb-3',
    ]))
    expect(embedded.base().split(' ')).not.toContain('bg-(--sim-panel)')
  })

  it('retains font size beside CSS variable text colors and resolves explicit boolean variants', () => {
    const classes = pill({ tone: 'accent', interactive: false }).split(' ')

    expect(classes).toEqual(expect.arrayContaining([
      'text-[12px]',
      'text-(--sim-accent-strong)',
      'border',
      'border-(--sim-accent-border)',
      'cursor-default',
    ]))
    expect(classes).not.toContain('cursor-pointer')
    expect(pill().split(' ')).toContain('cursor-pointer')
  })
})
