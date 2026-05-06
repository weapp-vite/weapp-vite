---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `scopedSlotsCompiler: 'augmented'` 对普通默认插槽包裹内容不生效的问题。显式 augmented 模式现在会把普通默认插槽内容恢复为增强 scoped slot 输出，使插槽投影中的深层组件可以挂到 slot 宿主父链下并读取 `provide()` 上下文；默认 auto 模式仍保留较保守的隐式直连组件增强策略。
