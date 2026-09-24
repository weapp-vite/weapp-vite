import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => ({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: false,
    compilerPlugins: mode.includes('validate') ? [{
      name: 'validation-fixture',
      phase: 'output',
      capabilities: { template: true },
      create: () => ({ transformTemplate: ({ code }) => ({ code: `${code}<!-- output-plugin -->` }) }),
    }] : [],
    wxml: {
      validate: mode.includes('validate') ? async (code, ctx) => {
        ctx.addWatchFile('validation-rules.json')
        const rules = JSON.parse(await readFile(resolve(ctx.root, 'validation-rules.json'), 'utf8')) as { reject?: string }
        if (!code.includes('<!-- output-plugin -->')) {
          ctx.report({ severity: 'error', message: 'output plugin must run before validation' })
        }
        if (rules.reject && ctx.fileName.startsWith(rules.reject)) {
          ctx.report({ severity: 'error', code: 'fixture-reject', message: 'validation fixture rejected' })
        }
        await ctx.walk((node) => {
          if (node.tagName === 'view' && node.hasAttribute('data-analytics') && !node.hasAttribute('data-rule')) {
            ctx.report({ severity: 'error', message: 'missing transformed attribute', location: node.location })
          }
        })
      } : undefined,
      transform: mode.startsWith('transform') ? [
        async (code, ctx) => {
          ctx.addWatchFile('transform-rules.json')
          const rules = JSON.parse(await readFile(resolve(ctx.root, 'transform-rules.json'), 'utf8')) as { label: string }
          return ctx.edit(code, async (node) => {
            if (node.tagName === 'view') {
              node.renameAttribute('data-testid', 'data-analytics')
              node.setAttribute('data-rule', rules.label)
              node.setAttribute('data-scope', ctx.subPackageRoot ?? 'main')
              node.setAttribute('data-output', ctx.fileName)
            }
            if (node.tagName === 'text' && node.hasAttribute('data-testid')) {
              node.renameTag('view')
              node.setAttribute('data-transformed', true)
            }
          })
        },
        code => `${code}<!-- transform-once -->`,
      ] : undefined,
      remove: mode === 'precise' ? { attr: [{ tag: 'view', name: 'data-testid' }] }
        : mode === 'legacy' ? undefined
          : mode === 'custom' ? { attr: [{ tag: ['view', 'text'], name: ['data-debug-*'] }], tag: ['debug-panel', 'dev-only-*'] }
            : mode === 'empty' ? { attr: [], tag: [], comment: false }
              : mode === 'comments' ? { attr: [], comment: true }
                : mode === 'unsafe' ? { tag: ['branch-debug'] }
                  : mode === 'framework' ? { tag: ['include'] }
                    : mode === 'runtime' ? { attr: ['*'], comment: true }
                      : mode === 'production',
    },
    vue: { template: { htmlTagToWxml: true, formatWxml: false } },
  },
  build: { minify: false },
}))
