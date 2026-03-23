---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Layout 通信演示页的 alert 弹窗底部左侧残留空白按钮位的问题。宿主模式下打开 alert 时，改为显式清空 `cancelBtn`，避免 TDesign `t-dialog` 将空字符串当作取消按钮配置渲染出空白占位。
