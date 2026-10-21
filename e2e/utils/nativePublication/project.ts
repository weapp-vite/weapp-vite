import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** 只在临时夹具启动前接入只读观察器，不改共享夹具或已经运行的构建配置。 */
export async function installNativePublicationObserver(project: string) {
  const config = path.join(project, 'weapp-vite.config.ts')
  const plugin = path.relative(project, path.join(import.meta.dirname, 'plugin.ts')).replaceAll('\\', '/')
  const source = await readFile(config, 'utf8')
  await writeFile(config, `import { nativePublicationPlugin } from '${plugin.startsWith('.') ? plugin : `./${plugin}`}'\n${source.replace('defineConfig({', 'defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')}`)
}
