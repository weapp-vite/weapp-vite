import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

export const layoutOwnerPages = ['pages/first/index', 'pages/second/index']
export const layoutOwnerSource = 'src/layouts/default/index.ts'
export const layoutOwnerOutput = 'layouts/default/index'
export const layoutOwnerDependencies = [
  { kind: 'script', source: layoutOwnerSource },
  { kind: 'json', source: 'src/layouts/default/index.json' },
  { kind: 'style', source: 'src/layouts/default/index.wxss' },
  { kind: 'template', source: 'src/layouts/default/index.wxml' },
  { kind: 'template', source: 'src/shared/layout-body.wxml' },
  { kind: 'using-component', source: 'src/components/own-card/index.ts' },
]

export async function writeLayoutOwnerPageOrder(root: string, pages: string[]) {
  await fs.outputJson(path.join(root, 'src/app.json'), { pages }, { spaces: 2 })
}

/** 只写临时工程源码；构建产物始终由真实 Vite/Rolldown 构建生成。 */
export async function writeLayoutOwnerFixture(root: string) {
  await fs.remove(path.join(root, 'src'))
  const files: Record<string, string> = {
    'vite.config.ts': [
      'import { defineConfig } from "weapp-vite/config"',
      'export default defineConfig({',
      '  weapp: { srcRoot: "src", autoImportComponents: false },',
      '  build: { minify: false, sourcemap: true },',
      '})',
      '',
    ].join('\n'),
    'src/app.ts': 'App({})\n',
    'src/layouts/default/index.ts': 'Component({ data: { marker: "layout-owner" } })\n',
    'src/layouts/default/index.json': JSON.stringify({
      component: true,
      styleIsolation: 'apply-shared',
      usingComponents: { 'own-card': '/components/own-card/index' },
    }),
    'src/layouts/default/index.wxml': '<view id="layout-owner"><own-card /><include src="../../shared/layout-body.wxml" /><slot /></view>\n',
    'src/layouts/default/index.wxss': '#layout-owner { padding: 12rpx; }\n',
    'src/shared/layout-body.wxml': '<text id="layout-owner-label">layout-own-template</text>\n',
  }
  for (const name of ['first', 'second']) {
    files[`src/pages/${name}/index.ts`] = `Page({ data: { marker: "parent-${name}" } })\n`
    files[`src/pages/${name}/index.json`] = JSON.stringify({
      navigationBarTitleText: `Parent ${name}`,
      usingComponents: { 'parent-card': `/components/${name}-card/index` },
    })
    files[`src/pages/${name}/index.wxml`] = `<view id="page-${name}">parent-${name}</view><parent-card />\n`
    files[`src/pages/${name}/index.wxss`] = `#page-${name} { color: red; }\n`
  }
  for (const name of ['own-card', 'first-card', 'second-card']) {
    files[`src/components/${name}/index.ts`] = `Component({ data: { marker: "${name}" } })\n`
    files[`src/components/${name}/index.json`] = JSON.stringify({ component: true })
    files[`src/components/${name}/index.wxml`] = `<text id="${name}-marker">${name}</text>\n`
    files[`src/components/${name}/index.wxss`] = `#${name}-marker { display: block; }\n`
  }
  for (const [file, content] of Object.entries(files)) {
    await fs.outputFile(path.join(root, file), content)
  }
  await writeLayoutOwnerPageOrder(root, layoutOwnerPages)
  await fs.writeJson(path.join(root, 'project.private.config.json'), {
    condition: {
      miniprogram: {
        list: layoutOwnerPages.map(page => ({ name: page, pathName: page, query: '' })),
      },
    },
  }, { spaces: 2 })
}
