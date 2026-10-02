import type { MutableCompilerContext } from '../context'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createRuntimeState } from '../runtime/runtimeState'
import { createDevModuleGraphProvider } from './devProvider'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'
import { normalizeSourceId } from './traversal'

it('replaces compiler style dependencies without dropping another owner or a native CSS import', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-compiler-style-owners-')))
  const pages = ['first', 'second', 'native'].map(name => path.join(root, `${name}.ts`))
  const styles = ['first', 'second', 'native'].map(name => path.join(root, `${name}.css`))
  const shared = path.join(root, 'shared.css')
  const replacement = path.join(root, 'replacement.tokens')
  await Promise.all([
    ...pages.map(file => writeFile(file, 'export default {}')),
    ...styles.map((file, index) => writeFile(file, index === 2 ? '@import "./shared.css";\n.native { color: red; }' : '.page { color: red; }')),
    writeFile(shared, '.shared { color: blue; }'),
    writeFile(replacement, 'green'),
  ])
  const moduleGraphService = createModuleGraphService()
  for (const [index, page] of pages.entries()) {
    moduleGraphService.replaceEntryDependencies(page, 'style', [styles[index]!])
  }
  for (const style of styles.slice(0, 2)) {
    moduleGraphService.replaceTransformDependencies(style, [shared])
  }
  const provider = await createDevModuleGraphProvider({
    runtimeState: createRuntimeState(),
    configService: { cwd: root, outDir: path.join(root, 'dist') },
    moduleGraphService,
  } as unknown as MutableCompilerContext, { root }, () => {})
  const sync = () => moduleGraphService.syncDevGraph({ getModuleIds: () => pages.map(page => createLogicalEntryId(page, 'page')) })
  const owners = (...indices: number[]) => new Set(indices.map(index => normalizeSourceId(pages[index]!)))
  try {
    await sync()
    expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(owners(0, 1, 2))

    moduleGraphService.replaceTransformDependencies(styles[0]!, [replacement])
    await sync()
    expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(owners(1, 2))
    expect(moduleGraphService.collectAffectedEntries(replacement)).toEqual(owners(0))

    moduleGraphService.replaceTransformDependencies(styles[1]!, [])
    await sync()
    expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(owners(2))
    expect(moduleGraphService.invalidate(shared)).toEqual(owners(2))
    await sync()
    expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(owners(2))

    moduleGraphService.replaceTransformDependencies(styles[0]!, [])
    await sync()
    expect(moduleGraphService.collectAffectedEntries(replacement)).toEqual(new Set())
    expect(moduleGraphService.collectAffectedEntries(shared)).toEqual(owners(2))
  }
  finally {
    await provider.close()
    await rm(root, { recursive: true, force: true })
  }
})
