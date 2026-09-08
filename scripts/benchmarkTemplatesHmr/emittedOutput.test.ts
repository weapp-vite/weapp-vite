import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmittedScriptReader, waitForBenchmarkOutput } from './emittedOutput'

describe('template benchmark emitted ownership', () => {
  let root: string

  async function write(relative: string, source: string) {
    const filename = path.join(root, relative)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
    return filename
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'templates-hmr-output-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads only static local imports reachable from the page, including HMR payloads and cycles', async () => {
    const entry = await write('pages/index.js', 'require("../shared"); require("../hmr/update.js");')
    await write('shared.js', 'require("./pages/index.js"); require("external-package"); console.log("shared-marker")')
    await write('hmr/update.js', 'console.log("update-marker")')
    await write('unused.js', 'console.log("unreachable-marker")')
    const output = await createEmittedScriptReader(entry, root)()
    expect(output).toContain('shared-marker')
    expect(output).toContain('update-marker')
    expect(output).not.toContain('unreachable-marker')
  })

  it('does not follow fake requires inside comments, strings, or a shadowed require function', async () => {
    const entry = await write('index.js', [
      '// require("./missing-comment.js")',
      'console.log("require(\'./missing-string.js\')")',
      'function example(require) { require("./missing-shadowed.js") }',
    ].join('\n'))
    await expect(createEmittedScriptReader(entry, root)()).resolves.toContain('function example')
  })

  it('resolves root-relative and extensionless directory imports', async () => {
    const entry = await write('pages/index.js', 'require("/shared");')
    await write('shared/index.js', 'console.log("directory-marker")')
    await expect(createEmittedScriptReader(entry, root)()).resolves.toContain('directory-marker')
  })

  it('re-reads changed import edges and payloads instead of accepting an old graph', async () => {
    const entry = await write('index.js', 'require("./before.js");')
    await write('before.js', 'console.log("old-marker")')
    const read = createEmittedScriptReader(entry, root)
    expect(await read()).toContain('old-marker')
    await write('after.js', 'console.log("new-marker")')
    await write('index.js', 'require("./after.js");')
    expect(await read()).toContain('new-marker')
    await expect(waitForBenchmarkOutput(read, 'old-marker', { absent: true, timeoutMs: 100 })).resolves.not.toContain('old-marker')
  })

  it('does not accept a missing dependency as successful restoration', async () => {
    const entry = await write('index.js', 'require("./missing.js");')
    const read = createEmittedScriptReader(entry, root)
    await expect(waitForBenchmarkOutput(read, 'old-marker', { absent: true, timeoutMs: 30, intervalMs: 1 }))
      .rejects
      .toThrow('Missing emitted script: missing.js')
  })

  it('rejects imports that escape the output root', async () => {
    const entry = await write('index.js', 'require("../outside.js");')
    await expect(createEmittedScriptReader(entry, root)()).rejects.toThrow('escapes the output root')
  })

  it('identifies malformed reachable payloads without exposing the workspace path', async () => {
    const entry = await write('index.js', 'require("./hmr/update.js")')
    await write('hmr/update.js', 'function payload() { export const invalid = true }')
    const error = await createEmittedScriptReader(entry, root)().catch(error => error as Error)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Cannot parse emitted script hmr/update.js:')
    expect((error as Error).message).not.toContain(root)
  })

  it('fails restoration if the reachable marker remains', async () => {
    const entry = await write('index.js', 'require("./update.js")')
    await write('update.js', 'console.log("old-marker")')
    await expect(waitForBenchmarkOutput(createEmittedScriptReader(entry, root), 'old-marker', { absent: true, timeoutMs: 30, intervalMs: 1 }))
      .rejects
      .toThrow('Timed out')
  })
})
