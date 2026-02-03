/* eslint-disable no-console */

export const ASYNC_MARKER = '__ASYNC_MARKER__'

export function runAsync() {
  console.log(ASYNC_MARKER)
}

runAsync()
