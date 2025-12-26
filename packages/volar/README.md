# @weapp-vite/volar

> 为 weapp-vite 提供 VSCode 智能提示和类型检查的 Volar 插件

## 安装

此包已作为 `weapp-vite` 的依赖自动安装，**无需单独安装**。

如果你确实需要单独安装：

```bash
npm install -D @weapp-vite/volar
# or
pnpm add -D @weapp-vite/volar
# or
yarn add -D @weapp-vite/volar
```

## 使用方法

**推荐方式：** 通过 weapp-vite 使用，插件会自动启用。

详细使用文档请参考：[weapp-vite Volar 文档](../weapp-vite/docs/volar.md)

## 功能特性

- ✅ **配置文件智能提示** - 为 `<config>` 代码块提供完整的类型检查和自动补全
- ✅ **JSON Schema 支持** - 支持 JSON Schema 验证和自动补全
- ✅ **TypeScript 类型检查** - 利用 TypeScript 类型系统确保配置正确性
- ✅ **自动推断配置类型** - 根据文件路径自动推断是 App/Page/Component 配置
- ✅ **多模式支持** - 支持 JSON 模式和 TypeScript 模式

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 测试
pnpm test
```

## 相关文档

- [weapp-vite 文档](../weapp-vite)
- [weapp-vite Volar 使用指南](../weapp-vite/docs/volar.md)
- [Vue 3 文档](https://vuejs.org/)
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

## License

MIT
