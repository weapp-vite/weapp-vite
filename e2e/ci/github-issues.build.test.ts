/* eslint-disable e18e/ban-dependencies -- e2e build assertions reuse shared fs helpers to inspect generated artifacts. */
import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_EXPOSE_HELPER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared'
import { execa } from 'execa'
import { fdir } from 'fdir'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const ISSUE_393_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-393')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:github-issues',
    skipNpm: true,
  })
}

async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir({
    relativePaths: true,
    pathSeparator: '/',
  })
  return (await fd.crawl(root).withPromise()).sort()
}

async function runIssue393Build() {
  await fs.remove(ISSUE_393_DIST_ROOT)

  await execa('node', [
    CLI_PATH,
    'build',
    APP_ROOT,
    '--platform',
    'weapp',
    '--skipNpm',
    '--config',
    path.join(APP_ROOT, 'weapp-vite.config.ts'),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WEAPP_GITHUB_ISSUE_393: 'true',
    },
  })
}

describe.sequential('e2e app: github-issues (build)', () => {
  it('discussion #338: emits mapped wxml tags from vue html-style templates', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-338/index.wxml')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('<block wx:if="{{true}}"><view class="issue338-page">')
    expect(pageWxml).toContain('<text class="issue338-title">{{title}}</text>')
    expect(pageWxml).toContain('<image class="issue338-cover" src="{{cover}}" mode="aspectFit" />')
    expect(pageWxml).toContain('<view class="issue338-links">')
    expect(pageWxml).toContain('<navigator class="issue338-link" wx:for="{{links}}"')
    expect(pageWxml).toContain('url="{{\'/pages/\'+link+\'/index\'}}"')
    expect(pageWxml).not.toContain('<div')
    expect(pageWxml).not.toContain('<span')
    expect(pageWxml).not.toContain('<img')
    expect(pageWxml).not.toContain('<section')
    expect(pageWxml).not.toContain('<a ')
  })

  it('issue #431: replaces import.meta.env expressions inside native wxml files', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-431/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-431/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('{{\'issue-431 native wxml env replacement\'}}')
    expect(pageWxml).toContain('{{\'https://static.example.com/issue-431\'}}/logo.png')
    expect(pageWxml).toContain('data-case="double"')
    expect(pageWxml).toContain('data-template-url="{{\'/pages/issue-431/index.wxml\'}}"')
    expect(pageWxml).toContain('data-template-dir="{{\'/pages/issue-431\'}}"')
    expect(pageWxml).toContain('data-env-label="{{\'issue-431 native wxml env replacement\'}}"')
    expect(pageWxml).toContain('data-env-base="{{\'https://static.example.com/issue-431\'}}"')
    expect(pageWxml).toContain('data-case=\'single\'')
    expect(pageWxml).toContain('data-template-url=\'{{"/pages/issue-431/index.wxml"}}\'')
    expect(pageWxml).toContain('data-template-dir=\'{{"/pages/issue-431"}}\'')
    expect(pageWxml).toContain('data-env-label=\'{{"issue-431 native wxml env replacement"}}\'')
    expect(pageWxml).toContain('data-env-base=\'{{"https://static.example.com/issue-431"}}\'')
    expect(pageWxml).not.toContain('import.meta.env')
    expect(pageWxml).not.toContain('import.meta.url')
    expect(pageWxml).not.toContain('import.meta.dirname')
    expect(pageJs).toContain('/pages/issue-431/index.js')
    expect(pageJs).toContain('/pages/issue-431')
    expect(pageJs).toContain('importMetaSnapshot')
    expect(pageJs).toContain('url:`/pages/issue-431/index.js`')
    expect(pageJs).not.toContain('import.meta.url')
    expect(pageJs).not.toContain('import.meta.dirname')
    expect(pageJs).not.toContain('import.meta.env')
  })

  it('issue #429: prefers local component auto import and warns when name collides with a builtin component tag', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-429/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-429/index.wxml')
    const pageJson = await fs.readJson(pageJsonPath)
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-429 builtin-name auto import')
    expect(pageJson.usingComponents).toMatchObject({
      'list-view': '/components/issue-429/list-view/index',
    })
  })

  it('issue #424: avoids duplicated output for imported src/assets images', async () => {
    await runBuild()

    const files = await scanFiles(DIST_ROOT)
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-424/index.js')
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-424/index.wxml')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')

    expect(files).not.toContain('assets/images/home/goods-1.png')
    expect(files).not.toContain('assets/images/home/banner-1.jpg')
    expect(files.some(file => /^goods-1-[a-z0-9]+\.png$/.test(file))).toBe(true)
    expect(files.some(file => /^banner-1-[a-z0-9]+\.jpg$/.test(file))).toBe(true)
    expect(issuePageWxml).toContain('issue-424 duplicated imported src asset output')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('goods-1-')
    expect(issuePageJs).toContain('banner-1-')
  })

  it('issue #420: injects WebSocket globals for socket.io-client entry pages', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-420/index.js')
    const commonJsPath = path.join(DIST_ROOT, 'common.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-420/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const commonJs = await fs.readFile(commonJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('issue-420 socket.io-client bootstrap')
    expect(pageJs).toContain('transportName')
    expect(pageJs).toContain('socket.invalid/github-issues')
    expect(commonJs).toContain(REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER)
    expect(commonJs).toContain(`var WebSocket = ${REQUEST_GLOBAL_EXPOSE_HELPER}("WebSocket",`)
    expect(commonJs).toContain(`var URL = ${REQUEST_GLOBAL_EXPOSE_HELPER}("URL",`)
    expect(commonJs).toContain(`${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${REQUEST_GLOBAL_ACTUALS_KEY}["WebSocket"],["wss://request-globals.invalid"])`)
    expect(commonJs).toContain(`${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${REQUEST_GLOBAL_ACTUALS_KEY}["URL"],["https://request-globals.invalid"])`)
  })

  it('issue #393: keeps path-mode devDependency chunks out of dist/node_modules', async () => {
    await runIssue393Build()

    const files = await scanFiles(ISSUE_393_DIST_ROOT)
    const pageJs = await fs.readFile(path.join(ISSUE_393_DIST_ROOT, 'pages/issue-393/index.js'), 'utf8')

    expect(files).toContain('pages/issue-393/index.js')
    expect(files).toContain('debounce/index.js')
    expect(files.some(file => file.startsWith('node_modules/'))).toBe(false)
    expect(pageJs).toContain('../../debounce/index.js')
  })

  it('issue #369: does not inject vite client types when weapp.web is not configured', async () => {
    await runBuild()

    const managedTsconfigPath = path.join(APP_ROOT, '.weapp-vite/tsconfig.app.json')
    const managedTsconfig = await fs.readJson(managedTsconfigPath)

    expect(managedTsconfig.compilerOptions.types).toContain('weapp-vite/client')
    expect(managedTsconfig.compilerOptions.types).not.toContain('vite/client')
  })

  it('issue #380: keeps custom-tab-bar out of default page layouts', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-380/index.wxml')
    const customTabBarWxmlPath = path.join(DIST_ROOT, 'custom-tab-bar/index.wxml')
    const customTabBarJsonPath = path.join(DIST_ROOT, 'custom-tab-bar/index.json')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const customTabBarWxml = await fs.readFile(customTabBarWxmlPath, 'utf-8')
    const customTabBarJson = await fs.readFile(customTabBarJsonPath, 'utf-8')

    expect(pageWxml).toContain('<weapp-layout-default>')
    expect(pageWxml).toContain('issue-380 page')
    expect(customTabBarWxml).toContain('issue-380 custom tab bar')
    expect(customTabBarWxml).not.toContain('<weapp-layout-default>')
    expect(customTabBarJson).not.toContain('weapp-layout-default')
  })

  it('issue #385: initializes native default layout state and short-circuits duplicate setPageLayout updates', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-385/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-385/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('<attach-probe id="attach-probe" />')
    expect(pageWxml).toContain(`!__wv_page_layout_name || __wv_page_layout_name === 'default'`)
    expect(pageJs).toMatch(/__wv_page_layout_name:\s*[`'"]default[`'"]/)
    expect(pageJs).toContain('__wv_page_layout_props:{}')
    expect(pageJs).toContain('Object.keys(a).every(')
    expect(pageJs).toContain('Object.keys(a).length===Object.keys(r).length')
    expect(pageJs).toContain('||this.setData({__wv_page_layout_name:n,__wv_page_layout_props:r})')
  })

  it('issue #389: keeps native setPageLayout off the wevu layout runtime path', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-389/index.js')
    const commonJsPath = path.join(DIST_ROOT, 'common.js')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const commonJs = await fs.readFile(commonJsPath, 'utf-8')

    expect(pageJs).toContain('issue-389 native runtime export should stay native-only')
    expect(pageJs).toContain('__wevuSetPageLayout')
    expect(commonJs).not.toContain('__wevuPageLayoutState')
    expect(commonJs).not.toContain('usePageLayout() 必须在 setup() 的同步阶段调用')
    expect(commonJs).not.toContain('syncRuntimePageLayoutStateFromRuntime')
  })

  it('issue #398: emits layout and component importers that share the same wevu runtime chunk', async () => {
    await runBuild()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-398/index.js')
    const layoutJsPath = path.join(DIST_ROOT, 'layouts/issue-398-shell.js')
    const navbarJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseNavbar/index.js')
    const footerJsPath = path.join(DIST_ROOT, 'components/issue-398/BaseFooter/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-398/index.wxml')

    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const layoutJs = await fs.readFile(layoutJsPath, 'utf-8')
    const navbarJs = await fs.readFile(navbarJsPath, 'utf-8')
    const footerJs = await fs.readFile(footerJsPath, 'utf-8')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')

    expect(pageWxml).toContain('<weapp-layout-issue-398-shell>')
    expect(pageWxml).toContain('{{issue398Title}}')
    expect(pageWxml).toContain('{{issue398PageMarker}}')
    expect(pageWxml).toContain('{{issue398TapLabel}}')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('issue398NavbarLabel')
    expect(pageJs).toContain('issue398FooterLabel')
    expect(layoutJs).toContain('__weappViteUsingComponent')
    expect(layoutJs).toContain('BaseNavbar')
    expect(layoutJs).toContain('BaseFooter')
    expect(navbarJs).toContain('issue-398 navbar')
    expect(navbarJs).toContain('__issue398NavbarMounted')
    expect(navbarJs).toContain('__issue398NavbarLabel')
    expect(footerJs).toContain('issue-398 footer')
    expect(footerJs).toContain('__issue398FooterMounted')
    expect(footerJs).toContain('__issue398FooterLabel')

    const sharedImportPattern = /require\((['"`])(\.\.\/\.\.\/\.\.\/src-[^'"`]+\.js)\1\)/
    const navbarSharedImport = navbarJs.match(sharedImportPattern)
    const footerSharedImport = footerJs.match(sharedImportPattern)

    expect(navbarSharedImport?.[2]).toBeTruthy()
    expect(footerSharedImport?.[2]).toBeTruthy()
    expect(navbarSharedImport?.[2]).toBe(footerSharedImport?.[2])
  })

  it('issue #404: keeps onPageScroll page hooks enabled and exposes runtime probes in the page bundle', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-404/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-404/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-404 onPageScroll bridge')
    expect(pageWxml).toContain('has instance onPageScroll')
    expect(pageWxml).toContain('latest scrollTop')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('hasInstanceOnPageScroll')
    expect(pageJs).toContain('enableOnPageScroll')
  })

  it('issue #418/#419: keeps native template refs stable for third-party components', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-418-419/index.json')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readFile(pageJsonPath, 'utf-8')

    expect(pageWxml).toContain('issue-418-419 template ref native component')
    expect(pageWxml).toContain('<native-ref-probe')
    expect(pageWxml).toContain('issue-418-419')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('nativeButtonRef')
    expect(pageJs).toContain('descriptorConfigurable')
    expect(pageJson).toContain('../../components/issue-418-419/NativeRefProbe/index')
  })

  it('issue #289: compiles split pages with per-page controls and safe class bindings', async () => {
    await runBuild()

    const navPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/index.wxml')
    const navPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/index.js')
    const objectPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/object-literal/index.wxml')
    const objectPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/object-literal/index.js')
    const mapPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/map-class/index.wxml')
    const mapPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/map-class/index.js')
    const rootPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/root-class/index.wxml')
    const rootPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/root-class/index.js')
    const computedPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-289/computed-class/index.wxml')
    const computedPageJsPath = path.join(DIST_ROOT, 'pages/issue-289/computed-class/index.js')

    const objectLiteralWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.wxml')
    const objectLiteralJsPath = path.join(DIST_ROOT, 'components/issue-289/ObjectLiteralExample/index.js')
    const mapClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.wxml')
    const mapClassJsPath = path.join(DIST_ROOT, 'components/issue-289/MapClassExample/index.js')
    const rootClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/RootClassExample/index.wxml')
    const rootClassJsPath = path.join(DIST_ROOT, 'components/issue-289/RootClassExample/index.js')
    const computedClassWxmlPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.wxml')
    const computedClassJsPath = path.join(DIST_ROOT, 'components/issue-289/ComputedClassExample/index.js')

    const navPageWxml = await fs.readFile(navPageWxmlPath, 'utf-8')
    const navPageJs = await fs.readFile(navPageJsPath, 'utf-8')
    const objectPageWxml = await fs.readFile(objectPageWxmlPath, 'utf-8')
    const objectPageJs = await fs.readFile(objectPageJsPath, 'utf-8')
    const mapPageWxml = await fs.readFile(mapPageWxmlPath, 'utf-8')
    const mapPageJs = await fs.readFile(mapPageJsPath, 'utf-8')
    const rootPageWxml = await fs.readFile(rootPageWxmlPath, 'utf-8')
    const rootPageJs = await fs.readFile(rootPageJsPath, 'utf-8')
    const computedPageWxml = await fs.readFile(computedPageWxmlPath, 'utf-8')
    const computedPageJs = await fs.readFile(computedPageJsPath, 'utf-8')

    const objectLiteralWxml = await fs.readFile(objectLiteralWxmlPath, 'utf-8')
    const objectLiteralJs = await fs.readFile(objectLiteralJsPath, 'utf-8')
    const mapClassWxml = await fs.readFile(mapClassWxmlPath, 'utf-8')
    const mapClassJs = await fs.readFile(mapClassJsPath, 'utf-8')
    const rootClassWxml = await fs.readFile(rootClassWxmlPath, 'utf-8')
    const rootClassJs = await fs.readFile(rootClassJsPath, 'utf-8')
    const computedClassWxml = await fs.readFile(computedClassWxmlPath, 'utf-8')
    const computedClassJs = await fs.readFile(computedClassJsPath, 'utf-8')

    expect(navPageWxml).toContain('wx:for="{{sceneLinks}}"')
    expect(navPageWxml).toContain('wx:key="url"')
    expect(navPageWxml).toContain('url="{{item.url}}"')
    expect(navPageJs).toContain('sceneLinks')
    expect(navPageJs).toContain('/pages/issue-289/object-literal/index')
    expect(navPageJs).toContain('/pages/issue-289/map-class/index')
    expect(navPageJs).toContain('/pages/issue-289/root-class/index')
    expect(navPageJs).toContain('/pages/issue-289/computed-class/index')

    expect(objectPageWxml).toContain('<ObjectLiteralExample')
    expect(objectPageWxml).toContain('show-list="{{controlState.showList}}"')
    expect(objectPageWxml).toContain('compact-mode="{{controlState.compactMode}}"')
    expect(objectPageWxml).toContain('active-id="{{activeId || \'\'}}"')
    expect(objectPageWxml).toContain('bindtap="toggleShowList"')
    expect(objectPageWxml).toContain('bindtap="toggleCompactMode"')
    expect(objectPageWxml).toContain('bindtap="cycleActive"')
    expect(objectPageJs).toContain('controlState')
    expect(objectPageJs).toContain('runE2E')
    expect(objectPageJs).toContain('showListRoundTripWorked')

    expect(mapPageWxml).toContain('<MapClassExample')
    expect(mapPageWxml).toContain('callout-expanded="{{controlState.calloutExpanded}}"')
    expect(mapPageWxml).toContain('show-callout-list="{{controlState.showCalloutList}}"')
    expect(mapPageWxml).toContain('selected-event-idx="{{controlState.selectedIndex}}"')
    expect(mapPageWxml).toContain('bindtap="toggleCalloutExpanded"')
    expect(mapPageWxml).toContain('bindtap="toggleShowCalloutList"')
    expect(mapPageWxml).toContain('bindtap="cycleSelectedEvent"')
    expect(mapPageJs).toContain('controlState')
    expect(mapPageJs).toContain('runE2E')
    expect(mapPageJs).toContain('showCalloutListChanged')

    expect(rootPageWxml).toContain('<RootClassExample')
    expect(rootPageWxml).toContain('show-options="{{controlState.showOptions}}"')
    expect(rootPageWxml).toContain('selected-option-id="{{selectedOptionId || \'\'}}"')
    expect(rootPageWxml).toContain('bindtap="toggleShowOptions"')
    expect(rootPageWxml).toContain('bindtap="cycleOption"')
    expect(rootPageJs).toContain('controlState')
    expect(rootPageJs).toContain('runE2E')
    expect(rootPageJs).toContain('selectedIndexChanged')

    expect(computedPageWxml).toContain('<ComputedClassExample')
    expect(computedPageWxml).toContain('source-enabled="{{controlState.sourceEnabled}}"')
    expect(computedPageWxml).toContain('show-items="{{controlState.showItems}}"')
    expect(computedPageWxml).toContain('selected-index="{{controlState.selectedIndex}}"')
    expect(computedPageWxml).toContain('bindtap="toggleSourceEnabled"')
    expect(computedPageWxml).toContain('bindtap="toggleShowItems"')
    expect(computedPageWxml).toContain('bindtap="cycleSelected"')
    expect(computedPageJs).toContain('controlState')
    expect(computedPageJs).toContain('runE2E')
    expect(computedPageJs).toContain('showItemsChanged')

    expect(objectLiteralWxml).toContain('root="{{__wv_bind_0}}"')
    expect(objectLiteralWxml).not.toContain('root="{{{')
    expect(objectLiteralWxml).not.toContain('root="{{({')
    expect(objectLiteralWxml).toMatch(/wx:if="\{\{showList\}\}"/)
    expect(objectLiteralWxml).toMatch(/wx:for="\{\{items\}\}"/)
    expect(objectLiteralWxml).toContain('wx:else')

    const objectClassBindingTokens = objectLiteralWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(objectClassBindingTokens).size).toBeGreaterThanOrEqual(2)

    expect(mapClassWxml).toMatch(/wx:for-index="(?:__wv_index_0|index)"/)
    expect(mapClassWxml).toMatch(/__wv_cls_\d+\[(?:__wv_index_0|index)\]/)
    expect(mapClassWxml).toContain('min-scale="{{3}}"')
    expect(mapClassWxml).toContain('max-scale="{{20}}"')
    expect(mapClassWxml).toContain('bindmarkertap="__weapp_vite_inline"')
    expect(mapClassWxml).toContain('data-wi-markertap="i')
    expect(mapClassWxml).toContain('bindregionchange="__weapp_vite_inline"')
    expect(mapClassWxml).toContain('data-wi-regionchange="i')
    expect(mapClassWxml).toContain('show-compass="{{true}}"')
    expect(mapClassWxml).toContain('enable-zoom="{{true}}"')
    expect(mapClassWxml).toMatch(/wx:for="\{\{events\}\}"/)
    expect(mapClassWxml).toMatch(/wx:for="\{\{mapMetaList\}\}"/)
    expect(mapClassWxml).toMatch(/wx:if="\{\{showCalloutList\}\}"/)

    const mapClassBindingTokens = mapClassWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(mapClassBindingTokens).size).toBeGreaterThanOrEqual(1)

    expect(objectLiteralJs).toContain('__wv_bind_0')
    expect(objectLiteralJs).toMatch(/return\{a:[`'"]aaaa[`'"]\}/)
    expect(objectLiteralJs).toContain('showList')
    expect(objectLiteralJs).toContain('compactMode')
    expect(objectLiteralJs).toContain('activeId')

    expect(mapClassJs).toContain('selectedEventIdx')
    expect(mapClassJs).toContain('isPublic')
    expect(mapClassJs).toContain('includePoints')
    expect(mapClassJs).toContain('polyline')
    expect(mapClassJs).toContain('circles')
    expect(mapClassJs).toContain('calloutExpanded')
    expect(mapClassJs).toContain('showCalloutList')
    expect(mapClassJs).toContain('safeSelectedEventIdx')
    expect(mapClassJs).toContain('mapMetaList')

    expect(rootClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(rootClassWxml).toMatch(/wx:if="\{\{showOptions\}\}"/)
    expect(rootClassWxml).toMatch(/wx:for="\{\{options\}\}"/)
    expect(rootClassJs).toContain('selectedClassName')
    expect(rootClassJs).toContain('showOptions')
    expect(rootClassJs).toContain('selectedOptionId')

    expect(computedClassWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(computedClassWxml).toMatch(/wx:if="\{\{showItems\}\}"/)
    expect(computedClassWxml).toMatch(/wx:for="\{\{items\}\}"/)
    expect(computedClassJs).toContain('computedValue')
    expect(computedClassJs).toContain('sourceEnabled')
    expect(computedClassJs).toContain('showItems')
    expect(computedClassJs).toContain('selectedIndex')
    expect(computedClassJs).toContain('safeSelectedIndex')
    expect(computedClassJs).toContain('computedListClass')
  })
  it('issue #294: injects share lifecycle options for script-setup page hooks', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-294/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-294/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJsonPath = path.join(DIST_ROOT, 'pages/issue-294/index.json')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const commonJsPath = path.join(DIST_ROOT, 'common.js')
    const commonJs = await fs.readFile(commonJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-294 share hooks')
    expect(issuePageJs).toContain('enableOnShareAppMessage:!0')
    expect(issuePageJs).toContain('enableOnShareTimeline:!0')
    expect(issuePageJs).not.toMatch(/onShareAppMessage(?:\(\)|:function\(\))\{return\{\}\}/)
    expect(issuePageJs).not.toMatch(/onShareTimeline(?:\(\)|:function\(\))\{return\{\}\}/)
    expect(issuePageJs).toContain('issue-294-share-')
    expect(issuePageJs).toContain('issue-294-timeline-')
    expect(issuePageJson).not.toContain('"enableShareAppMessage"')
    expect(issuePageJson).not.toContain('"enableShareTimeline"')
    expect(commonJs).toContain('showShareMenu')
  })
  it('issue #297: compiles complex call expressions', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 complex call expressions')
    expect(issuePageWxml).toContain('Case A · v-bind 调用表达式')
    expect(issuePageWxml).toContain('Case B · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case C · 多参数调用（含激活项）')
    expect(issuePageWxml).toContain('Case A(v-bind):')
    expect(issuePageWxml).toContain('Case B(v-if/v-for):')
    expect(issuePageWxml).toContain('Case C(多参数):')
    expect(issuePageWxml).toContain('新增列表项')
    expect(issuePageWxml).toContain('重置列表')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-hello="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(issuePageWxml).not.toContain('sayHello(')
    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(5)

    expect(issuePageJs).toMatch(/sayHello\)\(1,/)
    expect(issuePageJs).toContain('dasd')
    expect(issuePageJs).toContain('this.sayHello')
    expect(issuePageJs).toContain('_runE2E')
  })

  it('issue #297: setup method call variants compile to stable bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 setup method call variants')
    expect(issuePageWxml).toContain('Case A · 插值调用 + 同级静态文本 + 同级元素')
    expect(issuePageWxml).toContain('Case B · v-bind 多参数调用')
    expect(issuePageWxml).toContain('Case C · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case D · 成员调用 / 模板字符串 / 三元表达式')
    expect(issuePageWxml).toContain('Case E · 可选调用 + 空值兜底')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-inline="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-multi="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-label="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-loop="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-member="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-template="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-ternary="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-wrap="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-optional="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('getCase()')
    expect(issuePageWxml).not.toContain('sayCase(')
    expect(issuePageWxml).not.toContain('getOptionalInvoker?.(')

    expect(issuePageJs).toContain('this.getCase')
    expect(issuePageJs).toContain('this.sayCase')
    expect(issuePageJs).toContain('this.getRows')
    expect(issuePageJs).toContain('this.getOptionalInvoker')
    expect(issuePageJs).toContain('_runE2E')
  })

  it('issue #302: keeps v-for class bindings in sync with active state', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-302/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-302/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-302 v-for class binding update')
    expect(issuePageWxml).toContain('active: {{active}}')
    expect(issuePageWxml).toContain('wx:for="{{tabs}}"')
    expect(issuePageWxml).toContain('wx:key="id"')
    expect(issuePageWxml).toMatch(/wx:for-index="(?:__wv_index_0|index)"/)
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\[(?:__wv_index_0|index)\]\}\}"/)
    expect(issuePageWxml).not.toContain('active === tab.id')

    const classBindingTokens = issuePageWxml.match(/__wv_cls_\d+/g) ?? []
    expect(new Set(classBindingTokens).size).toBeGreaterThanOrEqual(1)

    expect(issuePageJs).toContain('setActive')
    expect(issuePageJs).toContain('active')
    expect(issuePageJs).toContain('tabs')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('issue302-item-')
    expect(issuePageJs).toContain('issue302-item-active')
    expect(issuePageJs).toContain('issue302-item-inactive')
  })

  it('issue #309: keeps onLoad hook active even without onPullDownRefresh', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-309/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-309/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-309 onLoad hook')
    expect(issuePageWxml).toContain('loadCount: {{loadCount}}')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('__wevu_isPage:!0')
    expect(issuePageJs).toContain('loadCount')
    expect(issuePageJs).not.toContain('onPullDownRefresh')
  })

  it('issue #309: keeps onLoad hook active with created setupLifecycle', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-309-created/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-309-created/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-309 created lifecycle onLoad hook')
    expect(issuePageWxml).toContain('loadCount: {{loadCount}}')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('__wevu_isPage:!0')
    expect(issuePageJs).toContain('loadCount')
    expect(issuePageJs).not.toContain('onPullDownRefresh')
  })

  it('issue #312: keeps setup computed object bindings reactive after reference round trip', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-312/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-312/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-312 computed object round trip')
    expect(issuePageWxml).toContain('current option:')
    expect(issuePageWxml).toContain('issue312-probe')
    expect(issuePageWxml).toContain('data-current-label="{{option.label}}"')
    expect(issuePageWxml).toContain('issue312-btn-inc')
    expect(issuePageWxml).toContain('issue312-btn-dec')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('options')
    expect(issuePageJs).toContain('option')
    expect(issuePageJs).toContain('index')
  })

  it('issue #316: compiles kebab-case component events to colon-prefixed bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-316/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-316/index.js')
    const emitterWxmlPath = path.join(DIST_ROOT, 'components/issue-316/HyphenEventEmitter/index.wxml')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const emitterWxml = await fs.readFile(emitterWxmlPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-316 hyphen event binding')
    expect(issuePageWxml).toContain('custom component event: overlay-click')
    expect(issuePageWxml).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(issuePageWxml).toContain('data-wd-overlay-click="1"')
    expect(issuePageWxml).toContain('data-wi-overlay-click="i0"')
    expect(issuePageWxml).toContain('data-overlay-count="{{overlayClickCount}}"')
    expect(issuePageWxml).not.toContain('bindoverlay-click=')
    expect(issuePageJs).toContain('handleOverlayClick')
    expect(issuePageJs).toContain('_runE2E')

    expect(emitterWxml).toContain('issue316-emitter-btn')
    expect(emitterWxml).toContain('bindtap="emitOverlayClick"')
  })

  it('issue #318: auto injects setData.pick for template-used keys', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-318/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-318/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-318 auto setData pick from template')
    expect(issuePageWxml).toContain('wx:for="{{list}}"')
    expect(issuePageWxml).toContain('count: {{count}}')
    expect(issuePageWxml).toContain('size: {{list.length}}')
    expect(issuePageWxml).toContain('data-line="{{__wv_bind_')
    expect(issuePageWxml).toContain('data-meta="{{__wv_bind_')
    expect(issuePageWxml).toContain('{{__wv_bind_')
    expect(issuePageWxml).not.toContain('formatRow(')
    expect(issuePageWxml).not.toContain('formatMeta(')

    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(2)

    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('setData')
    expect(issuePageJs).toContain('pick')
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]count['"`]/)
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]list['"`]/)
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]__wv_bind_\d+['"`]/)
  })

  it('issue #322: keeps static class and hidden v-show fallback when expression access throws', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-322/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-322/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-322 class/v-show first paint flicker')
    expect(issuePageWxml).toContain('set email error')
    expect(issuePageWxml).toContain('clear email error')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('errors.email ?')
    expect(issuePageWxml).toMatch(/<input[^>]*class="\{\{__wv_cls_\d+\}\}"[^>]*\/>/)
    expect(issuePageWxml).not.toContain('</input>')
    expect(issuePageWxml).toMatch(/<input[^>]*\/><view style="\{\{__wv_style_\d+\}\}" class="issue322-error-tip">/)

    expect(issuePageJs).toContain('__wv_cls_0')
    expect(issuePageJs).toContain('__wv_style_0')
    expect(issuePageJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`errors`)')
    expect(issuePageJs).toMatch(/return["'`]issue322-input issue322-input-base["'`]/)
    expect(issuePageJs).toMatch(/return["'`]display: none["'`]/)
  })

  it('issue #317: keeps shared chunk duplication in subpackages without invalid self or runtime imports', async () => {
    await runBuild()

    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')
    const fallbackUnderscorePath = path.join(DIST_ROOT, 'subpackages_item_subpackages_user/common.js')
    const fallbackPlusPath = path.join(DIST_ROOT, 'subpackages_item+subpackages_user/common.js')

    const itemShared = await fs.readFile(itemSharedPath, 'utf-8')
    const userShared = await fs.readFile(userSharedPath, 'utf-8')

    expect(itemShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)/)
    expect(userShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)/)
    expect(itemShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(userShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(itemShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/common\.js\1\)/)
    expect(userShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/common\.js\1\)/)

    expect(itemShared).not.toMatch(/require\((['"`]).*subpackages_item.*subpackages_user\/common\.js\1\)/)
    expect(userShared).not.toMatch(/require\((['"`]).*subpackages_item.*subpackages_user\/common\.js\1\)/)

    expect(await fs.pathExists(fallbackUnderscorePath)).toBe(false)
    expect(await fs.pathExists(fallbackPlusPath)).toBe(false)
    expect(await fs.pathExists(itemRuntimePath)).toBe(true)
    expect(await fs.pathExists(userRuntimePath)).toBe(true)
  })

  it('issue #340: keeps cross-subpackage source imports runnable for item/login-required and user/register/form', async () => {
    await runBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/login-required/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/register/form.js')
    const invalidSharedPageWxmlPath = path.join(DIST_ROOT, 'subpackages/item/issue-340-shared.wxml')
    const rootCommonPath = path.join(DIST_ROOT, 'common.js')
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const itemInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/item/common.js')
    const userInvalidCommonPath = path.join(DIST_ROOT, 'subpackages/user/common.js')
    const rootVendorsPath = path.join(DIST_ROOT, 'vendors.js')
    const itemVendorsPath = path.join(DIST_ROOT, 'subpackages/item/vendors.js')
    const userVendorsPath = path.join(DIST_ROOT, 'subpackages/user/vendors.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')

    const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf-8'))
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')
    const itemShared = await fs.readFile(itemSharedPath, 'utf-8')
    const userShared = await fs.readFile(userSharedPath, 'utf-8')
    const itemSubPackage = (appJson.subPackages ?? appJson.subpackages ?? []).find((entry: any) => entry?.root === 'subpackages/item')

    expect(itemPageJs).toContain('item-login-required:issue-340:shared')
    expect(userPageJs).toContain('user-register-form:issue-340:shared')
    expect(itemPageJs).toMatch(/require\((['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\1\)/)
    expect(userPageJs).toMatch(/require\((['"`])\.\.\/weapp-shared\/common(?:\.\d+)?\.js\1\)/)
    expect(itemPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(userPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(itemPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)/)
    expect(userPageJs).not.toMatch(/require\((['"`])\.\.\/\.\.\/common(?:\.\d+)?\.js\1\)/)
    expect(itemPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)
    expect(userPageJs).not.toMatch(/vendors(?:\.\d+)?\.js/)

    expect(itemShared).toContain('issue-340')
    expect(userShared).toContain('issue-340')
    expect(itemShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(userShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(itemShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)/)
    expect(userShared).not.toMatch(/require\((['"`])\.\.\/\.\.\/rolldown-runtime\.js\1\)/)
    expect(itemShared).not.toMatch(/vendors(?:\.\d+)?\.js/)
    expect(userShared).not.toMatch(/vendors(?:\.\d+)?\.js/)

    expect(itemSubPackage?.pages).toEqual([
      'index',
      'login-required/index',
    ])
    expect(await fs.pathExists(invalidSharedPageWxmlPath)).toBe(false)
    expect(await fs.pathExists(rootCommonPath)).toBe(true)
    expect(await fs.pathExists(itemInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(userInvalidCommonPath)).toBe(false)
    expect(await fs.pathExists(rootVendorsPath)).toBe(false)
    expect(await fs.pathExists(itemVendorsPath)).toBe(false)
    expect(await fs.pathExists(userVendorsPath)).toBe(false)
    expect(await fs.pathExists(itemRuntimePath)).toBe(true)
    expect(await fs.pathExists(userRuntimePath)).toBe(true)
  })

  it('issue #327: routes npm deps by mainPackage/subPackages config without emitting main-package npm output', async () => {
    await runBuild()

    const issue327NpmRoot = path.join(DIST_ROOT, 'subpackages/issue-327/miniprogram_npm')
    const itemNpmRoot = path.join(DIST_ROOT, 'subpackages/item/miniprogram_npm')
    const userNpmRoot = path.join(DIST_ROOT, 'subpackages/user/miniprogram_npm')
    const subpackageDayjsPath = path.join(issue327NpmRoot, 'dayjs/index.js')
    const subpackageTdesignPath = path.join(issue327NpmRoot, 'tdesign-miniprogram/button/button.js')
    const itemCamelCasePath = path.join(itemNpmRoot, 'camelcase/index.js')
    const userMergePath = path.join(userNpmRoot, 'merge/index.js')
    const mainDayjsPath = path.join(DIST_ROOT, 'miniprogram_npm/dayjs/index.js')
    const mainTdesignPath = path.join(DIST_ROOT, 'miniprogram_npm/tdesign-miniprogram/button/button.js')
    const mainLodashPath = path.join(DIST_ROOT, 'miniprogram_npm/camelcase/index.js')
    const mainMergePath = path.join(DIST_ROOT, 'miniprogram_npm/merge/index.js')
    const issuePageJsPath = path.join(DIST_ROOT, 'subpackages/issue-327/index.js')
    const issuePageJsonPath = path.join(DIST_ROOT, 'subpackages/issue-327/index.json')
    const itemPageJsPath = path.join(DIST_ROOT, 'subpackages/item/index.js')
    const userPageJsPath = path.join(DIST_ROOT, 'subpackages/user/index.js')

    expect(await fs.pathExists(subpackageDayjsPath)).toBe(true)
    expect(await fs.pathExists(subpackageTdesignPath)).toBe(true)
    expect(await fs.pathExists(itemCamelCasePath)).toBe(true)
    expect(await fs.pathExists(userMergePath)).toBe(true)
    expect(await fs.pathExists(mainDayjsPath)).toBe(false)
    expect(await fs.pathExists(mainTdesignPath)).toBe(false)
    expect(await fs.pathExists(mainLodashPath)).toBe(false)
    expect(await fs.pathExists(mainMergePath)).toBe(false)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'miniprogram_npm'))).toBe(false)

    expect(await fs.pathExists(path.join(issue327NpmRoot, 'camelcase/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(issue327NpmRoot, 'merge/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(itemNpmRoot, 'merge/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(itemNpmRoot, 'dayjs/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(userNpmRoot, 'camelcase/index.js'))).toBe(false)
    expect(await fs.pathExists(path.join(userNpmRoot, 'dayjs/index.js'))).toBe(false)

    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const issuePageJson = await fs.readFile(issuePageJsonPath, 'utf-8')
    const itemPageJs = await fs.readFile(itemPageJsPath, 'utf-8')
    const userPageJs = await fs.readFile(userPageJsPath, 'utf-8')

    expect(issuePageJs).toContain('dayjs')
    expect(issuePageJson).toContain('"t-button": "tdesign-miniprogram/button/button"')
    expect(itemPageJs).toContain('camelcase')
    expect(itemPageJs).toContain('npmMarker')
    expect(userPageJs).toContain('merge')
    expect(userPageJs).toContain('npmMarker')
  })

  it('issue #300: keeps boolean props available in runtime call-expression bindings', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-300/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-300/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.js')
    const strictProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.wxml')
    const strictProbeJsPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.js')
    const strictProbeJsonPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.json')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')
    const strictProbeWxml = await fs.readFile(strictProbeWxmlPath, 'utf-8')
    const strictProbeJs = await fs.readFile(strictProbeJsPath, 'utf-8')
    const strictProbeJson = await fs.readFile(strictProbeJsonPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-300 props destructure boolean binding')
    expect(issuePageWxml).toContain('toggle bool:')
    expect(issuePageWxml).toContain('toggle str:')
    expect(issuePageWxml).toContain('sync toggle props in place')
    expect(issuePageWxml).toContain('issue300-toggle-bool')
    expect(issuePageWxml).toContain('issue300-toggle-str')
    expect(issuePageWxml).toContain('issue300-toggle-sync')
    expect(issuePageWxml).toContain('strict-no-props-var')
    expect(issuePageWxml).toContain('primitive-ref-source')
    expect(issuePageWxml).toContain('ref-object-source')
    expect(issuePageWxml).toContain('reactive-object-source')
    expect(issuePageWxml).toContain('case-id="primitive"')
    expect(issuePageWxml).toContain('case-id="ref-object"')
    expect(issuePageWxml).toContain('case-id="reactive-object"')
    expect(issuePageJs).toContain('toggleBool')
    expect(issuePageJs).toContain('toggleStr')
    expect(issuePageJs).toContain('syncTogglePropsInPlace')
    expect(issuePageJs).toContain('_resetE2E')
    expect(issuePageJs).toContain('_runE2E')

    expect(probeWxml).toContain('{{__wv_bind_0}}')
    expect(probeWxml).toContain('{{__wv_bind_1}}')
    expect(probeWxml).toMatch(/data-destructured-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(probeWxml).toMatch(/data-props-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(probeWxml).not.toContain('String(bool)')
    expect(probeWxml).not.toContain('String(props.bool)')
    expect(probeJs).toContain('__wevuProps.bool')
    expect(probeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(probeJs).not.toContain('__wevuProps.props')

    expect(strictProbeWxml).toContain('{{__wv_bind_0}}')
    expect(strictProbeWxml).toMatch(/data-strict-bool="\{\{__wv_bind_\d+\}\}"/)
    expect(strictProbeWxml).toContain('data-strict-str="{{str}}"')
    expect(strictProbeWxml).not.toContain('String(bool)')
    expect(strictProbeJs).toContain('__wevuProps.bool')
    expect(strictProbeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(strictProbeJs).not.toContain('__wevuProps.props')
    expect(JSON.parse(strictProbeJson)?.styleIsolation).toBe('apply-shared')
  })

  it('issue #328: keeps setup ref props available on first paint for child string props', async () => {
    await runBuild()

    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-328/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-328/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-328 setup ref prop first paint')
    expect(issuePageWxml).toContain('ValueProbe')
    expect(issuePageWxml).toContain('issue328-toggle')
    expect(issuePageWxml).toContain('toggle value: {{value1}}')
    expect(issuePageWxml).toContain('value="{{value1}}"')
    expect(issuePageJs).toContain('value1')
    expect(issuePageJs).toContain('advanceValue')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('111')
    expect(issuePageJs).toContain('222')

    expect(probeWxml).toContain('data-current-value="{{props.value}}"')
    expect(probeWxml).toContain('data-history="{{historyText}}"')
    expect(probeWxml).toContain('{{historyText}}')
    expect(probeJs).toContain('valueHistory')
    expect(probeJs).toContain('historyText')
    expect(probeJs).toMatch(/default:[`'"]0\.00[`'"]/)
  })

  it('issue #373: compiles shared store computed bindings across reLaunch pages', async () => {
    await runBuild()

    const launchPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.wxml')
    const launchPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/launch/index.js')
    const resultPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.wxml')
    const resultPageJsPath = path.join(DIST_ROOT, 'pages/issue-373/result/index.js')
    const commonJsPath = path.join(DIST_ROOT, 'common.js')

    const launchPageWxml = await fs.readFile(launchPageWxmlPath, 'utf-8')
    const launchPageJs = await fs.readFile(launchPageJsPath, 'utf-8')
    const resultPageWxml = await fs.readFile(resultPageWxmlPath, 'utf-8')
    const resultPageJs = await fs.readFile(resultPageJsPath, 'utf-8')
    const commonJs = await fs.readFile(commonJsPath, 'utf-8')

    expect(launchPageWxml).toContain('issue-373 store computed survives reLaunch')
    expect(launchPageWxml).toContain('launch count: {{count}}')
    expect(launchPageWxml).toContain('launch doubled: {{doubled}}')
    expect(launchPageWxml).toContain('data-doubled="{{doubled}}"')
    expect(launchPageJs).toContain('runRelaunch')
    expect(launchPageJs).toContain('_runE2E')

    expect(resultPageWxml).toContain('issue-373 reLaunch store computed result')
    expect(resultPageWxml).toContain('result count: {{count}}')
    expect(resultPageWxml).toContain('result doubled: {{doubled}}')
    expect(resultPageWxml).toContain('data-doubled="{{doubled}}"')
    expect(resultPageJs).toContain('increment')
    expect(resultPageJs).toContain('_runE2E')

    expect(commonJs).toContain('issue-373-store')
    expect(commonJs).toContain('count:e,doubled:t,increment:n,reset:r')
    expect(commonJs).toMatch(/[A-Za-z_$][\w$]*\(`issue-373-store`,\(\)=>\{/)
  })
})
