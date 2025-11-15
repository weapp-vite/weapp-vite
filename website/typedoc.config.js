/**
 * @type {import('typedoc').TypeDocOptions}
 */
export default {
  plugin: [
    'typedoc-plugin-markdown',
    'typedoc-vitepress-theme',
  ],
  // reduce console noise in website dev
  logLevel: 'Error',
  docsRoot: './',
  out: './api',
  entryPoints: [
    '../packages/weapp-vite/src/exports.type.ts',
  ],
  tsconfig: '../packages/weapp-vite/tsconfig.doc.json',
  readme: 'none',
  lang: 'zh',
}
