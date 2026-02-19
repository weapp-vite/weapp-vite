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
  it('tailwind3 escapes both static and dynamic arbitrary-value classes with app-root cwd build', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind3)

    expect(wxml).toContain('gap-_b20px_B')
    expect(js).toContain('gap-_b20px_B')
    expect(js).not.toContain('gap-[20px]')
  })

  it('tailwind4 escapes both static and dynamic arbitrary-value classes in current runtime behavior', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind4)

    expect(wxml).toContain('gap-_b20px_B')
    expect(js).toContain('gap-_b20px_B')
    expect(js).not.toContain('gap-[20px]')
  })

  it('tailwind4-broken reproduces issue #814 symptom for regression checks', async () => {
    const { wxml, js } = await buildCase(CASES.tailwind4Broken)

    expect(wxml).toContain('gap-_b20px_B')
    expect(js).toContain('gap-[20px]')
    expect(js).not.toContain('gap-_b20px_B')
  })
})
