# npm 自动构建

目前 `weapp-vite` 中内置了 `2` 种 `npm` 自动构建的策略与 `1` 种手动构建的策略:

## 自动构建

1. `weapp-vite` 自动构建 `miniprogram_npm`
2. `weapp-vite` 自动内联代码到特定的 `js` 产物中

### 1. 自动构建 `miniprogram_npm`

在 `package.json` 中 `dependencies` 字段里注册的依赖，会在每次构建运行的时候，被打包工具打包成小程序可以接受的格式，然后输出到 `project.config.json` 里注册的 `miniprogramNpmDistDir` 目录的 `miniprogram_npm` 中去

### 2. 自动内联代码到对应的 `js` 产物中

没有在 `package.json` 中 `dependencies` 字段里注册的依赖，比如注册在 `devDependencies` 里的依赖，或者 `monorepo` 里更高层级的依赖，在代码里引入了之后，会被自动转化成内联代码，整个放入你的 `js` 产物中

### 详细解释

我们来看这样一个案例，有下方一个 `package.json`:

```json
{
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "lodash-es": "^4.17.21"
  }
}
```

其中 `lodash` 注册在 `dependencies` 里，`lodash-es` 注册在 `devDependencies` 里

然后你在一个小程序文件里的 `js` / `ts` 中引入 `lodash` 和 `lodash-es`

```js
import { add as add0 } from 'lodash'
import { add as add1 } from 'lodash-es'

Page({
  data: {
    num0: add0(1, 1),
    num1: add1(2, 2),
  },
})
```

其中 `lodash` 在 `dependencies` 里，引入 `lodash` 的产物为:

```js
const lodash = require('lodash')
Page({
  data: {
    num0: lodash.add(1, 1)
    // ....
  }
})
```

而 `lodash-es` 在 `devDependencies` 里，引入 `lodash-es` 的产物为:

```js
var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root = freeGlobal || freeSelf || Function("return this")();
var Symbol$1 = root.Symbol;
var objectProto$1 = Object.prototype;
var hasOwnProperty = objectProto$1.hasOwnProperty;
var nativeObjectToString$1 = objectProto$1.toString;
var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : void 0;
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag$1), tag = value[symToStringTag$1];
  try {
    value[symToStringTag$1] = void 0;
    var unmasked = true;
  } catch (e) {
  }
  var result = nativeObjectToString$1.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag$1] = tag;
    } else {
      delete value[symToStringTag$1];
    }
  }
  return result;
}
var objectProto = Object.prototype;
var nativeObjectToString = objectProto.toString;
function objectToString(value) {
  return nativeObjectToString.call(value);
}
var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : void 0;
function baseGetTag(value) {
  if (value == null) {
    return value === void 0 ? undefinedTag : nullTag;
  }
  return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}
function isObjectLike(value) {
  return value != null && typeof value == "object";
}
var symbolTag = "[object Symbol]";
function isSymbol(value) {
  return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
}
var NAN = 0 / 0;
function baseToNumber(value) {
  if (typeof value == "number") {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  return +value;
}
function arrayMap(array, iteratee) {
  var index = -1, length = array == null ? 0 : array.length, result = Array(length);
  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}
var isArray = Array.isArray;
var INFINITY = 1 / 0;
var symbolProto = Symbol$1 ? Symbol$1.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
function baseToString(value) {
  if (typeof value == "string") {
    return value;
  }
  if (isArray(value)) {
    return arrayMap(value, baseToString) + "";
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : "";
  }
  var result = value + "";
  return result == "0" && 1 / value == -INFINITY ? "-0" : result;
}
function createMathOperation(operator, defaultValue) {
  return function(value, other) {
    var result;
    if (value === void 0 && other === void 0) {
      return defaultValue;
    }
    if (value !== void 0) {
      result = value;
    }
    if (other !== void 0) {
      if (result === void 0) {
        return other;
      }
      if (typeof value == "string" || typeof other == "string") {
        value = baseToString(value);
        other = baseToString(other);
      } else {
        value = baseToNumber(value);
        other = baseToNumber(other);
      }
      result = operator(value, other);
    }
    return result;
  };
}
var add = createMathOperation(function(augend, addend) {
  return augend + addend;
}, 0);
Page({
  data: {
    // ....
    num1: add(2, 2)
  }
});
```

这就相当于把 `lodash-es` 中的 `add` 方法，相关联的代码，全部都打入了你的小程序源代码里面去。

具体使用什么自动构建方案，取决于你的选择。

## 手动构建

执行命令 `weapp-vite npm` , 会调用 `微信开发者工具` -> `工具` -> 构建 `npm` 的功能，来手动构建 `miniprogram_npm`。

这相当于你在 `微信开发者工具` 里手动点了一遍 `工具` -> 构建 `npm` 功能。

> `weapp-vite npm` 别名 `weapp-vite build:npm` / `weapp-vite build-npm`
