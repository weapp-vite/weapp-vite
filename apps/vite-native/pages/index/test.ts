import { fuck } from 'what/fuck'
import { the } from 'what/the'
import { fuck as fuck2 } from '../../shit/fuck'
import { the as the2 } from '../../shit/the'
import { fuck as fuck1 } from '/shit/fuck'
import { the as the1 } from '/shit/the'

console.log(fuck, the)
console.log(the1, fuck1)
console.log(the2, fuck2)
Page({
  data: {
    className: '',
    matterList: [1, 2, 3, 4],
  },
})
