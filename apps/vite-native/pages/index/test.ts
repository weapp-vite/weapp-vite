// import { fuck as fuck1 } from '/shit/fuck'
// import { the as the1 } from '/shit/the'
import { ComponentWithComputed } from 'miniprogram-computed'
// import { fuck } from 'what/fuck'
// import { the } from 'what/the'
import { fuck as fuck2 } from '../../shit/fuck'
import { the as the2 } from '../../shit/the'
// console.log(fuck, the)
// console.log(the1, fuck1)
console.log(the2, fuck2)
ComponentWithComputed({
  data: {
    className: 'text-[100rpx]',
    matterList: [1, 2, 3, 4],
    a: 1,
    b: 1,
  },
  computed: {
    sum(data) {
      // 注意： computed 函数中不能访问 this ，只有 data 对象可供访问
      // 这个函数的返回值会被设置到 this.data.sum 字段中
      return data.a + data.b // data.c 为自定义 behavior 数据段
    },
  },
  methods: {
    onClick() {
      console.log('click-----')
      this.setData({
        a: this.data.a + 1,
      })
    },
  },
})
