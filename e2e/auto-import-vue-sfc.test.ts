import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { createDevProcessEnv } from './utils/dev-process-env'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/src/cli.ts')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/auto-import-vue-sfc')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const TYPED_COMPONENTS_DTS = path.join(APP_ROOT, 'typed-components.d.ts')
const VUE_COMPONENTS_DTS = path.join(APP_ROOT, 'components.d.ts')
const PAGE_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const HOT_COMPONENT_DIR = path.join(APP_ROOT, 'src/components/HotCard')
const HOT_COMPONENT_SOURCE_PATH = path.join(HOT_COMPONENT_DIR, 'index.vue')
const SUPPORTED_PLATFORMS = ['weapp', 'alipay', 'tt'] as const
const PLATFORM_TEMPLATE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxml',
  alipay: 'axml',
  tt: 'ttml',
}

type RuntimePlatform = typeof SUPPORTED_PLATFORMS[number]

function resolvePlatforms() {
  const selected = process.env.E2E_PLATFORM
  if (!selected) {
    return [...SUPPORTED_PLATFORMS]
  }
  if (!SUPPORTED_PLATFORMS.includes(selected as RuntimePlatform)) {
    throw new Error(`Unsupported E2E_PLATFORM: ${selected}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
  }
  return [selected as RuntimePlatform]
}

const PLATFORM_LIST = resolvePlatforms()

function resolveComponentKey(platform: RuntimePlatform, name: string) {
  if (platform !== 'alipay') {
    return name
  }
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

async function runBuild(root: string, platform: RuntimePlatform) {
  await execa('node', ['--import', 'tsx', CLI_PATH, 'build', root, '--platform', platform, '--skipNpm'], {
    stdio: 'inherit',
  })
}

async function waitForFileContains(filePath: string, markers: string[], timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (markers.every(marker => content.includes(marker))) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain expected markers.`)
}

async function waitForUsingComponent(pageJsonPath: string, name: string, value: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath)
      if (pageJson?.usingComponents?.[name] === value) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for usingComponents.${name} in ${pageJsonPath}`)
}

async function waitForMissingUsingComponent(pageJsonPath: string, name: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath)
      if (!pageJson?.usingComponents || !(name in pageJson.usingComponents)) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for usingComponents.${name} to be removed in ${pageJsonPath}`)
}

function createHotCardSfc() {
  return `<template>
  <view class="hot-card-e2e">
    hot-card-e2e
  </view>
</template>
`
}

describe.sequential('auto import local components (e2e)', () => {
  it.each(PLATFORM_LIST)('covers local/resolver auto-import for %s build output', async (platform) => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_COMPONENTS_DTS)
    await fs.remove(VUE_COMPONENTS_DTS)

    await runBuild(APP_ROOT, platform)

    const vuePageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    const nativePageJsonPath = path.join(DIST_ROOT, 'pages/native/index.json')

    const sfcComponentJsonPath = path.join(DIST_ROOT, 'components/AutoCard/index.json')
    const sfcComponentTemplatePath = path.join(DIST_ROOT, `components/AutoCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`)
    const nativeComponentJsonPath = path.join(DIST_ROOT, 'components/NativeCard/index.json')
    const nativeComponentTemplatePath = path.join(DIST_ROOT, `components/NativeCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`)

    expect(await fs.pathExists(vuePageJsonPath)).toBe(true)
    expect(await fs.pathExists(nativePageJsonPath)).toBe(true)
    expect(await fs.pathExists(sfcComponentJsonPath)).toBe(true)
    expect(await fs.pathExists(sfcComponentTemplatePath)).toBe(true)
    expect(await fs.pathExists(nativeComponentJsonPath)).toBe(true)
    expect(await fs.pathExists(nativeComponentTemplatePath)).toBe(true)

    const autoCardKey = resolveComponentKey(platform, 'AutoCard')
    const nativeCardKey = resolveComponentKey(platform, 'NativeCard')
    const resolverCardKey = resolveComponentKey(platform, 'ResolverCard')

    const vuePageJson = await fs.readJson(vuePageJsonPath)
    expect(vuePageJson.usingComponents).toMatchObject({
      [autoCardKey]: '/components/AutoCard/index',
      [nativeCardKey]: '/components/NativeCard/index',
      [resolverCardKey]: '/components/NativeCard/index',
    })

    const nativePageJson = await fs.readJson(nativePageJsonPath)
    if (platform !== 'alipay') {
      expect(nativePageJson.usingComponents).toMatchObject({
        [nativeCardKey]: '/components/NativeCard/index',
        [resolverCardKey]: '/components/NativeCard/index',
      })
    }
    else {
      expect(nativePageJson.usingComponents ?? {}).toEqual({})
    }

    const sfcComponentJson = await fs.readJson(sfcComponentJsonPath)
    expect(sfcComponentJson).toMatchObject({
      component: true,
    })
    expect(sfcComponentJson.options).toMatchObject({
      virtualHost: true,
      multipleSlots: true,
    })
    expect(sfcComponentJson.styleIsolation).toBe('apply-shared')

    const nativeComponentJson = await fs.readJson(nativeComponentJsonPath)
    expect(nativeComponentJson).toMatchObject({
      component: true,
      styleIsolation: 'apply-shared',
    })
  })

  it('emits dts for editor intellisense', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_COMPONENTS_DTS)
    await fs.remove(VUE_COMPONENTS_DTS)

    await runBuild(APP_ROOT, PLATFORM_LIST[0])

    expect(await fs.pathExists(TYPED_COMPONENTS_DTS)).toBe(true)
    expect(await fs.pathExists(VUE_COMPONENTS_DTS)).toBe(true)

    const typedDts = await fs.readFile(TYPED_COMPONENTS_DTS, 'utf8')
    expect(typedDts).toContain('declare module \'weapp-vite/typed-components\'')
    expect(typedDts).toContain('AutoCard: {')
    expect(typedDts).toContain('readonly title?: string;')
    expect(typedDts).toContain('readonly score?: number | string;')
    expect(typedDts).toContain('readonly enabled?: boolean;')
    expect(typedDts).toContain('readonly tags?: any[];')
    expect(typedDts).toContain('readonly payload?: Record<string, any>;')
    expect(typedDts).toContain('readonly mode?: string | number;')
    expect(typedDts).toContain('readonly customProp?: string;')

    expect(typedDts).toContain('NativeCard: {')
    expect(typedDts).toContain('readonly title?: string;')
    expect(typedDts).toContain('readonly level?: number | string;')
    expect(typedDts).toContain('readonly visible?: boolean;')
    expect(typedDts).toContain('readonly meta?: Record<string, any>;')
    expect(typedDts).toContain('readonly items?: any[];')
    expect(typedDts).toContain('readonly anyValue?: any;')
    expect(typedDts).toContain('readonly \'custom-prop\'?: string;')

    expect(typedDts).toContain('ResolverCard: Record<string, any>;')

    const vueDts = await fs.readFile(VUE_COMPONENTS_DTS, 'utf8')
    expect(vueDts).toContain('declare module \'vue\'')
    expect(vueDts).toContain('GlobalComponents')
    expect(vueDts).toContain('AutoCard: typeof import("./src/components/AutoCard/index.vue")[\'default\'];')
    expect(vueDts).toContain('NativeCard: __WeappComponentImport<typeof import("./src/components/NativeCard/index"), WeappComponent<ComponentProp<"NativeCard">>>;')
    expect(vueDts).toContain('AutoCard:')
    expect(vueDts).toContain('NativeCard:')
    expect(vueDts).toContain('ResolverCard:')
    expect(vueDts).not.toContain('ComponentProp<"AutoCard">')
    expect(vueDts).toContain('ComponentProp<"NativeCard">')
    expect(vueDts).toContain('ComponentProp<"ResolverCard">')
  })

  it.each(PLATFORM_LIST)('updates usingComponents when SFC usage changes in dev (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_COMPONENTS_DTS)
    await fs.remove(VUE_COMPONENTS_DTS)

    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const pageSourceWithoutAutoCard = originalPageSource.replace('    <AutoCard />\n', '')
    const pageSourceWithAutoCard = pageSourceWithoutAutoCard.includes('<AutoCard />')
      ? pageSourceWithoutAutoCard
      : pageSourceWithoutAutoCard.replace('<ResolverCard />', '<ResolverCard />\n    <AutoCard />')

    if (pageSourceWithoutAutoCard === originalPageSource || pageSourceWithAutoCard === pageSourceWithoutAutoCard) {
      throw new Error('Failed to create page source variants for AutoCard toggling.')
    }

    const devProcess = execa('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })
    const devExit = devProcess.catch(() => {})

    try {
      const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
      const autoCardKey = resolveComponentKey(platform, 'AutoCard')
      await waitForFileContains(pageJsonPath, ['"usingComponents"'])
      await waitForUsingComponent(pageJsonPath, autoCardKey, '/components/AutoCard/index')

      await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithoutAutoCard, 'utf8')
      await waitForMissingUsingComponent(pageJsonPath, autoCardKey)

      await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithAutoCard, 'utf8')
      await waitForUsingComponent(pageJsonPath, autoCardKey, '/components/AutoCard/index')

      const autoCardTemplatePath = path.join(DIST_ROOT, `components/AutoCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`)
      expect(await fs.pathExists(autoCardTemplatePath)).toBe(true)
    }
    finally {
      devProcess.kill('SIGTERM')
      const killTimer = setTimeout(() => {
        devProcess.kill('SIGKILL')
      }, 3_000)
      await devExit
      clearTimeout(killTimer)

      await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
    }
  })

  it.each(PLATFORM_LIST)('auto imports newly created SFC in dev (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_COMPONENTS_DTS)
    await fs.remove(VUE_COMPONENTS_DTS)
    await fs.remove(HOT_COMPONENT_DIR)

    const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
    const pageSourceWithHotCard = originalPageSource.includes('<HotCard />')
      ? originalPageSource
      : originalPageSource.replace('<ResolverCard />', '<ResolverCard />\n    <HotCard />')

    if (pageSourceWithHotCard === originalPageSource) {
      throw new Error('Failed to inject <HotCard /> into page source.')
    }

    const devProcess = execa('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      env: createDevProcessEnv(),
      stdio: 'inherit',
    })
    const devExit = devProcess.catch(() => {})

    try {
      const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
      const hotCardKey = resolveComponentKey(platform, 'HotCard')
      await waitForFileContains(pageJsonPath, ['"usingComponents"'])
      await waitForMissingUsingComponent(pageJsonPath, hotCardKey)

      await fs.ensureDir(HOT_COMPONENT_DIR)
      await fs.writeFile(HOT_COMPONENT_SOURCE_PATH, createHotCardSfc(), 'utf8')
      await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithHotCard, 'utf8')

      await waitForUsingComponent(pageJsonPath, hotCardKey, '/components/HotCard/index')

      const hotCardJsonPath = path.join(DIST_ROOT, 'components/HotCard/index.json')
      const hotCardTemplatePath = path.join(DIST_ROOT, `components/HotCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`)

      expect(await fs.pathExists(hotCardJsonPath)).toBe(true)
      const hotCardTemplate = await waitForFileContains(hotCardTemplatePath, ['hot-card-e2e'])
      expect(hotCardTemplate).toContain('hot-card-e2e')
    }
    finally {
      devProcess.kill('SIGTERM')
      const killTimer = setTimeout(() => {
        devProcess.kill('SIGKILL')
      }, 3_000)
      await devExit
      clearTimeout(killTimer)

      await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
      await fs.remove(HOT_COMPONENT_DIR)
    }
  })
})
