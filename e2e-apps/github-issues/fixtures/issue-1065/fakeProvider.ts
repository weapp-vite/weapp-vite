import type { WeappCompilerPlugin } from 'weapp-vite'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'

function finalizeStylesheet(code: string) {
  return `${code}\n.provider-finalized { opacity: 1; }`
}

function compilePageStylesheet(source: string, color: string) {
  return finalizeStylesheet(source.replaceAll('#010203', color))
}

/** 模拟独立第三方 provider，只通过公开协议访问 host。 */
export function fakeProvider(name = 'fixture-provider'): WeappCompilerPlugin {
  return {
    name,
    capabilities: { style: true, template: true, script: true, bundle: true, hmr: true },
    create(context) {
      const tokens = path.join(context.srcRoot, 'provider.tokens.json')
      const pageStylesheet = path.join(context.srcRoot, 'pages/home/index.css')
      const pageStylesheetOutput = 'pages/home/index.wxss'
      const log = (event: string) => appendFile(path.join(context.root, 'provider-events.jsonl'), `${JSON.stringify({ provider: name, event })}\n`)
      const color = async () => (JSON.parse(await context.readFile(tokens)) as { color: string }).color
      return {
        async prepareHmr(request) {
          const source = request.sources.get(tokens.replaceAll('\\', '/'))
          if (!source) {
            throw new Error('Provider dependency missing from frozen HMR sources')
          }
          const token = JSON.parse(source) as { color: string }
          const stylesheet = request.sources.get(pageStylesheet.replaceAll('\\', '/'))
          if (stylesheet == null) {
            throw new Error('Provider stylesheet missing from frozen HMR sources')
          }
          await log('prepare')
          return {
            assets: [{ fileName: pageStylesheetOutput, code: compilePageStylesheet(stylesheet, token.color) }],
            transformJavaScript: ({ code }) => ({ code: code.replaceAll('script-before', 'script-after') }),
            transformTemplate: ({ code }) => ({ code: code.replaceAll('template-before', 'template-after') }),
          }
        },
        buildStart: () => log('buildStart'),
        claimSource: ({ id, kind }) => kind === 'style' && id.includes(context.srcRoot),
        async transformSource({ code }) {
          await log('source')
          return { code: code.replaceAll('#010203', await color()), dependencies: [tokens] }
        },
        async generateBundle(bundle) {
          await log('finalize')
          for (const output of Object.values(bundle)) {
            if (output.type === 'asset' && output.fileName.endsWith('.wxml')) {
              output.source = String(output.source).replaceAll('template-before', 'bundle-before')
            }
          }
        },
        async transformCss({ code, fileName }) {
          await log('css')
          if (fileName.replaceAll('\\', '/') === pageStylesheetOutput) {
            // 此页面由 provider 完整编译，正式输出和 HMR 共用源码到产物的协议。
            return {
              code: compilePageStylesheet(await context.readFile(pageStylesheet), await color()),
              dependencies: [tokens, pageStylesheet],
            }
          }
          return { code: finalizeStylesheet(code), dependencies: [tokens] }
        },
        async transformTemplate({ code }) {
          await log('template')
          return { code: code.replaceAll('bundle-before', 'template-after') }
        },
        async transformJavaScript({ code }) {
          await log('script')
          return { code: code.replaceAll('script-before', 'script-after') }
        },
        async watchChange(id) {
          await log(`watch:${path.relative(context.srcRoot, id).replaceAll('\\', '/')}`)
        },
        closeBundle: () => log('closeBundle'),
        closeWatcher: () => log('closeWatcher'),
        dispose: () => log('dispose'),
      }
    },
  }
}
