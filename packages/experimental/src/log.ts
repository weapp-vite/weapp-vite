import type { Plugin } from 'rolldown-vite'

import { defu } from 'defu'

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
        console.info('[watchChange]', id)
      },
      closeWatcher() {
        console.info('[closeWatcher]')
      },
      // Build Hooks
      options(_options) {
        console.info('[options]')
      },
      buildStart() {
        console.info('[buildStart]')
      },
      resolveId(id) {
        console.info('[resolveId]', id)
      },
      load(id) {
        console.info('[load]', id)
      },
      shouldTransformCachedModule(options) {
        console.info('[shouldTransformCachedModule]', options)
      },
      transform(_code, id) {
        console.info('[transform]', id)
      },
      moduleParsed(moduleInfo) {
        console.info('[moduleParsed]', moduleInfo.id)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      renderDynamicImport({ moduleId }) {
        console.info('[renderDynamicImport]', moduleId)
      },
      buildEnd() {
        console.info('[buildEnd]')
      },
    })
  }
  if (stage.output) {
    plugins.push({
      name: 'weapp-vite:custom-output',
      // start Output Generation Hooks
      outputOptions(_options) {
        console.info('[outputOptions]')
      },
      renderStart() {
        console.info('[renderStart]')
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      renderDynamicImport({ moduleId }) {
        console.info('[renderDynamicImport]', moduleId)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      resolveFileUrl({ moduleId }) {
        console.info('[resolveFileUrl]', moduleId)
      },
      // rolldown vite 暂时不支持
      // @ts-ignore
      resolveImportMeta(_property, { moduleId }) {
        console.info('[resolveImportMeta]', moduleId)
      },
      banner() {
        console.info('[banner]')
        return '// custom banner'
      },
      footer() {
        console.info('[footer]')
        return '// custom footer'
      },
      intro() {
        console.info('[intro]')
        return '// custom intro'
      },
      outro() {
        console.info('[outro]')
        return '// custom outro'
      },
      renderChunk(_code, chunk) {
        console.info('[renderChunk]', chunk.name)
      },
      generateBundle() {
        console.info('[generateBundle]')
      },
      writeBundle() {
        console.info('[writeBundle]')
      },
      renderError(_error) {
        console.info('[renderError]')
      },
      closeBundle() {
        console.info('[closeBundle]')
      },
    })
  }

  return plugins
}
