import type { EditAction, EditSequence } from './driver'

const home = 'src/pages/home/index'
function app(root = 'package-a', extra = true) {
  return JSON.stringify({
    pages: extra ? ['pages/home/index', 'pages/secondary/index'] : ['pages/home/index'],
    ...(extra ? { subPackages: [{ root, pages: ['pages/detail/index'] }] } : {}),
  })
}
function pageFiles(entry: string) {
  return {
    [`${entry}.js`]: 'import { value } from "../../shared.js"; Page({ data: { value } })',
    [`${entry}.wxml`]: '<view id="mode-value">{{value}}</view>',
    [`${entry}.wxss`]: 'view { color: red; }',
    [`${entry}.json`]: '{}',
  }
}

/** 模式、拓扑与缓存动作沿用同一编辑 driver；每步比较完整生产磁盘集合与独立进程基线。 */
export function createWeappModeSequence(emptyOutDir: boolean): EditSequence {
  const configuration = (pipeline: string[], restoreInitialCache = false) => ({ kind: 'config', file: 'sequence.config.json', content: JSON.stringify({ pipeline, emptyOutDir, restoreInitialCache }) } as const)
  const write = (file: string, content: string): Extract<EditAction, { kind: 'write' }> => ({ kind: 'write', file, content })
  return {
    name: `weapp-mode-cache-equivalence-empty-${emptyOutDir}`,
    files: {
      'package.json': '{"name":"weapp-mode-sequence","type":"module"}',
      'project.config.json': '{"miniprogramRoot":"dist","appid":"wxb3d842a4a7e3440d"}',
      'project.private.config.json': JSON.stringify({ condition: { miniprogram: { list: ['pages/home/index', 'pages/secondary/index', 'package-a/pages/detail/index', 'package-b/pages/detail/index'].map(pathName => ({ name: pathName, pathName, query: '' })) } } }),
      'sequence.config.json': configuration(['production']).content,
      'src/app.js': 'App({})',
      'src/app.json': app(),
      'src/shared.js': 'export const value = "main-shared"',
      'src/package-a/shared.js': 'export const value = "subpackage-shared"',
      ...pageFiles(home),
      ...pageFiles('src/pages/secondary/index'),
      ...pageFiles('src/package-a/pages/detail/index'),
      'src/components/card/index.js': 'Component({ data: { title: "shared-card" } })',
      'src/components/card/index.json': '{"component":true}',
      'src/components/card/index.wxml': '<view>{{title}}</view>',
      'src/components/card/index.wxss': 'view { color: blue; }',
      [`${home}.json`]: '{"usingComponents":{"mini-card":"/components/card/index"}}',
      [`${home}.wxml`]: '<view id="mode-value">{{value}}</view><mini-card id="mode-card" />',
    },
    steps: [
      { name: 'production to dev to production', action: configuration(['production', 'dev', 'production']) },
      { name: 'dev to production with changed shared chunk', action: { kind: 'rapid', saves: [configuration(['dev', 'production']), write('src/shared.js', 'export const value = "changed-main"; console.log("shared-side-effect")')] } },
      { name: 'move a used component', action: { kind: 'rapid', saves: [
        ...['js', 'wxml', 'wxss', 'json'].map(extension => ({ kind: 'rename', file: `src/components/card/index.${extension}`, to: `src/components/moved/index.${extension}` } as const)),
        write(`${home}.json`, '{"usingComponents":{"mini-card":"/components/moved/index"}}'),
      ] } },
      { name: 'remove the moved component', action: { kind: 'rapid', saves: [
        ...['js', 'wxml', 'wxss', 'json'].map(extension => ({ kind: 'delete', file: `src/components/moved/index.${extension}` } as const)),
        write(`${home}.json`, '{}'),
        write(`${home}.wxml`, '<view id="mode-value">{{value}}</view>'),
      ] } },
      { name: 'move subpackage and its page', action: { kind: 'rapid', saves: [
        ...['js', 'wxml', 'wxss', 'json'].map(extension => ({ kind: 'rename', file: `src/package-a/pages/detail/index.${extension}`, to: `src/package-b/pages/detail/index.${extension}` } as const)),
        { kind: 'rename', file: 'src/package-a/shared.js', to: 'src/package-b/shared.js' },
        write('src/app.json', app('package-b')),
      ] } },
      { name: 'remove subpackage and chunk dependency', action: { kind: 'rapid', saves: [
        ...['js', 'wxml', 'wxss', 'json'].map(extension => ({ kind: 'delete', file: `src/package-b/pages/detail/index.${extension}` } as const)),
        ...['js', 'wxml', 'wxss', 'json'].map(extension => ({ kind: 'delete', file: `src/pages/secondary/index.${extension}` } as const)),
        { kind: 'delete', file: 'src/package-b/shared.js' },
        write('src/app.json', app('package-b', false)),
        write(`${home}.js`, 'Page({ data: { value: "inline-after-removal" } })'),
      ] } },
      { name: 'restore old production cache before rebuilding changed topology', action: configuration(['production'], true) },
    ],
  }
}
