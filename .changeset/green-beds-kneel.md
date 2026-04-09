---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `wxml` 中 `import.meta.env` 字符串替换的引号生成策略。现在会根据属性外层引号自动选择相反的内层引号，避免在 `src="{{...}}"` 等场景下产出重复双引号导致模板语法报错，同时保留对象字面量等非字符串替换值的原有行为。
