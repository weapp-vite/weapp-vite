# Varo Registry 来源

- Package: `@varo-ui/cli@3.0.0`
- Target: `weapp`
- Requested items: `button input checkbox input-number empty icon`
- Resolved closure: `base cn primitives button icon input checkbox input-number image empty`
- npm integrity:
  `sha512-+mARlKkgUEskz+S0XNxqoxMFoDyDMlbfVcv0bOpagFf1Rh8wGvL8cOURCOTtyZKT6j7SCY/qrBOgi9XVDciIZQ==`
- Upstream commit used for verification:
  `1620b9da94d8965c22cfecd5758cad7b9ac1eb4c`
- Homepage: <https://varo.weapp.dev/>
- License: MIT, copied to [VARO_LICENSE](./VARO_LICENSE)

Registry 文件在仓库维护阶段生成并提交。运行 `create-weapp-vite` 创建项目时不会联网下载 Varo 源码。
文件已经过本仓库的 ESLint 与 Stylelint 修正。针对 Wevu 原生类型还收窄了图片
`mode` 字面量，并移除了小程序 `button` 不支持的 HTML `type` 属性和
`defineOptions.inheritAttrs`。
