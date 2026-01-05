import process from 'node:process'
import { initTsDtsFile, initTsJsonFiles, initViteConfigFile } from './configFiles'
import { createOrUpdatePackageJson } from './packageJson'
import { createOrUpdateProjectConfig } from './projectConfig'
import { ctx, resetContext } from './state'
import { updateGitIgnore } from './updateGitignore'

export type { Context } from './context'

export {
  createOrUpdatePackageJson,
  createOrUpdateProjectConfig,
  initTsDtsFile,
  initTsJsonFiles,
  initViteConfigFile,
  resetContext,
}

export async function initConfig(options: { root?: string, command?: 'weapp-vite' }) {
  const { root = process.cwd(), command } = options

  await createOrUpdateProjectConfig({ root })
  await createOrUpdatePackageJson({ root, command })
  await updateGitIgnore({ root })

  if (command === 'weapp-vite') {
    await initViteConfigFile({ root })
    await initTsDtsFile({ root })
    await initTsJsonFiles({ root })
  }

  return ctx
}
