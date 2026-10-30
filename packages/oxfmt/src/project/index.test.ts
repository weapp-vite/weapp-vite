import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { recommended } from '../index'
import { formatWxml } from '../wxml'

const execute = promisify(execFile)
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url))
const roots: string[] = []
const source = '<view alpha="first-value" beta="second-value" gamma="third-value">prefix  {{label}}  suffix</view>\n'

async function project(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-format-config-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'format-config-fixture', type: 'module' }))
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  return {
    read: (name: string) => readFile(path.join(root, name), 'utf8'),
    run: (args: string[], member = '.') => execute(process.execPath, [cli, ...args], {
      cwd: path.join(root, member),
      timeout: 20_000,
      env: { ...process.env, NO_COLOR: '1' },
    }),
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('format CLI configuration ownership', () => {
  it('uses the project Vite config and per-file overrides for protected WXML', async () => {
    const config = {
      fmt: {
        ...recommended,
        printWidth: 40,
        overrides: [{ files: ['src/wide.wxml'], options: { printWidth: 120 } }],
      },
    }
    const fixture = await project({
      'vite.config.mjs': `export default ${JSON.stringify(config)}\n`,
      'src/narrow.wxml': source,
      'src/wide.wxml': source,
    })
    await fixture.run(['--write'])
    expect(await fixture.read('src/narrow.wxml')).toBe(await formatWxml(source, 'narrow.wxml', { printWidth: 40 }))
    expect(await fixture.read('src/wide.wxml')).toBe(source)
    await fixture.run(['--check'])
  })

  it('uses workspace-root fmt for check-all and the nearest fmt for format', async () => {
    const rootConfig = { fmt: { ...recommended, printWidth: 40 }, check: { lint: false } }
    const memberConfig = { fmt: { ...recommended, printWidth: 120 } }
    const fixture = await project({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'vite.config.mjs': `export default ${JSON.stringify(rootConfig)}\n`,
      'packages/app/package.json': '{"name":"member-app","type":"module"}\n',
      'packages/app/vite.config.mjs': `export default ${JSON.stringify(memberConfig)}\n`,
      'packages/app/src/page.wxml': source,
    })
    await fixture.run(['--write'])
    expect(await fixture.read('packages/app/src/page.wxml')).toBe(await formatWxml(source, 'page.wxml', { printWidth: 40 }))
    await fixture.run(['--check-all'], 'packages/app')
    await fixture.run(['--write'], 'packages/app')
    expect(await fixture.read('packages/app/src/page.wxml')).toBe(source)
    await expect(fixture.run(['--check-all'], 'packages/app')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('WXML 需要格式化'),
    })
  })
})
