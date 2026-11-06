import type { CompilerContext } from '../../context'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compilerSourceId } from '../compilerPlugin/hmr'
import { getRecordedSfcBlockSource, resolveSfcTemplateSource } from './sfcTemplateDependencies'
import { setCompilerSourceSnapshot } from './sourceSnapshot'
import { createReadAndParseSfcOptions, createSfcResolveSrcOptions, readAndParseSfc } from './vueSfc'

describe('readAndParseSfc', () => {
  it('resolves alias template identity again when cached descriptors use fresh options across generations', async () => {
    const filename = path.resolve('src/pages/alias-template/index.vue')
    const source = '<template src="@templates/body"></template>'
    const configService = { isDev: true, weappViteConfig: {} } as CompilerContext['configService']
    let resolvedId = path.resolve('src/templates/first.html')
    const resolve = vi.fn(async () => ({ id: resolvedId }))
    for (const [generation, template] of ['<view>first</view>', '<view>edited</view>', '<view>moved</view>'].entries()) {
      if (generation === 2) {
        resolvedId = path.resolve('src/templates/moved.html')
      }
      setCompilerSourceSnapshot(configService, new Map([[compilerSourceId(resolvedId), template]]))
      const options = createReadAndParseSfcOptions({ resolve }, configService, { source, checkMtime: false })
      const result = await readAndParseSfc(filename, options)
      expect(result.errors).toEqual([])
      expect(result.descriptor.template?.content).toBe(template)
      expect(resolveSfcTemplateSource(options.resolveSrc, result.descriptor.template?.src ?? undefined, filename)).toBe(resolvedId.replaceAll('\\', '/'))
      expect(getRecordedSfcBlockSource(configService, '@templates/body', filename)).toBe(resolvedId.replaceAll('\\', '/'))
    }
    expect(resolve).toHaveBeenCalledTimes(3)
    expect(resolve).toHaveBeenCalledWith('@templates/body', filename)
  })

  it('invalidates block identities when configuration changes and records a new hook selection', async () => {
    const filename = path.resolve('src/pages/configured/index.vue')
    const source = '@templates/body'
    const first = path.resolve('src/templates/first.html')
    const next = path.resolve('src/templates/next.html')
    const configService = { options: {}, isDev: true, weappViteConfig: {} } as CompilerContext['configService']
    await createSfcResolveSrcOptions({ resolve: async () => ({ id: first }) }, configService).resolveId!(source, filename)
    expect(getRecordedSfcBlockSource(configService, source, filename)).toBe(first.replaceAll('\\', '/'))
    configService.options = {} as typeof configService.options
    expect(getRecordedSfcBlockSource(configService, source, filename)).toBeUndefined()
    await createSfcResolveSrcOptions({ resolve: async () => ({ id: next }) }, configService).resolveId!(source, filename)
    expect(getRecordedSfcBlockSource(configService, source, filename)).toBe(next.replaceAll('\\', '/'))
  })

  it('keeps an unresolved alias unknown while preserving the compiler relative fallback', async () => {
    const filename = path.resolve('src/pages/unresolved/index.vue')
    const source = '@templates/body'
    const target = path.resolve('src/templates/body.html')
    const configService = { options: {}, isDev: true, weappViteConfig: {} } as CompilerContext['configService']
    await createSfcResolveSrcOptions({ resolve: async () => ({ id: target }) }, configService).resolveId!(source, filename)
    expect(getRecordedSfcBlockSource(configService, source, filename)).toBe(target.replaceAll('\\', '/'))
    const options = createSfcResolveSrcOptions({ resolve: async () => undefined }, configService)
    await options.resolveId!(source, filename)
    expect(getRecordedSfcBlockSource(configService, source, filename)).toBeUndefined()
    expect(resolveSfcTemplateSource(options, source, filename)).toBe(path.resolve(path.dirname(filename), source).replaceAll('\\', '/'))
    await options.resolveId!('./body.html', filename)
    expect(getRecordedSfcBlockSource(configService, './body.html', filename)).toBe(path.resolve(path.dirname(filename), 'body.html').replaceAll('\\', '/'))
  })

  it('parses from provided source', async () => {
    const parsed = await readAndParseSfc('/project/src/a.vue', {
      source: `<template><view>ok</view></template>\n<script setup lang="ts">const a = 1</script>`,
      checkMtime: false,
    })
    expect(parsed.errors).toEqual([])
    expect(parsed.descriptor.template?.content).toContain('ok')
    expect(parsed.descriptor.scriptSetup?.content).toContain('const a = 1')
  })

  it('creates shared sfc parse options from plugin resolve context', async () => {
    const resolveSrc = createSfcResolveSrcOptions(
      {
        resolve: async (source, importer) => ({
          id: `${importer}:${source}`,
        }),
      },
      {
        isDev: true,
      } as any,
    )

    expect(resolveSrc.checkMtime).toBe(true)
    expect(await resolveSrc.resolveId?.('./child.vue', '/project/src/a.vue')).toBe('/project/src/a.vue:./child.vue')

    const options = createReadAndParseSfcOptions(
      {
        resolve: async (source, importer) => ({
          id: `${importer}:${source}`,
        }),
      },
      {
        isDev: true,
      } as any,
      {
        source: '<template />',
        checkMtime: false,
      },
    )

    expect(options.source).toBe('<template />')
    expect(options.checkMtime).toBe(false)
    expect(options.resolveSrc?.checkMtime).toBe(true)
    expect(await options.resolveSrc?.resolveId?.('./child.vue', '/project/src/a.vue')).toBe('/project/src/a.vue:./child.vue')
  })
})
