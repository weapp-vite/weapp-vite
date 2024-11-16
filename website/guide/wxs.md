# Wxs 增强

## 编程支持 (实验性)

`wxs` 做了一些实验性的语言支持，以至于除了使用 `index.wxs` 之外，你还能使用 `index.wxs.js` 和 `index.wxs.ts`

> `wxs.js` 和 `wxs.ts` 只能使用 `require` 语法，不能使用 `import` 语法

### 引入 wxs.js/wxs.ts

`wxs.js/wxs.ts` 里面可以看作是 `wxs` 的增强，你可以在里面使用一些进阶的语法

引入方式

```html
<wxs module="test" src="index.wxs.ts" />
```

这个在最终产物中会被处理为:

```html
<wxs module="test" src="index.wxs" />
```

同时对 `index.wxs.ts` 里面的内容进行编译，结果为 `wxs`

目前编译的能力还是比较弱的，因为 `wxs` 语法非常特殊，很多 `js` 里面是无法使用的，比如 `for ... in xxx` 这种基础语法。

### 内联 wxs

针对内联 `wxs` 做了一些特殊的优化，你只需在内联 `wxs` 代码块上声明 `lang` 是 `js` or `ts`，就会启动内置的转译引擎进行转化

比如下方的代码在 `weapp-vite` 里就是合法的

```html
<view>{{test.foo}}</view>
<view @tap="{{test.tigger}}">{{test.abc}}</view>

<wxs module="test" lang="ts">
const { bar, foo } = require('./index.wxs.js')
const bbc = require('./bbc.wxs')
export const abc = 'abc'

export function tigger(value:string){
  console.log(abc)
}

export {
  foo,
  bar,
  bbc
}
</wxs>
```
