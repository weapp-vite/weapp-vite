import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

const CASES = {
  tailwind3: path.resolve(import.meta.dirname, '../../e2e-apps/issue-814-tailwind3'),
  tailwind4: path.resolve(import.meta.dirname, '../../e2e-apps/issue-814-tailwind4'),
  tailwind4Broken: path.resolve(import.meta.dirname, '../../e2e-apps/issue-814-tailwind4-broken'),
} as const

async function buildCase(appRoot: string) {
  const distRoot = path.resolve(appRoot, 'dist')
  await fs.remove(distRoot)

  await execa('node', [CLI_PATH, 'build', appRoot, '--platform', 'weapp', '--skipNpm'], {
    cwd: appRoot,
    stdio: 'inherit',
  })

  const wxml = await fs.readFile(path.resolve(distRoot, 'pages/index/index.wxml'), 'utf-8')
  const js = await fs.readFile(path.resolve(distRoot, 'pages/index/index.js'), 'utf-8')
  return { wxml, js }
}

describe.sequential('e2e app: issue #814 tailwind dynamic class matrix', () => {
  it('tailwind3 keeps dynamic class binding in js and escapes arbitrary-value segment', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind3)

    expect(wxml).toContain('class="{{__wv_cls_0}}"')
    expect(wxml).toContain('gap-_b24px_B')
    expect(js).toContain('`flex`+')
    expect(js).toContain('this.bbb')
    expect(js).toContain('this.aaa')
    expect(js).toContain('gap-_b17px_B')
    expect(js).not.toContain('gap-[17px]')
  })

  it('tailwind4 keeps dynamic class binding in js and escapes arbitrary-value segment', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind4)

    expect(wxml).toContain('class="{{__wv_cls_0}}"')
    expect(wxml).toContain('gap-_b24px_B')
    expect(js).toContain('`flex`+')
    expect(js).toContain('this.bbb')
    expect(js).toContain('this.aaa')
    expect(js).toContain('gap-_b17px_B')
    expect(js).not.toContain('gap-[17px]')
  })

  it('tailwind4-broken keeps dynamic class binding in js but reproduces unescaped arbitrary-value symptom', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind4Broken)

    expect(wxml).toContain('class="{{__wv_cls_0}}"')
    expect(wxml).toContain('gap-_b24px_B')
    expect(js).toContain('`flex`+')
    expect(js).toContain('this.bbb')
    expect(js).toContain('this.aaa')
    expect(js).toContain('gap-[17px]')
    expect(js).not.toContain('gap-_b17px_B')
  })
})
