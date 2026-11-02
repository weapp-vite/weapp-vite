import type { ViteDevServer } from 'vite'
import type { ProductFailure } from './support'
import assert from 'node:assert/strict'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createLogger } from 'vite'
import { createDevViteServer } from '../../src/devLifecycle/vite'
import { closeServers, event, fixture, observeOutcome, serverConfig, waitFor } from './support'

type Watcher = ViteDevServer['watcher']
interface Owner {
  watcher: Watcher
  sourceChanges: number
  record: (kind: string, file: string) => void
  failed: (error: unknown) => void
}

function sameFile(first: string, second: string) {
  const normalize = (file: string) => {
    const absolute = path.resolve(file).replaceAll('\\', '/')
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute
  }
  return normalize(first) === normalize(second)
}

function watched(watcher: Watcher, file: string) {
  const base = watcher.options.cwd ?? process.cwd()
  return Object.entries(watcher.getWatched()).some(([directory, children]) => children.some(child => sameFile(path.resolve(base, directory, child), file)))
}

/** 新增和删除也必须等待真实公开事件；失败时先终结本次观察再交还资源。 */
async function notice(server: ViteDevServer, kind: 'add' | 'unlink', file: string, mutate: () => Promise<void>) {
  const watcher = server.watcher
  let delivered = false
  let cancelled = false
  let watcherFailure: ProductFailure | undefined
  let mutationFailure: ProductFailure | undefined
  const record = (candidate: string) => {
    delivered ||= sameFile(candidate, file)
  }
  const failed = (error: unknown) => {
    watcherFailure = { error }
  }
  watcher.on(kind, record)
  watcher.on('error', failed)
  const observing = observeOutcome(waitFor(() => {
    if (watcherFailure) {
      throw watcherFailure.error
    }
    return delivered || cancelled
  }, value => value, `Product watcher did not deliver ${kind} for ${path.basename(file)}`))
  let outcome: PromiseSettledResult<boolean>
  try {
    try {
      await mutate()
    }
    catch (error) {
      mutationFailure = { error }
      cancelled = true
    }
    outcome = await observing
  }
  finally {
    watcher.off(kind, record)
    watcher.off('error', failed)
  }
  if (mutationFailure && outcome.status === 'rejected') {
    throw new AggregateError([mutationFailure.error, outcome.reason], 'Product input mutation and observation failed', { cause: mutationFailure.error })
  }
  if (mutationFailure) {
    throw mutationFailure.error
  }
  if (outcome.status === 'rejected') {
    throw outcome.reason
  }
}

/** 两种公开监听后端均使用真实外部输入，避免只验证根目录内的保存。 */
export async function watcherInputs() {
  for (const backend of ['native', 'polling'] as const) {
    await fixture({
      'project/package.json': '{"name":"product-inputs","type":"module"}',
      'project/source.js': 'export const marker = "initial-input"; export const dependency = "__product_dependency__"',
      'project/ignored.js': 'export const ignored = "initial-ignored"',
      'plugin/dependency.txt': 'plugin-input-initial',
      'dynamic/source.txt': 'dynamic-input-initial',
    }, async (workspace) => {
      const root = path.join(workspace, 'project')
      const source = path.join(root, 'source.js')
      const ignored = path.join(root, 'ignored.js')
      const dependency = path.join(workspace, 'plugin/dependency.txt')
      const dynamic = path.join(workspace, 'dynamic/source.txt')
      const envDir = path.join(workspace, 'environment')
      const envFile = path.join(envDir, '.env')
      const publicDir = path.join(workspace, 'public-assets')
      const publicFile = path.join(publicDir, 'input.txt')
      const envKey = 'VITE_WEAPP_VITE_PRODUCT_INPUT'
      const owners: Owner[] = []
      const retired = new Map<Owner, number>()
      const errors: unknown[] = []
      let ignoredEvents = 0
      let dynamicChanges = 0
      let marker = 'initial-input'
      let dependencyValue = 'plugin-input-initial'
      let server: ViteDevServer | undefined
      let failure: ProductFailure | undefined
      const healthy = () => {
        if (errors.length) {
          throw errors[0]
        }
      }
      const registered = (file: string, present = true) => waitFor(() => {
        healthy()
        return watched(server!.watcher, file)
      }, value => value === present, `Product input registration did not become ${present ? 'present' : 'absent'} for ${path.basename(file)}`)
      const transformed = async () => {
        const result = await waitFor(async () => {
          healthy()
          return await server!.transformRequest('/source.js')
        }, output => output?.code.includes(marker) === true && output.code.includes(dependencyValue), 'Product transform did not publish the current source and external dependency')
        assert.ok(result?.code.includes(marker) && result.code.includes(dependencyValue))
      }
      const save = async (next: string, atomic = false) => {
        await event(server!, source, async () => {
          marker = next
          const code = `export const marker = ${JSON.stringify(marker)}; export const dependency = "__product_dependency__"`
          if (atomic) {
            await writeFile(`${source}.next`, code)
            await rename(`${source}.next`, source)
          }
          else {
            await writeFile(source, code)
          }
        })
        await transformed()
        for (const [owner, stopped] of retired) {
          assert.equal(owner.sourceChanges, stopped, 'Retired input owner must not receive saves after environment restart')
        }
      }
      const restarted = async (previous: ViteDevServer['config'], owner: Owner, expected: string | undefined) => {
        let last: Record<string, unknown> = {}
        await waitFor(() => {
          healthy()
          last = { backend, expectedEnv: expected ?? null, actualEnv: server!.config.env[envKey] ?? null, configChanged: server!.config !== previous, watcherChanged: server!.watcher !== owner.watcher, sourceRegistered: watched(server!.watcher, source), generations: owners.length }
          return last.configChanged && last.actualEnv === (expected ?? null) && last.watcherChanged && last.sourceRegistered
        }, value => Boolean(value), 'Environment edits must replace the config and watcher, load the current env, and register source inputs').catch((error) => {
          throw new Error(`Environment restart did not publish its next generation: ${JSON.stringify(last)}`, { cause: error })
        })
        retired.set(owner, owner.sourceChanges)
      }
      try {
        const logger = createLogger('silent')
        const originalError = logger.error.bind(logger)
        logger.error = (message, options) => {
          errors.push(message)
          originalError(message, options)
        }
        server = await createDevViteServer({
          ...serverConfig(root),
          customLogger: logger,
          envDir,
          publicDir,
          plugins: [{
            name: 'product:third-party-external-input',
            configureServer(host) {
              const owner: Owner = {
                watcher: host.watcher,
                sourceChanges: 0,
                record(kind, file) {
                  if (kind === 'change' && sameFile(file, source)) {
                    owner.sourceChanges++
                  }
                  if (kind === 'change' && sameFile(file, dynamic)) {
                    dynamicChanges++
                  }
                  if (sameFile(file, ignored)) {
                    ignoredEvents++
                  }
                },
                failed(error) { errors.push(error) },
              }
              owners.push(owner)
              owner.watcher.on('all', owner.record)
              owner.watcher.on('error', owner.failed)
            },
            async transform(code, id) {
              if (sameFile(id.split('?')[0]!, source)) {
                this.addWatchFile(dependency)
                return code.replace('"__product_dependency__"', JSON.stringify(await readFile(dependency, 'utf8')))
              }
            },
          }],
          server: {
            ...serverConfig(root).server,
            // Vite 仅在启用 HMR 时响应 env 文件的自动重启；端口由系统分配。
            hmr: { port: 0 },
            fs: { allow: [workspace] },
            watch: { useFsEvents: false, usePolling: backend === 'polling', interval: 10, ignored: ['**/ignored.js'] },
          },
        })
        assert.ok(watched(server.watcher, source), 'Product startup must register source before the immediate save')
        assert.equal(watched(server.watcher, ignored), false)
        const originalEnv = server.config.env[envKey]
        assert.equal(originalEnv, undefined, 'The product fixture env key must not be inherited')
        await save(`${backend}-immediate-save`)
        await registered(dependency)
        for (const next of ['continuous-first', 'continuous-second']) {
          await save(`${backend}-${next}`)
        }
        await save(`${backend}-atomic-replacement`, true)
        await event(server, dependency, async () => {
          dependencyValue = 'plugin-input-updated'
          await writeFile(dependency, dependencyValue)
        })
        await transformed()
        assert.equal(server.watcher.add(dynamic), server.watcher)
        await registered(dynamic)
        await event(server, dynamic, () => writeFile(dynamic, 'dynamic-input-first-save'))
        assert.ok(dynamicChanges > 0)
        assert.equal(server.watcher.unwatch(dynamic), server.watcher)
        await registered(dynamic, false)
        const unwatched = dynamicChanges
        await writeFile(dynamic, 'dynamic-input-unwatched-save')
        await writeFile(ignored, 'export const ignored = "changed-ignored"')
        await save(`${backend}-unwatch-sentinel`)
        assert.equal(dynamicChanges, unwatched, 'Unwatched external input must not publish changes')
        assert.equal(server.watcher.add(dynamic), server.watcher)
        await registered(dynamic)
        await event(server, dynamic, () => writeFile(dynamic, 'dynamic-input-restored-save'))
        assert.ok(dynamicChanges > unwatched)
        await notice(server, 'add', publicFile, async () => {
          await mkdir(publicDir, { recursive: true })
          await writeFile(publicFile, 'public-input-created')
        })
        await registered(publicFile)
        await notice(server, 'unlink', publicFile, () => rm(publicDir, { recursive: true }))
        await registered(publicFile, false)
        for (const present of [true, false]) {
          const previous = server.config
          const owner = owners.find(candidate => candidate.watcher === server!.watcher)
          assert.ok(owner, 'Every active watcher must have a recorded owner')
          await notice(server, present ? 'add' : 'unlink', envFile, async () => {
            if (present) {
              await mkdir(envDir, { recursive: true })
              await writeFile(envFile, `${envKey}=created-external-environment\n`)
            }
            else {
              await rm(envDir, { recursive: true })
            }
          })
          await restarted(previous, owner, present ? 'created-external-environment' : originalEnv)
          await save(`${backend}-env-${present ? 'created' : 'deleted'}-first-save`)
          await registered(dependency)
        }
        assert.equal(ignoredEvents, 0, 'Ignored input must remain silent through saves and environment restarts')
        assert.equal(watched(server.watcher, ignored), false)
        healthy()
      }
      catch (error) { failure = { error } }
      finally {
        for (const owner of owners) {
          owner.watcher.off('all', owner.record)
          owner.watcher.off('error', owner.failed)
        }
        await closeServers([server], failure)
      }
    })
  }
  return { backends: ['native', 'polling'], immediateContinuousAndAtomicSaves: true, externalPluginInput: true, dynamicAddUnwatchAndRestore: true, missingPublicCreateDelete: true, missingEnvCreateDeleteRestart: true, ignoredInputSilent: true, retiredOwnersStopped: true }
}
