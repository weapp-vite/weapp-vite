---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

title: Weapp-vite
titleTemplate: 把现代化的开发模式带入小程序开发吧

hero:
  name: "Weapp-vite"
  text: ""
  tagline: 把现代化的开发模式带入小程序开发吧
  image:
    src: /logo.svg
    alt: weapp-vite
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/
    - theme: alt
      text: 什么是 Weapp-vite
      link: /guide/what-is-weapp-vite
    - theme: alt
      text: View on GitHub
      link: https://github.com/weapp-vite/weapp-vite

features:
  - title: 丰富的功能
    icon: 🛠️
    details: 对 TypeScript、SCSS 等支持开箱即用。
    link: /guide/
  - title: 自动构建 npm
    icon: 🌲
    details: 内置小程序构建 npm 与内联 npm 代码 2 种策略
    link: /guide/npm
  - title: 自动引入组件
    icon: 🔑
    details: 直接在模板中使用组件，自动感应注册
    link: /guide/auto-import
  - title: 通用的插件
    icon: 🔩
    details: 在开发和构建之间共享 Vite/Rollup 插件接口。
    link: /config/
  - title: 完全的别名支持
    icon: ❤️
    details: 你可以在任意 js/ts 或 json 文件中使用别名, 工具会帮助你进行自动转译
    link: /guide/alias
  - title: 独立分包适配
    icon: 🌞
    details: 在使用独立分包的时候会自动创建额外的编译上下文
    link: /guide/subpackage

---
