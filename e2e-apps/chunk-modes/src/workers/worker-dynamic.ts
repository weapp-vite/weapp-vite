/* eslint-disable no-console */

export const WORKER_ASYNC_MARKER = '__WORKER_ASYNC_MARKER__'

export function runWorkerAsync() {
  console.log(WORKER_ASYNC_MARKER)
}

runWorkerAsync()
