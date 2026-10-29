import type { WatcherScenario } from './types'
import { mkdir, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { watcherScopeScenarios } from './scopeScenarios'
import { matchesWatcherChange } from './state'

export const watcherScenarios: WatcherScenario[] = [
  ...watcherScopeScenarios,
  {
    id: 'large-tree-repeated-single-save',
    async run({ root, observe, expectChanges }) {
      const src = path.join(root, 'src')
      const directories = Array.from({ length: 32 }, (_, index) => path.join(src, `group-${index}`))
      await Promise.all(directories.map(directory => mkdir(directory, { recursive: true })))
      const files = directories.flatMap(directory => Array.from({ length: 32 }, (_, index) => path.join(directory, `source-${index}.js`)))
      await Promise.all(files.map(file => writeFile(file, 'export default "initial"')))
      const observation = observe(src)
      await observation.watcher.ready
      const file = files[512]!
      for (let version = 1; version <= 8; version++) {
        await expectChanges(`large-tree-save-${version}`, observation, () => writeFile(file, `export default "version-${version}"`), [
          { file, event: 'update', kind: 'file', contents: `export default "version-${version}"` },
        ])
      }
    },
  },
  {
    id: 'ready-during-save',
    async run({ root, observe, assert, expectChanges }) {
      const src = path.join(root, 'src')
      await mkdir(src)
      const files = Array.from({ length: 96 }, (_, index) => path.join(src, `source-${index}.js`))
      await Promise.all(files.map(file => writeFile(file, 'before')))
      const observation = observe(src, { ignoreInitial: false })
      // 保存可以发生在首次扫描期间；ready 后读取的必须是最新输入，不限定扫描中的事件排序。
      await expectChanges('save-during-registration', observation, async () => {
        await writeFile(files[0]!, 'saved-during-registration')
        assert(await observation.watcher.ready === 'ready', 'Initial registration did not become ready')
      }, [{ file: files[0]!, kind: 'file', contents: 'saved-during-registration' }])
      assert(await readFile(files[0]!, 'utf8') === 'saved-during-registration', 'The latest initial input was lost')
      assert(observation.changes.some(change => matchesWatcherChange(change, { file: files[0]!, kind: 'file' })), 'The initial file was not discovered')
    },
  },
  {
    id: 'ignore-initial-and-dynamic-targets',
    async run({ root, observe, expectChanges, expectQuiet, assert }) {
      const src = path.join(root, 'src')
      const external = path.join(root, 'dependency')
      await Promise.all([mkdir(src), mkdir(external)])
      const original = path.join(src, 'entry.js')
      const dependency = path.join(external, 'shared.js')
      await Promise.all([writeFile(original, 'original'), writeFile(dependency, 'before')])
      const observation = observe(original)
      assert(await observation.watcher.ready === 'ready', 'Initial registration did not become ready')
      await expectQuiet('ignore-initial', observation, async () => {})
      assert(observation.changes.length === 0, 'ignoreInitial emitted an initial create')
      assert(await observation.watcher.add(dependency) === 'ready', 'The dynamic target was not registered')
      await expectChanges('first-save-after-add', observation, () => writeFile(dependency, 'first-dynamic-save'), [
        { file: dependency, event: 'update', kind: 'file', contents: 'first-dynamic-save' },
      ])
      assert(await observation.watcher.updateTargets([dependency]) === 'ready', 'Target replacement did not complete')
      await expectQuiet('removed-target', observation, () => writeFile(original, 'no-longer-owned'))
      await expectChanges('retained-target', observation, () => writeFile(dependency, 'retained-save'), [
        { file: dependency, event: 'update', kind: 'file', contents: 'retained-save' },
      ])
    },
  },
  {
    id: 'atomic-replacement-and-next-save',
    async run({ root, observe, expectChanges }) {
      const file = path.join(root, 'entry.js')
      const replacement = path.join(root, 'entry.tmp')
      await writeFile(file, 'before')
      const observation = observe(file)
      await observation.watcher.ready
      await expectChanges('atomic-replacement', observation, async () => {
        await writeFile(replacement, 'atomic-save')
        await rename(replacement, file)
      }, [{ file, kind: 'file', contents: 'atomic-save' }])
      await expectChanges('next-save-after-replacement', observation, () => writeFile(file, 'next-save'), [
        { file, event: 'update', kind: 'file', contents: 'next-save' },
      ])
    },
  },
  {
    id: 'directory-delete-and-recreate',
    async run({ root, observe, expectChanges }) {
      const directory = path.join(root, 'src')
      const file = path.join(directory, 'entry.js')
      await mkdir(directory)
      await writeFile(file, 'before')
      const observation = observe(directory)
      await observation.watcher.ready
      await expectChanges('delete-directory', observation, () => rm(directory, { recursive: true }), [
        { file, event: 'delete', kind: 'file' },
        { file: directory, event: 'delete', kind: 'directory' },
      ])
      await expectChanges('recreate-directory', observation, async () => {
        await mkdir(directory)
        await writeFile(file, 'recreated')
      }, [
        { file: directory, event: 'create', kind: 'directory' },
        { file, event: 'create', kind: 'file', contents: 'recreated' },
      ])
      await expectChanges('save-after-directory-recovery', observation, () => writeFile(file, 'next-save'), [
        { file, event: 'update', kind: 'file', contents: 'next-save' },
      ])
    },
  },
  {
    id: 'missing-root-and-file-recovery',
    async run({ root, observe, expectChanges }) {
      const directory = path.join(root, 'missing/nested')
      const file = path.join(directory, 'entry.js')
      const observation = observe([directory, file])
      await observation.watcher.ready
      await expectChanges('create-missing-root', observation, async () => {
        await mkdir(directory, { recursive: true })
        await writeFile(file, 'created')
      }, [{ file, event: 'create', kind: 'file', contents: 'created' }])
      await expectChanges('delete-single-file', observation, () => rm(file), [{ file, event: 'delete', kind: 'file' }])
      await expectChanges('recreate-single-file', observation, () => writeFile(file, 'recreated'), [{ file, event: 'create', kind: 'file', contents: 'recreated' }])
      await expectChanges('save-recreated-file', observation, () => writeFile(file, 'latest'), [{ file, event: 'update', kind: 'file', contents: 'latest' }])
    },
  },
  {
    id: 'external-symlink-logical-path',
    async run({ root, observe, expectChanges }) {
      const src = path.join(root, 'src')
      const external = path.join(root, 'external')
      const link = path.join(src, 'linked')
      await Promise.all([mkdir(src), mkdir(external)])
      const physicalFile = path.join(external, 'shared.js')
      const logicalFile = path.join(link, 'shared.js')
      await writeFile(physicalFile, 'before')
      await symlink(external, link, process.platform === 'win32' ? 'junction' : 'dir')
      const observation = observe(src)
      await observation.watcher.ready
      await expectChanges('save-outside-root-through-symlink', observation, () => writeFile(physicalFile, 'updated'), [
        { file: logicalFile, event: 'update', kind: 'file', contents: 'updated' },
      ])
    },
  },
  {
    id: 'depth-and-target-promotion',
    async run({ root, observe, expectChanges, expectQuiet, assert }) {
      const src = path.join(root, 'src')
      const nested = path.join(src, 'nested')
      const direct = path.join(src, 'entry.js')
      const child = path.join(nested, 'child.js')
      await mkdir(nested, { recursive: true })
      await Promise.all([writeFile(direct, 'before'), writeFile(child, 'before')])
      const observation = observe(src, { depth: 0 })
      await observation.watcher.ready
      await expectQuiet('depth-excludes-descendant', observation, () => writeFile(child, 'outside-depth'))
      await expectChanges('depth-includes-direct-file', observation, () => writeFile(direct, 'direct-save'), [
        { file: direct, event: 'update', kind: 'file', contents: 'direct-save' },
      ])
      assert(await observation.watcher.add(nested) === 'ready', 'The nested root was not registered')
      await expectChanges('promoted-root-first-save', observation, () => writeFile(child, 'promoted-save'), [
        { file: child, event: 'update', kind: 'file', contents: 'promoted-save' },
      ])
      await observation.watcher.updateTargets(nested)
      await expectChanges('promoted-root-after-parent-removal', observation, () => writeFile(child, 'retained-save'), [
        { file: child, event: 'update', kind: 'file', contents: 'retained-save' },
      ])
    },
  },
  {
    id: 'chained-symlink-retarget',
    async run({ root, observe, expectChanges, expectQuiet }) {
      const src = path.join(root, 'src')
      const external = path.join(root, 'external')
      const original = path.join(root, 'original')
      const replacement = path.join(root, 'replacement')
      await Promise.all([mkdir(src), mkdir(external), mkdir(original), mkdir(replacement)])
      const first = path.join(src, 'first')
      const second = path.join(external, 'second')
      const originalFile = path.join(original, 'shared.js')
      const replacementFile = path.join(replacement, 'shared.js')
      const logicalFile = path.join(first, 'second/shared.js')
      await Promise.all([writeFile(originalFile, 'before'), writeFile(replacementFile, 'replacement')])
      const linkType = process.platform === 'win32' ? 'junction' : 'dir'
      await symlink(original, second, linkType)
      await symlink(external, first, linkType)
      const observation = observe(src)
      await observation.watcher.ready
      await expectChanges('chained-link-save', observation, () => writeFile(originalFile, 'chained-save'), [
        { file: logicalFile, event: 'update', kind: 'file', contents: 'chained-save' },
      ])
      await expectChanges('retarget-inner-link', observation, async () => {
        await unlink(second)
        await symlink(replacement, second, linkType)
      }, [{ file: logicalFile, kind: 'file', contents: 'replacement' }])
      await expectChanges('first-save-after-retarget', observation, () => writeFile(replacementFile, 'retarget-save'), [
        { file: logicalFile, event: 'update', kind: 'file', contents: 'retarget-save' },
      ])
      await expectQuiet('previous-link-target', observation, () => writeFile(originalFile, 'no-longer-owned'))
    },
  },
  {
    id: 'shared-target-independent-owners',
    async run({ root, observe, expectChanges, expectQuiet }) {
      const file = path.join(root, 'shared.js')
      await writeFile(file, 'before')
      const first = observe(file)
      const second = observe(file)
      await Promise.all([first.watcher.ready, second.watcher.ready])
      let saved: Promise<void> | undefined
      const save = () => saved ??= writeFile(file, 'both-owners-save')
      await Promise.all([
        expectChanges('shared-first-owner', first, save, [{ file, event: 'update', kind: 'file', contents: 'both-owners-save' }]),
        expectChanges('shared-second-owner', second, save, [{ file, event: 'update', kind: 'file', contents: 'both-owners-save' }]),
      ])
      await first.close()
      await expectQuiet('retired-owner', first, async () => {
        await expectChanges('surviving-owner', second, () => writeFile(file, 'survivor-save'), [
          { file, event: 'update', kind: 'file', contents: 'survivor-save' },
        ])
      })
      await second.close()
      await expectQuiet('both-owners-retired', first, async () => {
        await expectQuiet('last-owner-retired', second, () => writeFile(file, 'all-owners-closed'))
      })
    },
  },
  {
    id: 'close-during-registration',
    async run({ root, observe, expectQuiet, assert }) {
      const src = path.join(root, 'src')
      await mkdir(src)
      const files = Array.from({ length: 96 }, (_, index) => path.join(src, `source-${index}.js`))
      await Promise.all(files.map(file => writeFile(file, 'before')))
      const observation = observe(files[0]!)
      await observation.watcher.ready
      const updating = observation.watcher.updateTargets(src)
      await Promise.all([updating, observation.close(), observation.close()])
      assert(await observation.watcher.add(root) === 'closed', 'add after close restarted observation')
      assert(await observation.watcher.updateTargets(root) === 'closed', 'updateTargets after close restarted observation')
      await expectQuiet('save-after-close', observation, () => writeFile(files[0]!, 'closed-save'))
      const pending = observe(src)
      await pending.close()
      assert(['closed', 'ready'].includes(await pending.watcher.ready), 'Close left initial registration unresolved')
      await expectQuiet('closed-initial-registration', pending, () => writeFile(files[1]!, 'never-reopen'))
    },
  },
  {
    id: 'ignored-paths-and-stable-writes',
    async run({ root, observe, expectChanges, expectQuiet }) {
      const file = path.join(root, 'entry.js')
      const ignored = path.join(root, 'ignored.js')
      await Promise.all([writeFile(file, 'before'), writeFile(ignored, 'before')])
      const observation = observe(root, {
        ignored: target => target.endsWith('ignored.js'),
        stability: { threshold: 60, interval: 10 },
      })
      await observation.watcher.ready
      await expectQuiet('ignored-file', observation, () => writeFile(ignored, 'ignored-save'))
      await expectChanges('stable-write', observation, async () => {
        await writeFile(file, 'partial')
        await writeFile(file, 'complete')
      }, [{ file, event: 'update', kind: 'file', contents: 'complete' }])
    },
  },
]
