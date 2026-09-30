import type { MpPlatform } from '../types'
import type { DoctorArtifactSnapshot, DoctorOptions } from './types'
import { fork } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 将显式构建隔离到子进程，避免全局编译上下文和插件日志污染并发 API/JSON 输出。 */
export async function buildDoctorSnapshot(options: DoctorOptions, target: MpPlatform): Promise<DoctorArtifactSnapshot> {
  const worker = path.join(path.dirname(fileURLToPath(import.meta.resolve('weapp-vite/package.json'))), 'dist/doctor-worker.mjs')
  return new Promise((resolve, reject) => {
    const child = fork(worker, [], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] })
    let result: DoctorArtifactSnapshot | undefined
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Doctor 构建超时'))
    }, 180_000)
    child.stdout?.on('data', chunk => options.onBuildLog?.(String(chunk)))
    child.stderr?.on('data', chunk => options.onBuildLog?.(String(chunk)))
    child.on('message', (message: { snapshot?: DoctorArtifactSnapshot }) => {
      result = message.snapshot
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && result) {
        resolve(result)
      }
      else {
        reject(new Error('Doctor 构建未完成'))
      }
    })
    child.send({ cwd: options.cwd, configFile: options.configFile, target })
  })
}
