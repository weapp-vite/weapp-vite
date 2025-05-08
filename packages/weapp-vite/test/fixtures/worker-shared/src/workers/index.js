import { hello } from '../utils/util'

const utils = require('./utils')

worker.onMessage((res) => {
  console.log(res, utils, hello)
})
