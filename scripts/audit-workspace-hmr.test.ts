import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseStatefulHmrControlSource, resolveHmrScriptOutputPath } from './workspace-hmr/scenarios'

describe('workspace HMR script output', () => {
  it('parses the generated stateful control assignment', () => {
    expect(parseStatefulHmrControlSource(
      'globalThis["__CONTROL__"] = {"buildId":"build-a","token":"token-a","url":"http://127.0.0.1:3000/hmr"};\n',
    )).toEqual({
      buildId: 'build-a',
      token: 'token-a',
      url: 'http://127.0.0.1:3000/hmr',
    })
  })

  it('uses the stateful delta artifact for script scenarios', () => {
    expect(resolveHmrScriptOutputPath({
      distRoot: path.join('project', 'dist'),
      hmrRuntime: 'stateful',
      sourceRoot: path.join('project', 'src'),
    }, path.join('project', 'src', 'pages', 'index.ts'))).toBe(
      path.join('project', 'dist', '__weapp_vite_hmr', 'update.js'),
    )
  })

  it('keeps the entry output for standard script scenarios', () => {
    expect(resolveHmrScriptOutputPath({
      distRoot: path.join('project', 'dist'),
      hmrRuntime: 'standard',
      sourceRoot: path.join('project', 'src'),
    }, path.join('project', 'src', 'pages', 'index.ts'))).toBe(
      path.join('project', 'dist', 'pages', 'index.js'),
    )
  })
})
