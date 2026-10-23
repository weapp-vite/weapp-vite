import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { resolveDevProcessTraceDirectory } from '../devProcessTrace'

const SHUTDOWN_TRACE_ENV = 'WEAPP_VITE_E2E_DEV_SHUTDOWN_TRACE'

/** 在调用方已准备的子进程环境上追加测试诊断，不重建或扩大其继承范围。 */
export function withDevProcessShutdownTrace(env: NodeJS.ProcessEnv | undefined) {
  if (process.env[SHUTDOWN_TRACE_ENV] !== '1') {
    return env
  }
  const inherited = env ?? process.env
  const preload = new URL('./preload.mjs', import.meta.url).href
  return {
    ...inherited,
    NODE_OPTIONS: [inherited.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' '),
    WEAPP_VITE_DEV_SHUTDOWN_TRACE_DIR: path.resolve(resolveDevProcessTraceDirectory(SHUTDOWN_TRACE_ENV)),
    WEAPP_VITE_DEV_SHUTDOWN_TRACE_ID: randomUUID(),
  }
}
