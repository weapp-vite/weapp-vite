import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { installIntegratedTransform, loadIntegratedBinding } from './integrated'
import { integratedMapTarget } from './integratedMap'
import { instrumentIntegratedTransform, integratedGlobalKey } from './integratedSource'
import { inlineOriginsGlobalKey, inlineOriginTargets } from './origins/source'

describe('integrated loader installation and source boundary', () => {
  it('requires explicit mode and binding selection', async () => {
    await expect(installIntegratedTransform({ mode: 'native' })).rejects.toThrow('explicit binding')
    await expect(installIntegratedTransform({ mode: 'control-js', binding: 'unwanted.node' })).rejects.toThrow('without binding')
    await expect(loadIntegratedBinding('relative.node')).rejects.toThrow('absolute experimental')
  })

  it('preserves a missing binary load error for real stage fallback', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'integrated-missing-binding-'))
    try {
      const binding = await loadIntegratedBinding(path.join(directory, 'missing.node'))
      expect(binding.invoke).toBeUndefined()
      expect(binding.loadError).toMatchObject({ name: 'Error', message: expect.stringContaining('ENOENT') })
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('requires an actual observed module load and releases only its own hooks/global', async () => {
    const owner = await installIntegratedTransform({ mode: 'control-js' })
    try {
      expect(() => owner.assertInstalled()).toThrow('fresh process')
      await expect(installIntegratedTransform({ mode: 'control-js' })).rejects.toThrow('already installed')
      expect(owner.snapshot()).toMatchObject({ mode: 'control-js', records: [], loader: { loadCount: 0 } })
    }
    finally {
      owner.dispose()
      owner.dispose()
    }
    expect(Object.hasOwn(globalThis, integratedGlobalKey)).toBe(false)
  })

  it('reports changed global ownership without deleting the foreign owner', async () => {
    const owner = await installIntegratedTransform({ mode: 'control-js' })
    const foreign = {}
    Object.defineProperty(globalThis, integratedGlobalKey, { configurable: true, value: foreign })
    try {
      expect(() => owner.dispose()).toThrow('foreign owner was preserved')
      expect(Object.getOwnPropertyDescriptor(globalThis, integratedGlobalKey)?.value).toBe(foreign)
      owner.dispose()
    }
    finally {
      delete (globalThis as unknown as Record<string, unknown>)[integratedGlobalKey]
    }
  })

  it('releases its integrated owner even when the origin global has been replaced', async () => {
    const owner = await installIntegratedTransform({ mode: 'control-js' })
    const foreign = {}
    Object.defineProperty(globalThis, inlineOriginsGlobalKey, { configurable: true, value: foreign })
    try {
      expect(() => owner.dispose()).toThrow('foreign owner was preserved')
      expect(Object.hasOwn(globalThis, integratedGlobalKey)).toBe(false)
      expect(Object.getOwnPropertyDescriptor(globalThis, inlineOriginsGlobalKey)?.value).toBe(foreign)
      owner.dispose()
    }
    finally {
      delete (globalThis as unknown as Record<string, unknown>)[inlineOriginsGlobalKey]
    }
  })

  it('wraps the real stage return and original warning handler after type stripping', () => {
    const source = stripTypeScriptTypes(readFileSync(new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts', import.meta.url), 'utf8'), { mode: 'strip' })
    const transformed = instrumentIntegratedTransform(source)
    expect(transformed).toContain('.invoke(source, options, () => transformScriptInternal(source, options),')
    expect(transformed).toContain('.warningHandler(resolveWarnHandler(options?.warn))')
    expect(transformed).toContain('measureCompilerStage(\'transformScript\', () =>')
    expect(() => instrumentIntegratedTransform('changed')).toThrow('anchor changed')
    expect(() => instrumentIntegratedTransform(source + source)).toThrow('anchor changed')
    expect(() => instrumentIntegratedTransform(transformed)).toThrow('anchor changed')
  })

  it('wraps a later shortCircuit source owner in an isolated synthetic module', () => {
    const installer = new URL('./integrated.ts', import.meta.url).href
    const target = new URL('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts', import.meta.url).href
    const synthetic = `
      const generate = () => ({code: ''});
      const t = {isExpression: () => false};
      const resolveWarnHandler = warn => warn;
      const measureCompilerStage = (_stage, operation) => operation();
      function transformScriptInternal(source, options) {
        const warn = resolveWarnHandler(options?.warn)
        warn('original warning');
        return {code: source, transformed: false};
      }
      export function transformScript(source, options) {
        return measureCompilerStage('transformScript', () => transformScriptInternal(source, options))
      }
    `
    const support = [
      'import { composeSourceMaps } from \'../../../../utils/sourcemap\'\nexport function map() { return { scriptMap: composeSourceMaps(transformed.map ?? jsxTransformed.map, scriptMap) } }',
      'function compileVueTemplateToWxml() {} export function compileTemplatePhase(descriptor, filename, source, templateResolvedId, options, result, bindingManifestSourceFile) { const templateCompiled = compileVueTemplateToWxml(descriptor.template.content, filename, options); return templateCompiled }',
      'function registerInlineExpression() {} export function transformOnDirective(node, context, options) { const inlineSource = \'value\'; const inlineExpression = true ? registerInlineExpression(inlineSource, context) : null; return inlineExpression }',
      'function parseBabelExpressionFile() {} export function registerInlineExpression(exp, context) { const parsed = parseBabelExpressionFile(exp); const asset = {}; const updatedExpressionNode = null; context.inlineExpressions.push(asset); return asset }',
    ]
    const modules = Object.fromEntries([integratedMapTarget, ...inlineOriginTargets.map(entry => entry.target)].map((filename, index) => [new URL(`../../${filename}`, import.meta.url).href, support[index]]))
    const script = `
      import {registerHooks} from 'node:module';
      const {installIntegratedTransform} = await import(${JSON.stringify(installer)});
      const target = ${JSON.stringify(target)};
      const integrated = await installIntegratedTransform({mode: 'control-js'});
      let loads = 0;
      const modules = ${JSON.stringify(modules)};
      const owner = registerHooks({load(url, context, next) {
        if (Object.hasOwn(modules, url)) return {format:'module', shortCircuit:true, source:modules[url]};
        if (url !== target) return next(url, context);
        loads++;
        return {format:'module', shortCircuit:true, source:${JSON.stringify(synthetic)}};
      }});
      try {
        const {transformScript} = await import(target);
        for (const url of Object.keys(modules)) await import(url);
        integrated.assertInstalled();
        const warnings = [];
        const result = await integrated.run('synthetic', () => transformScript('original', {warn: message => warnings.push(message)}));
        console.log(JSON.stringify({result, warnings, loads, snapshot:integrated.snapshot()}));
      } finally {integrated.dispose(); owner.deregister();}
    `
    const result: unknown = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }))
    expect(result).toMatchObject({
      result: { value: { code: 'original', transformed: false }, records: [{ used: 'control-js', nativeCalls: 0, fallbackCalls: 0, evidenceErrors: [] }] },
      warnings: ['original warning'],
      loads: 1,
      snapshot: { loader: { loadCount: 1, instrumentedSha256: expect.stringMatching(/^[a-f\d]{64}$/) }, mapLoader: { loadCount: 1 }, origins: { loaders: [{ loadCount: 1 }, { loadCount: 1 }, { loadCount: 1 }], requestCalls: 1 } },
    })
  })
})
