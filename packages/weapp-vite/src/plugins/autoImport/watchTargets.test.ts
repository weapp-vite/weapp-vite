import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createAutoImportSidecarPlan, resolveAutoImportWatchTargets } from './watchTargets'

describe('auto import watch targets', () => {
  it.each([
    ['**/*.vue', '.'],
    ['./**/*.wxml', '.'],
    ['components/Card*.vue', 'components'],
    ['/components/**/*.vue', 'components'],
    ['components/@(Card|Cell)/*.vue', 'components'],
    ['components/{Card,Cell}/*.vue', 'components'],
    ['components\\**\\*.vue', 'components'],
    ['components/Card.vue', 'components/Card.vue'],
  ])('watches the complete static base of %s', (glob, base) => {
    const root = path.join(tmpdir(), 'glob-watch-contract')
    expect([...resolveAutoImportWatchTargets(root, [glob])]).toEqual([path.resolve(root, base)])
  })

  it('keeps negated matcher coverage at the source root and leaves disabled discovery unwatched', () => {
    const root = path.join(tmpdir(), 'glob-watch-contract')
    expect([...resolveAutoImportWatchTargets(root, [])]).toEqual([])
    expect([...resolveAutoImportWatchTargets(root, ['!components/excluded/**'])]).toEqual([root])
    expect([...resolveAutoImportWatchTargets(root, ['components/**/*.vue', '!excluded/**'])]).toContain(root)
  })

  it('keeps only existing ancestor roots and prunes unrelated subtrees', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'glob-watch-plan-'))
    try {
      await mkdir(path.join(root, 'present'))
      const targets = resolveAutoImportWatchTargets(root, ['present/**/*.vue', 'future/nested/**/*.vue'])
      const plan = createAutoImportSidecarPlan(targets)
      expect(plan.roots).toEqual([root])
      expect(plan.ignored(path.join(root, 'present/Card.vue'))).toBe(false)
      expect(plan.ignored(path.join(root, 'future'))).toBe(false)
      expect(plan.ignored(path.join(root, 'future/nested/Card.vue'))).toBe(false)
      expect(plan.ignored(path.join(root, 'future/other'))).toBe(true)
      expect(plan.ignored(path.join(root, 'present-copy'))).toBe(true)
      expect(plan.ignored(path.join(root, 'pages'))).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
