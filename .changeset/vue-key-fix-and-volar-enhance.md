---
"weapp-vite": patch
"@weapp-vite/volar": patch
"wevu-comprehensive-demo": patch
---

修复 Vue 模板编译与 Volar 配置提示

- 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
- 为 Vue 配置块（<config lang="ts/js">）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
- 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为
