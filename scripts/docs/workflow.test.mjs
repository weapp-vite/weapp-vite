import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = name => parse(readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8'))
const expression = value => `$${'{{'} ${value} }}`

describe('repoctl documentation workflows', () => {
  it('routes main pushes to preview with the exact triggering commit', () => {
    const docs = workflow('repoctl-docs.yml')
    expect(docs.on.push.branches).toEqual(['main'])
    expect(docs.jobs.sites.if).toContain('github.ref == \'refs/heads/main\'')
    expect(docs.jobs.deploy.uses).toBe('./.github/workflows/repoctl-docs-deploy.yml')
    expect(docs.jobs.deploy.with.channel).toBe(expression('github.event_name == \'push\' && \'preview\' || inputs.channel'))
    expect(docs.jobs.deploy.with['source-sha']).toBe(expression('github.event_name == \'push\' && github.sha || inputs.source-sha'))
    expect(docs.on.workflow_dispatch.inputs).toHaveProperty('release')
    expect(docs.on.workflow_dispatch.inputs).toHaveProperty('commits')
  })

  it('serializes each deployment target and only executes the trusted default branch', () => {
    const docs = workflow('repoctl-docs-deploy.yml')
    const target = `docs-${expression('inputs.site')}-${expression('inputs.channel')}`
    expect(docs.concurrency).toEqual({ 'group': target, 'cancel-in-progress': false })
    expect(docs.jobs.deploy.environment).toBe(target)
    expect(docs.jobs.deploy.if).toContain('github.ref == \'refs/heads/main\'')
    const checkout = docs.jobs.deploy.steps.find(step => step.uses?.startsWith('actions/checkout@'))
    expect(checkout.with).toMatchObject({ 'ref': 'main', 'persist-credentials': false, 'fetch-depth': 0 })
    const deploy = docs.jobs.deploy.steps.find(step => step.name === 'Plan and deploy the selected documentation source')
    expect(deploy.run.indexOf('repo docs plan')).toBeLessThan(deploy.run.indexOf('repo docs deploy'))
    expect(deploy.env.REPO_DOCS_CONCURRENCY_GROUP).toBe(docs.concurrency.group)
    expect(deploy.run).not.toContain('wrangler deploy')
    expect(deploy.run).not.toContain('repo release')
  })

  it('keeps preview Worker and custom domains separate from production', () => {
    const config = file => JSON.parse(readFileSync(new URL(`../../website/${file}`, import.meta.url), 'utf8'))
    const stable = config('wrangler.jsonc')
    const preview = config('wrangler.preview.jsonc')
    expect(stable.name).toBe('weapp-vite')
    expect(preview.name).toBe('weapp-vite-preview')
    expect(preview.routes).toEqual([{ pattern: 'preview.vite.weapp.dev', custom_domain: true }])
    expect(stable.routes.map(route => route.pattern)).toEqual(['vite.weapp.dev', 'vite.icebreaker.top'])
    expect(stable.assets).toEqual(preview.assets)
  })
})
