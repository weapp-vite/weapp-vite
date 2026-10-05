import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { errorText } from './devtoolsProjectLifecycle/context'
import { runLifecycleEntry } from './devtoolsProjectLifecycle/entry'
import { createSuiteSignalScope } from './suiteRunner/signals'

// 故意被终止的 worker 保留默认信号行为；只有负责收尾的入口接管取消信号。
const signals = process.argv[2] === '--worker' ? undefined : createSuiteSignalScope()
try {
  process.exitCode = await runLifecycleEntry(fileURLToPath(import.meta.url), process.argv.slice(2), signals?.signal ?? new AbortController().signal)
}
catch (error) {
  process.stderr.write(`${errorText(error)}\n`)
  process.exitCode = process.exitCode || 1
}
finally {
  if (signals?.exitCode !== undefined) {
    process.exitCode = signals.exitCode
  }
  signals?.dispose()
}
