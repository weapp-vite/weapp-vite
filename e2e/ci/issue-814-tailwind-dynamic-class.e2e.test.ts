import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

const CASES = {
  tailwind4: path.resolve(import.meta.dirname, '../../e2e-apps/issue-814-tailwind4'),
  tailwind4Broken: path.resolve(import.meta.dirname, '../../e2e-apps/issue-814-tailwind4-broken'),
} as const

async function buildCase(appRoot: string) {
  const distRoot = path.resolve(appRoot, 'dist')
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: appRoot,
    platform: 'weapp',
    cwd: appRoot,
    skipNpm: true,
    label: `ci:issue-814:${path.basename(appRoot)}`,
  })

  const wxml = await fs.readFile(path.resolve(distRoot, 'pages/index/index.wxml'), 'utf-8')
  const wxss = await fs.readFile(path.resolve(distRoot, 'app.wxss'), 'utf-8')
  const jsFiles = (await fs.readdir(distRoot, { recursive: true })).filter(file => file.endsWith('.js')).sort()
  const js = (await Promise.all(jsFiles.map(file => fs.readFile(path.join(distRoot, file), 'utf-8')))).join('\n')
  return { wxml, wxss, js }
}

function expectGeneratedClasses(wxml: string, wxss: string) {
  const dynamicNode = wxml.match(/<view\s[^>]*\bid="issue-814-dynamic"[^>]*>/)?.[0]
  expect(dynamicNode).toBeDefined()
  expect(dynamicNode).toMatch(/\bclass="\{\{[^}]+\}\}"/)
  expect(wxml).toContain('gap-_b24px_B')
  expect(wxss).toMatch(/\.gap-_b24px_B\s*\{[^}]*\bgap:\s*24px\b/)
  expect(wxss).toMatch(/\.gap-_b17px_B\s*\{[^}]*\bgap:\s*17px\b/)
}

describe('e2e app: issue #814 Tailwind Core dynamic class matrix', { concurrent: false }, () => {
  it('tailwind4 keeps dynamic class binding in js and escapes arbitrary-value segment', async () => {
    const { wxml, wxss, js } = await buildCase(CASES.tailwind4)

    expectGeneratedClasses(wxml, wxss)
    expect(js).toContain('gap-_b17px_B')
    expect(js).not.toContain('gap-[17px]')
  }, 120_000)

  it('jsPreserveClass is a negative control that preserves only the JavaScript candidate', async () => {
    const { wxml, wxss, js } = await buildCase(CASES.tailwind4Broken)

    expectGeneratedClasses(wxml, wxss)
    expect(js).toContain('gap-[17px]')
    expect(js).not.toContain('gap-_b17px_B')
  }, 120_000)
})
