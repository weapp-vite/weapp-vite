import type { Plugin } from 'vite'
import type { NativePublicationOptions } from './files'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import {
  NATIVE_PUBLICATION_PREFIX,
  nativePublicationGeneration,
  nativePublicationHash,
  readNativePublicationInputs,
} from './files'

interface NativeWrite {
  project: string
  inputs: Record<string, string>
}

/** 仅观察原生写出字节；后置写出仍可能失败，消费方必须另验正式完成及配置与所有权。 */
export function nativePublicationPlugin(options: NativePublicationOptions = {}): Plugin {
  const writes = new WeakMap<object, NativeWrite>()
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
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler(_options, bundle) {
        const current = writes.get(this.environment)
        if (!current || !Object.keys(bundle).length) {
          return
        }
        // END 成功样本只能在 writeBundle 返回后追加；冻结旧样本游标，防止它与后续失败字节拼接。
        const profile = options.profilePath
          ? await readFile(options.profilePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
              if (error.code === 'ENOENT') {
                return ''
              }
              throw error
            })
          : undefined
        const files = Object.fromEntries(Object.entries(bundle).sort(([left], [right]) => left.localeCompare(right)).map(([file, output]) => [
          file.replaceAll('\\', '/'),
          nativePublicationHash(output.type === 'chunk' ? output.code : output.source),
        ]))
        const finalInputs = await readNativePublicationInputs(current.project, options)
        if (nativePublicationGeneration(current.inputs) !== nativePublicationGeneration(finalInputs)) {
          return
        }
        // 后置原生提交仍可失败；这里只发布字节候选，等待方必须核对真实 dist 及正式 END。
        // 在 writeBundle 内记录先于 END 的日志位置，不能把异步 closeBundle 当成功边界。
        process.stdout.write(`${NATIVE_PUBLICATION_PREFIX}${JSON.stringify({
          boundary: 'native-byte-write',
          generation: nativePublicationGeneration(files),
          inputs: current.inputs,
          outputs: files,
          ...(profile === undefined ? {} : { profileCursor: { offset: profile.length, prefixHash: nativePublicationHash(profile) } }),
        })}\n`)
      },
    },
  }
}
