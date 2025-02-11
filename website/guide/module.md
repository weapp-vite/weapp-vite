# 模块化风格

## 始终 esm

在 模块化风格 风格上，推荐大家始终使用 `esm` 的语法，即 `import/export` ，而不是 `cjs` 的 `require/module.exports`

```ts
// good
import x from 'x'
import 'xx'
export default x
export {
  x,
  y,
  z
}
// bad
const x = require('x')

module.exports = x
```

## 引入路径问题

在原生小程序中，允许这样使用:

```js
// 从当前目录下的 a/b/c 引入
import x from 'a/b/c'
// 从根目录的 x/y/z 引入
import c from '/x/y/z'
```

这在 `esm` 中是不合法的，所以 `weapp-vite` 没有兼容，这种情况你应该使用路径别名引入的方式来处理:

见下方:

```js
// 从根目录的 x/y/z 引入
import c from '@/x/y/z'
// 从当前目录下的 a/b/c 引入
import x from './a/b/c'
```

## cjs / esm 格式混用问题

这个问题常见在 使用 `esm` 去引入一个 `cjs` 模块:

```js
// apple.js
module.exports = {
  a,
  b,
  c
}
```

然后使用 `import` 引入

```js
// error ! 这种写法会报错，因为 esm 无法解构
import { a, b, c } from './apple'
```

```js
// 你应该改成下方这种写法
import * as apple from './apple'
const { a, b, c } = apple
```
