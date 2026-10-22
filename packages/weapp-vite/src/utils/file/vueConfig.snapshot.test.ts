import type { MutableCompilerContext } from '../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { withCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { extractConfigFromVue } from './vueConfig'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

function appConfig(name: string) {
  return { pages: [`pages/${name}/index`] }
}

function appSource(name: string) {
  return `<template><view>${name}</view></template><json>${JSON.stringify(appConfig(name))}</json>`
}

function compilerContext() {
  return { configService: {} } as unknown as MutableCompilerContext
}

function snapshot(file: string, source: string | null) {
  return new Map([[compilerSourceId(file), source]])
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-config-snapshot-'))
  roots.push(root)
  const file = path.join(await fs.realpath(root), 'app.vue')
  await fs.writeFile(file, appSource('live'))
  return { file, context: compilerContext() }
}

describe('Vue config compiler snapshot ownership', () => {
  it.each([false, true])('reads pinned App config without reusing or replacing the disk cache (warm=%s)', async (warm) => {
    const { file, context } = await fixture()
    if (warm) {
      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
    }

    await withCompilerSourceSnapshot(context.configService!, snapshot(file, appSource('captured')), async () => {
      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('captured'))
      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('captured'))
    })

    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
  })

  it('restores nested generations and keeps another compiler session independent', async () => {
    const { file, context } = await fixture()
    const other = compilerContext()
    await withCompilerSourceSnapshot(context.configService!, snapshot(file, appSource('outer')), async () => {
      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('outer'))
      expect(await extractConfigFromVue(file, { compilerContext: other })).toEqual(appConfig('live'))

      await withCompilerSourceSnapshot(context.configService!, snapshot(file, appSource('inner')), async () => {
        expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('inner'))
      })

      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('outer'))
      expect(await extractConfigFromVue(file, { compilerContext: other })).toEqual(appConfig('live'))
    })
    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
  })

  it('does not resurrect a removed snapshot input from the live file or its cached config', async () => {
    const { file, context } = await fixture()
    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))

    await withCompilerSourceSnapshot(context.configService!, snapshot(file, null), async () => {
      expect(await extractConfigFromVue(file, { compilerContext: context })).toBeUndefined()
    })

    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
  })

  it.each(['source', 'readSource'] as const)('keeps explicit %s ahead of snapshot and disk cache inputs', async (input) => {
    const { file, context } = await fixture()
    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
    const source = appSource('explicit')
    const options = input === 'source' ? { source } : { readSource: async () => source }

    await withCompilerSourceSnapshot(context.configService!, snapshot(file, appSource('captured')), async () => {
      expect(await extractConfigFromVue(file, { compilerContext: context, ...options })).toEqual(appConfig('explicit'))
      expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('captured'))
    })

    expect(await extractConfigFromVue(file, { compilerContext: context })).toEqual(appConfig('live'))
  })
})
