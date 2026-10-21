import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createDevBuildCompletion } from '../utils/devBuildCompletion'
import { disableProjectCompileHotReload, replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { waitForVendorMembersIntact } from '../utils/vendorPublication'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const MINIMAL_TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const MINIMAL_DIST_ROOT = path.join(MINIMAL_TEMPLATE_ROOT, 'dist')
const MINIMAL_INDEX_SOURCE_PATH = path.join(MINIMAL_TEMPLATE_ROOT, 'src/pages/index/index.vue')
const MINIMAL_INDEX_WXML_PATH = path.join(MINIMAL_DIST_ROOT, 'pages/index/index.wxml')
const HOME_SOURCE_PATH = path.join(TEMPLATE_ROOT, 'src/pages/home/home.vue')
const HOME_WXML_PATH = path.join(DIST_ROOT, 'pages/home/home.wxml')
const HOME_JSON_PATH = path.join(DIST_ROOT, 'pages/home/home.json')
const INITIAL_RETAIL_BUILD_TIMEOUT_MS = 180_000
const UPDATE_BUILD_TIMEOUT_MS = 90_000
const SEARCH_PLACEHOLDER_RE = /placeholder="iphone 13 火热发售中[^"]*"/
const PAGE_TITLE_RE = /navigationBarTitleText:\s*'[^']*'/
const MINIMAL_TAG_TEXT_RE = /(>\s*)wevu(?:321312)?(\s*<\/t-tag>)/

function remainingPublicationBudget(deadline: number) {
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) {
    throw new Error('Timed out waiting for template build publication')
  }
  return remainingMs
}

function replaceSearchPlaceholder(source: string, marker: string) {
  const updated = source.replace(SEARCH_PLACEHOLDER_RE, `placeholder="${marker}"`)
  if (updated === source) {
    throw new Error('Failed to replace retail home search placeholder.')
  }
  return updated
}

function replacePageTitle(source: string, marker: string) {
  const updated = source.replace(PAGE_TITLE_RE, `navigationBarTitleText: '${marker}'`)
  if (updated === source) {
    throw new Error('Failed to replace retail home definePageJson title.')
  }
  return updated
}

function replaceMinimalTagText(source: string, marker: string) {
  const updated = source.replace(MINIMAL_TAG_TEXT_RE, `$1${marker}$2`)
  if (updated === source && !source.includes(`\n        ${marker}\n`)) {
    throw new Error('Failed to replace minimal template wevu tag text.')
  }
  return updated
}

async function withRetailDevWatch<T>(
  task: (dev: ReturnType<typeof startDevProcess>) => Promise<T>,
) {
  await fs.remove(DIST_ROOT)
  const restoreCompileHotReload = await disableProjectCompileHotReload(TEMPLATE_ROOT)

  const dev = startDevProcess('node', [CLI_PATH, 'dev', TEMPLATE_ROOT, '--platform', 'weapp'], {
    cwd: TEMPLATE_ROOT,
    env: createDevProcessEnv({ disableSidecarWatch: true }),
    all: true,
  })

  try {
    const deadline = Date.now() + INITIAL_RETAIL_BUILD_TIMEOUT_MS
    await dev.waitForInitialBuild(remainingPublicationBudget(deadline))
    await dev.waitFor(
      waitForFile(path.join(DIST_ROOT, 'app.json'), remainingPublicationBudget(deadline)),
      'retail template app.json generated',
    )
    await dev.waitFor(
      waitForFile(path.join(DIST_ROOT, 'pages/home/home.js'), remainingPublicationBudget(deadline)),
      'retail template home.js generated',
    )
    await dev.waitFor(waitForVendorMembersIntact(DIST_ROOT, remainingPublicationBudget(deadline)), 'initial retail template vendor members')
    return await task(dev)
  }
  finally {
    try {
      await dev.stop(5_000)
    }
    finally {
      await restoreCompileHotReload()
    }
  }
}

async function withMinimalDevWatch<T>(
  task: (dev: ReturnType<typeof startDevProcess>) => Promise<T>,
) {
  await fs.remove(MINIMAL_DIST_ROOT)
  const restoreCompileHotReload = await disableProjectCompileHotReload(MINIMAL_TEMPLATE_ROOT)

  const dev = startDevProcess('node', [CLI_PATH, 'dev', MINIMAL_TEMPLATE_ROOT, '--platform', 'weapp'], {
    cwd: MINIMAL_TEMPLATE_ROOT,
    env: createDevProcessEnv({ disableSidecarWatch: true }),
    all: true,
  })

  try {
    const deadline = Date.now() + INITIAL_RETAIL_BUILD_TIMEOUT_MS
    await dev.waitForInitialBuild(remainingPublicationBudget(deadline))
    await dev.waitFor(
      waitForFile(path.join(MINIMAL_DIST_ROOT, 'app.json'), remainingPublicationBudget(deadline)),
      'minimal template app.json generated',
    )
    await dev.waitFor(
      waitForFile(path.join(MINIMAL_DIST_ROOT, 'app.js'), remainingPublicationBudget(deadline)),
      'minimal template app.js generated',
    )
    await dev.waitFor(waitForVendorMembersIntact(MINIMAL_DIST_ROOT, remainingPublicationBudget(deadline)), 'initial minimal template vendor members')
    return await task(dev)
  }
  finally {
    try {
      await dev.stop(5_000)
    }
    finally {
      await restoreCompileHotReload()
    }
  }
}

describe('retail template HMR keeps wevu vendor exports intact', { concurrent: false }, () => {
  it('updates the minimal template tag text without dropping app vendor exports', async () => {
    const originalSource = await fs.readFile(MINIMAL_INDEX_SOURCE_PATH, 'utf8')
    const marker = 'wevu321312'
    const resetSource = replaceMinimalTagText(originalSource, 'wevu')
    const updatedSource = replaceMinimalTagText(resetSource, marker)

    try {
      await replaceFileByRename(MINIMAL_INDEX_SOURCE_PATH, resetSource)
      await withMinimalDevWatch(async (dev) => {
        // dev 下稳定 runtime 文件名是热更新契约，生产构建允许合并共享模块。
        const runtimeVendor = path.join(MINIMAL_DIST_ROOT, 'weapp-vendors/wevu-runtime.js')
        expect(await fs.pathExists(runtimeVendor)).toBe(true)
        expect(await fs.readFile(path.join(MINIMAL_DIST_ROOT, 'app.js'), 'utf8')).toContain('weapp-vendors/wevu-runtime.js')
        const deadline = Date.now() + UPDATE_BUILD_TIMEOUT_MS
        const completion = createDevBuildCompletion(dev, { completed: '小程序已重新构建' })
        await replaceFileByRename(MINIMAL_INDEX_SOURCE_PATH, updatedSource)
        await completion.wait(remainingPublicationBudget(deadline))

        const output = await dev.waitFor(
          waitForFileContains(MINIMAL_INDEX_WXML_PATH, marker, remainingPublicationBudget(deadline)),
          'updated minimal template tag text',
        )
        expect(output).toContain(marker)
        expect(await fs.pathExists(runtimeVendor)).toBe(true)
        expect(await dev.waitFor(waitForVendorMembersIntact(MINIMAL_DIST_ROOT, remainingPublicationBudget(deadline)), 'minimal template vendor members after text HMR')).toEqual({})
      })
    }
    finally {
      await replaceFileByRename(MINIMAL_INDEX_SOURCE_PATH, originalSource)
    }
  })

  it('updates the home search placeholder without dropping vendor exports', async () => {
    const originalSource = await fs.readFile(HOME_SOURCE_PATH, 'utf8')
    const marker = 'iphone 13 火热发售中-e2e-template'
    const updatedSource = replaceSearchPlaceholder(originalSource, marker)

    try {
      await withRetailDevWatch(async (dev) => {
        const deadline = Date.now() + UPDATE_BUILD_TIMEOUT_MS
        const completion = createDevBuildCompletion(dev, { completed: '小程序已重新构建' })
        await replaceFileByRename(HOME_SOURCE_PATH, updatedSource)
        await completion.wait(remainingPublicationBudget(deadline))

        const output = await dev.waitFor(
          waitForFileContains(HOME_WXML_PATH, marker, remainingPublicationBudget(deadline)),
          'updated retail home search placeholder',
        )
        expect(output).toContain(marker)
        expect(await dev.waitFor(waitForVendorMembersIntact(DIST_ROOT, remainingPublicationBudget(deadline)), 'retail template vendor members after placeholder HMR')).toEqual({})
      })
    }
    finally {
      await replaceFileByRename(HOME_SOURCE_PATH, originalSource)
    }
  })

  it('updates definePageJson metadata without dropping vendor exports', async () => {
    const originalSource = await fs.readFile(HOME_SOURCE_PATH, 'utf8')
    const marker = '首页都撒到-e2e-metadata'
    const updatedSource = replacePageTitle(originalSource, marker)

    try {
      await withRetailDevWatch(async (dev) => {
        const deadline = Date.now() + UPDATE_BUILD_TIMEOUT_MS
        const completion = createDevBuildCompletion(dev, { completed: '小程序已重新构建' })
        await replaceFileByRename(HOME_SOURCE_PATH, updatedSource)
        await completion.wait(remainingPublicationBudget(deadline))

        const output = await dev.waitFor(
          waitForFileContains(HOME_JSON_PATH, marker, remainingPublicationBudget(deadline)),
          'updated retail home definePageJson metadata',
        )
        expect(output).toContain(marker)
        expect(await dev.waitFor(waitForVendorMembersIntact(DIST_ROOT, remainingPublicationBudget(deadline)), 'retail template vendor members after metadata HMR')).toEqual({})
      })
    }
    finally {
      await replaceFileByRename(HOME_SOURCE_PATH, originalSource)
    }
  })
})
