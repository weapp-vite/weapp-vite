import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { miniProgramRecommended, reactRecommended, wevuRecommended } from './index'

const execute = promisify(execFile)
const vp = fileURLToPath(new URL('../bin/vp', import.meta.resolve('vite-plus')))
const plugin = fileURLToPath(new URL('../dist/plugin.mjs', import.meta.url))
const roots: string[] = []

interface Diagnostic {
  code: string
  severity: string
  filename: string
  message: string
}

async function lint(files: Record<string, string>, framework: boolean | 'react' = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-oxlint-'))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'oxlint-fixture', type: 'module' }))
  const preset = framework === 'react' ? reactRecommended : framework ? wevuRecommended : miniProgramRecommended
  await writeFile(path.join(root, '.oxlintrc.json'), JSON.stringify({
    ...preset,
    jsPlugins: [{ name: 'weapp-vite', specifier: plugin }],
  }))
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  const result = await execute(process.execPath, [vp, 'lint', '-c', '.oxlintrc.json', '--format', 'json', '.'], {
    cwd: root,
    timeout: 20_000,
    env: { ...process.env, NO_COLOR: '1' },
  }).catch((error: unknown) => {
    const failure = error as { code?: unknown, stdout?: unknown, stderr?: unknown }
    if (failure.code !== 1 || typeof failure.stdout !== 'string') {
      throw error
    }
    return { stdout: failure.stdout, stderr: String(failure.stderr ?? '') }
  })
  expect(result.stdout.trim(), result.stderr).not.toBe('')
  const report = JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }
  expect(Array.isArray(report.diagnostics), result.stderr).toBe(true)
  return report.diagnostics.filter(item => item.code.startsWith('weapp-vite') || item.code.startsWith('react') || item.code.startsWith('vue')).map(item => ({
    ...item,
    filename: item.filename.replaceAll('\\', '/'),
  }))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Oxlint mini-program rules through the Vite Plus CLI', () => {
  it('reports unsupported globals, static APIs and proven builtin receivers', async () => {
    const diagnostics = await lint({
      'src/global.ts': 'window.open()\nglobalThis["process"].env\n',
      'src/static.ts': 'Object.fromEntries([])\nglobalThis.Promise.allSettled([])\n',
      'src/receiver.ts': 'const values = [1]; const alias = values; alias.at(0)\n"a".replaceAll("a", "b")\n',
      'src/typed.ts': 'export function read(values: number[]) { return values.flatMap(x => [x]) }\n',
    })
    expect(diagnostics).toHaveLength(7)
    expect(diagnostics.every(item => item.severity === 'error')).toBe(true)
    for (const api of ['window', 'process', 'Object.fromEntries', 'Promise.allSettled', 'Array.prototype.at', 'String.prototype.replaceAll', 'Array.prototype.flatMap']) {
      expect(diagnostics.some(item => item.message.includes(api)), api).toBe(true)
    }
  })

  it('warns on implicit polyfills without flagging imports, shadows or capability probes', async () => {
    const diagnostics = await lint({
      'src/implicit.ts': 'queueMicrotask(() => {})\nglobalThis.fetch("/")\nnew AbortController()\n',
      'src/safe.ts': [
        'import { URL } from "@wevu/web-apis"; new URL("/")',
        'const window = { open() {} }; window.open()',
        'function request(fetch: Function) { return fetch("/") }; request(() => {})',
        'typeof globalThis.fetch; typeof window; type Runtime = typeof globalThis.process',
        'const custom = { at() {}, flatMap() {}, replaceAll() {} }; custom.at(); custom.flatMap(); custom.replaceAll()',
      ].join('\n'),
    })
    expect(diagnostics).toHaveLength(3)
    expect(diagnostics.every(item => item.severity === 'warning')).toBe(true)
    expect(diagnostics.every(item => item.filename === 'src/implicit.ts')).toBe(true)
  })

  it('keeps host-only files, tests, generated files and Web code outside runtime rules', async () => {
    const files = Object.fromEntries([
      'vite.config.ts',
      'scripts/build.ts',
      'src/page.test.ts',
      'src/page.spec.ts',
      'src/page.web.ts',
      'src/server/node.ts',
      'src/generated/page.ts',
      'dist/page.ts',
      'dist-web/page.ts',
      '.weapp-vite/page.ts',
      'miniprogram_npm/page.ts',
    ].map(file => [file, 'window.open(); process.env; queueMicrotask(() => {})']))
    expect(await lint(files)).toEqual([])
  })

  it('checks Vue scripts and React TSX without treating their templates as browser code', async () => {
    const diagnostics = await lint({
      'src/page.vue': '<script setup lang="ts">window.open(); queueMicrotask(() => {})</script><template><view>ready</view></template>',
      'src/view.tsx': 'export const View = () => <view>{document.title}</view>',
    })
    expect(diagnostics).toHaveLength(3)
    expect(diagnostics.filter(item => item.filename === 'src/page.vue')).toHaveLength(2)
    expect(diagnostics).toContainEqual(expect.objectContaining({ filename: 'src/view.tsx', severity: 'error', message: expect.stringContaining('document') }))
  })

  it('enables built-in Vue correctness rules for Wevu scripts', async () => {
    const diagnostics = await lint({
      'src/watch.vue': '<script>export default { watch: { value: () => { console.log(this.value) } } }</script><template><view /></template>',
    }, true)
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: expect.stringContaining('vue') }))
  })

  it('adds Wevu API diagnostics without enabling them for native and React projects', async () => {
    const files = {
      'src/page.ts': 'import { createSSRApp } from "vue"; createSSRApp({})\nimport { useRoute } from "vue-router"; useRoute()\n',
      'src/safe.ts': 'import { ref } from "vue"; ref(1)\nimport type { createSSRApp } from "vue"\n',
    }
    expect(await lint(files)).toEqual([])
    const diagnostics = await lint(files, true)
    expect(diagnostics).toHaveLength(2)
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', message: expect.stringContaining('createSSRApp') }),
      expect.objectContaining({ severity: 'warning', message: expect.stringContaining('useRoute') }),
    ]))
  })

  it('enforces React Hooks and dependencies without enabling browser globals', async () => {
    const diagnostics = await lint({
      'src/view.tsx': 'import { useEffect, useState } from "react"\nexport function View({ active, value }) { if (active) useState(0); useEffect(() => { console.log(value) }, []); return <view>{document.title}</view> }\n',
    }, 'react')
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: expect.stringContaining('rules-of-hooks'), severity: 'error' }),
      expect.objectContaining({ code: expect.stringContaining('exhaustive-deps'), severity: 'warning' }),
      expect.objectContaining({ message: expect.stringContaining('document'), severity: 'error' }),
    ]))
  })
})
