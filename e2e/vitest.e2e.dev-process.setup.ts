import { afterAll } from 'vitest'
import { beginWindowsKernelQueryScope, closeWindowsKernelQueryScope } from './utils/devProcessCleanup/windowsKernelQueryScope'

const scope = beginWindowsKernelQueryScope()

// timeout=0 只用于最后的所有权终结门禁；不能因 hook 超时丢弃仍持有原生句柄的 worker。
// 查询本身仍受原 30 秒期限与取消控制。没有 close 回执时不允许结束本模块或启动下一文件。
afterAll(() => closeWindowsKernelQueryScope(scope, new Error('E2E worker is closing with active kernel queries.')), 0)
