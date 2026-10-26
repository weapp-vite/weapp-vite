import { readFile } from 'node:fs/promises'
import { createAutoChangesetPlan } from 'repoctl'
import { describe, expect, it } from 'vitest'
import { changesetFixture } from './fixture.mjs'

const policy = JSON.parse(await readFile(new URL('../../.github/repoctl-auto-changeset.json', import.meta.url), 'utf8'))
const plan = options => createAutoChangesetPlan(changesetFixture(policy, options))
const names = report => report.packages.map(pkg => pkg.name)

describe('weapp-vite policy through the public repoctl engine', () => {
  it('links runtime and template changes to the scaffolder across workspace roots', async () => {
    expect(names(await plan({ files: ['packages-runtime/wevu/src/index.ts'] }))).toEqual(['create-weapp-vite', 'wevu'])
    expect(names(await plan({ files: ['templates/vue/src/index.ts'] }))).toEqual(['create-weapp-vite'])
    expect(names(await plan({ files: ['mpcore/packages/simulator/src/index.ts'] }))).toEqual(['@mpcore/simulator'])
    expect(names(await plan({ files: ['mpcore/packages/test/src/index.ts'] }))).toEqual(['@mpcore/test'])
  })

  it('links constants dependents through workspace and npm aliases, including dev dependencies', async () => {
    expect(names(await plan({ files: ['@weapp-core/constants/src/index.ts'] }))).toEqual([
      '@weapp-core/constants',
      'aliased',
      'create-weapp-vite',
      'relative',
      'wevu',
    ])
  })

  it('keeps docs, tests, generated artifacts and package tooling out of release plans', async () => {
    const files = ['README.md', 'docs/api.md', 'src/index.test.ts', 'src/__tests__/helper.ts', 'dist/index.js', 'tsconfig.json'].map(file => `packages-runtime/wevu/${file}`)
    expect(names(await plan({ files }))).toEqual([])
    expect(names(await plan({ files: ['mpcore/packages/test/test/index.ts'] }))).toEqual([])
  })

  it('uses patch for dependency maintenance, minor for features and requires an explicit breaking level', async () => {
    expect((await plan({ title: 'chore(deps): update upstream major' })).packages.every(pkg => pkg.level === 'patch')).toBe(true)
    expect((await plan({ title: 'feat: 新增能力' })).packages.every(pkg => pkg.level === 'minor')).toBe(true)
    await expect(plan({ title: 'chore(deps)!: 收紧环境要求' })).rejects.toThrow('explicit release level')
    expect((await plan({ title: 'chore(deps)!: 收紧环境要求', labels: ['release:minor'] })).packages.every(pkg => pkg.level === 'minor')).toBe(true)
  })

  it('produces a Chinese conventional summary even for an English PR title', async () => {
    expect((await plan({ title: 'fix: lifecycle' })).change.content).toContain('fix: 修复问题，fix: lifecycle（#1）')
  })
})
