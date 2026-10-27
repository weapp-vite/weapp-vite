import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { playwrightCacheIdentity } from './playwrightCache.mjs'

const input = { platform: 'linux', arch: 'x64', version: '1.60.0', definitions: { browsers: [{ name: 'chromium', revision: '1000' }, { name: 'chromium-headless-shell', revision: '1000' }, { name: 'firefox', revision: '2000' }] }, browsers: 'chromium', home: '/representative/home' }

describe('trusted Playwright revision cache', () => {
  it('changes the key for tool, platform, architecture, browser and revision changes', () => {
    const key = playwrightCacheIdentity(input).key
    for (const change of [{ platform: 'darwin' }, { arch: 'arm64' }, { version: '1.61.0' }, { browsers: 'firefox' }, { definitions: { browsers: [{ name: 'chromium', revision: '1001' }] } }]) {
      expect(playwrightCacheIdentity({ ...input, ...change }).key).not.toBe(key)
    }
  })

  it('uses a stable set of requested browsers and refuses missing revisions', () => {
    expect(playwrightCacheIdentity({ ...input, browsers: 'firefox chromium chromium' }).key).toBe(playwrightCacheIdentity({ ...input, browsers: 'chromium firefox' }).key)
    expect(() => playwrightCacheIdentity({ ...input, browsers: 'webkit' })).toThrow('Missing')
    expect(() => playwrightCacheIdentity({ ...input, browsers: '--all' })).toThrow('Unsupported')
  })
})

it('allows trusted default-branch writes while keeping PR v1 cache execution unchanged', async () => {
  const command = parse(await readFile(new URL('../.github/workflows/reusable-node-command.yml', import.meta.url), 'utf8'))
  const steps = command.jobs.run.steps
  const restore = steps.find(step => step.name === 'Restore trusted Playwright browser revisions')
  expect(restore.if).toBe('inputs.verification_topology == \'optimized-v2\' && inputs.install_playwright')
  const save = steps.find(step => step.name === 'Save trusted Playwright browser revisions')
  expect(save.if).toContain('github.event_name != \'pull_request\'')
  expect(save.if).toContain('github.event_name != \'pull_request_target\'')
  expect(save.if).toContain('github.ref == format(\'refs/heads/{0}\', github.event.repository.default_branch)')
  expect(save.if).not.toContain('inputs.verification_topology == \'optimized-v2\'')
  const identity = steps.find(step => step.id === 'playwright-cache')
  expect(identity.if).toContain('inputs.verification_topology == \'optimized-v2\'')
  expect(identity.if).toContain('github.event_name != \'pull_request\'')
  const action = parse(await readFile(new URL('../.github/actions/setup-playwright-browsers/action.yml', import.meta.url), 'utf8'))
  const actionSave = action.runs.steps.find(step => step.uses?.startsWith('actions/cache/save@'))
  expect(actionSave.if).toContain('github.event_name != \'pull_request\'')
  expect(actionSave.if).toContain('github.event_name != \'pull_request_target\'')
  expect(actionSave.if).toContain('github.ref == format(\'refs/heads/{0}\', github.event.repository.default_branch)')
  expect(steps.find(step => step.name === 'Install Playwright browsers and system dependencies').run).toContain('playwright install --with-deps')
})
