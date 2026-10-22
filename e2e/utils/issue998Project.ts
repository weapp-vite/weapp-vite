import { cp, mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { addNativePublicationPlugin } from './nativePublication/fixture'

export const ISSUE_998_ROOT = path.resolve(import.meta.dirname, '../..')
export const ISSUE_998_CLI = path.join(ISSUE_998_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')

export async function createIssue998Project(options: { nativePublication?: boolean } = {}) {
  const parent = path.join(ISSUE_998_ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-998-'))
  await cp(path.join(ISSUE_998_ROOT, 'e2e-apps/github-issues/fixtures/issue-998'), project, { recursive: true })
  const require = createRequire(path.join(ISSUE_998_ROOT, 'packages/weapp-vite/package.json'))
  const dependencies = {
    'weapp-vite': path.join(ISSUE_998_ROOT, 'packages/weapp-vite'),
    'wevu': path.join(ISSUE_998_ROOT, 'packages-runtime/wevu'),
    'tailwindcss': path.dirname(require.resolve('tailwindcss/package.json')),
    'weapp-tailwindcss': path.dirname(require.resolve('weapp-tailwindcss/package.json')),
  }
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, target] of Object.entries(dependencies)) {
    await symlink(await realpath(target), path.join(project, 'node_modules', name), 'junction')
  }
  if (options.nativePublication) {
    await addNativePublicationPlugin(path.join(project, 'weapp-vite.config.mjs'))
  }
  return project
}
