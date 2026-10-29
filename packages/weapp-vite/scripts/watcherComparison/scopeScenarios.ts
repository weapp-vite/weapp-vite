import type { WatcherScenario, WatcherScenarioContext } from './types'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

async function runSharedRootScopes(
  { root, observe, expectChanges, expectQuiet, assert }: WatcherScenarioContext,
  narrowFirst: boolean,
) {
  const config = path.join(root, 'config.ts')
  const src = path.join(root, 'src')
  const shared = path.join(src, 'shared')
  const file = path.join(shared, 'card.wxml')
  await mkdir(shared, { recursive: true })
  await Promise.all([
    writeFile(config, 'export default "initial"'),
    writeFile(file, '<view>initial</view>'),
  ])

  // 两个逻辑范围落在同一原生订阅根；首次订阅必须完成后再注册另一个 owner。
  const first = observe(narrowFirst ? config : src)
  assert(await first.watcher.ready === 'ready', 'The first scope did not become ready')
  const second = observe(narrowFirst ? src : config)
  assert(await second.watcher.ready === 'ready', 'The second scope did not become ready')
  const narrow = narrowFirst ? first : second
  const broad = narrowFirst ? second : first

  await expectQuiet('source-owner-excludes-config', broad, async () => {
    await expectChanges('exact-config-owner-save', narrow, () => writeFile(config, 'export default "updated"'), [
      { file: config, event: 'update', kind: 'file', contents: 'export default "updated"' },
    ])
  })
  await expectQuiet('config-owner-excludes-deep-update', narrow, async () => {
    await expectChanges('deep-file-update', broad, () => writeFile(file, '<view>updated</view>'), [
      { file, event: 'update', kind: 'file', contents: '<view>updated</view>' },
    ])
  })
  await expectQuiet('config-owner-excludes-deep-delete', narrow, async () => {
    await expectChanges('deep-file-delete', broad, () => rm(file), [
      { file, event: 'delete', kind: 'file' },
    ])
  })
  await expectQuiet('config-owner-excludes-deep-recreate', narrow, async () => {
    await expectChanges('deep-file-recreate', broad, () => writeFile(file, '<view>recreated</view>'), [
      { file, event: 'create', kind: 'file', contents: '<view>recreated</view>' },
    ])
  })

  await narrow.close()
  await expectQuiet('closed-config-owner', narrow, async () => {
    await expectChanges('source-owner-after-config-owner-close', broad, async () => {
      await writeFile(config, 'export default "closed"')
      await writeFile(file, '<view>surviving-owner</view>')
    }, [{ file, event: 'update', kind: 'file', contents: '<view>surviving-owner</view>' }])
  })
  await broad.close()
  await expectQuiet('both-scopes-closed-config', narrow, async () => {
    await expectQuiet('both-scopes-closed-source', broad, async () => {
      await Promise.all([
        writeFile(config, 'export default "all-closed"'),
        writeFile(file, '<view>all-closed</view>'),
      ])
    })
  })
}

export const watcherScopeScenarios: WatcherScenario[] = [
  {
    id: 'same-root-narrow-before-broad',
    run: context => runSharedRootScopes(context, true),
  },
  {
    id: 'same-root-broad-before-narrow',
    run: context => runSharedRootScopes(context, false),
  },
]
