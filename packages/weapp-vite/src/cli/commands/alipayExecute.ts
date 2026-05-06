import type { SpawnOptions } from 'node:child_process'
import type { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import process from 'node:process'

export type MinidevSpawn = (command: string, argv: string[], options: SpawnOptions) => EventEmitter

function createSpawnOptions(): SpawnOptions {
  return {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  }
}

/**
 * @description 执行本机 minidev 命令。
 */
export async function runSpawnMinidev(command: string, argv: string[], runner: MinidevSpawn) {
  await new Promise<void>((resolve, reject) => {
    const child = runner(command, argv, createSpawnOptions())
    child.on('error', (error) => {
      reject(error)
    })
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(signal
        ? `minidev ${argv[0] ?? ''} exited with signal ${signal}`
        : `minidev ${argv[0] ?? ''} exited with code ${code ?? 'unknown'}`))
    })
  })
}

/**
 * @description 使用系统进程执行本机 minidev 命令。
 */
export async function spawnMinidev(command: string, argv: string[]) {
  return await runSpawnMinidev(command, argv, spawn)
}
