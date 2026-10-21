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
    workflow_dispatch: { inputs: { mode: { type: string, required: boolean, default: string, options: string[] } } }
  }
  permissions: Record<string, string>
  concurrency: { 'group': string, 'cancel-in-progress': boolean }
  jobs: { deepwiki: { 'runs-on': string, 'steps': WorkflowStep[], 'continue-on-error'?: boolean } }
}

const workflowPath = fileURLToPath(new URL('../.github/workflows/refresh-deepwiki.yml', import.meta.url))
const workflowText = readFileSync(workflowPath, 'utf8')
const workflow = parse(workflowText) as Workflow
const steps = workflow.jobs.deepwiki.steps
const refreshCondition = 'github.event_name == \'workflow_dispatch\' && inputs.mode == \'refresh\''
const monitorCondition = 'github.event_name != \'workflow_dispatch\' || inputs.mode == \'monitor\''

describe('DeepWiki monitor and explicit refresh workflow', () => {
  it('defaults scheduled and manual runs to monitoring and keeps refresh an explicit choice', () => {
    expect(workflow.name).toBe('DeepWiki')
    const mode = workflow.on.workflow_dispatch.inputs.mode
    expect({ type: mode.type, required: mode.required, default: mode.default, options: mode.options }).toEqual({ type: 'choice', required: true, default: 'monitor', options: ['monitor', 'refresh'] })
    expect(workflow.on.schedule).toEqual([{ cron: '17 3 * * *' }])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency).toEqual({ 'group': 'refresh-deepwiki', 'cancel-in-progress': false })
    expect(Object.keys(workflow.jobs)).toEqual(['deepwiki'])
    expect(workflow.jobs.deepwiki['runs-on']).toBe('ubuntu-latest')
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

  it('installs ordinary dependencies without browsers and executes only the selected mode', () => {
    const setup = steps.find(step => step.uses?.startsWith('actions/setup-node@'))
    const monitor = steps.find(step => step.run === 'node .github/scripts/refresh-deepwiki.mjs --mode=monitor')
    const refresh = steps.find(step => step.run === 'node .github/scripts/refresh-deepwiki.mjs --mode=refresh')
    const installation = steps.find(step => step.run === 'pnpm install --frozen-lockfile --ignore-scripts')
    const browsers = steps.filter(step => /playwright\s+install/.test(step.run ?? ''))
    expect(setup?.with).toEqual({ 'node-version': 22, 'cache': 'pnpm', 'cache-dependency-path': 'pnpm-lock.yaml' })
    expect(installation?.run).toBe('pnpm install --frozen-lockfile --ignore-scripts')
    expect(installation?.if).toBeUndefined()
    expect(installation?.run).not.toMatch(/playwright|chromium|browser/i)
    expect(monitor?.if).toBe(monitorCondition)
    expect(refresh?.if).toBe(refreshCondition)
    expect(monitor?.env).toBeUndefined()
    expect(browsers).toHaveLength(1)
    expect(browsers[0]?.if).toBe(refreshCondition)
    expect(workflowText).not.toMatch(/secrets\.|DEEPWIKI_REFRESH_EMAIL|dry_run/i)
    expect(workflow.jobs.deepwiki['continue-on-error']).toBeUndefined()
    expect(steps.every(step => step['continue-on-error'] === undefined)).toBe(true)
    expect(steps.filter(step => step.uses).every(step => /@[0-9a-f]{40}$/.test(step.uses!))).toBe(true)
    expect(steps.findIndex(step => step.name === 'Read current main commit')).toBeLessThan(steps.indexOf(monitor!))
    expect(steps.findIndex(step => step.name === 'Read current main commit')).toBeLessThan(steps.indexOf(refresh!))
    expect(steps.indexOf(installation!)).toBeLessThan(steps.indexOf(monitor!))
    expect(steps.indexOf(installation!)).toBeLessThan(steps.indexOf(browsers[0]!))
    expect(steps.indexOf(browsers[0]!)).toBeLessThan(steps.indexOf(refresh!))
    expect(steps.filter(step => step.run?.includes('node .github/scripts/refresh-deepwiki.mjs'))).toEqual([monitor, refresh])
  })

  it('retains monitor status only for monitor runs and skips cancellation', () => {
    expect(steps.filter(step => step.name === 'Upload DeepWiki index status')).toHaveLength(1)
    const upload = steps.find(step => step.name === 'Upload DeepWiki index status')
    expect(upload?.if).toBe(`always() && !cancelled() && (${monitorCondition})`)
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/)
    expect(upload?.with).toMatchObject({
      'include-hidden-files': true,
      'if-no-files-found': 'ignore',
      'retention-days': 7,
    })
    expect(upload?.with?.path).toBe('.tmp/deepwiki-monitor/status.json')
    expect(upload?.with?.name).toBe('deepwiki-monitor-${{ github.run_id }}-${{ github.run_attempt }}')
  })

  it('retains refresh failure evidence only for the explicit refresh run', () => {
    expect(steps.filter(step => step.name === 'Preserve unsuccessful refresh evidence')).toHaveLength(1)
    const upload = steps.find(step => step.name === 'Preserve unsuccessful refresh evidence')
    expect(upload?.if).toBe(`failure() && !cancelled() && ${refreshCondition}`)
    expect(upload?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/)
    expect(upload?.with?.path).toBe('.tmp/deepwiki-refresh/')
    expect(upload?.with?.['include-hidden-files']).toBe(true)
    expect(upload?.with?.name).toBe('deepwiki-refresh-${{ github.run_id }}-${{ github.run_attempt }}')
    expect(steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'))).toHaveLength(2)
  })
})
