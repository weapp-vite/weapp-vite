const require_rolldown_runtime = require("../../rolldown-runtime.js");
var require_dayjs_min = /* @__PURE__ */ require_rolldown_runtime.__commonJSMin(((exports, module) => {
	(function(t, e) {
		"object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = "undefined" != typeof globalThis ? globalThis : t || self).dayjs = e();
	})(exports, (function() {
		var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = {
			name: "en",
			weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
			months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
			ordinal: function(t$1) {
				var e$1 = [
					"th",
					"st",
					"nd",
					"rd"
				], n$1 = t$1 % 100;
				return "[" + t$1 + (e$1[(n$1 - 20) % 10] || e$1[n$1] || e$1[0]) + "]";
			}
		}, m = function(t$1, e$1, n$1) {
			var r$1 = String(t$1);
			return !r$1 || r$1.length >= e$1 ? t$1 : "" + Array(e$1 + 1 - r$1.length).join(n$1) + t$1;
		}, v = {
			s: m,
			z: function(t$1) {
				var e$1 = -t$1.utcOffset(), n$1 = Math.abs(e$1), r$1 = Math.floor(n$1 / 60), i$1 = n$1 % 60;
				return (e$1 <= 0 ? "+" : "-") + m(r$1, 2, "0") + ":" + m(i$1, 2, "0");
			},
			m: function t$1(e$1, n$1) {
				if (e$1.date() < n$1.date()) return -t$1(n$1, e$1);
				var r$1 = 12 * (n$1.year() - e$1.year()) + (n$1.month() - e$1.month()), i$1 = e$1.clone().add(r$1, c), s$1 = n$1 - i$1 < 0, u$1 = e$1.clone().add(r$1 + (s$1 ? -1 : 1), c);
				return +(-(r$1 + (n$1 - i$1) / (s$1 ? i$1 - u$1 : u$1 - i$1)) || 0);
			},
			a: function(t$1) {
				return t$1 < 0 ? Math.ceil(t$1) || 0 : Math.floor(t$1);
			},
			p: function(t$1) {
				return {
					M: c,
					y: h,
					w: o,
					d: a,
					D: d,
					h: u,
					m: s,
					s: i,
					ms: r,
					Q: f
				}[t$1] || String(t$1 || "").toLowerCase().replace(/s$/, "");
			},
			u: function(t$1) {
				return void 0 === t$1;
			}
		}, g = "en", D = {};
		D[g] = M;
		var p = "$isDayjsObject", S = function(t$1) {
			return t$1 instanceof _ || !(!t$1 || !t$1[p]);
		}, w = function t$1(e$1, n$1, r$1) {
			var i$1;
			if (!e$1) return g;
			if ("string" == typeof e$1) {
				var s$1 = e$1.toLowerCase();
				D[s$1] && (i$1 = s$1), n$1 && (D[s$1] = n$1, i$1 = s$1);
				var u$1 = e$1.split("-");
				if (!i$1 && u$1.length > 1) return t$1(u$1[0]);
			} else {
				var a$1 = e$1.name;
				D[a$1] = e$1, i$1 = a$1;
			}
			return !r$1 && i$1 && (g = i$1), i$1 || !r$1 && g;
		}, O = function(t$1, e$1) {
			if (S(t$1)) return t$1.clone();
			var n$1 = "object" == typeof e$1 ? e$1 : {};
			return n$1.date = t$1, n$1.args = arguments, new _(n$1);
		}, b = v;
		b.l = w, b.i = S, b.w = function(t$1, e$1) {
			return O(t$1, {
				locale: e$1.$L,
				utc: e$1.$u,
				x: e$1.$x,
				$offset: e$1.$offset
			});
		};
		var _ = function() {
			function M$1(t$1) {
				this.$L = w(t$1.locale, null, !0), this.parse(t$1), this.$x = this.$x || t$1.x || {}, this[p] = !0;
			}
			var m$1 = M$1.prototype;
			return m$1.parse = function(t$1) {
				this.$d = function(t$2) {
					var e$1 = t$2.date, n$1 = t$2.utc;
					if (null === e$1) return /* @__PURE__ */ new Date(NaN);
					if (b.u(e$1)) return /* @__PURE__ */ new Date();
					if (e$1 instanceof Date) return new Date(e$1);
					if ("string" == typeof e$1 && !/Z$/i.test(e$1)) {
						var r$1 = e$1.match($);
						if (r$1) {
							var i$1 = r$1[2] - 1 || 0, s$1 = (r$1[7] || "0").substring(0, 3);
							return n$1 ? new Date(Date.UTC(r$1[1], i$1, r$1[3] || 1, r$1[4] || 0, r$1[5] || 0, r$1[6] || 0, s$1)) : new Date(r$1[1], i$1, r$1[3] || 1, r$1[4] || 0, r$1[5] || 0, r$1[6] || 0, s$1);
						}
					}
					return new Date(e$1);
				}(t$1), this.init();
			}, m$1.init = function() {
				var t$1 = this.$d;
				this.$y = t$1.getFullYear(), this.$M = t$1.getMonth(), this.$D = t$1.getDate(), this.$W = t$1.getDay(), this.$H = t$1.getHours(), this.$m = t$1.getMinutes(), this.$s = t$1.getSeconds(), this.$ms = t$1.getMilliseconds();
			}, m$1.$utils = function() {
				return b;
			}, m$1.isValid = function() {
				return !(this.$d.toString() === l);
			}, m$1.isSame = function(t$1, e$1) {
				var n$1 = O(t$1);
				return this.startOf(e$1) <= n$1 && n$1 <= this.endOf(e$1);
			}, m$1.isAfter = function(t$1, e$1) {
				return O(t$1) < this.startOf(e$1);
			}, m$1.isBefore = function(t$1, e$1) {
				return this.endOf(e$1) < O(t$1);
			}, m$1.$g = function(t$1, e$1, n$1) {
				return b.u(t$1) ? this[e$1] : this.set(n$1, t$1);
			}, m$1.unix = function() {
				return Math.floor(this.valueOf() / 1e3);
			}, m$1.valueOf = function() {
				return this.$d.getTime();
			}, m$1.startOf = function(t$1, e$1) {
				var n$1 = this, r$1 = !!b.u(e$1) || e$1, f$1 = b.p(t$1), l$1 = function(t$2, e$2) {
					var i$1 = b.w(n$1.$u ? Date.UTC(n$1.$y, e$2, t$2) : new Date(n$1.$y, e$2, t$2), n$1);
					return r$1 ? i$1 : i$1.endOf(a);
				}, $$1 = function(t$2, e$2) {
					return b.w(n$1.toDate()[t$2].apply(n$1.toDate("s"), (r$1 ? [
						0,
						0,
						0,
						0
					] : [
						23,
						59,
						59,
						999
					]).slice(e$2)), n$1);
				}, y$1 = this.$W, M$2 = this.$M, m$2 = this.$D, v$1 = "set" + (this.$u ? "UTC" : "");
				switch (f$1) {
					case h: return r$1 ? l$1(1, 0) : l$1(31, 11);
					case c: return r$1 ? l$1(1, M$2) : l$1(0, M$2 + 1);
					case o:
						var g$1 = this.$locale().weekStart || 0, D$1 = (y$1 < g$1 ? y$1 + 7 : y$1) - g$1;
						return l$1(r$1 ? m$2 - D$1 : m$2 + (6 - D$1), M$2);
					case a:
					case d: return $$1(v$1 + "Hours", 0);
					case u: return $$1(v$1 + "Minutes", 1);
					case s: return $$1(v$1 + "Seconds", 2);
					case i: return $$1(v$1 + "Milliseconds", 3);
					default: return this.clone();
				}
			}, m$1.endOf = function(t$1) {
				return this.startOf(t$1, !1);
			}, m$1.$set = function(t$1, e$1) {
				var n$1, o$1 = b.p(t$1), f$1 = "set" + (this.$u ? "UTC" : ""), l$1 = (n$1 = {}, n$1[a] = f$1 + "Date", n$1[d] = f$1 + "Date", n$1[c] = f$1 + "Month", n$1[h] = f$1 + "FullYear", n$1[u] = f$1 + "Hours", n$1[s] = f$1 + "Minutes", n$1[i] = f$1 + "Seconds", n$1[r] = f$1 + "Milliseconds", n$1)[o$1], $$1 = o$1 === a ? this.$D + (e$1 - this.$W) : e$1;
				if (o$1 === c || o$1 === h) {
					var y$1 = this.clone().set(d, 1);
					y$1.$d[l$1]($$1), y$1.init(), this.$d = y$1.set(d, Math.min(this.$D, y$1.daysInMonth())).$d;
				} else l$1 && this.$d[l$1]($$1);
				return this.init(), this;
			}, m$1.set = function(t$1, e$1) {
				return this.clone().$set(t$1, e$1);
			}, m$1.get = function(t$1) {
				return this[b.p(t$1)]();
			}, m$1.add = function(r$1, f$1) {
				var d$1, l$1 = this;
				r$1 = Number(r$1);
				var $$1 = b.p(f$1), y$1 = function(t$1) {
					var e$1 = O(l$1);
					return b.w(e$1.date(e$1.date() + Math.round(t$1 * r$1)), l$1);
				};
				if ($$1 === c) return this.set(c, this.$M + r$1);
				if ($$1 === h) return this.set(h, this.$y + r$1);
				if ($$1 === a) return y$1(1);
				if ($$1 === o) return y$1(7);
				var M$2 = (d$1 = {}, d$1[s] = e, d$1[u] = n, d$1[i] = t, d$1)[$$1] || 1, m$2 = this.$d.getTime() + r$1 * M$2;
				return b.w(m$2, this);
			}, m$1.subtract = function(t$1, e$1) {
				return this.add(-1 * t$1, e$1);
			}, m$1.format = function(t$1) {
				var e$1 = this, n$1 = this.$locale();
				if (!this.isValid()) return n$1.invalidDate || l;
				var r$1 = t$1 || "YYYY-MM-DDTHH:mm:ssZ", i$1 = b.z(this), s$1 = this.$H, u$1 = this.$m, a$1 = this.$M, o$1 = n$1.weekdays, c$1 = n$1.months, f$1 = n$1.meridiem, h$1 = function(t$2, n$2, i$2, s$2) {
					return t$2 && (t$2[n$2] || t$2(e$1, r$1)) || i$2[n$2].slice(0, s$2);
				}, d$1 = function(t$2) {
					return b.s(s$1 % 12 || 12, t$2, "0");
				}, $$1 = f$1 || function(t$2, e$2, n$2) {
					var r$2 = t$2 < 12 ? "AM" : "PM";
					return n$2 ? r$2.toLowerCase() : r$2;
				};
				return r$1.replace(y, (function(t$2, r$2) {
					return r$2 || function(t$3) {
						switch (t$3) {
							case "YY": return String(e$1.$y).slice(-2);
							case "YYYY": return b.s(e$1.$y, 4, "0");
							case "M": return a$1 + 1;
							case "MM": return b.s(a$1 + 1, 2, "0");
							case "MMM": return h$1(n$1.monthsShort, a$1, c$1, 3);
							case "MMMM": return h$1(c$1, a$1);
							case "D": return e$1.$D;
							case "DD": return b.s(e$1.$D, 2, "0");
							case "d": return String(e$1.$W);
							case "dd": return h$1(n$1.weekdaysMin, e$1.$W, o$1, 2);
							case "ddd": return h$1(n$1.weekdaysShort, e$1.$W, o$1, 3);
							case "dddd": return o$1[e$1.$W];
							case "H": return String(s$1);
							case "HH": return b.s(s$1, 2, "0");
							case "h": return d$1(1);
							case "hh": return d$1(2);
							case "a": return $$1(s$1, u$1, !0);
							case "A": return $$1(s$1, u$1, !1);
							case "m": return String(u$1);
							case "mm": return b.s(u$1, 2, "0");
							case "s": return String(e$1.$s);
							case "ss": return b.s(e$1.$s, 2, "0");
							case "SSS": return b.s(e$1.$ms, 3, "0");
							case "Z": return i$1;
						}
						return null;
					}(t$2) || i$1.replace(":", "");
				}));
			}, m$1.utcOffset = function() {
				return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
			}, m$1.diff = function(r$1, d$1, l$1) {
				var $$1, y$1 = this, M$2 = b.p(d$1), m$2 = O(r$1), v$1 = (m$2.utcOffset() - this.utcOffset()) * e, g$1 = this - m$2, D$1 = function() {
					return b.m(y$1, m$2);
				};
				switch (M$2) {
					case h:
						$$1 = D$1() / 12;
						break;
					case c:
						$$1 = D$1();
						break;
					case f:
						$$1 = D$1() / 3;
						break;
					case o:
						$$1 = (g$1 - v$1) / 6048e5;
						break;
					case a:
						$$1 = (g$1 - v$1) / 864e5;
						break;
					case u:
						$$1 = g$1 / n;
						break;
					case s:
						$$1 = g$1 / e;
						break;
					case i:
						$$1 = g$1 / t;
						break;
					default: $$1 = g$1;
				}
				return l$1 ? $$1 : b.a($$1);
			}, m$1.daysInMonth = function() {
				return this.endOf(c).$D;
			}, m$1.$locale = function() {
				return D[this.$L];
			}, m$1.locale = function(t$1, e$1) {
				if (!t$1) return this.$L;
				var n$1 = this.clone(), r$1 = w(t$1, e$1, !0);
				return r$1 && (n$1.$L = r$1), n$1;
			}, m$1.clone = function() {
				return b.w(this.$d, this);
			}, m$1.toDate = function() {
				return new Date(this.valueOf());
			}, m$1.toJSON = function() {
				return this.isValid() ? this.toISOString() : null;
			}, m$1.toISOString = function() {
				return this.$d.toISOString();
			}, m$1.toString = function() {
				return this.$d.toUTCString();
			}, M$1;
		}(), k = _.prototype;
		return O.prototype = k, [
			["$ms", r],
			["$s", i],
			["$m", s],
			["$H", u],
			["$W", a],
			["$M", c],
			["$y", h],
			["$D", d]
		].forEach((function(t$1) {
			k[t$1[1]] = function(e$1) {
				return this.$g(e$1, t$1[0], t$1[1]);
			};
		})), O.extend = function(t$1, e$1) {
			return t$1.$i || (t$1(e$1, _, O), t$1.$i = !0), O;
		}, O.locale = w, O.isDayjs = S, O.unix = function(t$1) {
			return O(1e3 * t$1);
		}, O.en = D[g], O.Ls = D, O.p = {}, O;
	}));
}));
var import_dayjs_min = /* @__PURE__ */ require_rolldown_runtime.__toESM(require_dayjs_min(), 1);
function buildSharedMessage(origin) {
	return `[shared:${origin}] ${(0, import_dayjs_min.default)().format("YYYY-MM-DD HH:mm:ss")}`;
}
Object.defineProperty(exports, "buildSharedMessage", {
	enumerable: true,
	get: function() {
		return buildSharedMessage;
	}
});
Object.defineProperty(exports, "require_dayjs_min", {
	enumerable: true,
	get: function() {
		return require_dayjs_min;
	}
});
