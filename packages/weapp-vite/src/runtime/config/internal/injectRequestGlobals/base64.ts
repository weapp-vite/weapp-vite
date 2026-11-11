/** chunk 作用域内联的 base64 实现持有者，避免与产物自身的顶层绑定重名。 */
export const REQUEST_GLOBAL_BASE64_HELPER = '__wvB64'

/**
 * @description 生成自包含的 atob / btoa 实现源码。
 * @description 小程序运行时不提供动态代码执行能力，因此只能以静态源码注入。
 * @description 行为必须与 @wevu/web-apis 的 atobPolyfill / btoaPolyfill 保持一致，由对齐测试锁定。
 */
export function createBase64PolyfillHelperCode() {
  return `const ${REQUEST_GLOBAL_BASE64_HELPER} = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < lookup.length; i++) lookup[i] = 255;
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const toLatin1Byte = (value, index) => {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 255) throw new TypeError("Failed to execute 'btoa': character outside Latin1 range at index " + index);
    return codePoint;
  };
  const btoa = function (input) {
    const source = String(input === undefined ? "" : input);
    let output = "";
    for (let index = 0; index < source.length; index += 3) {
      const byte0 = toLatin1Byte(source, index);
      const byte1 = index + 1 < source.length ? toLatin1Byte(source, index + 1) : Number.NaN;
      const byte2 = index + 2 < source.length ? toLatin1Byte(source, index + 2) : Number.NaN;
      const triplet = (byte0 << 16) | ((Number.isNaN(byte1) ? 0 : byte1) << 8) | (Number.isNaN(byte2) ? 0 : byte2);
      output += chars[(triplet >> 18) & 63];
      output += chars[(triplet >> 12) & 63];
      output += Number.isNaN(byte1) ? "=" : chars[(triplet >> 6) & 63];
      output += Number.isNaN(byte2) ? "=" : chars[triplet & 63];
    }
    return output;
  };
  const atob = function (input) {
    const source = String(input === undefined ? "" : input).replace(/[\\t\\n\\f\\r ]+/g, "");
    if (source.length % 4 === 1 || /[^A-Za-z\\d+/=]/u.test(source)) throw new TypeError("Failed to execute 'atob': the input is not correctly encoded");
    let output = "";
    for (let index = 0; index < source.length; index += 4) {
      const char0 = source.charCodeAt(index);
      const char1 = source.charCodeAt(index + 1);
      const char2 = source.charAt(index + 2);
      const char3 = source.charAt(index + 3);
      const sextet0 = lookup[char0];
      const sextet1 = lookup[char1];
      const sextet2 = !char2 || char2 === "=" ? 64 : lookup[source.charCodeAt(index + 2)];
      const sextet3 = !char3 || char3 === "=" ? 64 : lookup[source.charCodeAt(index + 3)];
      if (sextet0 > 63 || sextet1 > 63 || sextet2 > 64 || sextet3 > 64) throw new TypeError("Failed to execute 'atob': the input is not correctly encoded");
      const triplet = (sextet0 << 18) | (sextet1 << 12) | ((sextet2 & 63) << 6) | (sextet3 & 63);
      output += String.fromCharCode((triplet >> 16) & 255);
      if (char2 && char2 !== "=") output += String.fromCharCode((triplet >> 8) & 255);
      if (char3 && char3 !== "=") output += String.fromCharCode(triplet & 255);
    }
    return output;
  };
  return { atob, btoa };
})()`
}
