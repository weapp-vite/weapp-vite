import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readEmittedStylesheet, waitForEmittedStylesheet } from './emittedStylesheet'

const temporaryDirectories: string[] = []

async function fixture(files: Record<string, string>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'emitted-stylesheet-'))
  temporaryDirectories.push(directory)
  for (const [filename, source] of Object.entries(files)) {
    const target = path.join(directory, filename)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  return path.join(directory, 'app.wxss')
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('emitted stylesheet graph', () => {
  it('reads nested imports, handles cycles and ignores unreachable files', async () => {
    const entry = await fixture({
      'app.wxss': '@import "./styles/global.wxss";\r\n@import url("./styles/global.wxss");',
      'styles/global.wxss': '@import url( "../theme.wxss" ) screen;\n@import "../app.wxss";',
      'theme.wxss': 'view { color: #006241; }',
      'unreachable.wxss': 'view { content: "unreachable-marker"; }',
    })
    const result = await readEmittedStylesheet(entry)
    expect(result.match(/color: #006241/g)).toHaveLength(1)
    expect(result).not.toContain('unreachable-marker')
  })

  it('supports direct output and root-relative local imports without fetching external CSS', async () => {
    const entry = await fixture({
      'app.wxss': '@import "nested/page.wxss"; @import url(https://example.invalid/style.css); view { color: red; }',
      'nested/page.wxss': '@import "/theme.wxss?version=1";',
      'theme.wxss': 'view { color: green; }',
    })
    await expect(readEmittedStylesheet(entry)).resolves.toContain('color: green')
    await expect(waitForEmittedStylesheet(entry, 'color: red')).resolves.toContain('color: red')
  })

  it('does not accept a missing dependency as evidence that a marker disappeared', async () => {
    const entry = await fixture({ 'app.wxss': '@import "missing.wxss";' })
    const error = await waitForEmittedStylesheet(entry, 'old-marker', { absent: true, timeoutMs: 1, intervalMs: 1 }).catch(error => error as Error)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Cannot read emitted stylesheet missing.wxss: ENOENT')
    expect((error as Error).message).not.toContain(path.dirname(entry))
  })

  it('re-reads reachable imports after edits and verifies marker removal', async () => {
    const entry = await fixture({ 'app.wxss': '@import "global.wxss";', 'global.wxss': 'view { content: "old-marker"; }' })
    await expect(waitForEmittedStylesheet(entry, 'old-marker')).resolves.toContain('old-marker')
    await writeFile(path.join(path.dirname(entry), 'global.wxss'), 'view { content: "new-marker"; }')
    await expect(waitForEmittedStylesheet(entry, 'old-marker', { absent: true })).resolves.toContain('new-marker')
  })

  it('fails closed when emitted imports cannot be parsed', async () => {
    const entry = await fixture({ 'app.wxss': '@import unsupported-target;' })
    await expect(readEmittedStylesheet(entry)).rejects.toThrow('Cannot parse emitted stylesheet imports: app.wxss')
  })
})
