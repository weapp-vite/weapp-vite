<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/user-encryptkey.html -->

# 小程序加密网络通道

从基础库 [2.17.3](../compatibility.md) 开始支持

## 一、功能介绍

在前后端开发联调过程中，开发者通常会使用代理软件对自己开发的项目服务做请求转发，便于切换开发环境和进行测试。

代理软件可以在 客户端 与 真实服务器 之间进行数据传输。

这时，代理软件可以解密并查看通过 SSL 加密的数据，然后再重新加密数据发送给原始目的地。对于客户端和服务器来说，TA 们仍然认为自己处于一个安全的加密连接中，实际上数据的安全性已被破坏。

除了监听之外，由于代理软件可以解密 SSL 加密的通信，因此也支持修改传输中的数据，甚至插入恶意内容。上述这种中间人代理，也会被不法分子恶意使用，用于任意监听自己设备中的所有请求。

TA 们会在自己的设备中运行其他开发者开发的「小程序」、「WEB 网页」 或「原生APP」，然后通过中间代理获取和篡改正常请求的「请求包」和「响应包」，并有针对的对目标请求进行重放，用于实现恶意的目的（比如刷经验、修改游戏结果、创建 1 分钱订单等）。

为了防止中间人代理攻击，我们就需要在 SSL 加密的基础上，对请求包和响应包的明文再进行一次加密，这种方法可以提供额外的安全层次，保障数据即使在被代理软件解密后仍保持安全。

目前微信团队针对加密网络通道提供两种解决方案：

1. **API 自实现方案：** 微信平台维护了一个用户维度的可靠 Key，开发者可以分别通过小程序前端 API 和微信后台提供的服务端接口获取到，并自己实现对请求包的加密。
2. **微信网关方案：** 微信团队结合多年安全防护经验积累推出的 [微信网关](https://developers.weixin.qq.com/miniprogram/security/gateway/) ，具备系统化、多层级的安全防护能力。开发者接入后，就会将「小程序」到「开发者服务端」的通信链路自动从公网链路切换到微信专线链路，并且全程对请求内容进行二层加密，有效防止中间人代理攻击。

获取加密 key 信息需要向微信平台发送请求，产生耗时，从而对业务性能产生负担。 **如开发者希望安全加密的同时减少业务无关的耗时，可以使用微信网关方案。**

## 二、API 自实现方案

为了避免小程序与开发者后台通信时数据被截取和篡改，微信平台维护了一个用户维度的可靠 Key，用于小程序和后台通信时进行加密和签名。

开发者可以分别通过小程序前端 API 和微信后台提供的服务端接口，获取到用户加密 key。

微信平台只提供可靠的加密 key，开发者需自行实现加密方式，对向服务端接口请求的数据进行端处加解密。

在小程序中开发者可以使用 [UserCryptoManager.getLatestUserKey](https://developers.weixin.qq.com/miniprogram/dev/api/base/crypto/UserCryptoManager.getLatestUserKey.html) 获取获取用户最新的加密密钥信息。

### 2.1 前端调用示例

```js
const somedata = 'xxxxx'
const userCryptoManager = wx.getUserCryptoManager()
userCryptoManager.getLatestUserKey({
    success({encryptKey, iv, version, expireTime}) {
        const encryptedData = someAESEncryptMethod(encryptKey, iv, somedata)
        wx.request({
           data: encryptedData,
           success(res) {
                const decryptedData = someAESDEcryptMethod(encryptKey, iv, res.data)
                console.log(decryptedData)
           }
        })
    }
})
```

someAESEncryptMethod 和 someAESDEcryptMethod 分别为加解密函数，由开发者自行引入加解密库来实现，基础库暂时不提供加解密能力。

开发者可参考开源加密库: https://github.com/flash1293/aes-wasm https://github.com/ricmoo/aes-js

根据自身业务情况，寻找合适的加密方式：

- **非对称加密：** 客户端和服务器维护两组公私加密密钥，每次接口请求时，先对明文数据进行加密，另一方收到密文后用对应的反向密钥解密。常见的非对称加密有 RSA、DSA、ECC，非对称加密安全性高，但加解密速度慢，不太适合请求体或响应体太大的情况。
- **对称加密：** 客户端和服务端维护一组密钥，每次接口请求时，对明文数据进行加密，另一方收到时用同样的密钥解密。常见的对称加密有 DES、3DES、IDEA、RC5、RC6、Blowfish，对称加密加解密速度快，适合对大数据做加解密处理，安全性有所下降。
- **整合方案：** 请求时，客户端对明文用对称加密方式加密，对称密钥随机生成，然后用非对称加密方式加密前面的对称密钥，最后将密文和加密后的对称密钥内容合并发出；服务端收到时，按照反向流程进行解密，响应包也是相同的处理流程。

在开发者服务端，可以调用 [*getUserEncryptKey*](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/internet/getUserEncryptKey.html) 后台接口获取用户最近三次的key。在获取key的同时，接口会携带version信息，开发者可以比较version版本来选择使用对应的key对数据进行加解密。

## 2.2 服务端调用示例

```bash
curl -X POST "https://api.weixin.qq.com/wxa/business/getuserencryptkey?access_token=ACCESS_TOKEN&openid=OPENID&signature=SIGNATURE&sig_method=hmac_sha256"
```

## 三、微信网关方案

可以参考此文档接入微信网关： [小程序一键接入微信网关](https://developers.weixin.qq.com/miniprogram/security/gateway/start/quickstart.html)
