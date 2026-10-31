import { randomUUID } from 'node:crypto'
import { sendInspectorCommand, waitForWebSocketOpen } from '../../e2e/utils/dev-inspector'
import { DEV_PROCESS_GRACEFUL_TIMEOUT_MS } from '../../e2e/utils/devProcessCleanup/shutdown'

// 保留一秒独立控制清理和四秒自然退出空间，不扩大现有开发进程的完整收尾窗口。
export const HISTORICAL_SHUTDOWN_WORK_BUDGET_MS = DEV_PROCESS_GRACEFUL_TIMEOUT_MS - 5_000
const CONTROL_RELEASE_TIMEOUT_MS = 1_000

interface RemoteObject {
  objectId?: string
  value?: unknown
}

interface RuntimeResult {
  result?: RemoteObject
  exceptionDetails?: { text?: string, exception?: { description?: string } }
}

/** 只检查已加载的公开 Sass 模块；停止前不加载编译器，也不修改编译热路径。 */
function sealExpression(measuredCliPath: string) {
  return `(() => {
    const require = process.getBuiltinModule('node:module').createRequire(${JSON.stringify(measuredCliPath)});
    const state = { records: [], failures: [] };
    const seen = new Set();
    for (const cached of Object.values(require.cache)) {
      const api = cached && cached.exports;
      const info = api && Object.getOwnPropertyDescriptor(api, 'info')?.value;
      if (typeof info !== 'string' || info.split(String.fromCharCode(9))[0] !== 'sass-embedded') continue;
      const prototype = api.AsyncCompiler?.prototype;
      if (!prototype) {
        state.failures.push(new Error('Loaded historical Sass compiler does not expose AsyncCompiler'));
        continue;
      }
      if (seen.has(prototype)) continue;
      seen.add(prototype);
      const guard = Object.getOwnPropertyDescriptor(prototype, 'throwIfDisposed');
      if (typeof guard?.value !== 'function' || typeof prototype.dispose !== 'function') {
        state.failures.push(new Error('Loaded historical Sass compiler does not expose the verified shutdown contract'));
        continue;
      }
      state.records.push({ prototype });
      Object.defineProperty(prototype, 'throwIfDisposed', {
        ...guard,
        value() {
          const error = new Error('Historical Sass compilation started after shutdown was sealed');
          state.failures.push(error);
          if (process.exitCode === undefined || Number(process.exitCode) === 0) process.exitCode = 1;
          throw error;
        }
      });
    }
    state.keepAlive = setInterval(() => {}, 1000);
    return state;
  })()`
}

function assertRuntime(result: RuntimeResult, stage: string) {
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'unknown runtime exception'
    throw new Error(`Historical shutdown ${stage} failed: ${detail}`)
  }
  if (!result.result) {
    throw new Error(`Historical shutdown ${stage} did not return a result`)
  }
  return result.result
}

function requireObject(result: RuntimeResult, stage: string) {
  const objectId = assertRuntime(result, stage).objectId
  if (!objectId) {
    throw new Error(`Historical shutdown ${stage} did not return an object handle`)
  }
  return objectId
}

function requireConfirmation(result: RuntimeResult, stage: string) {
  if (assertRuntime(result, stage).value !== true) {
    throw new Error(`Historical shutdown ${stage} did not confirm completion`)
  }
}

/** 同一调试连接先封住迟到编译，再进入原 SIGINT 路径并等待原 Sass disposer。 */
export async function requestHistoricalBaselineShutdown(inspectorUrl: string, measuredCliPath: string, timeoutMs = HISTORICAL_SHUTDOWN_WORK_BUDGET_MS): Promise<void> {
  const socket = new WebSocket(inspectorUrl)
  const objectGroup = `historical-shutdown-${randomUUID()}`
  const deadline = Date.now() + timeoutMs
  let commandId = 0
  const errors: unknown[] = []
  const command = <T>(method: string, params?: Record<string, unknown>) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      return Promise.reject(new Error(`Historical shutdown deadline exceeded (${timeoutMs} ms)`))
    }
    return sendInspectorCommand<T>(socket, ++commandId, method, params, remaining)
  }
  const call = async (objectId: string, functionDeclaration: string, args: Array<{ objectId: string } | { value: unknown }> = [], returnByValue = false) => {
    return command<RuntimeResult>('Runtime.callFunctionOn', { objectId, functionDeclaration, arguments: args, awaitPromise: true, returnByValue, objectGroup })
  }
  let stateId: string | undefined
  const inventories: string[] = []
  try {
    await waitForWebSocketOpen(socket, timeoutMs)
    try {
      stateId = requireObject(await command<RuntimeResult>('Runtime.evaluate', { expression: sealExpression(measuredCliPath), objectGroup }), 'seal')
      const recordsId = requireObject(await call(stateId, 'function() { return this.records }'), 'compiler records')
      const properties = await command<{ result?: Array<{ name: string, value?: RemoteObject }> }>('Runtime.getProperties', { objectId: recordsId, ownProperties: true })
      if (!properties.result) {
        throw new Error('Historical shutdown did not enumerate compiler records')
      }
      for (const property of properties.result.filter(property => /^(?:0|[1-9]\d*)$/.test(property.name))) {
        try {
          const recordId = property.value?.objectId
          if (!recordId) {
            throw new Error('Historical shutdown compiler record has no object handle')
          }
          const prototypeId = requireObject(await call(recordId, 'function() { return this.prototype }'), 'compiler prototype')
          const queried = await command<{ objects?: RemoteObject }>('Runtime.queryObjects', { prototypeObjectId: prototypeId, objectGroup })
          if (!queried.objects?.objectId) {
            throw new Error('Historical shutdown did not enumerate compiler instances')
          }
          inventories.push(requireObject(await call(queried.objects.objectId, 'function() { return this.map(instance => ({ instance, dispose: instance.dispose })) }'), 'compiler disposers'))
        }
        catch (error) {
          errors.push(error)
        }
      }
    }
    catch (error) {
      errors.push(error)
    }

    // Sass 枚举失败仍尝试原关闭路径；先前的协议或能力错误不会被成功信号覆盖。
    try {
      const signal = assertRuntime(await command<RuntimeResult>('Runtime.evaluate', {
        expression: 'process.listenerCount(\'SIGINT\') > 0 && process.emit(\'SIGINT\')',
        returnByValue: true,
      }), 'SIGINT')
      if (signal.value !== true) {
        throw new Error('Historical shutdown did not deliver SIGINT to a registered handler')
      }
    }
    catch (error) {
      errors.push(error)
    }

    // 先启动全部副本的收尾，避免一份挂起就跳过其他副本的原 disposer。
    const disposals = await Promise.allSettled(inventories.map(async (objectsId) => {
      requireConfirmation(await call(objectsId, `async function() {
          const results = await Promise.allSettled(this.map(({ instance, dispose }) => Promise.resolve().then(() => Reflect.apply(dispose, instance, []))));
          const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
          if (failures.length) throw new AggregateError(failures, 'Historical Sass disposal failed: ' + failures.map(error => String(error?.stack ?? error)).join('\\n'));
          return true;
        }`, [], true), 'Sass disposal')
    }))
    for (const disposal of disposals) {
      if (disposal.status === 'rejected') {
        errors.push(disposal.reason)
      }
    }
    if (stateId) {
      try {
        requireConfirmation(await call(stateId, `function() {
          if (this.failures.length) throw new AggregateError(this.failures, 'Historical Sass shutdown guard rejected late compilation: ' + this.failures.map(error => String(error?.stack ?? error)).join('\\n'));
          return true;
        }`, [], true), 'late compilation check')
      }
      catch (error) {
        errors.push(error)
      }
    }
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    if (stateId) {
      try {
        // 收尾单独保留有界预算，确保前面的超时也能清除本次调试控制创建的保活。
        requireConfirmation(await sendInspectorCommand<RuntimeResult>(socket, ++commandId, 'Runtime.callFunctionOn', {
          objectId: stateId,
          functionDeclaration: 'function() { clearInterval(this.keepAlive); this.keepAlive = undefined; return true }',
          arguments: [],
          awaitPromise: true,
          returnByValue: true,
        }, CONTROL_RELEASE_TIMEOUT_MS), 'control release')
      }
      catch (error) {
        errors.push(error)
      }
    }
    // 清保活后上下文可立即自然退出；断开会话同时释放 objectGroup，不再访问已退出的上下文。
    try {
      socket.close()
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Historical baseline shutdown failed', { cause: errors[0] })
  }
}
