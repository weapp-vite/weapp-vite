---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序样式产物可能泄露 `.scss`、`.sass`、`.less`、`.styl`、`.pcss` 或 `.postcss` 源后缀文件的问题。页面、组件和 HMR 样式 sidecar 现在会先经过 Vite 的 CSS/Sass/PostCSS 管线，再统一输出为目标小程序平台的样式后缀。
