import * as create from 'mini-stores'

// const create = require('mini-stores')
console.log('mini-stores loaded', create)
class Store extends create.Store {
  data = {
    title: '小程序多状态管理',
    language: 'zh_cn',
    userName: '李狗蛋',
    deptName: '化肥质检部门',
    corpName: '富土康化肥厂',
    // 函数属性 - 可直接绑定到视图上
    description() {
      return `我是${this.userName}，我在${this.corpName}工作`
    },
    a: {
      b: {
        // 深层嵌套也支持函数属性
        c() {
          return this.language + this.description
        },
      },
    },
  }

  onChangeLang() {
    if (this.data.language === 'zh_cn') {
      this.data.language = 'en_US'
    }
    else {
      this.data.language = 'zh_cn'
    }
    this.update()
  }
}

export default new Store()
