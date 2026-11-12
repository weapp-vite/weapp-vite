import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterEach, expect, it, vi } from 'vitest'
import { verifyReactTemplateHmr } from './reactTemplate.mjs'
import { assertConsumerClassicOutput } from './startupClassic.mjs'

const roots: string[] = []
const original = '<view>weapp-vite React static bindings</view>'
const fallback = '[weapp-vite] HMR fallback {"from":"stateful-experimental","to":"classic","reason":"patch-shape","message":"React static template","requested":"stateful-experimental","actual":"classic","phase":"switching"}\n'
const ready = '[weapp-vite] HMR classic ready {"reason":"patch-shape","requested":"stateful-experimental","actual":"classic","phase":"classic"}\n'

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(operation: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consumer-react-template-'))
  roots.push(root)
  await mkdir(path.join(root, 'src/pages/static'), { recursive: true })
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await writeFile(path.join(root, 'dist/app.js'), 'App({})')
  await writeFile(path.join(root, 'project.private.config.json'), '{"setting":{"compileHotReLoad":false}}')
  await writeFile(path.join(root, 'config-calls.txt'), operation === 'stateful-dev' ? 'loaded\nloaded\n' : 'loaded\n')
  const state = { output: operation === 'stateful-dev' ? fallback : '' }
  const sources: string[] = []
  return {
    root,
    operation,
    original,
    state,
    sources,
    readOutput: () => state.output,
    waitForOutput: vi.fn(async (file: string, label: string) => {
      expect(file).toBe('pages/static/index.wxml')
      const source = await readFile(path.join(root, 'src/pages/static/view.tsx'), 'utf8')
      expect(source).toContain(label)
      sources.push(source)
    }),
    waitForWatchRound: vi.fn(async () => {}),
    waitForClassicReady: vi.fn(async () => {
      // 文件先可见；原生完整发布回执稍后才到，断言必须等到它完成。
      await Promise.resolve()
      state.output += state.output.includes(ready) ? '' : ready
    }),
  }
}

it.each(['dev', 'build-watch', 'stateful-dev'])('verifies React static update and restoration with the required %s handoff', async (operation) => {
  const evidence = await fixture(operation)
  await verifyReactTemplateHmr(evidence)
  expect(evidence.sources).toEqual(['<view>React host updated template</view>', original])
  expect(evidence.waitForClassicReady).toHaveBeenCalledTimes(operation === 'stateful-dev' ? 2 : 0)
  expect(await readFile(path.join(evidence.root, 'src/pages/static/view.tsx'), 'utf8')).toBe(original)
  await assertConsumerClassicOutput(evidence.root)
})

it('checks each live update without scanning a rebuilding directory, then rejects stale stateful code in final output', async () => {
  const evidence = await fixture('build-watch')
  evidence.waitForWatchRound.mockImplementation(async () => {
    // 模板已可见时，另一轮原生构建仍可能正在清空并重写 JS。
    await rm(path.join(evidence.root, 'dist'), { recursive: true, force: true })
  })
  await verifyReactTemplateHmr(evidence)
  expect(evidence.sources).toHaveLength(2)
  // 同一宿主关闭回执之后才读取最终文件；不能把缺失文件当成已验证。
  await expect(assertConsumerClassicOutput(evidence.root)).rejects.toMatchObject({ code: 'ENOENT' })
  await mkdir(path.join(evidence.root, 'dist/vendor'), { recursive: true })
  const script = path.join(evidence.root, 'dist/vendor/runtime.js')
  await writeFile(script, `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}] = {}`)
  await expect(assertConsumerClassicOutput(evidence.root)).rejects.toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY}`)
  await writeFile(script, 'App({})')
  await assertConsumerClassicOutput(evidence.root)
})

it.each(['wrong-reason', 'duplicate-handoff', 'extra-config-reload', 'publication-error'])('rejects %s instead of accepting arbitrary classic output', async (failure) => {
  const evidence = await fixture('stateful-dev')
  if (failure === 'wrong-reason') {
    evidence.state.output = fallback.replace('patch-shape', 'stylesheet-output')
  }
  else if (failure === 'duplicate-handoff') {
    evidence.state.output = fallback.repeat(2)
  }
  else if (failure === 'extra-config-reload') {
    await writeFile(path.join(evidence.root, 'config-calls.txt'), 'loaded\nloaded\nloaded\n')
  }
  else {
    evidence.state.output += 'classic HMR 切换失败\n'
  }
  await expect(verifyReactTemplateHmr(evidence)).rejects.toThrow()
})
