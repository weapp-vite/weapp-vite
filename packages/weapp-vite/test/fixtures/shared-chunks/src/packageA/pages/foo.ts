import { greet } from '../../shared/utils'

Page({
  onLoad() {
    console.log(greet('packageA'))
  },
})
