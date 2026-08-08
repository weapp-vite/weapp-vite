import type { ComponentLibraryGeneratorOptions } from './types'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { renderComponentPage } from './renderPage'
import { renderHome, renderPrivateConfig, renderScenarios } from './renderSupport'

export type { ComponentInteraction, ComponentLibraryGeneratorOptions, ComponentMarkup } from './types'

async function assertOrWrite(filename: string, expected: string, checkOnly: boolean) {
  if (checkOnly) {
    const actual = await readFile(filename, 'utf8').catch(() => '')
    if (actual !== expected) {
      throw new Error(`生成文件已漂移: ${filename}`)
    }
    return
  }
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, expected)
}

export async function generateComponentLibraryPages(options: ComponentLibraryGeneratorOptions) {
  const pagesRoot = resolve(options.appRoot, 'src/pages/components')
  const expectedDirs = new Set(options.components)
  const existingDirs = await readdir(pagesRoot, { withFileTypes: true }).catch(() => [])
  const unexpected = existingDirs.filter(entry => entry.isDirectory() && !expectedDirs.has(entry.name))
  if (unexpected.length) {
    throw new Error(`存在未声明的组件页面: ${unexpected.map(entry => entry.name).join(', ')}`)
  }

  await Promise.all([
    ...options.components.map((component) => {
      const spec = options.getComponentMarkup(component)
      return assertOrWrite(
        resolve(pagesRoot, component, 'index.vue'),
        renderComponentPage(component, spec),
        options.checkOnly,
      )
    }),
    assertOrWrite(
      resolve(options.appRoot, 'src/scenarios.ts'),
      renderScenarios(options.components, options.getComponentMarkup),
      options.checkOnly,
    ),
    assertOrWrite(
      resolve(options.appRoot, 'src/pages/index/index.vue'),
      renderHome(options.title, options.versionLabel),
      options.checkOnly,
    ),
    assertOrWrite(
      resolve(options.appRoot, 'project.private.config.json'),
      renderPrivateConfig(options.components, options.projectDescription, options.projectName),
      options.checkOnly,
    ),
  ])
  // eslint-disable-next-line no-console
  console.log(`[${options.logPrefix}] ${options.checkOnly ? 'checked' : 'generated'} ${options.components.length} component pages`)
}
