import type { Plugin } from 'vite'
import consola from 'consola'
import { defu } from 'defu'

export interface UserDefinedOptions {
  stage: {
    build?: boolean
    output?: boolean
  }
}

export function customLoadEntry(options?: UserDefinedOptions): Plugin[] {
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
      renderDynamicImport({ moduleId }) {
        consola.info('[renderDynamicImport]', moduleId)
      },
      resolveFileUrl({ moduleId }) {
        consola.info('[resolveFileUrl]', moduleId)
      },
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
