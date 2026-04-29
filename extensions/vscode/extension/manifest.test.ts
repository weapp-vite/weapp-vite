import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import {
  DEFAULT_VSCODE_USER_SETTINGS,
} from '../scripts/vscode-e2e-shared'

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const extensionRoot = path.dirname(packageJsonPath)
const fileIconTheme = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'assets', 'weapp-vite-icon-theme.json'), 'utf8'))
const wxmlLanguageConfiguration = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'syntaxes', 'wxml.language-configuration.json'), 'utf8'))

it('manifest exposes practical command set', () => {
  assert.equal(packageJson.name, '@weapp-vite/vscode')
  assert.equal(packageJson['x-vsce'].name, 'weapp-vite')
  assert.equal(packageJson['x-vsce'].displayName, 'Weapp Vite')

  const commandIds = packageJson.contributes.commands.map(command => command.command)

  assert.deepEqual(commandIds, [
    'weapp-vite.generate',
    'weapp-vite.dev',
    'weapp-vite.build',
    'weapp-vite.open',
    'weapp-vite.useFileIcons',
    'weapp-vite.doctor',
    'weapp-vite.showProjectInfo',
    'weapp-vite.showOutput',
    'weapp-vite.runAction',
    'weapp-vite.insertDefineConfigTemplate',
    'weapp-vite.insertDefinePageJsonTemplate',
    'weapp-vite.insertCommonScripts',
    'weapp-vite.createPageFromRoute',
    'weapp-vite.createPageFromTreeItem',
    'weapp-vite.generatePageInExplorer',
    'weapp-vite.generateComponentInExplorer',
    'weapp-vite.openPageFromRoute',
    'weapp-vite.addCurrentPageToAppJson',
    'weapp-vite.addPageToAppJsonFromTreeItem',
    'weapp-vite.openDocs',
    'weapp-vite.openProjectFile',
    'weapp-vite.copyCurrentPageRoute',
    'weapp-vite.copyPageRouteFromTreeItem',
    'weapp-vite.revealCurrentPageInAppJson',
    'weapp-vite.revealCurrentPageInPagesTree',
    'weapp-vite.refreshPagesTree',
    'weapp-vite.filterProblemPagesInTree',
    'weapp-vite.filterCurrentPageInTree',
    'weapp-vite.clearPagesTreeFilter',
    'weapp-vite.repairProjectIssues',
    'weapp-vite.generateMissingComponentsFromProject',
    'weapp-vite.generateMissingPagesFromAppJson',
    'weapp-vite.syncUnregisteredPagesToAppJson',
    'weapp-vite.revealPageRouteInAppJsonFromTreeItem',
  ])
})

it('manifest keeps publish-safe file whitelist', () => {
  assert.deepEqual([...packageJson.files].sort(), [
    'assets/**',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist/**',
    'package.json',
    'snippets/**',
    'syntaxes/**',
  ].sort())
})

it('manifest activates for standard and dedicated weapp-vite config files', () => {
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.ts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.mts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.cts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.js'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.mjs'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/vite.config.cjs'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.ts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.mts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.cts'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.js'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.mjs'), true)
  assert.equal(packageJson.activationEvents.includes('workspaceContains:**/weapp-vite.config.cjs'), true)
})

it('manifest contributes weapp-vite file icon theme for dedicated config files', () => {
  assert.deepEqual(packageJson.contributes.iconThemes, [
    {
      id: 'weapp-vite-file-icons',
      label: 'weapp-vite File Icons',
      path: './assets/weapp-vite-icon-theme.json',
    },
  ])
})

it('file icon theme keeps language fallbacks and covers standalone wxml files', () => {
  assert.equal(fileIconTheme.showLanguageModeIcons, true)
  assert.equal(fileIconTheme.fileExtensions.wxml, '_wxml')
  assert.equal(fileIconTheme.iconDefinitions._wxml.iconPath, './wxml.svg')
})

it('manifest exposes local verification scripts', () => {
  assert.equal(packageJson.scripts.build, 'pnpm exec tsdown --config tsdown.config.mts')
  assert.equal(packageJson.scripts.lint, 'pnpm eslint extension.ts extension/**/*.ts scripts/**/*.ts tsdown.config.mts')
  assert.equal(packageJson.scripts.typecheck, 'pnpm exec tsc -p tsconfig.json --noEmit')
  assert.equal(packageJson.scripts.test, 'pnpm vitest run -c vitest.config.ts')
  assert.equal(packageJson.scripts['test:host:smoke'], 'node --import tsx scripts/vscode-host-smoke.ts')
  assert.equal(packageJson.scripts['test:vsix:e2e'], 'pnpm run package:dry-run && node --import tsx scripts/vsix-e2e.ts all')
  assert.equal(packageJson.scripts['test:vsix:e2e:standalone'], 'pnpm run package:dry-run && node --import tsx scripts/vsix-e2e.ts standalone')
  assert.equal(packageJson.scripts['test:vsix:e2e:vue-official'], 'pnpm run package:dry-run && node --import tsx scripts/vsix-e2e.ts vue-official')
  assert.equal(packageJson.scripts['open:vsix:e2e:standalone'], 'pnpm run package:dry-run && node --import tsx scripts/launch-vsix-vscode.ts standalone')
  assert.equal(packageJson.scripts['open:vsix:e2e:vue-official'], 'pnpm run package:dry-run && node --import tsx scripts/launch-vsix-vscode.ts vue-official')
  assert.equal(packageJson.scripts['smoke:dist'], 'node --import tsx scripts/smoke-test.ts')
  assert.equal(packageJson.scripts.check, 'pnpm run lint && pnpm run test && pnpm run build && pnpm run smoke:dist')
  assert.equal(packageJson.scripts['check:package'], 'node --import tsx scripts/check-package.ts')
  assert.equal(packageJson.scripts['check:publish'], 'pnpm run check && pnpm run check:package')
  assert.equal(packageJson.scripts['release:marketplace:plan'], 'node --import tsx scripts/plan-marketplace-release.ts')
  assert.equal(packageJson.scripts['package:dry-run'], 'pnpm run build && node --import tsx scripts/package-dry-run.ts package')
  assert.equal(packageJson.scripts['check:vsix'], 'pnpm run package:dry-run && node --import tsx scripts/check-vsix.ts')
  assert.equal(packageJson.scripts['publish:vsce'], 'pnpm run check:publish && node --import tsx scripts/release-vsce.ts publish')
})

it('manifest config defaults stay enabled for core ergonomics', () => {
  const properties = packageJson.contributes.configuration.properties

  assert.equal(properties['weapp-vite.showStatusBar'].default, true)
  assert.equal(properties['weapp-vite.enablePackageJsonDiagnostics'].default, true)
  assert.equal(properties['weapp-vite.enableAppJsonDiagnostics'].default, true)
  assert.equal(properties['weapp-vite.enableHover'].default, true)
  assert.equal(properties['weapp-vite.enableCompletion'].default, true)
  assert.equal(properties['weapp-vite.enableWxmlEnhancements'].default, true)
  assert.equal(properties['weapp-vite.enableVueTemplateWxmlEnhancements'].default, true)
  assert.equal(properties['weapp-vite.enableStandaloneWxmlEnhancements'].default, true)
  assert.equal(properties['weapp-vite.enableWxmlDefinition'].default, true)
  assert.equal(properties['weapp-vite.enableTemplateDecorations'].default, true)
  assert.equal(properties['weapp-vite.preferWvAlias'].default, true)
})

it('isolated vscode sessions default to trusted workspaces only', () => {
  assert.deepEqual(DEFAULT_VSCODE_USER_SETTINGS, {
    'security.workspace.trust.enabled': false,
  })
})

it('manifest contributes wxml language and grammars', () => {
  assert.equal(
    packageJson.contributes.languages.some(language =>
      language.id === 'wxml'
      && language.extensions.includes('.wxml')
      && language.configuration === './syntaxes/wxml.language-configuration.json',
    ),
    true,
  )

  assert.equal(
    packageJson.contributes.grammars.some(grammar =>
      grammar.language === 'wxml'
      && grammar.scopeName === 'text.html.wxml'
      && grammar.path === './syntaxes/wxml.tmLanguage.json',
    ),
    true,
  )

  assert.equal(
    packageJson.contributes.grammars.some(grammar =>
      grammar.scopeName === 'text.html.vue.weapp-vite-wxml-template'
      && grammar.path === './syntaxes/vue-template-wxml.injection.tmLanguage.json',
    ),
    true,
  )
})

it('wxml language word pattern keeps member expressions and kebab classes whole', () => {
  const pattern = new RegExp(wxmlLanguageConfiguration.wordPattern, 'gu')
  const source = '{{ item.label }} class="section-title"'
  const words = [...source.matchAll(pattern)].map(match => match[0])

  assert.equal(words.includes('item.label'), true)
  assert.equal(words.includes('section-title'), true)
})

it('manifest contributes pages explorer view', () => {
  assert.deepEqual(packageJson.contributes.views.explorer, [
    {
      id: 'weapp-vite.pages',
      name: 'weapp-vite Pages',
      when: 'workspaceFolderCount > 0',
    },
  ])
})

it('manifest exposes current-page explorer quick actions', () => {
  const treeMenus = packageJson.contributes.menus['view/item/context']

  assert.equal(
    treeMenus.some(item =>
      item.command === 'weapp-vite.revealPageRouteInAppJsonFromTreeItem'
      && item.group === 'inline'
      && item.when.includes('weappPage.exists.current')
      && item.when.includes('weappPage.missing.current'),
    ),
    true,
  )

  assert.equal(
    treeMenus.some(item =>
      item.command === 'weapp-vite.copyPageRouteFromTreeItem'
      && item.group === 'inline'
      && item.when.includes('weappPage.unregistered.current'),
    ),
    true,
  )

  assert.equal(
    treeMenus.some(item =>
      item.command === 'weapp-vite.createPageFromTreeItem'
      && item.group === 'inline'
      && item.when === 'view == weapp-vite.pages && viewItem == weappPage.missing.current',
    ),
    true,
  )

  assert.equal(
    treeMenus.some(item =>
      item.command === 'weapp-vite.addPageToAppJsonFromTreeItem'
      && item.group === 'inline'
      && item.when.includes('weappPage.unregistered.current')
      && !item.when.includes('drift'),
    ),
    true,
  )
})

it('manifest exposes explorer context generate actions', () => {
  const explorerMenus = packageJson.contributes.menus['explorer/context']

  assert.equal(
    explorerMenus.some(item =>
      item.command === 'weapp-vite.generatePageInExplorer'
      && item.group === '2_weapp-vite@1'
      && item.when === 'resourceScheme == file',
    ),
    true,
  )

  assert.equal(
    explorerMenus.some(item =>
      item.command === 'weapp-vite.generateComponentInExplorer'
      && item.group === '2_weapp-vite@2'
      && item.when === 'resourceScheme == file',
    ),
    true,
  )
})

it('manifest exposes pages explorer title action for current page reveal', () => {
  assert.deepEqual(packageJson.contributes.menus['view/title'], [
    {
      command: 'weapp-vite.refreshPagesTree',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.filterProblemPagesInTree',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.filterCurrentPageInTree',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.clearPagesTreeFilter',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.generateMissingPagesFromAppJson',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.syncUnregisteredPagesToAppJson',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
    {
      command: 'weapp-vite.revealCurrentPageInPagesTree',
      group: 'navigation',
      when: 'view == weapp-vite.pages',
    },
  ])
})
