import { greet } from '../../shared/utils'

Page({
  onLoad() {
    console.log(greet('packageB'))
  },
})
