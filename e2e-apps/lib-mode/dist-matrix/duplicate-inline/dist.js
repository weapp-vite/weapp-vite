var e = Promise.resolve(), t = /* @__PURE__ */ new Set();
var n = !1, r = !1;
function i() {
	r = !1, n = !0;
	try {
		t.forEach((e) => e());
	} finally {
		t.clear(), n = !1;
	}
}
function a(a) {
	t.add(a), !n && !r && (r = !0, e.then(i));
}
function o(t) {
	return t ? e.then(t) : e;
}
var s = /* @__PURE__ */ new WeakMap();
var c = null;
var l = [];
var u = 0;
var d = /* @__PURE__ */ new Set();
function g(e) {
	let { deps: t } = e;
	for (let n = 0; n < t.length; n++) t[n].delete(e);
	t.length = 0;
}
function _(e) {
	e.active && (e.active = !1, g(e), e.onStop?.());
}
var v;
function S(e) {
	v?.active && v.cleanups.push(e);
}
function C(e) {
	v?.active && v.effects.push(e);
}
function w(e, t = {}) {
	let n = function() {
		if (!n.active || n._running) return e();
		g(n);
		try {
			return n._running = !0, l.push(n), c = n, e();
		} finally {
			l.pop(), c = l[l.length - 1] ?? null, n._running = !1;
		}
	};
	return n.deps = [], n.scheduler = t.scheduler, n.onStop = t.onStop, n.active = !0, n._running = !1, n._fn = e, n;
}
function T(e, t = {}) {
	let n = w(e, t);
	return C(n), t.lazy || n(), n;
}
function E(e, t) {
	if (!c) return;
	let n = s.get(e);
	n || (n = /* @__PURE__ */ new Map(), s.set(e, n));
	let r = n.get(t);
	r || (r = /* @__PURE__ */ new Set(), n.set(t, r)), r.has(c) || (r.add(c), c.deps.push(r));
}
function D(e) {
	if (e.scheduler) {
		e.scheduler();
		return;
	}
	if (u > 0) {
		d.add(e);
		return;
	}
	e();
}
function O(e, t) {
	let n = s.get(e);
	if (!n) return;
	let r = n.get(t);
	if (!r) return;
	let i = /* @__PURE__ */ new Set();
	r.forEach((e) => {
		e !== c && i.add(e);
	}), i.forEach(D);
}
var j = /* @__PURE__ */ new Set();
function M(e) {
	j.add(e);
}
function ee(e) {
	j.delete(e);
}
var N = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), I = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakSet(), R = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap();
function ne(e) {
	let t = te.get(e);
	return t || (t = /* @__PURE__ */ new Set(), te.set(e, t)), t;
}
function re(e, t) {
	ne(e).add(t);
}
function z(e) {
	P.set(e, (P.get(e) ?? 0) + 1);
}
function ie(e) {
	return P.get(e) ?? 0;
}
function ae(e) {
	let t = /* @__PURE__ */ new Set(), n = [e];
	for (let e = 0; e < 2e3 && n.length; e++) {
		let e = n.pop(), r = I.get(e);
		if (r) for (let e of r.keys()) t.has(e) || (t.add(e), z(e), n.push(e));
	}
}
function oe(e) {
	let t = I.get(e);
	if (!t) {
		L.delete(e), F.delete(e);
		return;
	}
	let n, r, i = 0;
	for (let [e, a] of t) {
		for (let t of a) {
			if (i += 1, i > 1) break;
			n = e, r = t;
		}
		if (i > 1) break;
	}
	if (i === 1 && n && r) {
		L.delete(e), F.set(e, {
			parent: n,
			key: r
		});
		return;
	}
	L.add(e), F.delete(e);
}
function se(e, t, n) {
	if (typeof n != `string`) {
		L.add(e), F.delete(e);
		return;
	}
	if (j.size) {
		let n = N.get(t) ?? t;
		re(n, t), re(n, e);
	}
	let r = I.get(e);
	r || (r = /* @__PURE__ */ new Map(), I.set(e, r));
	let i = r.get(t);
	i || (i = /* @__PURE__ */ new Set(), r.set(t, i)), i.add(n), oe(e);
}
function ce(e, t, n) {
	let r = I.get(e);
	if (!r) return;
	let i = r.get(t);
	i && (i.delete(n), i.size || r.delete(t), r.size || I.delete(e), oe(e));
}
function le(e, t) {
	if (t === e) return [];
	if (L.has(t)) return;
	let n = [], r = t;
	for (let t = 0; t < 2e3; t++) {
		if (r === e) return n.reverse();
		if (L.has(r)) return;
		let t = F.get(r);
		if (!t || typeof t.key != `string`) return;
		n.push(t.key), r = t.parent;
	}
}
var B = function(e) {
	return e.IS_REACTIVE = `__r_isReactive`, e.RAW = `__r_raw`, e.SKIP = `__r_skip`, e;
}({});
function V(e) {
	return typeof e == `object` && !!e;
}
var H = Symbol(`wevu.version`);
function ue(e) {
	if (!e) return !1;
	let t = e.charCodeAt(0);
	if (t < 48 || t > 57) return !1;
	let n = Number(e);
	return Number.isInteger(n) && n >= 0 && String(n) === e;
}
function U(e) {
	return e?.[B.RAW] ?? e;
}
var de = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap();
function pe(e, t) {
	let n = U(e);
	R.set(n, ``), re(n, n);
	let r = t?.shouldIncludeTopKey, i = typeof t?.maxDepth == `number` ? Math.max(0, Math.floor(t.maxDepth)) : Infinity, a = typeof t?.maxKeys == `number` ? Math.max(0, Math.floor(t.maxKeys)) : Infinity, o = /* @__PURE__ */ new WeakSet(), s = [{
		current: n,
		path: ``,
		depth: 0
	}], c = 0;
	for (; s.length;) {
		let e = s.pop();
		if (o.has(e.current) || (o.add(e.current), R.set(e.current, e.path), re(n, e.current), c += 1, c >= a) || e.depth >= i || Array.isArray(e.current)) continue;
		let t = Object.entries(e.current);
		for (let [i, a] of t) {
			if (e.path === `` && r && !r(i) || !V(a) || a[B.SKIP]) continue;
			let t = U(a);
			if (N.has(t) || N.set(t, n), se(t, e.current, i), !L.has(t)) {
				let n = e.path ? `${e.path}.${i}` : i;
				R.set(t, n);
			}
			re(n, t), s.push({
				current: t,
				path: e.path ? `${e.path}.${i}` : i,
				depth: e.depth + 1
			});
		}
	}
}
function me(e) {
	let t = U(e), n = te.get(t);
	if (!n) {
		R.delete(t);
		return;
	}
	for (let e of n) F.delete(e), I.delete(e), R.delete(e), L.delete(e), N.delete(e), P.delete(e);
	te.delete(t);
}
function he(e) {
	E(U(e), H);
}
var ge = {
	get(e, t, n) {
		if (t === B.IS_REACTIVE) return !0;
		if (t === B.RAW) return e;
		let r = Reflect.get(e, t, n);
		return E(e, t), r;
	},
	set(e, t, n, r) {
		let i = Reflect.get(e, t, r), a = Reflect.set(e, t, n, r);
		return Object.is(i, n) || (O(e, t), O(e, H), z(e)), a;
	},
	deleteProperty(e, t) {
		let n = Object.prototype.hasOwnProperty.call(e, t), r = Reflect.deleteProperty(e, t);
		return n && r && (O(e, t), O(e, H), z(e)), r;
	},
	ownKeys(e) {
		return E(e, Symbol.iterator), E(e, H), Reflect.ownKeys(e);
	}
};
function _e(e) {
	if (!V(e)) return e;
	let t = W.get(e);
	if (t) return t;
	if (e[B.IS_REACTIVE]) return e;
	let n = new Proxy(e, ge);
	return W.set(e, n), fe.set(n, e), P.has(e) || P.set(e, 0), n;
}
function ye(e) {
	return ie(U(e));
}
function be(e, t, n) {
	if (!j.size || typeof t != `string` || t.startsWith(`__r_`)) return;
	let r = N.get(e) ?? e, i = Array.isArray(e) && (t === `length` || ue(t)) ? `array` : `property`, a = le(r, e);
	if (!a) {
		let a = /* @__PURE__ */ new Set(), o = I.get(e);
		if (o) for (let [e, t] of o) {
			let n = R.get(e), i = n ? n.split(`.`, 1)[0] : void 0, o = i ? void 0 : le(r, e)?.[0];
			for (let e of t) typeof e == `string` && a.add(i ?? o ?? e);
		}
		else a.add(t);
		for (let e of j) e({
			root: r,
			kind: i,
			op: n,
			path: void 0,
			fallbackTopKeys: a.size ? Array.from(a) : void 0
		});
		return;
	}
	let o = a.findIndex((e) => ue(e));
	if (o !== -1) {
		let e = a.slice(0, o).join(`.`) || void 0;
		for (let t of j) t({
			root: r,
			kind: `array`,
			op: n,
			path: e
		});
		return;
	}
	let s = a.length ? a.join(`.`) : ``, c = i === `array` ? s || void 0 : s ? `${s}.${t}` : t;
	for (let e of j) e({
		root: r,
		kind: i,
		op: n,
		path: c
	});
}
var xe = {
	get(e, t, n) {
		if (t === B.IS_REACTIVE) return !0;
		if (t === B.RAW) return e;
		let r = Reflect.get(e, t, n);
		if (E(e, t), V(r)) {
			if (r[B.SKIP]) return r;
			let n = N.get(e) ?? e, i = r?.[B.RAW] ?? r;
			N.has(i) || N.set(i, n), se(i, e, t);
			let a = R.get(e);
			if (j.size && typeof t == `string` && a != null && !L.has(i)) {
				let e = a ? `${a}.${t}` : t;
				R.set(i, e);
			}
			return Se(r);
		}
		return r;
	},
	set(e, t, n, r) {
		let i = Array.isArray(e), a = i ? e.length : 0, o = Reflect.get(e, t, r), s = Reflect.set(e, t, n, r);
		if (!Object.is(o, n)) {
			let r = V(o) ? o?.[B.RAW] ?? o : void 0;
			if (r && ce(r, e, t), V(n) && !n[B.SKIP]) {
				let r = N.get(e) ?? e, i = n?.[B.RAW] ?? n;
				N.has(i) || N.set(i, r), se(i, e, t);
				let a = R.get(e);
				if (j.size && typeof t == `string` && a != null && !L.has(i)) {
					let e = a ? `${a}.${t}` : t;
					R.set(i, e);
				}
			}
			O(e, t), i && typeof t == `string` && ue(t) && Number(t) >= a && O(e, `length`), O(e, H), z(e), ae(e);
			let s = N.get(e);
			s && s !== e && (O(s, H), z(s)), be(e, t, `set`);
		}
		return s;
	},
	deleteProperty(e, t) {
		let n = Object.prototype.hasOwnProperty.call(e, t), r = n ? e[t] : void 0, i = Reflect.deleteProperty(e, t);
		if (n && i) {
			let n = V(r) ? r?.[B.RAW] ?? r : void 0;
			n && ce(n, e, t), O(e, t), O(e, H), z(e), ae(e);
			let i = N.get(e);
			i && i !== e && (O(i, H), z(i)), be(e, t, `delete`);
		}
		return i;
	},
	ownKeys(e) {
		return E(e, Symbol.iterator), E(e, H), Reflect.ownKeys(e);
	}
};
function Se(e) {
	if (!V(e)) return e;
	let t = de.get(e);
	if (t) return t;
	if (e[B.IS_REACTIVE]) return e;
	let n = new Proxy(e, xe);
	return de.set(e, n), fe.set(n, e), P.has(e) || P.set(e, 0), N.has(e) || N.set(e, e), n;
}
function G(e) {
	return !!(e && e[B.IS_REACTIVE]);
}
var Ee = `__v_isRef`;
function De(e) {
	try {
		Object.defineProperty(e, Ee, {
			value: !0,
			configurable: !0
		});
	} catch {
		e[Ee] = !0;
	}
	return e;
}
function K(e) {
	return !!(e && typeof e == `object` && e[Ee] === !0);
}
function Ae(e) {
	return K(e) ? e.value : e;
}
function Ve(e, t = Infinity, n = /* @__PURE__ */ new Map()) {
	if (t <= 0 || !V(e)) return e;
	if (K(e)) return Ve(e.value, t - 1, n), e;
	if (e[B.SKIP]) return e;
	let r = n.get(e);
	if (r !== void 0 && r >= t) return e;
	n.set(e, t);
	let i = t - 1;
	if (Array.isArray(e) || e instanceof Map || e instanceof Set) return e.forEach((e) => Ve(e, i, n)), e;
	let a = G(e) && t !== Infinity ? U(e) : e;
	for (let t in a) Ve(e[t], i, n);
	return e;
}
var He = `version`;
function Ge(e, t, n = {}) {
	let r, i = G(e), s = Array.isArray(e) && !i, c = (e) => {
		if (typeof e == `function`) return e();
		if (K(e)) return e.value;
		if (G(e)) return e;
		throw Error(`无效的 watch 源`);
	};
	if (s) {
		let t = e;
		r = () => t.map((e) => c(e));
	} else if (typeof e == `function`) r = e;
	else if (K(e)) r = () => e.value;
	else if (i) r = () => e;
	else throw Error(`无效的 watch 源`);
	let l = s ? e.some((e) => G(e)) : i, u = n.deep ?? l, d = u === !0 || typeof u == `number`, f = typeof u == `number` ? u : u ? Infinity : 0;
	if (d) {
		let e = r;
		r = () => {
			let t = e();
			return s && Array.isArray(t) ? t.map((e) => He === `version` && G(e) ? (he(e), e) : Ve(e, f)) : He === `version` && G(t) ? (he(t), t) : Ve(t, f);
		};
	}
	let p, m = (e) => {
		p = e;
	}, h, g, v = !1, y = 0, b, x = n.once ? (e, n, r) => {
		t(e, n, r), b();
	} : t, C = n.flush ?? `pre`, w = y, E = () => O(w), D = (e, t) => {
		if (w = y, n.scheduler) {
			let r = w;
			n.scheduler(() => e(r), t);
			return;
		}
		if (C === `sync`) {
			E();
			return;
		}
		if (C === `post`) {
			o(() => a(E));
			return;
		}
		t ? E() : a(E);
	}, O = (e) => {
		if (!g.active || v || e !== y) return;
		let t = g();
		p?.(), x(t, h, m), h = t;
	};
	g = T(() => r(), {
		scheduler: () => {
			v || D(O, !1);
		},
		lazy: !0
	});
	let k = () => {
		p?.(), p = void 0, _(g);
	};
	return b = k, b.stop = k, b.pause = () => {
		v || (v = !0, y += 1);
	}, b.resume = () => {
		!v || !g.active || (v = !1, h = g());
	}, n.immediate ? O(y) : h = g(), S(b), b;
}
function qe(e, t, n) {
	let r = e[t];
	if (!r) throw Error(`计算属性 "${t}" 是只读的`);
	r(n);
}
function Je(e) {
	if (e == null) return e;
	if (typeof e == `object`) {
		if (`detail` in e && e.detail && `value` in e.detail) return e.detail.value;
		if (`target` in e && e.target && `value` in e.target) return e.target.value;
	}
	return e;
}
function Ye(e) {
	let t = Object.create(null), n = Object.create(null), r = /* @__PURE__ */ new Set();
	return {
		computedRefs: t,
		computedSetters: n,
		dirtyComputedKeys: r,
		createTrackedComputed: (t, n, i) => {
			let a, o = !0, s, c = {
				get value() {
					return o &&= (a = s(), !1), E(c, `value`), a;
				},
				set value(e) {
					if (!i) throw Error(`计算属性是只读的`);
					i(e);
				}
			};
			return De(c), s = T(n, {
				lazy: !0,
				scheduler: () => {
					o || (o = !0, e.setDataStrategy === `patch` && e.includeComputed && r.add(t), O(c, `value`));
				}
			}), c;
		},
		computedProxy: new Proxy({}, {
			get(e, n) {
				if (typeof n == `string` && t[n]) return t[n].value;
			},
			has(e, n) {
				return typeof n == `string` && !!t[n];
			},
			ownKeys() {
				return Object.keys(t);
			},
			getOwnPropertyDescriptor(e, n) {
				if (typeof n == `string` && t[n]) return {
					configurable: !0,
					enumerable: !0,
					value: t[n].value
				};
			}
		})
	};
}
function Xe(e) {
	let { state: t, computedDefs: n, methodDefs: r, appConfig: i, includeComputed: a, setDataStrategy: o } = e, s = {}, { computedRefs: c, computedSetters: l, dirtyComputedKeys: u, createTrackedComputed: d, computedProxy: f } = Ye({
		includeComputed: a,
		setDataStrategy: o
	}), p = new Proxy(t, {
		get(e, n, r) {
			if (typeof n == `string`) {
				if (n === `$state`) return t;
				if (n === `$computed`) return f;
				if (Object.prototype.hasOwnProperty.call(s, n)) return s[n];
				if (c[n]) return c[n].value;
				if (Object.prototype.hasOwnProperty.call(i.globalProperties, n)) return i.globalProperties[n];
			}
			return Reflect.get(e, n, r);
		},
		set(e, t, n, r) {
			return typeof t == `string` && c[t] ? (qe(l, t, n), !0) : Reflect.set(e, t, n, r);
		},
		has(e, t) {
			return typeof t == `string` && (c[t] || Object.prototype.hasOwnProperty.call(s, t)) ? !0 : Reflect.has(e, t);
		},
		ownKeys(e) {
			let t = /* @__PURE__ */ new Set();
			return Reflect.ownKeys(e).forEach((e) => {
				t.add(e);
			}), Object.keys(s).forEach((e) => t.add(e)), Object.keys(c).forEach((e) => t.add(e)), Array.from(t);
		},
		getOwnPropertyDescriptor(e, t) {
			if (Reflect.has(e, t)) return Object.getOwnPropertyDescriptor(e, t);
			if (typeof t == `string`) {
				if (c[t]) return {
					configurable: !0,
					enumerable: !0,
					get() {
						return c[t].value;
					},
					set(e) {
						qe(l, t, e);
					}
				};
				if (Object.prototype.hasOwnProperty.call(s, t)) return {
					configurable: !0,
					enumerable: !1,
					value: s[t]
				};
			}
		}
	});
	return Object.keys(r).forEach((e) => {
		let t = r[e];
		if (typeof t == `function`) {
			s[e] = (...e) => t.apply(p, e);
			return;
		}
		e === `__weapp_vite_inline_map` && t && typeof t == `object` && (s[e] = t);
	}), Object.keys(n).forEach((e) => {
		let t = n[e];
		if (typeof t == `function`) c[e] = d(e, () => t.call(p));
		else {
			let n = t.get?.bind(p);
			if (!n) throw Error(`计算属性 "${e}" 需要提供 getter`);
			let r = t.set?.bind(p);
			r ? (l[e] = r, c[e] = d(e, n, r)) : c[e] = d(e, n);
		}
	}), {
		boundMethods: s,
		computedRefs: c,
		computedSetters: l,
		dirtyComputedKeys: u,
		computedProxy: f,
		publicInstance: p
	};
}
var Ze = Symbol(`wevu.noSetData`);
function q(e) {
	return Object.defineProperty(e, Ze, {
		value: !0,
		configurable: !0,
		enumerable: !1,
		writable: !1
	}), e;
}
function Qe(e) {
	return typeof e == `object` && !!e && e[Ze] === !0;
}
function $e(e) {
	if (Object.prototype.toString.call(e) !== `[object Object]`) return !1;
	let t = Object.getPrototypeOf(e);
	return t === null || t === Object.prototype;
}
function J(e, t = /* @__PURE__ */ new WeakMap(), n) {
	let r = Ae(e);
	if (typeof r == `bigint`) {
		let e = Number(r);
		return Number.isSafeInteger(e) ? e : r.toString();
	}
	if (typeof r == `symbol`) return r.toString();
	if (typeof r == `function`) return;
	if (typeof r != `object` || !r) return r;
	if (Qe(r)) return;
	let i = G(r) ? U(r) : r, a = n?._depth ?? (typeof n?.maxDepth == `number` ? Math.max(0, Math.floor(n.maxDepth)) : Infinity), o = n?._budget ?? (typeof n?.maxKeys == `number` ? { keys: Math.max(0, Math.floor(n.maxKeys)) } : { keys: Infinity });
	if (a <= 0 || o.keys <= 0) return i;
	let s = n?.cache;
	if (s) {
		let e = ye(i), t = s.get(i);
		if (t && t.version === e) return t.value;
	}
	if (t.has(i)) return t.get(i);
	if (i instanceof Date) return i.getTime();
	if (i instanceof RegExp) return i.toString();
	if (i instanceof Map) {
		let e = [];
		return t.set(i, e), i.forEach((n, r) => {
			e.push([J(r, t), J(n, t)]);
		}), e;
	}
	if (i instanceof Set) {
		let e = [];
		return t.set(i, e), i.forEach((n) => {
			e.push(J(n, t));
		}), e;
	}
	if (typeof ArrayBuffer < `u`) {
		if (i instanceof ArrayBuffer) return i.byteLength;
		if (ArrayBuffer.isView(i)) {
			let e = i;
			if (typeof e[Symbol.iterator] == `function`) {
				let n = Array.from(e);
				return t.set(i, n), n.map((e) => J(e, t));
			}
			let n = Array.from(new Uint8Array(e.buffer, e.byteOffset, e.byteLength));
			return t.set(i, n), n;
		}
	}
	if (i instanceof Error) return {
		name: i.name,
		message: i.message
	};
	if (Array.isArray(i)) {
		let e = [];
		return t.set(i, e), i.forEach((r, i) => {
			let s = J(r, t, {
				...n,
				_depth: a - 1,
				_budget: o
			});
			e[i] = s === void 0 ? null : s;
		}), s && s.set(i, {
			version: ye(i),
			value: e
		}), e;
	}
	let c = {};
	return t.set(i, c), Object.keys(i).forEach((e) => {
		if (--o.keys, o.keys <= 0) return;
		let r = J(i[e], t, {
			...n,
			_depth: a - 1,
			_budget: o
		});
		r !== void 0 && (c[e] = r);
	}), s && s.set(i, {
		version: ye(i),
		value: c
	}), c;
}
function et(e, t, n) {
	if (e.length !== t.length) return !1;
	for (let r = 0; r < e.length; r++) if (!n(e[r], t[r])) return !1;
	return !0;
}
function tt(e, t, n) {
	let r = Object.keys(e), i = Object.keys(t);
	if (r.length !== i.length) return !1;
	for (let i of r) if (!Object.prototype.hasOwnProperty.call(t, i) || !n(e[i], t[i])) return !1;
	return !0;
}
function nt(e, t) {
	return Object.is(e, t) ? !0 : Array.isArray(e) && Array.isArray(t) ? et(e, t, nt) : $e(e) && $e(t) ? tt(e, t, nt) : !1;
}
function rt(e) {
	return e === void 0 ? null : e;
}
function it(e, t, n, r) {
	if (!nt(e, t)) {
		if ($e(e) && $e(t)) {
			for (let i of Object.keys(t)) {
				if (!Object.prototype.hasOwnProperty.call(e, i)) {
					r[`${n}.${i}`] = rt(t[i]);
					continue;
				}
				it(e[i], t[i], `${n}.${i}`, r);
			}
			for (let i of Object.keys(e)) Object.prototype.hasOwnProperty.call(t, i) || (r[`${n}.${i}`] = null);
			return;
		}
		if (Array.isArray(e) && Array.isArray(t)) {
			et(e, t, nt) || (r[n] = rt(t));
			return;
		}
		r[n] = rt(t);
	}
}
function at(e, t) {
	let n = {};
	for (let r of Object.keys(t)) it(e[r], t[r], r, n);
	for (let r of Object.keys(e)) Object.prototype.hasOwnProperty.call(t, r) || (n[r] = null);
	return n;
}
function ot(e) {
	let t = Object.keys(e).sort();
	if (t.length <= 1) return e;
	let n = Object.create(null), r = [];
	for (let i of t) {
		for (; r.length;) {
			let e = r[r.length - 1];
			if (i.startsWith(e)) break;
			r.pop();
		}
		r.length || (n[i] = e[i], r.push(`${i}.`));
	}
	return n;
}
function st(e, t, n) {
	if (t <= 0) return t + 1;
	if (e === null) return 4;
	let r = typeof e;
	if (r === `string`) return 2 + e.length;
	if (r === `number`) return Number.isFinite(e) ? String(e).length : 4;
	if (r === `boolean`) return e ? 4 : 5;
	if (r === `undefined` || r === `function` || r === `symbol` || r !== `object` || n.has(e)) return 4;
	if (n.add(e), Array.isArray(e)) {
		let r = 2;
		for (let i = 0; i < e.length; i++) if (i && (r += 1), r += st(e[i], t - r, n), r > t) return r;
		return r;
	}
	let i = 2;
	for (let [r, a] of Object.entries(e)) if (i > 2 && (i += 1), i += 2 + r.length + 1, i += st(a, t - i, n), i > t) return i;
	return i;
}
function ct(e, t) {
	if (t === Infinity) return {
		fallback: !1,
		estimatedBytes: void 0,
		bytes: void 0
	};
	let n = t, r = Object.keys(e).length, i = st(e, n + 1, /* @__PURE__ */ new WeakSet());
	if (i > n) return {
		fallback: !0,
		estimatedBytes: i,
		bytes: void 0
	};
	if (i >= n * .85 && r > 2) try {
		let t = JSON.stringify(e).length;
		return {
			fallback: t > n,
			estimatedBytes: i,
			bytes: t
		};
	} catch {
		return {
			fallback: !1,
			estimatedBytes: i,
			bytes: void 0
		};
	}
	return {
		fallback: !1,
		estimatedBytes: i,
		bytes: void 0
	};
}
function lt(e) {
	let { input: t, entryMap: n, getPlainByPath: r, mergeSiblingThreshold: i, mergeSiblingSkipArray: a, mergeSiblingMaxParentBytes: o, mergeSiblingMaxInflationRatio: s } = e;
	if (!i) return {
		out: t,
		merged: 0
	};
	let c = Object.keys(t);
	if (c.length < i) return {
		out: t,
		merged: 0
	};
	let l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set();
	for (let e of c) {
		let r = n.get(e);
		if (!r) continue;
		if (t[e] === null || r.op === `delete`) {
			let t = e.lastIndexOf(`.`);
			t > 0 && u.add(e.slice(0, t));
			continue;
		}
		let i = e.lastIndexOf(`.`);
		if (i <= 0) continue;
		let a = e.slice(0, i), o = l.get(a) ?? [];
		o.push(e), l.set(a, o);
	}
	let d = Array.from(l.entries()).filter(([e, t]) => t.length >= i && !u.has(e)).sort((e, t) => t[0].split(`.`).length - e[0].split(`.`).length);
	if (!d.length) return {
		out: t,
		merged: 0
	};
	let f = Object.create(null);
	Object.assign(f, t);
	let p = 0, m = /* @__PURE__ */ new WeakMap(), h = (e) => {
		if (e && typeof e == `object`) {
			let t = m.get(e);
			if (t !== void 0) return t;
			let n = st(e, Infinity, /* @__PURE__ */ new WeakSet());
			return m.set(e, n), n;
		}
		return st(e, Infinity, /* @__PURE__ */ new WeakSet());
	}, g = (e, t) => 2 + e.length + 1 + h(t);
	for (let [e, t] of d) {
		if (Object.prototype.hasOwnProperty.call(f, e)) continue;
		let n = t.filter((e) => Object.prototype.hasOwnProperty.call(f, e));
		if (n.length < i) continue;
		let c = r(e);
		if (!(a && Array.isArray(c)) && !(o !== Infinity && g(e, c) > o)) {
			if (s !== Infinity) {
				let t = 0;
				for (let e of n) t += g(e, f[e]);
				if (g(e, c) > t * s) continue;
			}
			f[e] = c;
			for (let e of n) delete f[e];
			p += 1;
		}
	}
	return {
		out: f,
		merged: p
	};
}
function ut(e) {
	return e === void 0 ? null : e;
}
function dt(e) {
	if (typeof e != `object` || !e) return !1;
	let t = Object.getPrototypeOf(e);
	return t === Object.prototype || t === null;
}
function ft(e, t) {
	if (Object.is(e, t)) return !0;
	if (Array.isArray(e) && Array.isArray(t)) {
		if (e.length !== t.length) return !1;
		for (let n = 0; n < e.length; n++) if (!Object.is(e[n], t[n])) return !1;
		return !0;
	}
	if (!dt(e) || !dt(t)) return !1;
	let n = Object.keys(e), r = Object.keys(t);
	if (n.length !== r.length) return !1;
	for (let r of n) if (!Object.prototype.hasOwnProperty.call(t, r) || !Object.is(e[r], t[r])) return !1;
	return !0;
}
function pt(e, t, n, r) {
	if (Object.is(e, t)) return !0;
	if (n <= 0) return !1;
	if (Array.isArray(e) && Array.isArray(t)) {
		if (e.length !== t.length) return !1;
		for (let i = 0; i < e.length; i++) if (!pt(e[i], t[i], n - 1, r)) return !1;
		return !0;
	}
	if (!dt(e) || !dt(t)) return !1;
	let i = Object.keys(e), a = Object.keys(t);
	if (i.length !== a.length) return !1;
	for (let a of i) if (--r.keys, r.keys <= 0 || !Object.prototype.hasOwnProperty.call(t, a) || !pt(e[a], t[a], n - 1, r)) return !1;
	return !0;
}
function mt(e, t, n, r) {
	let i = t.split(`.`).filter(Boolean);
	if (!i.length) return;
	let a = e;
	for (let e = 0; e < i.length - 1; e++) {
		let t = i[e];
		(!Object.prototype.hasOwnProperty.call(a, t) || a[t] == null || typeof a[t] != `object`) && (a[t] = Object.create(null)), a = a[t];
	}
	let o = i[i.length - 1];
	if (r === `delete`) try {
		delete a[o];
	} catch {
		a[o] = null;
	}
	else a[o] = n;
}
function ht(e) {
	let { state: t, computedRefs: n, includeComputed: r, shouldIncludeKey: i, plainCache: a, toPlainMaxDepth: o, toPlainMaxKeys: s } = e, c = /* @__PURE__ */ new WeakMap(), l = Object.create(null), u = Number.isFinite(s) ? { keys: s } : void 0, d = G(t) ? U(t) : t, f = Object.keys(d), p = r ? Object.keys(n) : [];
	for (let e of f) i(e) && (l[e] = J(d[e], c, {
		cache: a,
		maxDepth: o,
		_budget: u
	}));
	for (let e of p) i(e) && (l[e] = J(n[e].value, c, {
		cache: a,
		maxDepth: o,
		_budget: u
	}));
	return l;
}
function gt(e) {
	let { state: t, computedRefs: n, dirtyComputedKeys: r, includeComputed: i, computedCompare: a, computedCompareMaxDepth: o, computedCompareMaxKeys: s, currentAdapter: c, shouldIncludeKey: l, maxPatchKeys: u, maxPayloadBytes: d, mergeSiblingThreshold: f, mergeSiblingMaxInflationRatio: p, mergeSiblingMaxParentBytes: m, mergeSiblingSkipArray: h, elevateTopKeyThreshold: g, toPlainMaxDepth: _, toPlainMaxKeys: v, plainCache: y, pendingPatches: b, fallbackTopKeys: x, latestSnapshot: S, latestComputedSnapshot: C, needsFullSnapshot: w, emitDebug: T, runDiffUpdate: E } = e;
	if (b.size > u) {
		w.value = !0;
		let e = b.size;
		b.clear(), r.clear(), T({
			mode: `diff`,
			reason: `maxPatchKeys`,
			pendingPatchKeys: e,
			payloadKeys: 0
		}), E(`maxPatchKeys`);
		return;
	}
	let D = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new Map(), k = Object.create(null), A = Array.from(b.entries());
	if (Number.isFinite(g) && g > 0) {
		let e = /* @__PURE__ */ new Map();
		for (let [t] of A) {
			let n = t.split(`.`, 1)[0];
			e.set(n, (e.get(n) ?? 0) + 1);
		}
		for (let [t, n] of e) n >= g && x.add(t);
	}
	let j = A.filter(([e]) => {
		for (let t of x) if (e === t || e.startsWith(`${t}.`)) return !1;
		return !0;
	}), M = new Map(j);
	b.clear();
	let ee = (e) => {
		let n = e.split(`.`).filter(Boolean), r = t;
		for (let e of n) {
			if (r == null) return r;
			r = r[e];
		}
		return r;
	}, N = (e) => {
		if (O.has(e)) return O.get(e);
		let t = ut(J(ee(e), D, {
			cache: y,
			maxDepth: _,
			maxKeys: v
		}));
		return O.set(e, t), t;
	};
	if (x.size) {
		for (let e of x) l(e) && (k[e] = N(e), M.set(e, {
			kind: `property`,
			op: `set`
		}));
		x.clear();
	}
	for (let [e, t] of j) {
		if ((t.kind === `array` ? `set` : t.op) === `delete`) {
			k[e] = null;
			continue;
		}
		k[e] = N(e);
	}
	let P = 0;
	if (i && r.size) {
		let e = Object.create(null), t = Array.from(r);
		r.clear(), P = t.length;
		for (let r of t) {
			if (!l(r)) continue;
			let t = J(n[r].value, D, {
				cache: y,
				maxDepth: _,
				maxKeys: v
			}), i = C[r];
			(a === `deep` ? pt(i, t, o, { keys: s }) : a === `shallow` ? ft(i, t) : Object.is(i, t)) || (e[r] = ut(t), C[r] = t);
		}
		Object.assign(k, e);
	}
	let F = ot(k), I = 0;
	if (f) {
		let e = lt({
			input: F,
			entryMap: M,
			getPlainByPath: N,
			mergeSiblingThreshold: f,
			mergeSiblingSkipArray: h,
			mergeSiblingMaxParentBytes: m,
			mergeSiblingMaxInflationRatio: p
		});
		I = e.merged, F = ot(e.out);
	}
	let L = ct(F, d), R = L.fallback;
	if (T({
		mode: R ? `diff` : `patch`,
		reason: R ? `maxPayloadBytes` : `patch`,
		pendingPatchKeys: j.length,
		payloadKeys: Object.keys(F).length,
		mergedSiblingParents: I || void 0,
		computedDirtyKeys: P || void 0,
		estimatedBytes: L.estimatedBytes,
		bytes: L.bytes
	}), R) {
		w.value = !0, b.clear(), r.clear(), E(`maxPayloadBytes`);
		return;
	}
	if (Object.keys(F).length) {
		for (let [e, t] of Object.entries(F)) {
			let n = M.get(e);
			n ? mt(S, e, t, n.kind === `array` ? `set` : n.op) : mt(S, e, t, `set`);
		}
		if (typeof c.setData == `function`) {
			let e = c.setData(F);
			e && typeof e.then == `function` && e.catch(() => {});
		}
		T({
			mode: `patch`,
			reason: `patch`,
			pendingPatchKeys: j.length,
			payloadKeys: Object.keys(F).length
		});
	}
}
function _t(e) {
	let { state: t, computedRefs: n, dirtyComputedKeys: r, includeComputed: i, setDataStrategy: a, computedCompare: o, computedCompareMaxDepth: s, computedCompareMaxKeys: c, currentAdapter: l, shouldIncludeKey: u, maxPatchKeys: d, maxPayloadBytes: f, mergeSiblingThreshold: p, mergeSiblingMaxInflationRatio: m, mergeSiblingMaxParentBytes: h, mergeSiblingSkipArray: g, elevateTopKeyThreshold: _, toPlainMaxDepth: v, toPlainMaxKeys: y, debug: b, debugWhen: x, debugSampleRate: S, runTracker: C, isMounted: w } = e, T = /* @__PURE__ */ new WeakMap(), E = {}, D = Object.create(null), O = { value: a === `patch` }, k = /* @__PURE__ */ new Map(), A = /* @__PURE__ */ new Set(), j = (e) => {
		if (!b) return;
		let t = e.reason !== `patch` && e.reason !== `diff`;
		if (!(x === `fallback` && !t) && !(S < 1 && Math.random() > S)) try {
			b(e);
		} catch {}
	}, M = () => ht({
		state: t,
		computedRefs: n,
		includeComputed: i,
		shouldIncludeKey: u,
		plainCache: T,
		toPlainMaxDepth: v,
		toPlainMaxKeys: y
	}), ee = (e = `diff`) => {
		let t = M(), o = at(E, t);
		if (E = t, O.value = !1, k.clear(), a === `patch` && i) {
			D = Object.create(null);
			for (let e of Object.keys(n)) u(e) && (D[e] = t[e]);
			r.clear();
		}
		if (Object.keys(o).length) {
			if (typeof l.setData == `function`) {
				let e = l.setData(o);
				e && typeof e.then == `function` && e.catch(() => {});
			}
			j({
				mode: `diff`,
				reason: e,
				pendingPatchKeys: 0,
				payloadKeys: Object.keys(o).length
			});
		}
	};
	return {
		job: (e) => {
			w() && (C(), a === `patch` && !O.value ? gt({
				state: t,
				computedRefs: n,
				dirtyComputedKeys: r,
				includeComputed: i,
				computedCompare: o,
				computedCompareMaxDepth: s,
				computedCompareMaxKeys: c,
				currentAdapter: l,
				shouldIncludeKey: u,
				maxPatchKeys: d,
				maxPayloadBytes: f,
				mergeSiblingThreshold: p,
				mergeSiblingMaxInflationRatio: m,
				mergeSiblingMaxParentBytes: h,
				mergeSiblingSkipArray: g,
				elevateTopKeyThreshold: _,
				toPlainMaxDepth: v,
				toPlainMaxKeys: y,
				plainCache: T,
				pendingPatches: k,
				fallbackTopKeys: A,
				latestSnapshot: E,
				latestComputedSnapshot: D,
				needsFullSnapshot: O,
				emitDebug: j,
				runDiffUpdate: ee
			}) : ee(O.value ? `needsFullSnapshot` : `diff`));
		},
		mutationRecorder: (e, t) => {
			if (!w() || e.root !== t) return;
			if (!e.path) {
				if (Array.isArray(e.fallbackTopKeys) && e.fallbackTopKeys.length) for (let t of e.fallbackTopKeys) A.add(t);
				else O.value = !0;
				return;
			}
			let n = e.path.split(`.`, 1)[0];
			u(n) && k.set(e.path, {
				kind: e.kind,
				op: e.op
			});
		},
		snapshot: () => a === `patch` ? M() : { ...E },
		getLatestSnapshot: () => E
	};
}
function vt(e) {
	let t = e?.includeComputed ?? !0, n = e?.strategy ?? `diff`, r = typeof e?.maxPatchKeys == `number` ? Math.max(0, e.maxPatchKeys) : Infinity, i = typeof e?.maxPayloadBytes == `number` ? Math.max(0, e.maxPayloadBytes) : Infinity, a = typeof e?.mergeSiblingThreshold == `number` ? Math.max(2, Math.floor(e.mergeSiblingThreshold)) : 0, o = typeof e?.mergeSiblingMaxInflationRatio == `number` ? Math.max(0, e.mergeSiblingMaxInflationRatio) : 1.25, s = typeof e?.mergeSiblingMaxParentBytes == `number` ? Math.max(0, e.mergeSiblingMaxParentBytes) : Infinity, c = e?.mergeSiblingSkipArray ?? !0, l = e?.computedCompare ?? (n === `patch` ? `deep` : `reference`), u = typeof e?.computedCompareMaxDepth == `number` ? Math.max(0, Math.floor(e.computedCompareMaxDepth)) : 4, d = typeof e?.computedCompareMaxKeys == `number` ? Math.max(0, Math.floor(e.computedCompareMaxKeys)) : 200, f = e?.prelinkMaxDepth, p = e?.prelinkMaxKeys, m = e?.debug, h = e?.debugWhen ?? `fallback`, g = typeof e?.debugSampleRate == `number` ? Math.min(1, Math.max(0, e.debugSampleRate)) : 1, _ = typeof e?.elevateTopKeyThreshold == `number` ? Math.max(0, Math.floor(e.elevateTopKeyThreshold)) : Infinity, v = typeof e?.toPlainMaxDepth == `number` ? Math.max(0, Math.floor(e.toPlainMaxDepth)) : Infinity, y = typeof e?.toPlainMaxKeys == `number` ? Math.max(0, Math.floor(e.toPlainMaxKeys)) : Infinity, b = Array.isArray(e?.pick) && e.pick.length > 0 ? new Set(e.pick) : void 0, x = Array.isArray(e?.omit) && e.omit.length > 0 ? new Set(e.omit) : void 0;
	return {
		includeComputed: t,
		setDataStrategy: n,
		maxPatchKeys: r,
		maxPayloadBytes: i,
		mergeSiblingThreshold: a,
		mergeSiblingMaxInflationRatio: o,
		mergeSiblingMaxParentBytes: s,
		mergeSiblingSkipArray: c,
		computedCompare: l,
		computedCompareMaxDepth: u,
		computedCompareMaxKeys: d,
		prelinkMaxDepth: f,
		prelinkMaxKeys: p,
		debug: m,
		debugWhen: h,
		debugSampleRate: g,
		elevateTopKeyThreshold: _,
		toPlainMaxDepth: v,
		toPlainMaxKeys: y,
		pickSet: b,
		omitSet: x,
		shouldIncludeKey: (e) => !(b && !b.has(e) || x && x.has(e))
	};
}
function yt(e) {
	return e ? e.charAt(0).toUpperCase() + e.slice(1) : ``;
}
function bt(e) {
	return e ? e.split(`.`).map((e) => e.trim()).filter(Boolean) : [];
}
function xt(e, t, n) {
	let r = e;
	for (let e = 0; e < t.length - 1; e++) {
		let n = t[e];
		(r[n] == null || typeof r[n] != `object`) && (r[n] = {}), r = r[n];
	}
	r[t[t.length - 1]] = n;
}
function St(e, t, n, r, i) {
	if (!r.length) return;
	let [a, ...o] = r;
	if (!o.length) {
		if (t[a]) qe(n, a, i);
		else {
			let t = e[a];
			K(t) ? t.value = i : e[a] = i;
		}
		return;
	}
	if (t[a]) {
		qe(n, a, i);
		return;
	}
	(e[a] == null || typeof e[a] != `object`) && (e[a] = {}), xt(e[a], o, i);
}
function Ct(e, t) {
	return t.reduce((e, t) => e == null ? e : e[t], e);
}
function wt(e) {
	return Je(e);
}
function Tt(e, t, n, r) {
	return (i, a) => {
		let o = bt(i);
		if (!o.length) throw Error(`bindModel 需要非空路径`);
		let s = () => Ct(e, o), c = (e) => {
			St(t, n, r, o, e);
		}, l = {
			event: `input`,
			valueProp: `value`,
			parser: wt,
			formatter: (e) => e,
			...a
		};
		return {
			get value() {
				return s();
			},
			set value(e) {
				c(e);
			},
			update(e) {
				c(e);
			},
			model(e) {
				let t = {
					...l,
					...e
				}, n = `on${yt(t.event)}`, r = (e) => {
					c(t.parser(e));
				};
				return {
					[t.valueProp]: t.formatter(s()),
					[n]: r
				};
			}
		};
	};
}
var Et = `__wevuDefaultsScope`;
var Dt = {};
function Ot(e) {
	if (!(!e || typeof e != `object` || Array.isArray(e))) return e;
}
function kt(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = {
		...e,
		...t
	}, r = Ot(e.setData), i = Ot(t.setData);
	(r || i) && (n.setData = {
		...r ?? {},
		...i ?? {}
	});
	let a = Ot(e.options), o = Ot(t.options);
	return (a || o) && (n.options = {
		...a ?? {},
		...o ?? {}
	}), n;
}
function At(e, t) {
	return kt(e, t);
}
function Pt(e) {
	return At(Dt.app, e);
}
function Ft(e) {
	return At(Dt.component, e);
}
function zt(e) {}
function Vt(e) {}
function Z(e, t, n = []) {
	let r = e.__wevuHooks;
	if (!r) return;
	let i = r[t];
	if (!i) return;
	let a = e.__wevu?.proxy ?? e;
	if (Array.isArray(i)) for (let e of i) try {
		e.apply(a, n);
	} catch {}
	else if (typeof i == `function`) try {
		i.apply(a, n);
	} catch {}
}
function Ut(e, t, n = []) {
	let r = e.__wevuHooks;
	if (!r) return;
	let i = r[t];
	if (!i) return;
	let a = e.__wevu?.proxy ?? e;
	if (typeof i == `function`) try {
		return i.apply(a, n);
	} catch {
		return;
	}
	if (Array.isArray(i)) {
		let e;
		for (let t of i) try {
			e = t.apply(a, n);
		} catch {}
		return e;
	}
}
function Cn(e) {
	return e.replace(/&amp;/g, `&`).replace(/&quot;/g, `"`).replace(/&#34;/g, `"`).replace(/&apos;/g, `'`).replace(/&#39;/g, `'`).replace(/&lt;/g, `<`).replace(/&gt;/g, `>`);
}
function wn(e, t, n, r) {
	let i = n?.currentTarget?.dataset ?? n?.target?.dataset ?? {}, a = i?.wvInlineId;
	if (a && r) {
		let t = r[a];
		if (t && typeof t.fn == `function`) {
			let r = {}, a = Array.isArray(t.keys) ? t.keys : [];
			for (let e = 0; e < a.length; e += 1) {
				let t = a[e];
				r[t] = i?.[`wvS${e}`];
			}
			let o = t.fn(e, r, n);
			return typeof o == `function` ? o.call(e, n) : o;
		}
	}
	let o = typeof t == `string` ? t : void 0;
	if (!o) return;
	let s = i?.wvArgs, c = [];
	if (Array.isArray(s)) c = s;
	else if (typeof s == `string`) try {
		c = JSON.parse(s);
	} catch {
		try {
			c = JSON.parse(Cn(s));
		} catch {
			c = [];
		}
	}
	Array.isArray(c) || (c = []);
	let l = c.map((e) => e === `$event` ? n : e), u = e?.[o];
	if (typeof u == `function`) return u.apply(e, l);
}
var Tn = /* @__PURE__ */ new Map();
var En = 0;
function Dn() {
	return En += 1, `wv${En}`;
}
function On(e, t, n) {
	let r = Tn.get(e) ?? {
		snapshot: {},
		proxy: n,
		subscribers: /* @__PURE__ */ new Set()
	};
	if (r.snapshot = t, r.proxy = n, Tn.set(e, r), r.subscribers.size) for (let e of r.subscribers) try {
		e(t, n);
	} catch {}
}
function kn(e) {
	Tn.delete(e);
}
function An(e, t) {
	let n = Tn.get(e) ?? {
		snapshot: {},
		proxy: void 0,
		subscribers: /* @__PURE__ */ new Set()
	};
	return n.subscribers.add(t), Tn.set(e, n), () => {
		let n = Tn.get(e);
		n && n.subscribers.delete(t);
	};
}
function jn(e) {
	return Tn.get(e)?.proxy;
}
function Mn(e) {
	return Tn.get(e)?.snapshot;
}
function Nn(e, t, n) {
	try {
		t.state.__wvOwnerId = n;
	} catch {}
	try {
		e.__wvOwnerId = n;
	} catch {}
	let r = typeof t.snapshot == `function` ? t.snapshot() : {}, i = e.__wevuProps ?? e.properties;
	if (i && typeof i == `object`) for (let [e, t] of Object.entries(i)) r[e] = t;
	On(n, r, t.proxy);
}
function Pn(e) {
	return e.kind === `component`;
}
function Fn(e) {
	return new Proxy(e, {
		get(e, t, n) {
			let r = Reflect.get(e, t, n);
			return K(r) ? r.value : r;
		},
		set(e, t, n, r) {
			let i = e[t];
			return K(i) && !K(n) ? (i.value = n, !0) : Reflect.set(e, t, n, r);
		}
	});
}
function In(e, t) {
	let n = e.__wevuExposeProxy;
	if (n && e.__wevuExposeRaw === t) return n;
	let r = Fn(t);
	try {
		Object.defineProperty(e, `__wevuExposeProxy`, {
			value: r,
			configurable: !0,
			enumerable: !1,
			writable: !1
		}), Object.defineProperty(e, `__wevuExposeRaw`, {
			value: t,
			configurable: !0,
			enumerable: !1,
			writable: !1
		});
	} catch {
		e.__wevuExposeProxy = r, e.__wevuExposeRaw = t;
	}
	return r;
}
function Ln(e, t) {
	if (!t || typeof t != `object`) return e;
	let n = t;
	return q(new Proxy(e, {
		get(e, t, r) {
			return Reflect.has(e, t) ? Reflect.get(e, t, r) : n[t];
		},
		set(e, t, r, i) {
			return t in n ? (n[t] = r, !0) : Reflect.set(e, t, r, i);
		},
		has(e, t) {
			return Reflect.has(e, t) || t in n;
		},
		ownKeys(e) {
			return Array.from(new Set([...Reflect.ownKeys(e), ...Reflect.ownKeys(n)]));
		},
		getOwnPropertyDescriptor(e, t) {
			return Reflect.has(e, t) ? Object.getOwnPropertyDescriptor(e, t) : Object.getOwnPropertyDescriptor(n, t);
		}
	}));
}
function Rn(e) {
	if (!e || typeof e != `object`) return e ?? null;
	let t = e, n = t.__wevuExposed;
	return n && typeof n == `object` ? In(t, n) : t.__wevu?.proxy ? t.__wevu.proxy : e;
}
function zn(e) {
	return e.__wevuTemplateRefMap;
}
function Bn(e, t, n) {
	if (!e) return;
	let r = e.get(t);
	r && (r.value = n);
}
function Vn(e, t) {
	let n = e.__wevu?.proxy ?? e, r;
	if (t.get) try {
		r = t.get.call(n);
	} catch {
		r = void 0;
	}
	return r == null && t.name && (r = t.name), typeof r == `function` ? {
		type: `function`,
		fn: r
	} : K(r) ? {
		type: `ref`,
		ref: r
	} : typeof r == `string` && r ? {
		type: `name`,
		name: r
	} : t.name ? {
		type: `name`,
		name: t.name
	} : { type: `skip` };
}
function Hn(e) {
	let t = e.__wevu?.state ?? e, n = t.$refs;
	if (n && typeof n == `object`) return n;
	let r = q(Object.create(null));
	return Object.defineProperty(t, `$refs`, {
		value: r,
		configurable: !0,
		enumerable: !1,
		writable: !1
	}), r;
}
function Un(e) {
	let t = e;
	return t && typeof t.createSelectorQuery == `function` ? t.createSelectorQuery() : typeof wx < `u` && typeof wx.createSelectorQuery == `function` ? wx.createSelectorQuery().in(t) : null;
}
function Wn(e, t, n, r, i) {
	let a = Un(e);
	return a ? (r(n.multiple ? a.selectAll(t) : a.select(t)), new Promise((e) => {
		a.exec((t) => {
			let r = Array.isArray(t) ? t[0] : null;
			n.index != null && Array.isArray(r) && (r = r[n.index] ?? null), i && i(r ?? null), e(r ?? null);
		});
	})) : (i && i(null), Promise.resolve(null));
}
function Gn(e, t, n) {
	return q({
		selector: t,
		boundingClientRect: (r) => Wn(e, t, n, (e) => e.boundingClientRect(), r),
		scrollOffset: (r) => Wn(e, t, n, (e) => e.scrollOffset(), r),
		fields: (r, i) => Wn(e, t, n, (e) => e.fields(r), i),
		node: (r) => Wn(e, t, n, (e) => e.node(), r)
	});
}
function Kn(e, t) {
	let n = e;
	if (!n) return t.inFor ? q([]) : null;
	if (t.inFor) {
		if (typeof n.selectAllComponents == `function`) {
			let r = n.selectAllComponents(t.selector);
			return q((Array.isArray(r) ? r : []).map((n, r) => Ln(Gn(e, t.selector, {
				multiple: !0,
				index: r
			}), Rn(n))));
		}
		return q([]);
	}
	let r = Gn(e, t.selector, { multiple: !1 });
	return typeof n.selectComponent == `function` ? Ln(r, Rn(n.selectComponent(t.selector))) : r;
}
function qn(e, t, n) {
	return t.inFor ? q((Array.isArray(n) ? n : []).map((n, r) => Gn(e, t.selector, {
		multiple: !0,
		index: r
	}))) : n ? Gn(e, t.selector, { multiple: !1 }) : null;
}
function Jn(e, t) {
	let n = e.__wevuTemplateRefs;
	if (!n || !n.length) {
		t?.();
		return;
	}
	if (!e.__wevuReadyCalled) {
		t?.();
		return;
	}
	if (!e.__wevu) {
		t?.();
		return;
	}
	let r = zn(e), i = n.filter((e) => !Pn(e)), a = n.filter((e) => Pn(e)).map((t) => ({
		binding: t,
		value: Kn(e, t)
	})), o = (n) => {
		let i = Hn(e), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = e.__wevu?.proxy ?? e;
		n.forEach((t) => {
			let n = t.binding, r = t.value, i = Vn(e, n);
			if (i.type === `function`) {
				n.inFor && Array.isArray(r) ? r.length ? r.forEach((e) => i.fn.call(s, e)) : i.fn.call(s, null) : i.fn.call(s, r ?? null);
				return;
			}
			if (i.type === `ref`) {
				i.ref.value = r;
				return;
			}
			if (i.type === `name`) {
				o.add(i.name);
				let e = a.get(i.name) ?? {
					values: [],
					count: 0,
					hasFor: !1
				};
				e.count += 1, e.hasFor = e.hasFor || n.inFor, n.inFor ? Array.isArray(r) && e.values.push(...r) : r != null && e.values.push(r), a.set(i.name, e);
			}
		});
		for (let [e, t] of a) {
			let n;
			n = t.values.length ? t.hasFor || t.values.length > 1 || t.count > 1 ? q(t.values) : t.values[0] : t.hasFor ? q([]) : null, i[e] = n, Bn(r, e, n);
		}
		for (let e of Object.keys(i)) o.has(e) || delete i[e];
		t?.();
	};
	if (!i.length) {
		o(a);
		return;
	}
	let s = Un(e);
	if (!s) {
		o(a);
		return;
	}
	let c = [];
	for (let e of i) (e.inFor ? s.selectAll(e.selector) : s.select(e.selector)).boundingClientRect(), c.push({ binding: e });
	s.exec((t) => {
		let n = c.map((n, r) => {
			let i = Array.isArray(t) ? t[r] : null;
			return {
				binding: n.binding,
				value: qn(e, n.binding, i)
			};
		});
		o([...a, ...n]);
	});
}
function Yn(e, t) {
	let n = e.__wevuTemplateRefs;
	if (!n || !n.length) {
		t?.();
		return;
	}
	if (t) {
		let n = e.__wevuTemplateRefsCallbacks ?? [];
		n.push(t), e.__wevuTemplateRefsCallbacks || Object.defineProperty(e, `__wevuTemplateRefsCallbacks`, {
			value: n,
			configurable: !0,
			enumerable: !1,
			writable: !0
		});
	}
	e.__wevuTemplateRefsPending || (e.__wevuTemplateRefsPending = !0, o(() => {
		e.__wevuTemplateRefsPending = !1, Jn(e, () => {
			let t = e.__wevuTemplateRefsCallbacks;
			!t || !t.length || t.splice(0).forEach((e) => {
				try {
					e();
				} catch {}
			});
		});
	}));
}
function Xn(e) {
	let t = e.__wevuTemplateRefs;
	if (!t || !t.length) return;
	let n = Hn(e), r = e.__wevu?.proxy ?? e, i = /* @__PURE__ */ new Set(), a = zn(e);
	for (let o of t) {
		let t = Vn(e, o), s = o.inFor ? q([]) : null;
		if (t.type === `function`) {
			t.fn.call(r, null);
			continue;
		}
		if (t.type === `ref`) {
			t.ref.value = s;
			continue;
		}
		t.type === `name` && (i.add(t.name), n[t.name] = s, Bn(a, t.name, s));
	}
	for (let e of Object.keys(n)) i.has(e) || delete n[e];
}
function Zn(e, t, n) {
	if (typeof e != `function`) return;
	let r = n?.runtime ?? {
		methods: Object.create(null),
		state: {},
		proxy: {},
		watch: () => () => {},
		bindModel: () => {}
	};
	return n && (n.runtime = r), e(t, {
		...n ?? {},
		runtime: r
	});
}
function Qn(e, t, n) {
	if (typeof e == `function`) return {
		handler: e.bind(t.proxy),
		options: {}
	};
	if (typeof e == `string`) {
		let r = t.methods?.[e] ?? n[e];
		return typeof r == `function` ? {
			handler: r.bind(t.proxy),
			options: {}
		} : void 0;
	}
	if (!e || typeof e != `object`) return;
	let r = Qn(e.handler, t, n);
	if (!r) return;
	let i = { ...r.options };
	return e.immediate !== void 0 && (i.immediate = e.immediate), e.deep !== void 0 && (i.deep = e.deep), {
		handler: r.handler,
		options: i
	};
}
function $n(e, t) {
	let n = t.split(`.`).map((e) => e.trim()).filter(Boolean);
	return n.length ? () => {
		let t = e;
		for (let e of n) {
			if (t == null) return t;
			t = t[e];
		}
		return t;
	} : () => e;
}
function er(e, t, n) {
	let r = [], i = e.proxy;
	for (let [a, o] of Object.entries(t)) {
		let t = Qn(o, e, n);
		if (!t) continue;
		let s = $n(i, a), c = e.watch(s, t.handler, t.options);
		r.push(c);
	}
	return r;
}
function tr(e, t, n, r, i) {
	if (e.__wevu) return e.__wevu;
	let a = Dn(), o = i?.deferSetData ? ((e) => {
		let t, n = !1, r = { setData(r) {
			if (!n) {
				t = {
					...t ?? {},
					...r
				};
				return;
			}
			if (typeof e.setData == `function`) return e.setData(r);
		} };
		return r.__wevu_enableSetData = () => {
			if (n = !0, t && Object.keys(t).length && typeof e.setData == `function`) {
				let n = t;
				t = void 0, e.setData(n);
			}
		}, r;
	})(e) : { setData(t) {
		if (typeof e.setData == `function`) return e.setData(t);
	} }, s, c = () => {
		if (!s || typeof s.snapshot != `function`) return;
		let t = s.snapshot(), n = e.__wevuProps ?? e.properties;
		if (n && typeof n == `object`) for (let [e, r] of Object.entries(n)) t[e] = r;
		On(a, t, s.proxy);
	}, l = {
		...o,
		setData(t) {
			let n = o.setData(t);
			return c(), Yn(e), n;
		}
	}, u = t.mount({ ...l });
	s = u;
	let d = u?.proxy ?? {}, f = u?.state ?? {};
	if (!u?.methods) try {
		u.methods = Object.create(null);
	} catch {}
	let p = u?.methods ?? Object.create(null), m = u?.watch ?? (() => () => {}), h = u?.bindModel ?? (() => {}), g = {
		...u ?? {},
		state: f,
		proxy: d,
		methods: p,
		watch: m,
		bindModel: h
	};
	if (Object.defineProperty(e, `$wevu`, {
		value: g,
		configurable: !0,
		enumerable: !1,
		writable: !1
	}), e.__wevu = g, Nn(e, g, a), n) {
		let t = er(g, n, e);
		t.length && (e.__wevuWatchStops = t);
	}
	if (r) {
		let t = _e({ ...e.properties || {} });
		try {
			Object.defineProperty(e, `__wevuProps`, {
				value: t,
				configurable: !0,
				enumerable: !1,
				writable: !1
			});
		} catch {
			e.__wevuProps = t;
		}
		let n = {
			props: t,
			runtime: g,
			state: f,
			proxy: d,
			bindModel: h.bind(g),
			watch: m.bind(g),
			instance: e,
			emit: (t, n, r) => {
				typeof e.triggerEvent == `function` && e.triggerEvent(t, n, r);
			},
			expose: (t) => {
				e.__wevuExposed = t;
			},
			attrs: {},
			slots: Object.create(null)
		};
		zt(e), Vt(n);
		try {
			let e = Zn(r, t, n);
			e && typeof e == `object` && Object.keys(e).forEach((t) => {
				let n = e[t];
				typeof n == `function` ? u.methods[t] = (...e) => n.apply(u.proxy, e) : u.state[t] = n;
			});
		} finally {
			Vt(void 0), zt(void 0);
		}
	}
	try {
		let t = u.methods;
		for (let n of Object.keys(t)) typeof e[n] != `function` && (e[n] = function(...e) {
			let t = this.$wevu?.methods?.[n];
			if (typeof t == `function`) return t.apply(this.$wevu.proxy, e);
		});
	} catch {}
	return u;
}
function nr(e) {
	let t = e.__wevu?.adapter;
	t && typeof t.__wevu_enableSetData == `function` && t.__wevu_enableSetData();
}
function rr(e) {
	let t = e.__wevu, n = e.__wvOwnerId;
	n && kn(n), Xn(e), t && e.__wevuHooks && Z(e, `onUnload`, []), e.__wevuHooks &&= void 0;
	let r = e.__wevuWatchStops;
	if (Array.isArray(r)) for (let e of r) try {
		e();
	} catch {}
	e.__wevuWatchStops = void 0, t && t.unmount(), delete e.__wevu, `$wevu` in e && delete e.$wevu;
}
function ir(e, t, n, r, i) {
	if (typeof App != `function`) throw TypeError(`createApp 需要全局 App 构造器可用`);
	let a = Object.keys(t ?? {}), o = { ...i };
	o.globalData = o.globalData ?? {}, o.__weapp_vite_inline ||= function(e) {
		let t = (e?.currentTarget?.dataset ?? e?.target?.dataset)?.wvHandler, n = this.__wevu, r = n?.proxy ?? this, i = n?.methods?.__weapp_vite_inline_map;
		return wn(r, t, e, i);
	};
	let s = o.onLaunch;
	o.onLaunch = function(...t) {
		tr(this, e, n, r), Z(this, `onLaunch`, t), typeof s == `function` && s.apply(this, t);
	};
	let c = o.onShow;
	o.onShow = function(...e) {
		Z(this, `onShow`, e), typeof c == `function` && c.apply(this, e);
	};
	let l = o.onHide;
	o.onHide = function(...e) {
		Z(this, `onHide`, e), typeof l == `function` && l.apply(this, e);
	};
	let u = o.onError;
	o.onError = function(...e) {
		Z(this, `onError`, e), typeof u == `function` && u.apply(this, e);
	};
	let d = o.onPageNotFound;
	o.onPageNotFound = function(...e) {
		Z(this, `onPageNotFound`, e), typeof d == `function` && d.apply(this, e);
	};
	let f = o.onUnhandledRejection;
	o.onUnhandledRejection = function(...e) {
		Z(this, `onUnhandledRejection`, e), typeof f == `function` && f.apply(this, e);
	};
	let p = o.onThemeChange;
	o.onThemeChange = function(...e) {
		Z(this, `onThemeChange`, e), typeof p == `function` && p.apply(this, e);
	};
	for (let e of a) {
		let t = o[e];
		o[e] = function(...n) {
			let r = this.__wevu, i, a = r?.methods?.[e];
			return a && (i = a.apply(r.proxy, n)), typeof t == `function` ? t.apply(this, n) : i;
		};
	}
	App(o);
}
function ar(e) {
	let { features: t, userOnSaveExitState: n, userOnPullDownRefresh: r, userOnReachBottom: i, userOnPageScroll: a, userOnRouteDone: o, userOnTabItemTap: s, userOnResize: c, userOnShareAppMessage: l, userOnShareTimeline: u, userOnAddToFavorites: d } = e, f = typeof r == `function` || !!t.enableOnPullDownRefresh, p = typeof i == `function` || !!t.enableOnReachBottom, m = typeof a == `function` || !!t.enableOnPageScroll, h = typeof o == `function` || !!t.enableOnRouteDone, g = typeof s == `function` || !!t.enableOnTabItemTap, _ = typeof c == `function` || !!t.enableOnResize, v = typeof l == `function` || !!t.enableOnShareAppMessage, y = typeof u == `function` || !!t.enableOnShareTimeline, b = typeof d == `function` || !!t.enableOnAddToFavorites, x = typeof n == `function` || !!t.enableOnSaveExitState, S = () => {};
	return {
		enableOnPullDownRefresh: f,
		enableOnReachBottom: p,
		enableOnPageScroll: m,
		enableOnRouteDone: h,
		enableOnTabItemTap: g,
		enableOnResize: _,
		enableOnShareAppMessage: v,
		enableOnShareTimeline: y,
		enableOnAddToFavorites: b,
		enableOnSaveExitState: x,
		effectiveOnSaveExitState: typeof n == `function` ? n : (() => ({ data: void 0 })),
		effectiveOnPullDownRefresh: typeof r == `function` ? r : S,
		effectiveOnReachBottom: typeof i == `function` ? i : S,
		effectiveOnPageScroll: typeof a == `function` ? a : S,
		effectiveOnRouteDone: typeof o == `function` ? o : S,
		effectiveOnTabItemTap: typeof s == `function` ? s : S,
		effectiveOnResize: typeof c == `function` ? c : S,
		effectiveOnShareAppMessage: typeof l == `function` ? l : () => ({}),
		effectiveOnShareTimeline: typeof u == `function` ? u : () => ({}),
		effectiveOnAddToFavorites: typeof d == `function` ? d : (() => ({}))
	};
}
var or = !1, Q;
function sr(e) {
	let t = e.options;
	if (t && typeof t == `object`) return t;
	if (typeof getCurrentPages == `function`) {
		let e = getCurrentPages(), t = Array.isArray(e) ? e[e.length - 1] : void 0, n = t && typeof t == `object` ? t.options : void 0;
		if (n && typeof n == `object`) return n;
	}
	return {};
}
function cr() {
	if (or) return;
	or = !0;
	let e = typeof wx < `u` ? wx : void 0;
	if (!e || typeof e != `object`) return;
	let t = e.startPullDownRefresh;
	typeof t == `function` && (e.startPullDownRefresh = function(...e) {
		let n = t.apply(this, e);
		return Q && Z(Q, `onPullDownRefresh`, []), n;
	});
	let n = e.pageScrollTo;
	typeof n == `function` && (e.pageScrollTo = function(e, ...t) {
		let r = n.apply(this, [e, ...t]);
		return Q && Z(Q, `onPageScroll`, [e ?? {}]), r;
	});
}
function lr(e) {
	let { runtimeApp: t, watch: n, setup: r, userOnLoad: i, userOnUnload: a, userOnShow: o, userOnHide: s, userOnReady: c, isPage: l, enableOnSaveExitState: u, enableOnPullDownRefresh: d, enableOnReachBottom: f, enableOnPageScroll: p, enableOnRouteDone: m, enableOnTabItemTap: h, enableOnResize: g, enableOnShareAppMessage: _, enableOnShareTimeline: v, enableOnAddToFavorites: y, effectiveOnSaveExitState: b, effectiveOnPullDownRefresh: x, effectiveOnReachBottom: S, effectiveOnPageScroll: C, effectiveOnRouteDone: w, effectiveOnTabItemTap: T, effectiveOnResize: E, effectiveOnShareAppMessage: D, effectiveOnShareTimeline: O, effectiveOnAddToFavorites: k, hasHook: A } = e, j = {
		onLoad(...e) {
			if (!this.__wevuOnLoadCalled && (this.__wevuOnLoadCalled = !0, tr(this, t, n, r), nr(this), Z(this, `onLoad`, e), typeof i == `function`)) return i.apply(this, e);
		},
		onUnload(...e) {
			if (l && Q === this && (Q = void 0), rr(this), typeof a == `function`) return a.apply(this, e);
		},
		onShow(...e) {
			if (l && (cr(), Q = this, this.__wevuOnLoadCalled || j.onLoad.call(this, sr(this)), this.__wevuRouteDoneCalled = !1), Z(this, `onShow`, e), typeof o == `function`) return o.apply(this, e);
			if (l && m && this.__wevuReadyCalled && !this.__wevuRouteDoneCalled) return j.onRouteDone?.call(this);
		},
		onHide(...e) {
			if (l && Q === this && (Q = void 0), Z(this, `onHide`, e), typeof s == `function`) return s.apply(this, e);
		},
		onReady(...e) {
			if (!this.__wevuReadyCalled) {
				this.__wevuReadyCalled = !0, Yn(this, () => {
					Z(this, `onReady`, e), typeof c == `function` && c.apply(this, e), l && m && !this.__wevuRouteDoneCalled && j.onRouteDone?.call(this);
				});
				return;
			}
			if (typeof c == `function`) return c.apply(this, e);
		}
	};
	return u && (j.onSaveExitState = function(...e) {
		let t = Ut(this, `onSaveExitState`, e);
		return t === void 0 ? b.apply(this, e) : t;
	}), d && (j.onPullDownRefresh = function(...e) {
		if (Z(this, `onPullDownRefresh`, e), !A(this, `onPullDownRefresh`)) return x.apply(this, e);
	}), f && (j.onReachBottom = function(...e) {
		if (Z(this, `onReachBottom`, e), !A(this, `onReachBottom`)) return S.apply(this, e);
	}), p && (j.onPageScroll = function(...e) {
		if (Z(this, `onPageScroll`, e), !A(this, `onPageScroll`)) return C.apply(this, e);
	}), m && (j.onRouteDone = function(...e) {
		if (this.__wevuRouteDoneCalled = !0, Z(this, `onRouteDone`, e), !A(this, `onRouteDone`)) return w.apply(this, e);
	}), h && (j.onTabItemTap = function(...e) {
		if (Z(this, `onTabItemTap`, e), !A(this, `onTabItemTap`)) return T.apply(this, e);
	}), g && (j.onResize = function(...e) {
		if (Z(this, `onResize`, e), !A(this, `onResize`)) return E.apply(this, e);
	}), _ && (j.onShareAppMessage = function(...e) {
		let t = Ut(this, `onShareAppMessage`, e);
		return t === void 0 ? D.apply(this, e) : t;
	}), v && (j.onShareTimeline = function(...e) {
		let t = Ut(this, `onShareTimeline`, e);
		return t === void 0 ? O.apply(this, e) : t;
	}), y && (j.onAddToFavorites = function(...e) {
		let t = Ut(this, `onAddToFavorites`, e);
		return t === void 0 ? k.apply(this, e) : t;
	}), j;
}
function ur(e) {
	let { userMethods: t, runtimeMethods: n } = e, r = { ...t };
	r.__weapp_vite_inline ||= function(e) {
		let t = (e?.currentTarget?.dataset ?? e?.target?.dataset)?.wvHandler, n = this.__wevu, r = n?.proxy ?? this, i = n?.methods?.__weapp_vite_inline_map;
		return wn(r, t, e, i);
	}, r.__weapp_vite_model ||= function(e) {
		let t = e?.currentTarget?.dataset?.wvModel ?? e?.target?.dataset?.wvModel;
		if (typeof t != `string` || !t) return;
		let n = this.__wevu;
		if (!n || typeof n.bindModel != `function`) return;
		let r = Je(e);
		try {
			n.bindModel(t).update(r);
		} catch {}
	}, !r.__weapp_vite_owner && typeof n?.__weapp_vite_owner == `function` && (r.__weapp_vite_owner = n.__weapp_vite_owner);
	let i = Object.keys(n ?? {});
	for (let e of i) {
		if (e.startsWith(`__weapp_vite_`)) continue;
		let t = r[e];
		r[e] = function(...n) {
			let r = this.__wevu, i, a = r?.methods?.[e];
			if (a && (i = a.apply(r.proxy, n)), typeof t == `function`) {
				let e = t.apply(this, n);
				return e === void 0 ? i : e;
			}
			return i;
		};
	}
	return { finalMethods: r };
}
function dr(e) {
	let t = e.__wevu, n = e.__wvOwnerId;
	if (!t || !n || typeof t.snapshot != `function`) return;
	let r = t.snapshot(), i = e.__wevuProps ?? e.properties;
	if (i && typeof i == `object`) for (let [e, t] of Object.entries(i)) r[e] = t;
	On(n, r, t.proxy);
}
function fr(e) {
	let { restOptions: t, userObservers: n } = e, r = (e) => {
		let t = e.__wevuProps, n = e.properties;
		if (!t || typeof t != `object` || !n || typeof n != `object`) return;
		let r = n, i = Object.keys(t);
		for (let e of i) if (!Object.prototype.hasOwnProperty.call(r, e)) try {
			delete t[e];
		} catch {}
		for (let [e, n] of Object.entries(r)) try {
			t[e] = n;
		} catch {}
		dr(e);
	}, i = (e, t, n) => {
		let r = e.__wevuProps;
		if (!(!r || typeof r != `object`)) {
			try {
				r[t] = n;
			} catch {}
			dr(e);
		}
	}, a = t.properties && typeof t.properties == `object` ? Object.keys(t.properties) : [], o = {};
	if (a.length) for (let e of a) o[e] = function(t) {
		i(this, e, t);
	};
	let s = { ...n ?? {} };
	for (let [e, t] of Object.entries(o)) {
		let n = s[e];
		typeof n == `function` ? s[e] = function(...e) {
			n.apply(this, e), t.apply(this, e);
		} : s[e] = t;
	}
	return {
		syncWevuPropsFromInstance: r,
		finalObservers: s
	};
}
function pr(e, t, n, r, i) {
	let { methods: a = {}, lifetimes: o = {}, pageLifetimes: s = {}, options: c = {}, ...l } = i, u = l.onLoad, d = l.onUnload, f = l.onShow, p = l.onHide, m = l.onReady, h = l.onSaveExitState, g = l.onPullDownRefresh, _ = l.onReachBottom, v = l.onPageScroll, y = l.onRouteDone, b = l.onTabItemTap, x = l.onResize, S = l.onShareAppMessage, C = l.onShareTimeline, w = l.onAddToFavorites, T = l.features ?? {}, E = !!l.__wevu_isPage || Object.keys(T ?? {}).length > 0, D = { ...l }, O = D.__wevuTemplateRefs;
	delete D.__wevuTemplateRefs;
	let k = D.observers, A = D.setupLifecycle === `created` ? `created` : `attached`;
	delete D.setupLifecycle;
	let j = D.created;
	delete D.features, delete D.created, delete D.onLoad, delete D.onUnload, delete D.onShow, delete D.onHide, delete D.onReady;
	let { enableOnPullDownRefresh: M, enableOnReachBottom: ee, enableOnPageScroll: N, enableOnRouteDone: P, enableOnTabItemTap: F, enableOnResize: I, enableOnShareAppMessage: L, enableOnShareTimeline: R, enableOnAddToFavorites: te, enableOnSaveExitState: ne, effectiveOnSaveExitState: re, effectiveOnPullDownRefresh: z, effectiveOnReachBottom: ie, effectiveOnPageScroll: ae, effectiveOnRouteDone: oe, effectiveOnTabItemTap: se, effectiveOnResize: ce, effectiveOnShareAppMessage: le, effectiveOnShareTimeline: B, effectiveOnAddToFavorites: V } = ar({
		features: T,
		userOnSaveExitState: h,
		userOnPullDownRefresh: g,
		userOnReachBottom: _,
		userOnPageScroll: v,
		userOnRouteDone: y,
		userOnTabItemTap: b,
		userOnResize: x,
		userOnShareAppMessage: S,
		userOnShareTimeline: C,
		userOnAddToFavorites: w
	}), H = (e, t) => {
		let n = e.__wevuHooks;
		if (!n) return !1;
		let r = n[t];
		return r ? Array.isArray(r) ? r.length > 0 : typeof r == `function` : !1;
	};
	{
		let e = D.export;
		D.export = function() {
			let t = this.__wevuExposed ?? {}, n = typeof e == `function` ? e.call(this) : {};
			return n && typeof n == `object` && !Array.isArray(n) ? {
				...t,
				...n
			} : n ?? t;
		};
	}
	let ue = {
		multipleSlots: c.multipleSlots ?? !0,
		...c
	}, { syncWevuPropsFromInstance: U, finalObservers: de } = fr({
		restOptions: D,
		userObservers: k
	}), { finalMethods: fe } = ur({
		userMethods: a,
		runtimeMethods: t
	}), W = lr({
		runtimeApp: e,
		watch: n,
		setup: r,
		userOnLoad: u,
		userOnUnload: d,
		userOnShow: f,
		userOnHide: p,
		userOnReady: m,
		isPage: E,
		enableOnSaveExitState: ne,
		enableOnPullDownRefresh: M,
		enableOnReachBottom: ee,
		enableOnPageScroll: N,
		enableOnRouteDone: P,
		enableOnTabItemTap: F,
		enableOnResize: I,
		enableOnShareAppMessage: L,
		enableOnShareTimeline: R,
		enableOnAddToFavorites: te,
		effectiveOnSaveExitState: re,
		effectiveOnPullDownRefresh: z,
		effectiveOnReachBottom: ie,
		effectiveOnPageScroll: ae,
		effectiveOnRouteDone: oe,
		effectiveOnTabItemTap: se,
		effectiveOnResize: ce,
		effectiveOnShareAppMessage: le,
		effectiveOnShareTimeline: B,
		effectiveOnAddToFavorites: V,
		hasHook: H
	});
	Component({
		...D,
		...W,
		observers: de,
		lifetimes: {
			...o,
			created: function(...t) {
				Array.isArray(O) && O.length && Object.defineProperty(this, `__wevuTemplateRefs`, {
					value: O,
					configurable: !0,
					enumerable: !1,
					writable: !1
				}), A === `created` && (tr(this, e, n, r, { deferSetData: !0 }), U(this)), typeof j == `function` && j.apply(this, t), typeof o.created == `function` && o.created.apply(this, t);
			},
			moved: function(...e) {
				Z(this, `onMoved`, e), typeof o.moved == `function` && o.moved.apply(this, e);
			},
			attached: function(...t) {
				Array.isArray(O) && O.length && !this.__wevuTemplateRefs && Object.defineProperty(this, `__wevuTemplateRefs`, {
					value: O,
					configurable: !0,
					enumerable: !1,
					writable: !1
				}), (A !== `created` || !this.__wevu) && tr(this, e, n, r), U(this), A === `created` && nr(this), typeof o.attached == `function` && o.attached.apply(this, t);
			},
			ready: function(...e) {
				if (E && typeof W.onReady == `function`) {
					W.onReady.call(this, ...e), typeof o.ready == `function` && o.ready.apply(this, e);
					return;
				}
				if (!this.__wevuReadyCalled) {
					this.__wevuReadyCalled = !0, U(this), Yn(this, () => {
						Z(this, `onReady`, e), typeof o.ready == `function` && o.ready.apply(this, e);
					});
					return;
				}
				typeof o.ready == `function` && o.ready.apply(this, e);
			},
			detached: function(...e) {
				if (E && typeof W.onUnload == `function`) {
					W.onUnload.call(this, ...e), typeof o.detached == `function` && o.detached.apply(this, e);
					return;
				}
				Xn(this), rr(this), typeof o.detached == `function` && o.detached.apply(this, e);
			},
			error: function(...e) {
				Z(this, `onError`, e), typeof o.error == `function` && o.error.apply(this, e);
			}
		},
		pageLifetimes: {
			...s,
			show: function(...e) {
				if (E && typeof W.onShow == `function`) {
					W.onShow.call(this, ...e), typeof s.show == `function` && s.show.apply(this, e);
					return;
				}
				Z(this, `onShow`, e), typeof s.show == `function` && s.show.apply(this, e);
			},
			hide: function(...e) {
				if (E && typeof W.onHide == `function`) {
					W.onHide.call(this, ...e), typeof s.hide == `function` && s.hide.apply(this, e);
					return;
				}
				Z(this, `onHide`, e), typeof s.hide == `function` && s.hide.apply(this, e);
			},
			resize: function(...e) {
				if (E && typeof W.onResize == `function`) {
					W.onResize.call(this, ...e), typeof s.resize == `function` && s.resize.apply(this, e);
					return;
				}
				Z(this, `onResize`, e), typeof s.resize == `function` && s.resize.apply(this, e);
			}
		},
		methods: fe,
		options: ue
	});
}
function mr(e) {
	let { [Et]: t, data: n, computed: r, methods: i, setData: o, watch: s, setup: c, ...l } = e[Et] === `component` ? e : Pt(e), u = i ?? {}, d = r ?? {}, f = /* @__PURE__ */ new Set(), p = { globalProperties: {} }, m = {
		mount(e) {
			let t = Se((n ?? (() => ({})))()), r = d, i = u, s = !0, c = [], { includeComputed: l, setDataStrategy: f, maxPatchKeys: m, maxPayloadBytes: h, mergeSiblingThreshold: g, mergeSiblingMaxInflationRatio: v, mergeSiblingMaxParentBytes: y, mergeSiblingSkipArray: b, computedCompare: x, computedCompareMaxDepth: S, computedCompareMaxKeys: C, prelinkMaxDepth: w, prelinkMaxKeys: E, debug: D, debugWhen: O, debugSampleRate: k, elevateTopKeyThreshold: A, toPlainMaxDepth: j, toPlainMaxKeys: N, shouldIncludeKey: P } = vt(o), { boundMethods: F, computedRefs: I, computedSetters: L, dirtyComputedKeys: R, computedProxy: te, publicInstance: ne } = Xe({
				state: t,
				computedDefs: r,
				methodDefs: i,
				appConfig: p,
				includeComputed: l,
				setDataStrategy: f
			}), re = e ?? { setData: () => {} }, z = U(t), ie, ae = _t({
				state: t,
				computedRefs: I,
				dirtyComputedKeys: R,
				includeComputed: l,
				setDataStrategy: f,
				computedCompare: x,
				computedCompareMaxDepth: S,
				computedCompareMaxKeys: C,
				currentAdapter: re,
				shouldIncludeKey: P,
				maxPatchKeys: m,
				maxPayloadBytes: h,
				mergeSiblingThreshold: g,
				mergeSiblingMaxInflationRatio: v,
				mergeSiblingMaxParentBytes: y,
				mergeSiblingSkipArray: b,
				elevateTopKeyThreshold: A,
				toPlainMaxDepth: j,
				toPlainMaxKeys: N,
				debug: D,
				debugWhen: O,
				debugSampleRate: k,
				runTracker: () => ie?.(),
				isMounted: () => s
			}), oe = () => ae.job(z), se = (e) => ae.mutationRecorder(e, z);
			ie = T(() => {
				he(t), Object.keys(t).forEach((e) => {
					let n = t[e];
					K(n) ? n.value : G(n) && he(n);
				});
			}, {
				lazy: !0,
				scheduler: () => a(oe)
			}), oe(), c.push(() => _(ie)), f === `patch` && (pe(t, {
				shouldIncludeTopKey: P,
				maxDepth: w,
				maxKeys: E
			}), M(se), c.push(() => ee(se)), c.push(() => me(t)));
			function ce(e, t, n) {
				let r = Ge(e, (e, n) => t(e, n), n);
				return c.push(r), () => {
					r();
					let e = c.indexOf(r);
					e >= 0 && c.splice(e, 1);
				};
			}
			return {
				get state() {
					return t;
				},
				get proxy() {
					return ne;
				},
				get methods() {
					return F;
				},
				get computed() {
					return te;
				},
				get adapter() {
					return re;
				},
				bindModel: Tt(ne, t, I, L),
				watch: ce,
				snapshot: () => ae.snapshot(),
				unmount: () => {
					s && (s = !1, c.forEach((e) => {
						try {
							e();
						} catch {}
					}), c.length = 0);
				}
			};
		},
		use(e, ...t) {
			if (!e || f.has(e)) return m;
			if (f.add(e), typeof e == `function`) e(m, ...t);
			else if (typeof e.install == `function`) e.install(m, ...t);
			else throw TypeError(`插件必须是函数，或包含 install 方法的对象`);
			return m;
		},
		config: p
	};
	if (typeof App == `function`) {
		let e = typeof wx < `u` ? wx : typeof my < `u` ? my : void 0, t = e?.__wxConfig !== void 0, n = `__wevuAppRegistered`;
		t && e && e[n] || (t && e && (e[n] = !0), ir(m, i ?? {}, s, c, l));
	}
	return m;
}
function hr(e, t, n) {
	let r = e.properties, i = n ?? (r && typeof r == `object` ? r : void 0), a = (e) => {
		let t = { ...e ?? {} };
		return Object.prototype.hasOwnProperty.call(t, `__wvSlotOwnerId`) || (t.__wvSlotOwnerId = {
			type: String,
			value: ``
		}), Object.prototype.hasOwnProperty.call(t, `__wvSlotScope`) || (t.__wvSlotScope = {
			type: null,
			value: null
		}), t;
	};
	if (i || !t) {
		let { properties: t, ...n } = e;
		return {
			...n,
			properties: a(i)
		};
	}
	let o = {};
	return Object.entries(t).forEach(([e, t]) => {
		if (t != null) {
			if (Array.isArray(t) || typeof t == `function`) {
				o[e] = { type: t };
				return;
			}
			if (typeof t == `object`) {
				if (e.endsWith(`Modifiers`) && Object.keys(t).length === 0) {
					o[e] = {
						type: Object,
						value: {}
					};
					return;
				}
				let n = {};
				`type` in t && t.type !== void 0 && (n.type = t.type);
				let r = `default` in t ? t.default : t.value;
				r !== void 0 && (n.value = typeof r == `function` ? r() : r), o[e] = n;
			}
		}
	}), {
		...e,
		properties: a(o)
	};
}
function gr(e) {
	return e.replace(/&amp;/g, `&`).replace(/&quot;/g, `"`).replace(/&#34;/g, `"`).replace(/&apos;/g, `'`).replace(/&#39;/g, `'`).replace(/&lt;/g, `<`).replace(/&gt;/g, `>`);
}
function _r(e) {
	let t = e?.currentTarget?.dataset?.wvArgs ?? e?.target?.dataset?.wvArgs, n = [];
	if (Array.isArray(t)) n = t;
	else if (typeof t == `string`) try {
		n = JSON.parse(t);
	} catch {
		try {
			n = JSON.parse(gr(t));
		} catch {
			n = [];
		}
	}
	return Array.isArray(n) || (n = []), n.map((t) => t === `$event` ? e : t);
}
function vr(e) {
	if (!e || typeof e != `object`) return {};
	if (Array.isArray(e)) {
		let t = {};
		for (let n = 0; n < e.length; n += 2) {
			let r = e[n];
			typeof r == `string` && r && (t[r] = e[n + 1]);
		}
		return t;
	}
	return e;
}
function yr(e, t) {
	let n = Object.prototype.hasOwnProperty.call(t ?? {}, `__wvSlotScope`) ? t.__wvSlotScope : e?.properties?.__wvSlotScope, r = Object.prototype.hasOwnProperty.call(t ?? {}, `__wvSlotProps`) ? t.__wvSlotProps : e?.properties?.__wvSlotProps, i = vr(n), a = vr(r), o = {
		...i,
		...a
	};
	typeof e?.setData == `function` && e.setData({ __wvSlotPropsData: o });
}
function br(e) {
	let t = {
		properties: {
			__wvOwnerId: {
				type: String,
				value: ``
			},
			__wvSlotProps: {
				type: null,
				value: null,
				observer(e) {
					yr(this, { __wvSlotProps: e });
				}
			},
			__wvSlotScope: {
				type: null,
				value: null,
				observer(e) {
					yr(this, { __wvSlotScope: e });
				}
			}
		},
		data: () => ({
			__wvOwner: {},
			__wvSlotPropsData: {}
		}),
		lifetimes: {
			attached() {
				let e = this.properties?.__wvOwnerId ?? ``;
				if (yr(this), !e) return;
				let t = (e, t) => {
					this.__wvOwnerProxy = t, typeof this.setData == `function` && this.setData({ __wvOwner: e || {} });
				};
				this.__wvOwnerUnsub = An(e, t);
				let n = Mn(e);
				n && t(n, jn(e));
			},
			detached() {
				typeof this.__wvOwnerUnsub == `function` && this.__wvOwnerUnsub(), this.__wvOwnerUnsub = void 0, this.__wvOwnerProxy = void 0;
			}
		},
		methods: { __weapp_vite_owner(e) {
			let t = this.__wvOwnerProxy, n = this.__wevu?.methods?.__weapp_vite_inline_map, r = wn(t, e?.currentTarget?.dataset?.wvHandler ?? e?.target?.dataset?.wvHandler, e, n);
			if (r !== void 0) return r;
			if (!t) return;
			let i = e?.currentTarget?.dataset?.wvHandler ?? e?.target?.dataset?.wvHandler;
			if (typeof i != `string` || !i) return;
			let a = t?.[i];
			if (typeof a != `function`) return;
			let o = _r(e);
			return a.apply(t, o);
		} }
	};
	return e?.computed && Object.keys(e.computed).length > 0 && (t.computed = e.computed), e?.inlineMap && Object.keys(e.inlineMap).length > 0 && (t.methods = {
		...t.methods,
		__weapp_vite_inline_map: e.inlineMap
	}), t;
}
function xr(e) {
	if (Object.prototype.toString.call(e) !== `[object Object]`) return !1;
	let t = Object.getPrototypeOf(e);
	return t === null || t === Object.prototype;
}
function Sr(e) {
	return typeof e != `object` || !e || K(e) || G(e) || Array.isArray(e) ? !0 : xr(e);
}
function Cr(e, t, n) {
	let r = e?.methods ?? Object.create(null), i = e?.state ?? Object.create(null), a = G(i) ? U(i) : i;
	if (e && !e.methods) try {
		e.methods = r;
	} catch {}
	if (e && !e.state) try {
		e.state = i;
	} catch {}
	Object.keys(n).forEach((o) => {
		let s = n[o];
		if (typeof s == `function`) r[o] = (...t) => s.apply(e?.proxy ?? e, t);
		else if (s === t || !Sr(s)) try {
			Object.defineProperty(a, o, {
				value: s,
				configurable: !0,
				enumerable: !1,
				writable: !0
			});
		} catch {
			i[o] = s;
		}
		else i[o] = s;
	}), e && (e.methods = e.methods ?? r, e.state = e.state ?? i);
}
var wr;
function Tr() {
	let e = typeof globalThis < `u`, t = typeof wx < `u` ? wx : typeof my < `u` ? my : e ? globalThis : void 0;
	if (!t) return;
	let n = t;
	!n.__weapp_vite_createScopedSlotComponent && wr && (n.__weapp_vite_createScopedSlotComponent = wr);
}
function Er(e) {
	Tr();
	let { __typeProps: t, data: n, computed: r, methods: i, setData: a, watch: o, setup: s, props: c, ...l } = Ft(e), u = mr({
		data: n,
		computed: r,
		methods: i,
		setData: a,
		[Et]: `component`
	}), d = (e, t) => {
		let n = Zn(s, e, t);
		return n && t && Cr(t.runtime, t.instance, n), n;
	}, f = hr(l, c), p = {
		data: n,
		computed: r,
		methods: i,
		setData: a,
		watch: o,
		setup: d,
		mpOptions: f
	};
	return pr(u, i ?? {}, o, d, f), {
		__wevu_runtime: u,
		__wevu_options: p
	};
}
function Dr(e) {
	Tr();
	let { properties: t, props: n, ...r } = e;
	Er(hr(r, n, t));
}
function Or(e) {
	Dr(br(e));
}
wr = Or, Tr();
Object.defineProperty(exports, "Dr", {
	enumerable: true,
	get: function() {
		return Dr;
	}
});
