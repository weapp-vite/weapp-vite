---
'@wevu/compiler': patch
'wevu': patch
'weapp-vite': patch
'create-weapp-vite': patch
'@mpcore/simulator': patch
---

修复 Wevu 模板中 `v-for` 使用嵌套或复杂 `:key` 表达式时被截断的问题。编译器现在会自动生成带内部基础类型 key 的列表投影，覆盖父子多层、兄弟、对象映射、解构循环和基础类型列表，并在用户数据占用 `__wv_key_*` / `__wv_value_*` 保留字段时输出明确诊断。mpcore 同步按循环作用域解析自定义组件事件的动态 dataset，保持 headless 与真实宿主语义一致。
