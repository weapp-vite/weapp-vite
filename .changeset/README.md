# Changeset 总览（精简版）

这批 `.changeset/*.md` 可按下面顺序阅读，避免在大量文件里来回翻：

## 先看这 3 个
- `fix-typed-router-wevu-router-augmentation.md`：修复 `wevu/router` 模块增强，解决 `useRouter` 类型报错。
- `fix-auto-routes-subpackage-appjson-typing.md`：修复 `defineAppJson` + `subPackages` 的 TS2769 类型不兼容。
- `issue-322-class-vshow-fallback.md`：修复 `:class`/`v-show` 首帧样式回退问题。

## 再看 4 个汇总（功能面）
- `consolidated-weapi.md`：weapi 跨端映射与 `unsupported` 收敛策略（最大体量）。
- `consolidated-wevu-create-weapp-vite.md`：wevu 路由能力增强（守卫、重定向、动态路由等）。
- `consolidated-weapp-vite-wevu-create-weapp-vite.md`：weapp-vite + wevu 联动增强（性能预设、类型联动）。
- `consolidated-weapp-vite-create-weapp-vite.md`：weapp-vite 侧性能与诊断增强。

## 最后看 2 个（工程化）
- `consolidated-wevu-compiler.md`：`defineOptions({ behaviors })` 编译兼容修复。
- `refactor-compiler-web-module-split.md`：compiler/web 模块拆分重构，提升可维护性。

## 影响包（版本类型）
- `@wevu/api`：`minor`
- `wevu`：`patch`
- `weapp-vite`：`patch`
- `@wevu/compiler`：`patch`
- `@weapp-vite/web`：`patch`
- `create-weapp-vite`：`patch`
