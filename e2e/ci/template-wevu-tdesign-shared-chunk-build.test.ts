import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const REGRESSION_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const REGRESSION_DIST_ROOT = path.join(REGRESSION_ROOT, 'dist')
const WEVU_SRC_VENDOR_PATH = path.join(DIST_ROOT, 'weapp-vendors/wevu-src.js')
const REQUIRE_VENDOR_RE = /require\("([^"]*weapp-vendors\/[^"]+\.js)"\)/g

interface MiniProgramProjectPrivateConfig {
  setting?: {
    compileHotReLoad?: unknown
    skylineRenderEnable?: unknown
  }
}

interface MiniProgramAppJson {
  componentFramework?: unknown
}

async function collectDistJsFiles(root: string) {
  const files = await fs.readdir(root, { recursive: true })
  return files
    .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
    .map(file => path.join(root, file))
}

async function collectMissingVendorRequires(jsPath: string) {
  const source = await fs.readFile(jsPath, 'utf8')
  const missing: string[] = []

  for (const match of source.matchAll(REQUIRE_VENDOR_RE)) {
    const request = match[1]
    if (!request) {
      continue
    }
    const resolved = path.resolve(path.dirname(jsPath), request)
    if (!(await fs.pathExists(resolved))) {
      missing.push(path.relative(DIST_ROOT, resolved).replaceAll('\\', '/'))
    }
  }

  return missing
}

async function buildTemplate(projectRoot: string, label: string) {
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label,
  })
}

describe.sequential('template build: wevu tdesign shared chunks', () => {
  beforeAll(async () => {
    await buildTemplate(TEMPLATE_ROOT, 'ci:template-wevu-tdesign-shared-chunks')
    await buildTemplate(REGRESSION_ROOT, 'ci:template-wevu-tdesign-regression-runtime-mode')
  }, 120_000)

  it('keeps the stable wevu runtime vendor chunk available for DevTools reloads', async () => {
    expect(await fs.pathExists(WEVU_SRC_VENDOR_PATH)).toBe(true)

    const missingByFile: Record<string, string[]> = {}
    for (const jsPath of await collectDistJsFiles(DIST_ROOT)) {
      const missing = await collectMissingVendorRequires(jsPath)
      if (missing.length) {
        missingByFile[path.relative(DIST_ROOT, jsPath).replaceAll('\\', '/')] = missing
      }
    }

    expect(missingByFile).toEqual({})
  })

  it('keeps DevTools hot reload enabled while forcing WebView runtime mode', async () => {
    const templatePrivateConfig = await fs.readJson(
      path.join(TEMPLATE_ROOT, 'project.private.config.json'),
    ) as MiniProgramProjectPrivateConfig
    const regressionPrivateConfig = await fs.readJson(
      path.join(REGRESSION_ROOT, 'project.private.config.json'),
    ) as MiniProgramProjectPrivateConfig
    const templateAppJson = await fs.readJson(
      path.join(DIST_ROOT, 'app.json'),
    ) as MiniProgramAppJson
    const regressionAppJson = await fs.readJson(
      path.join(REGRESSION_DIST_ROOT, 'app.json'),
    ) as MiniProgramAppJson

    expect(templatePrivateConfig.setting?.compileHotReLoad).toBe(true)
    expect(regressionPrivateConfig.setting?.compileHotReLoad).toBe(true)
    expect(templatePrivateConfig.setting?.skylineRenderEnable).toBe(false)
    expect(regressionPrivateConfig.setting?.skylineRenderEnable).toBe(false)
    expect(templateAppJson.componentFramework).toBeUndefined()
    expect(regressionAppJson.componentFramework).toBeUndefined()
  })
})
