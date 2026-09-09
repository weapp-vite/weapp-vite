import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getIdeExhaustiveTasks, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS } from './e2e-suite-manifest'

// 只验证 fixture 配置，不加载构建器或启动 IDE。
vi.mock('weapp-vite', () => ({ defineConfig: (config: unknown) => config }))

interface FixtureConfig {
  weapp: {
    autoRoutes: boolean | { include: string[] }
    npm: { enable?: boolean }
  }
}

async function readFixtureConfig(target?: string) {
  vi.stubEnv('WEAPP_VITE_E2E_TARGET_FILE', target)
  vi.resetModules()
  return (await import('../../e2e-apps/github-issues/weapp-vite.config')).default as FixtureConfig
}

const sharedBuildTargets = [...new Set([
  ...getIdeExhaustiveTasks().map(task => task.label),
  ...IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS,
])].filter((label) => {
  if (!label.startsWith('ide/github-issues.runtime.')) {
    return false
  }
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '..', label), 'utf8')
  return source.includes('prepareGithubIssuesBuild(')
    || label === 'ide/github-issues.runtime.aggregate.test.ts'
})

describe('github-issues targeted fixture route scope', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('WEAPP_GITHUB_')) {
        vi.stubEnv(key, undefined)
      }
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each(sharedBuildTargets)('keeps %s within an explicit route group', async (target) => {
    const config = await readFixtureConfig(target)
    expect(config.weapp.autoRoutes).toEqual({ include: expect.any(Array) })
    const routes = config.weapp.autoRoutes as { include: string[] }
    expect(routes.include.length).toBeGreaterThan(0)
    expect(routes.include.some(route => route.startsWith('components/'))).toBe(false)
  })

  it.each(['868', '941'])('limits issue %s to its page and the shared warmup route', async (issue) => {
    const config = await readFixtureConfig(`ide/github-issues.runtime.issue${issue}.test.ts`)
    expect(config.weapp.autoRoutes).toEqual({ include: ['pages/block-slot/**', `pages/issue-${issue}/**`] })
    expect(config.weapp.npm.enable).toBe(false)
  })

  it.each([
    'ide/github-issues.runtime.unregistered.test.ts',
    'ide\\github-issues.runtime.unregistered.test.ts',
  ])('rejects an unregistered targeted build: %s', async (target) => {
    await expect(readFixtureConfig(target)).rejects.toThrow('Missing github-issues runtime route group: github-issues.runtime.unregistered.test.ts')
  })

  it('keeps the ordinary example unrestricted when no test target is set', async () => {
    const config = await readFixtureConfig()
    expect(config.weapp.autoRoutes).toBe(true)
  })
})
