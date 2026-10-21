import { realpath, symlink } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import { createStatefulHmrProject } from '../statefulHmrProject'
import { reactEntrySource, reactPageSource } from './react'

export type HmrBoundaryReason = 'engine-full-reload' | 'patch-shape' | 'skyline'

const appSource = `App({
  globalData: {},
  onLaunch() {
    const host = wx as unknown as { onAppRouteDone?: (callback: (event: { renderer?: string }) => void) => void }
    host.onAppRouteDone?.((event) => {
      Object.assign(this.globalData, { renderer: event.renderer })
    })
  },
})
`

/** 使用同一真实 AppID 和已有路由创建独占的能力边界场景。 */
export async function createHmrBoundaryProject(repositoryRoot: string, reason: HmrBoundaryReason) {
  const fixture = await createStatefulHmrProject(repositoryRoot)
  try {
    const { projectRoot } = fixture
    const configFile = path.join(projectRoot, 'weapp-vite.config.ts')
    const observer = pathToFileURL(path.join(repositoryRoot, 'e2e/utils/nativePublication/plugin.ts')).href
    let config = `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${await fs.readFile(configFile, 'utf8')}`
      .replace('export default defineConfig({', 'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')
      .replace('logLevel: \'verbose\',', 'runtime: \'stateful-experimental\', logLevel: \'verbose\',')
      .replace('srcRoot: \'src\',', reason === 'patch-shape'
        ? 'srcRoot: \'src\',\n    react: { compiler: false, renderMode: \'static\' },'
        : 'srcRoot: \'src\',')
    if (reason === 'engine-full-reload') {
      config = config.replace('export default defineConfig({', 'export default defineConfig({\n  build: { rolldownOptions: { tsconfig: \'./src/tsconfig.hmr.jsonc\' } },')
    }
    await fs.writeFile(configFile, config, 'utf8')
    await fs.writeFile(path.join(projectRoot, 'src/app.ts'), appSource, 'utf8')
    const appFile = path.join(projectRoot, 'src/app.json')
    const app = await fs.readJson(appFile) as Record<string, unknown>
    app.pages = ['pages/native/index']
    delete app.tabBar
    if (reason === 'skyline') {
      Object.assign(app, {
        renderer: 'skyline',
        rendererOptions: { skyline: { defaultDisplayBlock: true, disableABTest: true, sdkVersionBegin: '3.0.0', sdkVersionEnd: '15.255.255' } },
        componentFramework: 'glass-easel',
        lazyCodeLoading: 'requiredComponents',
        style: 'v2',
        window: { navigationStyle: 'custom' },
      })
    }
    await fs.writeJson(appFile, app, { spaces: 2 })
    const privateFile = path.join(projectRoot, 'project.private.config.json')
    const privateConfig = await fs.readJson(privateFile) as Record<string, unknown>
    privateConfig.condition = { miniprogram: { list: [{ name: `HMR ${reason}`, pathName: 'pages/native/index', query: '' }] } }
    if (reason === 'skyline') {
      privateConfig.setting = { ...(privateConfig.setting as Record<string, unknown>), skylineRenderEnable: true, compileHotReLoad: true }
    }
    await fs.writeJson(privateFile, privateConfig, { spaces: 2 })

    const source = path.join(projectRoot, reason === 'patch-shape' ? 'src/pages/native/view.tsx' : 'src/pages/native/index.ts')
    const engineInput = path.join(projectRoot, 'src/tsconfig.hmr.jsonc')
    if (reason === 'engine-full-reload') {
      // 引擎只在真实读取的 tsconfig 变更时发 FullReload；JSONC 是 TypeScript 原生支持的扩展配置。
      await fs.writeJson(engineInput, { compilerOptions: { useDefineForClassFields: true } }, { spaces: 2 })
      await fs.writeJson(path.join(projectRoot, 'tsconfig.json'), { extends: './src/tsconfig.hmr.jsonc', files: [] }, { spaces: 2 })
    }
    if (reason === 'patch-shape') {
      await fs.ensureDir(path.join(projectRoot, 'node_modules/@weapp-vite'))
      for (const dependency of ['react', '@weapp-vite/react']) {
        const target = await realpath(path.join(repositoryRoot, 'e2e-apps/react-runtime-spike/node_modules', dependency))
        await symlink(target, path.join(projectRoot, 'node_modules', dependency), 'junction')
      }
      await fs.remove(path.join(projectRoot, 'src/pages/native/index.wxml'))
      await fs.writeFile(path.join(projectRoot, 'src/pages/native/index.ts'), reactEntrySource, 'utf8')
      await fs.writeFile(source, reactPageSource, 'utf8')
    }
    return { ...fixture, source, engineInput, initialSource: await fs.readFile(source, 'utf8') }
  }
  catch (error) {
    await fixture.cleanup()
    throw error
  }
}
