import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createInspectorTemporaryRoot } from './inspectorTemporaryRoot'

const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href
const helperUrl = new URL('./inspectorTemporaryRoot.ts', import.meta.url).href

describe('Inspector temporary roots', () => {
  it('removes both owned roots on real process exit without touching a foreign directory', () => {
    const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wv-inspector-exit-test-')))
    const foreignRoot = path.join(sandbox, 'foreign')
    try {
      fs.mkdirSync(foreignRoot)
      fs.writeFileSync(path.join(foreignRoot, 'keep.txt'), 'not owned by Inspector')
      const child = spawnSync(process.execPath, [
        '--import',
        tsx,
        '--input-type=module',
        '--eval',
        `
          import fs from 'node:fs'
          import path from 'node:path'
          import process from 'node:process'
          import { createInspectorTemporaryRoot } from ${JSON.stringify(helperUrl)}

          const roots = ['source-', 'host-'].map((prefix) => {
            const temporaryRoot = createInspectorTemporaryRoot(prefix)
            const nested = path.join(temporaryRoot.root, 'nested')
            fs.mkdirSync(nested)
            fs.writeFileSync(path.join(nested, 'input.txt'), 'owned input')
            return temporaryRoot.root
          })
          fs.writeSync(1, JSON.stringify(roots))
          process.exit(0)
        `,
      ], {
        cwd: sandbox,
        env: { ...process.env, TMPDIR: sandbox, TMP: sandbox, TEMP: sandbox },
        encoding: 'utf8',
        timeout: 10_000,
        killSignal: 'SIGKILL',
      })

      expect(child.error).toBeUndefined()
      expect(child.signal).toBeNull()
      expect(child.status, child.stderr).toBe(0)
      const roots = JSON.parse(child.stdout) as string[]
      expect(roots).toEqual([expect.any(String), expect.any(String)])
      for (const root of roots) {
        expect(path.dirname(root)).toBe(sandbox)
        expect(fs.existsSync(root)).toBe(false)
      }
      expect(fs.readFileSync(path.join(foreignRoot, 'keep.txt'), 'utf8')).toBe('not owned by Inspector')
    }
    finally {
      fs.rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it('removes normally once and unregisters only its own exit listener', () => {
    const foreignListener = () => {}
    const listeners = [...process.listeners('exit'), foreignListener]
    const temporaryRoot = createInspectorTemporaryRoot('wv-inspector-normal-test-')
    try {
      process.on('exit', foreignListener)
      fs.writeFileSync(path.join(temporaryRoot.root, 'input.txt'), 'owned input')
      temporaryRoot.remove()
      expect(fs.existsSync(temporaryRoot.root)).toBe(false)
      expect(process.listeners('exit')).toEqual(listeners)

      // 所有权已释放；重复清理不能删除随后出现在相同路径的其他目录。
      fs.mkdirSync(temporaryRoot.root)
      const replacement = path.join(temporaryRoot.root, 'keep.txt')
      fs.writeFileSync(replacement, 'new owner')
      temporaryRoot.remove()
      expect(fs.readFileSync(replacement, 'utf8')).toBe('new owner')
      expect(process.listeners('exit')).toEqual(listeners)
    }
    finally {
      process.removeListener('exit', foreignListener)
      temporaryRoot.remove()
      fs.rmSync(temporaryRoot.root, { recursive: true, force: true })
    }
  })
})
