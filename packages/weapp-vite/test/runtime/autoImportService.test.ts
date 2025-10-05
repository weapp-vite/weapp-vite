import path from 'pathe'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createCompilerContext } from '@/createContext'
import { getFixture } from '../utils'

describe('autoImportService', () => {
  const cwd = getFixture('auto-import')
  const helloWorldTemplate = path.resolve(cwd, 'src/components/HelloWorld/index.wxml')
  const helloWorldJson = path.resolve(cwd, 'src/components/HelloWorld/index.json')
  let ctx: Awaited<ReturnType<typeof createCompilerContext>>

  beforeAll(async () => {
    ctx = await createCompilerContext({ cwd })
  })

  beforeEach(() => {
    ctx.autoImportService.reset()
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
})
