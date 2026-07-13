import path from 'node:path'
import { createLanguage } from '@volar/language-core'
import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import plugin from '../src/index'

const vueCompilerOptions = {
  target: 3.5,
  lib: 'vue',
  typesRoot: '',
  extensions: ['.vue'],
  vitePressExtensions: [],
  petiteVueExtensions: [],
  jsxSlots: false,
  strictVModel: false,
  strictCssModules: false,
  checkUnknownProps: false,
  checkUnknownEvents: false,
  checkUnknownDirectives: false,
  checkUnknownComponents: false,
  inferComponentDollarEl: false,
  inferComponentDollarRefs: false,
  inferTemplateDollarAttrs: false,
  inferTemplateDollarEl: false,
  inferTemplateDollarRefs: false,
  inferTemplateDollarSlots: false,
  skipTemplateCodegen: false,
  fallthroughAttributes: false,
  resolveStyleImports: false,
  resolveStyleClassNames: false,
  fallthroughComponentNames: [],
  dataAttributes: [],
  htmlAttributes: [],
  optionsWrapper: [],
  macros: {
    defineProps: ['defineProps'],
    defineSlots: ['defineSlots'],
    defineEmits: ['defineEmits'],
    defineExpose: ['defineExpose'],
    defineModel: ['defineModel'],
    defineOptions: ['defineOptions'],
    withDefaults: ['withDefaults'],
  },
  composables: {
    useAttrs: ['useAttrs'],
    useCssModule: ['useCssModule'],
    useSlots: ['useSlots'],
    useTemplateRef: ['useTemplateRef'],
  },
  plugins: [plugin],
  experimentalModelPropName: {},
} as const

function createNavigationService(files: Map<string, string>) {
  const compilerOptions: ts.CompilerOptions = {
    allowNonTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
  }
  const languagePlugin = createVueLanguagePlugin<string>(
    ts,
    compilerOptions,
    vueCompilerOptions,
    id => id,
  )
  const language = createLanguage(
    [languagePlugin],
    new Map(),
    (id) => {
      const content = files.get(id) ?? ts.sys.readFile(id)
      if (content !== undefined) {
        language.scripts.set(
          id,
          ts.ScriptSnapshot.fromString(content),
          id.endsWith('.vue') ? 'vue' : 'typescript',
        )
      }
    },
  )

  const host: ts.LanguageServiceHost = {
    fileExists: fileName => files.has(fileName) || ts.sys.fileExists(fileName),
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [...files.keys()],
    getScriptSnapshot(fileName) {
      const content = files.get(fileName) ?? ts.sys.readFile(fileName)
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content)
    },
    getScriptVersion: () => '0',
    readDirectory: ts.sys.readDirectory,
    readFile: fileName => files.get(fileName) ?? ts.sys.readFile(fileName),
    resolveModuleNameLiterals(moduleLiterals, containingFile, redirectedReference, options) {
      return moduleLiterals.map(moduleLiteral => ts.resolveModuleName(
        moduleLiteral.text,
        containingFile,
        options,
        host,
        undefined,
        redirectedReference,
      ))
    },
  }
  decorateLanguageServiceHost(ts, language, host)
  const languageService = ts.createLanguageService(host)
  const { proxy, initialize } = createProxyLanguageService(languageService)
  initialize(language)
  return proxy
}

function findOffset(source: string, text: string, occurrence = 0) {
  let offset = -1
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(text, offset + 1)
  }
  expect(offset).toBeGreaterThanOrEqual(0)
  return offset
}

describe('Volar navigation', () => {
  it('preserves import, template prop and event handler definitions through default parser ownership', () => {
    const fixtureDir = path.resolve('packages/volar/test/fixtures/navigation')
    const parentFile = path.join(fixtureDir, 'Parent.vue')
    const childFile = path.join(fixtureDir, 'Child.vue')
    const parentSource = `<script setup lang="ts">
import CartGroup from './Child.vue'
const props = defineProps<{ storeGoods: string[] }>()
function onGoodsSelect() {}
</script>
<template>
  <CartGroup :store-goods="props.storeGoods" @selectgoods="onGoodsSelect" />
</template>`
    const childSource = `<script setup lang="ts">
defineProps<{ storeGoods: string[] }>()
defineEmits<{ selectgoods: [] }>()
</script>
<template><view /></template>`
    const service = createNavigationService(new Map([
      [parentFile, parentSource],
      [childFile, childSource],
    ]))

    const importDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, './Child.vue') + 3,
    )
    expect(importDefinitions?.some(definition => definition.fileName === childFile)).toBe(true)

    const propDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, 'store-goods'),
    )
    expect(propDefinitions?.some(definition => definition.fileName === parentFile
      && definition.name === 'storeGoods')).toBe(true)

    const handlerDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, 'onGoodsSelect', 1),
    )
    expect(handlerDefinitions?.some(definition => definition.fileName === parentFile
      && definition.name === 'onGoodsSelect')).toBe(true)
  })
})
