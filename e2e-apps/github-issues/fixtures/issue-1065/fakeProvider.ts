import type { WeappCompilerPlugin } from 'weapp-vite'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'

/** 模拟独立第三方 provider，只通过公开协议访问 host。 */
export function fakeProvider(name = 'fixture-provider'): WeappCompilerPlugin {
  return {
    name,
    capabilities: { style: true, template: true, script: true, bundle: true, hmr: true },
    create(context) {
      const tokens = path.join(context.srcRoot, 'provider.tokens.json')
      const log = (event: string) => appendFile(path.join(context.root, 'provider-events.jsonl'), `${JSON.stringify({ provider: name, event })}\n`)
      const color = async () => (JSON.parse(await context.readFile(tokens)) as { color: string }).color
      return {
        async prepareHmr(request) {
          const source = request.sources.get(tokens.replaceAll('\\', '/'))
          if (!source) {
            throw new Error('Provider dependency missing from frozen HMR sources')
          }
          const token = JSON.parse(source) as { color: string }
          await log('prepare')
          return {
            assets: [{ fileName: 'pages/home/index.wxss', code: `.provider-page { color: ${token.color}; }` }],
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
        async transformCss({ code }) {
          await log('css')
          return { code: `${code}\n.provider-finalized { opacity: 1; }`, dependencies: [tokens] }
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
