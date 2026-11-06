import type { OutputBundle } from 'rolldown'

/** 只阻塞指定源码代次的原生发布，不把此前或其他宿主的写出计入恢复完成。 */
export function createTargetPublicationGate(marker: string) {
  const release = Promise.withResolvers<void>()
  let started = false
  let completed = 0

  return {
    started: () => started,
    completed: () => completed,
    release: () => release.resolve(),
    async publish(mode: string, bundle: OutputBundle, complete: () => void | Promise<void>) {
      // 在异步等待前固定本次 hook 的产物身份，后续全局 gate 变化不能改写归属。
      const isTarget = mode === 'build' && Object.values(bundle).some(output =>
        output.type === 'chunk' && output.code.includes(marker),
      )
      if (isTarget) {
        started = true
        await release.promise
      }
      await complete()
      if (isTarget) {
        completed += 1
      }
    },
  }
}
