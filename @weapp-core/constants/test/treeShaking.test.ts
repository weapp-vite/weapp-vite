import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { rolldown } from 'rolldown'
import { beforeAll, describe, expect, it } from 'vitest'
import { WEB_RUNTIME_GLOBAL_TARGETS, WEVU_SETUP_STATE_KEY } from '../src'

let packageSource: string

beforeAll(async () => {
  // 先复现发布包的单文件边界，再验证下游打包，避免源码模块拆分掩盖顶层副作用。
  const bundle = await rolldown({
    input: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    tsconfig: false,
  })
  try {
    const result = await bundle.generate({ format: 'esm' })
    expect(result.output).toHaveLength(1)
    const chunk = result.output[0]!
    if (chunk.type !== 'chunk') {
      throw new Error('Missing constants package bundle')
    }
    packageSource = chunk.code
  }
  finally {
    await bundle.close()
  }
})

describe('published constants tree-shaking', () => {
  it.each([false, true])('omits Web Runtime metadata from an unrelated import (minify=%s)', async (minify) => {
    const result = await build({
      stdin: {
        contents: 'import { WEVU_SETUP_STATE_KEY } from "@weapp-core/constants"; globalThis.marker = WEVU_SETUP_STATE_KEY',
      },
      plugins: [{
        name: 'published-constants',
        setup(build) {
          build.onResolve({ filter: /^@weapp-core\/constants$/ }, () => ({
            path: 'index.js',
            namespace: 'published-constants',
          }))
          build.onLoad({ filter: /.*/, namespace: 'published-constants' }, () => ({ contents: packageSource }))
        },
      }],
      bundle: true,
      format: 'iife',
      platform: 'neutral',
      minify,
      write: false,
    })
    const code = result.outputFiles[0]!.text
    const context: { marker?: string } = {}
    runInNewContext(code, context)
    expect(context.marker).toBe(WEVU_SETUP_STATE_KEY)
    for (const target of WEB_RUNTIME_GLOBAL_TARGETS) {
      expect(code).not.toContain(target)
    }
  })
})
