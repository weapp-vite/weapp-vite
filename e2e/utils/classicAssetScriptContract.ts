import type { RuntimePlatform } from './hmr-helpers'
import { readdir, readFile, stat } from 'node:fs/promises'
import { WEAPP_VITE_CLASSIC_GENERATION_MARKER } from '@weapp-core/constants'
import path from 'pathe'
import { expect } from 'vitest'

interface ScriptSnapshot {
  source: string
  mtimeMs: number
}

async function readScripts(distRoot: string): Promise<Map<string, ScriptSnapshot>> {
  const files = (await readdir(distRoot, { recursive: true }))
    .map(file => file.replaceAll('\\', '/'))
    .filter(file => file.endsWith('.js'))
    .sort()
  return new Map(await Promise.all(files.map(async (file) => {
    const absolute = path.join(distRoot, file)
    const [source, info] = await Promise.all([readFile(absolute, 'utf8'), stat(absolute)])
    return [file, { source, mtimeMs: info.mtimeMs }] as const
  })))
}

function classicApp(source: string) {
  expect(source.split(WEAPP_VITE_CLASSIC_GENERATION_MARKER), 'app.js must contain exactly one classic generation marker').toHaveLength(2)
  const pattern = new RegExp(`;void "${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:([a-f0-9]{64})";`, 'g')
  const matches = [...source.matchAll(pattern)]
  expect(matches, 'app.js must contain one valid 64-hex classic generation statement').toHaveLength(1)
  return { generation: matches[0][1], source: source.replace(matches[0][0], '') }
}

/** 资产更新仅允许微信 classic 根入口的唯一发布标记变化，其余脚本内容和写入时间保持不变。 */
export async function createClassicAssetScriptContract(distRoot: string, platform: RuntimePlatform) {
  const baseline = await readScripts(distRoot)
  expect(baseline.has('app.js'), 'classic build must publish app.js').toBe(true)
  let previousApp = baseline.get('app.js')!
  const originalApp = platform === 'weapp' ? classicApp(previousApp.source) : undefined
  if (platform !== 'weapp') {
    expect(previousApp.source).not.toContain(WEAPP_VITE_CLASSIC_GENERATION_MARKER)
  }
  return {
    async assertUpdated() {
      const current = await readScripts(distRoot)
      expect([...current.keys()], 'asset updates must preserve the complete script output set').toEqual([...baseline.keys()])
      for (const [file, original] of baseline) {
        const output = current.get(file)!
        if (file === 'app.js' && originalApp) {
          const next = classicApp(output.source)
          expect(next.source, 'app.js bytes outside the classic marker must remain unchanged').toBe(originalApp.source)
          expect(next.generation, 'each asset publication must update the classic generation').not.toBe(classicApp(previousApp.source).generation)
          expect(output.mtimeMs, 'the changed app.js must be written by the bundler').toBeGreaterThan(previousApp.mtimeMs)
          previousApp = output
        }
        else {
          expect(output, `${file} content and mtime must remain unchanged`).toEqual(original)
        }
      }
    },
  }
}
