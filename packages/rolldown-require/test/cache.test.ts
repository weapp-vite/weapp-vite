import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleRequire } from '@/index'

const tmpRoot = () => fsp.mkdtemp(path.join(os.tmpdir(), 'rolldown-require-cache-'))

describe('persistent cache', () => {
  it('hits cache when files unchanged and invalidates on dependency change', async () => {
    const root = await tmpRoot()
    const cacheDir = path.join(root, '.cache')

    const entry = path.join(root, 'entry.ts')
    const dep = path.join(root, 'dep.ts')
    await fsp.writeFile(dep, 'export const label = "v1"', 'utf8')
    await fsp.writeFile(entry, 'import { label } from "./dep"; export const val = label', 'utf8')

    const events: string[] = []
    const run = async () => {
      const { mod } = await bundleRequire({
        filepath: entry,
        cache: {
          enabled: true,
          dir: cacheDir,
          onEvent: (ev) => {
            events.push(ev.type + (ev.reason ? `:${ev.reason}` : ''))
          },
        },
      })
      return mod
    }

    const first = await run()
    expect(first.val).toBe('v1')
    expect(events).toContain('store')

    const afterStoreEvents = [...events]
    const second = await run()
    expect(second.val).toBe('v1')
    expect(events).toContain('hit')

    // mutate dependency to invalidate cache
    await fsp.writeFile(dep, 'export const label = "v2"', 'utf8')
    const third = await run()
    expect(third.val).toBe('v2')
    expect(events.length).toBeGreaterThan(afterStoreEvents.length)
    expect(events.some(e => e.startsWith('skip-invalid')) || events.includes('miss')).toBe(true)

    await fsp.rm(root, { recursive: true, force: true })
  })

  it('respects reset option to rewrite cache entry', async () => {
    const root = await tmpRoot()
    const cacheDir = path.join(root, '.cache')
    const entry = path.join(root, 'entry.ts')
    await fsp.writeFile(entry, 'export const mark = "x"', 'utf8')

    await bundleRequire({
      filepath: entry,
      cache: { enabled: true, dir: cacheDir },
    })
    const codeFile = fs.readdirSync(cacheDir).find(
      f => f.endsWith('.code.mjs') || f.endsWith('.code.cjs'),
    )
    expect(codeFile).toBeDefined()

    await bundleRequire({
      filepath: entry,
      cache: { enabled: true, dir: cacheDir, reset: true },
    })
    const filesAfterReset = fs.readdirSync(cacheDir)
    expect(filesAfterReset.filter(f => f.endsWith('.meta.json')).length).toBeGreaterThan(0)

    await fsp.rm(root, { recursive: true, force: true })
  })
})
