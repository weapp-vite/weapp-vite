import type { ChangeSet } from './types.ts'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createVerificationPlan } from './plan.ts'
import { getResourceBudget } from './resources.ts'
import { useIsolatedTopologyTestEnvironment } from './topologyTestFixture.ts'

useIsolatedTopologyTestEnvironment()

it.each([false, true])('keeps complete static coverage within bounded command arguments, fallback=%s', async (fallback) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'verify-file-checks-'))
  try {
    const { packageManager } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager }))
    const files = Array.from({ length: 160 }, (_, index) => `docs/${'中文 long path '.repeat(8)}${index}.vue`)
    await mkdir(path.join(root, 'docs'))
    await Promise.all(files.map(file => writeFile(path.join(root, file), '')))
    const changes: ChangeSet = { base: fallback ? null : 'base', head: 'head', files, fingerprint: 'fixture', fallback, warnings: [] }
    const plan = await createVerificationPlan({ root, changes, packages: [], resources: getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 }), mode: 'quick', selection: 'affected' })
    for (const kind of ['lint', 'stylelint']) {
      const checks = plan.tasks.filter(task => task.kind === kind)
      expect(checks.length).toBeGreaterThan(1)
      expect(checks[0]!.id).toBe(kind)
      expect(new Set(checks.map(task => task.id)).size).toBe(checks.length)
      const prefix = kind === 'lint' ? ['exec', 'eslint', '--no-warn-ignored'] : ['exec', 'stylelint']
      expect(checks.flatMap(task => task.args.slice(prefix.length))).toEqual(files)
      for (const check of checks) {
        expect(check.args.slice(0, prefix.length)).toEqual(prefix)
        expect(check.args.join(' ').length).toBeLessThanOrEqual(4_096)
      }
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
