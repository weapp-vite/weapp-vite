import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { recommended } from './index'

const execute = promisify(execFile)
const vp = fileURLToPath(new URL('../bin/vp', import.meta.resolve('vite-plus')))
const cli = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url))
const roots: string[] = []

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-oxfmt-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'oxfmt-fixture', type: 'module' }))
  await writeFile(path.join(root, '.oxfmtrc.json'), JSON.stringify(recommended))
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return {
    root,
    read: (name: string) => readFile(path.join(root, name), 'utf8'),
    format: (check = false) => execute(process.execPath, [cli, '-c', '.oxfmtrc.json', check ? '--check' : '--write', '.'], {
      cwd: root,
      timeout: 20_000,
      env: { ...process.env, NO_COLOR: '1' },
    }),
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Oxfmt mini-program preset through the published CLI', () => {
  it('formats WXML safely and WXSS by association and reaches a fixed point', async () => {
    const wxml = '<view   wx:if="{{ready}}"  class="box"  bind:tap="open"><text>A</text> <text>{{label}}</text><view wx:for="{{items}}" wx:key="id" catchtap="select">{{item.name}}</view></view>\n'
    const wxss = '.box{width:120rpx;color: red;margin:0 8rpx}page{background:#fff}\n'
    const project = await fixture({ 'src/page.wxml': wxml, 'src/page.wxss': wxss })
    await expect(project.format(true)).rejects.toMatchObject({ code: 1 })
    await project.format()
    const formattedWxml = await project.read('src/page.wxml')
    const formattedWxss = await project.read('src/page.wxss')
    expect(formattedWxml).not.toBe(wxml)
    expect(formattedWxss).not.toBe(wxss)
    for (const attribute of ['wx:if="{{ready}}"', 'bind:tap="open"', 'wx:for="{{items}}"', 'wx:key="id"', 'catchtap="select"']) {
      expect(formattedWxml).toContain(attribute)
    }
    expect(formattedWxml).toContain('{{label}}')
    expect(formattedWxml).toContain('{{item.name}}')
    expect(formattedWxss).toContain('120rpx')
    expect(formattedWxss).toContain('8rpx')
    expect(formattedWxss).toContain('page {')
    await project.format()
    expect(await project.read('src/page.wxml')).toBe(formattedWxml)
    expect(await project.read('src/page.wxss')).toBe(formattedWxss)
    await project.format(true)
  })

  it('preserves meaningful inline text whitespace and custom component names', async () => {
    const project = await fixture({
      'src/inline.wxml': '<view><text>A</text> <text>B</text></view>\n<custom-label>prefix  {{ value }}  suffix</custom-label>\n',
    })
    await project.format()
    expect(await project.read('src/inline.wxml')).toBe('<view><text>A</text> <text>B</text></view>\n<custom-label>prefix  {{ value }}  suffix</custom-label>\n')
    await project.format(true)
  })

  it('keeps direct vp fmt away from WXML even when text contains multiple spaces', async () => {
    const source = '<text   class="x">prefix  {{label}}  suffix</text>\n'
    const project = await fixture({ 'src/page.wxml': source })
    await execute(process.execPath, [vp, 'fmt', '-c', '.oxfmtrc.json', '--write', '.'], { cwd: project.root })
    expect(await project.read('src/page.wxml')).toBe(source)
  })

  it('does not write any input when WXML preflight fails', async () => {
    const script = 'export const value={text:"unchanged"};\n'
    const valid = '<view   class="valid">  keep  </view>\n'
    const invalid = '<view wx:if="{{ value < 2 }">broken</view>\n'
    const project = await fixture({ 'src/a.wxml': valid, 'src/b.wxml': invalid, 'src/page.ts': script })
    await expect(project.format()).rejects.toMatchObject({ code: 1 })
    expect(await project.read('src/a.wxml')).toBe(valid)
    expect(await project.read('src/b.wxml')).toBe(invalid)
    expect(await project.read('src/page.ts')).toBe(script)
  })

  it('respects project ignore files before reading WXML', async () => {
    const invalid = '<view wx:if="{{ unterminated">'
    const project = await fixture({
      '.gitignore': 'src/local.wxml\n',
      '.prettierignore': 'src/vendor.wxml\n',
      'src/local.wxml': invalid,
      'src/vendor.wxml': invalid,
      'src/page.wxml': '<view   class="page">  valid  </view>\n',
    })
    await project.format()
    expect(await project.read('src/local.wxml')).toBe(invalid)
    expect(await project.read('src/vendor.wxml')).toBe(invalid)
    expect(await project.read('src/page.wxml')).toBe('<view class="page">  valid  </view>\n')
  })

  it('uses project formatting without sorting package fields or touching generated outputs', async () => {
    const generated = 'const generated={value:"keep"};\r\n'
    const project = await fixture({
      'src/page.ts': 'export const value={ text: "hello" };\r\n',
      'package.json': '{"z":1,"name":"fixture","a":2}\n',
      'dist/page.ts': generated,
      'dist-web/page.ts': generated,
      '.weapp-vite/page.ts': generated,
      'miniprogram_npm/page.ts': generated,
      'src/generated/page.ts': generated,
    })
    await project.format()
    expect(await project.read('src/page.ts')).toBe('export const value = { text: \'hello\' }\n')
    expect(Object.keys(JSON.parse(await project.read('package.json')) as Record<string, unknown>)).toEqual(['z', 'name', 'a'])
    for (const name of ['dist/page.ts', 'dist-web/page.ts', '.weapp-vite/page.ts', 'miniprogram_npm/page.ts', 'src/generated/page.ts']) {
      expect(await project.read(name)).toBe(generated)
    }
    await project.format(true)
  })
})
