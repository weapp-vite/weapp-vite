import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import prettier from 'prettier'
import { expect } from 'vitest'
import { extractConfigFromVue } from '../packages/weapp-vite/src/utils/file'
import { launchAutomator } from './utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_JSON_PATH = 'src/app.json'
const APP_VUE_PATH = 'src/app.vue'

export interface TemplateE2EOptions {
  templateRoot: string
  templateName: string
}

export function formatWxml(wxml: string) {
  return prettier.format(wxml, {
    parser: 'html',
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    endOfLine: 'lf',
    trailingComma: 'none',
    printWidth: 180,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: 'ignore',
  })
}

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeWxml(wxml: string) {
  return stripAutomatorOverlay(wxml).replace(/\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g, '')
}

function normalizeSegment(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function pushUnique(list: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  list.push(value)
}

async function loadAppConfig(templateRoot: string) {
  const appJsonPath = path.resolve(templateRoot, APP_JSON_PATH)
  if (await fs.pathExists(appJsonPath)) {
    const raw = await fs.readFile(appJsonPath, 'utf-8')
    const { parse: parseJson } = await import('comment-json')
    const config = parseJson(raw, undefined, true)
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config as Record<string, any>
    }
    throw new Error(`[${templateRoot}] app.json parse failed`)
  }

  const appVuePath = path.resolve(templateRoot, APP_VUE_PATH)
  if (await fs.pathExists(appVuePath)) {
    const config = await extractConfigFromVue(appVuePath)
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config
    }
    throw new Error(`[${templateRoot}] app.vue defineAppJson extract failed`)
  }

  throw new Error(`[${templateRoot}] missing src/app.json or src/app.vue`)
}

function resolvePages(config: Record<string, any>) {
  const pages: string[] = []
  const seen = new Set<string>()

  if (Array.isArray(config.pages)) {
    for (const page of config.pages) {
      if (typeof page !== 'string') {
        continue
      }
      pushUnique(pages, seen, normalizeSegment(page))
    }
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string' ? normalizeSegment(subPackage.root) : ''
    const subPages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    for (const page of subPages) {
      if (typeof page !== 'string') {
        continue
      }
      const normalizedPage = normalizeSegment(page)
      if (!normalizedPage) {
        continue
      }
      const combined = root ? `${root}/${normalizedPage}` : normalizedPage
      if (root && normalizedPage.startsWith(`${root}/`)) {
        pushUnique(pages, seen, normalizedPage)
      }
      else {
        pushUnique(pages, seen, combined)
      }
    }
  }

  return pages
}

async function runBuild(templateRoot: string) {
  const outputRoot = path.join(templateRoot, 'dist')
  await fs.remove(outputRoot)
  const packageJsonPath = path.resolve(templateRoot, 'package.json')
  const packageJson = await fs.readJson(packageJsonPath)
  const hasDependencies = packageJson?.dependencies && Object.keys(packageJson.dependencies).length > 0
  const args = [CLI_PATH, 'build', templateRoot, '--platform', 'weapp']
  if (!hasDependencies) {
    args.push('--skipNpm')
  }
  await execa('node', args, {
    stdio: 'inherit',
  })
}

export async function runTemplateE2E(options: TemplateE2EOptions) {
  const { templateRoot, templateName } = options
  const config = await loadAppConfig(templateRoot)
  const pages = resolvePages(config)

  if (pages.length === 0) {
    throw new Error(`[${templateName}] No pages found in app config`)
  }

  await runBuild(templateRoot)

  const miniProgram = await launchAutomator({
    projectPath: templateRoot,
  })

  try {
    for (const pagePath of pages) {
      const route = `/${pagePath}`
      const page = await miniProgram.reLaunch(route)
      if (!page) {
        throw new Error(`[${templateName}] Failed to launch page: ${route}`)
      }

      const element = await page.$('page')
      if (!element) {
        throw new Error(`[${templateName}] Failed to find page element: ${route}`)
      }

      const wxml = normalizeWxml(await element.wxml())
      expect(await formatWxml(wxml)).toMatchSnapshot(`${templateName}::${pagePath}`)
    }
  }
  finally {
    await miniProgram.close()
  }
}
