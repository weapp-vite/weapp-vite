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
  out: './wevu/api',
  entryPoints: [
    '../packages/wevu/src/index.ts',
    '../packages/wevu/src/compiler/index.ts',
  ],
  tsconfig: '../packages/wevu/tsconfig.doc.json',
  readme: 'none',
  lang: 'zh',
}
