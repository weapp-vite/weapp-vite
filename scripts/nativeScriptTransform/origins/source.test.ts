import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import { transformSync } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { inlineOriginsGlobalKey, inlineOriginTargets } from './source'

const repository = new URL('../../../', import.meta.url)

describe('inline origins diagnostic loader boundaries', () => {
  it.each(inlineOriginTargets)('owns the same call in raw, stripped and tsx-style compact $target', ({ target, instrument }) => {
    const raw = readFileSync(new URL(target, repository), 'utf8')
    for (const source of [raw, stripTypeScriptTypes(raw, { mode: 'strip' }), transformSync(raw, { loader: 'ts', format: 'esm', minifyWhitespace: true, keepNames: true }).code]) {
      const result = instrument(source)
      expect(result).toContain(inlineOriginsGlobalKey)
      expect(() => parse(result, { sourceType: 'module', plugins: ['typescript'] })).not.toThrow()
      expect(() => instrument(source + source)).toThrow('anchor changed')
      expect(() => instrument(result)).toThrow('anchor changed')
    }
    expect(() => instrument('changed owner')).toThrow('anchor changed')
  })

  it.each(inlineOriginTargets.map((value, index) => ({ ...value, index })))('rejects moved or shadowed owners and changed arguments in $target', ({ target, instrument, index }) => {
    const raw = readFileSync(new URL(target, repository), 'utf8')
    const functions = ['compileTemplatePhase', 'transformOnDirective', 'registerInlineExpression']
    expect(() => instrument(raw.replace(`function ${functions[index]}(`, `function changedOwner(`))).toThrow('anchor changed')
    expect(() => instrument(`const globalThis = {};\n${raw}`)).toThrow('anchor changed')
    const changed = index === 0
      ? raw.replace('descriptor.template.content,\n    filename,', 'descriptor.template.content,\n    source,')
      : index === 1
        ? raw.replace('registerInlineExpression(inlineSource, context)', 'registerInlineExpression(context, inlineSource)')
        : raw.replace('parseBabelExpressionFile(exp)', 'parseBabelExpressionFile(context)')
    expect(() => instrument(changed)).toThrow('anchor changed')
  })

  it('composes all three hooks with a later synthetic source owner and leaves compiler resources unchanged', () => {
    const targets = inlineOriginTargets.map(({ target }) => new URL(target, repository).href)
    const sources = [
      `function compileVueTemplateToWxml(content, filename, options) { return options.render(content, filename); }
       export function compileTemplatePhase(descriptor, filename, source, templateResolvedId, options, result, bindingManifestSourceFile) {
         const templateCompiled = compileVueTemplateToWxml(
    descriptor.template.content,
    filename,
    options,
  )
         return templateCompiled;
       }`,
      `let invoke;
       function registerInlineExpression(source, context) { return invoke(source, context); }
       export function configure(value) { invoke = value; }
       export function transformOnDirective(node, context, options) {
         const inlineSource = options.inlineSource;
         const inlineExpression = inlineSource ? registerInlineExpression(inlineSource, context) : null;
         return inlineExpression;
       }`,
      `function parseBabelExpressionFile(exp) { return { expression: { type: 'CallExpression', start: 1, end: exp.length + 1, callee: { type: 'Identifier', name: 'jump', start: 1, end: 5 } } }; }
       export function registerInlineExpression(exp, context) {
         const parsed = parseBabelExpressionFile(exp)
         const updatedExpressionNode = { type: 'CallExpression', callee: { type: 'MemberExpression', computed: false, object: { type: 'Identifier', name: '_ctx' }, property: { type: 'Identifier', name: 'jump' } } };
         const asset = Object.freeze({ id: 'i7', expression: '_ctx.jump(1)', parameterNames: Object.freeze({ context: '_ctx', scope: '_scope', event: '_event' }) });
         context.inlineExpressions.push(asset)
         return asset;
       }`,
    ]
    const code = `
      import { registerHooks } from 'node:module';
      const { installInlineOrigins } = await import(${JSON.stringify(new URL('./index.ts', import.meta.url).href)});
      const targets = ${JSON.stringify(targets)};
      const sources = ${JSON.stringify(sources)};
      const origins = installInlineOrigins();
      let duplicateRejected = false;
      try { installInlineOrigins(); } catch { duplicateRejected = true; }
      let beforeRejected = false;
      try { origins.assertInstalled(); } catch { beforeRejected = true; }
      let ownerCalls = 0;
      const owner = registerHooks({ load(url, context, nextLoad) {
        const index = targets.indexOf(url);
        if (index !== -1) { ownerCalls++; return { format: 'module', shortCircuit: true, source: sources[index] }; }
        return nextLoad(url, context);
      }});
      try {
        const templateModule = await import(targets[0]);
        const onModule = await import(targets[1]);
        const inlineModule = await import(targets[2]);
        origins.assertInstalled();
        onModule.configure(inlineModule.registerInlineExpression);
        const content = '<view @tap="jump(1)"/>';
        const source = '<template>' + content + '</template>';
        const descriptor = { template: { content, loc: { start: { offset: 10 }, end: { offset: 10 + content.length }, source: content } } };
        const context = { source: content, filename: 'page.vue', inlineExpressions: [] };
        const node = { exp: { content: 'jump(1)', loc: { start: { offset: 12 }, end: { offset: 19 }, source: 'jump(1)' } } };
        const original = templateModule.compileTemplatePhase(descriptor, 'page.vue', source, undefined, { render() { return onModule.transformOnDirective(node, context, { inlineSource: 'jump(1)' }); } });
        const options = Object.freeze({ inlineExpressions: Object.freeze(context.inlineExpressions) });
        const request = origins.requestFor(options);
        const snapshot = origins.snapshot();
        const sameAsset = options.inlineExpressions[0] === original;
        const noExtraFields = Object.keys(original).sort().join(',') === 'expression,id,parameterNames';
        origins.dispose(); origins.dispose();
        let afterRejected = false;
        try { origins.assertInstalled(); } catch { afterRejected = true; }
        console.log(JSON.stringify({ duplicateRejected, beforeRejected, afterRejected, ownerCalls, sameAsset, noExtraFields, request, snapshot, globalRemoved: !Object.hasOwn(globalThis, ${JSON.stringify(inlineOriginsGlobalKey)}) }));
      } finally { origins.dispose(); owner.deregister(); }
    `
    const value: unknown = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: fileURLToPath(repository), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
    expect(value).toMatchObject({ duplicateRejected: true, beforeRejected: true, afterRejected: true, ownerCalls: 3, sameAsset: true, noExtraFields: true, globalRemoved: true, request: { occurrences: [{ inlineId: 'i7', expression: { text: 'jump(1)', start: 22, end: 29 }, callee: { name: 'jump', start: 22, end: 26 } }] }, snapshot: { sourceCount: 1, occurrenceCount: 1, unsupported: [], loaders: inlineOriginTargets.map(({ target }) => ({ target, loadCount: 1, upstreamSha256: expect.stringMatching(/^[a-f\d]{64}$/), instrumentedSha256: expect.stringMatching(/^[a-f\d]{64}$/) })) } })
  })
})
