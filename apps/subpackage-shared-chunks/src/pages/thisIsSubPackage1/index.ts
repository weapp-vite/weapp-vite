const action = require('@/action/test2')
import { isWx, isDevTools } from '@/config'
import { test1 } from '@/action/test1'
import { AES } from 'crypto-es'
Page({
  data: {
    hello: {
      title: 'Hello weapp-vite11111',
      description: '这是最基础的 weapp-vite 模板，包含快速开发所需的构建与热更新能力。',
      docs: 'https://vite.icebreaker.top',
      links: [
        {
          text: '复制文档链接',
          url: 'https://vite.icebreaker.top',
        },
        {
          text: 'GitHub 仓库',
          url: 'https://github.com/weapp-vite/weapp-vite',
          variant: 'ghost',
        },
      ],
    },
  },
  onClick() {
    console.log('on click', AES, isDevTools, isWx)
    action.test2()
    test1()
  },
})
