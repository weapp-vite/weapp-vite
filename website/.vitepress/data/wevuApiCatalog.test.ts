import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPOSITION_API_E2E_NAMES } from '../../../e2e-apps/wevu-runtime-e2e/src/shared/compositionApiCoverage'
import { getApiEntryHref, getCoreCategoryHref, matchesWevuApiSearch, resolveWevuApiNavigation, wevuApiCatalog, wevuCoreCategories } from './wevuApiCatalog'
import { DEFAULT_API_COMPATIBILITIES, hasDefaultApiCompatibilities, resetWevuApiFacets, toggleWevuApiCompatibility } from './wevuApiReferenceState'
import { wevuApiSidebarItems } from './wevuApiSidebar'

const websiteRoot = path.resolve(import.meta.dirname, '../..')
const includeRE = /<!--\s*@include:\s*(\S+)\s*-->/g

async function readMarkdownWithIncludes(sourcePath: string, seen = new Set<string>()): Promise<string> {
  const normalizedPath = path.normalize(sourcePath)
  if (seen.has(normalizedPath)) {
    throw new Error(`circular markdown include: ${normalizedPath}`)
  }

  const source = await fs.readFile(normalizedPath, 'utf8')
  const nextSeen = new Set(seen).add(normalizedPath)
  const matches = [...source.matchAll(includeRE)]
  let resolved = source

  for (const match of matches) {
    const includePath = path.resolve(path.dirname(normalizedPath), match[1])
    const included = await readMarkdownWithIncludes(includePath, nextSeen)
    resolved = resolved.replace(match[0], included)
  }

  return resolved
}

function getAnchoredSection(source: string, anchor: string) {
  const anchorToken = `{#${anchor}}`
  const start = source.indexOf(anchorToken)
  if (start < 0) {
    return undefined
  }
  const nextHeading = source.slice(start + anchorToken.length).search(/^#{2,3}\s+/m)
  return nextHeading < 0
    ? source.slice(start)
    : source.slice(start, start + anchorToken.length + nextHeading)
}

function getContainingH2Section(source: string, anchor: string) {
  const anchorIndex = source.indexOf(`{#${anchor}}`)
  if (anchorIndex < 0) {
    return undefined
  }
  const sectionStart = source.lastIndexOf('\n## ', anchorIndex)
  if (sectionStart < 0) {
    return undefined
  }
  const sectionEnd = source.indexOf('\n## ', anchorIndex)
  return sectionEnd < 0 ? source.slice(sectionStart) : source.slice(sectionStart, sectionEnd)
}

function collectSidebarLinks(items = wevuApiSidebarItems): string[] {
  return items.flatMap(item => [
    ...(item.link ? [item.link] : []),
    ...collectSidebarLinks(item.items || []),
  ])
}

function hasSignature(section: string) {
  return /(?:类型签名|类型定义|运行时值)：/.test(section)
    || /```(?:ts|typescript)\n[\s\S]*?(?:function|interface|type|const|=>)[\s\S]*?```/.test(section)
}

function hasExample(section: string) {
  return /(?:示例|共用示例)(?:\*\*)?：(?:\*\*)?(?:\s*见)?\s*\[/.test(section)
    || /```(?:vue|ts|typescript|js|javascript)\n[\s\S]*?```/.test(section)
}

function plainName(name: string) {
  return name.replace(/\(\)$/, '')
}

describe('wevu API catalog', () => {
  it('contains every API covered by the runtime e2e fixture', () => {
    const catalogNames = new Set(wevuApiCatalog.map(item => plainName(item.name)))

    for (const name of COMPOSITION_API_E2E_NAMES) {
      expect(catalogNames, `missing e2e-covered API ${name}`).toContain(name)
    }
  })

  it('keeps identifiers unique and covers macros and Options API', () => {
    const identifiers = wevuApiCatalog.map(item => `${item.entry}:${item.name}`)
    expect(new Set(identifiers).size).toBe(identifiers.length)

    const names = new Set(wevuApiCatalog.map(item => item.name))
    for (const macro of ['defineProps()', 'withDefaults()', 'defineEmits()', 'defineSlots()', 'defineExpose()', 'defineModel()', 'defineOptions()', 'definePageMeta()', 'defineAppSetup()', 'defineAppJson()', 'definePageJson()', 'defineComponentJson()', 'defineSitemapJson()', 'defineThemeJson()']) {
      expect(names, `missing macro ${macro}`).toContain(macro)
    }
    for (const option of ['props', 'emits', 'data', 'setup', 'computed', 'methods', 'watch', 'properties', 'lifetimes', 'pageLifetimes', 'features', 'setData', 'setupLifecycle']) {
      expect(names, `missing option ${option}`).toContain(option)
    }
  })

  it('gives every API a concise searchable description', () => {
    for (const item of wevuApiCatalog) {
      expect(item.description.trim(), `missing description for ${item.entry}:${item.name}`).not.toBe('')
      expect(item.description.length, `description is too long for ${item.entry}:${item.name}`).toBeLessThanOrEqual(40)
    }
  })

  it('matches APIs by words found only in their descriptions', () => {
    const patch = wevuApiCatalog.find(item => item.entry === 'wevu/store' && item.name === '$patch()')!
    const onError = wevuApiCatalog.find(item => item.entry === 'wevu/router' && item.name === 'router.onError()')!

    expect(matchesWevuApiSearch(patch, '批量修改')).toBe(true)
    expect(matchesWevuApiSearch(onError, '异常型')).toBe(true)
    expect(matchesWevuApiSearch(patch, '前置守卫')).toBe(false)
  })

  it('searches application methods, directives, transformed tags, and types', () => {
    expect(wevuApiCatalog.some(item => matchesWevuApiSearch(item, 'globalProperties'))).toBe(true)
    expect(wevuApiCatalog.some(item => matchesWevuApiSearch(item, 'v-model'))).toBe(true)
    expect(wevuApiCatalog.some(item => item.name === '<div>' && matchesWevuApiSearch(item, 'view'))).toBe(true)
    expect(wevuApiCatalog.some(item => matchesWevuApiSearch(item, 'PropType'))).toBe(true)
  })

  it('preserves the search query when category navigation resets facets', () => {
    expect(resetWevuApiFacets({
      query: 'v-model',
      compatibilities: ['vue-different', 'unsupported'],
      scope: 'component',
    })).toEqual({
      query: 'v-model',
      compatibilities: DEFAULT_API_COMPATIBILITIES,
      scope: 'all',
    })
  })

  it('uses compatibility tags as a multi-select with unsupported hidden by default', () => {
    expect(DEFAULT_API_COMPATIBILITIES).not.toContain('unsupported')
    expect(hasDefaultApiCompatibilities(DEFAULT_API_COMPATIBILITIES)).toBe(true)

    const withUnsupported = toggleWevuApiCompatibility(DEFAULT_API_COMPATIBILITIES, 'unsupported')
    expect(withUnsupported).toContain('unsupported')
    expect(hasDefaultApiCompatibilities(withUnsupported)).toBe(false)

    expect(toggleWevuApiCompatibility(withUnsupported, 'unsupported')).toEqual(DEFAULT_API_COMPATIBILITIES)
  })

  it('keeps the root, router, and store entry tabs populated', () => {
    for (const entry of ['wevu', 'wevu/router', 'wevu/store']) {
      expect(wevuApiCatalog.some(item => item.entry === entry), `empty entry tab ${entry}`).toBe(true)
    }
  })

  it('classifies every core API group exactly once', () => {
    const catalogGroups = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu').map(item => item.group))
    const categoryGroups = wevuCoreCategories.flatMap(category => category.group ? [category.group] : [])

    expect(new Set(categoryGroups).size).toBe(categoryGroups.length)
    expect(new Set(categoryGroups)).toEqual(catalogGroups)
  })

  it('keeps entry and category URLs shareable', () => {
    expect(getApiEntryHref('core')).toBe('/wevu/api/')
    expect(getApiEntryHref('router')).toBe('/wevu/api/?entry=router')
    expect(getApiEntryHref('store')).toBe('/wevu/api/?entry=store')
    expect(getCoreCategoryHref('reactivity')).toBe('/wevu/api/?category=reactivity')

    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?category=lifecycle'))).toEqual({
      category: 'lifecycle',
      entry: 'core',
    })
    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?entry=router&category=lifecycle'))).toEqual({
      category: 'all',
      entry: 'router',
    })
    expect(resolveWevuApiNavigation(new URL('https://example.test/wevu/api/?category=unknown'))).toEqual({
      category: 'all',
      entry: 'core',
    })
  })

  it('covers the complete public Store surface', () => {
    const storeNames = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu/store').map(item => item.name))
    const expectedNames = [
      'defineStore()',
      'createStore()',
      'storeToRefs()',
      '$id',
      '$state',
      '$patch()',
      '$reset()',
      '$subscribe()',
      '$onAction()',
      'manager.install()',
      'manager.use()',
      'state',
      'getters',
      'actions',
      'StoreManager',
      'DefineStoreOptions',
      'StoreToRefsResult',
      'ActionContext',
      'ActionSubscriber',
      'SubscriptionCallback',
      'StoreSubscribeOptions',
      'MutationType',
    ]

    expect(storeNames).toEqual(new Set(expectedNames))
  })

  it('covers RuntimeApp, template directives, HTML mappings, and type helpers', () => {
    const names = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu').map(item => item.name))
    for (const name of ['app.mount()', 'app.unmount()', 'app.onUnmount()', 'app.use()', 'app.provide()', 'app.config', 'app.config.globalProperties', 'app.version']) {
      expect(names, `missing RuntimeApp member ${name}`).toContain(name)
    }
    for (const name of ['v-text', 'v-html', 'v-show', 'v-if', 'v-else-if', 'v-else', 'v-for', 'v-on', 'v-bind', 'v-model', 'v-slot', 'v-pre', 'v-once', 'v-memo', 'v-cloak', 'v-custom']) {
      expect(names, `missing directive ${name}`).toContain(name)
    }
    for (const name of ['<component>', '<slot>', '<template>', '<Transition>', '<KeepAlive>', '<Teleport>', '<Suspense>', '<div>', '<span>', '<img>', '<a>']) {
      expect(names, `missing template entry ${name}`).toContain(name)
    }
    for (const name of ['PropType<T>', 'MaybeRef<T>', 'MaybeRefOrGetter<T>', 'ExtractPropTypes<T>', 'ExtractPublicPropTypes<T>', 'RuntimeApp', 'AppConfig', 'WevuPlugin']) {
      expect(names, `missing type ${name}`).toContain(name)
    }
  })

  it('records Vue gaps as unsupported official references', () => {
    for (const name of ['createSSRApp()', 'app.component()', 'app.directive()', 'app.mixin()', 'app.runWithContext()', 'onWatcherCleanup()', 'useId()', '<Teleport>', 'h()', 'defineCustomElement()', 'renderToString()', 'createRenderer()']) {
      const item = wevuApiCatalog.find(candidate => candidate.name === name)
      expect(item, `missing Vue baseline entry ${name}`).toBeDefined()
      expect(item?.compatibility).toBe('unsupported')
      expect(item?.vueHref).toMatch(/^https:\/\/cn\.vuejs\.org\/api\//)
    }
  })

  it('covers the complete public Router surface', () => {
    const routerNames = new Set(wevuApiCatalog.filter(item => item.entry === 'wevu/router').map(item => item.name))
    const expectedNames = [
      'createRouter()',
      'useRouter()',
      'useRoute()',
      'useNativeRouter()',
      'useNativePageRouter()',
      'resolveRouteLocation()',
      'parseQuery()',
      'stringifyQuery()',
      'createNavigationFailure()',
      'isNavigationFailure()',
      'NavigationFailureType',
      'router.nativeRouter',
      'router.options',
      'router.currentRoute',
      'router.install()',
      'router.resolve()',
      'router.isReady()',
      'router.push()',
      'router.replace()',
      'router.back()',
      'router.go()',
      'router.forward()',
      'router.hasRoute()',
      'router.getRoutes()',
      'router.addRoute()',
      'router.removeRoute()',
      'router.clearRoutes()',
      'router.beforeEach()',
      'router.beforeResolve()',
      'router.afterEach()',
      'router.onError()',
      'RouterNavigation',
      'UseRouterOptions',
      'AddRoute',
      'RouteLocationRaw',
      'RouteLocationNormalizedLoaded',
      'RouteLocationRedirectedFrom',
      'LocationQuery',
      'LocationQueryRaw',
      'LocationQueryValue',
      'LocationQueryValueRaw',
      'RouteParams',
      'RouteParamsRaw',
      'RouteParamValue',
      'RouteParamValueRaw',
      'RouteParamsMode',
      'RouteQueryParser',
      'RouteQueryStringifier',
      'NavigationFailure',
      'NavigationFailureTypeValue',
      'NavigationMode',
      'NavigationRedirect',
      'NavigationGuard',
      'NavigationGuardResult',
      'NavigationGuardContext',
      'NavigationAfterEach',
      'NavigationAfterEachContext',
      'NavigationErrorHandler',
      'NavigationErrorContext',
      'NamedRouteRecord',
      'NamedRoutes',
      'RouteMeta',
      'RouteRecordInput',
      'RouteRecordRaw',
      'RouteRecordMatched',
      'RouteRecordRedirect',
      'SetupContextRouter',
      'RouterNavigateToOption',
      'RouterRedirectToOption',
      'RouterReLaunchOption',
      'RouterSwitchTabOption',
      'TypedRouterUrl',
      'TypedRouterTabBarUrl',
      'WevuTypedRouterRouteMap',
    ]

    expect(routerNames).toEqual(new Set(expectedNames))
  })

  it('documents every catalog item with an explicit anchor and useful reference content', async () => {
    const sources = new Map<string, string>()
    for (const item of wevuApiCatalog) {
      const [pathname, anchor] = item.href.split('#')
      if (!pathname.startsWith('/wevu/')) {
        continue
      }
      const relativePath = pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}.md`
      const sourcePath = path.join(websiteRoot, relativePath)
      const source = sources.get(sourcePath) || await readMarkdownWithIncludes(sourcePath)
      sources.set(sourcePath, source)
      if (anchor) {
        expect(source, `missing anchor ${item.href}`).toContain(`{#${anchor}}`)
        const section = getAnchoredSection(source, anchor)!
        const prose = section
          .replace(/```[\s\S]*?```/g, '')
          .replace(/<!--.*?-->/gs, '')
          .replace(/[#*`[\](){}:|>-]/g, '')
          .replace(/\s+/g, '')
        const minimumDescriptionLength = item.href.startsWith('/wevu/api/') && item.kind !== 'type' ? 45 : 15
        expect(prose.length, `description is too terse for ${item.entry}:${item.name}`).toBeGreaterThanOrEqual(minimumDescriptionLength)
        if (!item.href.startsWith('/wevu/api/') || item.kind === 'type') {
          continue
        }
        expect(hasSignature(section), `missing signature for ${item.entry}:${item.name}`).toBe(true)
        expect(hasExample(section), `missing example for ${item.entry}:${item.name}`).toBe(true)
        const group = getContainingH2Section(source, anchor)
        expect(group, `missing H2 section for ${item.entry}:${item.name}`).toBeDefined()
        expect(group, `missing colocated group example for ${item.entry}:${item.name}`).toMatch(/### 本组示例 \{#example-[^}]+\}/)
        expect(group, `missing code in group for ${item.entry}:${item.name}`).toMatch(/```(?:vue|ts|typescript|js|javascript)\n/)
        const exampleLine = section.split('\n').find(line => line.startsWith('**示例：** 见 [本组示例]'))
        const exampleAnchor = exampleLine?.split('#')[1]?.split(')')[0]
        expect(exampleAnchor, `missing group example link for ${item.entry}:${item.name}`).toBeTruthy()
        expect(group, `group example link escapes its group for ${item.entry}:${item.name}`).toContain(`{#${exampleAnchor}}`)
        if (item.compatibility === 'vue-different') {
          expect(section, `missing Vue difference for ${item.entry}:${item.name}`).toMatch(/Vue(?: Router|\/Pinia)? 差异：/)
        }
      }
    }
  })

  it('keeps API anchors in the sidebar instead of adding controls to the article', async () => {
    const apiItems = wevuApiCatalog.filter(item => item.href.startsWith('/wevu/api/'))
    const pagePaths = new Set(apiItems.map(item => item.href.split('#')[0]))
    const sidebarLinks = new Set(collectSidebarLinks())

    for (const item of apiItems) {
      expect(sidebarLinks, `missing sidebar link for ${item.entry}:${item.name}`).toContain(item.href)
    }

    for (const pathname of pagePaths) {
      const sourcePath = path.join(websiteRoot, `${pathname}.md`)
      const source = await readMarkdownWithIncludes(sourcePath)
      const pageSource = await fs.readFile(sourcePath, 'utf8')

      expect(pageSource, `missing fixed outline depth for ${pathname}`).toMatch(/level: \[(?:2, 2|3, 3)\]/)
      expect(source, `article contains obsolete disclosure controls for ${pathname}`).not.toMatch(/WevuApiDoc(?:Page|Group)/)
    }
  })
})
