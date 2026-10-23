import type { Plugin } from 'vite'
import type { NativeOutputPublicationApi, NativeOutputPublicationSnapshot } from '../../../packages/weapp-vite/src/plugins/outputFinalizer/publicationObservation'
import type { WeappVitePluginApi } from '../../../packages/weapp-vite/src/types/plugin'
import type { NativePublicationOptions } from './files'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME } from '@weapp-core/constants'
import path from 'pathe'
import {
  isNativePublicationProfileIdentity,
  NATIVE_PUBLICATION_PREFIX,
  nativePublicationGeneration,
  nativePublicationHash,
  readNativePublicationInputs,
} from './files'

interface NativeWrite {
  project: string
  inputs: Record<string, string>
  publication?: { api: NativeOutputPublicationApi, epoch: number }
}

/** 观察原生写出或本轮已提交的相同字节；消费方仍须另验正式完成及配置与所有权。 */
export function nativePublicationPlugin(options: NativePublicationOptions = {}): Plugin {
  const writes = new WeakMap<object, NativeWrite>()
  const observations = new Set<Promise<void>>()
  const pendingCommits = new Set<() => void>()
  const errors: unknown[] = []
  const awaitCommit = (committed: Promise<NativeOutputPublicationSnapshot | undefined>) => {
    const observation = Promise.withResolvers<NativeOutputPublicationSnapshot | undefined>()
    const cancel = () => {
      pendingCommits.delete(cancel)
      observation.resolve(undefined)
    }
    pendingCommits.add(cancel)
    void committed.then((snapshot) => {
      pendingCommits.delete(cancel)
      observation.resolve(snapshot)
    }, (error: unknown) => {
      pendingCommits.delete(cancel)
      observation.reject(error)
    })
    return observation.promise
  }
  const finishObservations = async () => {
    // writeBundle 提前失败不一定触发 renderError；关闭仅取消尚未获提交的自有观察。
    for (const cancel of pendingCommits) {
      cancel()
    }
    await Promise.all([...observations])
    const failures = errors.splice(0)
    if (failures.length) {
      throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'Native publication observation failed')
    }
  }
  return {
    name: 'e2e:native-publication',
    enforce: 'post',
    apply: (config, { command }) => command === 'build' && config.build?.write !== false,
    async buildStart() {
      const environment = this.environment
      writes.delete(environment)
      if (environment.config.plugins.some(plugin => plugin.name === 'weapp-vite:workers')) {
        return
      }
      const project = environment.config.root
      writes.set(environment, { project, inputs: await readNativePublicationInputs(project, options) })
    },
    generateBundle() {
      const current = writes.get(this.environment)
      const api: unknown = this.environment.config.plugins.find(plugin => plugin.name === WEAPP_VITE_OUTPUT_PUBLICATION_PLUGIN_NAME)?.api
      if (current && api && typeof api === 'object' && 'getEpoch' in api && typeof api.getEpoch === 'function'
        && 'whenCommitted' in api && typeof api.whenCommitted === 'function') {
        // buildStart 可并行且先后顺序不固定；此时该阶段已全部结束，代次不会再被同轮启动钩子推进。
        const publication = api as NativeOutputPublicationApi
        current.publication = { api: publication, epoch: publication.getEpoch() }
      }
    },
    // 已获提交的磁盘与源码核验仍须完成，不把关闭钩子视为构建成功。
    closeBundle: finishObservations,
    closeWatcher: finishObservations,
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler(outputOptions, bundle) {
        const current = writes.get(this.environment)
        if (!current) {
          return
        }
        const byteWrite = Object.keys(bundle).length > 0
        const root = path.resolve(current.project, outputOptions.dir ?? this.environment.config.build.outDir)
        const committed = !byteWrite && current.publication
          ? current.publication.api.whenCommitted(root, current.publication.epoch)
          : undefined
        if (!byteWrite && !committed) {
          return
        }
        const contextApi = this.environment.config.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
        const currentProfile = contextApi?.ctx?.runtimeState?.build?.hmr?.profile
        // 首次异步读取前复制本轮身份，避免下一轮原地更新或清空共享 profile。
        const identity = isNativePublicationProfileIdentity(currentProfile)
          ? {
              buildId: currentProfile.buildId,
              batchId: currentProfile.batchId,
              sourceEvents: currentProfile.sourceEvents.map(({ eventId, file }) => ({ eventId, file })),
            }
          : undefined
        // END 成功样本只能在 writeBundle 返回后追加；冻结旧样本游标，防止它与后续失败字节拼接。
        const profile = options.profilePath
          ? await readFile(options.profilePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
              if (error.code === 'ENOENT') {
                return ''
              }
              throw error
            })
          : undefined
        const observe = async (snapshot?: NativeOutputPublicationSnapshot) => {
          if (!byteWrite && (!snapshot || snapshot.root !== root || snapshot.epoch !== current.publication?.epoch)) {
            return
          }
          const files = Object.fromEntries((byteWrite
            ? Object.entries(bundle).map(([file, output]) => [file, output.type === 'chunk' ? output.code : output.source] as const)
            : [...snapshot!.outputs])
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([file, source]) => [file.replaceAll('\\', '/'), nativePublicationHash(source)]))
          if (!byteWrite) {
            const matches = await Promise.all(Object.entries(files).map(async ([file, hash]) => {
              try {
                return nativePublicationHash(await readFile(path.join(root, file))) === hash
              }
              catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                  return false
                }
                throw error
              }
            }))
            if (!matches.length || !matches.every(Boolean)) {
              return
            }
          }
          const finalInputs = await readNativePublicationInputs(current.project, options)
          if (nativePublicationGeneration(current.inputs) !== nativePublicationGeneration(finalInputs)) {
            return
          }
          // 后置提交仍可失败；这里只发布候选，等待方继续核对实际 dist、正式 END 与所有权。
          process.stdout.write(`${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({
            boundary: byteWrite ? 'native-byte-write' : 'native-noop',
            generation: nativePublicationGeneration(files),
            inputs: current.inputs,
            outputs: files,
            ...(!byteWrite ? { publicationEpoch: snapshot!.epoch } : {}),
            ...(profile === undefined ? {} : { profileCursor: { offset: profile.length, prefixHash: nativePublicationHash(profile), ...(identity ? { identity } : {}) } }),
          })}\n`)
        }
        if (byteWrite) {
          await observe()
        }
        else {
          // 若观察插件排在发布者之前，等待必须脱离本 hook，避免阻塞后续 sequential 提交。
          const observation = awaitCommit(committed!).then(observe).catch((error) => {
            errors.push(error)
          }).finally(() => {
            observations.delete(observation)
          })
          observations.add(observation)
        }
      },
    },
  }
}
