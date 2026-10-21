import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { addWevuTailwindProbe } from './source'

/** 只复制当前 suite 的模板，保留真实 AppID 和页面条件，并按目录身份释放自有临时项目。 */
export async function createWevuTailwindHmrProject(repositoryRoot: string) {
  const template = path.join(repositoryRoot, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
  const parent = path.join(repositoryRoot, '.tmp/e2e/ide-wevu-tailwind-hmr')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'fixture-'))
  const identity = await lstat(project)
  let cleanupTask: Promise<void> | undefined
  const cleanup = () => cleanupTask ??= (async () => {
    const current = await lstat(project).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') {
        throw error
      }
    })
    if (current?.isDirectory() && current.dev === identity.dev && current.ino === identity.ino) {
      await rm(project, { recursive: true, force: true })
    }
  })()
  try {
    const ignored = new Set(['dist', 'node_modules', '.weapp-vite', '.tmp', '.cache', '.turbo'])
    await cp(template, project, { recursive: true, filter: source => !path.relative(template, source).split(path.sep).some(segment => ignored.has(segment)) })
    const manifest = JSON.parse(await readFile(path.join(template, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    await mkdir(path.join(project, 'node_modules'))
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
      const target = path.join(project, 'node_modules', name)
      await mkdir(path.dirname(target), { recursive: true })
      // 分别链接真实依赖，避免 Windows 整目录 junction 再穿过 pnpm 链接。
      await symlink(await realpath(path.join(template, 'node_modules', name)), target, 'junction')
    }
    const source = path.join(project, 'src/pages/index/index.vue')
    const original = addWevuTailwindProbe(await readFile(source, 'utf8'))
    await writeFile(source, original)
    const config = path.join(project, 'weapp-vite.config.ts')
    const observer = pathToFileURL(path.join(repositoryRoot, 'e2e/utils/nativePublication/plugin.ts')).href
    await writeFile(config, `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${await readFile(config, 'utf8')}`
      .replace('export default defineConfig({', 'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')
      .replace('weapp: {', 'weapp: {\n    hmr: { runtime: \'stateful-experimental\', logLevel: \'verbose\' },'))
    const app = path.join(project, 'src/app.vue')
    const appSource = await readFile(app, 'utf8')
    const setup = '<script setup lang="ts">'
    if (!appSource.startsWith(setup)) {
      throw new Error('Expected the isolated template App to use script setup')
    }
    await writeFile(app, appSource.replace(setup, `${setup}
import { getCurrentInstance, onLaunch } from 'wevu'
const appInstance = getCurrentInstance()
onLaunch(function (this: Record<string, unknown>) {
  const launchedAt = Date.now()
  this.__e2eHmrLaunch = launchedAt
  if (!appInstance) {
    throw new Error('App setup instance was unavailable')
  }
  appInstance.__e2eHmrLaunch = launchedAt
  console.info('[hmr-diagnostics:app-launch]', launchedAt)
})`))
    return { project, source, original, cleanup }
  }
  catch (error) {
    await cleanup()
    throw error
  }
}
