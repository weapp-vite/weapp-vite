import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  injectReactTemplateMarker,
  isReactTemplateSource,
  parseStatefulHmrControlSource,
  resolveHmrScriptOutputPath,
  resolveReactTemplateOutputPath,
  resolveWorkspaceHmrRuntime,
} from './workspace-hmr/scenarios'

describe('workspace HMR script output', () => {
  it('detects the runtime from the stateful control artifact', () => {
    expect(resolveWorkspaceHmrRuntime(true)).toBe('stateful')
    expect(resolveWorkspaceHmrRuntime(false)).toBe('standard')
  })

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

  it('maps a React view owner to its page WXML output', () => {
    const project = {
      distRoot: path.join('project', 'dist'),
      sourceRoot: path.join('project', 'src'),
    }
    const sourcePath = path.join('project', 'src', 'pages', 'index', 'view.tsx')

    expect(isReactTemplateSource(sourcePath)).toBe(true)
    expect(resolveReactTemplateOutputPath(project, sourcePath)).toBe(
      path.join('project', 'dist', 'pages', 'index', 'index.wxml'),
    )
    expect(injectReactTemplateMarker(
      'export function View() { return <View className="page">hello</View> }',
      'HMR_MARKER',
    )).toContain('<View className="page" data-hmr-marker="HMR_MARKER">')
  })
})
