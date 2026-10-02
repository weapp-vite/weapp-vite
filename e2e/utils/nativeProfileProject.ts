import { access, cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renameAtomicFile } from './hmrAtomicRename'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const NATIVE_PROFILE_FIXTURE = 'e2e-apps/github-issues/fixtures/issue-1134-profile'

export async function createNativeProfileProject(runtime: 'classic' | 'stateful-experimental') {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'native-profile-'))
  await cp(path.join(ROOT, NATIVE_PROFILE_FIXTURE), project, { recursive: true })
  await mkdir(path.join(project, 'node_modules'))
  await symlink(await realpath(path.join(ROOT, 'packages/weapp-vite')), path.join(project, 'node_modules/weapp-vite'), 'junction')
  const config = path.join(project, 'weapp-vite.config.ts')
  await writeFile(config, (await readFile(config, 'utf8')).replace('runtime: \'classic\'', `runtime: '${runtime}'`))
  return project
}

export async function saveNativeProfileSource(project: string, relative: string, source: string) {
  const file = path.join(project, 'src', relative)
  await writeFile(`${file}.tmp`, source)
  await renameAtomicFile(`${file}.tmp`, file)
}

export async function hasNativeProfileEntry(project: string, entry: string) {
  return await Promise.all(['js', 'json', 'wxml'].map(extension => access(path.join(project, 'dist', `${entry}.${extension}`)).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  })))
}
