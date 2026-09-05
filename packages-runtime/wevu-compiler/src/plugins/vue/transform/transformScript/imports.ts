import type { TransformState } from './utils'
import * as t from '@weapp-vite/ast/babelTypes'
import { resolveWevuInternalImportModuleId, WE_VU_MODULE_ID, WE_VU_RUNTIME_APIS } from '../../../../constants'
import { ensureRuntimeImport } from '../scriptRuntimeImport'

const INTERNAL_RUNTIME_VALUE_EXPORTS = new Set([
  'addMutationRecorder',
  'batch',
  'computed',
  'createTextVNode',
  'createVNode',
  'createApp',
  'createWevuComponent',
  'createWevuScopedSlotComponent',
  'customRef',
  'defineAppSetup',
  'defineComponent',
  'effect',
  'effectScope',
  'endBatch',
  'getCurrentInstance',
  'getCurrentPageStackSnapshot',
  'getCurrentScope',
  'getCurrentSetupContext',
  'getDeepWatchStrategy',
  'Fragment',
  'getNavigationBarMetrics',
  'getReactiveVersion',
  'hasInjectionContext',
  'inject',
  'injectGlobal',
  'isNoSetData',
  'isProxy',
  'isRaw',
  'isReactive',
  'isReadonly',
  'isRef',
  'isShallowReactive',
  'isShallowRef',
  'isVNode',
  'markNoSetData',
  'markRaw',
  'mergeModels',
  'mergeProps',
  'mountRuntimeInstance',
  'nextTick',
  'normalizeClass',
  'normalizeJsxIsland',
  'normalizeStyle',
  'onActivated',
  'onAddToFavorites',
  'onAttached',
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onDeactivated',
  'onDetached',
  'onError',
  'onErrorCaptured',
  'onHide',
  'onLaunch',
  'onLoad',
  'onMemoryWarning',
  'onMounted',
  'onMoved',
  'onPageNotFound',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onScopeDispose',
  'onServerPrefetch',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onThemeChange',
  'onUnhandledRejection',
  'onUnload',
  'onUnmounted',
  'onUpdated',
  'prelinkReactiveTree',
  'provide',
  'provideGlobal',
  'reactive',
  'resolveDirective',
  'resolveComponent',
  'readonly',
  'ref',
  'registerApp',
  'registerComponent',
  'removeMutationRecorder',
  'resetWevuDefaults',
  'resolveLayoutBridge',
  'resolveLayoutHost',
  'resolvePropValue',
  'resolveRuntimePageLayoutName',
  'runSetupFunction',
  'setCurrentInstance',
  'setCurrentSetupContext',
  'setDeepWatchStrategy',
  'setGlobalProvidedValue',
  'setPageLayout',
  'setRuntimeSetDataVisibility',
  'setWevuDefaults',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'startBatch',
  'stop',
  'syncRuntimePageLayoutState',
  'syncRuntimePageLayoutStateFromRuntime',
  'teardownRuntimeInstance',
  'toRaw',
  'toRef',
  'toRefs',
  'toValue',
  'transformOn',
  'touchReactive',
  'traverse',
  'triggerRef',
  'unref',
  'useAttrs',
  'useCssModule',
  'useCssVars',
  'useAsyncDerivation',
  'useAsyncPullDownRefresh',
  'useBindModel',
  'useBoundingClientRect',
  'useChangeModel',
  'useDisposables',
  'useElementIntersectionObserver',
  'useIntersectionObserver',
  'useLayoutBridge',
  'useLayoutHosts',
  'useModel',
  'useNativeInstance',
  'useNativePageRouter',
  'useNativeRouter',
  'useNavigationBarMetrics',
  'usePageLayout',
  'usePageScrollThrottle',
  'usePageStack',
  'useScrollOffset',
  'useSelectorFields',
  'useSelectorQuery',
  'useSlots',
  'useTemplateRef',
  'useUpdatePerformanceListener',
  'version',
  'vModelCheckbox',
  'vModelRadio',
  'vModelSelect',
  'vModelText',
  'vShow',
  'withDirectives',
  'waitForLayoutHost',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
])

function ensureInternalRuntimeImport(program: t.Program, importedName: string, localName = importedName) {
  const runtimeImportPath = resolveWevuInternalImportModuleId(importedName)
  let targetImport = program.body.find(
    node => t.isImportDeclaration(node) && node.source.value === runtimeImportPath,
  ) as t.ImportDeclaration | undefined

  if (!targetImport) {
    targetImport = t.importDeclaration([], t.stringLiteral(runtimeImportPath))
    program.body.unshift(targetImport)
  }

  const hasSpecifier = targetImport.specifiers.some(
    specifier =>
      t.isImportSpecifier(specifier)
      && t.isIdentifier(specifier.imported, { name: importedName })
      && t.isIdentifier(specifier.local, { name: localName }),
  )
  if (!hasSpecifier) {
    targetImport.specifiers.push(
      t.importSpecifier(t.identifier(localName), t.identifier(importedName)),
    )
  }
}

function splitWevuNamedImportsToInternalRuntime(path: any, program: t.Program, state: TransformState) {
  if (path.node.source.value !== WE_VU_MODULE_ID || path.node.importKind === 'type') {
    return
  }

  const remaining = path.node.specifiers.filter((specifier: any) => {
    if (!t.isImportSpecifier(specifier) || specifier.importKind === 'type' || !t.isIdentifier(specifier.imported) || !t.isIdentifier(specifier.local)) {
      return true
    }
    const importedName = specifier.imported.name
    if (!INTERNAL_RUNTIME_VALUE_EXPORTS.has(importedName)) {
      return true
    }
    ensureInternalRuntimeImport(program, importedName, specifier.local.name)
    state.transformed = true
    return false
  })

  if (remaining.length === 0) {
    path.remove()
    return
  }

  if (remaining.length !== path.node.specifiers.length) {
    path.node.specifiers = remaining
  }
}

export function createImportVisitors(program: t.Program, state: TransformState) {
  return {
    ImportDeclaration(path: any) {
      if (path.node.source.value === '@vue/babel-helper-vue-transform-on') {
        const defaultImport = path.node.specifiers.find((specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier) => (
          t.isImportDefaultSpecifier(specifier)
        ))
        if (defaultImport) {
          ensureRuntimeImport(program, 'transformOn', defaultImport.local.name)
          state.transformed = true
          path.remove()
          return
        }
      }

      // 移除 defineComponent 的导入，同时记录本地别名
      if (path.node.source.value === 'vue') {
        const movedVueRuntimeAPIs = new Set([
          'createTextVNode',
          'createVNode',
          'Fragment',
          'isVNode',
          'mergeProps',
          'resolveComponent',
          'resolveDirective',
          'useAttrs',
          'useCssModule',
          'useCssVars',
          'useSlots',
          'useModel',
          'mergeModels',
          'useTemplateRef',
          'vModelCheckbox',
          'vModelRadio',
          'vModelSelect',
          'vModelText',
          'vShow',
          'withDirectives',
        ])

        // 将 Vue SFC 编译产物中的部分 Vue runtime API 迁移到 wevu：
        // - defineSlots() => useSlots()
        // - defineModel() => useModel()/mergeModels()
        // - useAttrs()/useSlots()（用户手动导入）
        const movedSpecifiers: Array<{ importedName: string, localName: string }> = []

        const remaining = path.node.specifiers.filter((specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier) => {
          if (t.isImportSpecifier(specifier) && specifier.imported.type === 'Identifier' && specifier.imported.name === WE_VU_RUNTIME_APIS.defineComponent) {
            state.defineComponentAliases.add(specifier.local.name)
            state.transformed = true
            return false
          }

          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            const importedName = specifier.imported.name
            if (movedVueRuntimeAPIs.has(importedName) && t.isIdentifier(specifier.local)) {
              movedSpecifiers.push({ importedName, localName: specifier.local.name })
              state.transformed = true
              return false
            }
          }
          return true
        })

        if (movedSpecifiers.length) {
          for (const { importedName, localName } of movedSpecifiers) {
            ensureRuntimeImport(program, importedName, localName)
          }
        }

        if (remaining.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = remaining
      }

      // 剔除 type-only 导入
      if (path.node.importKind === 'type') {
        state.transformed = true
        path.remove()
        return
      }
      const kept = path.node.specifiers.filter((specifier: any) => {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          state.transformed = true
          return false
        }
        return true
      })
      if (kept.length !== path.node.specifiers.length) {
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }

      splitWevuNamedImportsToInternalRuntime(path, program, state)
    },
  }
}
