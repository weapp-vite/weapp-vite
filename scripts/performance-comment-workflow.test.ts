import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = path.resolve(import.meta.dirname, '..')

describe('performance reporting workflows', () => {
  it('runs PR template benchmarks on all supported runners', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance.yml'), 'utf8'))
    const matrixExpression = workflow.jobs['templates-performance'].strategy.matrix.os
    expect(matrixExpression).toContain('ubuntu-latest')
    expect(matrixExpression).toContain('windows-latest')
    expect(matrixExpression).toContain('macos-latest')
  })

  it('uses trusted workflow_run permissions and both source workflows', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance-comment.yml'), 'utf8'))
    expect(workflow.on.workflow_run.workflows).toEqual(['CI Performance', 'Wevu Runtime Size'])
    expect(workflow.permissions).toMatchObject({ 'actions': 'read', 'contents': 'read', 'pull-requests': 'write' })
    expect((workflow.jobs.comment.steps as Array<{ name?: string }>).some(step => step.name === 'Check out trusted reporting scripts')).toBe(true)
  })
})
