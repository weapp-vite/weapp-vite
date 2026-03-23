# @weapp-vite/ast

## 6.11.4

## 6.11.3

## 6.11.2

## 6.11.1

## 6.11.0

## 6.10.2

## 6.10.1

## 6.10.0

## 6.9.1

## 6.9.0

### Minor Changes

- ✨ **为 `@weapp-vite/ast` 新增 `collectJsxAutoComponentsFromCode` 共享分析能力，并让 `@wevu/compiler` 的 JSX 自动组件收集逻辑复用该公共实现。这样可以继续把 Babel/Oxc 双后端 AST 分析能力从业务包中抽离出来，减少重复实现并统一后续扩展入口。** [`3021847`](https://github.com/weapp-vite/weapp-vite/commit/302184760fc7680d7f57ec3ecd50664311652808) by @sonofmagic

- ✨ **为 `@weapp-vite/ast` 新增 Babel AST 只读节点辅助与 JSX 模块分析辅助，包括类型包裹表达式解包、对象静态属性读取，以及从 Babel AST 中提取 JSX 自动组件分析所需的导入组件和默认导出组件表达式，进一步减少 `@wevu/compiler` 中的重复 AST 分析实现。** [`7296b72`](https://github.com/weapp-vite/weapp-vite/commit/7296b723d46a62060d48830af578852d56dbc339) by @sonofmagic

- ✨ **新增 `@weapp-vite/ast` 共享 AST 分析包，统一封装 Babel/Oxc 解析能力以及平台 API、require、`<script setup>` 导入分析等通用操作，并让 `weapp-vite` 与 `@wevu/compiler` 复用这套内核，降低后续编译分析工具的维护分叉成本。** [`7bc7ecc`](https://github.com/weapp-vite/weapp-vite/commit/7bc7ecca2aef913b0751d18f9c0f586bd582dc01) by @sonofmagic
