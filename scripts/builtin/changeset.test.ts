import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractChangesetPackages } from '../changeset-utils'
import { COMPONENT_OUTPUT_FILES, planComponentChangeset, writeComponentChangeset } from './changeset'

describe('component update release intent', () => {
  it('releases the compiler only for builtin changes', () => {
    const plan = planComponentChangeset([COMPONENT_OUTPUT_FILES[0]!], 'builtin diff')!
    expect(extractChangesetPackages(plan.content)).toEqual(['@wevu/compiler'])
    expect(plan.content).toContain('微信内置组件识别清单')
  })

  it.each(['tdesign', 'vant', 'weui'])('links %s resolver changes to the scaffolder', (library) => {
    const plan = planComponentChangeset([`packages/weapp-vite/src/auto-import-components/resolvers/json/${library}.json`], 'resolver diff')!
    expect(extractChangesetPackages(plan.content)).toEqual(['create-weapp-vite', 'weapp-vite'])
  })

  it('combines changed packages and uses the same filename for the same diff', () => {
    const plan = planComponentChangeset(COMPONENT_OUTPUT_FILES, 'same diff')!
    expect(extractChangesetPackages(plan.content)).toEqual(['@wevu/compiler', 'create-weapp-vite', 'weapp-vite'])
    expect(planComponentChangeset(COMPONENT_OUTPUT_FILES, 'same diff')).toEqual(plan)
    expect(planComponentChangeset(COMPONENT_OUTPUT_FILES, 'new diff')?.path).not.toBe(plan.path)
  })

  it('does not create release intent for unchanged files or test snapshots', () => {
    expect(planComponentChangeset([], '')).toBeUndefined()
    expect(planComponentChangeset(['packages/weapp-vite/test/resolvers/__snapshots__/tdesign.test.ts.snap'], 'snapshot')).toBeUndefined()
    expect(() => planComponentChangeset(COMPONENT_OUTPUT_FILES, '')).toThrow('non-empty')
  })

  it('is idempotent and never overwrites an existing changeset with different content', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'component-changeset-'))
    const file = path.join(directory, 'intent.md')
    try {
      const plan = { path: file, content: 'first intent\n' }
      await writeComponentChangeset(plan)
      await writeComponentChangeset(plan)
      expect(await readFile(file, 'utf8')).toBe(plan.content)
      await writeFile(file, 'user intent\n')
      await expect(writeComponentChangeset(plan)).rejects.toThrow()
      expect(await readFile(file, 'utf8')).toBe('user intent\n')
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
