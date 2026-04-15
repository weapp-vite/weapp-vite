import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

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
    'weapp-vite.insertJsonBlockTemplate',
    'weapp-vite.insertDefineConfigTemplate',
    'weapp-vite.insertDefinePageJsonTemplate',
    'weapp-vite.syncDefinePageJsonTitleFromJson',
    'weapp-vite.syncJsonTitleFromDefinePageJson',
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
    'weapp-vite.filterDriftPagesInTree',
    'weapp-vite.clearPagesTreeFilter',
    'weapp-vite.repairProjectIssues',
    'weapp-vite.generateMissingComponentsFromProject',
    'weapp-vite.generateMissingPagesFromAppJson',
    'weapp-vite.syncUnregisteredPagesToAppJson',
    'weapp-vite.revealPageRouteInAppJsonFromTreeItem',
    'weapp-vite.syncDefinePageJsonFromJsonInTreeItem',
    'weapp-vite.syncJsonFromDefinePageJsonInTreeItem',
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

it('manifest contributes weapp-vite file icon theme for dedicated config files', () => {
  assert.deepEqual(packageJson.contributes.iconThemes, [
    {
      id: 'weapp-vite-file-icons',
      label: 'weapp-vite File Icons',
      path: './assets/weapp-vite-icon-theme.json',
    },
  ])
})

it('manifest exposes local verification scripts', () => {
  assert.equal(packageJson.scripts.build, 'pnpm exec tsdown --config tsdown.config.mts')
  assert.equal(packageJson.scripts.lint, 'pnpm eslint extension.ts extension/**/*.ts scripts/**/*.ts tsdown.config.mts')
  assert.equal(packageJson.scripts.typecheck, 'pnpm exec tsc -p tsconfig.json --noEmit')
  assert.equal(packageJson.scripts.test, 'pnpm vitest run -c vitest.config.ts')
  assert.equal(packageJson.scripts['test:host:smoke'], 'node --import tsx scripts/vscode-host-smoke.ts')
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
  assert.equal(properties['weapp-vite.preferWvAlias'].default, true)
  assert.equal(properties['weapp-vite.promptFileIcons'].default, true)
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
      item.command === 'weapp-vite.syncJsonFromDefinePageJsonInTreeItem'
      && item.group === 'inline'
      && item.when.includes('weappPage.exists.drift.current')
      && item.when.includes('weappPage.unregistered.drift.current'),
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
      && item.when.includes('weappPage.unregistered.drift.current'),
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
      command: 'weapp-vite.filterDriftPagesInTree',
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
