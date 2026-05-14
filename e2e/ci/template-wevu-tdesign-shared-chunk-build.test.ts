import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const WEVU_SRC_VENDOR_PATH = path.join(DIST_ROOT, 'weapp-vendors/wevu-src.js')
const REQUIRE_VENDOR_RE = /require\("([^"]*weapp-vendors\/[^"]+\.js)"\)/g

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

describe.sequential('template build: wevu tdesign shared chunks', () => {
  beforeAll(async () => {
    await fs.remove(DIST_ROOT)
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: TEMPLATE_ROOT,
      platform: 'weapp',
      cwd: TEMPLATE_ROOT,
      label: 'ci:template-wevu-tdesign-shared-chunks',
    })
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
})
