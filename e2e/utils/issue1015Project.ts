import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_1015_CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export async function createIssue1015Project(options: { nativePublication?: boolean } = {}) {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1015-'))
  await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1015'), project, { recursive: true })
  await cp(path.join(ROOT, 'e2e-apps/github-issues/src/pages/issue-1015'), path.join(project, 'src/pages/issue-1015'), { recursive: true })
  // 真实 IDE 运行会在 fixture 下生成 node_modules；复制 fixture 时先移除它，
  // 避免把上一轮生成的软链接带入临时项目，导致后续 mkdir/symlink 竞态。
  await rm(path.join(project, 'node_modules'), { recursive: true, force: true })
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  if (options.nativePublication) {
    const configPath = path.join(project, 'weapp-vite.config.mjs')
    const observer = path.relative(project, path.join(ROOT, 'e2e/utils/nativePublication/plugin.ts')).replaceAll('\\', '/')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${config.replace(
      'export default defineConfig({',
      'export default defineConfig({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],',
    )}`)
  }
  return project
}
