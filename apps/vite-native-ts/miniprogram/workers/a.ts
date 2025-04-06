import { a } from './shared'

worker.onMessage((res) => {
  console.log(res, 'a', a)
})
