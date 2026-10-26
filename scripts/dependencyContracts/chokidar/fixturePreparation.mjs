import fs from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { bounded, deferred } from './support.mjs'

/** 初始文件先完成真实原生创建通知与句柄关闭，再交给被测 watcher。 */
export async function prepareInitialFile({ file, value, timeoutMs, instrumentation, record }) {
  const notification = deferred()
  void notification.promise.catch(() => {})
  let native
  let failure
  const onError = error => notification.reject(error)
  try {
    native = fs.watch(path.dirname(file), (event, filename) => {
      if (event !== 'rename' || filename == null || String(filename) !== path.basename(file)) {
        return
      }
      record({ phase: 'initial-file-native-create', event, file: path.basename(file) })
      notification.resolve()
    })
    native.on('error', onError)
    record({ phase: 'preparation-watcher-started' })
    await instrumentation.settleDirectoryRegistration(timeoutMs)
    record({ phase: 'preparation-native-registration-confirmed' })
    await writeFile(file, value)
    record({ phase: 'initial-file-written' })
    await bounded(notification.promise, 'initial fixture exact native creation notification', timeoutMs)
  }
  catch (error) {
    failure = { error }
  }
  if (native) {
    try {
      native.close()
      await instrumentation.assertAllClosed(timeoutMs)
      record({ phase: 'preparation-native-close-confirmed' })
      native.off('error', onError)
    }
    catch (error) {
      if (failure) {
        throw new AggregateError([failure.error, error], 'Initial fixture preparation failed and its native close did not complete.', { cause: failure.error })
      }
      throw error
    }
  }
  if (failure) {
    throw failure.error
  }
}
