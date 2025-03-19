import { x } from '../../utils'
// @ts-ignore
// eslint-disable-next-line ts/no-require-imports
const y = require('../../utils/async')

Page(
  {
    onReady() {
      console.log(x, y)
    },
  },
)
