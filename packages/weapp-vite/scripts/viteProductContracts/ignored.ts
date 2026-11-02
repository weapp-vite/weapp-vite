import type { BigIntStats, Stats } from 'node:fs'
import type { ViteDevServer } from 'vite'
import type { ProductFailure } from './support'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { createDevViteServer } from '../../src/devLifecycle/vite'
import { adapterRegistrationReady } from '../../src/runtime/watch/viteAdapter'
import { createViteInputRegistration } from '../../src/runtime/watch/viteRegistration'
import { closeServers, event, fixture, serverConfig, waitFor } from './support'

const selections = ['relative-literal', 'cwd-negation', 'literal-directory', 'function-directory', 'stats-file'] as const
type Selection = typeof selections[number]

export function ignoredFor(selection: Selection, root: string) {
  if (selection === 'relative-literal') {
    return ['ignored.js']
  }
  if (selection === 'cwd-negation') {
    return ['**/*.generated.ts', '!**/keep.generated.ts']
  }
  if (selection === 'stats-file') {
    return (_file: string, stats?: Stats | BigIntStats) => stats?.isFile() === true && Number(stats.size) === 0
  }
  const directory = path.join(root, 'pruned')
  return selection === 'literal-directory'
    ? [directory]
    : (file: string) => path.relative(directory, path.resolve(file)) === ''
}

function registered(server: ViteDevServer, file: string) {
  const cwd = server.watcher.options.cwd ?? server.config.root
  return Object.entries(server.watcher.getWatched()).some(([directory, children]) => children.some(child => path.relative(file, path.resolve(cwd, directory, child)) === ''))
}

/** 相对路径、原生否定模式和目录裁剪必须保留各自的公开监听语义。 */
export async function watcherIgnored() {
  const observations: Array<Record<string, unknown>> = []
  const hosts = ['cli', 'vite'] as const
  for (const [host, selection] of hosts.flatMap(host => selections.map(selection => [host, selection] as const))) {
    await fixture({
      'package.json': '{"type":"module"}',
      'source.js': 'export const value = "initial-source"',
      'ignored.js': 'export const value = "ignored-source"',
      'a.generated.ts': 'export const value = "generated-source"',
      'keep.generated.ts': 'export const value = "generated-keep-source"',
      'pruned/input.js': 'export const value = "pruned-source"',
      'empty.js': '',
    }, async (root) => {
      let server: ViteDevServer | undefined
      let registration: ReturnType<typeof createViteInputRegistration> | undefined
      let failure: ProductFailure | undefined
      try {
        server = await (host === 'cli' ? createDevViteServer : createServer)({
          ...serverConfig(root),
          envDir: false,
          publicDir: false,
          server: {
            ...serverConfig(root).server,
            ws: false,
            watch: { cwd: root, useFsEvents: false, usePolling: true, interval: 10, ignored: ignoredFor(selection, root) },
          },
        })
        registration = createViteInputRegistration(server, [root])
        await waitFor(() => registration!.ready, state => state === 'registered', 'Ignored input registration must agree with the actual watcher')
        const source = path.join(root, 'source.js')
        await waitFor(() => registered(server!, source), Boolean, 'Ignored-input fixture must register the source sentinel')
        if (selection === 'relative-literal') {
          assert.equal(registered(server, path.join(root, 'ignored.js')), false, 'Relative literal ignore must resolve against watcher cwd')
          observations.push({ host, selection, relativeLiteralIgnored: true })
        }
        else if (selection === 'cwd-negation') {
          // 保留原生 cwd 与否定模式组合的结果，不自行赋予额外的重新包含语义。
          for (const file of ['a.generated.ts', 'keep.generated.ts']) {
            assert.equal(registered(server, path.join(root, file)), false, 'Cwd glob and negation must preserve native ignored registration')
          }
          observations.push({ host, selection, generatedIgnored: true, negatedGeneratedIgnored: true })
        }
        else if (selection === 'stats-file') {
          const input = path.join(root, 'empty.js')
          assert.equal(registered(server, input), false, `[${host}/${selection}] The initially empty ignored input must not be registered`)
          await writeFile(input, 'export const value = "now-nonempty"')
          server.watcher.add(input)
          await waitFor(() => registered(server!, input), Boolean, 'Explicitly adding an input must re-evaluate its current stats')
          await event(server, input, () => writeFile(input, 'export const value = "nonempty-updated"'))
          observations.push({ host, selection, initiallyIgnored: true, freshStatsRegistered: true, updatedSaveDelivered: true })
        }
        else {
          const input = path.join(root, 'pruned/input.js')
          assert.equal(registered(server, input), false, 'Initially pruned directory must not register its child')
          assert.equal(server.watcher.add(input), server.watcher)
          if (selection === 'literal-directory') {
            await adapterRegistrationReady(server)
            assert.equal(registered(server, input), false, 'Literal ignored directory must still exclude an explicitly added child')
            observations.push({ host, selection, initialChildIgnored: true, explicitChildIgnored: true })
          }
          else {
            await waitFor(() => registered(server!, input), Boolean, 'Function-pruned directory must allow an explicitly added unignored child')
            await event(server, input, () => writeFile(input, 'export const value = "explicit-child-updated"'))
            observations.push({ host, selection, initialChildIgnored: true, explicitChildRegistered: true, explicitChildSaveDelivered: true })
          }
        }
        await event(server, source, () => writeFile(source, 'export const value = "sentinel-updated-after-ignore-check"'))
      }
      catch (error) { failure = { error } }
      finally {
        try {
          await registration?.close()
        }
        catch (error) {
          failure = { error: failure ? new AggregateError([failure.error, error], 'Ignored input assertion and registration cleanup failed', { cause: failure.error }) : error }
        }
        await closeServers([server], failure)
      }
    })
  }
  assert.equal(observations.length, selections.length * hosts.length, 'Every host and ignored-input configuration must complete')
  return { configurations: observations, sourceSentinelsDelivered: true }
}
