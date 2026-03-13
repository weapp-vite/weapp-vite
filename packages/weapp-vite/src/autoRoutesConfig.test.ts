import { describe, expect, it } from 'vitest'
import { resolveWeappAutoRoutesConfig } from './autoRoutesConfig'

describe('resolveWeappAutoRoutesConfig', () => {
  it('keeps auto routes disabled when config is omitted', () => {
    expect(resolveWeappAutoRoutesConfig()).toEqual({
      enabled: false,
      typedRouter: false,
      persistentCache: false,
      persistentCachePath: undefined,
      watch: false,
    })
  })

  it('uses enabled defaults when config is true', () => {
    expect(resolveWeappAutoRoutesConfig(true)).toEqual({
      enabled: true,
      typedRouter: true,
      persistentCache: false,
      persistentCachePath: undefined,
      watch: true,
    })
  })

  it('disables every feature when config is false', () => {
    expect(resolveWeappAutoRoutesConfig(false)).toEqual({
      enabled: false,
      typedRouter: false,
      persistentCache: false,
      persistentCachePath: undefined,
      watch: false,
    })
  })

  it('supports object config overrides', () => {
    expect(resolveWeappAutoRoutesConfig({})).toEqual({
      enabled: true,
      typedRouter: true,
      persistentCache: false,
      persistentCachePath: undefined,
      watch: true,
    })
    expect(resolveWeappAutoRoutesConfig({
      enabled: true,
      typedRouter: false,
      persistentCache: false,
      watch: false,
    })).toEqual({
      enabled: true,
      typedRouter: false,
      persistentCache: false,
      persistentCachePath: undefined,
      watch: false,
    })
    expect(resolveWeappAutoRoutesConfig({
      enabled: true,
      persistentCache: true,
    })).toEqual({
      enabled: true,
      typedRouter: true,
      persistentCache: true,
      persistentCachePath: undefined,
      watch: true,
    })
    expect(resolveWeappAutoRoutesConfig({
      enabled: true,
      persistentCache: '.cache/custom-auto-routes.json',
    })).toEqual({
      enabled: true,
      typedRouter: true,
      persistentCache: true,
      persistentCachePath: '.cache/custom-auto-routes.json',
      watch: true,
    })
  })
})
