/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  'name'?: string
  'uses'?: string
  'run'?: string
  'if'?: string
  'continue-on-error'?: boolean
  'env'?: Record<string, string>
  'with'?: Record<string, unknown>
}

interface Workflow {
  name: string
  on: {
    schedule: Array<{ cron: string }>
    workflow_dispatch: null | { inputs?: unknown }
  }
  permissions: Record<string, string>
  concurrency: { 'group': string, 'cancel-in-progress': boolean }
  jobs: { monitor: { 'runs-on': string, 'timeout-minutes': number, 'steps': WorkflowStep[], 'continue-on-error'?: boolean } }
}

const workflowPath = fileURLToPath(new URL('../.github/workflows/refresh-deepwiki.yml', import.meta.url))
const workflowText = readFileSync(workflowPath, 'utf8')
const workflow = parse(workflowText) as Workflow
const steps = workflow.jobs.monitor.steps

describe('DeepWiki monitoring workflow', () => {
  it('keeps scheduled and manual runs read-only without submission parameters', () => {
    expect(workflow.name).toBe('Monitor DeepWiki')
    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(workflow.on.workflow_dispatch?.inputs).toBeUndefined()
    expect(workflow.on.schedule).toEqual([{ cron: '17 3 * * *' }])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency).toEqual({ 'group': 'refresh-deepwiki', 'cancel-in-progress': false })
    expect(workflow.jobs.monitor['runs-on']).toBe('ubuntu-latest')
    expect(workflow.jobs.monitor['timeout-minutes']).toBe(5)
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

  it('uses existing HTML parser dependencies with no secret, browser or submission dependency', () => {
    const setup = steps.find(step => step.uses?.startsWith('actions/setup-node@'))
    const monitor = steps.find(step => step.name === 'Monitor DeepWiki index')
    const installation = steps.find(step => step.name === 'Install monitor dependencies')
    expect(setup?.with).toEqual({ 'node-version': 22, 'cache': 'pnpm', 'cache-dependency-path': 'pnpm-lock.yaml' })
    expect(installation?.run).toBe('pnpm install --frozen-lockfile --ignore-scripts')
    expect(monitor?.run).toBe('node .github/scripts/refresh-deepwiki.mjs')
    expect(monitor?.env).toBeUndefined()
    expect(steps).toHaveLength(7)
    expect(workflowText).not.toMatch(/secrets\.|DEEPWIKI_REFRESH_EMAIL|dry_run|playwright|chromium|browser|\bPOST\b/i)
    expect(workflow.jobs.monitor['continue-on-error']).toBeUndefined()
    expect(steps.every(step => step['continue-on-error'] === undefined)).toBe(true)
    expect(steps.filter(step => step.uses).every(step => /@[0-9a-f]{40}$/.test(step.uses!))).toBe(true)
    expect(steps.findIndex(step => step.name === 'Read current main commit')).toBeLessThan(steps.indexOf(monitor!))
    expect(steps.indexOf(installation!)).toBeLessThan(steps.indexOf(monitor!))
  })

  it('always retains the index status, including failed or stale runs', () => {
    const upload = steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.if).toBe('always()')
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/)
    expect(upload?.with).toMatchObject({
      'include-hidden-files': true,
      'if-no-files-found': 'ignore',
      'retention-days': 7,
    })
    expect(upload?.with?.path).toBe('.tmp/deepwiki-monitor/status.json')
    expect(upload?.with?.name).toBe('deepwiki-monitor-${{ github.run_id }}-${{ github.run_attempt }}')
  })
})
