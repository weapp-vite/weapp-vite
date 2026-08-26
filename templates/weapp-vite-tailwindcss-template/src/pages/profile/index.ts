Page({
  data: {
    hello: {
      title: 'Hello weapp-vite',
      description: '这里是一个额外的页面示例，你可以继续拆分业务模块并复用组件。',
      docs: 'https://vite.weapp.dev',
      links: [
        {
          text: '复制文档链接',
          url: 'https://vite.weapp.dev',
        },
      ],
    },
  },
  onClick() {
    // eslint-disable-next-line no-console
    console.log('on click')
  },
})
