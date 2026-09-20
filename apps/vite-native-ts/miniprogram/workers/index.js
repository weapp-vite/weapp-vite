/* global worker */
import { a } from './shared'

// eslint-disable-next-line perfectionist/sort-imports -- Worker 示例保留 ESM 与 CommonJS 混用。
const { b } = require('./b')

worker.onMessage((res) => {
  console.log(res, a, b)
})

worker.postMessage('hello')
