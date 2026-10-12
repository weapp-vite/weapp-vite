/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  uses?: string
  run?: string
  if?: string
  env?: Record<string, string>
  with?: Record<string, unknown>
}

interface Workflow {
  on: {
    schedule: Array<{ cron: string }>
    workflow_dispatch: { inputs: Record<string, { type: string, default: boolean }> }
  }
  permissions: Record<string, string>
  concurrency: { 'group': string, 'cancel-in-progress': boolean }
  jobs: { refresh: { 'runs-on': string, 'steps': WorkflowStep[] } }
}

const workflowPath = fileURLToPath(new URL('../.github/workflows/refresh-deepwiki.yml', import.meta.url))
const workflow = parse(readFileSync(workflowPath, 'utf8')) as Workflow
const steps = workflow.jobs.refresh.steps

describe('DeepWiki refresh workflow', () => {
  it('defaults manual runs to read-only while preserving the daily serialized schedule', () => {
    expect(workflow.on.workflow_dispatch.inputs.dry_run).toMatchObject({
      type: 'boolean',
      default: true,
    })
    expect(workflow.on.schedule).toEqual([{ cron: '17 3 * * *' }])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency).toEqual({ 'group': 'refresh-deepwiki', 'cancel-in-progress': false })
  })

  it('uses the selected code ref and reads the target main SHA independently', () => {
    const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'))
    const main = steps.find(step => step.name === 'Read current main commit')
    expect(checkout?.with?.ref).toBe('${{ github.ref }}')
    expect(main?.run).toContain('[\'ls-remote\', \'--exit-code\', \'origin\', \'refs/heads/main\']')
    expect(main?.run).toContain('process.env.GITHUB_ENV')
    expect(main?.run).toContain('MAIN_SHA=')
    expect(main?.run).not.toContain('rev-parse HEAD')
  })

  it('injects the email secret only into the refresh runner and preserves explicit dry-run values', () => {
    const refresh = steps.find(step => step.name === 'Refresh DeepWiki when due')
    expect(refresh?.env).toEqual({
      DRY_RUN: '${{ github.event_name == \'workflow_dispatch\' && inputs.dry_run && \'true\' || \'false\' }}',
      DEEPWIKI_REFRESH_EMAIL: '${{ secrets.DEEPWIKI_REFRESH_EMAIL }}',
    })
    expect(refresh?.run).toBe('node .github/scripts/refresh-deepwiki.mjs')
    expect(steps.filter(step => step.env?.DEEPWIKI_REFRESH_EMAIL)).toEqual([refresh])
    expect(steps.every(step => !step.run?.includes('DEEPWIKI_REFRESH_EMAIL'))).toBe(true)
  })

  it('checks the local browser fixtures after installation and before contacting DeepWiki', () => {
    const installation = steps.findIndex(step => step.run?.includes('playwright install --with-deps chromium'))
    const fixtures = steps.findIndex(step => step.run === 'pnpm exec vitest run --config .github/scripts/deepwiki/vitest.config.mjs')
    const refresh = steps.findIndex(step => step.name === 'Refresh DeepWiki when due')
    expect(installation).toBeGreaterThanOrEqual(0)
    expect(fixtures).toBeGreaterThan(installation)
    expect(refresh).toBeGreaterThan(fixtures)
  })

  it('always retains only the sanitized diagnostics and screenshot, including failed runs', () => {
    const upload = steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.if).toBe('always()')
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/)
    expect(upload?.with).toMatchObject({
      'include-hidden-files': true,
      'if-no-files-found': 'ignore',
      'retention-days': 7,
    })
    expect(String(upload?.with?.path).trim().split(/\r?\n/)).toEqual([
      '.tmp/deepwiki-refresh/diagnostics.json',
      '.tmp/deepwiki-refresh/page.png',
    ])
  })
})
