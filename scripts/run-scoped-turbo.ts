import { createRequire } from 'node:module'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 复用跨平台子进程的信号转发和退出语义。
import { execa } from 'execa'
import { scopedTurboArguments } from './e2eProjectScope'

// 直接运行 Node 入口，Windows 不依赖 .cmd 解析或 shell 引号。
const turboEntry = createRequire(import.meta.url).resolve('turbo/bin/turbo')
const result = await execa(process.execPath, [turboEntry, ...scopedTurboArguments(process.argv.slice(2))], {
  stdio: 'inherit',
  reject: false,
})
process.exitCode = result.exitCode ?? 1
