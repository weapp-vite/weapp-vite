import { message } from './message'

let count = 0
worker.onMessage((value) => {
  worker.postMessage({ message: value.message, count: ++count })
})
worker.postMessage({ message, count })
