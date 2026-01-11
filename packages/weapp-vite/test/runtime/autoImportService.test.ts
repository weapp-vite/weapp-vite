import type { Resolver } from '../../src/auto-import-components/resolvers'
import type { CompilerContext } from '../../src/context'
import fs from 'fs-extra'
import path from 'pathe'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { createTestCompilerContext, getFixture } from '../utils'

type AutoImportOptions = NonNullable<
  NonNullable<CompilerContext['configService']>['weappViteConfig']['autoImportComponents']
>

describe('autoImportService', () => {
  const fixtureSource = getFixture('auto-import')
  const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
  let tempDir: string
  let cwd: string
  let helloWorldTemplate: string
  let helloWorldJson: string
  let manifestPath: string
  let typedDefinitionPath: string
  let htmlDataPath: string
  let vueComponentsDefinitionPath: string
  let componentTemplates: string[] = []
  let ctx: CompilerContext
  let disposeCtx: (() => Promise<void>) | undefined
  let autoImportOptions: AutoImportOptions | undefined
  let originalOutput: string | boolean | undefined
  let originalTypedComponents: AutoImportOptions['typedComponents']
  let originalHtmlCustomData: AutoImportOptions['htmlCustomData']
  let originalVueComponents: AutoImportOptions['vueComponents']
  let originalResolvers: AutoImportOptions['resolvers']

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
    await fs.ensureDir(tempRoot)
    tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-'))
    await fs.copy(fixtureSource, tempDir, {
      dereference: true,
      filter: (src) => {
        const relative = path.relative(fixtureSource, src).replaceAll('\\', '/')
        if (!relative) {
          return true
        }
        return !(relative === 'dist' || relative.startsWith('dist/'))
      },
    })
    cwd = tempDir
    helloWorldTemplate = path.resolve(cwd, 'src/components/HelloWorld/index.wxml')
    helloWorldJson = path.resolve(cwd, 'src/components/HelloWorld/index.json')
    manifestPath = path.resolve(cwd, 'auto-import-components.json')
    typedDefinitionPath = path.resolve(cwd, 'typed-components.d.ts')
    htmlDataPath = path.resolve(cwd, 'mini-program.html-data.json')
    vueComponentsDefinitionPath = path.resolve(cwd, 'components.d.ts')
    componentTemplates = [
      path.resolve(cwd, 'src/components/Avatar/Avatar.wxml'),
      path.resolve(cwd, 'src/components/HelloWorld/index.wxml'),
      path.resolve(cwd, 'src/components/HiChina/HiChina.wxml'),
      path.resolve(cwd, 'src/components/Navbar/Navbar.wxml'),
      path.resolve(cwd, 'src/components/XxYy/XxYy.wxml'),
      path.resolve(cwd, 'src/components/PropsDemo/PropsDemo.wxml'),
      path.resolve(cwd, 'src/components/icebreaker/index.wxml'),
      path.resolve(cwd, 'src/components/xx-yy/index.wxml'),
    ]

    const result = await createTestCompilerContext({ cwd })
    ctx = result.ctx
    disposeCtx = result.dispose
    autoImportOptions = ctx.configService?.weappViteConfig?.autoImportComponents
      ?? ctx.configService?.weappViteConfig?.enhance?.autoImportComponents
    originalOutput = autoImportOptions?.output
    originalTypedComponents = autoImportOptions?.typedComponents
    originalHtmlCustomData = autoImportOptions?.htmlCustomData
    originalVueComponents = autoImportOptions?.vueComponents
    originalResolvers = autoImportOptions?.resolvers
    expect(autoImportOptions).toBeDefined()
    expect(autoImportOptions?.resolvers?.[0]?.components).toBeDefined()
    expect(autoImportOptions?.typedComponents).toBeUndefined()
  })

  beforeEach(async () => {
    if (autoImportOptions) {
      autoImportOptions.output = originalOutput
      autoImportOptions.typedComponents = originalTypedComponents
      autoImportOptions.htmlCustomData = originalHtmlCustomData
      autoImportOptions.vueComponents = originalVueComponents
      autoImportOptions.resolvers = originalResolvers
    }
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()
    await fs.remove(manifestPath)
    await fs.remove(typedDefinitionPath)
    await fs.remove(htmlDataPath)
    await fs.remove(vueComponentsDefinitionPath)
  })

  afterAll(async () => {
    const safeRemove = async (target?: string) => {
      if (!target) {
        return
      }
      await fs.remove(target)
    }
    if (autoImportOptions) {
      autoImportOptions.output = originalOutput
      autoImportOptions.typedComponents = originalTypedComponents
      autoImportOptions.htmlCustomData = originalHtmlCustomData
      autoImportOptions.vueComponents = originalVueComponents
      autoImportOptions.resolvers = originalResolvers
    }
    await disposeCtx?.()
    await safeRemove(manifestPath)
    await safeRemove(typedDefinitionPath)
    await safeRemove(htmlDataPath)
    await safeRemove(vueComponentsDefinitionPath)
    if (tempDir) {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
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

  it('supports object-style resolver via components map', () => {
    autoImportOptions!.resolvers = [
      {
        components: {
          'x-foo': 'my-ui/foo/foo',
        },
      } satisfies Resolver,
    ]

    const resolved = ctx.autoImportService.resolve('x-foo')
    expect(resolved?.kind).toBe('resolver')
    expect(resolved?.value).toEqual({
      name: 'x-foo',
      from: 'my-ui/foo/foo',
    })
  })

  it('supports object-style resolver via resolve() method', () => {
    autoImportOptions!.resolvers = [
      {
        resolve(componentName) {
          if (componentName !== 'x-bar') {
            return
          }
          return {
            name: componentName,
            from: 'my-ui/bar/bar',
          }
        },
      } satisfies Resolver,
    ]

    const resolved = ctx.autoImportService.resolve('x-bar')
    expect(resolved?.kind).toBe('resolver')
    expect(resolved?.value).toEqual({
      name: 'x-bar',
      from: 'my-ui/bar/bar',
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
      'PropsDemo': '/components/PropsDemo/PropsDemo',
      'XxYy': '/components/XxYy/XxYy',
      'icebreaker': '/components/icebreaker/index',
      'van-button': '@vant/weapp/button',
      'xx-yy': '/components/xx-yy/index',
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
      'PropsDemo': '/components/PropsDemo/PropsDemo',
      'XxYy': '/components/XxYy/XxYy',
      'icebreaker': '/components/icebreaker/index',
      'van-button': '@vant/weapp/button',
      'xx-yy': '/components/xx-yy/index',
    })
  })

  it.skip('logs and skips manifest when no components are discovered', async () => {
    autoImportOptions!.resolvers = []
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    try {
      ctx.autoImportService.reset()
      await ctx.autoImportService.awaitManifestWrites()

      expect(await fs.pathExists(manifestPath)).toBe(false)
      const loggedMessages = infoSpy.mock.calls.map(call => call[0])
      const matched = loggedMessages.some(
        message => typeof message === 'string' && message.includes('未发现可自动导入的组件'),
      )
      expect(matched).toBe(true)
    }
    finally {
      infoSpy.mockRestore()
    }
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

  it('writes typed component definitions for discovered components', async () => {
    autoImportOptions!.typedComponents = true
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    await registerAllLocalComponents()
    await ctx.autoImportService.awaitManifestWrites()

    expect(await fs.pathExists(typedDefinitionPath)).toBe(true)
    const typedContent = await fs.readFile(typedDefinitionPath, 'utf8')
    expect(typedContent).toContain('PropsDemo')
    expect(typedContent).toContain('readonly title?: string;')
    expect(typedContent).toContain('readonly count?: number | string;')
    expect(typedContent).toContain('readonly active?: boolean;')
    expect(typedContent).toContain('readonly items?: any[];')
    expect(typedContent).toContain('readonly dataSet?: Record<string, any>;')
    expect(typedContent).toContain('readonly anyValue?: any;')
    expect(typedContent).toContain('readonly \'custom-prop\'?: string;')
    expect(typedContent).toContain('\'van-button\': {')
    expect(typedContent).toContain('readonly plain?: boolean;')
    expect(typedContent).toContain('readonly type?: string;')
  })

  it('does not emit typed component definitions when feature disabled', async () => {
    autoImportOptions!.typedComponents = false
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    await registerAllLocalComponents()
    await ctx.autoImportService.awaitManifestWrites()

    expect(await fs.pathExists(typedDefinitionPath)).toBe(false)
  })

  it('writes Vue components definitions for template intellisense when enabled', async () => {
    autoImportOptions!.vueComponents = true
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    await registerAllLocalComponents()
    await ctx.autoImportService.awaitManifestWrites()

    expect(await fs.pathExists(vueComponentsDefinitionPath)).toBe(true)
    const content = await fs.readFile(vueComponentsDefinitionPath, 'utf8')
    expect(content).toContain('declare module \'vue\'')
    expect(content).toContain('GlobalComponents')
    expect(content).toContain('VanButton')
    expect(content).toContain('readonly plain?: boolean;')
  })

  it('prefers d.ts entry when resolving navigation imports for resolver components', async () => {
    const packageRoot = path.resolve(cwd, 'node_modules/mock-ui')
    const dtsPath = path.resolve(packageRoot, 'miniprogram_dist/empty/empty.d.ts')

    await fs.ensureDir(path.dirname(dtsPath))
    await fs.writeJson(path.resolve(packageRoot, 'package.json'), {
      name: 'mock-ui',
      version: '0.0.0',
      miniprogram: 'miniprogram_dist',
    }, { spaces: 2 })
    await fs.writeFile(dtsPath, 'export {}')

    autoImportOptions!.resolvers = [
      {
        components: {
          'mock-empty': 'mock-ui/empty/empty',
        },
      },
    ]
    autoImportOptions!.vueComponents = true

    try {
      ctx.autoImportService.reset()
      await ctx.autoImportService.awaitManifestWrites()
      await registerAllLocalComponents()
      await ctx.autoImportService.awaitManifestWrites()

      const content = await fs.readFile(vueComponentsDefinitionPath, 'utf8')
      expect(content).toContain('MockEmpty')
      expect(content).toContain('mock-empty')
      expect(content).toContain('mock-ui/miniprogram_dist/empty/empty')
      expect(content).not.toContain('mock-ui/miniprogram_dist/empty/empty.js')
    }
    finally {
      await fs.remove(packageRoot)
    }
  })

  it('writes HTML custom data for editors when enabled', async () => {
    const customHtmlDataPath = path.resolve(cwd, 'custom-mini-program.html-data.json')
    autoImportOptions!.htmlCustomData = customHtmlDataPath
    autoImportOptions!.typedComponents = false

    const originalJson = await fs.readJson(helloWorldJson)
    const enhancedJson = {
      ...originalJson,
      properties: {
        title: {
          type: 'String',
          description: '主标题',
        },
        count: {
          type: ['Number', 'String'],
        },
      },
    }
    await fs.writeJson(helloWorldJson, enhancedJson, { spaces: 2 })

    try {
      ctx.autoImportService.reset()
      await ctx.autoImportService.awaitManifestWrites()
      await registerAllLocalComponents()
      await ctx.autoImportService.awaitManifestWrites()

      expect(await fs.pathExists(customHtmlDataPath)).toBe(true)
      const htmlData = await fs.readJson(customHtmlDataPath)
      const tag = htmlData.tags.find((item: any) => item.name === 'HelloWorld')
      expect(tag).toBeDefined()
      expect(Array.isArray(tag.attributes)).toBe(true)

      const titleAttr = tag.attributes.find((attr: any) => attr.name === 'title')
      expect(titleAttr?.description).toContain('类型: string')
      expect(titleAttr?.description).toContain('主标题')

      const countAttr = tag.attributes.find((attr: any) => attr.name === 'count')
      expect(countAttr?.description).toContain('number')
      expect(countAttr?.description).toContain('string')
    }
    finally {
      await fs.writeJson(helloWorldJson, originalJson, { spaces: 2 })
      await fs.remove(customHtmlDataPath)
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
        'PropsDemo': '/components/PropsDemo/PropsDemo',
        'XxYy': '/components/XxYy/XxYy',
        'icebreaker': '/components/icebreaker/index',
        'van-button': '@vant/weapp/button',
        'xx-yy': '/components/xx-yy/index',
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
