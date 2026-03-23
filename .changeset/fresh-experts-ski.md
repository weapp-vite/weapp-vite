---
'weapp-vite': patch
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
---

修复动态页面布局模板在重复应用 layout transform 时可能被再次包裹的问题。此前同一个页面在经过多轮 transform / 构建后，`wx:if` 动态 layout 分支会整体再嵌套一层，导致切换到 `admin` 布局时出现重复的 `layouts/admin.vue` 页面壳。现在动态 layout 包裹逻辑已保持幂等，并补充对应测试，确保同一页面模板不会被重复注入 layout 分支。
