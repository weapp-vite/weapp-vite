import type { OutputAsset, OutputChunk } from 'rolldown'
import { readFile, writeFile } from 'node:fs/promises'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { expect, it } from 'vitest'
import { fixture, observations } from './snapshotGeneration/fixture'

const observed = observations()

it.each([false, true, 'inline', 'hidden'] as const)('reuses one frozen Tailwind generation in an independent delivery snapshot (sourcemap=%s)', async (sourcemap) => {
  const app = await fixture(sourcemap)
  const captured = await app.capture('updated')
  const compiled = await app.compile(captured)
  const outputs = compiled.snapshot!.output
  const css = outputs.find(output => output.fileName === 'app.wxss') as OutputAsset
  const template = outputs.find(output => output.fileName === 'pages/index/index.wxml') as OutputAsset
  const script = outputs.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
  const className = /class="([^"]+)"/.exec(String(template.source))?.[1]
  expect(className).toBeDefined()
  expect(className).not.toContain('[')
  expect(String(css.source)).toContain(`.${className}`)
  expect(String(css.source)).toMatch(/width:\s*37px/)
  expect(script.code).toContain(className)
  expect(JSON.parse(String((outputs.find(output => output.fileName === 'app.json') as OutputAsset).source)) as unknown).toMatchObject({ navigationBarTitleText: 'updated' })
  expect(observed.instances).toHaveLength(2)
  expect(observed.instances[0]!.requests).toHaveLength(2)
  expect(observed.instances[1]!.requests).toHaveLength(0)
  expect(observed.instances[0]!.disposed).toBe(false)
  expect(observed.instances[1]!.disposed).toBe(true)
  const fresh = await app.snapshot(captured.input.sources)
  const freshScript = fresh.output.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
  expect(script.code).toBe(freshScript.code)
  expect(script.map?.toString()).toBe(freshScript.map?.toString())
  expect(observed.instances[2]!.requests).toHaveLength(1)
  if (sourcemap) {
    expect(script.map).toBeDefined()
    const prefix = script.code.slice(0, script.code.indexOf(className!))
    const lines = prefix.split('\n')
    const position = originalPositionFor(new TraceMap(script.map!), { line: lines.length, column: lines.at(-1)!.length })
    expect(position.source).toMatch(/pages\/index\/index\.ts$/)
    expect(position.line).toBe(1)
    expect(position.column).toBe(24)
  }
  else {
    expect(script.map).toBeNull()
  }
  await compiled.dispose()
})

it('keeps separate edit and restore generations and releases the view before ordinary builds', async () => {
  const app = await fixture()
  const edit = await app.prepare('updated')
  await edit.dispose()
  const restore = await app.prepare('initial')
  const restoredApp = restore.snapshot!.output.find(output => output.fileName === 'app.json') as OutputAsset
  expect(JSON.parse(String(restoredApp.source)) as unknown).toMatchObject({ navigationBarTitleText: 'initial' })
  expect(observed.instances.slice(1).map(instance => instance.requests.length)).toEqual([0, 0])
  await restore.dispose()
  await app.snapshot()
  expect(observed.instances.at(-1)!.requests).toHaveLength(1)
  expect(observed.instances.at(-1)!.disposed).toBe(true)
})

it('composes fresh output maps on each build when output sourcemap settings change', async () => {
  const app = await fixture()
  for (const sourcemap of [true, false, 'hidden', 'inline'] as const) {
    const captured = await app.capture(String(sourcemap))
    const configure = (options: import('vite').InlineConfig) => ({ ...options, build: { ...options.build, sourcemap } })
    const compiled = await app.compile(captured, configure)
    expect(observed.instances.at(-1)!.requests).toHaveLength(0)
    const script = compiled.snapshot!.output.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
    const fresh = await app.snapshot(captured.input.sources, configure)
    const freshScript = fresh.output.find(output => output.fileName === 'pages/index/index.js') as OutputChunk
    expect(script.code).toBe(freshScript.code)
    expect(script.map?.toString()).toBe(freshScript.map?.toString())
    expect(Boolean(script.map)).toBe(Boolean(sourcemap))
    await compiled.dispose()
  }
})

it('keeps the ordinary generation path when raw CSS input changes', async () => {
  const app = await fixture()
  const css = `${await readFile(app.entry, 'utf8')}\n.changed-author { height: 53px; }`
  await writeFile(app.entry, css)
  app.host.capture(app.entry, css)
  const captured = await app.capture('changed-css')
  const compiled = await app.compile(captured)
  expect(observed.instances[1]!.requests).toHaveLength(1)
  const stylesheet = compiled.snapshot!.output.find(output => output.fileName === 'app.wxss') as OutputAsset
  expect(String(stylesheet.source)).toContain('53px')
  const fresh = await app.snapshot(captured.input.sources)
  const freshStyle = fresh.output.find(output => output.fileName === 'app.wxss') as OutputAsset
  expect(String(stylesheet.source)).toBe(String(freshStyle.source))
  await compiled.dispose()
})
