import { describe, expect, it } from 'vitest'
import { inspectHmrSource } from './sourceInventory'

const FILE = 'ide/source-update.runtime.test.ts'

describe('HMR source inventory discovery', () => {
  it('discovers source mutations without an hmr filename and resolves imported aliases', () => {
    const result = inspectHmrSource(`
      import { startDevProcess as start } from '../utils/dev-process'
      import { writeFile as save } from 'node:fs/promises'
      beforeAll(() => { dev = start('node', ['cli', 'dev']) })
      it('updates the source', async () => { await save(source, 'updated') })
    `, FILE)
    expect(result.candidate).toBe(true)
    expect(result.mutations).toEqual([{ method: 'writeFile', line: 5, target: 'source', cleanup: false }])
  })

  it.each(['startPackageScriptDevProcess', 'packageDev'])('discovers source mutations through the package-script launcher %s', (localName) => {
    const result = inspectHmrSource(`
      import { startPackageScriptDevProcess as ${localName} } from '../utils/packageScriptDevProcess'
      import { writeFile as save } from 'node:fs/promises'
      beforeAll(() => { dev = ${localName}('pnpm', ['exec', 'wv', 'dev']) })
      it('updates the source', async () => { await save(source, 'updated') })
    `, FILE)
    expect(result.startsDevProcess).toBe(true)
    expect(result.candidate).toBe(true)
    expect(result.mutations).toEqual([{ method: 'writeFile', line: 5, target: 'source', cleanup: false }])
  })

  it('recognizes filesystem members and native source mutation helpers', () => {
    const result = inspectHmrSource(`
      import fs from 'node:fs/promises'
      startDevProcess('node', ['cli', 'dev'])
      await fs['writeFile'](source, 'updated')
      await replaceFileByRename(source, 'restored')
      await writeNativeBatch(project, sources, step, false)
      await saveNativeProfileSource(project, 'app.json', '{}')
    `, FILE)
    expect(result.candidate).toBe(true)
    expect(result.mutations.map(item => item.method)).toEqual(['writeFile', 'replaceFileByRename', 'writeNativeBatch', 'saveNativeProfileSource'])
  })

  it('ignores strings and comments that only describe dev or source writes', () => {
    const result = inspectHmrSource(`
      // startDevProcess('node', ['dev']); writeFile(source, 'updated')
      const diagnostic = 'startDevProcess writeFile(source, updated)'
    `, FILE)
    expect(result).toEqual({ startsDevProcess: false, mutations: [], candidate: false })
  })

  it('keeps dev-only launches and ordinary build fixtures outside mutation candidates', () => {
    expect(inspectHmrSource('startDevProcess("node", ["cli", "dev"])', FILE).candidate).toBe(false)
    expect(inspectHmrSource('await writeFile(source, "build fixture")', FILE).candidate).toBe(false)
  })

  it('ignores source restoration inside teardown hooks including hook aliases', () => {
    const result = inspectHmrSource(`
      import { afterAll as release } from 'vitest'
      startDevProcess('node', ['cli', 'dev'])
      release(async () => { await writeFile(source, original) })
      afterEach(async () => { await fs.rm(temporaryRoot, { recursive: true }) })
    `, FILE)
    expect(result).toEqual({ startsDevProcess: true, mutations: [], candidate: false })
  })

  it.each(['startDevProcess', 'startPackageScriptDevProcess'])('keeps cleanup callbacks visible through %s so exceptions must identify the exact mutation', (launcher) => {
    const result = inspectHmrSource(`
      ${launcher}('node', ['cli', 'dev'])
      await runCase({ cleanup: async () => { await fs.rm(temporaryRoot, { recursive: true }) } })
    `, FILE)
    expect(result.candidate).toBe(true)
    expect(result.mutations).toEqual([{ method: 'rm', line: 3, target: 'temporaryRoot', cleanup: true }])
  })

  it('rejects unparseable files instead of silently losing their coverage', () => {
    expect(() => inspectHmrSource('await writeFile(', FILE)).toThrow()
  })
})
