import { cp, lstat, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** 复制真实 JSX 示例并把被测页设为首页，让 classic 自动重载无需测试导航。 */
export async function createWevuJsxHmrProject() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'jsx-hmr-'))
  const identity = await lstat(project)
  const cleanup = async () => {
    const current = await lstat(project).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    })
    if (current?.isDirectory() && current.dev === identity.dev && current.ino === identity.ino) {
      await rm(project, { recursive: true, force: true })
    }
  }
  try {
    const source = path.join(ROOT, 'apps/wevu-jsx-tsx-demo')
    for (const name of ['src', 'package.json', 'project.config.json', 'project.private.config.json', 'tsconfig.json']) {
      await cp(path.join(source, name), path.join(project, name), { recursive: true })
    }
    await mkdir(path.join(project, 'node_modules'))
    for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
      await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
    }
    const appFile = path.join(project, 'src/app.json')
    const app = await fs.readJson(appFile) as { pages: string[], [key: string]: unknown }
    app.pages = ['pages/tsx-basic/index', ...app.pages.filter(page => page !== 'pages/tsx-basic/index')]
    await fs.writeJson(appFile, app, { spaces: 2 })
    const observer = path.relative(project, path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).replaceAll('\\', '/')
    await fs.writeFile(path.join(project, 'vite.config.ts'), [
      'import process from "node:process"',
      'import { defineConfig } from "weapp-vite"',
      `import { nativePublicationPlugin } from ${JSON.stringify(observer)}`,
      'export default defineConfig({',
      '  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],',
      '  weapp: { srcRoot: "src", hmr: { runtime: "auto", logLevel: "verbose", profileJson: true } },',
      '  esbuild: { jsx: "preserve" },',
      '})',
    ].join('\n'))
    return { project, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
