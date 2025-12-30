import type { NodePath } from '@babel/traverse'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { getSourceFromVirtualId } from '../vue/resolver'

const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
const generate: typeof generateModule = (generateModule as any).default ?? generateModule

const WE_VU_MODULE_ID = 'wevu'

const WE_VU_PAGE_HOOK_TO_FEATURE = {
  onPageScroll: 'enableOnPageScroll',
  onPullDownRefresh: 'enableOnPullDownRefresh',
  onReachBottom: 'enableOnReachBottom',
  onRouteDone: 'enableOnRouteDone',
  onTabItemTap: 'enableOnTabItemTap',
  onResize: 'enableOnResize',
  onShareAppMessage: 'enableOnShareAppMessage',
  onShareTimeline: 'enableOnShareTimeline',
  onAddToFavorites: 'enableOnAddToFavorites',
  onSaveExitState: 'enableOnSaveExitState',
} as const

export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]

function isStaticObjectKeyMatch(key: t.Expression | t.PrivateName, expected: string) {
  if (t.isIdentifier(key)) {
    return key.name === expected
  }
  if (t.isStringLiteral(key)) {
    return key.value === expected
  }
  return false
}

function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if (isStaticObjectKeyMatch(prop.key, key)) {
      return prop
    }
  }
  return null
}

export function collectWevuPageFeatureFlags(ast: t.File): Set<WevuPageFeatureFlag> {
  const namedHookLocals = new Map<string, WevuPageFeatureFlag>()
  const namespaceLocals = new Set<string>()

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== WE_VU_MODULE_ID) {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          const importedName = specifier.imported.name as keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE
          const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName]
          if (matched) {
            namedHookLocals.set(specifier.local.name, matched)
          }
        }
        else if (t.isImportNamespaceSpecifier(specifier)) {
          namespaceLocals.add(specifier.local.name)
        }
      }
    },
  })

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set()
  }

  const enabled = new Set<WevuPageFeatureFlag>()

  function consumeHookCallByName(name: string) {
    const matched = namedHookLocals.get(name)
    if (matched) {
      enabled.add(matched)
    }
  }

  function consumeNamespaceHookCall(namespace: string, hookName: string) {
    if (!namespaceLocals.has(namespace)) {
      return
    }
    const matched = (WE_VU_PAGE_HOOK_TO_FEATURE as any)[hookName] as WevuPageFeatureFlag | undefined
    if (matched) {
      enabled.add(matched)
    }
  }

  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
    OptionalCallExpression(path) {
      const callee = path.node.callee
      if (t.isIdentifier(callee)) {
        consumeHookCallByName(callee.name)
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object)) {
        const property = callee.property
        if (t.isIdentifier(property)) {
          consumeNamespaceHookCall(callee.object.name, property.name)
        }
      }
    },
  })

  return enabled
}

export function injectWevuPageFeatureFlagsIntoOptionsObject(
  optionsObject: t.ObjectExpression,
  enabled: Set<WevuPageFeatureFlag>,
): boolean {
  if (!enabled.size) {
    return false
  }

  const expectedKeys = Array.from(enabled)
  const existingFeaturesProp = getObjectPropertyByKey(optionsObject, 'features')

  if (!existingFeaturesProp) {
    const featuresObject = t.objectExpression(
      expectedKeys.map((key) => {
        return t.objectProperty(t.identifier(key), t.booleanLiteral(true))
      }),
    )

    const setupIndex = optionsObject.properties.findIndex((prop) => {
      return t.isObjectProperty(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')
    })
    const insertAt = setupIndex >= 0 ? setupIndex : 0

    optionsObject.properties.splice(
      insertAt,
      0,
      t.objectProperty(t.identifier('features'), featuresObject),
    )
    return true
  }

  if (!t.isObjectExpression(existingFeaturesProp.value)) {
    return false
  }

  const featuresObject = existingFeaturesProp.value
  let changed = false

  for (const key of expectedKeys) {
    const existing = getObjectPropertyByKey(featuresObject, key)
    if (existing) {
      continue
    }
    featuresObject.properties.push(
      t.objectProperty(t.identifier(key), t.booleanLiteral(true)),
    )
    changed = true
  }

  return changed
}

function isTopLevel(path: NodePath<t.Node>) {
  return path.getFunctionParent() == null
}

export function injectWevuPageFeaturesInJs(
  source: string,
): { code: string, transformed: boolean } {
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  }) as unknown as t.File

  const enabled = collectWevuPageFeatureFlags(ast)
  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  const defineComponentLocals = new Set<string>()
  const createWevuComponentLocals = new Set<string>()
  const namespaceLocals = new Set<string>()

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== WE_VU_MODULE_ID) {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          const importedName = specifier.imported.name
          if (importedName === 'defineComponent') {
            defineComponentLocals.add(specifier.local.name)
          }
          else if (importedName === 'createWevuComponent') {
            createWevuComponentLocals.add(specifier.local.name)
          }
        }
        else if (t.isImportNamespaceSpecifier(specifier)) {
          namespaceLocals.add(specifier.local.name)
        }
      }
    },
  })

  if (defineComponentLocals.size === 0 && createWevuComponentLocals.size === 0 && namespaceLocals.size === 0) {
    return { code: source, transformed: false }
  }

  const targets: t.ObjectExpression[] = []

  const maybeCollectTarget = (callee: t.CallExpression['callee'], args: t.Expression[]) => {
    if (args.length < 1) {
      return
    }
    const first = args[0]
    if (!t.isObjectExpression(first)) {
      return
    }

    if (t.isV8IntrinsicIdentifier(callee)) {
      return
    }

    if (t.isIdentifier(callee) && (defineComponentLocals.has(callee.name) || createWevuComponentLocals.has(callee.name))) {
      targets.push(first)
      return
    }

    if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
      if (!namespaceLocals.has(callee.object.name)) {
        return
      }
      if (callee.property.name === 'defineComponent' || callee.property.name === 'createWevuComponent') {
        targets.push(first)
      }
    }
  }

  traverse(ast, {
    CallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      maybeCollectTarget(path.node.callee, path.node.arguments.filter(t.isExpression))
    },
    OptionalCallExpression(path) {
      if (!isTopLevel(path)) {
        return
      }
      maybeCollectTarget(path.node.callee, path.node.arguments.filter(t.isExpression))
    },
  })

  if (!targets.length) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const target of targets) {
    changed = injectWevuPageFeatureFlagsIntoOptionsObject(target, enabled) || changed
  }

  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}

export function createPageEntryMatcher(ctx: CompilerContext) {
  let cached: Set<string> | undefined

  async function ensure() {
    const { configService, scanService } = ctx
    if (!configService || !scanService) {
      return new Set<string>()
    }
    if (cached) {
      return cached
    }

    const set = new Set<string>()
    const appEntry = await scanService.loadAppEntry()
    for (const pageEntry of appEntry.json?.pages ?? []) {
      const normalized = String(pageEntry).replace(/^[\\/]+/, '')
      if (!normalized) {
        continue
      }
      set.add(path.resolve(configService.absoluteSrcRoot, normalized))
    }

    for (const meta of scanService.loadSubPackages()) {
      const root = meta.subPackage.root ?? ''
      for (const pageEntry of meta.subPackage.pages ?? []) {
        const normalized = String(pageEntry).replace(/^[\\/]+/, '')
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, root, normalized))
      }
    }

    if (scanService.pluginJson) {
      const pluginPages = Object.values((scanService.pluginJson as any).pages ?? {})
      for (const entry of pluginPages) {
        const normalized = String(entry).replace(/^[\\/]+/, '')
        if (!normalized) {
          continue
        }
        set.add(path.resolve(configService.absoluteSrcRoot, removeExtensionDeep(normalized)))
      }
    }

    cached = set
    return set
  }

  return {
    markDirty() {
      cached = undefined
    },
    async isPageFile(filePath: string) {
      const pages = await ensure()
      const normalized = removeExtensionDeep(filePath)
      return pages.has(normalized)
    },
  }
}

export function createWevuAutoPageFeaturesPlugin(ctx: CompilerContext): Plugin {
  const matcher = createPageEntryMatcher(ctx)

  return {
    name: 'weapp-vite:wevu:page-features',
    enforce: 'pre',
    async transform(code, id) {
      const configService = ctx.configService
      const scanService = ctx.scanService
      if (!configService || !scanService) {
        return null
      }

      // app.json 变更会影响 pages 列表，这里直接跟随 scanService 的 dirty 标记。
      if (ctx.runtimeState.scan.isDirty) {
        matcher.markDirty()
      }

      const sourceId = getSourceFromVirtualId(id).split('?', 1)[0]
      if (!sourceId) {
        return null
      }
      if (sourceId.endsWith('.vue')) {
        return null
      }
      if (!/\.[cm]?[jt]sx?$/.test(sourceId)) {
        return null
      }

      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      if (!(await matcher.isPageFile(filename))) {
        return null
      }

      const result = injectWevuPageFeaturesInJs(code)
      if (!result.transformed) {
        return null
      }

      return {
        code: result.code,
        map: null,
      }
    },
  }
}
