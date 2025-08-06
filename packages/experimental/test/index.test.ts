import type { RolldownWatcher } from 'rolldown'
import type { Plugin } from 'rolldown-vite'
import { scanFiles } from '#test/utils'
import consola from 'consola'

import { defu } from 'defu'
// import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'rolldown-vite'
// import { wrapPlugin } from 'vite-plugin-performance'
import { customLoadEntry } from '@/index'

describe('index', () => {
  it('foo bar', async () => {
    const watcher = await build({
      root: path.resolve(import.meta.dirname, 'fixtures/demo'),
      plugins: [
        // wrapPlugin(
        //   // @ts-ignore
        //   customLoadEntry(),
        //   // {
        //   //   threshold
        //   // }
        // ),
        customLoadEntry(),
        logPlugin(),
      ],
      build: {
        rollupOptions: {
          input: {
            app: path.resolve(import.meta.dirname, 'fixtures/demo/app.js'),
          },
        },
        // watch: {},
      },
    }) as RolldownWatcher
    // watcher.close()
    if ('on' in watcher) {
      watcher.on('event', (event) => {
        console.log('event', event)

        if (event.code === 'END') {
          watcher.close()
        }
      })
    }

    const fileList = await scanFiles(path.resolve(import.meta.dirname, 'fixtures/demo/dist'))

    expect(fileList).toMatchSnapshot('fileList')
  })
})

export interface UserDefinedOptions {
  stage: {
    build?: boolean
    output?: boolean
  }
}

export function logPlugin(options?: UserDefinedOptions): Plugin[] {
  const plugins: Plugin[] = []
  const { stage } = defu<UserDefinedOptions, UserDefinedOptions[]>(options, {
    stage: {
      build: true,
      output: true,
    },
  })
  if (stage.build) {
    plugins.push({
      name: 'weapp-vite:custom-build',
      watchChange(id, _change) {
        consola.info('[watchChange]', id)
      },
      closeWatcher() {
        consola.info('[closeWatcher]')
      },
      // Build Hooks
      options(_options) {
        consola.info('[options]')
      },
      buildStart() {
        consola.info('[buildStart]')
      },
      resolveId(id) {
        consola.info('[resolveId]', id)
      },
      load(id) {
        consola.info('[load]', id)
      },
      shouldTransformCachedModule(options) {
        consola.info('[shouldTransformCachedModule]', options)
      },
      transform(_code, id) {
        consola.info('[transform]', id)
      },
      moduleParsed(moduleInfo) {
        consola.info('[moduleParsed]', moduleInfo.id)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      renderDynamicImport({ moduleId }) {
        consola.info('[renderDynamicImport]', moduleId)
      },
      buildEnd() {
        consola.info('[buildEnd]')
      },
    })
  }
  if (stage.output) {
    plugins.push({
      name: 'weapp-vite:custom-output',
      // start Output Generation Hooks
      outputOptions(_options) {
        consola.info('[outputOptions]')
      },
      renderStart() {
        consola.info('[renderStart]')
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      renderDynamicImport({ moduleId }) {
        consola.info('[renderDynamicImport]', moduleId)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      resolveFileUrl({ moduleId }) {
        consola.info('[resolveFileUrl]', moduleId)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      resolveImportMeta(_property, { moduleId }) {
        consola.info('[resolveImportMeta]', moduleId)
      },
      banner() {
        consola.info('[banner]')
        return '// custom banner'
      },
      footer() {
        consola.info('[footer]')
        return '// custom footer'
      },
      intro() {
        consola.info('[intro]')
        return '// custom intro'
      },
      outro() {
        consola.info('[outro]')
        return '// custom outro'
      },
      renderChunk(_code, chunk) {
        consola.info('[renderChunk]', chunk.name)
      },
      generateBundle() {
        consola.info('[generateBundle]')
      },
      writeBundle() {
        consola.info('[writeBundle]')
      },
      renderError(_error) {
        consola.info('[renderError]')
      },
      closeBundle() {
        consola.info('[closeBundle]')
      },
    })
  }

  return plugins
}
