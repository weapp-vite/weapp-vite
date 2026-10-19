import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { ciTypePlan } from './ciTypes.mjs'

it('retains transitive type checks while removing all package builds from the consumer graph', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ci-types-'))
  const task = (name, kind = 'test:types:check') => ({ taskId: `${name}#${kind}`, package: name, task: kind, command: kind === 'build' ? 'build' : 'tsd' })
  const checks = [task('entry'), task('dependency')]
  const execute = vi.fn(async (_command, args) => ({ stdout: JSON.stringify({ tasks: args.includes('--only') ? checks : [...checks, task('dependency', 'build')] }) }))
  try {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'test:types': 'turbo run test:types:check --filter=entry' } }))
    await expect(ciTypePlan(root, execute)).resolves.toMatchObject({ targets: ['dependency', 'entry'], buildTasks: 0, taskIds: ['dependency#test:types:check', 'entry#test:types:check'] })
    expect(execute.mock.calls[1][1]).toContain('--filter=dependency')
    expect(execute.mock.calls[1][1]).toContain('--only')
    const missing = async (_command, args) => ({ stdout: JSON.stringify({ tasks: args.includes('--only') ? [checks[0]] : checks }) })
    await expect(ciTypePlan(root, missing)).rejects.toThrow('Incomplete')
    const rebuilding = async () => ({ stdout: JSON.stringify({ tasks: [...checks, task('dependency', 'build')] }) })
    await expect(ciTypePlan(root, rebuilding)).rejects.toThrow('must not contain build')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
