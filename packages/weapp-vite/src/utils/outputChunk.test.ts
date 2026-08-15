import type { OutputChunk } from 'rolldown'
import { Buffer } from 'node:buffer'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import {
  appendOutputChunkCode,
  applyOutputChunkTransform,
  prependOutputChunkCode,
  replaceOutputChunkCode,
  syncOutputChunkSourceMapAssets,
} from './outputChunk'

function createMappedChunk(code: string, source: string) {
  return {
    type: 'chunk',
    fileName: 'pages/probe/index.js',
    code,
    map: new MagicString(code).generateMap({
      hires: true,
      includeContent: true,
      source,
    }),
  } as OutputChunk
}

function createInlineMappedChunk(code: string, source: string) {
  const map = new MagicString(code).generateMap({
    hires: true,
    includeContent: true,
    source,
  })
  const payload = Buffer.from(JSON.stringify(map)).toString('base64')
  return {
    ...createMappedChunk(code, source),
    code: `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${payload}`,
    map: null,
  } as OutputChunk
}

function readInlineSourceMap(code: string) {
  const marker = 'base64,'
  const markerIndex = code.lastIndexOf(marker)
  expect(markerIndex).toBeGreaterThanOrEqual(0)
  return JSON.parse(Buffer.from(code.slice(markerIndex + marker.length), 'base64').toString('utf8'))
}

function findGeneratedPosition(code: string, marker: string) {
  const index = code.indexOf(marker)
  expect(index).toBeGreaterThanOrEqual(0)
  const prefix = code.slice(0, index)
  const lines = prefix.split('\n')
  return {
    column: lines[lines.length - 1]?.length ?? 0,
    line: lines.length,
  }
}

async function collectTypeScriptFiles(target: string): Promise<string[]> {
  const entries = await readdir(target, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const resolved = path.join(target, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectTypeScriptFiles(resolved))
    }
    else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(resolved)
    }
  }
  return files
}

describe('output chunk code rewrite', () => {
  it('preserves original mappings through prepend, replace, append, and a second transform', () => {
    const source = 'src/pages/probe/index.ts'
    const originalCode = [
      'const baseUrl = getBaseUrl()',
      'const requestUrl = baseUrl + "/get"',
      'const response = await fetch(requestUrl)',
      'Page({ response })',
    ].join('\n')
    const chunk = createMappedChunk(originalCode, source)

    prependOutputChunkCode(chunk, 'const injected = true\n')
    replaceOutputChunkCode(chunk, /fetch\(requestUrl\)/, () => 'globalThis.fetch(requestUrl)')
    appendOutputChunkCode(chunk, '\nvoid injected')

    const platformRewrite = new MagicString(chunk.code)
    platformRewrite.prepend('const platform = "weapp"\n')
    applyOutputChunkTransform(
      chunk,
      platformRewrite.toString(),
      platformRewrite.generateMap({
        hires: true,
        includeContent: true,
        source: chunk.fileName,
      }) as any,
    )

    const traceMap = new TraceMap(chunk.map as any)
    for (const [marker, expectedLine] of [
      ['const baseUrl', 1],
      ['const requestUrl', 2],
      ['globalThis.fetch', 3],
      ['Page({', 4],
    ] as const) {
      const originalPosition = originalPositionFor(traceMap, findGeneratedPosition(chunk.code, marker))
      expect(originalPosition.source).toBe(source)
      expect(originalPosition.line).toBe(expectedLine)
    }
  })

  it('commits generateBundle map rewrites to the managed sourcemap asset', () => {
    const source = 'src/pages/probe/index.ts'
    const originalCode = 'Page({ data: { ready: true } })'
    const chunk = createMappedChunk(originalCode, source)
    const bundle = {
      [chunk.fileName]: chunk,
      [`${chunk.fileName}.map`]: {
        type: 'asset',
        fileName: `${chunk.fileName}.map`,
        source: JSON.stringify(chunk.map),
      },
    } as any

    prependOutputChunkCode(chunk, 'const injected = true\n')
    syncOutputChunkSourceMapAssets(bundle)

    const writtenMap = JSON.parse(bundle[`${chunk.fileName}.map`].source)
    const originalPosition = originalPositionFor(
      new TraceMap(writtenMap),
      findGeneratedPosition(chunk.code, 'Page({'),
    )
    expect(originalPosition.source).toBe(source)
    expect(originalPosition.line).toBe(1)
  })

  it('treats inline sourcemaps as metadata across repeated chunk rewrites', () => {
    const source = 'src/pages/inline/index.ts'
    const originalCode = [
      'const baseUrl = getBaseUrl()',
      'const requestUrl = baseUrl + "/get"',
      'const response = await fetch(requestUrl)',
      'Page({ response })',
    ].join('\n')
    const chunk = createInlineMappedChunk(originalCode, source)

    prependOutputChunkCode(chunk, 'const injected = true\n')
    replaceOutputChunkCode(chunk, /fetch\(requestUrl\)/, () => 'globalThis.fetch(requestUrl)')
    appendOutputChunkCode(chunk, '\nvoid injected')

    expect(chunk.code.match(/sourceMappingURL=data:/g)).toHaveLength(1)
    const traceMap = new TraceMap(readInlineSourceMap(chunk.code))
    for (const [marker, expectedLine] of [
      ['const baseUrl', 1],
      ['const requestUrl', 2],
      ['globalThis.fetch', 3],
      ['Page({', 4],
    ] as const) {
      const originalPosition = originalPositionFor(traceMap, findGeneratedPosition(chunk.code, marker))
      expect(originalPosition.source).toBe(source)
      expect(originalPosition.line).toBe(expectedLine)
    }
  })

  it('forbids generateBundle code writes outside the shared rewrite boundary', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const targets = [
      path.join(packageRoot, 'plugins/core/lifecycle/emit'),
      path.join(packageRoot, 'plugins/core/helpers/bundle.ts'),
      path.join(packageRoot, 'plugins/asset.ts'),
      path.join(packageRoot, 'runtime/chunkStrategy'),
    ]
    const files = (
      await Promise.all(targets.map(async (target) => {
        return target.endsWith('.ts') ? [target] : collectTypeScriptFiles(target)
      }))
    ).flat()
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const [index, line] of source.split('\n').entries()) {
        if (/\.code\s*=(?!=)/.test(line)) {
          violations.push(`${path.relative(packageRoot, file)}:${index + 1}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
