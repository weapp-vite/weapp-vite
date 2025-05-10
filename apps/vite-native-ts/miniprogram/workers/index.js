import { a } from './shared'
const { b } = require('./b')

worker.onMessage((res) => {
  console.log(res, a, b)
})

worker.postMessage('hello')
