import { hello } from '../utils/util'

worker.onMessage((res) => {
  console.log(res, hello)
})
