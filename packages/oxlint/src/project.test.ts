import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const cli = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url))
const roots: string[] = []

async function lint(files: Record<string, string>, language = {}, args: string[] = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'mini-native-lint-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), '{"name":"native-lint-fixture","type":"module"}\n')
  await writeFile(path.join(root, 'vite.config.mjs'), `export default { weapp: { language: ${JSON.stringify(language)} } }\n`)
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(root, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, source)
  }
  return execute(process.execPath, [cli, '--native-only', ...args], { cwd: root, timeout: 20_000 })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('native language CLI diagnostics', () => {
  it('checks registered platform templates and their owned modules', async () => {
    const result = await lint({
      'src/page.axml': '<import-sjs name="helper" from="./helper.sjs" /><view a:for="{{list}}">{{item}}</view>',
      'src/helper.sjs': 'export default { value: 1 }',
      'src/page.ksml': '<ks module="helper" src="./helper.ks" /><view ks:if="{{ready}}"/>',
      'src/helper.ks': 'module.exports = { value: 1 }',
    })
    expect(result.stderr).toBe('')
  })

  it('reports syntax and real native runtime violations at original filenames', async () => {
    await expect(lint({ 'src/page.wxml': '<view><text></view>', 'src/helper.wxs': 'module.exports = wx.getSystemInfoSync()' })).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('src/helper.wxs:1:'),
    })
  })

  it('requires platform ownership instead of silently passing SJS', async () => {
    await expect(lint({ 'src/helper.sjs': 'module.exports = {}' })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('script/platform-required') })
    await expect(lint({ 'src/helper.sjs': 'module.exports = {}' }, { overrides: [{ files: ['src/*.sjs'], platform: 'tt' }] })).resolves.toMatchObject({ stderr: '' })
  })

  it('keeps Vite language ownership and native ignores with an explicit lint JSON', async () => {
    const result = await lint({
      '.oxlintrc.json': '{"ignorePatterns":["src/vendor/**"]}',
      'src/helper.sjs': 'module.exports = {}',
      'src/vendor/invalid.sjs': 'module.exports = {',
    }, { overrides: [{ files: ['src/**/*.sjs'], platform: 'tt' }] }, ['-c', '.oxlintrc.json'])
    expect(result.stderr).toBe('')
  })
})
