import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const CONFIG_MODULE_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/dist/config.mjs')
const TEMP_ROOT = path.resolve(import.meta.dirname, '../../.tmp')
const tempRoots: string[] = []

function createConfigSource(options: {
  label: 'vite' | 'weapp'
  aliasEntries: Record<string, string>
  defineEntries: Record<string, string>
  markerFile: string
  markerSource: string
  cssClass: string
  cssWidth: string
}) {
  const aliasSource = JSON.stringify(options.aliasEntries, null, 2)
  const defineSource = JSON.stringify(options.defineEntries, null, 2)

  return `import { defineConfig } from ${JSON.stringify(CONFIG_MODULE_PATH)}

function markerPlugin() {
  return {
    name: ${JSON.stringify(`${options.label}-config-plugin`)},
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: ${JSON.stringify(options.markerFile)},
        source: ${JSON.stringify(options.markerSource)},
      })
    },
  }
}

function appendCssPlugin() {
  return {
    postcssPlugin: ${JSON.stringify(`${options.label}-config-postcss`)},
    Once(root) {
      root.append({
        selector: ${JSON.stringify(`.${options.cssClass}`)},
        nodes: [
          {
            prop: 'width',
            value: ${JSON.stringify(options.cssWidth)},
          },
        ],
      })
    },
  }
}

export default defineConfig({
  resolve: {
    alias: ${aliasSource},
  },
  define: ${defineSource},
  css: {
    postcss: {
      plugins: [appendCssPlugin()],
    },
  },
  plugins: [markerPlugin()],
  weapp: {
    srcRoot: 'src',
  },
})
`
}

async function writeJson(target: string, value: Record<string, any>) {
  await fs.ensureDir(path.dirname(target))
  await fs.writeJson(target, value, { spaces: 2 })
}

async function writeText(target: string, source: string) {
  await fs.ensureDir(path.dirname(target))
  await fs.writeFile(target, source, 'utf8')
}

async function createBaseProject(label: string) {
  await fs.ensureDir(TEMP_ROOT)
  const root = await fs.mkdtemp(path.join(TEMP_ROOT, `${label}-`))
  tempRoots.push(root)

  await writeJson(path.join(root, 'package.json'), {
    name: `e2e-${label}`,
    private: true,
    type: 'module',
  })
  await writeJson(path.join(root, 'project.config.json'), {
    appid: 'wxb3d842a4a7e3440d',
    miniprogramRoot: 'dist',
  })
  await writeJson(path.join(root, 'src/app.json'), {
    pages: ['pages/index/index'],
  })
  await writeText(path.join(root, 'src/app.ts'), 'import \'./app.css\'\nApp({})\n')
  await writeText(path.join(root, 'src/app.css'), '.seed { height: 10px; }\n')

  return root
}

async function createStandaloneWeappConfigProject() {
  const root = await createBaseProject('config-merge-standalone')

  await writeText(path.join(root, 'src/aliases/priority.ts'), 'export const priorityValue = \'priority-weapp-standalone\'\n')
  await writeText(path.join(root, 'src/aliases/weapp-only.ts'), 'export const weappOnlyValue = \'weapp-only-alias-standalone\'\n')
  await writeText(
    path.join(root, 'src/pages/index/index.ts'),
    [
      'import { priorityValue } from \'@priority\'',
      'import { weappOnlyValue } from \'@weappOnly\'',
      'const snapshot = {',
      '  priorityValue,',
      '  weappOnlyValue,',
      '  priorityDefine: __CONFIG_PRIORITY__,',
      '  weappOnlyDefine: __WEAPP_ONLY_DEFINE__,',
      '}',
      'Page({',
      '  data: snapshot,',
      '  onLoad() {',
      '    console.log(\'standalone-config-merge\', snapshot)',
      '  },',
      '})',
      '',
    ].join('\n'),
  )
  await writeText(path.join(root, 'src/pages/index/index.wxml'), '<view>{{priorityValue}}</view>\n')

  await writeText(
    path.join(root, 'weapp-vite.config.ts'),
    createConfigSource({
      label: 'weapp',
      aliasEntries: {
        '@priority': path.join(root, 'src/aliases/priority.ts'),
        '@weappOnly': path.join(root, 'src/aliases/weapp-only.ts'),
      },
      defineEntries: {
        __CONFIG_PRIORITY__: '"priority-weapp-standalone"',
        __WEAPP_ONLY_DEFINE__: '"weapp-only-define-standalone"',
      },
      markerFile: 'markers/from-weapp.txt',
      markerSource: 'weapp-plugin-ran',
      cssClass: 'from-weapp-config',
      cssWidth: '22px',
    }),
  )

  return root
}

async function createMergedConfigProject() {
  const root = await createBaseProject('config-merge-merged')

  await writeText(path.join(root, 'src/aliases/priority-vite.ts'), 'export const priorityValue = \'priority-vite-merged\'\n')
  await writeText(path.join(root, 'src/aliases/priority-weapp.ts'), 'export const priorityValue = \'priority-weapp-merged\'\n')
  await writeText(path.join(root, 'src/aliases/vite-only.ts'), 'export const viteOnlyValue = \'vite-only-alias-merged\'\n')
  await writeText(path.join(root, 'src/aliases/weapp-only.ts'), 'export const weappOnlyValue = \'weapp-only-alias-merged\'\n')
  await writeText(
    path.join(root, 'src/pages/index/index.ts'),
    [
      'import { priorityValue } from \'@priority\'',
      'import { viteOnlyValue } from \'@viteOnly\'',
      'import { weappOnlyValue } from \'@weappOnly\'',
      'const snapshot = {',
      '  priorityValue,',
      '  viteOnlyValue,',
      '  weappOnlyValue,',
      '  priorityDefine: __CONFIG_PRIORITY__,',
      '  viteOnlyDefine: __VITE_ONLY_DEFINE__,',
      '  weappOnlyDefine: __WEAPP_ONLY_DEFINE__,',
      '}',
      'Page({',
      '  data: snapshot,',
      '  onLoad() {',
      '    console.log(\'merged-config-merge\', snapshot)',
      '  },',
      '})',
      '',
    ].join('\n'),
  )
  await writeText(path.join(root, 'src/pages/index/index.wxml'), '<view>{{priorityValue}}</view>\n')

  await writeText(
    path.join(root, 'vite.config.ts'),
    createConfigSource({
      label: 'vite',
      aliasEntries: {
        '@priority': path.join(root, 'src/aliases/priority-vite.ts'),
        '@viteOnly': path.join(root, 'src/aliases/vite-only.ts'),
      },
      defineEntries: {
        __CONFIG_PRIORITY__: '"priority-vite-merged"',
        __VITE_ONLY_DEFINE__: '"vite-only-define-merged"',
      },
      markerFile: 'markers/from-vite.txt',
      markerSource: 'vite-plugin-ran',
      cssClass: 'from-vite-config',
      cssWidth: '11px',
    }),
  )

  await writeText(
    path.join(root, 'weapp-vite.config.ts'),
    createConfigSource({
      label: 'weapp',
      aliasEntries: {
        '@priority': path.join(root, 'src/aliases/priority-weapp.ts'),
        '@weappOnly': path.join(root, 'src/aliases/weapp-only.ts'),
      },
      defineEntries: {
        __CONFIG_PRIORITY__: '"priority-weapp-merged"',
        __WEAPP_ONLY_DEFINE__: '"weapp-only-define-merged"',
      },
      markerFile: 'markers/from-weapp.txt',
      markerSource: 'weapp-plugin-ran',
      cssClass: 'from-weapp-config',
      cssWidth: '22px',
    }),
  )

  return root
}

async function buildProject(projectRoot: string, label: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label,
    skipNpm: true,
  })
}

describe.sequential('config merge e2e', () => {
  afterAll(async () => {
    await Promise.all(tempRoots.map(root => fs.remove(root)))
  })

  it('treats standalone weapp-vite.config.ts as a full vite config', async () => {
    const projectRoot = await createStandaloneWeappConfigProject()
    await buildProject(projectRoot, 'ci:config-merge:standalone')

    const distRoot = path.join(projectRoot, 'dist')
    const pageJs = await fs.readFile(path.join(distRoot, 'pages/index/index.js'), 'utf8')
    const appWxss = await fs.readFile(path.join(distRoot, 'app.wxss'), 'utf8')
    const pluginMarker = await fs.readFile(path.join(distRoot, 'markers/from-weapp.txt'), 'utf8')

    expect(pluginMarker).toBe('weapp-plugin-ran')
    expect(await fs.pathExists(path.join(distRoot, 'markers/from-vite.txt'))).toBe(false)
    expect(pageJs).toContain('priority-weapp-standalone')
    expect(pageJs).toContain('weapp-only-alias-standalone')
    expect(pageJs).toContain('weapp-only-define-standalone')
    expect(appWxss).toContain('.from-weapp-config')
    expect(appWxss).toContain('width: 22px')
  })

  it('merges vite.config.ts and weapp-vite.config.ts with weapp config priority', async () => {
    const projectRoot = await createMergedConfigProject()
    await buildProject(projectRoot, 'ci:config-merge:merged')

    const distRoot = path.join(projectRoot, 'dist')
    const pageJs = await fs.readFile(path.join(distRoot, 'pages/index/index.js'), 'utf8')
    const appWxss = await fs.readFile(path.join(distRoot, 'app.wxss'), 'utf8')
    const viteMarker = await fs.readFile(path.join(distRoot, 'markers/from-vite.txt'), 'utf8')
    const weappMarker = await fs.readFile(path.join(distRoot, 'markers/from-weapp.txt'), 'utf8')

    expect(viteMarker).toBe('vite-plugin-ran')
    expect(weappMarker).toBe('weapp-plugin-ran')
    expect(pageJs).toContain('priority-weapp-merged')
    expect(pageJs).not.toContain('priority-vite-merged')
    expect(pageJs).toContain('vite-only-alias-merged')
    expect(pageJs).toContain('weapp-only-alias-merged')
    expect(pageJs).toContain('vite-only-define-merged')
    expect(pageJs).toContain('weapp-only-define-merged')
    expect(appWxss).toContain('.from-vite-config')
    expect(appWxss).toContain('width: 11px')
    expect(appWxss).toContain('.from-weapp-config')
    expect(appWxss).toContain('width: 22px')
  })
})
