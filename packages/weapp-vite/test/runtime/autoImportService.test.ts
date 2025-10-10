import type { CompilerContext } from '../../src/context'
import fs from 'fs-extra'
import path from 'pathe'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from '../utils'

type AutoImportOptions = NonNullable<
  NonNullable<
    NonNullable<CompilerContext['configService']>['weappViteConfig']['enhance']
  >['autoImportComponents']
>

describe('autoImportService', () => {
  const cwd = getFixture('auto-import')
  const helloWorldTemplate = path.resolve(cwd, 'src/components/HelloWorld/index.wxml')
  const helloWorldJson = path.resolve(cwd, 'src/components/HelloWorld/index.json')
  const manifestPath = path.resolve(cwd, 'auto-import-components.json')
  const componentTemplates = [
    path.resolve(cwd, 'src/components/Avatar/Avatar.wxml'),
    path.resolve(cwd, 'src/components/HelloWorld/index.wxml'),
    path.resolve(cwd, 'src/components/HiChina/HiChina.wxml'),
    path.resolve(cwd, 'src/components/Navbar/Navbar.wxml'),
    path.resolve(cwd, 'src/components/icebreaker/index.wxml'),
  ]
  let ctx: CompilerContext
  let disposeCtx: (() => Promise<void>) | undefined
  let autoImportOptions: AutoImportOptions
  let originalOutput: string | boolean | undefined

  async function readManifest(targetPath = manifestPath) {
    await ctx.autoImportService.awaitManifestWrites()
    if (!await fs.pathExists(targetPath)) {
      return {}
    }
    return await fs.readJson(targetPath)
  }

  async function registerAllLocalComponents() {
    for (const template of componentTemplates) {
      await ctx.autoImportService.registerPotentialComponent(template)
    }
  }

  beforeAll(async () => {
    const result = await createTestCompilerContext({ cwd })
    ctx = result.ctx
    disposeCtx = result.dispose
    // @ts-ignore
    autoImportOptions = ctx.configService?.weappViteConfig?.enhance?.autoImportComponents
    originalOutput = autoImportOptions?.output
    expect(autoImportOptions).toBeDefined()
    expect(autoImportOptions.resolvers?.[0]?.components).toBeDefined()
  })

  beforeEach(async () => {
    if (autoImportOptions) {
      autoImportOptions.output = originalOutput
    }
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()
    await fs.remove(manifestPath)
  })

  afterAll(async () => {
    if (autoImportOptions) {
      autoImportOptions.output = originalOutput
    }
    await disposeCtx?.()
    await fs.remove(manifestPath)
  })

  it('registers local components and exposes them for resolution', async () => {
    await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)

    const locals = ctx.autoImportService.getRegisteredLocalComponents()
    expect(locals).toHaveLength(1)

    const [match] = locals
    expect(match.kind).toBe('local')
    expect(match.value.name).toBe('HelloWorld')
    expect(match.value.from).toBe('/components/HelloWorld/index')

    const resolved = ctx.autoImportService.resolve('HelloWorld')
    expect(resolved?.kind).toBe('local')
    expect(resolved?.value.from).toBe('/components/HelloWorld/index')
  })

  it('clears registered components on reset', async () => {
    await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)
    expect(ctx.autoImportService.getRegisteredLocalComponents()).toHaveLength(1)

    ctx.autoImportService.reset()
    expect(ctx.autoImportService.getRegisteredLocalComponents()).toHaveLength(0)
  })

  it('registers components when triggered from non-template sources', async () => {
    await ctx.autoImportService.registerPotentialComponent(helloWorldJson)

    const locals = ctx.autoImportService.getRegisteredLocalComponents()
    expect(locals).toHaveLength(1)
    expect(locals[0]?.entry.templatePath?.replaceAll('\\', '/')).toMatch(/HelloWorld\/index\.wxml$/)
  })

  it('removes registered components when sources are deleted', async () => {
    await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)
    expect(ctx.autoImportService.getRegisteredLocalComponents()).toHaveLength(1)

    ctx.autoImportService.removePotentialComponent(helloWorldTemplate)
    expect(ctx.autoImportService.getRegisteredLocalComponents()).toHaveLength(0)
  })

  it('falls back to configured resolvers when no local match exists', () => {
    const resolved = ctx.autoImportService.resolve('van-button')
    expect(resolved?.kind).toBe('resolver')
    expect(resolved?.value).toEqual({
      name: 'van-button',
      from: '@vant/weapp/button',
    })
  })

  it('persists registered components to the manifest file', async () => {
    await registerAllLocalComponents()
    const manifestAfterRegister = await readManifest()
    expect(manifestAfterRegister).toMatchObject({
      'Avatar': '/components/Avatar/Avatar',
      'HelloWorld': '/components/HelloWorld/index',
      'HiChina': '/components/HiChina/HiChina',
      'Navbar': '/components/Navbar/Navbar',
      'icebreaker': '/components/icebreaker/index',
      'van-button': '@vant/weapp/button',
    })
    const keys = Object.keys(manifestAfterRegister)
    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b))
    expect(keys).toEqual(sortedKeys)

    ctx.autoImportService.removePotentialComponent(helloWorldTemplate)
    const manifestAfterRemoval = await readManifest()
    expect(manifestAfterRemoval).not.toHaveProperty('HelloWorld')
    expect(manifestAfterRemoval).toMatchObject({
      'Avatar': '/components/Avatar/Avatar',
      'HiChina': '/components/HiChina/HiChina',
      'Navbar': '/components/Navbar/Navbar',
      'icebreaker': '/components/icebreaker/index',
      'van-button': '@vant/weapp/button',
    })
  })

  it('skips manifest when output is disabled', async () => {
    autoImportOptions.output = false
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)
    await ctx.autoImportService.awaitManifestWrites()

    expect(await fs.pathExists(manifestPath)).toBe(false)
  })

  it('respects custom manifest output path', async () => {
    const customManifestPath = path.resolve(cwd, 'custom-auto-import-components.json')
    autoImportOptions.output = customManifestPath
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    try {
      await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)
      const manifestAfterRegister = await readManifest(customManifestPath)
      expect(manifestAfterRegister).toMatchObject({
        'HelloWorld': '/components/HelloWorld/index',
        'van-button': '@vant/weapp/button',
      })

      ctx.autoImportService.removePotentialComponent(helloWorldTemplate)
      const manifestAfterRemoval = await readManifest(customManifestPath)
      expect(manifestAfterRemoval).not.toHaveProperty('HelloWorld')
      expect(manifestAfterRemoval).toMatchObject({
        'van-button': '@vant/weapp/button',
      })

      expect(await fs.pathExists(manifestPath)).toBe(false)
    }
    finally {
      await fs.remove(customManifestPath)
    }
  })

  it('emits resolver components even without local registrations', async () => {
    ctx.autoImportService.reset()
    const manifest = await readManifest()
    expect(manifest).toMatchObject({
      'van-button': '@vant/weapp/button',
    })
  })

  it('resolves relative output paths against the Vite config directory', async () => {
    const configDir = path.dirname(ctx.configService!.configFilePath ?? ctx.configService!.cwd)
    const relativeOutput = 'relative-auto-import.json'
    const relativeManifestPath = path.resolve(configDir, relativeOutput)
    autoImportOptions.output = relativeOutput
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    try {
      await registerAllLocalComponents()
      const manifest = await readManifest(relativeManifestPath)
      expect(manifest).toMatchObject({
        'Avatar': '/components/Avatar/Avatar',
        'HelloWorld': '/components/HelloWorld/index',
        'HiChina': '/components/HiChina/HiChina',
        'Navbar': '/components/Navbar/Navbar',
        'icebreaker': '/components/icebreaker/index',
        'van-button': '@vant/weapp/button',
      })
      expect(await fs.pathExists(manifestPath)).toBe(false)
    }
    finally {
      await fs.remove(relativeManifestPath)
    }
  })

  it('prefers local component registrations over resolver entries when names collide', async () => {
    const componentDir = path.resolve(cwd, 'src/components/van-button')
    const templatePath = path.resolve(componentDir, 'index.wxml')
    const jsonPath = path.resolve(componentDir, 'index.json')
    const scriptPath = path.resolve(componentDir, 'index.ts')

    await fs.ensureDir(componentDir)
    await fs.writeFile(templatePath, '<view>local van button</view>')
    await fs.writeJson(jsonPath, { component: true })
    await fs.writeFile(scriptPath, 'Component({})')

    try {
      ctx.autoImportService.reset()
      await ctx.autoImportService.awaitManifestWrites()
      await registerAllLocalComponents()
      await ctx.autoImportService.registerPotentialComponent(templatePath)
      const locals = ctx.autoImportService.getRegisteredLocalComponents()
      const localEntry = locals.find(entry => entry.value.name === 'van-button')
      expect(localEntry).toBeDefined()
      expect(localEntry?.value.from).toBe('/components/van-button/index')
      const manifest = await readManifest()
      expect(manifest['van-button']).toBe('/components/van-button/index')
    }
    finally {
      await fs.remove(componentDir)
      ctx.autoImportService.reset()
      await ctx.autoImportService.awaitManifestWrites()
      await fs.remove(manifestPath)
    }
  })
})
