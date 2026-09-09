import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = path.resolve(import.meta.dirname, '..')
const packages = [
  'mpcore/packages/test',
  'mpcore/packages/simulator',
  'packages/miniprogram-automator',
  'packages-runtime/wevu-compiler',
  'packages-runtime/wevu',
] as const

interface Manifest {
  types: string
  scripts: Record<string, string>
}

interface Workflow {
  jobs: Record<string, {
    if?: string
    strategy?: { matrix?: { include?: { main_command?: string }[] } }
    with?: { main_command?: string }
    steps?: { run?: string }[]
  }>
}

describe('public type tests in CI', () => {
  it('weapp-vite collects every nested fixture and non-index contract', async () => {
    const packageRoot = path.join(root, 'packages/weapp-vite')
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as Manifest
    const commands = manifest.scripts['test:types']!.split(/\s*&&\s*/)
    let directory = packageRoot
    const selected = new Set<string>()
    for (const command of commands) {
      if (command.startsWith('cd ')) {
        directory = path.resolve(directory, command.slice(3))
        continue
      }
      const pattern = /^tsd --files "([^"]+)"$/.exec(command)?.[1]
      expect(pattern, `Every fixture must explicitly collect its contracts: ${command}`).toBeDefined()
      if (!pattern) {
        throw new Error(`Missing explicit tsd contract pattern: ${command}`)
      }
      expect(path.matchesGlob('future.test-d.ts', pattern)).toBe(true)
      expect(path.matchesGlob('nested/future.test-d.ts', pattern)).toBe(true)
      for (const file of await readdir(directory, { recursive: true })) {
        if (path.matchesGlob(file.replaceAll('\\', '/'), pattern)) {
          selected.add(path.relative(packageRoot, path.join(directory, file)).replaceAll('\\', '/'))
        }
      }
    }
    const contracts = (await readdir(path.join(packageRoot, 'test-d'), { recursive: true }))
      .filter(file => /\.test-d\.tsx?$/.test(file))
      .map(file => `test-d/${file.replaceAll('\\', '/')}`)
    expect(contracts.length).toBeGreaterThan(0)
    expect([...selected].sort()).toEqual(contracts.sort())
  })

  it.each(packages)('%s selects actual contracts instead of its .d.mts declaration', async (directory) => {
    const packageRoot = path.join(root, directory)
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as Manifest
    expect(manifest.types).toMatch(/\.d\.mts$/)
    const script = manifest.scripts['test:types'] ?? ''
    expect(script).toMatch(/^pnpm build(?::types)?\s*&&\s*tsd\b/)
    const pattern = /\btsd\s+--files\s+"([^"]+)"/.exec(script)?.[1]
    expect(pattern, 'tsd defaults only replace .d.ts and can select the .d.mts declaration itself').toBeDefined()
    if (!pattern) {
      throw new Error(`Missing explicit test-d pattern in ${directory}`)
    }
    const testFiles = (await readdir(path.join(packageRoot, 'test-d'), { recursive: true }))
      .filter(file => /\.test-d\.tsx?$/.test(file))
      .map(file => `test-d/${file.replaceAll('\\', '/')}`)
    expect(testFiles.length).toBeGreaterThan(0)
    expect(testFiles.filter(file => !path.matchesGlob(file, pattern))).toEqual([])
    expect(path.matchesGlob('test-d/nested/future.test-d.ts', pattern)).toBe(true)
    expect(path.matchesGlob(manifest.types, pattern)).toBe(false)
  })

  it('reaches package contracts through the PR type-check job and root task', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Manifest
    expect(manifest.scripts['test:types']).toMatch(/^turbo run test:types$/)
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')) as Workflow
    const job = workflow.jobs['build-pr']
    expect(job?.if).toContain('github.event_name == \'pull_request\'')
    expect(job?.strategy?.matrix?.include?.some(entry => /(?:^|\n)pnpm test:types(?:\n|$)/.test(entry.main_command ?? ''))).toBe(true)
    // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
    expect(job?.with?.main_command).toBe('${{ matrix.main_command }}')
    const reusable = parse(await readFile(path.join(root, '.github/workflows/reusable-node-command.yml'), 'utf8')) as Workflow
    // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
    expect(Object.values(reusable.jobs).some(entry => entry.steps?.some(step => step.run === '${{ inputs.main_command }}'))).toBe(true)
  })
})
