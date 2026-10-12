import { app as Tt, BrowserWindow as zn, ipcMain as Rt, dialog as Kt } from "electron";
import * as it from "path";
import * as ot from "fs";
import { fileURLToPath as ti } from "url";
import { createCanvas as Vn, clearAllCache as ni } from "@napi-rs/canvas";
function ii(c, q, k, S, l = 2) {
  const f = Math.max(1, Math.round(l)), a = Math.max(1, Math.round(l)), P = [], ee = [];
  for (let y = 0; y <= a; y++) {
    const H = y / a, V = q + S * H;
    for (let le = 0; le <= f; le++) {
      const ce = le / f, ie = c + k * ce;
      P.push([ie, V]), ee.push([ce, H]);
    }
  }
  const ye = [], O = f + 1;
  for (let y = 0; y < a; y++)
    for (let H = 0; H < f; H++) {
      const V = y * O + H, le = V + 1, ce = (y + 1) * O + H, ie = ce + 1;
      ye.push(V, le, ce), ye.push(le, ie, ce);
    }
  return { vertices: P, uvs: ee, indices: ye };
}
var ct = {}, $e = {}, jt = {}, et = {}, ft = {}, tt = {}, dt = {}, rn;
function oi() {
  if (rn) return dt;
  rn = 1;
  const c = 4, q = 0, k = 1, S = 2;
  function l(d) {
    let L = d.length;
    for (; --L >= 0; )
      d[L] = 0;
  }
  const f = 0, a = 1, P = 2, ee = 3, ye = 258, O = 29, y = 256, H = y + 1 + O, V = 30, le = 19, ce = 2 * H + 1, ie = 15, he = 16, fe = 7, ne = 256, B = 16, z = 17, C = 18, F = (
    /* extra bits for each length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
  ), N = (
    /* extra bits for each distance code */
    new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
  ), J = (
    /* extra bits for each bit length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
  ), W = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), n = 512, p = new Array((H + 2) * 2);
  l(p);
  const g = new Array(V * 2);
  l(g);
  const E = new Array(n);
  l(E);
  const G = new Array(ye - ee + 1);
  l(G);
  const M = new Array(O);
  l(M);
  const re = new Array(V);
  l(re);
  function Q(d, L, o, _, I) {
    this.static_tree = d, this.extra_bits = L, this.extra_base = o, this.elems = _, this.max_length = I, this.has_stree = d && d.length;
  }
  let se, me, te;
  function ve(d, L) {
    this.dyn_tree = d, this.max_code = 0, this.stat_desc = L;
  }
  const ue = (d) => d < 256 ? E[d] : E[256 + (d >>> 7)], Fe = (d, L) => {
    d.pending_buf[d.pending++] = L & 255, d.pending_buf[d.pending++] = L >>> 8 & 255;
  }, _e = (d, L, o) => {
    d.bi_valid > he - o ? (d.bi_buf |= L << d.bi_valid & 65535, Fe(d, d.bi_buf), d.bi_buf = L >> he - d.bi_valid, d.bi_valid += o - he) : (d.bi_buf |= L << d.bi_valid & 65535, d.bi_valid += o);
  }, Oe = (d, L, o) => {
    _e(
      d,
      o[L * 2],
      o[L * 2 + 1]
      /*.Len*/
    );
  }, Ie = (d, L) => {
    let o = 0;
    do
      o |= d & 1, d >>>= 1, o <<= 1;
    while (--L > 0);
    return o >>> 1;
  }, xe = (d) => {
    d.bi_valid === 16 ? (Fe(d, d.bi_buf), d.bi_buf = 0, d.bi_valid = 0) : d.bi_valid >= 8 && (d.pending_buf[d.pending++] = d.bi_buf & 255, d.bi_buf >>= 8, d.bi_valid -= 8);
  }, Ae = (d, L) => {
    const o = L.dyn_tree, _ = L.max_code, I = L.stat_desc.static_tree, x = L.stat_desc.has_stree, b = L.stat_desc.extra_bits, X = L.stat_desc.extra_base, u = L.stat_desc.max_length;
    let $, be, ge, Ce, De, Ne, s = 0;
    for (Ce = 0; Ce <= ie; Ce++)
      d.bl_count[Ce] = 0;
    for (o[d.heap[d.heap_max] * 2 + 1] = 0, $ = d.heap_max + 1; $ < ce; $++)
      be = d.heap[$], Ce = o[o[be * 2 + 1] * 2 + 1] + 1, Ce > u && (Ce = u, s++), o[be * 2 + 1] = Ce, !(be > _) && (d.bl_count[Ce]++, De = 0, be >= X && (De = b[be - X]), Ne = o[be * 2], d.opt_len += Ne * (Ce + De), x && (d.static_len += Ne * (I[be * 2 + 1] + De)));
    if (s !== 0) {
      do {
        for (Ce = u - 1; d.bl_count[Ce] === 0; )
          Ce--;
        d.bl_count[Ce]--, d.bl_count[Ce + 1] += 2, d.bl_count[u]--, s -= 2;
      } while (s > 0);
      for (Ce = u; Ce !== 0; Ce--)
        for (be = d.bl_count[Ce]; be !== 0; )
          ge = d.heap[--$], !(ge > _) && (o[ge * 2 + 1] !== Ce && (d.opt_len += (Ce - o[ge * 2 + 1]) * o[ge * 2], o[ge * 2 + 1] = Ce), be--);
    }
  }, ze = (d, L, o) => {
    const _ = new Array(ie + 1);
    let I = 0, x, b;
    for (x = 1; x <= ie; x++)
      I = I + o[x - 1] << 1, _[x] = I;
    for (b = 0; b <= L; b++) {
      let X = d[b * 2 + 1];
      X !== 0 && (d[b * 2] = Ie(_[X]++, X));
    }
  }, Pe = () => {
    let d, L, o, _, I;
    const x = new Array(ie + 1);
    for (o = 0, _ = 0; _ < O - 1; _++)
      for (M[_] = o, d = 0; d < 1 << F[_]; d++)
        G[o++] = _;
    for (G[o - 1] = _, I = 0, _ = 0; _ < 16; _++)
      for (re[_] = I, d = 0; d < 1 << N[_]; d++)
        E[I++] = _;
    for (I >>= 7; _ < V; _++)
      for (re[_] = I << 7, d = 0; d < 1 << N[_] - 7; d++)
        E[256 + I++] = _;
    for (L = 0; L <= ie; L++)
      x[L] = 0;
    for (d = 0; d <= 143; )
      p[d * 2 + 1] = 8, d++, x[8]++;
    for (; d <= 255; )
      p[d * 2 + 1] = 9, d++, x[9]++;
    for (; d <= 279; )
      p[d * 2 + 1] = 7, d++, x[7]++;
    for (; d <= 287; )
      p[d * 2 + 1] = 8, d++, x[8]++;
    for (ze(p, H + 1, x), d = 0; d < V; d++)
      g[d * 2 + 1] = 5, g[d * 2] = Ie(d, 5);
    se = new Q(p, F, y + 1, H, ie), me = new Q(g, N, 0, V, ie), te = new Q(new Array(0), J, 0, le, fe);
  }, Re = (d) => {
    let L;
    for (L = 0; L < H; L++)
      d.dyn_ltree[L * 2] = 0;
    for (L = 0; L < V; L++)
      d.dyn_dtree[L * 2] = 0;
    for (L = 0; L < le; L++)
      d.bl_tree[L * 2] = 0;
    d.dyn_ltree[ne * 2] = 1, d.opt_len = d.static_len = 0, d.sym_next = d.matches = 0;
  }, Ve = (d) => {
    d.bi_valid > 8 ? Fe(d, d.bi_buf) : d.bi_valid > 0 && (d.pending_buf[d.pending++] = d.bi_buf), d.bi_buf = 0, d.bi_valid = 0;
  }, Ge = (d, L, o, _) => {
    const I = L * 2, x = o * 2;
    return d[I] < d[x] || d[I] === d[x] && _[L] <= _[o];
  }, Be = (d, L, o) => {
    const _ = d.heap[o];
    let I = o << 1;
    for (; I <= d.heap_len && (I < d.heap_len && Ge(L, d.heap[I + 1], d.heap[I], d.depth) && I++, !Ge(L, _, d.heap[I], d.depth)); )
      d.heap[o] = d.heap[I], o = I, I <<= 1;
    d.heap[o] = _;
  }, v = (d, L, o) => {
    let _, I, x = 0, b, X;
    if (d.sym_next !== 0)
      do
        _ = d.pending_buf[d.sym_buf + x++] & 255, _ += (d.pending_buf[d.sym_buf + x++] & 255) << 8, I = d.pending_buf[d.sym_buf + x++], _ === 0 ? Oe(d, I, L) : (b = G[I], Oe(d, b + y + 1, L), X = F[b], X !== 0 && (I -= M[b], _e(d, I, X)), _--, b = ue(_), Oe(d, b, o), X = N[b], X !== 0 && (_ -= re[b], _e(d, _, X)));
      while (x < d.sym_next);
    Oe(d, ne, L);
  }, A = (d, L) => {
    const o = L.dyn_tree, _ = L.stat_desc.static_tree, I = L.stat_desc.has_stree, x = L.stat_desc.elems;
    let b, X, u = -1, $;
    for (d.heap_len = 0, d.heap_max = ce, b = 0; b < x; b++)
      o[b * 2] !== 0 ? (d.heap[++d.heap_len] = u = b, d.depth[b] = 0) : o[b * 2 + 1] = 0;
    for (; d.heap_len < 2; )
      $ = d.heap[++d.heap_len] = u < 2 ? ++u : 0, o[$ * 2] = 1, d.depth[$] = 0, d.opt_len--, I && (d.static_len -= _[$ * 2 + 1]);
    for (L.max_code = u, b = d.heap_len >> 1; b >= 1; b--)
      Be(d, o, b);
    $ = x;
    do
      b = d.heap[
        1
        /*SMALLEST*/
      ], d.heap[
        1
        /*SMALLEST*/
      ] = d.heap[d.heap_len--], Be(
        d,
        o,
        1
        /*SMALLEST*/
      ), X = d.heap[
        1
        /*SMALLEST*/
      ], d.heap[--d.heap_max] = b, d.heap[--d.heap_max] = X, o[$ * 2] = o[b * 2] + o[X * 2], d.depth[$] = (d.depth[b] >= d.depth[X] ? d.depth[b] : d.depth[X]) + 1, o[b * 2 + 1] = o[X * 2 + 1] = $, d.heap[
        1
        /*SMALLEST*/
      ] = $++, Be(
        d,
        o,
        1
        /*SMALLEST*/
      );
    while (d.heap_len >= 2);
    d.heap[--d.heap_max] = d.heap[
      1
      /*SMALLEST*/
    ], Ae(d, L), ze(o, u, d.bl_count);
  }, Y = (d, L, o) => {
    let _, I = -1, x, b = L[1], X = 0, u = 7, $ = 4;
    for (b === 0 && (u = 138, $ = 3), L[(o + 1) * 2 + 1] = 65535, _ = 0; _ <= o; _++)
      x = b, b = L[(_ + 1) * 2 + 1], !(++X < u && x === b) && (X < $ ? d.bl_tree[x * 2] += X : x !== 0 ? (x !== I && d.bl_tree[x * 2]++, d.bl_tree[B * 2]++) : X <= 10 ? d.bl_tree[z * 2]++ : d.bl_tree[C * 2]++, X = 0, I = x, b === 0 ? (u = 138, $ = 3) : x === b ? (u = 6, $ = 3) : (u = 7, $ = 4));
  }, de = (d, L, o) => {
    let _, I = -1, x, b = L[1], X = 0, u = 7, $ = 4;
    for (b === 0 && (u = 138, $ = 3), _ = 0; _ <= o; _++)
      if (x = b, b = L[(_ + 1) * 2 + 1], !(++X < u && x === b)) {
        if (X < $)
          do
            Oe(d, x, d.bl_tree);
          while (--X !== 0);
        else x !== 0 ? (x !== I && (Oe(d, x, d.bl_tree), X--), Oe(d, B, d.bl_tree), _e(d, X - 3, 2)) : X <= 10 ? (Oe(d, z, d.bl_tree), _e(d, X - 3, 3)) : (Oe(d, C, d.bl_tree), _e(d, X - 11, 7));
        X = 0, I = x, b === 0 ? (u = 138, $ = 3) : x === b ? (u = 6, $ = 3) : (u = 7, $ = 4);
      }
  }, pe = (d) => {
    let L;
    for (Y(d, d.dyn_ltree, d.l_desc.max_code), Y(d, d.dyn_dtree, d.d_desc.max_code), A(d, d.bl_desc), L = le - 1; L >= 3 && d.bl_tree[W[L] * 2 + 1] === 0; L--)
      ;
    return d.opt_len += 3 * (L + 1) + 5 + 5 + 4, L;
  }, oe = (d, L, o, _) => {
    let I;
    for (_e(d, L - 257, 5), _e(d, o - 1, 5), _e(d, _ - 4, 4), I = 0; I < _; I++)
      _e(d, d.bl_tree[W[I] * 2 + 1], 3);
    de(d, d.dyn_ltree, L - 1), de(d, d.dyn_dtree, o - 1);
  }, e = (d) => {
    let L = 4093624447, o;
    for (o = 0; o <= 31; o++, L >>>= 1)
      if (L & 1 && d.dyn_ltree[o * 2] !== 0)
        return q;
    if (d.dyn_ltree[18] !== 0 || d.dyn_ltree[20] !== 0 || d.dyn_ltree[26] !== 0)
      return k;
    for (o = 32; o < y; o++)
      if (d.dyn_ltree[o * 2] !== 0)
        return k;
    return q;
  };
  let i = !1;
  const r = (d) => {
    i || (Pe(), i = !0), d.l_desc = new ve(d.dyn_ltree, se), d.d_desc = new ve(d.dyn_dtree, me), d.bl_desc = new ve(d.bl_tree, te), d.bi_buf = 0, d.bi_valid = 0, Re(d);
  }, h = (d, L, o, _) => {
    _e(d, (f << 1) + (_ ? 1 : 0), 3), Ve(d), Fe(d, o), Fe(d, ~o), o && d.pending_buf.set(d.window.subarray(L, L + o), d.pending), d.pending += o;
  }, w = (d) => {
    _e(d, a << 1, 3), Oe(d, ne, p), xe(d);
  }, U = (d, L, o, _) => {
    let I, x, b = 0;
    d.level > 0 ? (d.strm.data_type === S && (d.strm.data_type = e(d)), A(d, d.l_desc), A(d, d.d_desc), b = pe(d), I = d.opt_len + 3 + 7 >>> 3, x = d.static_len + 3 + 7 >>> 3, x <= I && (I = x)) : I = x = o + 5, o + 4 <= I && L !== -1 ? h(d, L, o, _) : d.strategy === c || x === I ? (_e(d, (a << 1) + (_ ? 1 : 0), 3), v(d, p, g)) : (_e(d, (P << 1) + (_ ? 1 : 0), 3), oe(d, d.l_desc.max_code + 1, d.d_desc.max_code + 1, b + 1), v(d, d.dyn_ltree, d.dyn_dtree)), Re(d), _ && Ve(d);
  }, Z = (d, L, o) => (d.pending_buf[d.sym_buf + d.sym_next++] = L, d.pending_buf[d.sym_buf + d.sym_next++] = L >> 8, d.pending_buf[d.sym_buf + d.sym_next++] = o, L === 0 ? d.dyn_ltree[o * 2]++ : (d.matches++, L--, d.dyn_ltree[(G[o] + y + 1) * 2]++, d.dyn_dtree[ue(L) * 2]++), d.sym_next === d.sym_end);
  return dt._tr_init = r, dt._tr_stored_block = h, dt._tr_flush_block = U, dt._tr_tally = Z, dt._tr_align = w, dt;
}
var zt, sn;
function Nn() {
  return sn || (sn = 1, zt = (q, k, S, l) => {
    let f = q & 65535 | 0, a = q >>> 16 & 65535 | 0, P = 0;
    for (; S !== 0; ) {
      P = S > 2e3 ? 2e3 : S, S -= P;
      do
        f = f + k[l++] | 0, a = a + f | 0;
      while (--P);
      f %= 65521, a %= 65521;
    }
    return f | a << 16 | 0;
  }), zt;
}
var Vt, an;
function Gn() {
  if (an) return Vt;
  an = 1;
  const c = () => {
    let S, l = [];
    for (var f = 0; f < 256; f++) {
      S = f;
      for (var a = 0; a < 8; a++)
        S = S & 1 ? 3988292384 ^ S >>> 1 : S >>> 1;
      l[f] = S;
    }
    return l;
  }, q = new Uint32Array(c());
  return Vt = (S, l, f, a) => {
    const P = q, ee = a + f;
    S ^= -1;
    for (let ye = a; ye < ee; ye++)
      S = S >>> 8 ^ P[(S ^ l[ye]) & 255];
    return S ^ -1;
  }, Vt;
}
var Nt, ln;
function Yt() {
  return ln || (ln = 1, Nt = {
    2: "need dictionary",
    /* Z_NEED_DICT       2  */
    1: "stream end",
    /* Z_STREAM_END      1  */
    0: "",
    /* Z_OK              0  */
    "-1": "file error",
    /* Z_ERRNO         (-1) */
    "-2": "stream error",
    /* Z_STREAM_ERROR  (-2) */
    "-3": "data error",
    /* Z_DATA_ERROR    (-3) */
    "-4": "insufficient memory",
    /* Z_MEM_ERROR     (-4) */
    "-5": "buffer error",
    /* Z_BUF_ERROR     (-5) */
    "-6": "incompatible version"
    /* Z_VERSION_ERROR (-6) */
  }), Nt;
}
var Gt, cn;
function gt() {
  return cn || (cn = 1, Gt = {
    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    //Z_VERSION_ERROR: -6,
    /* compression levels */
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY: 0,
    Z_TEXT: 1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN: 2,
    /* The deflate compression method */
    Z_DEFLATED: 8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
  }), Gt;
}
var fn;
function ri() {
  if (fn) return tt;
  fn = 1;
  const { _tr_init: c, _tr_stored_block: q, _tr_flush_block: k, _tr_tally: S, _tr_align: l } = oi(), f = Nn(), a = Gn(), P = Yt(), {
    Z_NO_FLUSH: ee,
    Z_PARTIAL_FLUSH: ye,
    Z_FULL_FLUSH: O,
    Z_FINISH: y,
    Z_BLOCK: H,
    Z_OK: V,
    Z_STREAM_END: le,
    Z_STREAM_ERROR: ce,
    Z_DATA_ERROR: ie,
    Z_BUF_ERROR: he,
    Z_DEFAULT_COMPRESSION: fe,
    Z_FILTERED: ne,
    Z_HUFFMAN_ONLY: B,
    Z_RLE: z,
    Z_FIXED: C,
    Z_DEFAULT_STRATEGY: F,
    Z_UNKNOWN: N,
    Z_DEFLATED: J
  } = gt(), W = 9, n = 15, p = 8, G = 256 + 1 + 29, M = 30, re = 19, Q = 2 * G + 1, se = 15, me = 3, te = 258, ve = te + me + 1, ue = 32, Fe = 42, _e = 57, Oe = 69, Ie = 73, xe = 91, Ae = 103, ze = 113, Pe = 666, Re = 1, Ve = 2, Ge = 3, Be = 4, v = 3, A = (t, T) => (t.msg = P[T], T), Y = (t) => t * 2 - (t > 4 ? 9 : 0), de = (t) => {
    let T = t.length;
    for (; --T >= 0; )
      t[T] = 0;
  }, pe = (t) => {
    let T, m, j, R = t.w_size;
    T = t.hash_size, j = T;
    do
      m = t.head[--j], t.head[j] = m >= R ? m - R : 0;
    while (--T);
    T = R, j = T;
    do
      m = t.prev[--j], t.prev[j] = m >= R ? m - R : 0;
    while (--T);
  };
  let e = (t, T, m) => (T << t.hash_shift ^ m) & t.hash_mask;
  const i = (t) => {
    const T = t.state;
    let m = T.pending;
    m > t.avail_out && (m = t.avail_out), m !== 0 && (t.output.set(T.pending_buf.subarray(T.pending_out, T.pending_out + m), t.next_out), t.next_out += m, T.pending_out += m, t.total_out += m, t.avail_out -= m, T.pending -= m, T.pending === 0 && (T.pending_out = 0));
  }, r = (t, T) => {
    k(t, t.block_start >= 0 ? t.block_start : -1, t.strstart - t.block_start, T), t.block_start = t.strstart, i(t.strm);
  }, h = (t, T) => {
    t.pending_buf[t.pending++] = T;
  }, w = (t, T) => {
    t.pending_buf[t.pending++] = T >>> 8 & 255, t.pending_buf[t.pending++] = T & 255;
  }, U = (t, T, m, j) => {
    let R = t.avail_in;
    return R > j && (R = j), R === 0 ? 0 : (t.avail_in -= R, T.set(t.input.subarray(t.next_in, t.next_in + R), m), t.state.wrap === 1 ? t.adler = f(t.adler, T, R, m) : t.state.wrap === 2 && (t.adler = a(t.adler, T, R, m)), t.next_in += R, t.total_in += R, R);
  }, Z = (t, T) => {
    let m = t.max_chain_length, j = t.strstart, R, we, ke = t.prev_length, Se = t.nice_match;
    const Ee = t.strstart > t.w_size - ve ? t.strstart - (t.w_size - ve) : 0, Ue = t.window, Le = t.w_mask, He = t.prev, Me = t.strstart + te;
    let je = Ue[j + ke - 1], Te = Ue[j + ke];
    t.prev_length >= t.good_match && (m >>= 2), Se > t.lookahead && (Se = t.lookahead);
    do
      if (R = T, !(Ue[R + ke] !== Te || Ue[R + ke - 1] !== je || Ue[R] !== Ue[j] || Ue[++R] !== Ue[j + 1])) {
        j += 2, R++;
        do
          ;
        while (Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && Ue[++j] === Ue[++R] && j < Me);
        if (we = te - (Me - j), j = Me - te, we > ke) {
          if (t.match_start = T, ke = we, we >= Se)
            break;
          je = Ue[j + ke - 1], Te = Ue[j + ke];
        }
      }
    while ((T = He[T & Le]) > Ee && --m !== 0);
    return ke <= t.lookahead ? ke : t.lookahead;
  }, d = (t) => {
    const T = t.w_size;
    let m, j, R;
    do {
      if (j = t.window_size - t.lookahead - t.strstart, t.strstart >= T + (T - ve) && (t.window.set(t.window.subarray(T, T + T - j), 0), t.match_start -= T, t.strstart -= T, t.block_start -= T, t.insert > t.strstart && (t.insert = t.strstart), pe(t), j += T), t.strm.avail_in === 0)
        break;
      if (m = U(t.strm, t.window, t.strstart + t.lookahead, j), t.lookahead += m, t.lookahead + t.insert >= me)
        for (R = t.strstart - t.insert, t.ins_h = t.window[R], t.ins_h = e(t, t.ins_h, t.window[R + 1]); t.insert && (t.ins_h = e(t, t.ins_h, t.window[R + me - 1]), t.prev[R & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = R, R++, t.insert--, !(t.lookahead + t.insert < me)); )
          ;
    } while (t.lookahead < ve && t.strm.avail_in !== 0);
  }, L = (t, T) => {
    let m = t.pending_buf_size - 5 > t.w_size ? t.w_size : t.pending_buf_size - 5, j, R, we, ke = 0, Se = t.strm.avail_in;
    do {
      if (j = 65535, we = t.bi_valid + 42 >> 3, t.strm.avail_out < we || (we = t.strm.avail_out - we, R = t.strstart - t.block_start, j > R + t.strm.avail_in && (j = R + t.strm.avail_in), j > we && (j = we), j < m && (j === 0 && T !== y || T === ee || j !== R + t.strm.avail_in)))
        break;
      ke = T === y && j === R + t.strm.avail_in ? 1 : 0, q(t, 0, 0, ke), t.pending_buf[t.pending - 4] = j, t.pending_buf[t.pending - 3] = j >> 8, t.pending_buf[t.pending - 2] = ~j, t.pending_buf[t.pending - 1] = ~j >> 8, i(t.strm), R && (R > j && (R = j), t.strm.output.set(t.window.subarray(t.block_start, t.block_start + R), t.strm.next_out), t.strm.next_out += R, t.strm.avail_out -= R, t.strm.total_out += R, t.block_start += R, j -= R), j && (U(t.strm, t.strm.output, t.strm.next_out, j), t.strm.next_out += j, t.strm.avail_out -= j, t.strm.total_out += j);
    } while (ke === 0);
    return Se -= t.strm.avail_in, Se && (Se >= t.w_size ? (t.matches = 2, t.window.set(t.strm.input.subarray(t.strm.next_in - t.w_size, t.strm.next_in), 0), t.strstart = t.w_size, t.insert = t.strstart) : (t.window_size - t.strstart <= Se && (t.strstart -= t.w_size, t.window.set(t.window.subarray(t.w_size, t.w_size + t.strstart), 0), t.matches < 2 && t.matches++, t.insert > t.strstart && (t.insert = t.strstart)), t.window.set(t.strm.input.subarray(t.strm.next_in - Se, t.strm.next_in), t.strstart), t.strstart += Se, t.insert += Se > t.w_size - t.insert ? t.w_size - t.insert : Se), t.block_start = t.strstart), t.high_water < t.strstart && (t.high_water = t.strstart), ke ? Be : T !== ee && T !== y && t.strm.avail_in === 0 && t.strstart === t.block_start ? Ve : (we = t.window_size - t.strstart, t.strm.avail_in > we && t.block_start >= t.w_size && (t.block_start -= t.w_size, t.strstart -= t.w_size, t.window.set(t.window.subarray(t.w_size, t.w_size + t.strstart), 0), t.matches < 2 && t.matches++, we += t.w_size, t.insert > t.strstart && (t.insert = t.strstart)), we > t.strm.avail_in && (we = t.strm.avail_in), we && (U(t.strm, t.window, t.strstart, we), t.strstart += we, t.insert += we > t.w_size - t.insert ? t.w_size - t.insert : we), t.high_water < t.strstart && (t.high_water = t.strstart), we = t.bi_valid + 42 >> 3, we = t.pending_buf_size - we > 65535 ? 65535 : t.pending_buf_size - we, m = we > t.w_size ? t.w_size : we, R = t.strstart - t.block_start, (R >= m || (R || T === y) && T !== ee && t.strm.avail_in === 0 && R <= we) && (j = R > we ? we : R, ke = T === y && t.strm.avail_in === 0 && j === R ? 1 : 0, q(t, t.block_start, j, ke), t.block_start += j, i(t.strm)), ke ? Ge : Re);
  }, o = (t, T) => {
    let m, j;
    for (; ; ) {
      if (t.lookahead < ve) {
        if (d(t), t.lookahead < ve && T === ee)
          return Re;
        if (t.lookahead === 0)
          break;
      }
      if (m = 0, t.lookahead >= me && (t.ins_h = e(t, t.ins_h, t.window[t.strstart + me - 1]), m = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart), m !== 0 && t.strstart - m <= t.w_size - ve && (t.match_length = Z(t, m)), t.match_length >= me)
        if (j = S(t, t.strstart - t.match_start, t.match_length - me), t.lookahead -= t.match_length, t.match_length <= t.max_lazy_match && t.lookahead >= me) {
          t.match_length--;
          do
            t.strstart++, t.ins_h = e(t, t.ins_h, t.window[t.strstart + me - 1]), m = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart;
          while (--t.match_length !== 0);
          t.strstart++;
        } else
          t.strstart += t.match_length, t.match_length = 0, t.ins_h = t.window[t.strstart], t.ins_h = e(t, t.ins_h, t.window[t.strstart + 1]);
      else
        j = S(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++;
      if (j && (r(t, !1), t.strm.avail_out === 0))
        return Re;
    }
    return t.insert = t.strstart < me - 1 ? t.strstart : me - 1, T === y ? (r(t, !0), t.strm.avail_out === 0 ? Ge : Be) : t.sym_next && (r(t, !1), t.strm.avail_out === 0) ? Re : Ve;
  }, _ = (t, T) => {
    let m, j, R;
    for (; ; ) {
      if (t.lookahead < ve) {
        if (d(t), t.lookahead < ve && T === ee)
          return Re;
        if (t.lookahead === 0)
          break;
      }
      if (m = 0, t.lookahead >= me && (t.ins_h = e(t, t.ins_h, t.window[t.strstart + me - 1]), m = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart), t.prev_length = t.match_length, t.prev_match = t.match_start, t.match_length = me - 1, m !== 0 && t.prev_length < t.max_lazy_match && t.strstart - m <= t.w_size - ve && (t.match_length = Z(t, m), t.match_length <= 5 && (t.strategy === ne || t.match_length === me && t.strstart - t.match_start > 4096) && (t.match_length = me - 1)), t.prev_length >= me && t.match_length <= t.prev_length) {
        R = t.strstart + t.lookahead - me, j = S(t, t.strstart - 1 - t.prev_match, t.prev_length - me), t.lookahead -= t.prev_length - 1, t.prev_length -= 2;
        do
          ++t.strstart <= R && (t.ins_h = e(t, t.ins_h, t.window[t.strstart + me - 1]), m = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart);
        while (--t.prev_length !== 0);
        if (t.match_available = 0, t.match_length = me - 1, t.strstart++, j && (r(t, !1), t.strm.avail_out === 0))
          return Re;
      } else if (t.match_available) {
        if (j = S(t, 0, t.window[t.strstart - 1]), j && r(t, !1), t.strstart++, t.lookahead--, t.strm.avail_out === 0)
          return Re;
      } else
        t.match_available = 1, t.strstart++, t.lookahead--;
    }
    return t.match_available && (j = S(t, 0, t.window[t.strstart - 1]), t.match_available = 0), t.insert = t.strstart < me - 1 ? t.strstart : me - 1, T === y ? (r(t, !0), t.strm.avail_out === 0 ? Ge : Be) : t.sym_next && (r(t, !1), t.strm.avail_out === 0) ? Re : Ve;
  }, I = (t, T) => {
    let m, j, R, we;
    const ke = t.window;
    for (; ; ) {
      if (t.lookahead <= te) {
        if (d(t), t.lookahead <= te && T === ee)
          return Re;
        if (t.lookahead === 0)
          break;
      }
      if (t.match_length = 0, t.lookahead >= me && t.strstart > 0 && (R = t.strstart - 1, j = ke[R], j === ke[++R] && j === ke[++R] && j === ke[++R])) {
        we = t.strstart + te;
        do
          ;
        while (j === ke[++R] && j === ke[++R] && j === ke[++R] && j === ke[++R] && j === ke[++R] && j === ke[++R] && j === ke[++R] && j === ke[++R] && R < we);
        t.match_length = te - (we - R), t.match_length > t.lookahead && (t.match_length = t.lookahead);
      }
      if (t.match_length >= me ? (m = S(t, 1, t.match_length - me), t.lookahead -= t.match_length, t.strstart += t.match_length, t.match_length = 0) : (m = S(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++), m && (r(t, !1), t.strm.avail_out === 0))
        return Re;
    }
    return t.insert = 0, T === y ? (r(t, !0), t.strm.avail_out === 0 ? Ge : Be) : t.sym_next && (r(t, !1), t.strm.avail_out === 0) ? Re : Ve;
  }, x = (t, T) => {
    let m;
    for (; ; ) {
      if (t.lookahead === 0 && (d(t), t.lookahead === 0)) {
        if (T === ee)
          return Re;
        break;
      }
      if (t.match_length = 0, m = S(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++, m && (r(t, !1), t.strm.avail_out === 0))
        return Re;
    }
    return t.insert = 0, T === y ? (r(t, !0), t.strm.avail_out === 0 ? Ge : Be) : t.sym_next && (r(t, !1), t.strm.avail_out === 0) ? Re : Ve;
  };
  function b(t, T, m, j, R) {
    this.good_length = t, this.max_lazy = T, this.nice_length = m, this.max_chain = j, this.func = R;
  }
  const X = [
    /*      good lazy nice chain */
    new b(0, 0, 0, 0, L),
    /* 0 store only */
    new b(4, 4, 8, 4, o),
    /* 1 max speed, no lazy matches */
    new b(4, 5, 16, 8, o),
    /* 2 */
    new b(4, 6, 32, 32, o),
    /* 3 */
    new b(4, 4, 16, 16, _),
    /* 4 lazy matches */
    new b(8, 16, 32, 32, _),
    /* 5 */
    new b(8, 16, 128, 128, _),
    /* 6 */
    new b(8, 32, 128, 256, _),
    /* 7 */
    new b(32, 128, 258, 1024, _),
    /* 8 */
    new b(32, 258, 258, 4096, _)
    /* 9 max compression */
  ], u = (t) => {
    t.window_size = 2 * t.w_size, de(t.head), t.max_lazy_match = X[t.level].max_lazy, t.good_match = X[t.level].good_length, t.nice_match = X[t.level].nice_length, t.max_chain_length = X[t.level].max_chain, t.strstart = 0, t.block_start = 0, t.lookahead = 0, t.insert = 0, t.match_length = t.prev_length = me - 1, t.match_available = 0, t.ins_h = 0;
  };
  function $() {
    this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = J, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Uint16Array(Q * 2), this.dyn_dtree = new Uint16Array((2 * M + 1) * 2), this.bl_tree = new Uint16Array((2 * re + 1) * 2), de(this.dyn_ltree), de(this.dyn_dtree), de(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new Uint16Array(se + 1), this.heap = new Uint16Array(2 * G + 1), de(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new Uint16Array(2 * G + 1), de(this.depth), this.sym_buf = 0, this.lit_bufsize = 0, this.sym_next = 0, this.sym_end = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
  }
  const be = (t) => {
    if (!t)
      return 1;
    const T = t.state;
    return !T || T.strm !== t || T.status !== Fe && //#ifdef GZIP
    T.status !== _e && //#endif
    T.status !== Oe && T.status !== Ie && T.status !== xe && T.status !== Ae && T.status !== ze && T.status !== Pe ? 1 : 0;
  }, ge = (t) => {
    if (be(t))
      return A(t, ce);
    t.total_in = t.total_out = 0, t.data_type = N;
    const T = t.state;
    return T.pending = 0, T.pending_out = 0, T.wrap < 0 && (T.wrap = -T.wrap), T.status = //#ifdef GZIP
    T.wrap === 2 ? _e : (
      //#endif
      T.wrap ? Fe : ze
    ), t.adler = T.wrap === 2 ? 0 : 1, T.last_flush = -2, c(T), V;
  }, Ce = (t) => {
    const T = ge(t);
    return T === V && u(t.state), T;
  }, De = (t, T) => be(t) || t.state.wrap !== 2 ? ce : (t.state.gzhead = T, V), Ne = (t, T, m, j, R, we) => {
    if (!t)
      return ce;
    let ke = 1;
    if (T === fe && (T = 6), j < 0 ? (ke = 0, j = -j) : j > 15 && (ke = 2, j -= 16), R < 1 || R > W || m !== J || j < 8 || j > 15 || T < 0 || T > 9 || we < 0 || we > C || j === 8 && ke !== 1)
      return A(t, ce);
    j === 8 && (j = 9);
    const Se = new $();
    return t.state = Se, Se.strm = t, Se.status = Fe, Se.wrap = ke, Se.gzhead = null, Se.w_bits = j, Se.w_size = 1 << Se.w_bits, Se.w_mask = Se.w_size - 1, Se.hash_bits = R + 7, Se.hash_size = 1 << Se.hash_bits, Se.hash_mask = Se.hash_size - 1, Se.hash_shift = ~~((Se.hash_bits + me - 1) / me), Se.window = new Uint8Array(Se.w_size * 2), Se.head = new Uint16Array(Se.hash_size), Se.prev = new Uint16Array(Se.w_size), Se.lit_bufsize = 1 << R + 6, Se.pending_buf_size = Se.lit_bufsize * 4, Se.pending_buf = new Uint8Array(Se.pending_buf_size), Se.sym_buf = Se.lit_bufsize, Se.sym_end = (Se.lit_bufsize - 1) * 3, Se.level = T, Se.strategy = we, Se.method = m, Ce(t);
  }, s = (t, T) => Ne(t, T, J, n, p, F), D = (t, T) => {
    if (be(t) || T > H || T < 0)
      return t ? A(t, ce) : ce;
    const m = t.state;
    if (!t.output || t.avail_in !== 0 && !t.input || m.status === Pe && T !== y)
      return A(t, t.avail_out === 0 ? he : ce);
    const j = m.last_flush;
    if (m.last_flush = T, m.pending !== 0) {
      if (i(t), t.avail_out === 0)
        return m.last_flush = -1, V;
    } else if (t.avail_in === 0 && Y(T) <= Y(j) && T !== y)
      return A(t, he);
    if (m.status === Pe && t.avail_in !== 0)
      return A(t, he);
    if (m.status === Fe && m.wrap === 0 && (m.status = ze), m.status === Fe) {
      let R = J + (m.w_bits - 8 << 4) << 8, we = -1;
      if (m.strategy >= B || m.level < 2 ? we = 0 : m.level < 6 ? we = 1 : m.level === 6 ? we = 2 : we = 3, R |= we << 6, m.strstart !== 0 && (R |= ue), R += 31 - R % 31, w(m, R), m.strstart !== 0 && (w(m, t.adler >>> 16), w(m, t.adler & 65535)), t.adler = 1, m.status = ze, i(t), m.pending !== 0)
        return m.last_flush = -1, V;
    }
    if (m.status === _e) {
      if (t.adler = 0, h(m, 31), h(m, 139), h(m, 8), m.gzhead)
        h(
          m,
          (m.gzhead.text ? 1 : 0) + (m.gzhead.hcrc ? 2 : 0) + (m.gzhead.extra ? 4 : 0) + (m.gzhead.name ? 8 : 0) + (m.gzhead.comment ? 16 : 0)
        ), h(m, m.gzhead.time & 255), h(m, m.gzhead.time >> 8 & 255), h(m, m.gzhead.time >> 16 & 255), h(m, m.gzhead.time >> 24 & 255), h(m, m.level === 9 ? 2 : m.strategy >= B || m.level < 2 ? 4 : 0), h(m, m.gzhead.os & 255), m.gzhead.extra && m.gzhead.extra.length && (h(m, m.gzhead.extra.length & 255), h(m, m.gzhead.extra.length >> 8 & 255)), m.gzhead.hcrc && (t.adler = a(t.adler, m.pending_buf, m.pending, 0)), m.gzindex = 0, m.status = Oe;
      else if (h(m, 0), h(m, 0), h(m, 0), h(m, 0), h(m, 0), h(m, m.level === 9 ? 2 : m.strategy >= B || m.level < 2 ? 4 : 0), h(m, v), m.status = ze, i(t), m.pending !== 0)
        return m.last_flush = -1, V;
    }
    if (m.status === Oe) {
      if (m.gzhead.extra) {
        let R = m.pending, we = (m.gzhead.extra.length & 65535) - m.gzindex;
        for (; m.pending + we > m.pending_buf_size; ) {
          let Se = m.pending_buf_size - m.pending;
          if (m.pending_buf.set(m.gzhead.extra.subarray(m.gzindex, m.gzindex + Se), m.pending), m.pending = m.pending_buf_size, m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R)), m.gzindex += Se, i(t), m.pending !== 0)
            return m.last_flush = -1, V;
          R = 0, we -= Se;
        }
        let ke = new Uint8Array(m.gzhead.extra);
        m.pending_buf.set(ke.subarray(m.gzindex, m.gzindex + we), m.pending), m.pending += we, m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R)), m.gzindex = 0;
      }
      m.status = Ie;
    }
    if (m.status === Ie) {
      if (m.gzhead.name) {
        let R = m.pending, we;
        do {
          if (m.pending === m.pending_buf_size) {
            if (m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R)), i(t), m.pending !== 0)
              return m.last_flush = -1, V;
            R = 0;
          }
          m.gzindex < m.gzhead.name.length ? we = m.gzhead.name.charCodeAt(m.gzindex++) & 255 : we = 0, h(m, we);
        } while (we !== 0);
        m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R)), m.gzindex = 0;
      }
      m.status = xe;
    }
    if (m.status === xe) {
      if (m.gzhead.comment) {
        let R = m.pending, we;
        do {
          if (m.pending === m.pending_buf_size) {
            if (m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R)), i(t), m.pending !== 0)
              return m.last_flush = -1, V;
            R = 0;
          }
          m.gzindex < m.gzhead.comment.length ? we = m.gzhead.comment.charCodeAt(m.gzindex++) & 255 : we = 0, h(m, we);
        } while (we !== 0);
        m.gzhead.hcrc && m.pending > R && (t.adler = a(t.adler, m.pending_buf, m.pending - R, R));
      }
      m.status = Ae;
    }
    if (m.status === Ae) {
      if (m.gzhead.hcrc) {
        if (m.pending + 2 > m.pending_buf_size && (i(t), m.pending !== 0))
          return m.last_flush = -1, V;
        h(m, t.adler & 255), h(m, t.adler >> 8 & 255), t.adler = 0;
      }
      if (m.status = ze, i(t), m.pending !== 0)
        return m.last_flush = -1, V;
    }
    if (t.avail_in !== 0 || m.lookahead !== 0 || T !== ee && m.status !== Pe) {
      let R = m.level === 0 ? L(m, T) : m.strategy === B ? x(m, T) : m.strategy === z ? I(m, T) : X[m.level].func(m, T);
      if ((R === Ge || R === Be) && (m.status = Pe), R === Re || R === Ge)
        return t.avail_out === 0 && (m.last_flush = -1), V;
      if (R === Ve && (T === ye ? l(m) : T !== H && (q(m, 0, 0, !1), T === O && (de(m.head), m.lookahead === 0 && (m.strstart = 0, m.block_start = 0, m.insert = 0))), i(t), t.avail_out === 0))
        return m.last_flush = -1, V;
    }
    return T !== y ? V : m.wrap <= 0 ? le : (m.wrap === 2 ? (h(m, t.adler & 255), h(m, t.adler >> 8 & 255), h(m, t.adler >> 16 & 255), h(m, t.adler >> 24 & 255), h(m, t.total_in & 255), h(m, t.total_in >> 8 & 255), h(m, t.total_in >> 16 & 255), h(m, t.total_in >> 24 & 255)) : (w(m, t.adler >>> 16), w(m, t.adler & 65535)), i(t), m.wrap > 0 && (m.wrap = -m.wrap), m.pending !== 0 ? V : le);
  }, ae = (t) => {
    if (be(t))
      return ce;
    const T = t.state.status;
    return t.state = null, T === ze ? A(t, ie) : V;
  }, K = (t, T) => {
    let m = T.length;
    if (be(t))
      return ce;
    const j = t.state, R = j.wrap;
    if (R === 2 || R === 1 && j.status !== Fe || j.lookahead)
      return ce;
    if (R === 1 && (t.adler = f(t.adler, T, m, 0)), j.wrap = 0, m >= j.w_size) {
      R === 0 && (de(j.head), j.strstart = 0, j.block_start = 0, j.insert = 0);
      let Ee = new Uint8Array(j.w_size);
      Ee.set(T.subarray(m - j.w_size, m), 0), T = Ee, m = j.w_size;
    }
    const we = t.avail_in, ke = t.next_in, Se = t.input;
    for (t.avail_in = m, t.next_in = 0, t.input = T, d(j); j.lookahead >= me; ) {
      let Ee = j.strstart, Ue = j.lookahead - (me - 1);
      do
        j.ins_h = e(j, j.ins_h, j.window[Ee + me - 1]), j.prev[Ee & j.w_mask] = j.head[j.ins_h], j.head[j.ins_h] = Ee, Ee++;
      while (--Ue);
      j.strstart = Ee, j.lookahead = me - 1, d(j);
    }
    return j.strstart += j.lookahead, j.block_start = j.strstart, j.insert = j.lookahead, j.lookahead = 0, j.match_length = j.prev_length = me - 1, j.match_available = 0, t.next_in = ke, t.input = Se, t.avail_in = we, j.wrap = R, V;
  };
  return tt.deflateInit = s, tt.deflateInit2 = Ne, tt.deflateReset = Ce, tt.deflateResetKeep = ge, tt.deflateSetHeader = De, tt.deflate = D, tt.deflateEnd = ae, tt.deflateSetDictionary = K, tt.deflateInfo = "pako deflate (from Nodeca project)", tt;
}
var Et = {}, dn;
function Hn() {
  if (dn) return Et;
  dn = 1;
  const c = (q, k) => Object.prototype.hasOwnProperty.call(q, k);
  return Et.assign = function(q) {
    const k = Array.prototype.slice.call(arguments, 1);
    for (; k.length; ) {
      const S = k.shift();
      if (S) {
        if (typeof S != "object")
          throw new TypeError(S + "must be non-object");
        for (const l in S)
          c(S, l) && (q[l] = S[l]);
      }
    }
    return q;
  }, Et.flattenChunks = (q) => {
    let k = 0;
    for (let l = 0, f = q.length; l < f; l++)
      k += q[l].length;
    const S = new Uint8Array(k);
    for (let l = 0, f = 0, a = q.length; l < a; l++) {
      let P = q[l];
      S.set(P, f), f += P.length;
    }
    return S;
  }, Et;
}
var kt = {}, un;
function Wn() {
  if (un) return kt;
  un = 1;
  let c = !0;
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch {
    c = !1;
  }
  const q = new Uint8Array(256);
  for (let S = 0; S < 256; S++)
    q[S] = S >= 252 ? 6 : S >= 248 ? 5 : S >= 240 ? 4 : S >= 224 ? 3 : S >= 192 ? 2 : 1;
  q[254] = q[254] = 1, kt.string2buf = (S) => {
    if (typeof TextEncoder == "function" && TextEncoder.prototype.encode)
      return new TextEncoder().encode(S);
    let l, f, a, P, ee, ye = S.length, O = 0;
    for (P = 0; P < ye; P++)
      f = S.charCodeAt(P), (f & 64512) === 55296 && P + 1 < ye && (a = S.charCodeAt(P + 1), (a & 64512) === 56320 && (f = 65536 + (f - 55296 << 10) + (a - 56320), P++)), O += f < 128 ? 1 : f < 2048 ? 2 : f < 65536 ? 3 : 4;
    for (l = new Uint8Array(O), ee = 0, P = 0; ee < O; P++)
      f = S.charCodeAt(P), (f & 64512) === 55296 && P + 1 < ye && (a = S.charCodeAt(P + 1), (a & 64512) === 56320 && (f = 65536 + (f - 55296 << 10) + (a - 56320), P++)), f < 128 ? l[ee++] = f : f < 2048 ? (l[ee++] = 192 | f >>> 6, l[ee++] = 128 | f & 63) : f < 65536 ? (l[ee++] = 224 | f >>> 12, l[ee++] = 128 | f >>> 6 & 63, l[ee++] = 128 | f & 63) : (l[ee++] = 240 | f >>> 18, l[ee++] = 128 | f >>> 12 & 63, l[ee++] = 128 | f >>> 6 & 63, l[ee++] = 128 | f & 63);
    return l;
  };
  const k = (S, l) => {
    if (l < 65534 && S.subarray && c)
      return String.fromCharCode.apply(null, S.length === l ? S : S.subarray(0, l));
    let f = "";
    for (let a = 0; a < l; a++)
      f += String.fromCharCode(S[a]);
    return f;
  };
  return kt.buf2string = (S, l) => {
    const f = l || S.length;
    if (typeof TextDecoder == "function" && TextDecoder.prototype.decode)
      return new TextDecoder().decode(S.subarray(0, l));
    let a, P;
    const ee = new Array(f * 2);
    for (P = 0, a = 0; a < f; ) {
      let ye = S[a++];
      if (ye < 128) {
        ee[P++] = ye;
        continue;
      }
      let O = q[ye];
      if (O > 4) {
        ee[P++] = 65533, a += O - 1;
        continue;
      }
      for (ye &= O === 2 ? 31 : O === 3 ? 15 : 7; O > 1 && a < f; )
        ye = ye << 6 | S[a++] & 63, O--;
      if (O > 1) {
        ee[P++] = 65533;
        continue;
      }
      ye < 65536 ? ee[P++] = ye : (ye -= 65536, ee[P++] = 55296 | ye >> 10 & 1023, ee[P++] = 56320 | ye & 1023);
    }
    return k(ee, P);
  }, kt.utf8border = (S, l) => {
    l = l || S.length, l > S.length && (l = S.length);
    let f = l - 1;
    for (; f >= 0 && (S[f] & 192) === 128; )
      f--;
    return f < 0 || f === 0 ? l : f + q[S[f]] > l ? f : l;
  }, kt;
}
var Ht, hn;
function $n() {
  if (hn) return Ht;
  hn = 1;
  function c() {
    this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
  }
  return Ht = c, Ht;
}
var pn;
function si() {
  if (pn) return ft;
  pn = 1;
  const c = ri(), q = Hn(), k = Wn(), S = Yt(), l = $n(), f = Object.prototype.toString, {
    Z_NO_FLUSH: a,
    Z_SYNC_FLUSH: P,
    Z_FULL_FLUSH: ee,
    Z_FINISH: ye,
    Z_OK: O,
    Z_STREAM_END: y,
    Z_DEFAULT_COMPRESSION: H,
    Z_DEFAULT_STRATEGY: V,
    Z_DEFLATED: le
  } = gt();
  function ce(ne) {
    this.options = q.assign({
      level: H,
      method: le,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: V
    }, ne || {});
    let B = this.options;
    B.raw && B.windowBits > 0 ? B.windowBits = -B.windowBits : B.gzip && B.windowBits > 0 && B.windowBits < 16 && (B.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new l(), this.strm.avail_out = 0;
    let z = c.deflateInit2(
      this.strm,
      B.level,
      B.method,
      B.windowBits,
      B.memLevel,
      B.strategy
    );
    if (z !== O)
      throw new Error(S[z]);
    if (B.header && c.deflateSetHeader(this.strm, B.header), B.dictionary) {
      let C;
      if (typeof B.dictionary == "string" ? C = k.string2buf(B.dictionary) : f.call(B.dictionary) === "[object ArrayBuffer]" ? C = new Uint8Array(B.dictionary) : C = B.dictionary, z = c.deflateSetDictionary(this.strm, C), z !== O)
        throw new Error(S[z]);
      this._dict_set = !0;
    }
  }
  ce.prototype.push = function(ne, B) {
    const z = this.strm, C = this.options.chunkSize;
    let F, N;
    if (this.ended)
      return !1;
    for (B === ~~B ? N = B : N = B === !0 ? ye : a, typeof ne == "string" ? z.input = k.string2buf(ne) : f.call(ne) === "[object ArrayBuffer]" ? z.input = new Uint8Array(ne) : z.input = ne, z.next_in = 0, z.avail_in = z.input.length; ; ) {
      if (z.avail_out === 0 && (z.output = new Uint8Array(C), z.next_out = 0, z.avail_out = C), (N === P || N === ee) && z.avail_out <= 6) {
        this.onData(z.output.subarray(0, z.next_out)), z.avail_out = 0;
        continue;
      }
      if (F = c.deflate(z, N), F === y)
        return z.next_out > 0 && this.onData(z.output.subarray(0, z.next_out)), F = c.deflateEnd(this.strm), this.onEnd(F), this.ended = !0, F === O;
      if (z.avail_out === 0) {
        this.onData(z.output);
        continue;
      }
      if (N > 0 && z.next_out > 0) {
        this.onData(z.output.subarray(0, z.next_out)), z.avail_out = 0;
        continue;
      }
      if (z.avail_in === 0) break;
    }
    return !0;
  }, ce.prototype.onData = function(ne) {
    this.chunks.push(ne);
  }, ce.prototype.onEnd = function(ne) {
    ne === O && (this.result = q.flattenChunks(this.chunks)), this.chunks = [], this.err = ne, this.msg = this.strm.msg;
  };
  function ie(ne, B) {
    const z = new ce(B);
    if (z.push(ne, !0), z.err)
      throw z.msg || S[z.err];
    return z.result;
  }
  function he(ne, B) {
    return B = B || {}, B.raw = !0, ie(ne, B);
  }
  function fe(ne, B) {
    return B = B || {}, B.gzip = !0, ie(ne, B);
  }
  return ft.Deflate = ce, ft.deflate = ie, ft.deflateRaw = he, ft.gzip = fe, ft.constants = gt(), ft;
}
var ut = {}, Qe = {}, Wt, gn;
function ai() {
  if (gn) return Wt;
  gn = 1;
  const c = 16209, q = 16191;
  return Wt = function(S, l) {
    let f, a, P, ee, ye, O, y, H, V, le, ce, ie, he, fe, ne, B, z, C, F, N, J, W, n, p;
    const g = S.state;
    f = S.next_in, n = S.input, a = f + (S.avail_in - 5), P = S.next_out, p = S.output, ee = P - (l - S.avail_out), ye = P + (S.avail_out - 257), O = g.dmax, y = g.wsize, H = g.whave, V = g.wnext, le = g.window, ce = g.hold, ie = g.bits, he = g.lencode, fe = g.distcode, ne = (1 << g.lenbits) - 1, B = (1 << g.distbits) - 1;
    e:
      do {
        ie < 15 && (ce += n[f++] << ie, ie += 8, ce += n[f++] << ie, ie += 8), z = he[ce & ne];
        t:
          for (; ; ) {
            if (C = z >>> 24, ce >>>= C, ie -= C, C = z >>> 16 & 255, C === 0)
              p[P++] = z & 65535;
            else if (C & 16) {
              F = z & 65535, C &= 15, C && (ie < C && (ce += n[f++] << ie, ie += 8), F += ce & (1 << C) - 1, ce >>>= C, ie -= C), ie < 15 && (ce += n[f++] << ie, ie += 8, ce += n[f++] << ie, ie += 8), z = fe[ce & B];
              n:
                for (; ; ) {
                  if (C = z >>> 24, ce >>>= C, ie -= C, C = z >>> 16 & 255, C & 16) {
                    if (N = z & 65535, C &= 15, ie < C && (ce += n[f++] << ie, ie += 8, ie < C && (ce += n[f++] << ie, ie += 8)), N += ce & (1 << C) - 1, N > O) {
                      S.msg = "invalid distance too far back", g.mode = c;
                      break e;
                    }
                    if (ce >>>= C, ie -= C, C = P - ee, N > C) {
                      if (C = N - C, C > H && g.sane) {
                        S.msg = "invalid distance too far back", g.mode = c;
                        break e;
                      }
                      if (J = 0, W = le, V === 0) {
                        if (J += y - C, C < F) {
                          F -= C;
                          do
                            p[P++] = le[J++];
                          while (--C);
                          J = P - N, W = p;
                        }
                      } else if (V < C) {
                        if (J += y + V - C, C -= V, C < F) {
                          F -= C;
                          do
                            p[P++] = le[J++];
                          while (--C);
                          if (J = 0, V < F) {
                            C = V, F -= C;
                            do
                              p[P++] = le[J++];
                            while (--C);
                            J = P - N, W = p;
                          }
                        }
                      } else if (J += V - C, C < F) {
                        F -= C;
                        do
                          p[P++] = le[J++];
                        while (--C);
                        J = P - N, W = p;
                      }
                      for (; F > 2; )
                        p[P++] = W[J++], p[P++] = W[J++], p[P++] = W[J++], F -= 3;
                      F && (p[P++] = W[J++], F > 1 && (p[P++] = W[J++]));
                    } else {
                      J = P - N;
                      do
                        p[P++] = p[J++], p[P++] = p[J++], p[P++] = p[J++], F -= 3;
                      while (F > 2);
                      F && (p[P++] = p[J++], F > 1 && (p[P++] = p[J++]));
                    }
                  } else if ((C & 64) === 0) {
                    z = fe[(z & 65535) + (ce & (1 << C) - 1)];
                    continue n;
                  } else {
                    S.msg = "invalid distance code", g.mode = c;
                    break e;
                  }
                  break;
                }
            } else if ((C & 64) === 0) {
              z = he[(z & 65535) + (ce & (1 << C) - 1)];
              continue t;
            } else if (C & 32) {
              g.mode = q;
              break e;
            } else {
              S.msg = "invalid literal/length code", g.mode = c;
              break e;
            }
            break;
          }
      } while (f < a && P < ye);
    F = ie >> 3, f -= F, ie -= F << 3, ce &= (1 << ie) - 1, S.next_in = f, S.next_out = P, S.avail_in = f < a ? 5 + (a - f) : 5 - (f - a), S.avail_out = P < ye ? 257 + (ye - P) : 257 - (P - ye), g.hold = ce, g.bits = ie;
  }, Wt;
}
var $t, mn;
function li() {
  if (mn) return $t;
  mn = 1;
  const c = 15, q = 852, k = 592, S = 0, l = 1, f = 2, a = new Uint16Array([
    /* Length codes 257..285 base */
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
  ]), P = new Uint8Array([
    /* Length codes 257..285 extra */
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
  ]), ee = new Uint16Array([
    /* Distance codes 0..29 base */
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
  ]), ye = new Uint8Array([
    /* Distance codes 0..29 extra */
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
  ]);
  return $t = (y, H, V, le, ce, ie, he, fe) => {
    const ne = fe.bits;
    let B = 0, z = 0, C = 0, F = 0, N = 0, J = 0, W = 0, n = 0, p = 0, g = 0, E, G, M, re, Q, se = null, me;
    const te = new Uint16Array(c + 1), ve = new Uint16Array(c + 1);
    let ue = null, Fe, _e, Oe;
    for (B = 0; B <= c; B++)
      te[B] = 0;
    for (z = 0; z < le; z++)
      te[H[V + z]]++;
    for (N = ne, F = c; F >= 1 && te[F] === 0; F--)
      ;
    if (N > F && (N = F), F === 0)
      return ce[ie++] = 1 << 24 | 64 << 16 | 0, ce[ie++] = 1 << 24 | 64 << 16 | 0, fe.bits = 1, 0;
    for (C = 1; C < F && te[C] === 0; C++)
      ;
    for (N < C && (N = C), n = 1, B = 1; B <= c; B++)
      if (n <<= 1, n -= te[B], n < 0)
        return -1;
    if (n > 0 && (y === S || F !== 1))
      return -1;
    for (ve[1] = 0, B = 1; B < c; B++)
      ve[B + 1] = ve[B] + te[B];
    for (z = 0; z < le; z++)
      H[V + z] !== 0 && (he[ve[H[V + z]]++] = z);
    if (y === S ? (se = ue = he, me = 20) : y === l ? (se = a, ue = P, me = 257) : (se = ee, ue = ye, me = 0), g = 0, z = 0, B = C, Q = ie, J = N, W = 0, M = -1, p = 1 << N, re = p - 1, y === l && p > q || y === f && p > k)
      return 1;
    for (; ; ) {
      Fe = B - W, he[z] + 1 < me ? (_e = 0, Oe = he[z]) : he[z] >= me ? (_e = ue[he[z] - me], Oe = se[he[z] - me]) : (_e = 96, Oe = 0), E = 1 << B - W, G = 1 << J, C = G;
      do
        G -= E, ce[Q + (g >> W) + G] = Fe << 24 | _e << 16 | Oe | 0;
      while (G !== 0);
      for (E = 1 << B - 1; g & E; )
        E >>= 1;
      if (E !== 0 ? (g &= E - 1, g += E) : g = 0, z++, --te[B] === 0) {
        if (B === F)
          break;
        B = H[V + he[z]];
      }
      if (B > N && (g & re) !== M) {
        for (W === 0 && (W = N), Q += C, J = B - W, n = 1 << J; J + W < F && (n -= te[J + W], !(n <= 0)); )
          J++, n <<= 1;
        if (p += 1 << J, y === l && p > q || y === f && p > k)
          return 1;
        M = g & re, ce[M] = N << 24 | J << 16 | Q - ie | 0;
      }
    }
    return g !== 0 && (ce[Q + g] = B - W << 24 | 64 << 16 | 0), fe.bits = N, 0;
  }, $t;
}
var bn;
function ci() {
  if (bn) return Qe;
  bn = 1;
  const c = Nn(), q = Gn(), k = ai(), S = li(), l = 0, f = 1, a = 2, {
    Z_FINISH: P,
    Z_BLOCK: ee,
    Z_TREES: ye,
    Z_OK: O,
    Z_STREAM_END: y,
    Z_NEED_DICT: H,
    Z_STREAM_ERROR: V,
    Z_DATA_ERROR: le,
    Z_MEM_ERROR: ce,
    Z_BUF_ERROR: ie,
    Z_DEFLATED: he
  } = gt(), fe = 16180, ne = 16181, B = 16182, z = 16183, C = 16184, F = 16185, N = 16186, J = 16187, W = 16188, n = 16189, p = 16190, g = 16191, E = 16192, G = 16193, M = 16194, re = 16195, Q = 16196, se = 16197, me = 16198, te = 16199, ve = 16200, ue = 16201, Fe = 16202, _e = 16203, Oe = 16204, Ie = 16205, xe = 16206, Ae = 16207, ze = 16208, Pe = 16209, Re = 16210, Ve = 16211, Ge = 852, Be = 592, A = 15, Y = (b) => (b >>> 24 & 255) + (b >>> 8 & 65280) + ((b & 65280) << 8) + ((b & 255) << 24);
  function de() {
    this.strm = null, this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Uint16Array(320), this.work = new Uint16Array(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
  }
  const pe = (b) => {
    if (!b)
      return 1;
    const X = b.state;
    return !X || X.strm !== b || X.mode < fe || X.mode > Ve ? 1 : 0;
  }, oe = (b) => {
    if (pe(b))
      return V;
    const X = b.state;
    return b.total_in = b.total_out = X.total = 0, b.msg = "", X.wrap && (b.adler = X.wrap & 1), X.mode = fe, X.last = 0, X.havedict = 0, X.flags = -1, X.dmax = 32768, X.head = null, X.hold = 0, X.bits = 0, X.lencode = X.lendyn = new Int32Array(Ge), X.distcode = X.distdyn = new Int32Array(Be), X.sane = 1, X.back = -1, O;
  }, e = (b) => {
    if (pe(b))
      return V;
    const X = b.state;
    return X.wsize = 0, X.whave = 0, X.wnext = 0, oe(b);
  }, i = (b, X) => {
    let u;
    if (pe(b))
      return V;
    const $ = b.state;
    return X < 0 ? (u = 0, X = -X) : (u = (X >> 4) + 5, X < 48 && (X &= 15)), X && (X < 8 || X > 15) ? V : ($.window !== null && $.wbits !== X && ($.window = null), $.wrap = u, $.wbits = X, e(b));
  }, r = (b, X) => {
    if (!b)
      return V;
    const u = new de();
    b.state = u, u.strm = b, u.window = null, u.mode = fe;
    const $ = i(b, X);
    return $ !== O && (b.state = null), $;
  }, h = (b) => r(b, A);
  let w = !0, U, Z;
  const d = (b) => {
    if (w) {
      U = new Int32Array(512), Z = new Int32Array(32);
      let X = 0;
      for (; X < 144; )
        b.lens[X++] = 8;
      for (; X < 256; )
        b.lens[X++] = 9;
      for (; X < 280; )
        b.lens[X++] = 7;
      for (; X < 288; )
        b.lens[X++] = 8;
      for (S(f, b.lens, 0, 288, U, 0, b.work, { bits: 9 }), X = 0; X < 32; )
        b.lens[X++] = 5;
      S(a, b.lens, 0, 32, Z, 0, b.work, { bits: 5 }), w = !1;
    }
    b.lencode = U, b.lenbits = 9, b.distcode = Z, b.distbits = 5;
  }, L = (b, X, u, $) => {
    let be;
    const ge = b.state;
    return ge.window === null && (ge.wsize = 1 << ge.wbits, ge.wnext = 0, ge.whave = 0, ge.window = new Uint8Array(ge.wsize)), $ >= ge.wsize ? (ge.window.set(X.subarray(u - ge.wsize, u), 0), ge.wnext = 0, ge.whave = ge.wsize) : (be = ge.wsize - ge.wnext, be > $ && (be = $), ge.window.set(X.subarray(u - $, u - $ + be), ge.wnext), $ -= be, $ ? (ge.window.set(X.subarray(u - $, u), 0), ge.wnext = $, ge.whave = ge.wsize) : (ge.wnext += be, ge.wnext === ge.wsize && (ge.wnext = 0), ge.whave < ge.wsize && (ge.whave += be))), 0;
  }, o = (b, X) => {
    let u, $, be, ge, Ce, De, Ne, s, D, ae, K, t, T, m, j = 0, R, we, ke, Se, Ee, Ue, Le, He;
    const Me = new Uint8Array(4);
    let je, Te;
    const We = (
      /* permutation of code lengths */
      new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
    );
    if (pe(b) || !b.output || !b.input && b.avail_in !== 0)
      return V;
    u = b.state, u.mode === g && (u.mode = E), Ce = b.next_out, be = b.output, Ne = b.avail_out, ge = b.next_in, $ = b.input, De = b.avail_in, s = u.hold, D = u.bits, ae = De, K = Ne, He = O;
    e:
      for (; ; )
        switch (u.mode) {
          case fe:
            if (u.wrap === 0) {
              u.mode = E;
              break;
            }
            for (; D < 16; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if (u.wrap & 2 && s === 35615) {
              u.wbits === 0 && (u.wbits = 15), u.check = 0, Me[0] = s & 255, Me[1] = s >>> 8 & 255, u.check = q(u.check, Me, 2, 0), s = 0, D = 0, u.mode = ne;
              break;
            }
            if (u.head && (u.head.done = !1), !(u.wrap & 1) || /* check if zlib header allowed */
            (((s & 255) << 8) + (s >> 8)) % 31) {
              b.msg = "incorrect header check", u.mode = Pe;
              break;
            }
            if ((s & 15) !== he) {
              b.msg = "unknown compression method", u.mode = Pe;
              break;
            }
            if (s >>>= 4, D -= 4, Le = (s & 15) + 8, u.wbits === 0 && (u.wbits = Le), Le > 15 || Le > u.wbits) {
              b.msg = "invalid window size", u.mode = Pe;
              break;
            }
            u.dmax = 1 << u.wbits, u.flags = 0, b.adler = u.check = 1, u.mode = s & 512 ? n : g, s = 0, D = 0;
            break;
          case ne:
            for (; D < 16; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if (u.flags = s, (u.flags & 255) !== he) {
              b.msg = "unknown compression method", u.mode = Pe;
              break;
            }
            if (u.flags & 57344) {
              b.msg = "unknown header flags set", u.mode = Pe;
              break;
            }
            u.head && (u.head.text = s >> 8 & 1), u.flags & 512 && u.wrap & 4 && (Me[0] = s & 255, Me[1] = s >>> 8 & 255, u.check = q(u.check, Me, 2, 0)), s = 0, D = 0, u.mode = B;
          /* falls through */
          case B:
            for (; D < 32; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            u.head && (u.head.time = s), u.flags & 512 && u.wrap & 4 && (Me[0] = s & 255, Me[1] = s >>> 8 & 255, Me[2] = s >>> 16 & 255, Me[3] = s >>> 24 & 255, u.check = q(u.check, Me, 4, 0)), s = 0, D = 0, u.mode = z;
          /* falls through */
          case z:
            for (; D < 16; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            u.head && (u.head.xflags = s & 255, u.head.os = s >> 8), u.flags & 512 && u.wrap & 4 && (Me[0] = s & 255, Me[1] = s >>> 8 & 255, u.check = q(u.check, Me, 2, 0)), s = 0, D = 0, u.mode = C;
          /* falls through */
          case C:
            if (u.flags & 1024) {
              for (; D < 16; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              u.length = s, u.head && (u.head.extra_len = s), u.flags & 512 && u.wrap & 4 && (Me[0] = s & 255, Me[1] = s >>> 8 & 255, u.check = q(u.check, Me, 2, 0)), s = 0, D = 0;
            } else u.head && (u.head.extra = null);
            u.mode = F;
          /* falls through */
          case F:
            if (u.flags & 1024 && (t = u.length, t > De && (t = De), t && (u.head && (Le = u.head.extra_len - u.length, u.head.extra || (u.head.extra = new Uint8Array(u.head.extra_len)), u.head.extra.set(
              $.subarray(
                ge,
                // extra field is limited to 65536 bytes
                // - no need for additional size check
                ge + t
              ),
              /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
              Le
            )), u.flags & 512 && u.wrap & 4 && (u.check = q(u.check, $, t, ge)), De -= t, ge += t, u.length -= t), u.length))
              break e;
            u.length = 0, u.mode = N;
          /* falls through */
          case N:
            if (u.flags & 2048) {
              if (De === 0)
                break e;
              t = 0;
              do
                Le = $[ge + t++], u.head && Le && u.length < 65536 && (u.head.name += String.fromCharCode(Le));
              while (Le && t < De);
              if (u.flags & 512 && u.wrap & 4 && (u.check = q(u.check, $, t, ge)), De -= t, ge += t, Le)
                break e;
            } else u.head && (u.head.name = null);
            u.length = 0, u.mode = J;
          /* falls through */
          case J:
            if (u.flags & 4096) {
              if (De === 0)
                break e;
              t = 0;
              do
                Le = $[ge + t++], u.head && Le && u.length < 65536 && (u.head.comment += String.fromCharCode(Le));
              while (Le && t < De);
              if (u.flags & 512 && u.wrap & 4 && (u.check = q(u.check, $, t, ge)), De -= t, ge += t, Le)
                break e;
            } else u.head && (u.head.comment = null);
            u.mode = W;
          /* falls through */
          case W:
            if (u.flags & 512) {
              for (; D < 16; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              if (u.wrap & 4 && s !== (u.check & 65535)) {
                b.msg = "header crc mismatch", u.mode = Pe;
                break;
              }
              s = 0, D = 0;
            }
            u.head && (u.head.hcrc = u.flags >> 9 & 1, u.head.done = !0), b.adler = u.check = 0, u.mode = g;
            break;
          case n:
            for (; D < 32; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            b.adler = u.check = Y(s), s = 0, D = 0, u.mode = p;
          /* falls through */
          case p:
            if (u.havedict === 0)
              return b.next_out = Ce, b.avail_out = Ne, b.next_in = ge, b.avail_in = De, u.hold = s, u.bits = D, H;
            b.adler = u.check = 1, u.mode = g;
          /* falls through */
          case g:
            if (X === ee || X === ye)
              break e;
          /* falls through */
          case E:
            if (u.last) {
              s >>>= D & 7, D -= D & 7, u.mode = xe;
              break;
            }
            for (; D < 3; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            switch (u.last = s & 1, s >>>= 1, D -= 1, s & 3) {
              case 0:
                u.mode = G;
                break;
              case 1:
                if (d(u), u.mode = te, X === ye) {
                  s >>>= 2, D -= 2;
                  break e;
                }
                break;
              case 2:
                u.mode = Q;
                break;
              case 3:
                b.msg = "invalid block type", u.mode = Pe;
            }
            s >>>= 2, D -= 2;
            break;
          case G:
            for (s >>>= D & 7, D -= D & 7; D < 32; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if ((s & 65535) !== (s >>> 16 ^ 65535)) {
              b.msg = "invalid stored block lengths", u.mode = Pe;
              break;
            }
            if (u.length = s & 65535, s = 0, D = 0, u.mode = M, X === ye)
              break e;
          /* falls through */
          case M:
            u.mode = re;
          /* falls through */
          case re:
            if (t = u.length, t) {
              if (t > De && (t = De), t > Ne && (t = Ne), t === 0)
                break e;
              be.set($.subarray(ge, ge + t), Ce), De -= t, ge += t, Ne -= t, Ce += t, u.length -= t;
              break;
            }
            u.mode = g;
            break;
          case Q:
            for (; D < 14; ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if (u.nlen = (s & 31) + 257, s >>>= 5, D -= 5, u.ndist = (s & 31) + 1, s >>>= 5, D -= 5, u.ncode = (s & 15) + 4, s >>>= 4, D -= 4, u.nlen > 286 || u.ndist > 30) {
              b.msg = "too many length or distance symbols", u.mode = Pe;
              break;
            }
            u.have = 0, u.mode = se;
          /* falls through */
          case se:
            for (; u.have < u.ncode; ) {
              for (; D < 3; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              u.lens[We[u.have++]] = s & 7, s >>>= 3, D -= 3;
            }
            for (; u.have < 19; )
              u.lens[We[u.have++]] = 0;
            if (u.lencode = u.lendyn, u.lenbits = 7, je = { bits: u.lenbits }, He = S(l, u.lens, 0, 19, u.lencode, 0, u.work, je), u.lenbits = je.bits, He) {
              b.msg = "invalid code lengths set", u.mode = Pe;
              break;
            }
            u.have = 0, u.mode = me;
          /* falls through */
          case me:
            for (; u.have < u.nlen + u.ndist; ) {
              for (; j = u.lencode[s & (1 << u.lenbits) - 1], R = j >>> 24, we = j >>> 16 & 255, ke = j & 65535, !(R <= D); ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              if (ke < 16)
                s >>>= R, D -= R, u.lens[u.have++] = ke;
              else {
                if (ke === 16) {
                  for (Te = R + 2; D < Te; ) {
                    if (De === 0)
                      break e;
                    De--, s += $[ge++] << D, D += 8;
                  }
                  if (s >>>= R, D -= R, u.have === 0) {
                    b.msg = "invalid bit length repeat", u.mode = Pe;
                    break;
                  }
                  Le = u.lens[u.have - 1], t = 3 + (s & 3), s >>>= 2, D -= 2;
                } else if (ke === 17) {
                  for (Te = R + 3; D < Te; ) {
                    if (De === 0)
                      break e;
                    De--, s += $[ge++] << D, D += 8;
                  }
                  s >>>= R, D -= R, Le = 0, t = 3 + (s & 7), s >>>= 3, D -= 3;
                } else {
                  for (Te = R + 7; D < Te; ) {
                    if (De === 0)
                      break e;
                    De--, s += $[ge++] << D, D += 8;
                  }
                  s >>>= R, D -= R, Le = 0, t = 11 + (s & 127), s >>>= 7, D -= 7;
                }
                if (u.have + t > u.nlen + u.ndist) {
                  b.msg = "invalid bit length repeat", u.mode = Pe;
                  break;
                }
                for (; t--; )
                  u.lens[u.have++] = Le;
              }
            }
            if (u.mode === Pe)
              break;
            if (u.lens[256] === 0) {
              b.msg = "invalid code -- missing end-of-block", u.mode = Pe;
              break;
            }
            if (u.lenbits = 9, je = { bits: u.lenbits }, He = S(f, u.lens, 0, u.nlen, u.lencode, 0, u.work, je), u.lenbits = je.bits, He) {
              b.msg = "invalid literal/lengths set", u.mode = Pe;
              break;
            }
            if (u.distbits = 6, u.distcode = u.distdyn, je = { bits: u.distbits }, He = S(a, u.lens, u.nlen, u.ndist, u.distcode, 0, u.work, je), u.distbits = je.bits, He) {
              b.msg = "invalid distances set", u.mode = Pe;
              break;
            }
            if (u.mode = te, X === ye)
              break e;
          /* falls through */
          case te:
            u.mode = ve;
          /* falls through */
          case ve:
            if (De >= 6 && Ne >= 258) {
              b.next_out = Ce, b.avail_out = Ne, b.next_in = ge, b.avail_in = De, u.hold = s, u.bits = D, k(b, K), Ce = b.next_out, be = b.output, Ne = b.avail_out, ge = b.next_in, $ = b.input, De = b.avail_in, s = u.hold, D = u.bits, u.mode === g && (u.back = -1);
              break;
            }
            for (u.back = 0; j = u.lencode[s & (1 << u.lenbits) - 1], R = j >>> 24, we = j >>> 16 & 255, ke = j & 65535, !(R <= D); ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if (we && (we & 240) === 0) {
              for (Se = R, Ee = we, Ue = ke; j = u.lencode[Ue + ((s & (1 << Se + Ee) - 1) >> Se)], R = j >>> 24, we = j >>> 16 & 255, ke = j & 65535, !(Se + R <= D); ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              s >>>= Se, D -= Se, u.back += Se;
            }
            if (s >>>= R, D -= R, u.back += R, u.length = ke, we === 0) {
              u.mode = Ie;
              break;
            }
            if (we & 32) {
              u.back = -1, u.mode = g;
              break;
            }
            if (we & 64) {
              b.msg = "invalid literal/length code", u.mode = Pe;
              break;
            }
            u.extra = we & 15, u.mode = ue;
          /* falls through */
          case ue:
            if (u.extra) {
              for (Te = u.extra; D < Te; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              u.length += s & (1 << u.extra) - 1, s >>>= u.extra, D -= u.extra, u.back += u.extra;
            }
            u.was = u.length, u.mode = Fe;
          /* falls through */
          case Fe:
            for (; j = u.distcode[s & (1 << u.distbits) - 1], R = j >>> 24, we = j >>> 16 & 255, ke = j & 65535, !(R <= D); ) {
              if (De === 0)
                break e;
              De--, s += $[ge++] << D, D += 8;
            }
            if ((we & 240) === 0) {
              for (Se = R, Ee = we, Ue = ke; j = u.distcode[Ue + ((s & (1 << Se + Ee) - 1) >> Se)], R = j >>> 24, we = j >>> 16 & 255, ke = j & 65535, !(Se + R <= D); ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              s >>>= Se, D -= Se, u.back += Se;
            }
            if (s >>>= R, D -= R, u.back += R, we & 64) {
              b.msg = "invalid distance code", u.mode = Pe;
              break;
            }
            u.offset = ke, u.extra = we & 15, u.mode = _e;
          /* falls through */
          case _e:
            if (u.extra) {
              for (Te = u.extra; D < Te; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              u.offset += s & (1 << u.extra) - 1, s >>>= u.extra, D -= u.extra, u.back += u.extra;
            }
            if (u.offset > u.dmax) {
              b.msg = "invalid distance too far back", u.mode = Pe;
              break;
            }
            u.mode = Oe;
          /* falls through */
          case Oe:
            if (Ne === 0)
              break e;
            if (t = K - Ne, u.offset > t) {
              if (t = u.offset - t, t > u.whave && u.sane) {
                b.msg = "invalid distance too far back", u.mode = Pe;
                break;
              }
              t > u.wnext ? (t -= u.wnext, T = u.wsize - t) : T = u.wnext - t, t > u.length && (t = u.length), m = u.window;
            } else
              m = be, T = Ce - u.offset, t = u.length;
            t > Ne && (t = Ne), Ne -= t, u.length -= t;
            do
              be[Ce++] = m[T++];
            while (--t);
            u.length === 0 && (u.mode = ve);
            break;
          case Ie:
            if (Ne === 0)
              break e;
            be[Ce++] = u.length, Ne--, u.mode = ve;
            break;
          case xe:
            if (u.wrap) {
              for (; D < 32; ) {
                if (De === 0)
                  break e;
                De--, s |= $[ge++] << D, D += 8;
              }
              if (K -= Ne, b.total_out += K, u.total += K, u.wrap & 4 && K && (b.adler = u.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
              u.flags ? q(u.check, be, K, Ce - K) : c(u.check, be, K, Ce - K)), K = Ne, u.wrap & 4 && (u.flags ? s : Y(s)) !== u.check) {
                b.msg = "incorrect data check", u.mode = Pe;
                break;
              }
              s = 0, D = 0;
            }
            u.mode = Ae;
          /* falls through */
          case Ae:
            if (u.wrap && u.flags) {
              for (; D < 32; ) {
                if (De === 0)
                  break e;
                De--, s += $[ge++] << D, D += 8;
              }
              if (u.wrap & 4 && s !== (u.total & 4294967295)) {
                b.msg = "incorrect length check", u.mode = Pe;
                break;
              }
              s = 0, D = 0;
            }
            u.mode = ze;
          /* falls through */
          case ze:
            He = y;
            break e;
          case Pe:
            He = le;
            break e;
          case Re:
            return ce;
          case Ve:
          /* falls through */
          default:
            return V;
        }
    return b.next_out = Ce, b.avail_out = Ne, b.next_in = ge, b.avail_in = De, u.hold = s, u.bits = D, (u.wsize || K !== b.avail_out && u.mode < Pe && (u.mode < xe || X !== P)) && L(b, b.output, b.next_out, K - b.avail_out), ae -= b.avail_in, K -= b.avail_out, b.total_in += ae, b.total_out += K, u.total += K, u.wrap & 4 && K && (b.adler = u.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
    u.flags ? q(u.check, be, K, b.next_out - K) : c(u.check, be, K, b.next_out - K)), b.data_type = u.bits + (u.last ? 64 : 0) + (u.mode === g ? 128 : 0) + (u.mode === te || u.mode === M ? 256 : 0), (ae === 0 && K === 0 || X === P) && He === O && (He = ie), He;
  }, _ = (b) => {
    if (pe(b))
      return V;
    let X = b.state;
    return X.window && (X.window = null), b.state = null, O;
  }, I = (b, X) => {
    if (pe(b))
      return V;
    const u = b.state;
    return (u.wrap & 2) === 0 ? V : (u.head = X, X.done = !1, O);
  }, x = (b, X) => {
    const u = X.length;
    let $, be, ge;
    return pe(b) || ($ = b.state, $.wrap !== 0 && $.mode !== p) ? V : $.mode === p && (be = 1, be = c(be, X, u, 0), be !== $.check) ? le : (ge = L(b, X, u, u), ge ? ($.mode = Re, ce) : ($.havedict = 1, O));
  };
  return Qe.inflateReset = e, Qe.inflateReset2 = i, Qe.inflateResetKeep = oe, Qe.inflateInit = h, Qe.inflateInit2 = r, Qe.inflate = o, Qe.inflateEnd = _, Qe.inflateGetHeader = I, Qe.inflateSetDictionary = x, Qe.inflateInfo = "pako inflate (from Nodeca project)", Qe;
}
var Zt, yn;
function fi() {
  if (yn) return Zt;
  yn = 1;
  function c() {
    this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
  }
  return Zt = c, Zt;
}
var wn;
function di() {
  if (wn) return ut;
  wn = 1;
  const c = ci(), q = Hn(), k = Wn(), S = Yt(), l = $n(), f = fi(), a = Object.prototype.toString, {
    Z_NO_FLUSH: P,
    Z_FINISH: ee,
    Z_OK: ye,
    Z_STREAM_END: O,
    Z_NEED_DICT: y,
    Z_STREAM_ERROR: H,
    Z_DATA_ERROR: V,
    Z_MEM_ERROR: le
  } = gt();
  function ce(fe) {
    this.options = q.assign({
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: ""
    }, fe || {});
    const ne = this.options;
    ne.raw && ne.windowBits >= 0 && ne.windowBits < 16 && (ne.windowBits = -ne.windowBits, ne.windowBits === 0 && (ne.windowBits = -15)), ne.windowBits >= 0 && ne.windowBits < 16 && !(fe && fe.windowBits) && (ne.windowBits += 32), ne.windowBits > 15 && ne.windowBits < 48 && (ne.windowBits & 15) === 0 && (ne.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new l(), this.strm.avail_out = 0;
    let B = c.inflateInit2(
      this.strm,
      ne.windowBits
    );
    if (B !== ye)
      throw new Error(S[B]);
    if (this.header = new f(), c.inflateGetHeader(this.strm, this.header), ne.dictionary && (typeof ne.dictionary == "string" ? ne.dictionary = k.string2buf(ne.dictionary) : a.call(ne.dictionary) === "[object ArrayBuffer]" && (ne.dictionary = new Uint8Array(ne.dictionary)), ne.raw && (B = c.inflateSetDictionary(this.strm, ne.dictionary), B !== ye)))
      throw new Error(S[B]);
  }
  ce.prototype.push = function(fe, ne) {
    const B = this.strm, z = this.options.chunkSize, C = this.options.dictionary;
    let F, N, J;
    if (this.ended) return !1;
    for (ne === ~~ne ? N = ne : N = ne === !0 ? ee : P, a.call(fe) === "[object ArrayBuffer]" ? B.input = new Uint8Array(fe) : B.input = fe, B.next_in = 0, B.avail_in = B.input.length; ; ) {
      for (B.avail_out === 0 && (B.output = new Uint8Array(z), B.next_out = 0, B.avail_out = z), F = c.inflate(B, N), F === y && C && (F = c.inflateSetDictionary(B, C), F === ye ? F = c.inflate(B, N) : F === V && (F = y)); B.avail_in > 0 && F === O && B.state.wrap > 0 && fe[B.next_in] !== 0; )
        c.inflateReset(B), F = c.inflate(B, N);
      switch (F) {
        case H:
        case V:
        case y:
        case le:
          return this.onEnd(F), this.ended = !0, !1;
      }
      if (J = B.avail_out, B.next_out && (B.avail_out === 0 || F === O))
        if (this.options.to === "string") {
          let W = k.utf8border(B.output, B.next_out), n = B.next_out - W, p = k.buf2string(B.output, W);
          B.next_out = n, B.avail_out = z - n, n && B.output.set(B.output.subarray(W, W + n), 0), this.onData(p);
        } else
          this.onData(B.output.length === B.next_out ? B.output : B.output.subarray(0, B.next_out));
      if (!(F === ye && J === 0)) {
        if (F === O)
          return F = c.inflateEnd(this.strm), this.onEnd(F), this.ended = !0, !0;
        if (B.avail_in === 0) break;
      }
    }
    return !0;
  }, ce.prototype.onData = function(fe) {
    this.chunks.push(fe);
  }, ce.prototype.onEnd = function(fe) {
    fe === ye && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = q.flattenChunks(this.chunks)), this.chunks = [], this.err = fe, this.msg = this.strm.msg;
  };
  function ie(fe, ne) {
    const B = new ce(ne);
    if (B.push(fe), B.err) throw B.msg || S[B.err];
    return B.result;
  }
  function he(fe, ne) {
    return ne = ne || {}, ne.raw = !0, ie(fe, ne);
  }
  return ut.Inflate = ce, ut.inflate = ie, ut.inflateRaw = he, ut.ungzip = ie, ut.constants = gt(), ut;
}
var Sn;
function Zn() {
  if (Sn) return et;
  Sn = 1;
  const { Deflate: c, deflate: q, deflateRaw: k, gzip: S } = si(), { Inflate: l, inflate: f, inflateRaw: a, ungzip: P } = di(), ee = gt();
  return et.Deflate = c, et.deflate = q, et.deflateRaw = k, et.gzip = S, et.Inflate = l, et.inflate = f, et.inflateRaw = a, et.ungzip = P, et.constants = ee, et;
}
var Pt = {}, _n;
function ui() {
  if (_n) return Pt;
  _n = 1, Object.defineProperty(Pt, "__esModule", { value: !0 }), Pt.decodeJpeg = ne;
  const c = new Int32Array([
    0,
    1,
    8,
    16,
    9,
    2,
    3,
    10,
    17,
    24,
    32,
    25,
    18,
    11,
    4,
    5,
    12,
    19,
    26,
    33,
    40,
    48,
    41,
    34,
    27,
    20,
    13,
    6,
    7,
    14,
    21,
    28,
    35,
    42,
    49,
    56,
    57,
    50,
    43,
    36,
    29,
    22,
    15,
    23,
    30,
    37,
    44,
    51,
    58,
    59,
    52,
    45,
    38,
    31,
    39,
    46,
    53,
    60,
    61,
    54,
    47,
    55,
    62,
    63
  ]), q = 4017, k = 799, S = 3406, l = 2276, f = 1567, a = 3784, P = 5793, ee = 2896, ye = 100, O = 64 * 1024 * 1024;
  let y = 0;
  function H(B) {
    const z = y + B;
    if (z > O) {
      const C = Math.ceil((z - O) / 1024 / 1024);
      throw new Error(`Max memory limit exceeded by at least ${C}MB`);
    }
    y = z;
  }
  function V(B, z) {
    let C = 16;
    for (; C > 0 && !B[C - 1]; )
      C--;
    const F = [{ children: [], index: 0 }];
    let N = 0, J = F[0];
    for (let W = 0; W < C; W++) {
      for (let n = 0; n < B[W]; n++) {
        for (J = F.pop(), J.children[J.index] = z[N]; J.index > 0; ) {
          if (F.length === 0)
            throw new Error("Could not recreate Huffman Table");
          J = F.pop();
        }
        for (J.index++, F.push(J); F.length <= W; ) {
          const p = { children: [], index: 0 };
          F.push(p), J.children[J.index] = p.children, J = p;
        }
        N++;
      }
      if (W + 1 < C) {
        const n = { children: [], index: 0 };
        F.push(n), J.children[J.index] = n.children, J = n;
      }
    }
    return F[0].children;
  }
  function le(B, z, C, F, N, J, W, n, p) {
    const g = C.mcusPerLine, E = C.progressive, G = z;
    let M = 0, re = 0;
    function Q() {
      if (re > 0)
        return re--, M >> re & 1;
      if (M = B[z++], M == 255) {
        const pe = B[z++];
        if (pe)
          throw new Error(`unexpected marker: ${(M << 8 | pe).toString(16)}`);
      }
      return re = 7, M >>> 7;
    }
    function se(pe) {
      let oe = pe;
      for (; ; ) {
        if (oe = oe[Q()], typeof oe == "number")
          return oe;
        if (oe === void 0)
          throw new Error("invalid huffman sequence");
      }
    }
    function me(pe) {
      let oe = 0;
      for (; pe > 0; )
        oe = oe << 1 | Q(), pe--;
      return oe;
    }
    function te(pe) {
      let oe = me(pe);
      return oe >= 1 << pe - 1 ? oe : oe + (-1 << pe) + 1;
    }
    function ve(pe, oe) {
      const e = se(pe.huffmanTableDC), i = e === 0 ? 0 : te(e);
      oe[0] = pe.pred += i;
      let r = 1;
      for (; r < 64; ) {
        const h = se(pe.huffmanTableAC), w = h & 15, U = h >> 4;
        if (w === 0) {
          if (U < 15)
            break;
          r += 16;
          continue;
        }
        r += U;
        const Z = c[r];
        oe[Z] = te(w), r++;
      }
    }
    function ue(pe, oe) {
      const e = se(pe.huffmanTableDC), i = e === 0 ? 0 : te(e) << p;
      oe[0] = pe.pred += i;
    }
    function Fe(pe, oe) {
      oe[0] |= Q() << p;
    }
    let _e = 0;
    function Oe(pe, oe) {
      if (_e > 0) {
        _e--;
        return;
      }
      let e = J, i = W;
      for (; e <= i; ) {
        const r = se(pe.huffmanTableAC), h = r & 15, w = r >> 4;
        if (h === 0) {
          if (w < 15) {
            _e = me(w) + (1 << w) - 1;
            break;
          }
          e += 16;
          continue;
        }
        e += w;
        const U = c[e];
        oe[U] = te(h) * (1 << p), e++;
      }
    }
    let Ie = 0, xe = 0;
    function Ae(pe, oe) {
      let e = J, i = W, r = 0;
      for (; e <= i; ) {
        const h = c[e], w = oe[h] < 0 ? -1 : 1;
        switch (Ie) {
          case 0:
            const U = se(pe.huffmanTableAC), Z = U & 15;
            if (r = U >> 4, Z === 0)
              r < 15 ? (_e = me(r) + (1 << r), Ie = 4) : (r = 16, Ie = 1);
            else {
              if (Z !== 1)
                throw new Error("invalid ACn encoding");
              xe = te(Z), Ie = r ? 2 : 3;
            }
            continue;
          case 1:
          // skipping r zero items
          case 2:
            oe[h] ? oe[h] += (Q() << p) * w : (r--, r === 0 && (Ie = Ie == 2 ? 3 : 0));
            break;
          case 3:
            oe[h] ? oe[h] += (Q() << p) * w : (oe[h] = xe << p, Ie = 0);
            break;
          case 4:
            oe[h] && (oe[h] += (Q() << p) * w);
            break;
        }
        e++;
      }
      Ie === 4 && (_e--, _e === 0 && (Ie = 0));
    }
    function ze(pe, oe, e, i, r) {
      const h = e / g | 0, w = e % g, U = h * pe.v + i, Z = w * pe.h + r;
      pe.blocks[U] !== void 0 && oe(pe, pe.blocks[U][Z]);
    }
    function Pe(pe, oe, e) {
      const i = e / pe.blocksPerLine | 0, r = e % pe.blocksPerLine;
      pe.blocks[i] !== void 0 && oe(pe, pe.blocks[i][r]);
    }
    const Re = F.length;
    let Ve, Ge;
    E ? J === 0 ? Ge = n === 0 ? ue : Fe : Ge = n === 0 ? Oe : Ae : Ge = ve;
    let Be = 0, v;
    Re == 1 ? v = F[0].blocksPerLine * F[0].blocksPerColumn : v = g * C.mcusPerColumn, N || (N = v);
    let A, Y, de;
    for (; Be < v; ) {
      for (let pe = 0; pe < Re; pe++)
        F[pe].pred = 0;
      if (_e = 0, Re == 1) {
        Ve = F[0];
        for (let pe = 0; pe < N; pe++)
          Pe(Ve, Ge, Be), Be++;
      } else
        for (let pe = 0; pe < N; pe++) {
          for (let oe = 0; oe < Re; oe++) {
            Ve = F[oe], A = Ve.h, Y = Ve.v;
            for (let e = 0; e < Y; e++)
              for (let i = 0; i < A; i++)
                ze(Ve, Ge, Be, e, i);
          }
          if (Be++, Be === v)
            break;
        }
      if (Be === v)
        do {
          if (B[z] === 255 && B[z + 1] !== 0)
            break;
          z += 1;
        } while (z < B.length - 2);
      if (re = 0, de = B[z] << 8 | B[z + 1], de < 65280)
        throw new Error("marker was not found");
      if (de >= 65488 && de <= 65495)
        z += 2;
      else
        break;
    }
    return z - G;
  }
  function ce(B) {
    const z = [], C = B.blocksPerLine, F = B.blocksPerColumn, N = C << 3, J = new Int32Array(64), W = new Uint8Array(64);
    function n(p, g, E) {
      const G = B.quantizationTable, M = E;
      for (let re = 0; re < 64; re++)
        M[re] = p[re] * G[re];
      for (let re = 0; re < 8; ++re) {
        const Q = 8 * re;
        if (M[1 + Q] == 0 && M[2 + Q] == 0 && M[3 + Q] == 0 && M[4 + Q] == 0 && M[5 + Q] == 0 && M[6 + Q] == 0 && M[7 + Q] == 0) {
          const xe = P * M[0 + Q] + 512 >> 10;
          M[0 + Q] = xe, M[1 + Q] = xe, M[2 + Q] = xe, M[3 + Q] = xe, M[4 + Q] = xe, M[5 + Q] = xe, M[6 + Q] = xe, M[7 + Q] = xe;
          continue;
        }
        let se = P * M[0 + Q] + 128 >> 8, me = P * M[4 + Q] + 128 >> 8, te = M[2 + Q], ve = M[6 + Q], ue = ee * (M[1 + Q] - M[7 + Q]) + 128 >> 8, Fe = ee * (M[1 + Q] + M[7 + Q]) + 128 >> 8, _e = M[3 + Q] << 4, Oe = M[5 + Q] << 4, Ie = se - me + 1 >> 1;
        se = se + me + 1 >> 1, me = Ie, Ie = te * a + ve * f + 128 >> 8, te = te * f - ve * a + 128 >> 8, ve = Ie, Ie = ue - Oe + 1 >> 1, ue = ue + Oe + 1 >> 1, Oe = Ie, Ie = Fe + _e + 1 >> 1, _e = Fe - _e + 1 >> 1, Fe = Ie, Ie = se - ve + 1 >> 1, se = se + ve + 1 >> 1, ve = Ie, Ie = me - te + 1 >> 1, me = me + te + 1 >> 1, te = Ie, Ie = ue * l + Fe * S + 2048 >> 12, ue = ue * S - Fe * l + 2048 >> 12, Fe = Ie, Ie = _e * k + Oe * q + 2048 >> 12, _e = _e * q - Oe * k + 2048 >> 12, Oe = Ie, M[0 + Q] = se + Fe, M[7 + Q] = se - Fe, M[1 + Q] = me + Oe, M[6 + Q] = me - Oe, M[2 + Q] = te + _e, M[5 + Q] = te - _e, M[3 + Q] = ve + ue, M[4 + Q] = ve - ue;
      }
      for (let re = 0; re < 8; ++re) {
        const Q = re;
        if (M[8 + Q] == 0 && M[16 + Q] == 0 && M[24 + Q] == 0 && M[32 + Q] == 0 && M[40 + Q] == 0 && M[48 + Q] == 0 && M[56 + Q] == 0) {
          const xe = P * E[re + 0] + 8192 >> 14;
          M[0 + Q] = xe, M[8 + Q] = xe, M[16 + Q] = xe, M[24 + Q] = xe, M[32 + Q] = xe, M[40 + Q] = xe, M[48 + Q] = xe, M[56 + Q] = xe;
          continue;
        }
        let se = P * M[0 + Q] + 2048 >> 12, me = P * M[32 + Q] + 2048 >> 12, te = M[16 + Q], ve = M[48 + Q], ue = ee * (M[8 + Q] - M[56 + Q]) + 2048 >> 12, Fe = ee * (M[8 + Q] + M[56 + Q]) + 2048 >> 12, _e = M[24 + Q], Oe = M[40 + Q], Ie = se - me + 1 >> 1;
        se = se + me + 1 >> 1, me = Ie, Ie = te * a + ve * f + 2048 >> 12, te = te * f - ve * a + 2048 >> 12, ve = Ie, Ie = ue - Oe + 1 >> 1, ue = ue + Oe + 1 >> 1, Oe = Ie, Ie = Fe + _e + 1 >> 1, _e = Fe - _e + 1 >> 1, Fe = Ie, Ie = se - ve + 1 >> 1, se = se + ve + 1 >> 1, ve = Ie, Ie = me - te + 1 >> 1, me = me + te + 1 >> 1, te = Ie, Ie = ue * l + Fe * S + 2048 >> 12, ue = ue * S - Fe * l + 2048 >> 12, Fe = Ie, Ie = _e * k + Oe * q + 2048 >> 12, _e = _e * q - Oe * k + 2048 >> 12, Oe = Ie, M[0 + Q] = se + Fe, M[56 + Q] = se - Fe, M[8 + Q] = me + Oe, M[48 + Q] = me - Oe, M[16 + Q] = te + _e, M[40 + Q] = te - _e, M[24 + Q] = ve + ue, M[32 + Q] = ve - ue;
      }
      for (let re = 0; re < 64; ++re) {
        const Q = 128 + (M[re] + 8 >> 4);
        g[re] = Q < 0 ? 0 : Q > 255 ? 255 : Q;
      }
    }
    H(N * F * 8);
    for (let p = 0; p < F; p++) {
      const g = p << 3;
      for (let E = 0; E < 8; E++)
        z.push(new Uint8Array(N));
      for (let E = 0; E < C; E++) {
        n(B.blocks[p][E], W, J);
        let G = 0;
        const M = E << 3;
        for (let re = 0; re < 8; re++) {
          const Q = z[g + re];
          for (let se = 0; se < 8; se++)
            Q[M + se] = W[G++];
        }
      }
    }
    return z;
  }
  function ie(B) {
    return B < 0 ? 0 : B > 255 ? 255 : B;
  }
  function he(B) {
    const z = {
      width: 0,
      height: 0,
      adobe: void 0,
      components: [],
      exifBuffer: void 0,
      jfif: void 0
    }, C = ye * 1e3 * 1e3;
    let F = 0;
    function N() {
      const te = B[F] << 8 | B[F + 1];
      return F += 2, te;
    }
    function J() {
      const te = N(), ve = B.subarray(F, F + te - 2);
      return F += ve.length, ve;
    }
    function W(te) {
      let ve = 0, ue = 0;
      for (let Oe in te.components)
        if (te.components.hasOwnProperty(Oe)) {
          const Ie = te.components[Oe];
          ve < Ie.h && (ve = Ie.h), ue < Ie.v && (ue = Ie.v);
        }
      const Fe = Math.ceil(te.samplesPerLine / 8 / ve), _e = Math.ceil(te.scanLines / 8 / ue);
      for (let Oe in te.components)
        if (te.components.hasOwnProperty(Oe)) {
          const Ie = te.components[Oe], xe = Math.ceil(Math.ceil(te.samplesPerLine / 8) * Ie.h / ve), Ae = Math.ceil(Math.ceil(te.scanLines / 8) * Ie.v / ue), ze = Fe * Ie.h, Pe = _e * Ie.v, Re = Pe * ze, Ve = [];
          H(Re * 256);
          for (let Ge = 0; Ge < Pe; Ge++) {
            const Be = [];
            for (let v = 0; v < ze; v++)
              Be.push(new Int32Array(64));
            Ve.push(Be);
          }
          Ie.blocksPerLine = xe, Ie.blocksPerColumn = Ae, Ie.blocks = Ve;
        }
      te.maxH = ve, te.maxV = ue, te.mcusPerLine = Fe, te.mcusPerColumn = _e;
    }
    let n = null, p = null, g, E = 0, G = [], M = [], re = [], Q = [], se = N(), me = -1;
    if (se != 65496)
      throw new Error("SOI not found");
    for (se = N(); se != 65497; ) {
      switch (se) {
        case 65280:
          break;
        case 65504:
        // APP0 (Application Specific)
        case 65505:
        // APP1
        case 65506:
        // APP2
        case 65507:
        // APP3
        case 65508:
        // APP4
        case 65509:
        // APP5
        case 65510:
        // APP6
        case 65511:
        // APP7
        case 65512:
        // APP8
        case 65513:
        // APP9
        case 65514:
        // APP10
        case 65515:
        // APP11
        case 65516:
        // APP12
        case 65517:
        // APP13
        case 65518:
        // APP14
        case 65519:
        // APP15
        case 65534: {
          const te = J();
          se === 65504 && te[0] === 74 && te[1] === 70 && te[2] === 73 && te[3] === 70 && te[4] === 0 && (n = {
            version: { major: te[5], minor: te[6] },
            densityUnits: te[7],
            xDensity: te[8] << 8 | te[9],
            yDensity: te[10] << 8 | te[11],
            thumbWidth: te[12],
            thumbHeight: te[13],
            thumbData: te.subarray(14, 14 + 3 * te[12] * te[13])
          }), se === 65505 && te[0] === 69 && te[1] === 120 && te[2] === 105 && te[3] === 102 && te[4] === 0 && (z.exifBuffer = te.subarray(5, te.length)), se === 65518 && te[0] === 65 && te[1] === 100 && te[2] === 111 && te[3] === 98 && te[4] === 101 && te[5] === 0 && (p = {
            version: te[6],
            flags0: te[7] << 8 | te[8],
            flags1: te[9] << 8 | te[10],
            transformCode: te[11]
          });
          break;
        }
        case 65499: {
          const ve = N() + F - 2;
          for (; F < ve; ) {
            const ue = B[F++];
            H(256);
            const Fe = new Int32Array(64);
            if (ue >> 4 === 0)
              for (let _e = 0; _e < 64; _e++) {
                const Oe = c[_e];
                Fe[Oe] = B[F++];
              }
            else if (ue >> 4 === 1)
              for (let _e = 0; _e < 64; _e++) {
                const Oe = c[_e];
                Fe[Oe] = N();
              }
            else
              throw new Error("DQT: invalid table spec");
            G[ue & 15] = Fe;
          }
          break;
        }
        case 65472:
        // SOF0 (Start of Frame, Baseline DCT)
        case 65473:
        // SOF1 (Start of Frame, Extended DCT)
        case 65474: {
          N(), g = {
            extended: se === 65473,
            progressive: se === 65474,
            precision: B[F++],
            scanLines: N(),
            samplesPerLine: N(),
            components: {},
            componentsOrder: [],
            maxH: 0,
            maxV: 0,
            mcusPerLine: 0,
            mcusPerColumn: 0
          };
          const te = g.scanLines * g.samplesPerLine;
          if (te > C) {
            const ue = Math.ceil((te - C) / 1e6);
            throw new Error(`maxResolutionInMP limit exceeded by ${ue}MP`);
          }
          const ve = B[F++];
          for (let ue = 0; ue < ve; ue++) {
            const Fe = B[F], _e = B[F + 1] >> 4, Oe = B[F + 1] & 15, Ie = B[F + 2];
            g.componentsOrder.push(Fe), g.components[Fe] = {
              h: _e,
              v: Oe,
              quantizationIdx: Ie,
              blocksPerColumn: 0,
              blocksPerLine: 0,
              blocks: [],
              pred: 0
            }, F += 3;
          }
          W(g), M.push(g);
          break;
        }
        case 65476: {
          const te = N();
          for (let ve = 2; ve < te; ) {
            const ue = B[F++], Fe = new Uint8Array(16);
            let _e = 0;
            for (let Ae = 0; Ae < 16; Ae++, F++)
              _e += Fe[Ae] = B[F];
            H(16 + _e);
            const Oe = new Uint8Array(_e);
            for (let Ae = 0; Ae < _e; Ae++, F++)
              Oe[Ae] = B[F];
            ve += 17 + _e;
            const Ie = ue & 15, xe = ue >> 4 === 0 ? Q : re;
            xe[Ie] = V(Fe, Oe);
          }
          break;
        }
        case 65501:
          N(), E = N();
          break;
        case 65500:
          N(), N();
          break;
        case 65498: {
          N();
          const te = B[F++], ve = [];
          for (let Ie = 0; Ie < te; Ie++) {
            const xe = g.components[B[F++]], Ae = B[F++];
            xe.huffmanTableDC = Q[Ae >> 4], xe.huffmanTableAC = re[Ae & 15], ve.push(xe);
          }
          const ue = B[F++], Fe = B[F++], _e = B[F++], Oe = le(B, F, g, ve, E, ue, Fe, _e >> 4, _e & 15);
          F += Oe;
          break;
        }
        case 65535:
          B[F] !== 255 && F--;
          break;
        default: {
          if (B[F - 3] == 255 && B[F - 2] >= 192 && B[F - 2] <= 254) {
            F -= 3;
            break;
          } else if (se === 224 || se == 225) {
            if (me !== -1)
              throw new Error(`first unknown JPEG marker at offset ${me.toString(16)}, second unknown JPEG marker ${se.toString(16)} at offset ${(F - 1).toString(16)}`);
            me = F - 1;
            const te = N();
            if (B[F + te - 2] === 255) {
              F += te - 2;
              break;
            }
          }
          throw new Error("unknown JPEG marker " + se.toString(16));
        }
      }
      se = N();
    }
    if (M.length != 1)
      throw new Error("only single frame JPEGs supported");
    for (let te = 0; te < M.length; te++) {
      const ve = M[te].components;
      for (let ue in ve)
        ve[ue].quantizationTable = G[ve[ue].quantizationIdx], delete ve[ue].quantizationIdx;
    }
    z.width = g.samplesPerLine, z.height = g.scanLines, z.jfif = n, z.adobe = p, z.components = [];
    for (let te = 0; te < g.componentsOrder.length; te++) {
      const ve = g.components[g.componentsOrder[te]];
      z.components.push({
        lines: ce(ve),
        scaleX: ve.h / g.maxH,
        scaleY: ve.v / g.maxV
      });
    }
    return z;
  }
  function fe(B) {
    let z = 0, C = !1;
    const F = B.width, N = B.height, J = F * N * B.components.length;
    H(J);
    const W = new Uint8Array(J);
    switch (B.components.length) {
      case 1: {
        const n = B.components[0];
        for (let p = 0; p < N; p++) {
          const g = n.lines[0 | p * n.scaleY];
          for (let E = 0; E < F; E++) {
            const G = g[0 | E * n.scaleX];
            W[z++] = G;
          }
        }
        break;
      }
      case 2: {
        const n = B.components[0], p = B.components[1];
        for (let g = 0; g < N; g++) {
          const E = n.lines[0 | g * n.scaleY], G = p.lines[0 | g * p.scaleY];
          for (let M = 0; M < F; M++) {
            const re = E[0 | M * n.scaleX];
            W[z++] = re;
            const Q = G[0 | M * p.scaleX];
            W[z++] = Q;
          }
        }
        break;
      }
      case 3: {
        C = !0, B.adobe && B.adobe.transformCode && (C = !0);
        const n = B.components[0], p = B.components[1], g = B.components[2];
        for (let E = 0; E < N; E++) {
          const G = n.lines[0 | E * n.scaleY], M = p.lines[0 | E * p.scaleY], re = g.lines[0 | E * g.scaleY];
          for (let Q = 0; Q < F; Q++) {
            let se, me, te, ve, ue, Fe;
            C ? (se = G[0 | Q * n.scaleX], me = M[0 | Q * p.scaleX], te = re[0 | Q * g.scaleX], ve = ie(se + 1.402 * (te - 128)), ue = ie(se - 0.3441363 * (me - 128) - 0.71413636 * (te - 128)), Fe = ie(se + 1.772 * (me - 128))) : (ve = G[0 | Q * n.scaleX], ue = M[0 | Q * p.scaleX], Fe = re[0 | Q * g.scaleX]), W[z++] = ve, W[z++] = ue, W[z++] = Fe;
          }
        }
        break;
      }
      case 4: {
        if (!B.adobe)
          throw new Error("Unsupported color mode (4 components)");
        C = !1, B.adobe && B.adobe.transformCode && (C = !0);
        const n = B.components[0], p = B.components[1], g = B.components[2], E = B.components[3];
        for (let G = 0; G < N; G++) {
          const M = n.lines[0 | G * n.scaleY], re = p.lines[0 | G * p.scaleY], Q = g.lines[0 | G * g.scaleY], se = E.lines[0 | G * E.scaleY];
          for (let me = 0; me < F; me++) {
            let te, ve, ue, Fe, _e, Oe, Ie;
            C ? (te = M[0 | me * n.scaleX], ve = re[0 | me * p.scaleX], ue = Q[0 | me * g.scaleX], Fe = se[0 | me * E.scaleX], _e = 255 - ie(te + 1.402 * (ue - 128)), Oe = 255 - ie(te - 0.3441363 * (ve - 128) - 0.71413636 * (ue - 128)), Ie = 255 - ie(te + 1.772 * (ve - 128))) : (_e = M[0 | me * n.scaleX], Oe = re[0 | me * p.scaleX], Ie = Q[0 | me * g.scaleX], Fe = se[0 | me * E.scaleX]), W[z++] = 255 - _e, W[z++] = 255 - Oe, W[z++] = 255 - Ie, W[z++] = 255 - Fe;
          }
        }
        break;
      }
      default:
        throw new Error("Unsupported color mode");
    }
    return W;
  }
  function ne(B, z) {
    if (y = 0, B.length === 0)
      throw new Error("Empty jpeg buffer");
    const C = he(B);
    H(C.width * C.height * 4);
    const F = fe(C), N = z(C.width, C.height), J = N.width, W = N.height, n = N.data;
    let p = 0, g = 0;
    switch (C.components.length) {
      case 1:
        for (let E = 0; E < W; E++)
          for (let G = 0; G < J; G++) {
            const M = F[p++];
            n[g++] = M, n[g++] = M, n[g++] = M, n[g++] = 255;
          }
        break;
      case 2:
        for (let E = 0; E < W; E++)
          for (let G = 0; G < J; G++) {
            const M = F[p++], re = F[p++];
            n[g++] = M, n[g++] = M, n[g++] = M, n[g++] = re;
          }
        break;
      case 3:
        for (let E = 0; E < W; E++)
          for (let G = 0; G < J; G++) {
            const M = F[p++], re = F[p++], Q = F[p++];
            n[g++] = M, n[g++] = re, n[g++] = Q, n[g++] = 255;
          }
        break;
      case 4:
        for (let E = 0; E < W; E++)
          for (let G = 0; G < J; G++) {
            const M = F[p++], re = F[p++], Q = F[p++], se = F[p++], me = 255 - ie(M * (1 - se / 255) + se), te = 255 - ie(re * (1 - se / 255) + se), ve = 255 - ie(Q * (1 - se / 255) + se);
            n[g++] = me, n[g++] = te, n[g++] = ve, n[g++] = 255;
          }
        break;
      default:
        throw new Error("Unsupported color mode");
    }
    return N;
  }
  return Pt;
}
var vn;
function mt() {
  return vn || (vn = 1, (function(c) {
    Object.defineProperty(c, "__esModule", { value: !0 }), c.createImageData = c.createCanvas = c.MaskParams = c.LayerMaskFlags = c.ColorSpace = c.largeAdditionalInfoKeys = c.layerColors = c.toBlendMode = c.fromBlendMode = c.RAW_IMAGE_DATA = c.MOCK_HANDLERS = void 0, c.revMap = S, c.createEnum = l, c.offsetForChannel = ee, c.clamp = ye, c.hasAlpha = O, c.resetImageData = y, c.imageDataToCanvas = H, c.decodeBitmap = V, c.writeDataRaw = le, c.writeDataRLE = ce, c.writeDataZipWithoutPrediction = ie, c.createCanvasFromData = he, c.initializeCanvas = z;
    const q = Zn(), k = ui();
    c.MOCK_HANDLERS = !1, c.RAW_IMAGE_DATA = !1, c.fromBlendMode = {}, c.toBlendMode = {
      pass: "pass through",
      norm: "normal",
      diss: "dissolve",
      dark: "darken",
      "mul ": "multiply",
      idiv: "color burn",
      lbrn: "linear burn",
      dkCl: "darker color",
      lite: "lighten",
      scrn: "screen",
      "div ": "color dodge",
      lddg: "linear dodge",
      lgCl: "lighter color",
      over: "overlay",
      sLit: "soft light",
      hLit: "hard light",
      vLit: "vivid light",
      lLit: "linear light",
      pLit: "pin light",
      hMix: "hard mix",
      diff: "difference",
      smud: "exclusion",
      fsub: "subtract",
      fdiv: "divide",
      "hue ": "hue",
      "sat ": "saturation",
      colr: "color",
      "lum ": "luminosity"
    }, Object.keys(c.toBlendMode).forEach((C) => c.fromBlendMode[c.toBlendMode[C]] = C), c.layerColors = [
      "none",
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "violet",
      "gray"
    ], c.largeAdditionalInfoKeys = [
      // from documentation
      "LMsk",
      "Lr16",
      "Lr32",
      "Layr",
      "Mt16",
      "Mt32",
      "Mtrn",
      "Alph",
      "FMsk",
      "lnk2",
      "FEid",
      "FXid",
      "PxSD",
      // from guessing
      "cinf"
    ];
    function S(C) {
      const F = {};
      return Object.keys(C).forEach((N) => F[C[N]] = N), F;
    }
    function l(C, F, N) {
      const J = S(N);
      return { decode: (p) => {
        const g = p.split(".")[1];
        if (g && !J[g]) {
          if (Object.prototype.hasOwnProperty.call(N, g))
            return g;
          const E = g.replace(/([A-Z])/g, " $1").toLowerCase();
          if (Object.prototype.hasOwnProperty.call(N, E))
            return E;
          throw new Error(`Unrecognized value for enum: '${p}'`);
        }
        return J[g] || F;
      }, encode: (p) => {
        if (p && !N[p])
          throw new Error(`Invalid value for enum: '${p}'`);
        return `${C}.${p ? N[p] : N[F]}`;
      } };
    }
    var f;
    (function(C) {
      C[C.RGB = 0] = "RGB", C[C.HSB = 1] = "HSB", C[C.CMYK = 2] = "CMYK", C[C.Lab = 7] = "Lab", C[C.Grayscale = 8] = "Grayscale";
    })(f || (c.ColorSpace = f = {}));
    var a;
    (function(C) {
      C[C.PositionRelativeToLayer = 1] = "PositionRelativeToLayer", C[C.LayerMaskDisabled = 2] = "LayerMaskDisabled", C[C.InvertLayerMaskWhenBlending = 4] = "InvertLayerMaskWhenBlending", C[C.LayerMaskFromRenderingOtherData = 8] = "LayerMaskFromRenderingOtherData", C[C.MaskHasParametersAppliedToIt = 16] = "MaskHasParametersAppliedToIt";
    })(a || (c.LayerMaskFlags = a = {}));
    var P;
    (function(C) {
      C[C.UserMaskDensity = 1] = "UserMaskDensity", C[C.UserMaskFeather = 2] = "UserMaskFeather", C[C.VectorMaskDensity = 4] = "VectorMaskDensity", C[C.VectorMaskFeather = 8] = "VectorMaskFeather";
    })(P || (c.MaskParams = P = {}));
    function ee(C, F) {
      switch (C) {
        case 0:
          return 0;
        case 1:
          return 1;
        case 2:
          return 2;
        case 3:
          return F ? 3 : C + 1;
        case -1:
          return F ? 4 : 3;
        default:
          return C + 1;
      }
    }
    function ye(C, F, N) {
      return C < F ? F : C > N ? N : C;
    }
    function O(C) {
      const F = C.width * C.height * 4;
      for (let N = 3; N < F; N += 4)
        if (C.data[N] !== 255)
          return !0;
      return !1;
    }
    function y({ data: C }) {
      const F = C instanceof Float32Array ? 1 : C instanceof Uint16Array ? 65535 : 255;
      for (let N = 0, J = C.length | 0; N < J; N = N + 4 | 0)
        C[N + 0] = 0, C[N + 1] = 0, C[N + 2] = 0, C[N + 3] = F;
    }
    function H(C) {
      const F = (0, c.createCanvas)(C.width, C.height);
      let N;
      if (C.data instanceof Uint8ClampedArray)
        N = C;
      else {
        N = (0, c.createImageData)(C.width, C.height);
        const J = C.data, W = N.data;
        if (J instanceof Float32Array)
          for (let n = 0, p = J.length; n < p; n += 4)
            W[n + 0] = Math.round(Math.pow(J[n + 0], 1 / 2.2) * 255), W[n + 1] = Math.round(Math.pow(J[n + 1], 1 / 2.2) * 255), W[n + 2] = Math.round(Math.pow(J[n + 2], 1 / 2.2) * 255), W[n + 3] = Math.round(J[n + 3] * 255);
        else {
          const n = J instanceof Uint16Array ? 8 : 0;
          for (let p = 0, g = J.length; p < g; p++)
            W[p] = J[p] >>> n;
        }
      }
      return F.getContext("2d").putImageData(N, 0, 0), F;
    }
    function V(C, F, N, J) {
      if (!(C instanceof Uint8Array || C instanceof Uint8ClampedArray))
        throw new Error("Invalid bit depth");
      for (let W = 0, n = 0, p = 0; W < J; W++)
        for (let g = 0; g < N; ) {
          let E = C[p++];
          for (let G = 0; G < 8 && g < N; G++, g++, n += 4) {
            const M = E & 128 ? 0 : 255;
            E = E << 1, F[n + 0] = M, F[n + 1] = M, F[n + 2] = M, F[n + 3] = 255;
          }
        }
    }
    function le(C, F, N, J) {
      if (!N || !J)
        return;
      const W = new Uint8Array(N * J);
      for (let n = 0; n < W.length; n++)
        W[n] = C.data[n * 4 + F];
      return W;
    }
    function ce(C, { data: F, width: N, height: J }, W, n) {
      if (!N || !J)
        return;
      const p = 4 * N | 0;
      let g = 0, E = W.length * (n ? 4 : 2) * J | 0;
      for (const G of W)
        for (let M = 0, re = G | 0; M < J; M++) {
          const Q = M * p | 0, se = Q + p | 0, me = se + G - 4 | 0, te = me - 4 | 0, ve = E;
          for (re = Q + G | 0; re < se; re = re + 4 | 0)
            if (re < te) {
              let Fe = F[re];
              re = re + 4 | 0;
              let _e = F[re];
              re = re + 4 | 0;
              let Oe = F[re];
              if (Fe === _e && Fe === Oe) {
                let Ie = 3;
                for (; Ie < 128 && re < me && F[re + 4 | 0] === Fe; )
                  Ie = Ie + 1 | 0, re = re + 4 | 0;
                C[E++] = 1 - Ie, C[E++] = Fe;
              } else {
                const Ie = E;
                let xe = !0, Ae = 1;
                for (C[E++] = 0, C[E++] = Fe; re < me && Ae < 128; )
                  if (re = re + 4 | 0, Fe = _e, _e = Oe, Oe = F[re], Fe === _e && Fe === Oe) {
                    re = re - 12 | 0, xe = !1;
                    break;
                  } else
                    Ae++, C[E++] = Fe;
                xe && (Ae < 127 ? (C[E++] = _e, C[E++] = Oe, Ae += 2) : Ae < 128 ? (C[E++] = _e, Ae++, re = re - 4 | 0) : re = re - 8 | 0), C[Ie] = Ae - 1;
              }
            } else re === me ? (C[E++] = 0, C[E++] = F[re]) : (C[E++] = 1, C[E++] = F[re], re = re + 4 | 0, C[E++] = F[re]);
          const ue = E - ve;
          n && (C[g++] = ue >> 24 & 255, C[g++] = ue >> 16 & 255), C[g++] = ue >> 8 & 255, C[g++] = ue & 255;
        }
      return C.slice(0, E);
    }
    function ie({ data: C, width: F, height: N }, J) {
      const W = F * N, n = new Uint8Array(W), p = [];
      let g = 0;
      for (const E of J) {
        for (let M = 0, re = E; M < W; M++, re += 4)
          n[M] = C[re];
        const G = (0, q.deflate)(n);
        p.push(G), g += G.byteLength;
      }
      if (p.length > 0) {
        const E = new Uint8Array(g);
        let G = 0;
        for (const M of p)
          E.set(M, G), G += M.byteLength;
        return E;
      } else
        return p[0];
    }
    function he(C) {
      const F = (0, c.createCanvas)(100, 100);
      try {
        const N = F.getContext("2d"), J = (0, k.decodeJpeg)(C, (W, n) => N.createImageData(W, n));
        F.width = J.width, F.height = J.height, N.putImageData(J, 0, 0);
      } catch (N) {
        console.error("JPEG decompression error", N.message);
      }
      return F;
    }
    let fe = () => {
      throw new Error("Canvas not initialized, use initializeCanvas method to set up createCanvas method");
    };
    c.createCanvas = fe;
    let ne, B = (C, F) => (ne || (ne = (0, c.createCanvas)(1, 1)), ne.getContext("2d").createImageData(C, F));
    c.createImageData = B, typeof document < "u" && (c.createCanvas = (C, F) => {
      const N = document.createElement("canvas");
      return N.width = C, N.height = F, N;
    });
    function z(C, F) {
      c.createCanvas = C, c.createImageData = F || c.createImageData;
    }
  })(jt)), jt;
}
var Xt = {}, It = {}, kn;
function Jt() {
  if (kn) return It;
  kn = 1, It.byteLength = P, It.toByteArray = ye, It.fromByteArray = H;
  for (var c = [], q = [], k = typeof Uint8Array < "u" ? Uint8Array : Array, S = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", l = 0, f = S.length; l < f; ++l)
    c[l] = S[l], q[S.charCodeAt(l)] = l;
  q[45] = 62, q[95] = 63;
  function a(V) {
    var le = V.length;
    if (le % 4 > 0)
      throw new Error("Invalid string. Length must be a multiple of 4");
    var ce = V.indexOf("=");
    ce === -1 && (ce = le);
    var ie = ce === le ? 0 : 4 - ce % 4;
    return [ce, ie];
  }
  function P(V) {
    var le = a(V), ce = le[0], ie = le[1];
    return (ce + ie) * 3 / 4 - ie;
  }
  function ee(V, le, ce) {
    return (le + ce) * 3 / 4 - ce;
  }
  function ye(V) {
    var le, ce = a(V), ie = ce[0], he = ce[1], fe = new k(ee(V, ie, he)), ne = 0, B = he > 0 ? ie - 4 : ie, z;
    for (z = 0; z < B; z += 4)
      le = q[V.charCodeAt(z)] << 18 | q[V.charCodeAt(z + 1)] << 12 | q[V.charCodeAt(z + 2)] << 6 | q[V.charCodeAt(z + 3)], fe[ne++] = le >> 16 & 255, fe[ne++] = le >> 8 & 255, fe[ne++] = le & 255;
    return he === 2 && (le = q[V.charCodeAt(z)] << 2 | q[V.charCodeAt(z + 1)] >> 4, fe[ne++] = le & 255), he === 1 && (le = q[V.charCodeAt(z)] << 10 | q[V.charCodeAt(z + 1)] << 4 | q[V.charCodeAt(z + 2)] >> 2, fe[ne++] = le >> 8 & 255, fe[ne++] = le & 255), fe;
  }
  function O(V) {
    return c[V >> 18 & 63] + c[V >> 12 & 63] + c[V >> 6 & 63] + c[V & 63];
  }
  function y(V, le, ce) {
    for (var ie, he = [], fe = le; fe < ce; fe += 3)
      ie = (V[fe] << 16 & 16711680) + (V[fe + 1] << 8 & 65280) + (V[fe + 2] & 255), he.push(O(ie));
    return he.join("");
  }
  function H(V) {
    for (var le, ce = V.length, ie = ce % 3, he = [], fe = 16383, ne = 0, B = ce - ie; ne < B; ne += fe)
      he.push(y(V, ne, ne + fe > B ? B : ne + fe));
    return ie === 1 ? (le = V[ce - 1], he.push(
      c[le >> 2] + c[le << 4 & 63] + "=="
    )) : ie === 2 && (le = (V[ce - 2] << 8) + V[ce - 1], he.push(
      c[le >> 10] + c[le >> 4 & 63] + c[le << 2 & 63] + "="
    )), he.join("");
  }
  return It;
}
var Ft = {}, Dt = {}, qt = {}, ht = {}, In;
function hi() {
  if (In) return ht;
  In = 1, Object.defineProperty(ht, "__esModule", { value: !0 }), ht.stringLengthInBytes = k, ht.encodeStringTo = l, ht.encodeString = f, ht.decodeString = a;
  function c(P) {
    return (P & 4294967168) === 0 ? 1 : (P & 4294965248) === 0 ? 2 : (P & 4294901760) === 0 ? 3 : 4;
  }
  function q(P, ee) {
    const ye = P.charCodeAt(ee);
    if (ye >= 55296 && ye <= 56319 && ee + 1 < P.length) {
      const O = P.charCodeAt(ee + 1);
      if (O >= 56320 && O <= 57343)
        return { code: ((ye & 1023) << 10) + (O & 1023) + 65536, size: 2 };
    }
    return ye >= 55296 && ye <= 57343 ? { code: 65533, size: 1 } : { code: ye, size: 1 };
  }
  function k(P) {
    let ee = 0;
    for (let ye = 0; ye < P.length; ) {
      const { code: O, size: y } = q(P, ye);
      ee += c(O), ye += y;
    }
    return ee;
  }
  function S(P, ee, ye) {
    const O = c(ye);
    switch (O) {
      case 1:
        P[ee] = ye;
        break;
      case 2:
        P[ee] = ye >> 6 & 31 | 192, P[ee + 1] = ye & 63 | 128;
        break;
      case 3:
        P[ee] = ye >> 12 & 15 | 224, P[ee + 1] = ye >> 6 & 63 | 128, P[ee + 2] = ye & 63 | 128;
        break;
      default:
        P[ee] = ye >> 18 & 7 | 240, P[ee + 1] = ye >> 12 & 63 | 128, P[ee + 2] = ye >> 6 & 63 | 128, P[ee + 3] = ye & 63 | 128;
        break;
    }
    return O;
  }
  function l(P, ee, ye) {
    for (let O = 0; O < ye.length; ) {
      const { code: y, size: H } = q(ye, O);
      ee += S(P, ee, y), O += H;
    }
    return ee;
  }
  function f(P) {
    if (P.length > 1e3 && typeof TextEncoder < "u")
      return new TextEncoder().encode(P);
    const ee = new Uint8Array(k(P));
    return l(ee, 0, P), ee;
  }
  function a(P) {
    if (P.byteLength > 1e3 && typeof TextDecoder < "u")
      return new TextDecoder().decode(P);
    const ee = [];
    function ye(ce) {
      ce > 65535 && (ce -= 65536, ee.push(String.fromCharCode(ce >>> 10 & 1023 | 55296)), ce = 56320 | ce & 1023), ee.push(String.fromCharCode(ce));
    }
    let O = 0, y = 0, H = 0, V = 128, le = 191;
    for (let ce = 0; ce < P.length; ce++) {
      const ie = P[ce];
      if (H === 0) {
        ie <= 127 ? ye(ie) : ie >= 194 && ie <= 223 ? (H = 1, O = ie & 31) : ie >= 224 && ie <= 239 ? (ie === 224 && (V = 160), ie === 237 && (le = 159), H = 2, O = ie & 15) : ie >= 240 && ie <= 244 ? (ie === 240 && (V = 144), ie === 244 && (le = 143), H = 3, O = ie & 7) : ye(65533);
        continue;
      }
      if (ie < V || ie > le) {
        O = 0, H = 0, y = 0, V = 128, le = 191, ye(65533), ce--;
        continue;
      }
      V = 128, le = 191, O = O << 6 | ie & 63, y++, y === H && (ye(O), O = 0, H = 0, y = 0);
    }
    return H !== 0 && ye(65533), ee.join("");
  }
  return ht;
}
var Ot = {}, Fn;
function Qt() {
  return Fn || (Fn = 1, (function(c) {
    var q = Ot && Ot.__rest || function(o, _) {
      var I = {};
      for (var x in o) Object.prototype.hasOwnProperty.call(o, x) && _.indexOf(x) < 0 && (I[x] = o[x]);
      if (o != null && typeof Object.getOwnPropertySymbols == "function")
        for (var b = 0, x = Object.getOwnPropertySymbols(o); b < x.length; b++)
          _.indexOf(x[b]) < 0 && Object.prototype.propertyIsEnumerable.call(o, x[b]) && (I[x[b]] = o[x[b]]);
      return I;
    };
    Object.defineProperty(c, "__esModule", { value: !0 }), c.IntC = c.IntE = c.Drct = c.WndM = c.CntE = c.FlCl = c.ExtR = c.ExtT = c.DfsM = c.blurType = c.Lns = c.MztT = c.Chnl = c.Dstr = c.ZZTy = c.Wvtp = c.SphM = c.RplS = c.Cnvr = c.UndA = c.DspM = c.SmBQ = c.SmBM = c.BlrQ = c.BlrM = c.strokeStyleLineAlignment = c.strokeStyleLineJoinType = c.strokeStyleLineCapType = c.ESliceBGColorType = c.ESliceOrigin = c.ESliceVertAlign = c.ESliceHorzAlign = c.ESliceType = c.FrFl = c.FStl = c.ClrS = c.gradientInterpolationMethodType = c.stdTrackID = c.animInterpStyleEnum = c.GrdT = c.IGSr = c.BETE = c.BESs = c.bvlT = c.BESl = c.BlnM = c.warpStyle = c.Annt = c.Ornt = c.textGridding = void 0, c.presetKindType = c.prjM = c.FlMd = void 0, c.setLogErrors = ye, c.readAsciiStringOrClassId = ne, c.readDescriptorStructure = z, c.writeDescriptorStructure = C, c.readVersionAndDescriptor = E, c.writeVersionAndDescriptor = G, c.horzVrtcToXY = M, c.xyToHorzVrtc = re, c.descBoundsToBounds = Q, c.boundsToDescBounds = se, c.serializeEffects = ve, c.parseEffects = ue, c.parseTrackList = Oe, c.serializeTrackList = Ie, c.parseVectorContent = Ge, c.serializeVectorContent = A, c.parseColor = Y, c.serializeColor = de, c.parseAngle = pe, c.parsePercent = oe, c.parsePercentOrAngle = e, c.parseUnits = i, c.parseUnitsOrNumber = r, c.parseUnitsToNumber = h, c.unitsAngle = w, c.unitsPercent = U, c.unitsPercentF = Z, c.unitsValue = d, c.frac = L;
    const k = mt(), S = bt(), l = At();
    function f(o) {
      const _ = {};
      return Object.keys(o).forEach((I) => _[o[I]] = I), _;
    }
    const a = {
      "#Ang": "Angle",
      "#Rsl": "Density",
      "#Rlt": "Distance",
      "#Nne": "None",
      "#Prc": "Percent",
      "#Pxl": "Pixels",
      "#Mlm": "Millimeters",
      "#Pnt": "Points",
      RrPi: "Picas",
      RrIn: "Inches",
      RrCm: "Centimeters"
    }, P = f(a);
    let ee = !1;
    function ye(o) {
      ee = o;
    }
    function O(o, _) {
      return { name: o, classID: _ };
    }
    const y = O("", "null"), H = {
      strokeStyleContent: O("", "solidColorLayer"),
      printProofSetup: O("Proof Setup", "proofSetup"),
      Grad: O("Gradient", "Grdn"),
      Trnf: O("Transform", "Trnf"),
      patternFill: O("", "patternFill"),
      ebbl: O("", "ebbl"),
      SoFi: O("", "SoFi"),
      GrFl: O("", "GrFl"),
      sdwC: O("", "RGBC"),
      hglC: O("", "RGBC"),
      "Clr ": O("", "RGBC"),
      tintColor: O("", "RGBC"),
      Ofst: O("", "Pnt "),
      ChFX: O("", "ChFX"),
      MpgS: O("", "ShpC"),
      DrSh: O("", "DrSh"),
      IrSh: O("", "IrSh"),
      OrGl: O("", "OrGl"),
      IrGl: O("", "IrGl"),
      TrnS: O("", "ShpC"),
      Ptrn: O("", "Ptrn"),
      FrFX: O("", "FrFX"),
      phase: O("", "Pnt "),
      frameStep: y,
      duration: y,
      workInTime: y,
      workOutTime: y,
      audioClipGroupList: y,
      bounds: O("", "Rctn"),
      customEnvelopeWarp: O("", "customEnvelopeWarp"),
      warp: O("", "warp"),
      "Sz  ": O("", "Pnt "),
      origin: O("", "Pnt "),
      autoExpandOffset: O("", "Pnt "),
      keyOriginShapeBBox: O("", "unitRect"),
      Vrsn: y,
      psVersion: y,
      docDefaultNewArtboardBackgroundColor: O("", "RGBC"),
      artboardRect: O("", "classFloatRect"),
      keyOriginRRectRadii: O("", "radii"),
      keyOriginBoxCorners: y,
      rectangleCornerA: O("", "Pnt "),
      rectangleCornerB: O("", "Pnt "),
      rectangleCornerC: O("", "Pnt "),
      rectangleCornerD: O("", "Pnt "),
      compInfo: y,
      quiltWarp: O("", "quiltWarp"),
      generatorSettings: y,
      crema: y,
      FrIn: y,
      blendOptions: y,
      FXRf: y,
      Lefx: y,
      time: y,
      animKey: y,
      timeScope: y,
      inTime: y,
      outTime: y,
      sheetStyle: y,
      translation: y,
      Skew: y,
      boundingBox: O("", "boundingBox"),
      "Lnk ": O("", "ExternalFileLink"),
      frameReader: O("", "FrameReader"),
      effectParams: O("", "motionTrackEffectParams"),
      Impr: O("None", "none"),
      Anch: O("", "Pnt "),
      "Fwd ": O("", "Pnt "),
      "Bwd ": O("", "Pnt "),
      FlrC: O("", "Pnt "),
      meshBoundaryPath: O("", "pathClass"),
      filterFX: O("", "filterFXStyle"),
      Fltr: O("", "rigidTransform"),
      FrgC: O("", "RGBC"),
      BckC: O("", "RGBC"),
      sdwM: O("Parameters", "adaptCorrectTones"),
      hglM: O("Parameters", "adaptCorrectTones"),
      customShape: O("", "customShape"),
      origFXRefPoint: y,
      FXRefPoint: y,
      ClMg: O("", "ClMg")
    }, V = {
      "Crv ": O("", "CrPt"),
      Clrs: O("", "Clrt"),
      Trns: O("", "TrnS"),
      keyDescriptorList: y,
      solidFillMulti: O("", "SoFi"),
      gradientFillMulti: O("", "GrFl"),
      dropShadowMulti: O("", "DrSh"),
      innerShadowMulti: O("", "IrSh"),
      frameFXMulti: O("", "FrFX"),
      FrIn: y,
      FSts: y,
      LaSt: y,
      sheetTimelineOptions: y,
      trackList: O("", "animationTrack"),
      globalTrackList: O("", "animationTrack"),
      keyList: y,
      audioClipGroupList: y,
      audioClipList: y,
      countObjectList: O("", "countObject"),
      countGroupList: O("", "countGroup"),
      slices: O("", "slice"),
      "Pts ": O("", "Pthp"),
      SbpL: O("", "SbpL"),
      pathComponents: O("", "PaCm"),
      filterFXList: O("", "filterFX"),
      puppetShapeList: O("", "puppetShape"),
      channelDenoise: O("", "channelDenoiseParams"),
      ShrP: O("", "Pnt "),
      layerSettings: y,
      list: y,
      Adjs: O("", "CrvA")
    }, le = {
      TEXT: [
        "Txt ",
        "printerName",
        "Nm  ",
        "Idnt",
        "blackAndWhitePresetFileName",
        "LUT3DFileName",
        "presetFileName",
        "curvesPresetFileName",
        "mixerPresetFileName",
        "placed",
        "description",
        "reason",
        "artboardPresetName",
        "json",
        "clipID",
        "relPath",
        "fullPath",
        "mediaDescriptor",
        "Msge",
        "altTag",
        "url",
        "cellText",
        "preset",
        "KnNm",
        "FPth",
        "comment",
        "originalPath"
      ],
      tdta: [
        "EngineData",
        "LUT3DFileData",
        "indexArray",
        "originalVertexArray",
        "deformedVertexArray",
        "LqMe"
      ],
      long: [
        "TextIndex",
        "RndS",
        "Mdpn",
        "Smth",
        "Lctn",
        "strokeStyleVersion",
        "LaID",
        "Vrsn",
        "Cnt ",
        "Brgh",
        "Cntr",
        "means",
        "vibrance",
        "Strt",
        "bwPresetKind",
        "comp",
        "compID",
        "originalCompID",
        "curvesPresetKind",
        "mixerPresetKind",
        "uOrder",
        "vOrder",
        "PgNm",
        "totalPages",
        "Crop",
        "numerator",
        "denominator",
        "frameCount",
        "Annt",
        "keyOriginType",
        "unitValueQuadVersion",
        "keyOriginIndex",
        "major",
        "minor",
        "fix",
        "docDefaultNewArtboardBackgroundType",
        "artboardBackgroundType",
        "numModifyingFX",
        "deformNumRows",
        "deformNumCols",
        "FrID",
        "FrDl",
        "FsID",
        "LCnt",
        "AFrm",
        "AFSt",
        "numBefore",
        "numAfter",
        "Spcn",
        "minOpacity",
        "maxOpacity",
        "BlnM",
        "sheetID",
        "gblA",
        "globalAltitude",
        "descVersion",
        "frameReaderType",
        "LyrI",
        "zoomOrigin",
        "fontSize",
        "Rds ",
        "sliceID",
        "topOutset",
        "leftOutset",
        "bottomOutset",
        "rightOutset",
        "filterID",
        "meshQuality",
        "meshExpansion",
        "meshRigidity",
        "VrsM",
        "VrsN",
        "NmbG",
        "WLMn",
        "WLMx",
        "AmMn",
        "AmMx",
        "SclH",
        "SclV",
        "Lvl ",
        "TlNm",
        "TlOf",
        "FlRs",
        "Thsh",
        "ShrS",
        "ShrE",
        "FlRs",
        "Vrnc",
        "Strg",
        "ExtS",
        "ExtD",
        "HrzS",
        "VrtS",
        "NmbR",
        "EdgF",
        "Ang1",
        "Ang2",
        "Ang3",
        "Ang4",
        "lastAppliedComp",
        "capturedInfo"
      ],
      enum: [
        "textGridding",
        "Ornt",
        "warpStyle",
        "warpRotate",
        "Inte",
        "Bltn",
        "ClrS",
        "BlrQ",
        "bvlT",
        "bvlS",
        "bvlD",
        "Md  ",
        "glwS",
        "GrdF",
        "GlwT",
        "RplS",
        "BlrM",
        "SmBM",
        "strokeStyleLineCapType",
        "strokeStyleLineJoinType",
        "strokeStyleLineAlignment",
        "strokeStyleBlendMode",
        "PntT",
        "Styl",
        "lookupType",
        "LUTFormat",
        "dataOrder",
        "tableOrder",
        "enableCompCore",
        "enableCompCoreGPU",
        "compCoreSupport",
        "compCoreGPUSupport",
        "Engn",
        "enableCompCoreThreads",
        "gs99",
        "FrDs",
        "trackID",
        "animInterpStyle",
        "horzAlign",
        "vertAlign",
        "bgColorType",
        "shapeOperation",
        "UndA",
        "Wvtp",
        "Drct",
        "WndM",
        "Edg ",
        "FlCl",
        "IntE",
        "IntC",
        "Cnvr",
        "Fl  ",
        "Dstr",
        "MztT",
        "Lns ",
        "ExtT",
        "DspM",
        "ExtR",
        "ZZTy",
        "SphM",
        "SmBQ",
        "placedLayerOCIOConversion",
        "gradientsInterpolationMethod"
      ],
      bool: [
        "PstS",
        "printSixteenBit",
        "masterFXSwitch",
        "enab",
        "uglg",
        "antialiasGloss",
        "useShape",
        "useTexture",
        "uglg",
        "antialiasGloss",
        "useShape",
        "Vsbl",
        "useTexture",
        "Algn",
        "Rvrs",
        "Dthr",
        "Invr",
        "VctC",
        "ShTr",
        "layerConceals",
        "strokeEnabled",
        "fillEnabled",
        "strokeStyleScaleLock",
        "strokeStyleStrokeAdjust",
        "hardProof",
        "MpBl",
        "paperWhite",
        "useLegacy",
        "Auto",
        "Lab ",
        "useTint",
        "keyShapeInvalidated",
        "autoExpandEnabled",
        "autoNestEnabled",
        "autoPositionEnabled",
        "shrinkwrapOnSaveEnabled",
        "present",
        "showInDialog",
        "overprint",
        "sheetDisclosed",
        "lightsDisclosed",
        "meshesDisclosed",
        "materialsDisclosed",
        "hasMotion",
        "muted",
        "Effc",
        "selected",
        "autoScope",
        "fillCanvas",
        "cellTextIsHTML",
        "Smoo",
        "Clsp",
        "validAtPosition",
        "rigidType",
        "hasoptions",
        "filterMaskEnable",
        "filterMaskLinked",
        "filterMaskExtendWithWhite",
        "removeJPEGArtifact",
        "Mnch",
        "ExtF",
        "ExtM",
        "moreAccurate",
        "GpuY",
        "LIWy",
        "Cnty"
      ],
      doub: [
        "warpValue",
        "warpPerspective",
        "warpPerspectiveOther",
        "Intr",
        "Wdth",
        "Hght",
        "strokeStyleMiterLimit",
        "strokeStyleResolution",
        "layerTime",
        "keyOriginResolution",
        "xx",
        "xy",
        "yx",
        "yy",
        "tx",
        "ty",
        "FrGA",
        "frameRate",
        "audioLevel",
        "rotation",
        "X   ",
        "Y   ",
        "redFloat",
        "greenFloat",
        "blueFloat",
        "imageResolution",
        "PuX0",
        "PuX1",
        "PuX2",
        "PuX3",
        "PuY0",
        "PuY1",
        "PuY2",
        "PuY3"
      ],
      UntF: [
        "sdwO",
        "hglO",
        "lagl",
        "Lald",
        "srgR",
        "blur",
        "Sftn",
        "Opct",
        "Dstn",
        "Angl",
        "Ckmt",
        "Nose",
        "Inpr",
        "ShdN",
        "strokeStyleLineWidth",
        "strokeStyleLineDashOffset",
        "strokeStyleOpacity",
        "H   ",
        "Top ",
        "Left",
        "Btom",
        "Rght",
        "Rslt",
        "topRight",
        "topLeft",
        "bottomLeft",
        "bottomRight",
        "ClNs",
        "Shrp"
      ],
      VlLs: [
        "Crv ",
        "Clrs",
        "Mnm ",
        "Mxm ",
        "Trns",
        "pathList",
        "strokeStyleLineDashSet",
        "FrLs",
        "slices",
        "LaSt",
        "Trnf",
        "nonAffineTransform",
        "keyDescriptorList",
        "guideIndeces",
        "gradientFillMulti",
        "solidFillMulti",
        "frameFXMulti",
        "innerShadowMulti",
        "dropShadowMulti",
        "FrIn",
        "FSts",
        "FsFr",
        "sheetTimelineOptions",
        "audioClipList",
        "trackList",
        "globalTrackList",
        "keyList",
        "audioClipList",
        "warpValues",
        "selectedPin",
        "Pts ",
        "SbpL",
        "pathComponents",
        "pinOffsets",
        "posFinalPins",
        "pinVertexIndices",
        "PinP",
        "PnRt",
        "PnOv",
        "PnDp",
        "filterFXList",
        "puppetShapeList",
        "ShrP",
        "channelDenoise",
        "Mtrx",
        "layerSettings",
        "list",
        "compList",
        "Adjs"
      ],
      ObAr: ["meshPoints", "quiltSliceX", "quiltSliceY"],
      "obj ": ["null", "Chnl"],
      "Pth ": ["DspF"]
    }, ce = [
      "Rd  ",
      "Grn ",
      "Bl  ",
      "Yllw",
      "Ylw ",
      "Cyn ",
      "Mgnt",
      "Blck",
      "Gry ",
      "Lmnc",
      "A   ",
      "B   "
    ], ie = {
      "Mnm ": "long",
      "Mxm ": "long",
      FrLs: "long",
      strokeStyleLineDashSet: "UntF",
      Trnf: "doub",
      nonAffineTransform: "doub",
      keyDescriptorList: "Objc",
      gradientFillMulti: "Objc",
      solidFillMulti: "Objc",
      frameFXMulti: "Objc",
      innerShadowMulti: "Objc",
      dropShadowMulti: "Objc",
      LaSt: "Objc",
      FrIn: "Objc",
      FSts: "Objc",
      FsFr: "long",
      blendOptions: "Objc",
      sheetTimelineOptions: "Objc",
      keyList: "Objc",
      warpValues: "doub",
      selectedPin: "long",
      "Pts ": "Objc",
      SbpL: "Objc",
      pathComponents: "Objc",
      pinOffsets: "doub",
      posFinalPins: "doub",
      pinVertexIndices: "long",
      PinP: "doub",
      PnRt: "long",
      PnOv: "bool",
      PnDp: "doub",
      filterFXList: "Objc",
      puppetShapeList: "Objc",
      ShrP: "Objc",
      channelDenoise: "Objc",
      Mtrx: "long",
      compList: "long",
      Chnl: "enum"
    }, he = {};
    for (const o of Object.keys(le))
      for (const _ of le[o])
        he[_] = o;
    for (const o of Object.keys(H))
      he[o] || (he[o] = "Objc");
    for (const o of Object.keys(V))
      ie[o] = "Objc";
    function fe(o, _, I, x) {
      return o === "presetKind" ? typeof _ == "string" ? "enum" : "long" : o === "null" && I === "slices" ? "TEXT" : o === "groupID" ? I === "slices" ? "long" : "TEXT" : o === "Sz  " ? "Wdth" in _ ? "Objc" : "units" in _ ? "UntF" : "doub" : o === "Type" ? typeof _ == "string" ? "enum" : "long" : o === "AntA" ? typeof _ == "string" ? "enum" : "bool" : (o === "Hrzn" || o === "Vrtc") && (x.Type === "keyType.Pstn" || x._classID === "Ofst") ? "long" : o === "Hrzn" || o === "Vrtc" || o === "Top " || o === "Left" || o === "Btom" || o === "Rght" ? I === "slices" ? "long" : typeof _ == "number" ? "doub" : "UntF" : o === "Vrsn" ? typeof _ == "number" ? "long" : "Objc" : o === "Rd  " || o === "Grn " || o === "Bl  " ? I === "artd" ? "long" : "doub" : o === "Trnf" ? Array.isArray(_) ? "VlLs" : "Objc" : he[o];
    }
    function ne(o) {
      const _ = (0, S.readInt32)(o);
      return (0, S.readAsciiString)(o, _ || 4);
    }
    function B(o, _) {
      if (_.length === 4 && _ !== "warp" && _ !== "time" && _ !== "hold" && _ !== "list")
        (0, l.writeInt32)(o, 0), (0, l.writeSignature)(o, _);
      else {
        (0, l.writeInt32)(o, _.length);
        for (let I = 0; I < _.length; I++)
          (0, l.writeUint8)(o, _.charCodeAt(I));
      }
    }
    function z(o, _) {
      const I = p(o), x = _ ? { _name: I.name, _classID: I.classID } : {}, b = (0, S.readUint32)(o);
      for (let X = 0; X < b; X++) {
        const u = ne(o), $ = (0, S.readSignature)(o), be = F(o, $, _);
        x[u] = be;
      }
      return x;
    }
    function C(o, _, I, x, b) {
      ee && !I && console.log("Missing classId for: ", _, I, x), (0, l.writeUnicodeStringWithPadding)(o, _), B(o, I);
      const X = Object.keys(x);
      let u = X.length;
      "_name" in x && u--, "_classID" in x && u--, (0, l.writeUint32)(o, u);
      for (const $ of X) {
        if ($ === "_name" || $ === "_classID")
          continue;
        let be = fe($, x[$], b, x), ge = H[$];
        $ === "bounds" && b === "text" ? ge = O("", "bounds") : $ === "origin" ? be = b === "slices" ? "enum" : "Objc" : ($ === "Cyn " || $ === "Mgnt" || $ === "Ylw " || $ === "Blck") && x._classID === "CMYC" ? be = "doub" : /^PN[a-z][a-z]$/.test($) ? be = "TEXT" : /^PT[a-z][a-z]$/.test($) ? be = "long" : /^PF[a-z][a-z]$/.test($) || ($ === "Rds " || $ === "Thsh") && typeof x[$] == "number" && x._classID === "SmrB" ? be = "doub" : $ === "ClSz" || $ === "Rds " || $ === "Amnt" ? be = typeof x[$] == "number" ? "long" : "UntF" : ($ === "sdwM" || $ === "hglM") && typeof x[$] == "string" || $ === "blur" && typeof x[$] == "string" ? be = "enum" : $ === "Hght" && typeof x[$] == "number" && x._classID === "Embs" || $ === "Angl" && typeof x[$] == "number" && (x._classID === "Embs" || x._classID === "smartSharpen" || x._classID === "Twrl" || x._classID === "MtnB") ? be = "long" : $ === "Angl" && typeof x[$] == "number" ? be = "doub" : $ === "bounds" && b === "slices" ? (be = "Objc", ge = O("", "Rct1")) : $ === "Scl " ? typeof x[$] == "object" && "Hrzn" in x[$] ? (be = "Objc", ge = y) : typeof x[$] == "number" ? be = "long" : be = "UntF" : $ === "audioClipGroupList" && X.length === 1 ? be = "VlLs" : ($ === "Strt" || $ === "Brgh") && "H   " in x ? be = "doub" : $ === "Wdth" && typeof x[$] == "object" ? be = "UntF" : $ === "Ofst" && typeof x[$] == "number" ? be = "long" : $ === "Strt" && typeof x[$] == "object" ? (be = "Objc", ge = y) : ce.indexOf($) !== -1 ? be = I === "RGBC" && b !== "artd" ? "doub" : "long" : $ === "profile" ? be = I === "printOutput" ? "TEXT" : "tdta" : $ === "strokeStyleContent" ? x[$]["Clr "] ? ge = O("", "solidColorLayer") : x[$].Grad ? ge = O("", "gradientLayer") : x[$].Ptrn ? ge = O("", "patternLayer") : ee && console.log("Invalid strokeStyleContent value", x[$]) : $ === "bounds" && b === "quiltWarp" && (ge = O("", "classFloatRect")), ge && ge.classID === "RGBC" && "H   " in x[$] && (ge = { classID: "HSBC", name: "" }), B(o, $), (0, l.writeSignature)(o, be || "long"), J(o, be || "long", x[$], $, ge, b), ee && !be && console.log(`Missing descriptor field type for: '${$}' in`, x);
      }
    }
    function F(o, _, I) {
      switch (_) {
        case "obj ":
          return W(o);
        case "Objc":
        // Descriptor
        case "GlbO":
          return z(o, I);
        case "VlLs": {
          const x = (0, S.readInt32)(o), b = [];
          for (let X = 0; X < x; X++) {
            const u = (0, S.readSignature)(o);
            b.push(F(o, u, I));
          }
          return b;
        }
        case "doub":
          return (0, S.readFloat64)(o);
        case "UntF": {
          const x = (0, S.readSignature)(o), b = (0, S.readFloat64)(o);
          if (!a[x])
            throw new Error(`Invalid units: ${x}`);
          return { units: a[x], value: b };
        }
        case "UnFl": {
          const x = (0, S.readSignature)(o), b = (0, S.readFloat32)(o);
          if (!a[x])
            throw new Error(`Invalid units: ${x}`);
          return { units: a[x], value: b };
        }
        case "TEXT":
          return (0, S.readUnicodeString)(o);
        case "enum": {
          const x = ne(o), b = ne(o);
          return `${x}.${b}`;
        }
        case "long":
          return (0, S.readInt32)(o);
        case "comp": {
          const x = (0, S.readUint32)(o), b = (0, S.readUint32)(o);
          return { low: x, high: b };
        }
        case "bool":
          return !!(0, S.readUint8)(o);
        case "type":
        // Class
        case "GlbC":
          return p(o);
        case "alis": {
          const x = (0, S.readInt32)(o);
          return (0, S.readAsciiString)(o, x);
        }
        case "tdta": {
          const x = (0, S.readInt32)(o);
          return (0, S.readBytes)(o, x);
        }
        case "ObAr": {
          (0, S.readInt32)(o), (0, S.readUnicodeString)(o), ne(o);
          const x = (0, S.readInt32)(o), b = [];
          for (let X = 0; X < x; X++) {
            const u = ne(o);
            (0, S.readSignature)(o), (0, S.readSignature)(o);
            const $ = (0, S.readInt32)(o), be = [];
            for (let ge = 0; ge < $; ge++)
              be.push((0, S.readFloat64)(o));
            b.push({ type: u, values: be });
          }
          return b;
        }
        case "Pth ": {
          (0, S.readInt32)(o);
          const x = (0, S.readSignature)(o);
          (0, S.readInt32LE)(o);
          const b = (0, S.readInt32LE)(o), X = (0, S.readUnicodeStringWithLengthLE)(o, b);
          return { sig: x, path: X };
        }
        default:
          throw new Error(`Invalid TySh descriptor OSType: ${_} at ${o.offset.toString(16)}`);
      }
    }
    const N = {
      meshPoints: "rationalPoint",
      quiltSliceX: "UntF",
      quiltSliceY: "UntF"
    };
    function J(o, _, I, x, b, X) {
      switch (_) {
        case "obj ":
          n(o, x, I);
          break;
        case "Objc":
        // Descriptor
        case "GlbO": {
          if (typeof I != "object")
            throw new Error(`Invalid struct value: ${JSON.stringify(I)}, key: ${x}`);
          if (!b)
            throw new Error(`Missing ext type for: '${x}' (${JSON.stringify(I)})`);
          const u = I._name || b.name, $ = I._classID || b.classID;
          C(o, u, $, I, X);
          break;
        }
        case "VlLs":
          if (!Array.isArray(I))
            throw new Error(`Invalid list value: ${JSON.stringify(I)}, key: ${x}`);
          (0, l.writeInt32)(o, I.length);
          for (let u = 0; u < I.length; u++) {
            const $ = ie[x];
            (0, l.writeSignature)(o, $ || "long"), J(o, $ || "long", I[u], `${x}[]`, V[x], X), ee && !$ && console.log(`Missing descriptor array type for: '${x}' in`, I);
          }
          break;
        case "doub":
          if (typeof I != "number")
            throw new Error(`Invalid number value: ${JSON.stringify(I)}, key: ${x}`);
          (0, l.writeFloat64)(o, I);
          break;
        case "UntF":
          if (!P[I.units])
            throw new Error(`Invalid units: ${I.units} in ${x}`);
          (0, l.writeSignature)(o, P[I.units]), (0, l.writeFloat64)(o, I.value);
          break;
        case "UnFl":
          if (!P[I.units])
            throw new Error(`Invalid units: ${I.units} in ${x}`);
          (0, l.writeSignature)(o, P[I.units]), (0, l.writeFloat32)(o, I.value);
          break;
        case "TEXT":
          (0, l.writeUnicodeStringWithPadding)(o, I);
          break;
        case "enum": {
          if (typeof I != "string")
            throw new Error(`Invalid enum value: ${JSON.stringify(I)}, key: ${x}`);
          const [u, $] = I.split(".");
          B(o, u), B(o, $);
          break;
        }
        case "long":
          if (typeof I != "number")
            throw new Error(`Invalid integer value: ${JSON.stringify(I)}, key: ${x}`);
          (0, l.writeInt32)(o, I);
          break;
        // case 'comp': // Large Integer
        // 	writeLargeInteger(reader);
        case "bool":
          if (typeof I != "boolean")
            throw new Error(`Invalid boolean value: ${JSON.stringify(I)}, key: ${x}`);
          (0, l.writeUint8)(o, I ? 1 : 0);
          break;
        // case 'type': // Class
        // case 'GlbC': // Class
        // 	writeClassStructure(reader);
        // case 'alis': // Alias
        // 	writeAliasStructure(reader);
        case "tdta":
          (0, l.writeInt32)(o, I.byteLength), (0, l.writeBytes)(o, I);
          break;
        case "ObAr": {
          (0, l.writeInt32)(o, 16), (0, l.writeUnicodeStringWithPadding)(o, "");
          const u = N[x];
          if (!u)
            throw new Error(`Not implemented ObArType for: ${x}`);
          B(o, u), (0, l.writeInt32)(o, I.length);
          for (let $ = 0; $ < I.length; $++) {
            B(o, I[$].type), (0, l.writeSignature)(o, "UnFl"), (0, l.writeSignature)(o, "#Pxl"), (0, l.writeInt32)(o, I[$].values.length);
            for (let be = 0; be < I[$].values.length; be++)
              (0, l.writeFloat64)(o, I[$].values[be]);
          }
          break;
        }
        case "Pth ": {
          const u = 12 + I.path.length * 2;
          (0, l.writeInt32)(o, u), (0, l.writeSignature)(o, I.sig), (0, l.writeInt32LE)(o, u), (0, l.writeInt32LE)(o, I.path.length), (0, l.writeUnicodeStringWithoutLengthLE)(o, I.path);
          break;
        }
        default:
          throw new Error(`Not implemented descriptor OSType: ${_}`);
      }
    }
    function W(o) {
      const _ = (0, S.readInt32)(o), I = [];
      for (let x = 0; x < _; x++) {
        const b = (0, S.readSignature)(o);
        switch (b) {
          case "prop": {
            p(o);
            const X = ne(o);
            I.push(X);
            break;
          }
          case "Clss":
            I.push(p(o));
            break;
          case "Enmr": {
            p(o);
            const X = ne(o), u = ne(o);
            I.push(`${X}.${u}`);
            break;
          }
          case "rele": {
            p(o), I.push((0, S.readUint32)(o));
            break;
          }
          case "Idnt":
            I.push((0, S.readInt32)(o));
            break;
          case "indx":
            I.push((0, S.readInt32)(o));
            break;
          case "name": {
            p(o), I.push((0, S.readUnicodeString)(o));
            break;
          }
          default:
            throw new Error(`Invalid descriptor reference type: ${b}`);
        }
      }
      return I;
    }
    function n(o, _, I) {
      (0, l.writeInt32)(o, I.length);
      for (let x = 0; x < I.length; x++) {
        const b = I[x];
        let X = "unknown";
        switch (typeof b == "string" && (/^[a-z ]+\.[a-z ]+$/i.test(b) ? X = "Enmr" : X = "name"), (0, l.writeSignature)(o, X), X) {
          // case 'prop': // Property
          // case 'Clss': // Class
          case "Enmr": {
            const [u, $] = b.split(".");
            g(o, "\0", u), B(o, u), B(o, $);
            break;
          }
          // case 'rele': // Offset
          // case 'Idnt': // Identifier
          // case 'indx': // Index
          case "name": {
            g(o, "\0", "Lyr "), (0, l.writeUnicodeString)(o, b + "\0");
            break;
          }
          default:
            throw new Error(`Invalid descriptor reference type: ${X}`);
        }
      }
      return I;
    }
    function p(o) {
      const _ = (0, S.readUnicodeString)(o), I = ne(o);
      return { name: _, classID: I };
    }
    function g(o, _, I) {
      (0, l.writeUnicodeString)(o, _), B(o, I);
    }
    function E(o, _ = !1) {
      const I = (0, S.readUint32)(o);
      if (I !== 16)
        throw new Error(`Invalid descriptor version: ${I}`);
      return z(o, _);
    }
    function G(o, _, I, x, b = "") {
      (0, l.writeUint32)(o, 16), C(o, _, I, x, b);
    }
    function M(o) {
      return { x: o.Hrzn, y: o.Vrtc };
    }
    function re(o) {
      return { Hrzn: o.x, Vrtc: o.y };
    }
    function Q(o) {
      return {
        top: i(o["Top "]),
        left: i(o.Left),
        right: i(o.Rght),
        bottom: i(o.Btom)
      };
    }
    function se(o) {
      return {
        Left: d(o.left, "bounds.left"),
        "Top ": d(o.top, "bounds.top"),
        Rght: d(o.right, "bounds.right"),
        Btom: d(o.bottom, "bounds.bottom")
      };
    }
    function me(o) {
      const _ = {
        enabled: !!o.enab,
        position: c.FStl.decode(o.Styl),
        fillType: c.FrFl.decode(o.PntT),
        blendMode: c.BlnM.decode(o["Md  "]),
        opacity: oe(o.Opct),
        size: i(o["Sz  "])
      };
      return o.present !== void 0 && (_.present = o.present), o.showInDialog !== void 0 && (_.showInDialog = o.showInDialog), o.overprint !== void 0 && (_.overprint = o.overprint), o["Clr "] && (_.color = Y(o["Clr "])), o.Grad && (_.gradient = Re(o)), o.Ptrn && (_.pattern = Ve(o)), _;
    }
    function te(o) {
      let _ = {};
      return _.enab = !!o.enabled, o.present !== void 0 && (_.present = !!o.present), o.showInDialog !== void 0 && (_.showInDialog = !!o.showInDialog), _.Styl = c.FStl.encode(o.position), _.PntT = c.FrFl.encode(o.fillType), _["Md  "] = c.BlnM.encode(o.blendMode), _.Opct = U(o.opacity), _["Sz  "] = d(o.size, "size"), o.color && (_["Clr "] = de(o.color)), o.gradient && (_ = Object.assign(Object.assign({}, _), Be(o.gradient))), o.pattern && (_ = Object.assign(Object.assign({}, _), v(o.pattern))), o.overprint !== void 0 && (_.overprint = !!o.overprint), _;
    }
    function ve(o, _, I) {
      var x, b, X;
      const u = I ? {
        "Scl ": Z((x = o.scale) !== null && x !== void 0 ? x : 1),
        masterFXSwitch: !o.disabled
      } : {
        masterFXSwitch: !o.disabled,
        "Scl ": Z((b = o.scale) !== null && b !== void 0 ? b : 1)
      }, $ = ["dropShadow", "innerShadow", "solidFill", "gradientOverlay", "stroke"];
      for (const Ce of $)
        if (o[Ce] && !Array.isArray(o[Ce]))
          throw new Error(`${Ce} should be an array`);
      const be = (Ce) => !!Ce && Ce.length > 1 && I, ge = (Ce) => !!Ce && Ce.length >= 1 && (!I || Ce.length === 1);
      if (ge(o.dropShadow) && (u.DrSh = Ae(o.dropShadow[0], "dropShadow", _)), be(o.dropShadow) && (u.dropShadowMulti = o.dropShadow.map((Ce) => Ae(Ce, "dropShadow", _))), ge(o.innerShadow) && (u.IrSh = Ae(o.innerShadow[0], "innerShadow", _)), be(o.innerShadow) && (u.innerShadowMulti = o.innerShadow.map((Ce) => Ae(Ce, "innerShadow", _))), o.outerGlow && (u.OrGl = Ae(o.outerGlow, "outerGlow", _)), be(o.solidFill) && (u.solidFillMulti = o.solidFill.map((Ce) => Ae(Ce, "solidFill", _))), be(o.gradientOverlay) && (u.gradientFillMulti = o.gradientOverlay.map((Ce) => Ae(Ce, "gradientOverlay", _))), be(o.stroke) && (u.frameFXMulti = o.stroke.map((Ce) => te(Ce))), o.innerGlow && (u.IrGl = Ae(o.innerGlow, "innerGlow", _)), o.bevel && (u.ebbl = Ae(o.bevel, "bevel", _)), ge(o.solidFill) && (u.SoFi = Ae(o.solidFill[0], "solidFill", _)), o.patternOverlay && (u.patternFill = Ae(o.patternOverlay, "patternOverlay", _)), ge(o.gradientOverlay) && (u.GrFl = Ae(o.gradientOverlay[0], "gradientOverlay", _)), o.satin && (u.ChFX = Ae(o.satin, "satin", _)), ge(o.stroke) && (u.FrFX = te((X = o.stroke) === null || X === void 0 ? void 0 : X[0])), I) {
        u.numModifyingFX = 0;
        for (const Ce of Object.keys(o)) {
          const De = o[Ce];
          if (Array.isArray(De))
            for (const Ne of De)
              Ne.enabled && u.numModifyingFX++;
          else De.enabled && u.numModifyingFX++;
        }
      }
      return u;
    }
    function ue(o, _) {
      const I = {}, { masterFXSwitch: x, DrSh: b, dropShadowMulti: X, IrSh: u, innerShadowMulti: $, OrGl: be, IrGl: ge, ebbl: Ce, SoFi: De, solidFillMulti: Ne, patternFill: s, GrFl: D, gradientFillMulti: ae, ChFX: K, FrFX: t, frameFXMulti: T, numModifyingFX: m } = o, j = q(o, ["masterFXSwitch", "DrSh", "dropShadowMulti", "IrSh", "innerShadowMulti", "OrGl", "IrGl", "ebbl", "SoFi", "solidFillMulti", "patternFill", "GrFl", "gradientFillMulti", "ChFX", "FrFX", "frameFXMulti", "numModifyingFX"]);
      return x || (I.disabled = !0), o["Scl "] && (I.scale = oe(o["Scl "])), b && (I.dropShadow = [xe(b, _)]), X && (I.dropShadow = X.map((R) => xe(R, _))), u && (I.innerShadow = [xe(u, _)]), $ && (I.innerShadow = $.map((R) => xe(R, _))), be && (I.outerGlow = xe(be, _)), ge && (I.innerGlow = xe(ge, _)), Ce && (I.bevel = xe(Ce, _)), De && (I.solidFill = [xe(De, _)]), Ne && (I.solidFill = Ne.map((R) => xe(R, _))), s && (I.patternOverlay = xe(s, _)), D && (I.gradientOverlay = [xe(D, _)]), ae && (I.gradientOverlay = ae.map((R) => xe(R, _))), K && (I.satin = xe(K, _)), t && (I.stroke = [me(t)]), T && (I.stroke = T.map((R) => me(R))), _ && Object.keys(j).length > 1 && console.log("Unhandled effect keys:", j), I;
    }
    function Fe(o, _) {
      const I = [];
      for (let x = 0; x < o.length; x++) {
        const b = o[x], { time: { denominator: X, numerator: u }, selected: $, animKey: be } = b, ge = { numerator: u, denominator: X }, Ce = c.animInterpStyleEnum.decode(b.animInterpStyle);
        switch (be.Type) {
          case "keyType.Opct":
            I.push({ interpolation: Ce, time: ge, selected: $, type: "opacity", value: oe(be.Opct) });
            break;
          case "keyType.Pstn":
            I.push({ interpolation: Ce, time: ge, selected: $, type: "position", x: be.Hrzn, y: be.Vrtc });
            break;
          case "keyType.Trnf":
            I.push({
              interpolation: Ce,
              time: ge,
              selected: $,
              type: "transform",
              scale: M(be["Scl "]),
              skew: M(be.Skew),
              rotation: be.rotation,
              translation: M(be.translation)
            });
            break;
          case "keyType.sheetStyle": {
            const De = { interpolation: Ce, time: ge, selected: $, type: "style" };
            be.sheetStyle.Lefx && (De.style = ue(be.sheetStyle.Lefx, _)), I.push(De);
            break;
          }
          case "keyType.globalLighting": {
            I.push({
              interpolation: Ce,
              time: ge,
              selected: $,
              type: "globalLighting",
              globalAngle: be.gblA,
              globalAltitude: be.globalAltitude
            });
            break;
          }
          default:
            throw new Error("Unsupported keyType value");
        }
      }
      return I;
    }
    function _e(o) {
      const _ = [];
      for (let I = 0; I < o.length; I++) {
        const x = o[I], { time: b, selected: X = !1, interpolation: u } = x, $ = c.animInterpStyleEnum.encode(u);
        let be;
        switch (x.type) {
          case "opacity":
            be = { Type: "keyType.Opct", Opct: U(x.value) };
            break;
          case "position":
            be = { Type: "keyType.Pstn", Hrzn: x.x, Vrtc: x.y };
            break;
          case "transform":
            be = { Type: "keyType.Trnf", "Scl ": re(x.scale), Skew: re(x.skew), rotation: x.rotation, translation: re(x.translation) };
            break;
          case "style":
            be = { Type: "keyType.sheetStyle", sheetStyle: { Vrsn: 1, blendOptions: {} } }, x.style && (be.sheetStyle = { Vrsn: 1, Lefx: ve(x.style, !1, !1), blendOptions: {} });
            break;
          case "globalLighting": {
            be = { Type: "keyType.globalLighting", gblA: x.globalAngle, globalAltitude: x.globalAltitude };
            break;
          }
          default:
            throw new Error("Unsupported keyType value");
        }
        _.push({ Vrsn: 1, animInterpStyle: $, time: b, animKey: be, selected: X });
      }
      return _;
    }
    function Oe(o, _) {
      const I = [];
      for (let x = 0; x < o.length; x++) {
        const b = o[x], X = {
          type: c.stdTrackID.decode(b.trackID),
          enabled: b.enab,
          keys: Fe(b.keyList, _)
        };
        b.effectParams && (X.effectParams = {
          fillCanvas: b.effectParams.fillCanvas,
          zoomOrigin: b.effectParams.zoomOrigin,
          keys: Fe(b.effectParams.keyList, _)
        }), I.push(X);
      }
      return I;
    }
    function Ie(o) {
      const _ = [];
      for (let I = 0; I < o.length; I++) {
        const x = o[I];
        _.push(Object.assign(Object.assign({ trackID: c.stdTrackID.encode(x.type), Vrsn: 1, enab: !!x.enabled, Effc: !!x.effectParams }, x.effectParams ? {
          effectParams: {
            keyList: _e(x.keys),
            fillCanvas: x.effectParams.fillCanvas,
            zoomOrigin: x.effectParams.zoomOrigin
          }
        } : {}), { keyList: _e(x.keys) }));
      }
      return _;
    }
    function xe(o, _) {
      const I = {};
      for (const x of Object.keys(o)) {
        const b = o[x];
        switch (x) {
          case "enab":
            I.enabled = !!b;
            break;
          case "uglg":
            I.useGlobalLight = !!b;
            break;
          case "AntA":
            I.antialiased = !!b;
            break;
          case "Algn":
            I.align = !!b;
            break;
          case "Dthr":
            I.dither = !!b;
            break;
          case "Invr":
            I.invert = !!b;
            break;
          case "Rvrs":
            I.reverse = !!b;
            break;
          case "Clr ":
            I.color = Y(b);
            break;
          case "hglC":
            I.highlightColor = Y(b);
            break;
          case "sdwC":
            I.shadowColor = Y(b);
            break;
          case "Styl":
            I.position = c.FStl.decode(b);
            break;
          case "Md  ":
            I.blendMode = c.BlnM.decode(b);
            break;
          case "hglM":
            I.highlightBlendMode = c.BlnM.decode(b);
            break;
          case "sdwM":
            I.shadowBlendMode = c.BlnM.decode(b);
            break;
          case "bvlS":
            I.style = c.BESl.decode(b);
            break;
          case "bvlD":
            I.direction = c.BESs.decode(b);
            break;
          case "bvlT":
            I.technique = c.bvlT.decode(b);
            break;
          case "GlwT":
            I.technique = c.BETE.decode(b);
            break;
          case "glwS":
            I.source = c.IGSr.decode(b);
            break;
          case "Type":
            I.type = c.GrdT.decode(b);
            break;
          case "gs99":
            I.interpolationMethod = c.gradientInterpolationMethodType.decode(b);
            break;
          case "Opct":
            I.opacity = oe(b);
            break;
          case "hglO":
            I.highlightOpacity = oe(b);
            break;
          case "sdwO":
            I.shadowOpacity = oe(b);
            break;
          case "lagl":
            I.angle = pe(b);
            break;
          case "Angl":
            I.angle = pe(b);
            break;
          case "Lald":
            I.altitude = pe(b);
            break;
          case "Sftn":
            I.soften = i(b);
            break;
          case "srgR":
            I.strength = oe(b);
            break;
          case "blur":
            I.size = i(b);
            break;
          case "Nose":
            I.noise = oe(b);
            break;
          case "Inpr":
            I.range = oe(b);
            break;
          case "Ckmt":
            I.choke = i(b);
            break;
          case "ShdN":
            I.jitter = oe(b);
            break;
          case "Dstn":
            I.distance = i(b);
            break;
          case "Scl ":
            I.scale = oe(b);
            break;
          case "Ptrn":
            I.pattern = { name: b["Nm  "], id: b.Idnt };
            break;
          case "phase":
            I.phase = { x: b.Hrzn, y: b.Vrtc };
            break;
          case "Ofst":
            I.offset = { x: oe(b.Hrzn), y: oe(b.Vrtc) };
            break;
          case "MpgS":
          case "TrnS":
            I.contour = {
              name: b["Nm  "],
              curve: b["Crv "].map((X) => ({ x: X.Hrzn, y: X.Vrtc }))
            };
            break;
          case "Grad":
            I.gradient = ze(b);
            break;
          case "useTexture":
          case "useShape":
          case "layerConceals":
          case "present":
          case "showInDialog":
          case "antialiasGloss":
            I[x] = b;
            break;
          case "_name":
          case "_classID":
            break;
          default:
            _ && console.log(`Invalid effect key: '${x}', value:`, b);
        }
      }
      return I;
    }
    function Ae(o, _, I) {
      const x = {
        enab: !1
      };
      _ === "dropShadow" && (x.TrnS = { "Nm  ": "", "Crv ": [] });
      for (const b of Object.keys(o)) {
        const X = b, u = o[X];
        switch (X) {
          case "enabled":
            x.enab = !!u;
            break;
          case "useGlobalLight":
            x.uglg = !!u;
            break;
          case "antialiased":
            x.AntA = !!u;
            break;
          case "align":
            x.Algn = !!u;
            break;
          case "dither":
            x.Dthr = !!u;
            break;
          case "invert":
            x.Invr = !!u;
            break;
          case "reverse":
            x.Rvrs = !!u;
            break;
          case "color":
            x["Clr "] = de(u);
            break;
          case "highlightColor":
            x.hglC = de(u);
            break;
          case "shadowColor":
            x.sdwC = de(u);
            break;
          case "position":
            x.Styl = c.FStl.encode(u);
            break;
          case "blendMode":
            x["Md  "] = c.BlnM.encode(u);
            break;
          case "highlightBlendMode":
            x.hglM = c.BlnM.encode(u);
            break;
          case "shadowBlendMode":
            x.sdwM = c.BlnM.encode(u);
            break;
          case "style":
            x.bvlS = c.BESl.encode(u);
            break;
          case "direction":
            x.bvlD = c.BESs.encode(u);
            break;
          case "technique":
            _ === "bevel" ? x.bvlT = c.bvlT.encode(u) : x.GlwT = c.BETE.encode(u);
            break;
          case "source":
            x.glwS = c.IGSr.encode(u);
            break;
          case "type":
            x.Type = c.GrdT.encode(u);
            break;
          case "interpolationMethod":
            x.gs99 = c.gradientInterpolationMethodType.encode(u);
            break;
          case "opacity":
            x.Opct = U(u);
            break;
          case "highlightOpacity":
            x.hglO = U(u);
            break;
          case "shadowOpacity":
            x.sdwO = U(u);
            break;
          case "angle":
            _ === "gradientOverlay" || _ === "patternFill" ? x.Angl = w(u) : x.lagl = w(u);
            break;
          case "altitude":
            x.Lald = w(u);
            break;
          case "soften":
            x.Sftn = d(u, X);
            break;
          case "strength":
            x.srgR = U(u);
            break;
          case "size":
            x.blur = d(u, X);
            break;
          case "noise":
            x.Nose = U(u);
            break;
          case "range":
            x.Inpr = U(u);
            break;
          case "choke":
            x.Ckmt = d(u, X);
            break;
          case "jitter":
            x.ShdN = U(u);
            break;
          case "distance":
            x.Dstn = d(u, X);
            break;
          case "scale":
            x["Scl "] = U(u);
            break;
          case "pattern":
            x.Ptrn = { "Nm  ": u.name, Idnt: u.id };
            break;
          case "phase":
            x.phase = { Hrzn: u.x, Vrtc: u.y };
            break;
          case "offset":
            x.Ofst = { Hrzn: U(u.x), Vrtc: U(u.y) };
            break;
          case "contour": {
            x[_ === "satin" ? "MpgS" : "TrnS"] = {
              "Nm  ": u.name,
              "Crv ": u.curve.map(($) => ({ Hrzn: $.x, Vrtc: $.y }))
            };
            break;
          }
          case "gradient":
            x.Grad = Pe(u);
            break;
          case "useTexture":
          case "useShape":
          case "layerConceals":
          case "present":
          case "showInDialog":
          case "antialiasGloss":
            x[X] = u;
            break;
          default:
            I && console.log(`Invalid effect key: '${X}', value:`, u);
        }
      }
      return x;
    }
    function ze(o) {
      if (o.GrdF === "GrdF.CstS") {
        const _ = o.Intr || 4096;
        return {
          type: "solid",
          name: o["Nm  "],
          smoothness: o.Intr / 4096,
          colorStops: o.Clrs.map((I) => ({
            color: Y(I["Clr "]),
            location: I.Lctn / _,
            midpoint: I.Mdpn / 100
          })),
          opacityStops: o.Trns.map((I) => ({
            opacity: oe(I.Opct),
            location: I.Lctn / _,
            midpoint: I.Mdpn / 100
          }))
        };
      } else
        return {
          type: "noise",
          name: o["Nm  "],
          roughness: o.Smth / 4096,
          colorModel: c.ClrS.decode(o.ClrS),
          randomSeed: o.RndS,
          restrictColors: !!o.VctC,
          addTransparency: !!o.ShTr,
          min: o["Mnm "].map((_) => _ / 100),
          max: o["Mxm "].map((_) => _ / 100)
        };
    }
    function Pe(o) {
      var _, I;
      if (o.type === "solid") {
        const x = Math.round(((_ = o.smoothness) !== null && _ !== void 0 ? _ : 1) * 4096);
        return {
          "Nm  ": o.name || "",
          GrdF: "GrdF.CstS",
          Intr: x,
          Clrs: o.colorStops.map((b) => {
            var X;
            return {
              "Clr ": de(b.color),
              Type: "Clry.UsrS",
              Lctn: Math.round(b.location * x),
              Mdpn: Math.round(((X = b.midpoint) !== null && X !== void 0 ? X : 0.5) * 100)
            };
          }),
          Trns: o.opacityStops.map((b) => {
            var X;
            return {
              Opct: U(b.opacity),
              Lctn: Math.round(b.location * x),
              Mdpn: Math.round(((X = b.midpoint) !== null && X !== void 0 ? X : 0.5) * 100)
            };
          })
        };
      } else
        return {
          GrdF: "GrdF.ClNs",
          "Nm  ": o.name || "",
          ShTr: !!o.addTransparency,
          VctC: !!o.restrictColors,
          ClrS: c.ClrS.encode(o.colorModel),
          RndS: o.randomSeed || 0,
          Smth: Math.round(((I = o.roughness) !== null && I !== void 0 ? I : 1) * 4096),
          "Mnm ": (o.min || [0, 0, 0, 0]).map((x) => x * 100),
          "Mxm ": (o.max || [1, 1, 1, 1]).map((x) => x * 100)
        };
    }
    function Re(o) {
      const _ = ze(o.Grad);
      return _.style = c.GrdT.decode(o.Type), o.Dthr !== void 0 && (_.dither = o.Dthr), o.gradientsInterpolationMethod !== void 0 && (_.interpolationMethod = c.gradientInterpolationMethodType.decode(o.gradientsInterpolationMethod)), o.Rvrs !== void 0 && (_.reverse = o.Rvrs), o.Angl !== void 0 && (_.angle = pe(o.Angl)), o["Scl "] !== void 0 && (_.scale = oe(o["Scl "])), o.Algn !== void 0 && (_.align = o.Algn), o.Ofst !== void 0 && (_.offset = {
        x: oe(o.Ofst.Hrzn),
        y: oe(o.Ofst.Vrtc)
      }), _;
    }
    function Ve(o) {
      const _ = {
        name: o.Ptrn["Nm  "],
        id: o.Ptrn.Idnt
      };
      return o.Lnkd !== void 0 && (_.linked = o.Lnkd), o.phase !== void 0 && (_.phase = { x: o.phase.Hrzn, y: o.phase.Vrtc }), _;
    }
    function Ge(o) {
      if ("Grad" in o)
        return Re(o);
      if ("Ptrn" in o)
        return Object.assign({ type: "pattern" }, Ve(o));
      if ("Clr " in o)
        return { type: "color", color: Y(o["Clr "]) };
      throw new Error("Invalid vector content");
    }
    function Be(o) {
      const _ = {};
      return o.dither !== void 0 && (_.Dthr = o.dither), o.interpolationMethod !== void 0 && (_.gradientsInterpolationMethod = c.gradientInterpolationMethodType.encode(o.interpolationMethod)), o.reverse !== void 0 && (_.Rvrs = o.reverse), o.angle !== void 0 && (_.Angl = w(o.angle)), _.Type = c.GrdT.encode(o.style), o.align !== void 0 && (_.Algn = o.align), o.scale !== void 0 && (_["Scl "] = U(o.scale)), o.offset && (_.Ofst = {
        Hrzn: U(o.offset.x),
        Vrtc: U(o.offset.y)
      }), _.Grad = Pe(o), _;
    }
    function v(o) {
      const _ = {
        Ptrn: {
          "Nm  ": o.name || "",
          Idnt: o.id || ""
        }
      };
      return o.linked !== void 0 && (_.Lnkd = !!o.linked), o.phase !== void 0 && (_.phase = { Hrzn: o.phase.x, Vrtc: o.phase.y }), _;
    }
    function A(o) {
      return o.type === "color" ? { key: "SoCo", descriptor: { "Clr ": de(o.color) } } : o.type === "pattern" ? { key: "PtFl", descriptor: v(o) } : { key: "GdFl", descriptor: Be(o) };
    }
    function Y(o) {
      if ("H   " in o)
        return { h: e(o["H   "]), s: o.Strt, b: o.Brgh };
      if ("Rd  " in o)
        return { r: o["Rd  "], g: o["Grn "], b: o["Bl  "] };
      if ("Cyn " in o)
        return { c: o["Cyn "], m: o.Mgnt, y: o["Ylw "], k: o.Blck };
      if ("Gry " in o)
        return { k: o["Gry "] };
      if ("Lmnc" in o)
        return { l: o.Lmnc, a: o["A   "], b: o["B   "] };
      if ("redFloat" in o)
        return { fr: o.redFloat, fg: o.greenFloat, fb: o.blueFloat };
      throw new Error("Unsupported color descriptor");
    }
    function de(o) {
      if (o) {
        if ("r" in o)
          return { _name: "", _classID: "RGBC", "Rd  ": o.r || 0, "Grn ": o.g || 0, "Bl  ": o.b || 0 };
        if ("fr" in o)
          return { _name: "", _classID: "RGBC", redFloat: o.fr, greenFloat: o.fg, blueFloat: o.fb };
        if ("h" in o)
          return { _name: "", _classID: "HSBC", "H   ": w(o.h * 360), Strt: o.s || 0, Brgh: o.b || 0 };
        if ("c" in o)
          return { _name: "", _classID: "CMYC", "Cyn ": o.c || 0, Mgnt: o.m || 0, "Ylw ": o.y || 0, Blck: o.k || 0 };
        if ("l" in o)
          return { _name: "", _classID: "LABC", Lmnc: o.l || 0, "A   ": o.a || 0, "B   ": o.b || 0 };
        if ("k" in o)
          return { _name: "", _classID: "GRYC", "Gry ": o.k };
        throw new Error("Invalid color value");
      } else return { _name: "", _classID: "RGBC", "Rd  ": 0, "Grn ": 0, "Bl  ": 0 };
    }
    function pe(o) {
      if (o === void 0)
        return 0;
      if (o.units !== "Angle")
        throw new Error(`Invalid units: ${o.units}`);
      return o.value;
    }
    function oe(o) {
      if (o === void 0)
        return 1;
      if (o.units !== "Percent")
        throw new Error(`Invalid units: ${o.units}`);
      return o.value / 100;
    }
    function e(o) {
      if (o === void 0)
        return 1;
      if (o.units === "Percent")
        return o.value / 100;
      if (o.units === "Angle")
        return o.value / 360;
      throw new Error(`Invalid units: ${o.units}`);
    }
    function i({ units: o, value: _ }) {
      if (o !== "Pixels" && o !== "Millimeters" && o !== "Points" && o !== "None" && o !== "Picas" && o !== "Inches" && o !== "Centimeters" && o !== "Density")
        throw new Error(`Invalid units: ${JSON.stringify({ units: o, value: _ })}`);
      return { value: _, units: o };
    }
    function r(o, _ = "Pixels") {
      return typeof o == "number" ? { value: o, units: _ } : i(o);
    }
    function h({ units: o, value: _ }, I) {
      if (o !== I)
        throw new Error(`Invalid units: ${JSON.stringify({ units: o, value: _ })}`);
      return _;
    }
    function w(o) {
      return { units: "Angle", value: o || 0 };
    }
    function U(o) {
      return { units: "Percent", value: Math.round((o || 0) * 100) };
    }
    function Z(o) {
      return { units: "Percent", value: (o || 0) * 100 };
    }
    function d(o, _) {
      if (o == null)
        return { units: "Pixels", value: 0 };
      if (typeof o != "object")
        throw new Error(`Invalid value: ${JSON.stringify(o)} (key: ${_}) (should have value and units)`);
      const { units: I, value: x } = o;
      if (typeof x != "number")
        throw new Error(`Invalid value in ${JSON.stringify(o)} (key: ${_})`);
      if (I !== "Pixels" && I !== "Millimeters" && I !== "Points" && I !== "None" && I !== "Picas" && I !== "Inches" && I !== "Centimeters" && I !== "Density")
        throw new Error(`Invalid units in ${JSON.stringify(o)} (key: ${_})`);
      return { units: I, value: x };
    }
    function L({ numerator: o, denominator: _ }) {
      return { numerator: o, denominator: _ };
    }
    c.textGridding = (0, k.createEnum)("textGridding", "none", {
      none: "None",
      round: "Rnd "
    }), c.Ornt = (0, k.createEnum)("Ornt", "horizontal", {
      horizontal: "Hrzn",
      vertical: "Vrtc"
    }), c.Annt = (0, k.createEnum)("Annt", "sharp", {
      none: "Anno",
      sharp: "antiAliasSharp",
      crisp: "AnCr",
      strong: "AnSt",
      smooth: "AnSm",
      platform: "antiAliasPlatformGray",
      platformLCD: "antiAliasPlatformLCD"
    }), c.warpStyle = (0, k.createEnum)("warpStyle", "none", {
      none: "warpNone",
      arc: "warpArc",
      arcLower: "warpArcLower",
      arcUpper: "warpArcUpper",
      arch: "warpArch",
      bulge: "warpBulge",
      shellLower: "warpShellLower",
      shellUpper: "warpShellUpper",
      flag: "warpFlag",
      wave: "warpWave",
      fish: "warpFish",
      rise: "warpRise",
      fisheye: "warpFisheye",
      inflate: "warpInflate",
      squeeze: "warpSqueeze",
      twist: "warpTwist",
      cylinder: "warpCylinder",
      custom: "warpCustom"
    }), c.BlnM = (0, k.createEnum)("BlnM", "normal", {
      normal: "Nrml",
      dissolve: "Dslv",
      darken: "Drkn",
      multiply: "Mltp",
      "color burn": "CBrn",
      "linear burn": "linearBurn",
      "darker color": "darkerColor",
      lighten: "Lghn",
      screen: "Scrn",
      "color dodge": "CDdg",
      "linear dodge": "linearDodge",
      "lighter color": "lighterColor",
      overlay: "Ovrl",
      "soft light": "SftL",
      "hard light": "HrdL",
      "vivid light": "vividLight",
      "linear light": "linearLight",
      "pin light": "pinLight",
      "hard mix": "hardMix",
      difference: "Dfrn",
      exclusion: "Xclu",
      subtract: "blendSubtraction",
      divide: "blendDivide",
      hue: "H   ",
      saturation: "Strt",
      color: "Clr ",
      luminosity: "Lmns",
      // used in ABR
      "linear height": "linearHeight",
      height: "Hght",
      subtraction: "Sbtr",
      // 2nd version of subtract ?
      "pass through": "????"
      // added for compilation to work, not used in actual files
    }), c.BESl = (0, k.createEnum)("BESl", "inner bevel", {
      "inner bevel": "InrB",
      "outer bevel": "OtrB",
      emboss: "Embs",
      "pillow emboss": "PlEb",
      "stroke emboss": "strokeEmboss"
    }), c.bvlT = (0, k.createEnum)("bvlT", "smooth", {
      smooth: "SfBL",
      "chisel hard": "PrBL",
      "chisel soft": "Slmt"
    }), c.BESs = (0, k.createEnum)("BESs", "up", {
      up: "In  ",
      down: "Out "
    }), c.BETE = (0, k.createEnum)("BETE", "softer", {
      softer: "SfBL",
      precise: "PrBL"
    }), c.IGSr = (0, k.createEnum)("IGSr", "edge", {
      edge: "SrcE",
      center: "SrcC"
    }), c.GrdT = (0, k.createEnum)("GrdT", "linear", {
      linear: "Lnr ",
      radial: "Rdl ",
      angle: "Angl",
      reflected: "Rflc",
      diamond: "Dmnd"
    }), c.animInterpStyleEnum = (0, k.createEnum)("animInterpStyle", "linear", {
      linear: "Lnr ",
      hold: "hold"
    }), c.stdTrackID = (0, k.createEnum)("stdTrackID", "opacity", {
      opacity: "opacityTrack",
      style: "styleTrack",
      sheetTransform: "sheetTransformTrack",
      sheetPosition: "sheetPositionTrack",
      globalLighting: "globalLightingTrack"
    }), c.gradientInterpolationMethodType = (0, k.createEnum)("gradientInterpolationMethodType", "perceptual", {
      perceptual: "Perc",
      linear: "Lnr ",
      classic: "Gcls",
      smooth: "Smoo"
      // TODO: stripes
    }), c.ClrS = (0, k.createEnum)("ClrS", "rgb", {
      rgb: "RGBC",
      hsb: "HSBl",
      lab: "LbCl",
      hsl: "HSLC"
    }), c.FStl = (0, k.createEnum)("FStl", "outside", {
      outside: "OutF",
      center: "CtrF",
      inside: "InsF"
    }), c.FrFl = (0, k.createEnum)("FrFl", "color", {
      color: "SClr",
      gradient: "GrFl",
      pattern: "Ptrn"
    }), c.ESliceType = (0, k.createEnum)("ESliceType", "image", {
      image: "Img ",
      noImage: "noImage"
    }), c.ESliceHorzAlign = (0, k.createEnum)("ESliceHorzAlign", "default", {
      default: "default"
    }), c.ESliceVertAlign = (0, k.createEnum)("ESliceVertAlign", "default", {
      default: "default"
    }), c.ESliceOrigin = (0, k.createEnum)("ESliceOrigin", "userGenerated", {
      userGenerated: "userGenerated",
      autoGenerated: "autoGenerated",
      layer: "layer"
    }), c.ESliceBGColorType = (0, k.createEnum)("ESliceBGColorType", "none", {
      none: "None",
      matte: "matte",
      color: "Clr "
    }), c.strokeStyleLineCapType = (0, k.createEnum)("strokeStyleLineCapType", "butt", {
      butt: "strokeStyleButtCap",
      round: "strokeStyleRoundCap",
      square: "strokeStyleSquareCap"
    }), c.strokeStyleLineJoinType = (0, k.createEnum)("strokeStyleLineJoinType", "miter", {
      miter: "strokeStyleMiterJoin",
      round: "strokeStyleRoundJoin",
      bevel: "strokeStyleBevelJoin"
    }), c.strokeStyleLineAlignment = (0, k.createEnum)("strokeStyleLineAlignment", "inside", {
      inside: "strokeStyleAlignInside",
      center: "strokeStyleAlignCenter",
      outside: "strokeStyleAlignOutside"
    }), c.BlrM = (0, k.createEnum)("BlrM", "spin", {
      spin: "Spn ",
      zoom: "Zm  "
    }), c.BlrQ = (0, k.createEnum)("BlrQ", "good", {
      draft: "Drft",
      good: "Gd  ",
      best: "Bst "
    }), c.SmBM = (0, k.createEnum)("SmBM", "normal", {
      normal: "SBMN",
      "edge only": "SBME",
      "overlay edge": "SBMO"
    }), c.SmBQ = (0, k.createEnum)("SmBQ", "medium", {
      low: "SBQL",
      medium: "SBQM",
      high: "SBQH"
    }), c.DspM = (0, k.createEnum)("DspM", "stretch to fit", {
      "stretch to fit": "StrF",
      tile: "Tile"
    }), c.UndA = (0, k.createEnum)("UndA", "repeat edge pixels", {
      "wrap around": "WrpA",
      "repeat edge pixels": "RptE"
    }), c.Cnvr = (0, k.createEnum)("Cnvr", "rectangular to polar", {
      "rectangular to polar": "RctP",
      "polar to rectangular": "PlrR"
    }), c.RplS = (0, k.createEnum)("RplS", "medium", {
      small: "Sml ",
      medium: "Mdm ",
      large: "Lrg "
    }), c.SphM = (0, k.createEnum)("SphM", "normal", {
      normal: "Nrml",
      "horizontal only": "HrzO",
      "vertical only": "VrtO"
    }), c.Wvtp = (0, k.createEnum)("Wvtp", "sine", {
      sine: "WvSn",
      triangle: "WvTr",
      square: "WvSq"
    }), c.ZZTy = (0, k.createEnum)("ZZTy", "pond ripples", {
      "around center": "ArnC",
      "out from center": "OtFr",
      "pond ripples": "PndR"
    }), c.Dstr = (0, k.createEnum)("Dstr", "uniform", {
      uniform: "Unfr",
      gaussian: "Gsn "
    }), c.Chnl = (0, k.createEnum)("Chnl", "composite", {
      red: "Rd  ",
      green: "Grn ",
      blue: "Bl  ",
      composite: "Cmps"
    }), c.MztT = (0, k.createEnum)("MztT", "fine dots", {
      "fine dots": "FnDt",
      "medium dots": "MdmD",
      "grainy dots": "GrnD",
      "coarse dots": "CrsD",
      "short lines": "ShrL",
      "medium lines": "MdmL",
      "long lines": "LngL",
      "short strokes": "ShSt",
      "medium strokes": "MdmS",
      "long strokes": "LngS"
    }), c.Lns = (0, k.createEnum)("Lns ", "50-300mm zoom", {
      "50-300mm zoom": "Zm  ",
      "32mm prime": "Nkn ",
      "105mm prime": "Nkn1",
      "movie prime": "PnVs"
    }), c.blurType = (0, k.createEnum)("blurType", "gaussian blur", {
      "gaussian blur": "GsnB",
      "lens blur": "lensBlur",
      "motion blur": "MtnB"
    }), c.DfsM = (0, k.createEnum)("DfsM", "normal", {
      normal: "Nrml",
      "darken only": "DrkO",
      "lighten only": "LghO",
      anisotropic: "anisotropic"
    }), c.ExtT = (0, k.createEnum)("ExtT", "blocks", {
      blocks: "Blks",
      pyramids: "Pyrm"
    }), c.ExtR = (0, k.createEnum)("ExtR", "random", {
      random: "Rndm",
      "level-based": "LvlB"
    }), c.FlCl = (0, k.createEnum)("FlCl", "background color", {
      "background color": "FlBc",
      "foreground color": "FlFr",
      "inverse image": "FlIn",
      "unaltered image": "FlSm"
    }), c.CntE = (0, k.createEnum)("CntE", "upper", {
      lower: "Lwr ",
      upper: "Upr "
    }), c.WndM = (0, k.createEnum)("WndM", "wind", {
      wind: "Wnd ",
      blast: "Blst",
      stagger: "Stgr"
    }), c.Drct = (0, k.createEnum)("Drct", "right", {
      left: "Left",
      right: "Rght"
    }), c.IntE = (0, k.createEnum)("IntE", "odd lines", {
      "odd lines": "ElmO",
      "even lines": "ElmE"
    }), c.IntC = (0, k.createEnum)("IntC", "interpolation", {
      duplication: "CrtD",
      interpolation: "CrtI"
    }), c.FlMd = (0, k.createEnum)("FlMd", "wrap around", {
      "set to transparent": "Bckg",
      "repeat edge pixels": "Rpt ",
      "wrap around": "Wrp "
    }), c.prjM = (0, k.createEnum)("prjM", "fisheye", {
      fisheye: "fisP",
      perspective: "perP",
      auto: "auto",
      "full spherical": "fusP"
    }), c.presetKindType = (0, k.createEnum)("presetKindType", "custom", {
      custom: "presetKindCustom",
      default: "presetKindDefault"
    });
  })(Ot)), Ot;
}
var Dn;
function Xn() {
  return Dn || (Dn = 1, (function(c) {
    Object.defineProperty(c, "__esModule", { value: !0 }), c.resourceHandlersMap = c.resourceHandlers = void 0;
    const q = Jt(), k = bt(), S = At(), l = mt(), f = hi(), a = Qt();
    c.resourceHandlers = [], c.resourceHandlersMap = {};
    function P(n, p, g, E) {
      const G = { key: n, has: p, read: g, write: E };
      c.resourceHandlers.push(G), c.resourceHandlersMap[G.key] = G;
    }
    const ee = [void 0, "PPI", "PPCM"], ye = [void 0, "Inches", "Centimeters", "Points", "Picas", "Columns"], O = "0123456789abcdef";
    function y(n) {
      return n <= 57 ? n - 48 : n >= 97 ? n - 87 : n - 55;
    }
    function H(n, p) {
      return y(n.charCodeAt(p)) << 4 | y(n.charCodeAt(p + 1));
    }
    function V(n, p) {
      const g = (0, k.readBytes)(n, p);
      return (0, f.decodeString)(g);
    }
    function le(n, p) {
      const g = (0, f.encodeString)(p);
      (0, S.writeBytes)(n, g);
    }
    function ce(n) {
      const p = (0, k.readUint8)(n), g = (0, k.readBytes)(n, p);
      let E = !1;
      for (let G = 0; G < g.byteLength; G++)
        if (g[G] & 128) {
          E = !0;
          break;
        }
      if (E)
        try {
          return new TextDecoder("gbk").decode(g);
        } catch {
        }
      return (0, f.decodeString)(g);
    }
    function ie(n, p) {
      let g = "";
      for (let G = 0, M = p.codePointAt(G++); M !== void 0; M = p.codePointAt(G++))
        g += M > 127 ? "?" : String.fromCodePoint(M);
      const E = (0, f.encodeString)(g);
      (0, S.writeUint8)(n, E.byteLength), (0, S.writeBytes)(n, E);
    }
    l.MOCK_HANDLERS && P(
      1028,
      // IPTC-NAA record
      // IPTC-NAA record
      (n) => n._ir1028 !== void 0,
      (n, p, g) => {
        p._ir1028 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1028);
      }
    ), P(1061, (n) => n.captionDigest !== void 0, (n, p) => {
      let g = "";
      for (let E = 0; E < 16; E++) {
        const G = (0, k.readUint8)(n);
        g += O[G >> 4], g += O[G & 15];
      }
      p.captionDigest = g;
    }, (n, p) => {
      for (let g = 0; g < 16; g++)
        (0, S.writeUint8)(n, H(p.captionDigest, g * 2));
    }), P(1060, (n) => n.xmpMetadata !== void 0, (n, p, g) => {
      p.xmpMetadata = V(n, g());
    }, (n, p) => {
      le(n, p.xmpMetadata);
    });
    const he = (0, l.createEnum)("Inte", "perceptual", {
      perceptual: "Img ",
      saturation: "Grp ",
      "relative colorimetric": "Clrm",
      "absolute colorimetric": "AClr"
    });
    l.MOCK_HANDLERS && P(
      1085,
      // Windows DEVMODE. Variable OS specific info for Windows.
      // Windows DEVMODE. Variable OS specific info for Windows.
      (n) => n._ir1085 !== void 0,
      (n, p, g) => {
        p._ir1085 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1085);
      }
    ), P(1082, (n) => n.printInformation !== void 0, (n, p) => {
      var g, E;
      const G = (0, a.readVersionAndDescriptor)(n);
      p.printInformation = {
        printerName: G.printerName || "",
        renderingIntent: he.decode((g = G.Inte) !== null && g !== void 0 ? g : "Inte.Img ")
      };
      const M = p.printInformation;
      G.PstS !== void 0 && (M.printerManagesColors = G.PstS), G["Nm  "] !== void 0 && (M.printerProfile = G["Nm  "]), G.MpBl !== void 0 && (M.blackPointCompensation = G.MpBl), G.printSixteenBit !== void 0 && (M.printSixteenBit = G.printSixteenBit), G.hardProof !== void 0 && (M.hardProof = G.hardProof), G.printProofSetup && ("Bltn" in G.printProofSetup ? M.proofSetup = { builtin: G.printProofSetup.Bltn.split(".")[1] } : M.proofSetup = {
        profile: G.printProofSetup.profile,
        renderingIntent: he.decode((E = G.printProofSetup.Inte) !== null && E !== void 0 ? E : "Inte.Img "),
        blackPointCompensation: !!G.printProofSetup.MpBl,
        paperWhite: !!G.printProofSetup.paperWhite
      });
    }, (n, p) => {
      var g, E;
      const G = p.printInformation, M = {};
      G.printerManagesColors ? M.PstS = !0 : (G.hardProof !== void 0 && (M.hardProof = !!G.hardProof), M.ClrS = "ClrS.RGBC", M["Nm  "] = (g = G.printerProfile) !== null && g !== void 0 ? g : "CIE RGB"), M.Inte = he.encode(G.renderingIntent), G.printerManagesColors || (M.MpBl = !!G.blackPointCompensation), M.printSixteenBit = !!G.printSixteenBit, M.printerName = G.printerName || "", G.proofSetup && "profile" in G.proofSetup ? M.printProofSetup = {
        profile: G.proofSetup.profile || "",
        Inte: he.encode(G.proofSetup.renderingIntent),
        MpBl: !!G.proofSetup.blackPointCompensation,
        paperWhite: !!G.proofSetup.paperWhite
      } : M.printProofSetup = {
        Bltn: !((E = G.proofSetup) === null || E === void 0) && E.builtin ? `builtinProof.${G.proofSetup.builtin}` : "builtinProof.proofCMYK"
      }, (0, a.writeVersionAndDescriptor)(n, "", "printOutput", M);
    }), l.MOCK_HANDLERS && P(
      1083,
      // Print style
      // Print style
      (n) => n._ir1083 !== void 0,
      (n, p, g) => {
        p._ir1083 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1083);
      }
    ), P(1005, (n) => n.resolutionInfo !== void 0, (n, p) => {
      const g = (0, k.readFixedPoint32)(n), E = (0, k.readUint16)(n), G = (0, k.readUint16)(n), M = (0, k.readFixedPoint32)(n), re = (0, k.readUint16)(n), Q = (0, k.readUint16)(n);
      p.resolutionInfo = {
        horizontalResolution: g,
        horizontalResolutionUnit: ee[E] || "PPI",
        widthUnit: ye[G] || "Inches",
        verticalResolution: M,
        verticalResolutionUnit: ee[re] || "PPI",
        heightUnit: ye[Q] || "Inches"
      };
    }, (n, p) => {
      const g = p.resolutionInfo;
      (0, S.writeFixedPoint32)(n, g.horizontalResolution || 0), (0, S.writeUint16)(n, Math.max(1, ee.indexOf(g.horizontalResolutionUnit))), (0, S.writeUint16)(n, Math.max(1, ye.indexOf(g.widthUnit))), (0, S.writeFixedPoint32)(n, g.verticalResolution || 0), (0, S.writeUint16)(n, Math.max(1, ee.indexOf(g.verticalResolutionUnit))), (0, S.writeUint16)(n, Math.max(1, ye.indexOf(g.heightUnit)));
    });
    const fe = ["centered", "size to fit", "user defined"];
    P(1062, (n) => n.printScale !== void 0, (n, p) => {
      p.printScale = {
        style: fe[(0, k.readInt16)(n)],
        x: (0, k.readFloat32)(n),
        y: (0, k.readFloat32)(n),
        scale: (0, k.readFloat32)(n)
      };
    }, (n, p) => {
      const { style: g, x: E, y: G, scale: M } = p.printScale;
      (0, S.writeInt16)(n, Math.max(0, fe.indexOf(g))), (0, S.writeFloat32)(n, E || 0), (0, S.writeFloat32)(n, G || 0), (0, S.writeFloat32)(n, M || 0);
    }), P(1006, (n) => n.alphaChannelNames !== void 0, (n, p, g) => {
      if (p.alphaChannelNames)
        (0, k.skipBytes)(n, g());
      else
        for (p.alphaChannelNames = []; g() > 0; ) {
          const E = ce(n);
          p.alphaChannelNames.push(E);
        }
    }, (n, p) => {
      for (const g of p.alphaChannelNames)
        ie(n, g);
    }), P(1045, (n) => n.alphaChannelNames !== void 0, (n, p, g) => {
      for (p.alphaChannelNames = []; g() > 0; )
        p.alphaChannelNames.push((0, k.readUnicodeString)(n));
    }, (n, p) => {
      for (const g of p.alphaChannelNames)
        (0, S.writeUnicodeStringWithPadding)(n, g);
    }), l.MOCK_HANDLERS && P(1077, (n) => n._ir1077 !== void 0, (n, p, g) => {
      p._ir1077 = (0, k.readBytes)(n, g());
    }, (n, p) => {
      (0, S.writeBytes)(n, p._ir1077);
    }), P(1053, (n) => n.alphaIdentifiers !== void 0, (n, p, g) => {
      for (p.alphaIdentifiers = []; g() >= 4; )
        p.alphaIdentifiers.push((0, k.readUint32)(n));
    }, (n, p) => {
      for (const g of p.alphaIdentifiers)
        (0, S.writeUint32)(n, g);
    }), P(1010, (n) => n.backgroundColor !== void 0, (n, p) => p.backgroundColor = (0, k.readColor)(n), (n, p) => (0, S.writeColor)(n, p.backgroundColor)), P(1037, (n) => n.globalAngle !== void 0, (n, p) => p.globalAngle = (0, k.readInt32)(n), (n, p) => (0, S.writeInt32)(n, p.globalAngle)), P(1049, (n) => n.globalAltitude !== void 0, (n, p) => p.globalAltitude = (0, k.readUint32)(n), (n, p) => (0, S.writeUint32)(n, p.globalAltitude)), P(1011, (n) => n.printFlags !== void 0, (n, p, g) => {
      p.printFlags = {
        labels: !!(0, k.readUint8)(n),
        cropMarks: !!(0, k.readUint8)(n),
        colorBars: !!(0, k.readUint8)(n),
        registrationMarks: !!(0, k.readUint8)(n),
        negative: !!(0, k.readUint8)(n),
        flip: !!(0, k.readUint8)(n),
        interpolate: !!(0, k.readUint8)(n),
        caption: !!(0, k.readUint8)(n),
        printFlags: g() ? !!(0, k.readUint8)(n) : !1
      };
    }, (n, p) => {
      const g = p.printFlags;
      (0, S.writeUint8)(n, g.labels ? 1 : 0), (0, S.writeUint8)(n, g.cropMarks ? 1 : 0), (0, S.writeUint8)(n, g.colorBars ? 1 : 0), (0, S.writeUint8)(n, g.registrationMarks ? 1 : 0), (0, S.writeUint8)(n, g.negative ? 1 : 0), (0, S.writeUint8)(n, g.flip ? 1 : 0), (0, S.writeUint8)(n, g.interpolate ? 1 : 0), (0, S.writeUint8)(n, g.caption ? 1 : 0), (0, S.writeUint8)(n, g.printFlags ? 1 : 0);
    }), P(
      1034,
      // Copyright flag
      // Copyright flag
      (n) => n.copyrighted !== void 0,
      (n, p) => {
        p.copyrighted = !!(0, k.readUint8)(n);
      },
      (n, p) => {
        (0, S.writeUint8)(n, p.copyrighted ? 1 : 0);
      }
    ), P(
      1035,
      // URL
      // URL
      (n) => n.url !== void 0,
      (n, p, g) => {
        p.url = (0, k.readAsciiString)(n, g());
      },
      (n, p) => {
        (0, S.writeAsciiString)(n, p.url);
      }
    ), l.MOCK_HANDLERS && P(
      1e4,
      // Print flags
      // Print flags
      (n) => n._ir10000 !== void 0,
      (n, p, g) => {
        p._ir10000 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir10000);
      }
    ), l.MOCK_HANDLERS && P(
      1013,
      // Color halftoning
      // Color halftoning
      (n) => n._ir1013 !== void 0,
      (n, p, g) => {
        p._ir1013 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1013);
      }
    ), l.MOCK_HANDLERS && P(
      1016,
      // Color transfer functions
      // Color transfer functions
      (n) => n._ir1016 !== void 0,
      (n, p, g) => {
        p._ir1016 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1016);
      }
    ), P(
      1080,
      // Count Information
      // Count Information
      (n) => n.countInformation !== void 0,
      (n, p) => {
        const g = (0, a.readVersionAndDescriptor)(n);
        p.countInformation = g.countGroupList.map((E) => ({
          color: { r: E["Rd  "], g: E["Grn "], b: E["Bl  "] },
          name: E["Nm  "],
          size: E["Rds "],
          fontSize: E.fontSize,
          visible: E.Vsbl,
          points: E.countObjectList.map((G) => ({ x: G["X   "], y: G["Y   "] }))
        }));
      },
      (n, p) => {
        const g = {
          Vrsn: 1,
          countGroupList: p.countInformation.map((E) => ({
            "Rd  ": E.color.r,
            "Grn ": E.color.g,
            "Bl  ": E.color.b,
            "Nm  ": E.name,
            "Rds ": E.size,
            fontSize: E.fontSize,
            Vsbl: E.visible,
            countObjectList: E.points.map((G) => ({ "X   ": G.x, "Y   ": G.y }))
          }))
        };
        (0, a.writeVersionAndDescriptor)(n, "", "Cnt ", g);
      }
    ), P(1024, (n) => n.layerState !== void 0, (n, p) => p.layerState = (0, k.readUint16)(n), (n, p) => (0, S.writeUint16)(n, p.layerState)), P(1026, (n) => n.layersGroup !== void 0, (n, p, g) => {
      for (p.layersGroup = []; g() > 0; )
        p.layersGroup.push((0, k.readUint16)(n));
    }, (n, p) => {
      for (const g of p.layersGroup)
        (0, S.writeUint16)(n, g);
    }), P(1072, (n) => n.layerGroupsEnabledId !== void 0, (n, p, g) => {
      for (p.layerGroupsEnabledId = []; g() > 0; )
        p.layerGroupsEnabledId.push((0, k.readUint8)(n));
    }, (n, p) => {
      for (const g of p.layerGroupsEnabledId)
        (0, S.writeUint8)(n, g);
    }), P(1069, (n) => n.layerSelectionIds !== void 0, (n, p) => {
      let g = (0, k.readUint16)(n);
      for (p.layerSelectionIds = []; g--; )
        p.layerSelectionIds.push((0, k.readUint32)(n));
    }, (n, p) => {
      (0, S.writeUint16)(n, p.layerSelectionIds.length);
      for (const g of p.layerSelectionIds)
        (0, S.writeUint32)(n, g);
    }), P(1032, (n) => n.gridAndGuidesInformation !== void 0, (n, p) => {
      const g = (0, k.readUint32)(n), E = (0, k.readUint32)(n), G = (0, k.readUint32)(n), M = (0, k.readUint32)(n);
      if (g !== 1)
        throw new Error(`Invalid 1032 resource version: ${g}`);
      p.gridAndGuidesInformation = {
        grid: { horizontal: E, vertical: G },
        guides: []
      };
      for (let re = 0; re < M; re++)
        p.gridAndGuidesInformation.guides.push({
          location: (0, k.readUint32)(n) / 32,
          direction: (0, k.readUint8)(n) ? "horizontal" : "vertical"
        });
    }, (n, p) => {
      const g = p.gridAndGuidesInformation, E = g.grid || { horizontal: 576, vertical: 576 }, G = g.guides || [];
      (0, S.writeUint32)(n, 1), (0, S.writeUint32)(n, E.horizontal), (0, S.writeUint32)(n, E.vertical), (0, S.writeUint32)(n, G.length);
      for (const M of G)
        (0, S.writeUint32)(n, M.location * 32), (0, S.writeUint8)(n, M.direction === "horizontal" ? 1 : 0);
    }), P(
      1065,
      // Layer Comps
      // Layer Comps
      (n) => n.layerComps !== void 0,
      (n, p) => {
        const g = (0, a.readVersionAndDescriptor)(n, !0);
        p.layerComps = { list: [] };
        for (const E of g.list)
          p.layerComps.list.push({
            id: E.compID,
            name: E["Nm  "],
            capturedInfo: E.capturedInfo
          }), "comment" in E && (p.layerComps.list[p.layerComps.list.length - 1].comment = E.comment);
        "lastAppliedComp" in g && (p.layerComps.lastApplied = g.lastAppliedComp);
      },
      (n, p) => {
        const g = p.layerComps, E = { list: [] };
        for (const G of g.list) {
          const M = {};
          M._classID = "Comp", M["Nm  "] = G.name, "comment" in G && (M.comment = G.comment), M.compID = G.id, M.capturedInfo = G.capturedInfo, E.list.push(M);
        }
        "lastApplied" in g && (E.lastAppliedComp = g.lastApplied), (0, a.writeVersionAndDescriptor)(n, "", "CompList", E);
      }
    ), l.MOCK_HANDLERS && P(
      1092,
      // ???
      // ???
      (n) => n._ir1092 !== void 0,
      (n, p, g) => {
        p._ir1092 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1092);
      }
    );
    const ne = [
      "normal",
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      "multiply",
      "screen",
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      "difference"
    ];
    P(
      1078,
      // Onion Skins
      // Onion Skins
      (n) => n.onionSkins !== void 0,
      (n, p) => {
        const g = (0, a.readVersionAndDescriptor)(n);
        p.onionSkins = {
          enabled: g.enab,
          framesBefore: g.numBefore,
          framesAfter: g.numAfter,
          frameSpacing: g.Spcn,
          minOpacity: g.minOpacity / 100,
          maxOpacity: g.maxOpacity / 100,
          blendMode: ne[g.BlnM] || "normal"
        };
      },
      (n, p) => {
        const g = p.onionSkins, E = {
          Vrsn: 1,
          enab: g.enabled,
          numBefore: g.framesBefore,
          numAfter: g.framesAfter,
          Spcn: g.frameSpacing,
          minOpacity: g.minOpacity * 100 | 0,
          maxOpacity: g.maxOpacity * 100 | 0,
          BlnM: Math.max(0, ne.indexOf(g.blendMode))
        };
        (0, a.writeVersionAndDescriptor)(n, "", "null", E);
      }
    ), P(
      1075,
      // Timeline Information
      // Timeline Information
      (n) => n.timelineInformation !== void 0,
      (n, p) => {
        var g, E;
        const G = (0, a.readVersionAndDescriptor)(n);
        p.timelineInformation = {
          enabled: G.enab,
          frameStep: (0, a.frac)(G.frameStep),
          frameRate: G.frameRate,
          time: (0, a.frac)(G.time),
          duration: (0, a.frac)(G.duration),
          workInTime: (0, a.frac)(G.workInTime),
          workOutTime: (0, a.frac)(G.workOutTime),
          repeats: G.LCnt,
          hasMotion: G.hasMotion,
          globalTracks: (0, a.parseTrackList)(G.globalTrackList, !!n.logMissingFeatures)
        }, !((E = (g = G.audioClipGroupList) === null || g === void 0 ? void 0 : g.audioClipGroupList) === null || E === void 0) && E.length && (p.timelineInformation.audioClipGroups = G.audioClipGroupList.audioClipGroupList.map((M) => ({
          id: M.groupID,
          muted: M.muted,
          audioClips: M.audioClipList.map(({ clipID: re, timeScope: Q, muted: se, audioLevel: me, frameReader: te }) => ({
            id: re,
            start: (0, a.frac)(Q.Strt),
            duration: (0, a.frac)(Q.duration),
            inTime: (0, a.frac)(Q.inTime),
            outTime: (0, a.frac)(Q.outTime),
            muted: se,
            audioLevel: me,
            frameReader: {
              type: te.frameReaderType,
              mediaDescriptor: te.mediaDescriptor,
              link: {
                name: te["Lnk "]["Nm  "],
                fullPath: te["Lnk "].fullPath,
                relativePath: te["Lnk "].relPath
              }
            }
          }))
        })));
      },
      (n, p) => {
        var g;
        const E = p.timelineInformation, G = {
          Vrsn: 1,
          enab: E.enabled,
          frameStep: E.frameStep,
          frameRate: E.frameRate,
          time: E.time,
          duration: E.duration,
          workInTime: E.workInTime,
          workOutTime: E.workOutTime,
          LCnt: E.repeats,
          globalTrackList: (0, a.serializeTrackList)(E.globalTracks),
          audioClipGroupList: {
            audioClipGroupList: (g = E.audioClipGroups) === null || g === void 0 ? void 0 : g.map((M) => ({
              groupID: M.id,
              muted: M.muted,
              audioClipList: M.audioClips.map((re) => ({
                clipID: re.id,
                timeScope: {
                  Vrsn: 1,
                  Strt: re.start,
                  duration: re.duration,
                  inTime: re.inTime,
                  outTime: re.outTime
                },
                frameReader: {
                  frameReaderType: re.frameReader.type,
                  descVersion: 1,
                  "Lnk ": {
                    descVersion: 1,
                    "Nm  ": re.frameReader.link.name,
                    fullPath: re.frameReader.link.fullPath,
                    relPath: re.frameReader.link.relativePath
                  },
                  mediaDescriptor: re.frameReader.mediaDescriptor
                },
                muted: re.muted,
                audioLevel: re.audioLevel
              }))
            }))
          },
          hasMotion: E.hasMotion
        };
        (0, a.writeVersionAndDescriptor)(n, "", "null", G, "anim");
      }
    ), P(
      1076,
      // Sheet Disclosure
      // Sheet Disclosure
      (n) => n.sheetDisclosure !== void 0,
      (n, p) => {
        const g = (0, a.readVersionAndDescriptor)(n);
        p.sheetDisclosure = {}, g.sheetTimelineOptions && (p.sheetDisclosure.sheetTimelineOptions = g.sheetTimelineOptions.map((E) => ({
          sheetID: E.sheetID,
          sheetDisclosed: E.sheetDisclosed,
          lightsDisclosed: E.lightsDisclosed,
          meshesDisclosed: E.meshesDisclosed,
          materialsDisclosed: E.materialsDisclosed
        })));
      },
      (n, p) => {
        const g = p.sheetDisclosure, E = { Vrsn: 1 };
        g.sheetTimelineOptions && (E.sheetTimelineOptions = g.sheetTimelineOptions.map((G) => ({
          Vrsn: 2,
          sheetID: G.sheetID,
          sheetDisclosed: G.sheetDisclosed,
          lightsDisclosed: G.lightsDisclosed,
          meshesDisclosed: G.meshesDisclosed,
          materialsDisclosed: G.materialsDisclosed
        }))), (0, a.writeVersionAndDescriptor)(n, "", "null", E);
      }
    ), P(
      1054,
      // URL List
      // URL List
      (n) => n.urlsList !== void 0,
      (n, p) => {
        const g = (0, k.readUint32)(n);
        p.urlsList = [];
        for (let E = 0; E < g; E++) {
          if ((0, k.readSignature)(n) !== "slic" && n.throwForMissingFeatures)
            throw new Error("Unknown long");
          const M = (0, k.readUint32)(n), re = (0, k.readUnicodeString)(n);
          p.urlsList.push({ id: M, url: re, ref: "slice" });
        }
      },
      (n, p) => {
        const g = p.urlsList;
        (0, S.writeUint32)(n, g.length);
        for (let E = 0; E < g.length; E++)
          (0, S.writeSignature)(n, "slic"), (0, S.writeUint32)(n, g[E].id), (0, S.writeUnicodeString)(n, g[E].url);
      }
    );
    function B(n) {
      return { "Top ": n.top, Left: n.left, Btom: n.bottom, Rght: n.right };
    }
    function z(n) {
      return { top: n["Top "], left: n.Left, bottom: n.Btom, right: n.Rght };
    }
    function C(n, p) {
      return n[Math.max(0, Math.min(n.length - 1, p))];
    }
    const F = ["autoGenerated", "layer", "userGenerated"], N = ["noImage", "image"], J = ["default"];
    P(
      1050,
      // Slices
      // Slices
      (n) => n.slices ? n.slices.length : 0,
      (n, p, g) => {
        const E = (0, k.readUint32)(n);
        if (E === 6) {
          p.slices || (p.slices = []);
          const G = (0, k.readInt32)(n), M = (0, k.readInt32)(n), re = (0, k.readInt32)(n), Q = (0, k.readInt32)(n), se = (0, k.readUnicodeString)(n), me = (0, k.readUint32)(n);
          p.slices.push({ bounds: { top: G, left: M, bottom: re, right: Q }, groupName: se, slices: [] });
          const te = p.slices[p.slices.length - 1].slices;
          for (let ve = 0; ve < me; ve++) {
            const ue = (0, k.readUint32)(n), Fe = (0, k.readUint32)(n), _e = C(F, (0, k.readUint32)(n)), Oe = _e == "layer" ? (0, k.readUint32)(n) : 0, Ie = (0, k.readUnicodeString)(n), xe = C(N, (0, k.readUint32)(n)), Ae = (0, k.readInt32)(n), ze = (0, k.readInt32)(n), Pe = (0, k.readInt32)(n), Re = (0, k.readInt32)(n), Ve = (0, k.readUnicodeString)(n), Ge = (0, k.readUnicodeString)(n), Be = (0, k.readUnicodeString)(n), v = (0, k.readUnicodeString)(n), A = !!(0, k.readUint8)(n), Y = (0, k.readUnicodeString)(n), de = C(J, (0, k.readUint32)(n)), pe = C(J, (0, k.readUint32)(n)), oe = (0, k.readUint8)(n), e = (0, k.readUint8)(n), i = (0, k.readUint8)(n), r = (0, k.readUint8)(n), h = oe + e + i + r === 0 ? "none" : oe === 0 ? "matte" : "color";
            te.push({
              id: ue,
              groupId: Fe,
              origin: _e,
              associatedLayerId: Oe,
              name: Ie,
              target: Ge,
              message: Be,
              altTag: v,
              cellTextIsHTML: A,
              cellText: Y,
              horizontalAlignment: de,
              verticalAlignment: pe,
              type: xe,
              url: Ve,
              bounds: { top: ze, left: Ae, bottom: Re, right: Pe },
              backgroundColorType: h,
              backgroundColor: { r: e, g: i, b: r, a: oe }
            });
          }
          g() && (0, a.readVersionAndDescriptor)(n).slices.forEach((ue) => {
            const Fe = te.find((_e) => ue.sliceID == _e.id);
            Fe && (Fe.topOutset = ue.topOutset, Fe.leftOutset = ue.leftOutset, Fe.bottomOutset = ue.bottomOutset, Fe.rightOutset = ue.rightOutset);
          });
        } else if (E === 7 || E === 8) {
          const G = (0, a.readVersionAndDescriptor)(n);
          p.slices || (p.slices = []), p.slices.push({
            groupName: G.baseName,
            bounds: z(G.bounds),
            slices: G.slices.map((M) => Object.assign(Object.assign({}, M["Nm  "] ? { name: M["Nm  "] } : {}), { id: M.sliceID, groupId: M.groupID, associatedLayerId: 0, origin: a.ESliceOrigin.decode(M.origin), type: a.ESliceType.decode(M.Type), bounds: z(M.bounds), url: M.url, target: M.null, message: M.Msge, altTag: M.altTag, cellTextIsHTML: M.cellTextIsHTML, cellText: M.cellText, horizontalAlignment: a.ESliceHorzAlign.decode(M.horzAlign), verticalAlignment: a.ESliceVertAlign.decode(M.vertAlign), backgroundColorType: a.ESliceBGColorType.decode(M.bgColorType), backgroundColor: M.bgColor ? { r: M.bgColor["Rd  "], g: M.bgColor["Grn "], b: M.bgColor["Bl  "], a: M.bgColor.alpha } : { r: 0, g: 0, b: 0, a: 0 }, topOutset: M.topOutset || 0, leftOutset: M.leftOutset || 0, bottomOutset: M.bottomOutset || 0, rightOutset: M.rightOutset || 0 }))
          });
        } else
          throw new Error(`Invalid slices version (${E})`);
      },
      (n, p, g) => {
        const { bounds: E, groupName: G, slices: M } = p.slices[g];
        (0, S.writeUint32)(n, 6), (0, S.writeInt32)(n, E.top), (0, S.writeInt32)(n, E.left), (0, S.writeInt32)(n, E.bottom), (0, S.writeInt32)(n, E.right), (0, S.writeUnicodeString)(n, G), (0, S.writeUint32)(n, M.length);
        for (let Q = 0; Q < M.length; Q++) {
          const se = M[Q];
          let { a: me, r: te, g: ve, b: ue } = se.backgroundColor;
          se.backgroundColorType === "none" ? me = te = ve = ue = 0 : se.backgroundColorType === "matte" && (me = 0, te = ve = ue = 255), (0, S.writeUint32)(n, se.id), (0, S.writeUint32)(n, se.groupId), (0, S.writeUint32)(n, F.indexOf(se.origin)), se.origin === "layer" && (0, S.writeUint32)(n, se.associatedLayerId), (0, S.writeUnicodeString)(n, se.name || ""), (0, S.writeUint32)(n, N.indexOf(se.type)), (0, S.writeInt32)(n, se.bounds.left), (0, S.writeInt32)(n, se.bounds.top), (0, S.writeInt32)(n, se.bounds.right), (0, S.writeInt32)(n, se.bounds.bottom), (0, S.writeUnicodeString)(n, se.url), (0, S.writeUnicodeString)(n, se.target), (0, S.writeUnicodeString)(n, se.message), (0, S.writeUnicodeString)(n, se.altTag), (0, S.writeUint8)(n, se.cellTextIsHTML ? 1 : 0), (0, S.writeUnicodeString)(n, se.cellText), (0, S.writeUint32)(n, J.indexOf(se.horizontalAlignment)), (0, S.writeUint32)(n, J.indexOf(se.verticalAlignment)), (0, S.writeUint8)(n, me), (0, S.writeUint8)(n, te), (0, S.writeUint8)(n, ve), (0, S.writeUint8)(n, ue);
        }
        const re = {
          bounds: B(E),
          slices: []
        };
        M.forEach((Q) => {
          const se = Object.assign(Object.assign({ sliceID: Q.id, groupID: Q.groupId, origin: a.ESliceOrigin.encode(Q.origin), Type: a.ESliceType.encode(Q.type), bounds: B(Q.bounds) }, Q.name ? { "Nm  ": Q.name } : {}), { url: Q.url, null: Q.target, Msge: Q.message, altTag: Q.altTag, cellTextIsHTML: Q.cellTextIsHTML, cellText: Q.cellText, horzAlign: a.ESliceHorzAlign.encode(Q.horizontalAlignment), vertAlign: a.ESliceVertAlign.encode(Q.verticalAlignment), bgColorType: a.ESliceBGColorType.encode(Q.backgroundColorType) });
          if (Q.backgroundColorType === "color") {
            const { r: me, g: te, b: ve, a: ue } = Q.backgroundColor;
            se.bgColor = { "Rd  ": me, "Grn ": te, "Bl  ": ve, alpha: ue };
          }
          se.topOutset = Q.topOutset || 0, se.leftOutset = Q.leftOutset || 0, se.bottomOutset = Q.bottomOutset || 0, se.rightOutset = Q.rightOutset || 0, re.slices.push(se);
        }), (0, a.writeVersionAndDescriptor)(n, "", "null", re, "slices");
      }
    ), P(1064, (n) => n.pixelAspectRatio !== void 0, (n, p) => {
      if ((0, k.readUint32)(n) > 2)
        throw new Error("Invalid pixelAspectRatio version");
      p.pixelAspectRatio = { aspect: (0, k.readFloat64)(n) };
    }, (n, p) => {
      (0, S.writeUint32)(n, 2), (0, S.writeFloat64)(n, p.pixelAspectRatio.aspect);
    }), P(1041, (n) => n.iccUntaggedProfile !== void 0, (n, p) => {
      p.iccUntaggedProfile = !!(0, k.readUint8)(n);
    }, (n, p) => {
      (0, S.writeUint8)(n, p.iccUntaggedProfile ? 1 : 0);
    }), l.MOCK_HANDLERS && P(
      1039,
      // ICC Profile
      // ICC Profile
      (n) => n._ir1039 !== void 0,
      (n, p, g) => {
        p._ir1039 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1039);
      }
    ), P(1044, (n) => n.idsSeedNumber !== void 0, (n, p) => p.idsSeedNumber = (0, k.readUint32)(n), (n, p) => (0, S.writeUint32)(n, p.idsSeedNumber)), P(1036, (n) => n.thumbnail !== void 0 || n.thumbnailRaw !== void 0, (n, p, g) => {
      const E = (0, k.readUint32)(n), G = (0, k.readUint32)(n), M = (0, k.readUint32)(n);
      (0, k.readUint32)(n), (0, k.readUint32)(n), (0, k.readUint32)(n);
      const re = (0, k.readUint16)(n), Q = (0, k.readUint16)(n);
      if (E !== 1 || re !== 24 || Q !== 1) {
        n.logMissingFeatures && n.log(`Invalid thumbnail data (format: ${E}, bitsPerPixel: ${re}, planes: ${Q})`), (0, k.skipBytes)(n, g());
        return;
      }
      const se = g(), me = (0, k.readBytes)(n, se);
      n.useRawThumbnail ? p.thumbnailRaw = { width: G, height: M, data: me } : me.byteLength && (p.thumbnail = (0, l.createCanvasFromData)(me));
    }, (n, p) => {
      var g;
      let E = 0, G = 0, M = new Uint8Array(0);
      if (p.thumbnailRaw)
        E = p.thumbnailRaw.width, G = p.thumbnailRaw.height, M = p.thumbnailRaw.data;
      else
        try {
          const ve = (g = p.thumbnail.toDataURL("image/jpeg", 1)) === null || g === void 0 ? void 0 : g.substring(23);
          ve && (M = (0, q.toByteArray)(ve), E = p.thumbnail.width, G = p.thumbnail.height);
        } catch {
        }
      const re = 24, Q = Math.floor((E * re + 31) / 32) * 4, se = 1, me = Q * G * se, te = M.length;
      (0, S.writeUint32)(n, 1), (0, S.writeUint32)(n, E), (0, S.writeUint32)(n, G), (0, S.writeUint32)(n, Q), (0, S.writeUint32)(n, me), (0, S.writeUint32)(n, te), (0, S.writeUint16)(n, re), (0, S.writeUint16)(n, se), (0, S.writeBytes)(n, M);
    }), P(1057, (n) => n.versionInfo !== void 0, (n, p, g) => {
      if ((0, k.readUint32)(n) !== 1)
        throw new Error("Invalid versionInfo version");
      p.versionInfo = {
        hasRealMergedData: !!(0, k.readUint8)(n),
        writerName: (0, k.readUnicodeString)(n),
        readerName: (0, k.readUnicodeString)(n),
        fileVersion: (0, k.readUint32)(n)
      }, (0, k.skipBytes)(n, g());
    }, (n, p) => {
      const g = p.versionInfo;
      (0, S.writeUint32)(n, 1), (0, S.writeUint8)(n, g.hasRealMergedData ? 1 : 0), (0, S.writeUnicodeString)(n, g.writerName), (0, S.writeUnicodeString)(n, g.readerName), (0, S.writeUint32)(n, g.fileVersion);
    }), l.MOCK_HANDLERS && P(
      1058,
      // EXIF data 1.
      // EXIF data 1.
      (n) => n._ir1058 !== void 0,
      (n, p, g) => {
        p._ir1058 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir1058);
      }
    ), P(7e3, (n) => n.imageReadyVariables !== void 0, (n, p, g) => {
      p.imageReadyVariables = V(n, g());
    }, (n, p) => {
      le(n, p.imageReadyVariables);
    }), P(7001, (n) => n.imageReadyDataSets !== void 0, (n, p, g) => {
      p.imageReadyDataSets = V(n, g());
    }, (n, p) => {
      le(n, p.imageReadyDataSets);
    }), P(1088, (n) => n.pathSelectionState !== void 0, (n, p, g) => {
      const E = (0, a.readVersionAndDescriptor)(n);
      p.pathSelectionState = E.null;
    }, (n, p) => {
      const g = { null: p.pathSelectionState };
      (0, a.writeVersionAndDescriptor)(n, "", "null", g);
    }), l.MOCK_HANDLERS && P(1025, (n) => n._ir1025 !== void 0, (n, p, g) => {
      p._ir1025 = (0, k.readBytes)(n, g());
    }, (n, p) => {
      (0, S.writeBytes)(n, p._ir1025);
    });
    const W = (0, l.createEnum)("FrmD", "auto", {
      auto: "Auto",
      none: "None",
      dispose: "Disp"
    });
    P(
      4e3,
      // Plug-In resource(s)
      // Plug-In resource(s)
      (n) => n.animations !== void 0,
      (n, p, g) => {
        const E = (0, k.readSignature)(n);
        if (E === "mani")
          (0, k.checkSignature)(n, "IRFR"), (0, k.readSection)(n, 1, (G) => {
            for (; G() > 0; ) {
              (0, k.checkSignature)(n, "8BIM");
              const M = (0, k.readSignature)(n);
              (0, k.readSection)(n, 1, (re) => {
                if (M === "AnDs") {
                  const Q = (0, a.readVersionAndDescriptor)(n);
                  p.animations = {
                    // desc.AFSt ???
                    frames: Q.FrIn.map((se) => ({
                      id: se.FrID,
                      delay: (se.FrDl || 0) / 100,
                      dispose: se.FrDs ? W.decode(se.FrDs) : "auto"
                      // missing == auto
                      // x.FrGA ???
                    })),
                    animations: Q.FSts.map((se) => ({
                      id: se.FsID,
                      frames: se.FsFr,
                      repeats: se.LCnt,
                      activeFrame: se.AFrm || 0
                    }))
                  };
                } else if (M === "Roll") {
                  const Q = (0, k.readBytes)(n, re());
                  n.logDevFeatures && n.log("#4000 Roll", Q);
                } else
                  n.logMissingFeatures && n.log("Unhandled subsection in #4000", M);
              });
            }
          });
        else if (E === "mopt") {
          const G = (0, k.readBytes)(n, g());
          n.logDevFeatures && n.log("#4000 mopt", G);
        } else
          n.logMissingFeatures && n.log("Unhandled key in #4000:", E);
      },
      (n, p) => {
        p.animations && ((0, S.writeSignature)(n, "mani"), (0, S.writeSignature)(n, "IRFR"), (0, S.writeSection)(n, 1, () => {
          (0, S.writeSignature)(n, "8BIM"), (0, S.writeSignature)(n, "AnDs"), (0, S.writeSection)(n, 1, () => {
            const g = {
              // AFSt: 0, // ???
              FrIn: [],
              FSts: []
            };
            for (let E = 0; E < p.animations.frames.length; E++) {
              const G = p.animations.frames[E], M = {
                FrID: G.id
              };
              G.delay && (M.FrDl = G.delay * 100 | 0), M.FrDs = W.encode(G.dispose), g.FrIn.push(M);
            }
            for (let E = 0; E < p.animations.animations.length; E++) {
              const G = p.animations.animations[E], M = {
                FsID: G.id,
                AFrm: G.activeFrame | 0,
                FsFr: G.frames,
                LCnt: G.repeats | 0
              };
              g.FSts.push(M);
            }
            (0, a.writeVersionAndDescriptor)(n, "", "null", g);
          });
        }));
      }
    ), l.MOCK_HANDLERS && P(
      4001,
      // Plug-In resource(s)
      // Plug-In resource(s)
      (n) => n._ir4001 !== void 0,
      (n, p, g) => {
        if (l.MOCK_HANDLERS) {
          p._ir4001 = (0, k.readBytes)(n, g());
          return;
        }
        const E = (0, k.readSignature)(n);
        if (E === "mfri") {
          if ((0, k.readUint32)(n) !== 2)
            throw new Error("Invalid mfri version");
          const M = (0, k.readUint32)(n), re = (0, k.readBytes)(n, M);
          n.logDevFeatures && n.log("mfri", re);
        } else if (E === "mset") {
          const G = (0, a.readVersionAndDescriptor)(n);
          n.logDevFeatures && n.log("mset", G);
        } else
          n.logMissingFeatures && n.log("Unhandled key in #4001", E);
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir4001);
      }
    ), l.MOCK_HANDLERS && P(
      4002,
      // Plug-In resource(s)
      // Plug-In resource(s)
      (n) => n._ir4002 !== void 0,
      (n, p, g) => {
        p._ir4002 = (0, k.readBytes)(n, g());
      },
      (n, p) => {
        (0, S.writeBytes)(n, p._ir4002);
      }
    );
  })(qt)), qt;
}
var On;
function bt() {
  return On || (On = 1, (function(c) {
    var q = Dt && Dt.__rest || function(s, D) {
      var ae = {};
      for (var K in s) Object.prototype.hasOwnProperty.call(s, K) && D.indexOf(K) < 0 && (ae[K] = s[K]);
      if (s != null && typeof Object.getOwnPropertySymbols == "function")
        for (var t = 0, K = Object.getOwnPropertySymbols(s); t < K.length; t++)
          D.indexOf(K[t]) < 0 && Object.prototype.propertyIsEnumerable.call(s, K[t]) && (ae[K[t]] = s[K[t]]);
      return ae;
    };
    Object.defineProperty(c, "__esModule", { value: !0 }), c.supportedColorModes = void 0, c.createReader = ee, c.warnOrThrow = ye, c.readUint8 = O, c.peekUint8 = y, c.readInt16 = H, c.readUint16 = V, c.readUint16LE = le, c.readInt32 = ce, c.readInt32LE = ie, c.readUint32 = he, c.readFloat32 = fe, c.readFloat64 = ne, c.readFixedPoint32 = B, c.readFixedPointPath32 = z, c.readBytes = C, c.readSignature = F, c.validSignatureAt = N, c.readPascalString = J, c.readUnicodeString = W, c.readUnicodeStringWithLength = n, c.readUnicodeStringWithLengthLE = p, c.readAsciiString = g, c.skipBytes = E, c.checkSignature = G, c.readPsd = Q, c.readLayerInfo = se, c.getCompositeImageData = Ie, c.getCompositeCanvas = xe, c.getLayerImageData = Ae, c.getLayerMaskImageData = ze, c.getLayerRealMaskImageData = Pe, c.getLayerCanvas = Re, c.getLayerMaskCanvas = Ve, c.getLayerRealMaskCanvas = Ge, c.decodeLayerPixels = A, c.readGlobalLayerMaskInfo = e, c.readAdditionalLayerInfo = w, c.readDataZip = X, c.readDataRLE = u, c.readSection = $, c.readColor = be, c.readPattern = ge;
    const k = Zn(), S = mt(), l = en(), f = Xn();
    c.supportedColorModes = [
      0,
      1,
      3,
      2
      /* ColorMode.Indexed */
    ];
    const a = ["bitmap", "grayscale", "indexed", "RGB", "CMYK", "", "", "multichannel", "duotone", "lab"];
    function P(s) {
      const D = s.width * s.height * 4;
      for (let ae = 0; ae < D; ae += 4) {
        const K = s.data[ae];
        s.data[ae + 1] = K, s.data[ae + 2] = K;
      }
    }
    function ee(s, D, ae) {
      return { view: new DataView(s, D, ae), offset: 0, strict: !1, debug: !1, large: !1, globalAlpha: !1, log: console.log };
    }
    function ye(s, D) {
      if (s.strict)
        throw new Error(D);
      s.debug && s.log(D);
    }
    function O(s) {
      return s.offset += 1, s.view.getUint8(s.offset - 1);
    }
    function y(s) {
      return s.view.getUint8(s.offset);
    }
    function H(s) {
      return s.offset += 2, s.view.getInt16(s.offset - 2, !1);
    }
    function V(s) {
      return s.offset += 2, s.view.getUint16(s.offset - 2, !1);
    }
    function le(s) {
      return s.offset += 2, s.view.getUint16(s.offset - 2, !0);
    }
    function ce(s) {
      return s.offset += 4, s.view.getInt32(s.offset - 4, !1);
    }
    function ie(s) {
      return s.offset += 4, s.view.getInt32(s.offset - 4, !0);
    }
    function he(s) {
      return s.offset += 4, s.view.getUint32(s.offset - 4, !1);
    }
    function fe(s) {
      return s.offset += 4, s.view.getFloat32(s.offset - 4, !1);
    }
    function ne(s) {
      return s.offset += 8, s.view.getFloat64(s.offset - 8, !1);
    }
    function B(s) {
      return ce(s) / 65536;
    }
    function z(s) {
      return ce(s) / (1 << 24);
    }
    function C(s, D) {
      const ae = s.view.byteOffset + s.offset;
      if (s.offset += D, ae + D > s.view.buffer.byteLength) {
        if (ye(s, "Reading bytes exceeding buffer length"), D > 100 * 1024 * 1024)
          throw new Error("Reading past end of file");
        const K = new Uint8Array(D), t = Math.min(D, s.view.byteLength - ae);
        return t > 0 && K.set(new Uint8Array(s.view.buffer, ae, t)), K;
      } else
        return new Uint8Array(s.view.buffer, ae, D);
    }
    function F(s) {
      return M(s, 4);
    }
    function N(s, D) {
      const ae = String.fromCharCode(s.view.getUint8(D)) + String.fromCharCode(s.view.getUint8(D + 1)) + String.fromCharCode(s.view.getUint8(D + 2)) + String.fromCharCode(s.view.getUint8(D + 3));
      return ae == "8BIM" || ae == "8B64";
    }
    function J(s, D) {
      let ae = O(s);
      const K = ae ? M(s, ae) : "";
      for (; ++ae % D; )
        s.offset++;
      return K;
    }
    function W(s) {
      const D = he(s);
      return n(s, D);
    }
    function n(s, D) {
      let ae = "";
      for (; D--; ) {
        const K = V(s);
        (K || D > 0) && (ae += String.fromCharCode(K));
      }
      return ae;
    }
    function p(s, D) {
      let ae = "";
      for (; D--; ) {
        const K = le(s);
        (K || D > 0) && (ae += String.fromCharCode(K));
      }
      return ae;
    }
    function g(s, D) {
      let ae = "";
      for (; D--; )
        ae += String.fromCharCode(O(s));
      return ae;
    }
    function E(s, D) {
      s.offset += D;
    }
    function G(s, D, ae) {
      const K = s.offset, t = F(s);
      if (t !== D && t !== ae)
        throw new Error(`Invalid signature: '${t}' at 0x${K.toString(16)}`);
    }
    function M(s, D) {
      const ae = C(s, D);
      let K = "";
      for (let t = 0; t < ae.length; t++)
        K += String.fromCharCode(ae[t]);
      return K;
    }
    function re(s) {
      return s === "8BIM" || s === "MeSa" || s === "AgHg" || s === "PHUT" || s === "DCSR";
    }
    function Q(s, D = {}) {
      var ae;
      G(s, "8BPS");
      const K = V(s);
      if (K !== 1 && K !== 2)
        throw new Error(`Invalid PSD file version: ${K}`);
      E(s, 6);
      const t = V(s), T = he(s), m = he(s), j = V(s), R = V(s), we = K === 1 ? 3e4 : 3e5;
      if (m > we || T > we)
        throw new Error(`Invalid size: ${m}x${T}`);
      if (t > 16)
        throw new Error(`Invalid channel count: ${t}`);
      if (![1, 8, 16, 32].includes(j))
        throw new Error(`Invalid bitsPerChannel: ${j}`);
      if (c.supportedColorModes.indexOf(R) === -1)
        throw new Error(`Color mode not supported: ${(ae = a[R]) !== null && ae !== void 0 ? ae : R}`);
      const ke = { width: m, height: T, channels: t, bitsPerChannel: j, colorMode: R };
      Object.assign(s, D), s.large = K === 2, s.globalAlpha = !1, "totalMemoryLimit" in s || (s.totalMemoryLimit = 2 * 1024 * 1024 * 1024), $(s, 1, (je) => {
        if (je()) {
          if (R === 2) {
            if (je() != 768)
              throw new Error("Invalid color palette size");
            ke.palette = [];
            for (let Te = 0; Te < 256; Te++)
              ke.palette.push({ r: O(s), g: 0, b: 0 });
            for (let Te = 0; Te < 256; Te++)
              ke.palette[Te].g = O(s);
            for (let Te = 0; Te < 256; Te++)
              ke.palette[Te].b = O(s);
          }
          E(s, je());
        }
      });
      const Se = {};
      $(s, 1, (je) => {
        for (; je() > 0; ) {
          r(s, re);
          const Te = V(s);
          J(s, 2), $(s, 2, (We) => {
            const Ze = f.resourceHandlersMap[Te], Ke = Te === 1036 && !!s.skipThumbnail;
            if (Ze && !Ke)
              try {
                Ze.read(s, Se, We);
              } catch (at) {
                if (s.throwForMissingFeatures)
                  throw at;
                E(s, We());
              }
            else
              E(s, We());
          });
        }
      });
      const { layersGroup: Ee, layerGroupsEnabledId: Ue } = Se, Le = q(Se, ["layersGroup", "layerGroupsEnabledId"]);
      Object.keys(Le).length && (ke.imageResources = Le), $(s, 1, (je) => {
        if ($(s, 2, (Te) => {
          se(s, ke, Se), E(s, Te());
        }, void 0, s.large), je() > 0) {
          const Te = e(s);
          Te && (ke.globalLayerMaskInfo = Te);
        } else
          E(s, je());
        for (; je() > 0; ) {
          for (; je() && y(s) === 0; )
            E(s, 1);
          je() >= 12 ? w(s, ke, ke, Se) : E(s, je());
        }
      }, void 0, s.large);
      const He = ke.children && ke.children.length;
      if (!(s.skipCompositeImageData && (s.skipLayerImageData || He)))
        if (s.useRawData)
          ke.rawCompositeData = new Uint8Array(s.view.buffer, s.view.byteOffset + s.offset);
        else {
          const je = Z(s, ke);
          s.useImageData ? ke.imageData = je : ke.canvas = (0, S.imageDataToCanvas)(je);
        }
      return ke;
    }
    function se(s, D, ae) {
      var K, t;
      const { layersGroup: T = [], layerGroupsEnabledId: m = [] } = ae;
      let j = H(s);
      j < 0 && (s.globalAlpha = !0, j = -j);
      const R = [], we = [];
      for (let Se = 0; Se < j; Se++) {
        const { layer: Ee, channels: Ue } = me(s, D, ae);
        T[Se] !== void 0 && (Ee.linkGroup = T[Se]), m[Se] !== void 0 && (Ee.linkGroupEnabled = !!m[Se]), R.push(Ee), we.push(Ue);
      }
      for (let Se = 0; Se < j; Se++)
        _e(s, D, R[Se], we[Se]);
      D.children || (D.children = []);
      const ke = [D];
      for (let Se = R.length - 1; Se >= 0; Se--) {
        const Ee = R[Se], Ue = Ee.sectionDivider ? Ee.sectionDivider.type : 0;
        Ue === 1 || Ue === 2 ? (Ee.opened = Ue === 1, Ee.children = [], !((K = Ee.sectionDivider) === null || K === void 0) && K.key && (Ee.blendMode = (t = S.toBlendMode[Ee.sectionDivider.key]) !== null && t !== void 0 ? t : Ee.blendMode), ke[ke.length - 1].children.unshift(Ee), ke.push(Ee)) : Ue === 3 ? ke.pop() : ke[ke.length - 1].children.unshift(Ee);
      }
    }
    function me(s, D, ae) {
      const K = {};
      if (K.top = ce(s), K.left = ce(s), K.bottom = ce(s), K.right = ce(s), !te(K, s))
        throw new Error("Invalid layer size");
      const t = V(s), T = [];
      for (let R = 0; R < t; R++) {
        let we = H(s), ke = he(s);
        if (s.large) {
          if (ke !== 0)
            throw new Error("Sizes larger than 4GB are not supported");
          ke = he(s);
        }
        T.push({ id: we, length: ke });
      }
      G(s, "8BIM");
      const m = F(s);
      if (!S.toBlendMode[m])
        throw new Error(`Invalid blend mode: '${m}'`);
      K.blendMode = S.toBlendMode[m], K.opacity = O(s) / 255, K.clipping = O(s) === 1;
      const j = O(s);
      return K.transparencyProtected = (j & 1) !== 0, K.hidden = (j & 2) !== 0, j & 32 && (K.effectsOpen = !0), E(s, 1), $(s, 1, (R) => {
        ve(s, K);
        const we = Fe(s);
        for (we && (K.blendingRanges = we), K.name = J(s, 1); R() > 4 && !N(s, s.offset); )
          s.offset++;
        for (; R() >= 12; )
          w(s, K, D, ae);
        E(s, R());
      }), { layer: K, channels: T };
    }
    function te(s, D) {
      const ae = (s.right || 0) - (s.left || 0), K = (s.bottom || 0) - (s.top || 0), t = D.large ? 3e5 : 3e4;
      return ae >= 0 && K >= 0 && ae <= t && K <= t;
    }
    function ve(s, D) {
      return $(s, 1, (ae) => {
        if (!ae())
          return;
        const K = {};
        if (D.mask = K, K.top = ce(s), K.left = ce(s), K.bottom = ce(s), K.right = ce(s), !te(K, s))
          throw new Error("Invalid mask size");
        K.defaultColor = O(s);
        const t = O(s);
        if (K.positionRelativeToLayer = (t & 1) !== 0, K.disabled = (t & 2) !== 0, K.fromVectorData = (t & 8) !== 0, ae() >= 18) {
          const T = {};
          D.realMask = T;
          const m = O(s);
          if (T.positionRelativeToLayer = (m & 1) !== 0, T.disabled = (m & 2) !== 0, T.fromVectorData = (m & 8) !== 0, T.defaultColor = O(s), T.top = ce(s), T.left = ce(s), T.bottom = ce(s), T.right = ce(s), !te(T, s))
            throw new Error("Invalid realMask size");
        }
        if (t & 16) {
          const T = O(s);
          T & 1 && (K.userMaskDensity = O(s) / 255), T & 2 && (K.userMaskFeather = ne(s)), T & 4 && (K.vectorMaskDensity = O(s) / 255), T & 8 && (K.vectorMaskFeather = ne(s));
        }
        E(s, ae());
      });
    }
    function ue(s) {
      return [O(s), O(s), O(s), O(s)];
    }
    function Fe(s) {
      return $(s, 1, (D) => {
        const ae = ue(s), K = ue(s), t = [];
        for (; D() > 0; ) {
          const T = ue(s), m = ue(s);
          t.push({ sourceRange: T, destRange: m });
        }
        return { compositeGrayBlendSource: ae, compositeGraphBlendDestinationRange: K, ranges: t };
      });
    }
    function _e(s, D, ae, K) {
      if (s.skipLayerImageData)
        return;
      const { colorMode: t = 3, bitsPerChannel: T = 8 } = D;
      ae.rawData = { colorMode: t, bitsPerChannel: T, channels: [], large: s.large };
      for (const m of K) {
        const j = s.offset;
        let R = 0, we;
        if (m.length === 1)
          throw new Error("Invalid channel length");
        if (m.length) {
          if (R = V(s), R > 3 && (s.offset -= 1, R = V(s)), R > 3 && (s.offset -= 3, R = V(s)), R > 3)
            throw new Error(`Invalid compression: ${R}`);
          m.length > 2 && (we = C(s, m.length - 2));
        }
        s.offset = j + m.length, ae.rawData.channels.push({ id: m.id, compression: R, data: we });
      }
      s.useRawData || Y(ae, s);
    }
    function Oe({ data: s }, D) {
      const ae = s instanceof Float32Array ? 1 : s instanceof Uint16Array ? 65535 : 255, K = (D ? 4 : 3) | 0, t = s.length | 0, T = (D ? 5 : 4) | 0;
      for (let m = K; m < t; m = m + T | 0)
        s[m] = ae;
    }
    function Ie(s) {
      const D = s.rawCompositeData;
      if (!D)
        return;
      const ae = ee(D.buffer, D.byteOffset, D.byteLength);
      return Z(ae, s);
    }
    function xe(s) {
      return Be(Ie(s));
    }
    function Ae(s) {
      return pe(s, de.Layer, !1, void 0);
    }
    function ze(s) {
      return pe(s, de.Mask, !1, void 0);
    }
    function Pe(s) {
      return pe(s, de.RealMask, !1, void 0);
    }
    function Re(s) {
      return Be(Ae(s));
    }
    function Ve(s) {
      return Be(ze(s));
    }
    function Ge(s) {
      return Be(Pe(s));
    }
    function Be(s) {
      return s && (0, S.imageDataToCanvas)(s);
    }
    function v(s, D, ae) {
      D && (ae ? s.imageData = D : s.canvas = (0, S.imageDataToCanvas)(D));
    }
    function A(s, D) {
      Y(s, { useImageData: D });
    }
    function Y(s, D) {
      var ae, K, t;
      let { throwForMissingFeatures: T, useImageData: m } = D;
      const j = pe(s, de.Layer, T, D.totalMemoryLimit);
      if (v(s, j, m), D.totalMemoryLimit !== void 0 && (D.totalMemoryLimit -= (ae = j == null ? void 0 : j.data.byteLength) !== null && ae !== void 0 ? ae : 0), s.mask) {
        const R = pe(s, de.Mask, T, D.totalMemoryLimit);
        v(s.mask, R, m), D.totalMemoryLimit !== void 0 && (D.totalMemoryLimit -= (K = R == null ? void 0 : R.data.byteLength) !== null && K !== void 0 ? K : 0);
      }
      if (s.realMask) {
        const R = pe(s, de.RealMask, T, D.totalMemoryLimit);
        v(s.realMask, R, m), D.totalMemoryLimit !== void 0 && (D.totalMemoryLimit -= (t = R == null ? void 0 : R.data.byteLength) !== null && t !== void 0 ? t : 0);
      }
      delete s.rawData;
    }
    var de;
    (function(s) {
      s[s.Layer = 0] = "Layer", s[s.Mask = 1] = "Mask", s[s.RealMask = 2] = "RealMask";
    })(de || (de = {}));
    function pe(s, D, ae, K) {
      if (!s.rawData)
        return;
      const { colorMode: t, bitsPerChannel: T, channels: m, large: j } = s.rawData, R = Math.max(0, (s.right || 0) - (s.left || 0)), we = Math.max(0, (s.bottom || 0) - (s.top || 0)), ke = t === 4;
      let Se, Ee, Ue = !1;
      if (R && we && D === de.Layer)
        if (ke) {
          if (T !== 8)
            throw new Error("bitsPerChannel Not supproted");
          Se = { width: R, height: we, data: new Uint8ClampedArray(R * we * 5) };
        } else
          Se = U(R, we, T, 4, K);
      S.RAW_IMAGE_DATA && (s.imageDataRaw = [], s.imageDataRawCompression = []);
      for (const { id: Le, compression: He, data: Me } of m) {
        if (!Me)
          continue;
        const je = ee(Me.buffer, Me.byteOffset, Me.byteLength);
        if (Le === -2 || Le === -3) {
          if (Le === -2 && D !== de.Mask || Le === -3 && D !== de.RealMask)
            continue;
          const Te = Le === -2 ? s.mask : s.realMask;
          if (!Te)
            throw new Error(`Missing layer ${Le === -2 ? "mask" : "real mask"} data`);
          const We = Math.max(0, (Te.right || 0) - (Te.left || 0)), Ze = Math.max(0, (Te.bottom || 0) - (Te.top || 0));
          We && Ze && (Ee = U(We, Ze, T, 4, K), oe(je, Me.byteLength, Ee, He, We, Ze, T, 0, j, 4), S.RAW_IMAGE_DATA && (Le === -2 ? (s.maskDataRawCompression = He, s.maskDataRaw = Me) : (s.realMaskDataRawCompression = He, s.realMaskDataRaw = Me)), P(Ee), Oe(Ee, !1));
        } else {
          if (D !== de.Layer)
            continue;
          const Te = (0, S.offsetForChannel)(Le, ke);
          let We = Se;
          if (Te < 0 && (We = void 0, ae))
            throw new Error(`Channel not supported: ${Le}`);
          oe(je, Me.byteLength, We, He, R, we, T, Te, j, ke ? 5 : 4), S.RAW_IMAGE_DATA && (s.imageDataRawCompression[Le] = He, s.imageDataRaw[Le] = Me), We && t === 1 && P(We);
        }
        Le === -1 && (Ue = !0);
      }
      if (Se && (Ue || Oe(Se, ke), ke)) {
        const Le = Se;
        Se = (0, S.createImageData)(Le.width, Le.height), d(Le, Se, !1);
      }
      return D === de.Layer ? Se : Ee;
    }
    function oe(s, D, ae, K, t, T, m, j, R, we) {
      if (D)
        if (K === 0) {
          D !== t * T * Math.floor(m / 8) && s.log(`Invalid length (${D}, ${t * T * Math.floor(m / 8)})`);
          const ke = C(s, D);
          x(ke, ae, m, we, j);
        } else if (K === 1)
          u(s, ae, t, T, m, we, [j], R);
        else if (K === 2) {
          const ke = C(s, D);
          X(ke, ae, t, T, m, we, j, !1);
        } else if (K === 3) {
          const ke = C(s, D);
          X(ke, ae, t, T, m, we, j, !0);
        } else
          throw new Error(`Invalid Compression type: ${K}`);
    }
    function e(s) {
      return $(s, 1, (D) => {
        if (!D())
          return;
        const ae = V(s), K = V(s), t = V(s), T = V(s), m = V(s), j = V(s) / 255, R = O(s);
        return E(s, D()), { overlayColorSpace: ae, colorSpace1: K, colorSpace2: t, colorSpace3: T, colorSpace4: m, opacity: j, kind: R };
      });
    }
    const i = [0, 1, -1, 2, -2, 3, -3, 4, -4];
    function r(s, D) {
      const ae = s.offset;
      let K = "";
      for (const t of i) {
        try {
          s.offset = ae + t, K = F(s);
        } catch {
        }
        if (D(K))
          break;
      }
      if (!D(K))
        throw new Error(`Invalid signature: '${K}' at 0x${ae.toString(16)}`);
      return K;
    }
    function h(s) {
      return s === "8BIM" || s === "8B64";
    }
    function w(s, D, ae, K) {
      const t = r(s, h), T = F(s), m = t === "8B64" || s.large && S.largeAdditionalInfoKeys.indexOf(T) !== -1;
      $(s, 2, (j) => {
        const R = l.infoHandlersMap[T];
        if (R)
          try {
            R.read(s, D, j, ae, K);
          } catch (we) {
            if (s.throwForMissingFeatures)
              throw we;
          }
        else
          s.logMissingFeatures && s.log(`Unhandled additional info: ${T}`), E(s, j());
        j() && (s.logMissingFeatures && s.log(`Unread ${j()} bytes left for additional info: ${T}`), E(s, j()));
      }, !1, m);
    }
    function U(s, D, ae, K, t) {
      const T = s * D * K * Math.max(1, ae / 8);
      if (t !== void 0 && T > t)
        throw new Error("Exceeded memory limit");
      if (ae === 1 || ae === 8)
        return (0, S.createImageData)(s, D);
      if (ae === 16)
        return { width: s, height: D, data: new Uint16Array(s * D * K) };
      if (ae === 32)
        return { width: s, height: D, data: new Float32Array(s * D * K) };
      throw new Error(`Invalid bitDepth (${ae})`);
    }
    function Z(s, D) {
      var ae;
      const K = V(s), t = (ae = D.bitsPerChannel) !== null && ae !== void 0 ? ae : 8;
      if (c.supportedColorModes.indexOf(D.colorMode) === -1)
        throw new Error(`Color mode not supported: ${D.colorMode}`);
      if (K !== 0 && K !== 1)
        throw new Error(`Compression type not supported: ${K}`);
      const T = U(D.width, D.height, t, 4, s.totalMemoryLimit);
      switch (s.totalMemoryLimit !== void 0 && (s.totalMemoryLimit -= T.data.byteLength), (0, S.resetImageData)(T), D.colorMode) {
        case 0: {
          if (t !== 1)
            throw new Error("Invalid bitsPerChannel for bitmap color mode");
          let m;
          if (K === 0)
            m = C(s, Math.ceil(D.width / 8) * D.height);
          else if (K === 1)
            m = new Uint8Array(D.width * D.height), u(s, { data: m, width: D.width, height: D.height }, D.width, D.height, 8, 1, [0], s.large);
          else
            throw new Error(`Compression not supported: ${K}`);
          (0, S.decodeBitmap)(m, T.data, D.width, D.height);
          break;
        }
        case 3:
        case 1: {
          const m = D.colorMode === 1 ? [0] : [0, 1, 2];
          if (D.channels && D.channels > 3)
            for (let j = 3; j < D.channels; j++)
              m.push(j);
          else s.globalAlpha && m.push(3);
          if (K === 0)
            for (let j = 0; j < m.length; j++) {
              const R = C(s, D.width * D.height * Math.floor(t / 8));
              x(R, T, t, 4, m[j]);
            }
          else if (K === 1) {
            const j = s.offset;
            u(s, T, D.width, D.height, t, 4, m, s.large), S.RAW_IMAGE_DATA && (D.imageDataRaw = new Uint8Array(s.view.buffer, s.view.byteOffset + j, s.offset - j));
          } else
            throw new Error(`Compression not supported: ${K}`);
          D.colorMode === 1 && P(T);
          break;
        }
        case 2: {
          if (t !== 8)
            throw new Error("bitsPerChannel Not supproted");
          if (D.channels !== 1)
            throw new Error("Invalid channel count");
          if (!D.palette)
            throw new Error("Missing color palette");
          if (K === 0)
            throw new Error(`Compression not supported: ${K}`);
          if (K === 1) {
            const m = {
              width: T.width,
              height: T.height,
              data: new Uint8Array(T.width * T.height)
            };
            u(s, m, D.width, D.height, t, 1, [0], s.large), L(m, T, D.palette);
          } else
            throw new Error(`Compression not supported: ${K}`);
          break;
        }
        case 4: {
          if (t !== 8)
            throw new Error("bitsPerChannel Not supproted");
          if (D.channels !== 4)
            throw new Error("Invalid channel count");
          const m = [0, 1, 2, 3];
          if (s.globalAlpha && m.push(4), K === 0)
            throw new Error(`Compression not supported: ${K}`);
          if (K === 1) {
            const j = {
              width: T.width,
              height: T.height,
              data: new Uint8Array(T.width * T.height * 5)
            }, R = s.offset;
            u(s, j, D.width, D.height, t, 5, m, s.large), d(j, T, !0), S.RAW_IMAGE_DATA && (D.imageDataRaw = new Uint8Array(s.view.buffer, s.view.byteOffset + R, s.offset - R));
          } else
            throw new Error(`Compression not supported: ${K}`);
          break;
        }
        default:
          throw new Error(`Color mode not supported: ${D.colorMode}`);
      }
      if (s.globalAlpha) {
        if (D.bitsPerChannel !== 8)
          throw new Error("bitsPerChannel Not supproted");
        const m = T.data, j = T.width * T.height * 4;
        for (let R = 0; R < j; R += 4) {
          const we = m[R + 3];
          if (we != 0 && we != 255) {
            const Se = 1 / (we / 255), Ee = 255 * (1 - Se);
            m[R + 0] = m[R + 0] * Se + Ee, m[R + 1] = m[R + 1] * Se + Ee, m[R + 2] = m[R + 2] * Se + Ee;
          }
        }
      }
      return T;
    }
    function d(s, D, ae) {
      const K = D.width * D.height * 4, t = s.data, T = D.data;
      for (let m = 0, j = 0; j < K; m += 5, j += 4) {
        const R = t[m], we = t[m + 1], ke = t[m + 2], Se = t[m + 3];
        T[j] = (R * Se | 0) / 255 | 0, T[j + 1] = (we * Se | 0) / 255 | 0, T[j + 2] = (ke * Se | 0) / 255 | 0, T[j + 3] = ae ? 255 - t[m + 4] : t[m + 4];
      }
    }
    function L(s, D, ae) {
      const K = s.width * s.height, t = s.data, T = D.data;
      for (let m = 0, j = 0; m < K; m++, j += 4) {
        const R = ae[t[m]];
        T[j + 0] = R.r, T[j + 1] = R.g, T[j + 2] = R.b, T[j + 3] = 255;
      }
    }
    function o(s, D) {
      if (s.byteLength / s.length !== D.byteLength / D.length)
        throw new Error("Invalid array types");
    }
    function _(s, D) {
      if (D === 8)
        return s;
      if (D === 16) {
        for (let ae = 0; ae < s.byteLength; ae += 2) {
          const K = s[ae];
          s[ae] = s[ae + 1], s[ae + 1] = K;
        }
        if (s.byteOffset % 2) {
          const ae = new Uint16Array(s.byteLength / 2);
          return new Uint8Array(ae.buffer, ae.byteOffset, ae.byteLength).set(s), ae;
        } else
          return new Uint16Array(s.buffer, s.byteOffset, s.byteLength / 2);
      } else if (D === 32)
        if (s.byteOffset % 4) {
          const ae = new Float32Array(s.byteLength / 4);
          return new Uint8Array(ae.buffer, ae.byteOffset, ae.byteLength).set(s), ae;
        } else
          return new Float32Array(s.buffer, s.byteOffset, s.byteLength / 4);
      else
        throw new Error(`Invalid bitDepth (${D})`);
    }
    function I(s, D, ae, K) {
      o(s.data, D);
      const t = s.width * s.height, T = s.data;
      for (let m = 0, j = ae | 0; m < t; m++, j = j + K | 0)
        T[j] = D[m];
    }
    function x(s, D, ae, K, t) {
      if (ae == 32)
        for (let m = 0; m < s.byteLength; m += 4) {
          const j = s[m + 0], R = s[m + 1], we = s[m + 2], ke = s[m + 3];
          s[m + 0] = ke, s[m + 1] = we, s[m + 2] = R, s[m + 3] = j;
        }
      const T = _(s, ae);
      D && t < K && I(D, T, t, K);
    }
    function b(s, D, ae, K) {
      for (let t = 0; t < ae; t++) {
        const T = t * D;
        for (let m = 1, j = T + 1; m < D; m++, j++)
          s[j] = (s[j - 1] + s[j]) % K;
      }
    }
    function X(s, D, ae, K, t, T, m, j) {
      const R = (0, k.inflate)(s);
      if (D && m < T) {
        const we = _(R, t);
        if (t === 8)
          j && b(R, ae, K, 256), I(D, R, m, T);
        else if (t === 16)
          j && b(we, ae, K, 65536), I(D, we, m, T);
        else if (t === 32) {
          j && b(R, ae * 4, K, 256);
          let ke = m;
          const Se = new Uint32Array(D.data.buffer, D.data.byteOffset, D.data.length);
          for (let Ee = 0; Ee < K; Ee++) {
            let Ue = ae * 4 * Ee;
            for (let Le = 0; Le < ae; Le++, Ue++, ke += T) {
              const He = Ue + ae, Me = He + ae, je = Me + ae;
              Se[ke] = (R[Ue] << 24 | R[He] << 16 | R[Me] << 8 | R[je]) >>> 0;
            }
          }
        } else
          throw new Error("Invalid bitDepth");
      }
    }
    function u(s, D, ae, K, t, T, m, j) {
      const R = D && D.data;
      let we;
      if (j) {
        De(s, m.length * K * 4), we = new Uint32Array(m.length * K);
        for (let Se = 0, Ee = 0; Se < m.length; Se++)
          for (let Ue = 0; Ue < K; Ue++, Ee++)
            we[Ee] = he(s);
      } else {
        De(s, m.length * K * 2), we = new Uint16Array(m.length * K);
        for (let Se = 0, Ee = 0; Se < m.length; Se++)
          for (let Ue = 0; Ue < K; Ue++, Ee++)
            we[Ee] = V(s);
      }
      const ke = T - 1 | 0;
      for (let Se = 0, Ee = 0; Se < m.length; Se++) {
        const Ue = m[Se] | 0, Le = Se > ke || Ue > ke;
        if (!R || Le)
          for (let He = 0; He < K; He++, Ee++)
            E(s, we[Ee]);
        else
          for (let He = 0, Me = Ue | 0; He < K; He++, Ee++) {
            const je = we[Ee], Te = C(s, je);
            for (let We = 0, Ze = 0; We < je; We++) {
              let Ke = Te[We];
              if (Ke > 128) {
                const at = Te[++We];
                Ke = 256 - Ke | 0;
                for (let wt = 0; wt <= Ke && Ze < ae; wt = wt + 1 | 0, Ze = Ze + 1 | 0)
                  R[Me] = at, Me = Me + T | 0;
              } else if (Ke < 128)
                for (let at = 0; at <= Ke && Ze < ae; at = at + 1 | 0, Ze = Ze + 1 | 0)
                  R[Me] = Te[++We], Me = Me + T | 0;
            }
          }
      }
      Ne(s, we.byteLength);
    }
    function $(s, D, ae, K = !0, t = !1) {
      let T = he(s);
      if (t) {
        if (T !== 0)
          throw new Error("Sizes larger than 4GB are not supported");
        T = he(s);
      }
      if (T <= 0 && K)
        return;
      let m = s.offset + T;
      if (m > s.view.byteLength)
        throw new Error("Section exceeds file size");
      const j = ae(() => m - s.offset);
      for (s.offset !== m && (s.offset > m ? ye(s, "Exceeded section limits") : ye(s, "Unread section data")); T % D; )
        T++, m++;
      return s.offset = m, j;
    }
    function be(s) {
      switch (V(s)) {
        case 0: {
          const ae = V(s) / 257, K = V(s) / 257, t = V(s) / 257;
          return E(s, 2), { r: ae, g: K, b: t };
        }
        case 1: {
          const ae = V(s) / 65535, K = V(s) / 65535, t = V(s) / 65535;
          return E(s, 2), { h: ae, s: K, b: t };
        }
        case 2: {
          const ae = V(s) / 257, K = V(s) / 257, t = V(s) / 257, T = V(s) / 257;
          return { c: ae, m: K, y: t, k: T };
        }
        case 7: {
          const ae = H(s) / 1e4, K = H(s), t = H(s), T = K < 0 ? K / 12800 : K / 12700, m = t < 0 ? t / 12800 : t / 12700;
          return E(s, 2), { l: ae, a: T, b: m };
        }
        case 8: {
          const ae = V(s) * 255 / 1e4;
          return E(s, 6), { k: ae };
        }
        default:
          throw new Error("Invalid color space");
      }
    }
    function ge(s) {
      let D = he(s);
      for (; D % 4; )
        D++;
      const ae = s.offset + D, K = he(s);
      if (K !== 1)
        throw new Error(`Invalid pattern version: ${K}`);
      const t = he(s), T = H(s), m = H(s);
      if (t !== 3 && t !== 1 && t !== 2)
        throw new Error(`Unsupported pattern color mode: ${t}`);
      let j = W(s);
      const R = J(s, 1), we = [];
      if (t === 2) {
        for (let Ze = 0; Ze < 256; Ze++)
          we.push({
            r: O(s),
            g: O(s),
            b: O(s)
          });
        E(s, 4);
      }
      const ke = he(s);
      if (ke !== 3)
        throw new Error(`Invalid pattern VMAL version: ${ke}`);
      he(s);
      const Se = he(s), Ee = he(s), Ue = he(s), Le = he(s), He = he(s), Me = Le - Ee, je = Ue - Se, Te = Me * je * 4;
      De(s, Te);
      const We = new Uint8Array(Te);
      for (let Ze = 3; Ze < We.byteLength; Ze += 4)
        We[Ze] = 255;
      for (let Ze = 0, Ke = 0; Ze < He + 2; Ze++) {
        if (!he(s))
          continue;
        const wt = he(s), Kn = he(s), tn = he(s), nn = he(s), Yn = he(s), Jn = he(s), Qn = V(s), on = O(s), ei = wt - 23, yt = C(s, ei);
        if (Kn !== 8 || Qn !== 8)
          throw new Error("16bit pixel depth not supported for patterns");
        const Je = Jn - nn, rt = Yn - tn, St = nn - Ee, _t = tn - Se;
        if (on === 0) {
          if (t === 3 && Ke < 3)
            for (let qe = 0; qe < rt; qe++)
              for (let Xe = 0; Xe < Je; Xe++) {
                const lt = Xe + qe * Je, st = (St + Xe + (qe + _t) * Me) * 4;
                We[st + Ke] = yt[lt];
              }
          else if (t === 1 && Ke < 1)
            for (let qe = 0; qe < rt; qe++)
              for (let Xe = 0; Xe < Je; Xe++) {
                const lt = Xe + qe * Je, st = (St + Xe + (qe + _t) * Me) * 4, vt = yt[lt];
                We[st + 0] = vt, We[st + 1] = vt, We[st + 2] = vt;
              }
          else if (t === 2)
            for (let qe = 0; qe < rt; qe++)
              for (let Xe = 0; Xe < Je; Xe++) {
                const lt = Xe + qe * Je, st = (St + Xe + (qe + _t) * Me) * 4, vt = yt[lt], Bt = we[vt];
                We[st + 0] = Bt.r, We[st + 1] = Bt.g, We[st + 2] = Bt.b;
              }
          else if (s.throwForMissingFeatures)
            throw new Error("Invalid color pattern");
        } else if (on === 1) {
          De(s, Je * rt);
          const qe = { data: We, width: Me, height: je }, Xe = { data: new Uint8Array(Je * rt), width: Je, height: rt }, lt = ee(yt.buffer, yt.byteOffset, yt.byteLength);
          if (t === 3 && Ke < 3 && (u(lt, Xe, Je, rt, 8, 1, [0], !1), Ce(Xe, qe, St, _t, Ke)), t === 1 && Ke < 1 && (u(lt, Xe, Je, rt, 8, 1, [0], !1), Ce(Xe, qe, St, _t, 0), P(qe)), t === 2)
            throw new Error("Indexed pattern color mode not implemented");
          Ne(s, Je * rt);
        } else
          throw new Error("Invalid pattern compression mode");
        Ke++;
      }
      return s.offset = ae, { id: R, name: j, x: T, y: m, bounds: { x: Ee, y: Se, w: Me, h: je }, data: We };
    }
    function Ce(s, D, ae, K, t) {
      const T = s.width, m = s.height, j = D.width;
      for (let R = 0; R < m; R++)
        for (let we = 0; we < T; we++) {
          const ke = we + R * T, Se = (ae + we + (R + K) * j) * 4, Ee = s.data[ke];
          D.data[Se + t] = Ee;
        }
    }
    function De(s, D) {
      if (s.totalMemoryLimit !== void 0) {
        if (s.totalMemoryLimit < D)
          throw new Error("Exceeded memory limit");
        s.totalMemoryLimit -= D;
      }
    }
    function Ne(s, D) {
      s.totalMemoryLimit !== void 0 && (s.totalMemoryLimit += D);
    }
  })(Dt)), Dt;
}
var Cn;
function pi() {
  if (Cn) return Ft;
  Cn = 1, Object.defineProperty(Ft, "__esModule", { value: !0 }), Ft.readEffects = ee, Ft.writeEffects = O;
  const c = mt(), q = bt(), k = At(), S = [
    void 0,
    "outer bevel",
    "inner bevel",
    "emboss",
    "pillow emboss",
    "stroke emboss"
  ];
  function l(y) {
    return (0, q.checkSignature)(y, "8BIM"), c.toBlendMode[(0, q.readSignature)(y)] || "normal";
  }
  function f(y, H) {
    (0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, c.fromBlendMode[H] || "norm");
  }
  function a(y) {
    return (0, q.readUint8)(y) / 255;
  }
  function P(y, H) {
    (0, k.writeUint8)(y, Math.round(H * 255) | 0);
  }
  function ee(y) {
    const H = (0, q.readUint16)(y);
    if (H !== 0)
      throw new Error(`Invalid effects layer version: ${H}`);
    const V = (0, q.readUint16)(y), le = {};
    for (let ce = 0; ce < V; ce++) {
      (0, q.checkSignature)(y, "8BIM");
      const ie = (0, q.readSignature)(y);
      switch (ie) {
        case "cmnS": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y), ne = !!(0, q.readUint8)(y);
          if ((0, q.skipBytes)(y, 2), he !== 7 || fe !== 0 || !ne)
            throw new Error("Invalid effects common state");
          break;
        }
        case "dsdw":
        // drop shadow (see See Effects layer, drop shadow and inner shadow info)
        case "isdw": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y);
          if (he !== 41 && he !== 51)
            throw new Error(`Invalid shadow size: ${he}`);
          if (fe !== 0 && fe !== 2)
            throw new Error(`Invalid shadow version: ${fe}`);
          const ne = (0, q.readFixedPoint32)(y);
          (0, q.readFixedPoint32)(y);
          const B = (0, q.readFixedPoint32)(y), z = (0, q.readFixedPoint32)(y), C = (0, q.readColor)(y), F = l(y), N = !!(0, q.readUint8)(y), J = !!(0, q.readUint8)(y), W = a(y);
          he >= 51 && (0, q.readColor)(y);
          const n = {
            size: { units: "Pixels", value: ne },
            distance: { units: "Pixels", value: z },
            angle: B,
            color: C,
            blendMode: F,
            enabled: N,
            useGlobalLight: J,
            opacity: W
          };
          ie === "dsdw" ? le.dropShadow = [n] : le.innerShadow = [n];
          break;
        }
        case "oglw": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y);
          if (he !== 32 && he !== 42)
            throw new Error(`Invalid outer glow size: ${he}`);
          if (fe !== 0 && fe !== 2)
            throw new Error(`Invalid outer glow version: ${fe}`);
          const ne = (0, q.readFixedPoint32)(y);
          (0, q.readFixedPoint32)(y);
          const B = (0, q.readColor)(y), z = l(y), C = !!(0, q.readUint8)(y), F = a(y);
          he >= 42 && (0, q.readColor)(y), le.outerGlow = {
            size: { units: "Pixels", value: ne },
            color: B,
            blendMode: z,
            enabled: C,
            opacity: F
          };
          break;
        }
        case "iglw": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y);
          if (he !== 32 && he !== 43)
            throw new Error(`Invalid inner glow size: ${he}`);
          if (fe !== 0 && fe !== 2)
            throw new Error(`Invalid inner glow version: ${fe}`);
          const ne = (0, q.readFixedPoint32)(y);
          (0, q.readFixedPoint32)(y);
          const B = (0, q.readColor)(y), z = l(y), C = !!(0, q.readUint8)(y), F = a(y);
          he >= 43 && ((0, q.readUint8)(y), (0, q.readColor)(y)), le.innerGlow = {
            size: { units: "Pixels", value: ne },
            color: B,
            blendMode: z,
            enabled: C,
            opacity: F
          };
          break;
        }
        case "bevl": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y);
          if (he !== 58 && he !== 78)
            throw new Error(`Invalid bevel size: ${he}`);
          if (fe !== 0 && fe !== 2)
            throw new Error(`Invalid bevel version: ${fe}`);
          const ne = (0, q.readFixedPoint32)(y), B = (0, q.readFixedPoint32)(y), z = (0, q.readFixedPoint32)(y), C = l(y), F = l(y), N = (0, q.readColor)(y), J = (0, q.readColor)(y), W = S[(0, q.readUint8)(y)] || "inner bevel", n = a(y), p = a(y), g = !!(0, q.readUint8)(y), E = !!(0, q.readUint8)(y), G = (0, q.readUint8)(y) ? "down" : "up";
          he >= 78 && ((0, q.readColor)(y), (0, q.readColor)(y)), le.bevel = {
            size: { units: "Pixels", value: z },
            angle: ne,
            strength: B,
            highlightBlendMode: C,
            shadowBlendMode: F,
            highlightColor: N,
            shadowColor: J,
            style: W,
            highlightOpacity: n,
            shadowOpacity: p,
            enabled: g,
            useGlobalLight: E,
            direction: G
          };
          break;
        }
        case "sofi": {
          const he = (0, q.readUint32)(y), fe = (0, q.readUint32)(y);
          if (he !== 34)
            throw new Error(`Invalid effects solid fill info size: ${he}`);
          if (fe !== 2)
            throw new Error(`Invalid effects solid fill info version: ${fe}`);
          const ne = l(y), B = (0, q.readColor)(y), z = a(y), C = !!(0, q.readUint8)(y);
          (0, q.readColor)(y), le.solidFill = [{ blendMode: ne, color: B, opacity: z, enabled: C }];
          break;
        }
        default:
          throw new Error(`Invalid effect type: '${ie}'`);
      }
    }
    return le;
  }
  function ye(y, H) {
    var V;
    (0, k.writeUint32)(y, 51), (0, k.writeUint32)(y, 2), (0, k.writeFixedPoint32)(y, H.size && H.size.value || 0), (0, k.writeFixedPoint32)(y, 0), (0, k.writeFixedPoint32)(y, H.angle || 0), (0, k.writeFixedPoint32)(y, H.distance && H.distance.value || 0), (0, k.writeColor)(y, H.color), f(y, H.blendMode), (0, k.writeUint8)(y, H.enabled ? 1 : 0), (0, k.writeUint8)(y, H.useGlobalLight ? 1 : 0), P(y, (V = H.opacity) !== null && V !== void 0 ? V : 1), (0, k.writeColor)(y, H.color);
  }
  function O(y, H) {
    var V, le, ce, ie, he, fe;
    const ne = (V = H.dropShadow) === null || V === void 0 ? void 0 : V[0], B = (le = H.innerShadow) === null || le === void 0 ? void 0 : le[0], z = H.outerGlow, C = H.innerGlow, F = H.bevel, N = (ce = H.solidFill) === null || ce === void 0 ? void 0 : ce[0];
    let J = 1;
    if (ne && J++, B && J++, z && J++, C && J++, F && J++, N && J++, (0, k.writeUint16)(y, 0), (0, k.writeUint16)(y, J), (0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "cmnS"), (0, k.writeUint32)(y, 7), (0, k.writeUint32)(y, 0), (0, k.writeUint8)(y, 1), (0, k.writeZeros)(y, 2), ne && ((0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "dsdw"), ye(y, ne)), B && ((0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "isdw"), ye(y, B)), z && ((0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "oglw"), (0, k.writeUint32)(y, 42), (0, k.writeUint32)(y, 2), (0, k.writeFixedPoint32)(y, ((ie = z.size) === null || ie === void 0 ? void 0 : ie.value) || 0), (0, k.writeFixedPoint32)(y, 0), (0, k.writeColor)(y, z.color), f(y, z.blendMode), (0, k.writeUint8)(y, z.enabled ? 1 : 0), P(y, z.opacity || 0), (0, k.writeColor)(y, z.color)), C && ((0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "iglw"), (0, k.writeUint32)(y, 43), (0, k.writeUint32)(y, 2), (0, k.writeFixedPoint32)(y, ((he = C.size) === null || he === void 0 ? void 0 : he.value) || 0), (0, k.writeFixedPoint32)(y, 0), (0, k.writeColor)(y, C.color), f(y, C.blendMode), (0, k.writeUint8)(y, C.enabled ? 1 : 0), P(y, C.opacity || 0), (0, k.writeUint8)(y, 0), (0, k.writeColor)(y, C.color)), F) {
      (0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "bevl"), (0, k.writeUint32)(y, 78), (0, k.writeUint32)(y, 2), (0, k.writeFixedPoint32)(y, F.angle || 0), (0, k.writeFixedPoint32)(y, F.strength || 0), (0, k.writeFixedPoint32)(y, ((fe = F.size) === null || fe === void 0 ? void 0 : fe.value) || 0), f(y, F.highlightBlendMode), f(y, F.shadowBlendMode), (0, k.writeColor)(y, F.highlightColor), (0, k.writeColor)(y, F.shadowColor);
      const W = S.indexOf(F.style);
      (0, k.writeUint8)(y, W <= 0 ? 1 : W), P(y, F.highlightOpacity || 0), P(y, F.shadowOpacity || 0), (0, k.writeUint8)(y, F.enabled ? 1 : 0), (0, k.writeUint8)(y, F.useGlobalLight ? 1 : 0), (0, k.writeUint8)(y, F.direction === "down" ? 1 : 0), (0, k.writeColor)(y, F.highlightColor), (0, k.writeColor)(y, F.shadowColor);
    }
    N && ((0, k.writeSignature)(y, "8BIM"), (0, k.writeSignature)(y, "sofi"), (0, k.writeUint32)(y, 34), (0, k.writeUint32)(y, 2), f(y, N.blendMode), (0, k.writeColor)(y, N.color), P(y, N.opacity || 0), (0, k.writeUint8)(y, N.enabled ? 1 : 0), (0, k.writeColor)(y, N.color));
  }
  return Ft;
}
var Ct = {}, xn;
function gi() {
  if (xn) return Ct;
  xn = 1, Object.defineProperty(Ct, "__esModule", { value: !0 }), Ct.parseEngineData = k, Ct.serializeEngineData = f;
  function c(a) {
    return a === 32 || a === 10 || a === 13 || a === 9;
  }
  function q(a) {
    return a >= 48 && a <= 57 || a === 46 || a === 45;
  }
  function k(a) {
    let P = 0;
    function ee() {
      for (; P < a.length && c(a[P]); )
        P++;
    }
    function ye() {
      let fe = a[P];
      return P++, fe === 92 && (fe = a[P], P++), fe;
    }
    function O() {
      let fe = "";
      if (a[P] === 41)
        return P++, fe;
      if (a[P] !== 254 || a[P + 1] !== 255) {
        for (; P < a.length && a[P] !== 41; )
          fe += String.fromCharCode(ye());
        return P++, fe;
      }
      for (P += 2; P < a.length && a[P] !== 41; ) {
        const ne = ye(), B = ye(), z = ne << 8 | B;
        fe += String.fromCharCode(z);
      }
      return P++, fe;
    }
    let y = null;
    const H = [];
    function V(fe) {
      H.length ? (le(fe), H.push(fe)) : (H.push(fe), y = fe);
    }
    function le(fe) {
      if (!H.length)
        throw new Error("Invalid data");
      const ne = H[H.length - 1];
      if (typeof ne == "string")
        H[H.length - 2][ne] = fe, ie();
      else if (Array.isArray(ne))
        ne.push(fe);
      else
        throw new Error("Invalid data");
    }
    function ce(fe) {
      H.length || V({});
      const ne = H[H.length - 1];
      if (ne && typeof ne == "string")
        le(fe === "nil" ? null : `/${fe}`);
      else if (ne && typeof ne == "object")
        H.push(fe);
      else
        throw new Error("Invalid data");
    }
    function ie() {
      if (!H.length)
        throw new Error("Invalid data");
      H.pop();
    }
    ee();
    let he = a.length;
    for (; he > 0 && a[he - 1] === 0; )
      he--;
    for (; P < he; ) {
      const fe = P, ne = a[fe];
      if (ne === 60 && a[fe + 1] === 60)
        P += 2, V({});
      else if (ne === 62 && a[fe + 1] === 62)
        P += 2, ie();
      else if (ne === 47) {
        P += 1;
        const B = P;
        for (; P < a.length && !c(a[P]); )
          P++;
        let z = "";
        for (let C = B; C < P; C++)
          z += String.fromCharCode(a[C]);
        ce(z);
      } else if (ne === 40)
        P += 1, le(O());
      else if (ne === 91)
        P += 1, V([]);
      else if (ne === 93)
        P += 1, ie();
      else if (ne === 110 && a[fe + 1] === 117 && a[fe + 2] === 108 && a[fe + 3] === 108)
        P += 4, le(null);
      else if (ne === 116 && a[fe + 1] === 114 && a[fe + 2] === 117 && a[fe + 3] === 101)
        P += 4, le(!0);
      else if (ne === 102 && a[fe + 1] === 97 && a[fe + 2] === 108 && a[fe + 3] === 115 && a[fe + 4] === 101)
        P += 5, le(!1);
      else if (q(ne)) {
        let B = "";
        for (; P < a.length && q(a[P]); )
          B += String.fromCharCode(a[P]), P++;
        le(parseFloat(B));
      } else
        P += 1, console.log(
          `Invalid token '${String.fromCharCode(ne)}' (${ne}) at ${P}`
          // + ` near '${String.fromCharCode.apply(null, data.slice(index - 10, index + 20) as any)}'`
          // + ` data [${Array.from(data.slice(index - 10, index + 20)).join(', ')}]`
        );
      ee();
    }
    return y;
  }
  const S = [
    "Axis",
    "XY",
    "Zone",
    "WordSpacing",
    "FirstLineIndent",
    "GlyphSpacing",
    "StartIndent",
    "EndIndent",
    "SpaceBefore",
    "SpaceAfter",
    "LetterSpacing",
    "Values",
    "GridSize",
    "GridLeading",
    "PointBase",
    "BoxBounds",
    "TransformPoint0",
    "TransformPoint1",
    "TransformPoint2",
    "FontSize",
    "Leading",
    "HorizontalScale",
    "VerticalScale",
    "BaselineShift",
    "Tsume",
    "OutlineWidth",
    "AutoLeading"
  ], l = ["RunLengthArray"];
  function f(a, P = !1) {
    let ee = new Uint8Array(1024), ye = 0, O = 0;
    function y(z) {
      if (ye >= ee.length) {
        const C = new Uint8Array(ee.length * 2);
        C.set(ee), ee = C;
      }
      ee[ye] = z, ye++;
    }
    function H(z) {
      for (let C = 0; C < z.length; C++)
        y(z.charCodeAt(C));
    }
    function V() {
      if (P)
        H(" ");
      else
        for (let z = 0; z < O; z++)
          H("	");
    }
    function le(z, C) {
      V(), H(`/${z}`), B(C, z, !0), P || H(`
`);
    }
    function ce(z) {
      return z.toString();
    }
    function ie(z) {
      return z.toFixed(5).replace(/(\d)0+$/g, "$1").replace(/^0+\.([1-9])/g, ".$1").replace(/^-0+\.0(\d)/g, "-.0$1");
    }
    function he(z, C) {
      return C && S.indexOf(C) !== -1 || (z | 0) !== z ? ie(z) : ce(z);
    }
    function fe(z) {
      const C = Object.keys(z);
      return C.indexOf("98") !== -1 && C.unshift(...C.splice(C.indexOf("98"), 1)), C.indexOf("99") !== -1 && C.unshift(...C.splice(C.indexOf("99"), 1)), C;
    }
    function ne(z) {
      (z === 40 || z === 41 || z === 92) && y(92), y(z);
    }
    function B(z, C, F = !1) {
      function N() {
        F ? H(" ") : V();
      }
      if (z === null)
        N(), H(P ? "/nil" : "null");
      else if (typeof z == "number")
        N(), H(he(z, C));
      else if (typeof z == "boolean")
        N(), H(z ? "true" : "false");
      else if (typeof z == "string")
        if (N(), (C === "99" || C === "98") && z.charAt(0) === "/")
          H(z);
        else {
          H("("), y(254), y(255);
          for (let J = 0; J < z.length; J++) {
            const W = z.charCodeAt(J);
            ne(W >> 8 & 255), ne(W & 255);
          }
          H(")");
        }
      else if (Array.isArray(z))
        if (N(), z.every((J) => typeof J == "number")) {
          H("[");
          const J = l.indexOf(C) !== -1;
          for (const W of z)
            H(" "), H(J ? he(W) : ie(W));
          H(" ]");
        } else {
          H("["), P || H(`
`);
          for (const J of z)
            B(J, C), P || H(`
`);
          V(), H("]");
        }
      else if (typeof z == "object") {
        F && !P && H(`
`), V(), H("<<"), P || H(`
`), O++;
        for (const J of fe(z))
          le(J, z[J]);
        O--, V(), H(">>");
      }
    }
    if (P) {
      if (typeof a == "object")
        for (const z of fe(a))
          le(z, a[z]);
    } else
      H(`

`), B(a);
    return ee.slice(0, ye);
  }
  return Ct;
}
var xt = {}, An;
function mi() {
  if (An) return xt;
  An = 1, Object.defineProperty(xt, "__esModule", { value: !0 }), xt.decodeEngineData = z, xt.encodeEngineData = C;
  const c = {
    name: "MyriadPro-Regular",
    script: 0,
    type: 0,
    synthetic: 0
  }, q = {
    justification: "left",
    firstLineIndent: 0,
    startIndent: 0,
    endIndent: 0,
    spaceBefore: 0,
    spaceAfter: 0,
    autoHyphenate: !0,
    hyphenatedWordSize: 6,
    preHyphen: 2,
    postHyphen: 2,
    consecutiveHyphens: 8,
    zone: 36,
    wordSpacing: [0.8, 1, 1.33],
    letterSpacing: [0, 0, 0],
    glyphSpacing: [1, 1, 1],
    autoLeading: 1.2,
    leadingType: 0,
    hanging: !1,
    burasagari: !1,
    kinsokuOrder: 0,
    everyLineComposer: !1
  }, k = {
    font: c,
    fontSize: 12,
    fauxBold: !1,
    fauxItalic: !1,
    autoLeading: !0,
    leading: 0,
    horizontalScale: 1,
    verticalScale: 1,
    tracking: 0,
    autoKerning: !0,
    kerning: 0,
    baselineShift: 0,
    fontCaps: 0,
    fontBaseline: 0,
    underline: !1,
    strikethrough: !1,
    ligatures: !0,
    dLigatures: !1,
    baselineDirection: 2,
    tsume: 0,
    styleRunAlignment: 2,
    language: 0,
    noBreak: !1,
    fillColor: { r: 0, g: 0, b: 0 },
    strokeColor: { r: 0, g: 0, b: 0 },
    fillFlag: !0,
    strokeFlag: !1,
    fillFirst: !0,
    yUnderline: 1,
    outlineWidth: 1,
    characterDirection: 0,
    hindiNumbers: !1,
    kashida: 1,
    diacriticPos: 2
  }, S = {
    isOn: !1,
    show: !1,
    size: 18,
    leading: 22,
    color: { r: 0, g: 0, b: 255 },
    leadingFillColor: { r: 0, g: 0, b: 255 },
    alignLineHeightToGridFlags: !1
  }, l = [
    "justification",
    "firstLineIndent",
    "startIndent",
    "endIndent",
    "spaceBefore",
    "spaceAfter",
    "autoHyphenate",
    "hyphenatedWordSize",
    "preHyphen",
    "postHyphen",
    "consecutiveHyphens",
    "zone",
    "wordSpacing",
    "letterSpacing",
    "glyphSpacing",
    "autoLeading",
    "leadingType",
    "hanging",
    "burasagari",
    "kinsokuOrder",
    "everyLineComposer"
  ], f = [
    "font",
    "fontSize",
    "fauxBold",
    "fauxItalic",
    "autoLeading",
    "leading",
    "horizontalScale",
    "verticalScale",
    "tracking",
    "autoKerning",
    "kerning",
    "baselineShift",
    "fontCaps",
    "fontBaseline",
    "underline",
    "strikethrough",
    "ligatures",
    "dLigatures",
    "baselineDirection",
    "tsume",
    "styleRunAlignment",
    "language",
    "noBreak",
    "fillColor",
    "strokeColor",
    "fillFlag",
    "strokeFlag",
    "fillFirst",
    "yUnderline",
    "outlineWidth",
    "characterDirection",
    "hindiNumbers",
    "kashida",
    "diacriticPos"
  ], a = ["none", "crisp", "strong", "smooth", "sharp"], P = [
    "left",
    // 0
    "right",
    // 1
    "center",
    // 2
    "justify-left",
    // 3
    "justify-right",
    // 4
    "justify-center",
    // 5
    "justify-all"
    // 6
  ];
  function ee(F) {
    return F.substring(0, 1).toUpperCase() + F.substring(1);
  }
  function ye(F) {
    const N = F.Values;
    switch (F.Type) {
      case 0:
        return { k: N[1] * 255 };
      // grayscale (alpha?)
      case 1:
        return N[0] === 1 ? { r: N[1] * 255, g: N[2] * 255, b: N[3] * 255 } : (
          // rgb
          { r: N[1] * 255, g: N[2] * 255, b: N[3] * 255, a: N[0] * 255 }
        );
      // rgba
      case 2:
        return { c: N[1] * 255, m: N[2] * 255, y: N[3] * 255, k: N[4] * 255 };
      // cmyk (alpha?)
      default:
        throw new Error("Unknown color type in text layer");
    }
  }
  function O(F) {
    if (F) {
      if ("r" in F)
        return { Type: 1, Values: ["a" in F ? F.a / 255 : 1, F.r / 255, F.g / 255, F.b / 255] };
      if ("c" in F)
        return { Type: 2, Values: [1, F.c / 255, F.m / 255, F.y / 255, F.k / 255] };
      if ("k" in F)
        return { Type: 0, Values: [1, F.k / 255] };
      throw new Error("Invalid color type in text layer");
    } else return { Type: 1, Values: [0, 0, 0, 0] };
  }
  function y(F, N) {
    if (!F || !N || F.length !== N.length)
      return !1;
    for (let J = 0; J < F.length; J++)
      if (F[J] !== N[J])
        return !1;
    return !0;
  }
  function H(F, N) {
    if (!F || !N)
      return !1;
    for (const J of Object.keys(F))
      if (F[J] !== N[J])
        return !1;
    for (const J of Object.keys(N))
      if (F[J] !== N[J])
        return !1;
    return !0;
  }
  function V(F, N) {
    for (let J = 0; J < F.length; J++)
      if (F[J].name === N.name)
        return J;
    return F.push(N), F.length - 1;
  }
  function le(F, N, J) {
    const W = {};
    for (const n of N) {
      const p = ee(n);
      F[p] !== void 0 && (n === "justification" ? W[n] = P[F[p]] : n === "font" ? W[n] = J[F[p]] : n === "fillColor" || n === "strokeColor" ? W[n] = ye(F[p]) : W[n] = F[p]);
    }
    return W;
  }
  function ce(F, N, J) {
    var W;
    const n = {};
    for (const p of N) {
      const g = ee(p);
      F[p] !== void 0 && (p === "justification" ? n[g] = P.indexOf((W = F[p]) !== null && W !== void 0 ? W : "left") : p === "font" ? n[g] = V(J, F[p]) : p === "fillColor" || p === "strokeColor" ? n[g] = O(F[p]) : n[g] = F[p]);
    }
    return n;
  }
  function ie(F, N) {
    return le(F, l, N);
  }
  function he(F, N) {
    return le(F, f, N);
  }
  function fe(F, N) {
    return ce(F, l, N);
  }
  function ne(F, N) {
    return ce(F, f, N);
  }
  function B(F, N, J) {
    if (N.length) {
      for (const W of J) {
        const n = N[0].style[W];
        if (n !== void 0) {
          let g = !1;
          Array.isArray(n) ? g = N.every((E) => y(E.style[W], n)) : typeof n == "object" ? g = N.every((E) => H(E.style[W], n)) : g = N.every((E) => E.style[W] === n), g && (F[W] = n);
        }
        if (F[W] !== void 0)
          for (const g of N) {
            let E = !1;
            Array.isArray(n) ? E = y(g.style[W], n) : typeof n == "object" ? E = H(g.style[W], n) : E = g.style[W] === n, E && delete g.style[W];
          }
      }
      N.every((W) => Object.keys(W.style).length === 0) && (N.length = 0);
    }
  }
  function z(F) {
    var N, J, W, n, p, g;
    const E = F.EngineDict, G = F.ResourceDict, M = G.FontSet.map((ue) => ({
      name: ue.Name,
      script: ue.Script,
      type: ue.FontType,
      synthetic: ue.Synthetic
    }));
    let re = E.Editor.Text.replace(/\r/g, `
`), Q = 0;
    for (; /\n$/.test(re); )
      re = re.substring(0, re.length - 1), Q++;
    const se = {
      text: re,
      antiAlias: (N = a[E.AntiAlias]) !== null && N !== void 0 ? N : "smooth",
      useFractionalGlyphWidths: !!E.UseFractionalGlyphWidths,
      superscriptSize: G.SuperscriptSize,
      superscriptPosition: G.SuperscriptPosition,
      subscriptSize: G.SubscriptSize,
      subscriptPosition: G.SubscriptPosition,
      smallCapSize: G.SmallCapSize
    }, me = (g = (p = (n = (W = (J = E.Rendered) === null || J === void 0 ? void 0 : J.Shapes) === null || W === void 0 ? void 0 : W.Children) === null || n === void 0 ? void 0 : n[0]) === null || p === void 0 ? void 0 : p.Cookie) === null || g === void 0 ? void 0 : g.Photoshop;
    me && (se.shapeType = me.ShapeType === 1 ? "box" : "point", me.PointBase && (se.pointBase = me.PointBase), me.BoxBounds && (se.boxBounds = me.BoxBounds));
    const te = E.ParagraphRun;
    se.paragraphStyle = {}, se.paragraphStyleRuns = [];
    for (let ue = 0; ue < te.RunArray.length; ue++) {
      const Fe = te.RunArray[ue], _e = te.RunLengthArray[ue], Oe = ie(Fe.ParagraphSheet.Properties, M);
      se.paragraphStyleRuns.push({
        length: _e,
        style: Oe
        /*, adjustments*/
      });
    }
    for (let ue = Q; se.paragraphStyleRuns.length && ue > 0; ue--)
      --se.paragraphStyleRuns[se.paragraphStyleRuns.length - 1].length === 0 && se.paragraphStyleRuns.pop();
    B(se.paragraphStyle, se.paragraphStyleRuns, l), se.paragraphStyleRuns.length || delete se.paragraphStyleRuns;
    const ve = E.StyleRun;
    se.style = {}, se.styleRuns = [];
    for (let ue = 0; ue < ve.RunArray.length; ue++) {
      const Fe = ve.RunLengthArray[ue], _e = he(ve.RunArray[ue].StyleSheet.StyleSheetData, M);
      _e.font || (_e.font = M[0]), se.styleRuns.push({ length: Fe, style: _e });
    }
    for (let ue = Q; se.styleRuns.length && ue > 0; ue--)
      --se.styleRuns[se.styleRuns.length - 1].length === 0 && se.styleRuns.pop();
    return B(se.style, se.styleRuns, f), se.styleRuns.length || delete se.styleRuns, se;
  }
  function C(F) {
    var N, J, W, n, p, g, E, G, M, re, Q, se;
    const me = `${(F.text || "").replace(/\r?\n/g, "\r")}\r`, te = [
      { name: "AdobeInvisFont", script: 0, type: 0, synthetic: 0 }
    ], ve = ((N = F.style) === null || N === void 0 ? void 0 : N.font) || ((W = (J = F.styleRuns) === null || J === void 0 ? void 0 : J.find((Y) => Y.style.font)) === null || W === void 0 ? void 0 : W.style.font) || c, ue = [], Fe = [], _e = F.paragraphStyleRuns;
    if (_e && _e.length) {
      let Y = me.length;
      for (const de of _e) {
        let pe = Math.min(de.length, Y);
        Y -= pe, pe && (Y === 1 && de === _e[_e.length - 1] && (pe++, Y--), Fe.push(pe), ue.push({
          ParagraphSheet: {
            DefaultStyleSheet: 0,
            Properties: fe(Object.assign(Object.assign(Object.assign({}, q), F.paragraphStyle), de.style), te)
          },
          Adjustments: { Axis: [1, 0, 1], XY: [0, 0] }
        }));
      }
      Y && (Fe.push(Y), ue.push({
        ParagraphSheet: {
          DefaultStyleSheet: 0,
          Properties: fe(Object.assign(Object.assign({}, q), F.paragraphStyle), te)
        },
        Adjustments: { Axis: [1, 0, 1], XY: [0, 0] }
      }));
    } else
      for (let Y = 0, de = 0; Y < me.length; Y++)
        me.charCodeAt(Y) === 13 && (Fe.push(Y - de + 1), ue.push({
          ParagraphSheet: {
            DefaultStyleSheet: 0,
            Properties: fe(Object.assign(Object.assign({}, q), F.paragraphStyle), te)
          },
          Adjustments: { Axis: [1, 0, 1], XY: [0, 0] }
        }), de = Y + 1);
    const Oe = ne(Object.assign(Object.assign({}, k), { font: ve }), te), Ie = F.styleRuns || [{ length: me.length, style: F.style || {} }], xe = [], Ae = [];
    let ze = me.length;
    for (const Y of Ie) {
      let de = Math.min(Y.length, ze);
      ze -= de, de && (ze === 1 && Y === Ie[Ie.length - 1] && (de++, ze--), Ae.push(de), xe.push({
        StyleSheet: {
          StyleSheetData: ne(Object.assign(Object.assign({ kerning: 0, autoKerning: !0, fillColor: { r: 0, g: 0, b: 0 } }, F.style), Y.style), te)
        }
      }));
    }
    ze && Ie.length && (Ae.push(ze), xe.push({
      StyleSheet: {
        StyleSheetData: ne(Object.assign({ kerning: 0, autoKerning: !0, fillColor: { r: 0, g: 0, b: 0 } }, F.style), te)
      }
    }));
    const Pe = Object.assign(Object.assign({}, S), F.gridInfo), Re = F.orientation === "vertical" ? 2 : 0, Ve = F.orientation === "vertical" ? 1 : 0, Ge = F.shapeType === "box" ? 1 : 0, Be = {
      ShapeType: Ge
    };
    Ge === 0 ? Be.PointBase = F.pointBase || [0, 0] : Be.BoxBounds = F.boxBounds || [0, 0, 0, 0], Be.Base = {
      ShapeType: Ge,
      TransformPoint0: [1, 0],
      TransformPoint1: [0, 1],
      TransformPoint2: [0, 0]
    };
    const v = {
      KinsokuSet: [
        {
          Name: "PhotoshopKinsokuHard",
          NoStart: "、。，．・：；？！ー―’”）〕］｝〉》」』】ヽヾゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ゛゜?!)]},.:;℃℉¢％‰",
          NoEnd: "‘“（〔［｛〈《「『【([{￥＄£＠§〒＃",
          Keep: "―‥",
          Hanging: "、。.,"
        },
        {
          Name: "PhotoshopKinsokuSoft",
          NoStart: "、。，．・：；？！’”）〕］｝〉》」』】ヽヾゝゞ々",
          NoEnd: "‘“（〔［｛〈《「『【",
          Keep: "―‥",
          Hanging: "、。.,"
        }
      ],
      MojiKumiSet: [
        { InternalName: "Photoshop6MojiKumiSet1" },
        { InternalName: "Photoshop6MojiKumiSet2" },
        { InternalName: "Photoshop6MojiKumiSet3" },
        { InternalName: "Photoshop6MojiKumiSet4" }
      ],
      TheNormalStyleSheet: 0,
      TheNormalParagraphSheet: 0,
      ParagraphSheetSet: [
        {
          Name: "Normal RGB",
          DefaultStyleSheet: 0,
          Properties: fe(Object.assign(Object.assign({}, q), F.paragraphStyle), te)
        }
      ],
      StyleSheetSet: [
        {
          Name: "Normal RGB",
          StyleSheetData: Oe
        }
      ],
      FontSet: te.map((Y) => ({
        Name: Y.name,
        Script: Y.script || 0,
        FontType: Y.type || 0,
        Synthetic: Y.synthetic || 0
      })),
      SuperscriptSize: (n = F.superscriptSize) !== null && n !== void 0 ? n : 0.583,
      SuperscriptPosition: (p = F.superscriptPosition) !== null && p !== void 0 ? p : 0.333,
      SubscriptSize: (g = F.subscriptSize) !== null && g !== void 0 ? g : 0.583,
      SubscriptPosition: (E = F.subscriptPosition) !== null && E !== void 0 ? E : 0.333,
      SmallCapSize: (G = F.smallCapSize) !== null && G !== void 0 ? G : 0.7
    };
    return {
      EngineDict: {
        Editor: { Text: me },
        ParagraphRun: {
          DefaultRunData: {
            ParagraphSheet: { DefaultStyleSheet: 0, Properties: {} },
            Adjustments: { Axis: [1, 0, 1], XY: [0, 0] }
          },
          RunArray: ue,
          RunLengthArray: Fe,
          IsJoinable: 1
        },
        StyleRun: {
          DefaultRunData: { StyleSheet: { StyleSheetData: {} } },
          RunArray: xe,
          RunLengthArray: Ae,
          IsJoinable: 2
        },
        GridInfo: {
          GridIsOn: !!Pe.isOn,
          ShowGrid: !!Pe.show,
          GridSize: (M = Pe.size) !== null && M !== void 0 ? M : 18,
          GridLeading: (re = Pe.leading) !== null && re !== void 0 ? re : 22,
          GridColor: O(Pe.color),
          GridLeadingFillColor: O(Pe.color),
          AlignLineHeightToGridFlags: !!Pe.alignLineHeightToGridFlags
        },
        AntiAlias: a.indexOf((Q = F.antiAlias) !== null && Q !== void 0 ? Q : "sharp"),
        UseFractionalGlyphWidths: (se = F.useFractionalGlyphWidths) !== null && se !== void 0 ? se : !0,
        Rendered: {
          Version: 1,
          Shapes: {
            WritingDirection: Re,
            Children: [
              {
                ShapeType: Ge,
                Procession: Ve,
                Lines: { WritingDirection: Re, Children: [] },
                Cookie: { Photoshop: Be }
              }
            ]
          }
        }
      },
      ResourceDict: Object.assign({}, v),
      DocumentResources: Object.assign({}, v)
    };
  }
  return xt;
}
var Ut = {}, En;
function bi() {
  if (En) return Ut;
  En = 1, Object.defineProperty(Ut, "__esModule", { value: !0 }), Ut.decodeEngineData2 = a;
  const c = {
    0: {
      uproot: !0,
      children: {
        0: { name: "Type" },
        1: { name: "Values" }
      }
    }
  }, q = {
    0: { name: "Font" },
    1: { name: "FontSize" },
    2: { name: "FauxBold" },
    3: { name: "FauxItalic" },
    4: { name: "AutoLeading" },
    5: { name: "Leading" },
    6: { name: "HorizontalScale" },
    7: { name: "VerticalScale" },
    8: { name: "Tracking" },
    9: { name: "BaselineShift" },
    // '10': ???
    11: { name: "Kerning?" },
    // different value than EngineData (0 - numerical value, 1 - metric, 2 - optical)
    12: { name: "FontCaps" },
    13: { name: "FontBaseline" },
    15: { name: "Strikethrough?" },
    // number instead of bool
    16: { name: "Underline?" },
    // number instead of bool
    18: { name: "Ligatures" },
    19: { name: "DLigatures" },
    // '20': ???
    // '21': ???
    // '22': ???
    23: { name: "Fractions" },
    // not present in EngineData
    24: { name: "Ordinals" },
    // not present in EngineData
    // '25': ???
    // '26': ???
    // '27': ???
    28: { name: "StylisticAlternates" },
    // not present in EngineData
    // '29': ???
    30: { name: "OldStyle?" },
    // OpenType > OldStyle, number instead of bool, not present in EngineData
    35: { name: "BaselineDirection" },
    38: { name: "Language" },
    52: { name: "NoBreak" },
    53: { name: "FillColor", children: c },
    54: { name: "StrokeColor", children: c },
    55: { children: { 99: { uproot: !0 } } },
    // '68': ???
    // '70': ???
    // '71': ???
    // '72': ???
    // '73': ???
    79: { children: c }
    // '85': ???
    // '87': ???
    // '88': ???
  }, k = {
    0: { name: "Justification" },
    1: { name: "FirstLineIndent" },
    2: { name: "StartIndent" },
    3: { name: "EndIndent" },
    4: { name: "SpaceBefore" },
    5: { name: "SpaceAfter" },
    7: { name: "AutoLeading" },
    9: { name: "AutoHyphenate" },
    10: { name: "HyphenatedWordSize" },
    11: { name: "PreHyphen" },
    12: { name: "PostHyphen" },
    13: { name: "ConsecutiveHyphens?" },
    // different value than EngineData
    14: { name: "Zone" },
    15: { name: "HypenateCapitalizedWords" },
    // not present in EngineData
    17: { name: "WordSpacing" },
    18: { name: "LetterSpacing" },
    19: { name: "GlyphSpacing" },
    32: { name: "StyleSheet", children: q }
  }, S = {
    name: "StyleSheetData",
    children: q
  }, l = {
    0: {
      name: "ResourceDict",
      children: {
        1: {
          name: "FontSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  uproot: !0,
                  children: {
                    0: {
                      uproot: !0,
                      children: {
                        0: { name: "Name" },
                        2: { name: "FontType" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        2: {
          name: "2",
          children: {}
        },
        3: {
          name: "MojiKumiSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  uproot: !0,
                  children: {
                    0: { name: "InternalName" }
                  }
                }
              }
            }
          }
        },
        4: {
          name: "KinsokuSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  uproot: !0,
                  children: {
                    0: { name: "Name" },
                    5: {
                      uproot: !0,
                      children: {
                        0: { name: "NoStart" },
                        1: { name: "NoEnd" },
                        2: { name: "Keep" },
                        3: { name: "Hanging" },
                        4: { name: "Name" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        5: {
          name: "StyleSheetSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  uproot: !0,
                  children: {
                    0: { name: "Name" },
                    6: S
                  }
                }
              }
            }
          }
        },
        6: {
          name: "ParagraphSheetSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  uproot: !0,
                  children: {
                    0: { name: "Name" },
                    5: {
                      name: "Properties",
                      children: k
                    },
                    6: { name: "DefaultStyleSheet" }
                  }
                }
              }
            }
          }
        },
        8: {
          name: "TextFrameSet",
          children: {
            0: {
              uproot: !0,
              children: {
                0: {
                  name: "path",
                  children: {
                    0: { name: "name" },
                    1: {
                      name: "bezierCurve",
                      children: {
                        0: { name: "controlPoints" }
                      }
                    },
                    2: {
                      name: "data",
                      children: {
                        0: { name: "type" },
                        1: { name: "orientation" },
                        2: { name: "frameMatrix" },
                        4: { name: "4" },
                        6: { name: "textRange" },
                        7: { name: "rowGutter" },
                        8: { name: "columnGutter" },
                        9: { name: "9" },
                        10: {
                          name: "baselineAlignment",
                          children: {
                            0: { name: "flag" },
                            1: { name: "min" }
                          }
                        },
                        11: {
                          name: "pathData",
                          children: {
                            1: { name: "1" },
                            0: { name: "reversed" },
                            2: { name: "2" },
                            3: { name: "3" },
                            4: { name: "spacing" },
                            5: { name: "5" },
                            6: { name: "6" },
                            7: { name: "7" },
                            18: { name: "18" }
                          }
                        },
                        12: { name: "12" },
                        13: { name: "13" }
                      }
                    },
                    3: { name: "3" },
                    97: { name: "uuid" }
                  }
                }
              }
            }
          }
        },
        9: {
          name: "Predefined",
          children: {
            0: {
              children: { 0: { uproot: !0 } }
            },
            1: {
              children: { 0: { uproot: !0 } }
            }
          }
        }
      }
    },
    1: {
      name: "EngineDict",
      children: {
        0: {
          name: "0",
          children: {
            // 0: ???
            // 1: ???
            // 2: ???
            3: { name: "SuperscriptSize" },
            4: { name: "SuperscriptPosition" },
            5: { name: "SubscriptSize" },
            6: { name: "SubscriptPosition" },
            7: { name: "SmallCapSize" },
            8: { name: "UseFractionalGlyphWidths" },
            // ???
            15: { children: { 0: { uproot: !0 } } }
            // 16: ???
            // 17: ???
          }
        },
        1: {
          name: "Editors?",
          // layer.text.index is specifying the index of the editor related to the layer
          children: {
            0: {
              name: "Editor",
              children: {
                0: { name: "Text" },
                5: {
                  name: "ParagraphRun",
                  children: {
                    0: {
                      name: "RunArray",
                      children: {
                        0: {
                          name: "ParagraphSheet",
                          children: {
                            0: {
                              uproot: !0,
                              children: {
                                0: { name: "0" },
                                5: {
                                  name: "5",
                                  children: k
                                },
                                6: { name: "6" }
                              }
                            }
                          }
                        },
                        1: { name: "RunLength" }
                      }
                    }
                  }
                },
                6: {
                  name: "StyleRun",
                  children: {
                    0: {
                      name: "RunArray",
                      children: {
                        0: {
                          name: "StyleSheet",
                          children: {
                            0: {
                              uproot: !0,
                              children: {
                                6: S
                              }
                            }
                          }
                        },
                        1: { name: "RunLength" }
                      }
                    }
                  }
                }
              }
            },
            1: {
              name: "FontVectorData ???"
              // children: {
              // 	'0': {},
              // 	'2': {
              // 		// '5'
              // 		// '6'
              // 	},
              // }
              //     "1": [ // this is probably bounding box? there seem to be many of them nested
              //       0,
              //       0,
              //       999,
              //       176.30014
              //     ],
              // various types: /PC, /F, /R, /L, /S, /G
            }
          }
        },
        2: {
          name: "StyleSheet",
          children: q
        },
        3: {
          name: "ParagraphSheet",
          children: k
        }
      }
    }
  };
  function f(P, ee) {
    var ye, O;
    if (P === null)
      return P;
    if (Array.isArray(P))
      return P.map((H) => f(H, ee));
    if (typeof P != "object")
      return P;
    let y = {};
    for (const H of Object.keys(P))
      if (ee[H])
        if (ee[H].uproot) {
          H !== "99" && (y = f(P[H], (ye = ee[H].children) !== null && ye !== void 0 ? ye : {})), P[99] && (y._type = P[99]);
          break;
        } else
          y[ee[H].name || H] = f(P[H], (O = ee[H].children) !== null && O !== void 0 ? O : {});
      else H === "99" ? y._type = P[H] : y[H] = f(P[H], {});
    return y;
  }
  function a(P) {
    return f(P, l);
  }
  return Ut;
}
var Pn;
function en() {
  return Pn || (Pn = 1, (function(c) {
    Object.defineProperty(c, "__esModule", { value: !0 }), c.booleanOperations = c.infoHandlersMap = c.infoHandlers = void 0, c.readBezierKnot = ie, c.readVectorMask = fe, c.hasMultiEffects = oe;
    const q = Jt(), k = pi(), S = mt(), l = bt(), f = At(), a = Qt(), P = gi(), ee = mi(), ye = bi(), O = "abcdefghijklmnopqrstuvwxyz";
    c.infoHandlers = [], c.infoHandlersMap = {};
    function y(e, i, r, h) {
      const w = { key: e, has: i, read: r, write: h };
      c.infoHandlers.push(w), c.infoHandlersMap[w.key] = w;
    }
    function H(e, i) {
      c.infoHandlersMap[e] = c.infoHandlersMap[i];
    }
    function V(e) {
      return (i) => i[e] !== void 0;
    }
    function le(e) {
      if ((0, l.readUint32)(e))
        throw new Error(`Resource size above 4 GB limit at ${e.offset.toString(16)}`);
      return (0, l.readUint32)(e);
    }
    function ce(e, i) {
      (0, f.writeUint32)(e, 0), (0, f.writeUint32)(e, i);
    }
    y("TySh", V("text"), (e, i, r) => {
      if ((0, l.readInt16)(e) !== 1)
        throw new Error("Invalid TySh version");
      const h = [];
      for (let Z = 0; Z < 6; Z++)
        h.push((0, l.readFloat64)(e));
      if ((0, l.readInt16)(e) !== 50)
        throw new Error("Invalid TySh text version");
      const w = (0, a.readVersionAndDescriptor)(e);
      if ((0, l.readInt16)(e) !== 1)
        throw new Error("Invalid TySh warp version");
      const U = (0, a.readVersionAndDescriptor)(e);
      if (i.text = {
        transform: h,
        left: (0, l.readFloat32)(e),
        top: (0, l.readFloat32)(e),
        right: (0, l.readFloat32)(e),
        bottom: (0, l.readFloat32)(e),
        text: w["Txt "].replace(/\r/g, `
`),
        index: w.TextIndex || 0,
        gridding: a.textGridding.decode(w.textGridding),
        antiAlias: a.Annt.decode(w.AntA),
        orientation: a.Ornt.decode(w.Ornt),
        warp: {
          style: a.warpStyle.decode(U.warpStyle),
          value: U.warpValue || 0,
          perspective: U.warpPerspective || 0,
          perspectiveOther: U.warpPerspectiveOther || 0,
          rotate: a.Ornt.decode(U.warpRotate)
        }
      }, w.bounds && (i.text.bounds = (0, a.descBoundsToBounds)(w.bounds)), w.boundingBox && (i.text.boundingBox = (0, a.descBoundsToBounds)(w.boundingBox)), w.EngineData) {
        const Z = (0, P.parseEngineData)(w.EngineData), d = (0, ee.decodeEngineData)(Z);
        i.text = Object.assign(Object.assign({}, i.text), d);
      }
      (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.text, h = r.warp || {}, w = r.transform || [1, 0, 0, 1, 0, 0], U = Object.assign(Object.assign(Object.assign({ "Txt ": (r.text || "").replace(/\r?\n/g, "\r"), textGridding: a.textGridding.encode(r.gridding), Ornt: a.Ornt.encode(r.orientation), AntA: a.Annt.encode(r.antiAlias) }, r.bounds ? { bounds: (0, a.boundsToDescBounds)(r.bounds) } : {}), r.boundingBox ? { boundingBox: (0, a.boundsToDescBounds)(r.boundingBox) } : {}), { TextIndex: r.index || 0, EngineData: (0, P.serializeEngineData)((0, ee.encodeEngineData)(r)) });
      (0, f.writeInt16)(e, 1);
      for (let Z = 0; Z < 6; Z++)
        (0, f.writeFloat64)(e, w[Z]);
      (0, f.writeInt16)(e, 50), (0, a.writeVersionAndDescriptor)(e, "", "TxLr", U, "text"), (0, f.writeInt16)(e, 1), (0, a.writeVersionAndDescriptor)(e, "", "warp", C(h)), (0, f.writeFloat32)(e, r.left), (0, f.writeFloat32)(e, r.top), (0, f.writeFloat32)(e, r.right), (0, f.writeFloat32)(e, r.bottom);
    }), y("SoCo", (e) => e.vectorFill !== void 0 && e.vectorStroke === void 0 && e.vectorFill.type === "color", (e, i) => {
      const r = (0, a.readVersionAndDescriptor)(e);
      i.vectorFill = (0, a.parseVectorContent)(r);
    }, (e, i) => {
      const { descriptor: r } = (0, a.serializeVectorContent)(i.vectorFill);
      (0, a.writeVersionAndDescriptor)(e, "", "null", r);
    }), y("GdFl", (e) => e.vectorFill !== void 0 && e.vectorStroke === void 0 && (e.vectorFill.type === "solid" || e.vectorFill.type === "noise"), (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      i.vectorFill = (0, a.parseVectorContent)(h), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const { descriptor: r } = (0, a.serializeVectorContent)(i.vectorFill);
      (0, a.writeVersionAndDescriptor)(e, "", "null", r);
    }), y("PtFl", (e) => e.vectorFill !== void 0 && e.vectorStroke === void 0 && e.vectorFill.type === "pattern", (e, i) => {
      const r = (0, a.readVersionAndDescriptor)(e);
      i.vectorFill = (0, a.parseVectorContent)(r);
    }, (e, i) => {
      const { descriptor: r } = (0, a.serializeVectorContent)(i.vectorFill);
      (0, a.writeVersionAndDescriptor)(e, "", "null", r);
    }), y("vscg", (e) => e.vectorFill !== void 0 && e.vectorStroke !== void 0, (e, i, r) => {
      (0, l.readSignature)(e);
      const h = (0, a.readVersionAndDescriptor)(e);
      i.vectorFill = (0, a.parseVectorContent)(h), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const { descriptor: r, key: h } = (0, a.serializeVectorContent)(i.vectorFill);
      (0, f.writeSignature)(e, h), (0, a.writeVersionAndDescriptor)(e, "", "null", r);
    });
    function ie(e, i, r) {
      const h = (0, l.readFixedPointPath32)(e) * r, w = (0, l.readFixedPointPath32)(e) * i, U = (0, l.readFixedPointPath32)(e) * r, Z = (0, l.readFixedPointPath32)(e) * i, d = (0, l.readFixedPointPath32)(e) * r, L = (0, l.readFixedPointPath32)(e) * i;
      return [w, h, Z, U, L, d];
    }
    function he(e, i, r, h) {
      (0, f.writeFixedPointPath32)(e, i[1] / h), (0, f.writeFixedPointPath32)(e, i[0] / r), (0, f.writeFixedPointPath32)(e, i[3] / h), (0, f.writeFixedPointPath32)(e, i[2] / r), (0, f.writeFixedPointPath32)(e, i[5] / h), (0, f.writeFixedPointPath32)(e, i[4] / r);
    }
    c.booleanOperations = ["exclude", "combine", "subtract", "intersect"];
    function fe(e, i, r, h, w) {
      const U = e.offset + w, Z = i.paths;
      let d;
      for (; U - e.offset >= 26; ) {
        const L = (0, l.readUint16)(e);
        switch (L) {
          case 0:
          // Closed subpath length record
          case 3: {
            (0, l.readUint16)(e);
            const o = (0, l.readInt16)(e), _ = (0, l.readUint16)(e);
            (0, l.skipBytes)(e, 18), d = {
              open: L === 3,
              knots: [],
              fillRule: _ === 2 ? "non-zero" : "even-odd"
            }, o !== -1 && (d.operation = c.booleanOperations[o]), Z.push(d);
            break;
          }
          case 1:
          // Closed subpath Bezier knot, linked
          case 2:
          // Closed subpath Bezier knot, unlinked
          case 4:
          // Open subpath Bezier knot, linked
          case 5:
            d.knots.push({ linked: L === 1 || L === 4, points: ie(e, r, h) });
            break;
          case 6:
            (0, l.skipBytes)(e, 24);
            break;
          case 7: {
            const o = (0, l.readFixedPointPath32)(e), _ = (0, l.readFixedPointPath32)(e), I = (0, l.readFixedPointPath32)(e), x = (0, l.readFixedPointPath32)(e), b = (0, l.readFixedPointPath32)(e);
            (0, l.skipBytes)(e, 4), i.clipboard = { top: o, left: _, bottom: I, right: x, resolution: b };
            break;
          }
          case 8:
            i.fillStartsWithAllPixels = !!(0, l.readUint16)(e), (0, l.skipBytes)(e, 22);
            break;
          default:
            throw new Error("Invalid vmsk section");
        }
      }
      return Z;
    }
    y("vmsk", V("vectorMask"), (e, i, r, { width: h, height: w }) => {
      if ((0, l.readUint32)(e) !== 3)
        throw new Error("Invalid vmsk version");
      i.vectorMask = { paths: [] };
      const U = i.vectorMask, Z = (0, l.readUint32)(e);
      U.invert = (Z & 1) !== 0, U.notLink = (Z & 2) !== 0, U.disable = (Z & 4) !== 0, fe(e, U, h, w, r()), (0, l.skipBytes)(e, r());
    }, (e, i, { width: r, height: h }) => {
      const w = i.vectorMask, U = (w.invert ? 1 : 0) | (w.notLink ? 2 : 0) | (w.disable ? 4 : 0);
      (0, f.writeUint32)(e, 3), (0, f.writeUint32)(e, U), (0, f.writeUint16)(e, 6), (0, f.writeZeros)(e, 24);
      const Z = w.clipboard;
      Z && ((0, f.writeUint16)(e, 7), (0, f.writeFixedPointPath32)(e, Z.top), (0, f.writeFixedPointPath32)(e, Z.left), (0, f.writeFixedPointPath32)(e, Z.bottom), (0, f.writeFixedPointPath32)(e, Z.right), (0, f.writeFixedPointPath32)(e, Z.resolution), (0, f.writeZeros)(e, 4)), (0, f.writeUint16)(e, 8), (0, f.writeUint16)(e, w.fillStartsWithAllPixels ? 1 : 0), (0, f.writeZeros)(e, 22);
      for (const d of w.paths) {
        (0, f.writeUint16)(e, d.open ? 3 : 0), (0, f.writeUint16)(e, d.knots.length), (0, f.writeUint16)(e, d.operation ? c.booleanOperations.indexOf(d.operation) : -1), (0, f.writeUint16)(e, d.fillRule === "non-zero" ? 2 : 1), (0, f.writeZeros)(e, 18);
        const L = d.open ? 4 : 1, o = d.open ? 5 : 2;
        for (const { linked: _, points: I } of d.knots)
          (0, f.writeUint16)(e, _ ? L : o), he(e, I, r, h);
      }
    }), H("vsms", "vmsk"), y(
      "vowv",
      // something with vectors?
      V("vowv"),
      (e, i) => {
        i.vowv = (0, l.readUint32)(e);
      },
      (e, i) => {
        (0, f.writeUint32)(e, i.vowv);
      }
    ), y("vogk", V("vectorOrigination"), (e, i, r) => {
      if ((0, l.readInt32)(e) !== 1)
        throw new Error("Invalid vogk version");
      const h = (0, a.readVersionAndDescriptor)(e);
      i.vectorOrigination = { keyDescriptorList: [] };
      for (const w of h.keyDescriptorList) {
        const U = {};
        w.keyShapeInvalidated != null && (U.keyShapeInvalidated = w.keyShapeInvalidated), w.keyOriginType != null && (U.keyOriginType = w.keyOriginType), w.keyOriginResolution != null && (U.keyOriginResolution = w.keyOriginResolution), w.keyOriginShapeBBox && (U.keyOriginShapeBoundingBox = {
          top: (0, a.parseUnitsOrNumber)(w.keyOriginShapeBBox["Top "]),
          left: (0, a.parseUnitsOrNumber)(w.keyOriginShapeBBox.Left),
          bottom: (0, a.parseUnitsOrNumber)(w.keyOriginShapeBBox.Btom),
          right: (0, a.parseUnitsOrNumber)(w.keyOriginShapeBBox.Rght)
        });
        const Z = w.keyOriginRRectRadii;
        Z && (U.keyOriginRRectRadii = {
          topRight: (0, a.parseUnits)(Z.topRight),
          topLeft: (0, a.parseUnits)(Z.topLeft),
          bottomLeft: (0, a.parseUnits)(Z.bottomLeft),
          bottomRight: (0, a.parseUnits)(Z.bottomRight)
        });
        const d = w.keyOriginBoxCorners;
        d && (U.keyOriginBoxCorners = [
          { x: d.rectangleCornerA.Hrzn, y: d.rectangleCornerA.Vrtc },
          { x: d.rectangleCornerB.Hrzn, y: d.rectangleCornerB.Vrtc },
          { x: d.rectangleCornerC.Hrzn, y: d.rectangleCornerC.Vrtc },
          { x: d.rectangleCornerD.Hrzn, y: d.rectangleCornerD.Vrtc }
        ]);
        const L = w.Trnf;
        L && (U.transform = [L.xx, L.xy, L.yx, L.yy, L.tx, L.ty]), i.vectorOrigination.keyDescriptorList.push(U);
      }
      (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.vectorOrigination, h = { keyDescriptorList: [] };
      for (let w = 0; w < r.keyDescriptorList.length; w++) {
        const U = r.keyDescriptorList[w];
        h.keyDescriptorList.push({});
        const Z = h.keyDescriptorList[h.keyDescriptorList.length - 1];
        U.keyOriginType != null && (Z.keyOriginType = U.keyOriginType), U.keyOriginResolution != null && (Z.keyOriginResolution = U.keyOriginResolution);
        const d = U.keyOriginRRectRadii;
        d && (Z.keyOriginRRectRadii = {
          unitValueQuadVersion: 1,
          topRight: (0, a.unitsValue)(d.topRight, "topRight"),
          topLeft: (0, a.unitsValue)(d.topLeft, "topLeft"),
          bottomLeft: (0, a.unitsValue)(d.bottomLeft, "bottomLeft"),
          bottomRight: (0, a.unitsValue)(d.bottomRight, "bottomRight")
        });
        const L = U.keyOriginShapeBoundingBox;
        L && (Z.keyOriginShapeBBox = {
          unitValueQuadVersion: 1,
          "Top ": (0, a.unitsValue)(L.top, "top"),
          Left: (0, a.unitsValue)(L.left, "left"),
          Btom: (0, a.unitsValue)(L.bottom, "bottom"),
          Rght: (0, a.unitsValue)(L.right, "right")
        });
        const o = U.keyOriginBoxCorners;
        o && o.length === 4 && (Z.keyOriginBoxCorners = {
          rectangleCornerA: { Hrzn: o[0].x, Vrtc: o[0].y },
          rectangleCornerB: { Hrzn: o[1].x, Vrtc: o[1].y },
          rectangleCornerC: { Hrzn: o[2].x, Vrtc: o[2].y },
          rectangleCornerD: { Hrzn: o[3].x, Vrtc: o[3].y }
        });
        const _ = U.transform;
        _ && _.length === 6 && (Z.Trnf = {
          xx: _[0],
          xy: _[1],
          yx: _[2],
          yy: _[3],
          tx: _[4],
          ty: _[5]
        }), U.keyShapeInvalidated != null && (Z.keyShapeInvalidated = U.keyShapeInvalidated), Z.keyOriginIndex = w;
      }
      (0, f.writeInt32)(e, 1), (0, a.writeVersionAndDescriptor)(e, "", "null", h);
    }), y("lmfx", (e) => e.effects !== void 0 && oe(e.effects), (e, i, r) => {
      if ((0, l.readUint32)(e) !== 0)
        throw new Error("Invalid lmfx version");
      const w = (0, a.readVersionAndDescriptor)(e);
      i.effects = (0, a.parseEffects)(w, !!e.logMissingFeatures), (0, l.skipBytes)(e, r());
    }, (e, i, r, h) => {
      const w = (0, a.serializeEffects)(i.effects, !!h.logMissingFeatures, !0);
      (0, f.writeUint32)(e, 0), (0, a.writeVersionAndDescriptor)(e, "", "null", w);
    }), y("lrFX", V("effects"), (e, i, r) => {
      i.effects || (i.effects = (0, k.readEffects)(e)), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      (0, k.writeEffects)(e, i.effects);
    }), y("luni", V("name"), (e, i, r) => {
      if (r() > 4) {
        const h = (0, l.readUint32)(e);
        r() >= h * 2 ? i.name = (0, l.readUnicodeStringWithLength)(e, h) : e.logDevFeatures && e.log("name in luni section is too long");
      } else
        e.logDevFeatures && e.log("empty luni section");
      (0, l.skipBytes)(e, r());
    }, (e, i) => {
      (0, f.writeUnicodeString)(e, i.name);
    }), y("lnsr", V("nameSource"), (e, i) => i.nameSource = (0, l.readSignature)(e), (e, i) => (0, f.writeSignature)(e, i.nameSource)), y("lyid", V("id"), (e, i) => {
      i.id = (0, l.readUint32)(e);
    }, (e, i, r, h) => {
      let w = i.id;
      for (; h.layerIds.has(w); )
        w += 100;
      (0, f.writeUint32)(e, w), h.layerIds.add(w), h.layerToId.set(i, w);
    }), y("lsct", V("sectionDivider"), (e, i, r) => {
      i.sectionDivider = { type: (0, l.readUint32)(e) }, r() && ((0, l.checkSignature)(e, "8BIM"), i.sectionDivider.key = (0, l.readSignature)(e)), r() && (i.sectionDivider.subType = (0, l.readUint32)(e));
    }, (e, i) => {
      (0, f.writeUint32)(e, i.sectionDivider.type), i.sectionDivider.key && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, i.sectionDivider.key), i.sectionDivider.subType !== void 0 && (0, f.writeUint32)(e, i.sectionDivider.subType));
    }), H("lsdk", "lsct"), y("clbl", V("blendClippendElements"), (e, i) => {
      i.blendClippendElements = !!(0, l.readUint8)(e), (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.blendClippendElements ? 1 : 0), (0, f.writeZeros)(e, 3);
    }), y("infx", V("blendInteriorElements"), (e, i) => {
      i.blendInteriorElements = !!(0, l.readUint8)(e), (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.blendInteriorElements ? 1 : 0), (0, f.writeZeros)(e, 3);
    }), y("knko", V("knockout"), (e, i) => {
      i.knockout = !!(0, l.readUint8)(e), (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.knockout ? 1 : 0), (0, f.writeZeros)(e, 3);
    }), y("lmgm", V("layerMaskAsGlobalMask"), (e, i) => {
      i.layerMaskAsGlobalMask = !!(0, l.readUint8)(e), (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.layerMaskAsGlobalMask ? 1 : 0), (0, f.writeZeros)(e, 3);
    }), y("lspf", V("protected"), (e, i) => {
      const r = (0, l.readUint32)(e);
      i.protected = {
        transparency: (r & 1) !== 0,
        composite: (r & 2) !== 0,
        position: (r & 4) !== 0
      }, r & 8 && (i.protected.artboards = !0);
    }, (e, i) => {
      const r = (i.protected.transparency ? 1 : 0) | (i.protected.composite ? 2 : 0) | (i.protected.position ? 4 : 0) | (i.protected.artboards ? 8 : 0);
      (0, f.writeUint32)(e, r);
    }), y("lclr", V("layerColor"), (e, i) => {
      const r = (0, l.readUint16)(e);
      (0, l.skipBytes)(e, 6), i.layerColor = S.layerColors[r];
    }, (e, i) => {
      const r = S.layerColors.indexOf(i.layerColor);
      (0, f.writeUint16)(e, r === -1 ? 0 : r), (0, f.writeZeros)(e, 6);
    }), y(
      "shmd",
      // Metadata setting
      // Metadata setting
      (e) => e.timestamp !== void 0 || e.animationFrames !== void 0 || e.animationFrameFlags !== void 0 || e.timeline !== void 0 || e.comps !== void 0,
      (e, i, r) => {
        const h = (0, l.readUint32)(e);
        for (let w = 0; w < h; w++) {
          (0, l.checkSignature)(e, "8BIM");
          const U = (0, l.readSignature)(e);
          (0, l.readUint8)(e), (0, l.skipBytes)(e, 3), (0, l.readSection)(e, 1, (Z) => {
            if (U === "cust") {
              const d = (0, a.readVersionAndDescriptor)(e);
              d.layerTime !== void 0 && (i.timestamp = d.layerTime);
            } else if (U === "mlst") {
              const d = (0, a.readVersionAndDescriptor)(e);
              i.animationFrames = [];
              for (let L = 0; L < d.LaSt.length; L++) {
                const o = d.LaSt[L], _ = { frames: o.FrLs };
                o.enab !== void 0 && (_.enable = o.enab), o.Ofst && (_.offset = (0, a.horzVrtcToXY)(o.Ofst)), o.FXRf && (_.referencePoint = (0, a.horzVrtcToXY)(o.FXRf)), o.Lefx && (_.effects = (0, a.parseEffects)(o.Lefx, !!e.logMissingFeatures)), o.blendOptions && o.blendOptions.Opct && (_.opacity = (0, a.parsePercent)(o.blendOptions.Opct)), i.animationFrames.push(_);
              }
            } else if (U === "mdyn") {
              (0, l.readUint16)(e);
              const d = (0, l.readUint8)(e), L = (0, l.readUint8)(e);
              i.animationFrameFlags = {
                propagateFrameOne: !d,
                unifyLayerPosition: (L & 1) !== 0,
                unifyLayerStyle: (L & 2) !== 0,
                unifyLayerVisibility: (L & 4) !== 0
              };
            } else if (U === "tmln") {
              const d = (0, a.readVersionAndDescriptor)(e), L = d.timeScope, o = {
                start: (0, a.frac)(L.Strt),
                duration: (0, a.frac)(L.duration),
                inTime: (0, a.frac)(L.inTime),
                outTime: (0, a.frac)(L.outTime),
                autoScope: d.autoScope,
                audioLevel: d.audioLevel
              };
              d.trackList && (o.tracks = (0, a.parseTrackList)(d.trackList, !!e.logMissingFeatures)), i.timeline = o;
            } else if (U === "cmls") {
              const d = (0, a.readVersionAndDescriptor)(e);
              i.comps = {
                settings: []
              }, d.origFXRefPoint && (i.comps.originalEffectsReferencePoint = { x: d.origFXRefPoint.Hrzn, y: d.origFXRefPoint.Vrtc });
              for (const L of d.layerSettings) {
                i.comps.settings.push({ compList: L.compList });
                const o = i.comps.settings[i.comps.settings.length - 1];
                "enab" in L && (o.enabled = L.enab), L.Ofst && (o.offset = { x: L.Ofst.Hrzn, y: L.Ofst.Vrtc }), L.FXRefPoint && (o.effectsReferencePoint = { x: L.FXRefPoint.Hrzn, y: L.FXRefPoint.Vrtc });
              }
            } else U === "extn" && (0, a.readVersionAndDescriptor)(e), e.logMissingFeatures && e.log('Unhandled "shmd" section key', U);
            (0, l.skipBytes)(e, Z());
          });
        }
        (0, l.skipBytes)(e, r());
      },
      (e, i, r, h) => {
        const { animationFrames: w, animationFrameFlags: U, timestamp: Z, timeline: d, comps: L } = i;
        let o = 0;
        w && o++, U && o++, d && o++, Z !== void 0 && o++, L && o++, (0, f.writeUint32)(e, o), w && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, "mlst"), (0, f.writeUint8)(e, 0), (0, f.writeZeros)(e, 3), (0, f.writeSection)(e, 2, () => {
          var _;
          const I = {
            LaID: (_ = i.id) !== null && _ !== void 0 ? _ : 0,
            LaSt: []
          };
          for (let x = 0; x < w.length; x++) {
            const b = w[x], X = {};
            b.enable !== void 0 && (X.enab = b.enable), X.FrLs = b.frames, b.offset && (X.Ofst = (0, a.xyToHorzVrtc)(b.offset)), b.referencePoint && (X.FXRf = (0, a.xyToHorzVrtc)(b.referencePoint)), b.effects && (X.Lefx = (0, a.serializeEffects)(b.effects, !1, !1)), b.opacity !== void 0 && (X.blendOptions = { Opct: (0, a.unitsPercent)(b.opacity) }), I.LaSt.push(X);
          }
          (0, a.writeVersionAndDescriptor)(e, "", "null", I);
        }, !0)), U && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, "mdyn"), (0, f.writeUint8)(e, 0), (0, f.writeZeros)(e, 3), (0, f.writeSection)(e, 2, () => {
          (0, f.writeUint16)(e, 0), (0, f.writeUint8)(e, U.propagateFrameOne ? 0 : 15), (0, f.writeUint8)(e, (U.unifyLayerPosition ? 1 : 0) | (U.unifyLayerStyle ? 2 : 0) | (U.unifyLayerVisibility ? 4 : 0));
        })), d && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, "tmln"), (0, f.writeUint8)(e, 0), (0, f.writeZeros)(e, 3), (0, f.writeSection)(e, 2, () => {
          const _ = {
            Vrsn: 1,
            timeScope: {
              Vrsn: 1,
              Strt: d.start,
              duration: d.duration,
              inTime: d.inTime,
              outTime: d.outTime
            },
            autoScope: d.autoScope,
            audioLevel: d.audioLevel
          };
          d.tracks && (_.trackList = (0, a.serializeTrackList)(d.tracks));
          const I = h.layerToId.get(i) || i.id;
          if (!I)
            throw new Error("You need to provide layer.id value whan writing document with animations");
          _.LyrI = I, (0, a.writeVersionAndDescriptor)(e, "", "null", _, "anim");
        }, !0)), Z !== void 0 && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, "cust"), (0, f.writeUint8)(e, 0), (0, f.writeZeros)(e, 3), (0, f.writeSection)(e, 2, () => {
          const _ = {
            layerTime: Z
          };
          (0, a.writeVersionAndDescriptor)(e, "", "metadata", _);
        }, !0)), L && ((0, f.writeSignature)(e, "8BIM"), (0, f.writeSignature)(e, "cmls"), (0, f.writeUint8)(e, 0), (0, f.writeZeros)(e, 3), (0, f.writeSection)(e, 2, () => {
          const _ = h.layerToId.get(i) || i.id;
          if (!_)
            throw new Error("You need to provide layer.id value whan writing document with layer comps");
          const I = {};
          L.originalEffectsReferencePoint && (I.origFXRefPoint = { Hrzn: L.originalEffectsReferencePoint.x, Vrtc: L.originalEffectsReferencePoint.y }), I.LyrI = _, I.layerSettings = [];
          for (const x of L.settings) {
            const b = {};
            x.enabled !== void 0 && (b.enab = x.enabled), x.offset && (b.Ofst = { Hrzn: x.offset.x, Vrtc: x.offset.y }), x.effectsReferencePoint && (b.FXRefPoint = { Hrzn: x.effectsReferencePoint.x, Vrtc: x.effectsReferencePoint.y }), b.compList = x.compList, I.layerSettings.push(b);
          }
          (0, a.writeVersionAndDescriptor)(e, "", "null", I);
        }, !0));
      }
    ), y("PxSc", () => !1, (e, i) => {
      const r = (0, a.readVersionAndDescriptor)(e, !0);
      r.pixelSourceType === 1986285651 ? i.pixelSource = {
        type: "vdPS",
        origin: { x: r.origin.Hrzn, y: r.origin.Vrtc },
        interpretation: {
          interpretAlpha: r.interpretation.interpretAlpha.split(".")[1],
          profile: r.interpretation.profile
        },
        frameReader: {
          type: "QTFR",
          link: {
            name: r.frameReader["Lnk "]["Nm  "],
            fullPath: r.frameReader["Lnk "].fullPath,
            originalPath: r.frameReader["Lnk "].originalPath,
            relativePath: r.frameReader["Lnk "].relPath,
            alias: r.frameReader["Lnk "].alis
          },
          mediaDescriptor: r.frameReader.mediaDescriptor
        },
        showAlteredVideo: r.showAlteredVideo
      } : e.log("Unknown pixelSourceType");
    }, (e, i) => {
      const r = i.pixelSource, h = {
        _name: "",
        _classID: "PixelSource",
        pixelSourceType: 1986285651,
        // vdP
        descVersion: 1,
        origin: { Hrzn: r.origin.x, Vrtc: r.origin.y },
        interpretation: {
          _name: "",
          _classID: "footageInterpretation",
          Vrsn: 1,
          interpretAlpha: `alphaInterpretation.${r.interpretation.interpretAlpha}`,
          profile: r.interpretation.profile
        },
        frameReader: {
          _name: "",
          _classID: "FrameReader",
          frameReaderType: 1364477522,
          // QTF
          descVersion: 1,
          "Lnk ": {
            _name: "",
            _classID: "ExternalFileLink",
            descVersion: 2,
            "Nm  ": r.frameReader.link.name,
            fullPath: r.frameReader.link.fullPath,
            originalPath: r.frameReader.link.originalPath,
            alis: r.frameReader.link.alias,
            relPath: r.frameReader.link.relativePath
          },
          mediaDescriptor: r.frameReader.mediaDescriptor
        },
        showAlteredVideo: r.showAlteredVideo
      };
      (0, a.writeVersionAndDescriptor)(e, "", "PixelSource", h);
    }), y("vstk", V("vectorStroke"), (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      i.vectorStroke = {
        strokeEnabled: h.strokeEnabled,
        fillEnabled: h.fillEnabled,
        lineWidth: (0, a.parseUnits)(h.strokeStyleLineWidth),
        lineDashOffset: (0, a.parseUnits)(h.strokeStyleLineDashOffset),
        miterLimit: h.strokeStyleMiterLimit,
        lineCapType: a.strokeStyleLineCapType.decode(h.strokeStyleLineCapType),
        lineJoinType: a.strokeStyleLineJoinType.decode(h.strokeStyleLineJoinType),
        lineAlignment: a.strokeStyleLineAlignment.decode(h.strokeStyleLineAlignment),
        scaleLock: h.strokeStyleScaleLock,
        strokeAdjust: h.strokeStyleStrokeAdjust,
        lineDashSet: h.strokeStyleLineDashSet.map(a.parseUnits),
        blendMode: a.BlnM.decode(h.strokeStyleBlendMode),
        opacity: (0, a.parsePercent)(h.strokeStyleOpacity),
        content: (0, a.parseVectorContent)(h.strokeStyleContent),
        resolution: h.strokeStyleResolution
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r, h, w;
      const U = i.vectorStroke, Z = {
        strokeStyleVersion: 2,
        strokeEnabled: !!U.strokeEnabled,
        fillEnabled: !!U.fillEnabled,
        strokeStyleLineWidth: U.lineWidth || { value: 3, units: "Points" },
        strokeStyleLineDashOffset: U.lineDashOffset || { value: 0, units: "Points" },
        strokeStyleMiterLimit: (r = U.miterLimit) !== null && r !== void 0 ? r : 100,
        strokeStyleLineCapType: a.strokeStyleLineCapType.encode(U.lineCapType),
        strokeStyleLineJoinType: a.strokeStyleLineJoinType.encode(U.lineJoinType),
        strokeStyleLineAlignment: a.strokeStyleLineAlignment.encode(U.lineAlignment),
        strokeStyleScaleLock: !!U.scaleLock,
        strokeStyleStrokeAdjust: !!U.strokeAdjust,
        strokeStyleLineDashSet: U.lineDashSet || [],
        strokeStyleBlendMode: a.BlnM.encode(U.blendMode),
        strokeStyleOpacity: (0, a.unitsPercent)((h = U.opacity) !== null && h !== void 0 ? h : 1),
        strokeStyleContent: (0, a.serializeVectorContent)(U.content || { type: "color", color: { r: 0, g: 0, b: 0 } }).descriptor,
        strokeStyleResolution: (w = U.resolution) !== null && w !== void 0 ? w : 72
      };
      (0, a.writeVersionAndDescriptor)(e, "", "strokeStyle", Z);
    }), y(
      "artb",
      // per-layer arboard info
      V("artboard"),
      (e, i, r) => {
        const h = (0, a.readVersionAndDescriptor)(e), w = h.artboardRect;
        i.artboard = {
          rect: { top: w["Top "], left: w.Left, bottom: w.Btom, right: w.Rght },
          guideIndices: h.guideIndeces,
          presetName: h.artboardPresetName,
          color: (0, a.parseColor)(h["Clr "]),
          backgroundType: h.artboardBackgroundType
        }, (0, l.skipBytes)(e, r());
      },
      (e, i) => {
        var r;
        const h = i.artboard, w = h.rect, U = {
          artboardRect: { "Top ": w.top, Left: w.left, Btom: w.bottom, Rght: w.right },
          guideIndeces: h.guideIndices || [],
          artboardPresetName: h.presetName || "",
          "Clr ": (0, a.serializeColor)(h.color),
          artboardBackgroundType: (r = h.backgroundType) !== null && r !== void 0 ? r : 1
        };
        (0, a.writeVersionAndDescriptor)(e, "", "artboard", U);
      }
    ), y("sn2P", V("usingAlignedRendering"), (e, i) => i.usingAlignedRendering = !!(0, l.readUint32)(e), (e, i) => (0, f.writeUint32)(e, i.usingAlignedRendering ? 1 : 0));
    const ne = ["unknown", "vector", "raster", "image stack"];
    function B(e) {
      var i, r, h, w, U, Z;
      const d = Object.assign(Object.assign({ style: a.warpStyle.decode(e.warpStyle) }, e.warpValues ? { values: e.warpValues } : { value: e.warpValue || 0 }), { perspective: e.warpPerspective || 0, perspectiveOther: e.warpPerspectiveOther || 0, rotate: a.Ornt.decode(e.warpRotate), bounds: e.bounds && {
        top: (0, a.parseUnitsOrNumber)(e.bounds["Top "]),
        left: (0, a.parseUnitsOrNumber)(e.bounds.Left),
        bottom: (0, a.parseUnitsOrNumber)(e.bounds.Btom),
        right: (0, a.parseUnitsOrNumber)(e.bounds.Rght)
      }, uOrder: e.uOrder, vOrder: e.vOrder });
      (e.deformNumRows != null || e.deformNumCols != null) && (d.deformNumRows = e.deformNumRows, d.deformNumCols = e.deformNumCols);
      const L = e.customEnvelopeWarp;
      if (L) {
        d.customEnvelopeWarp = {
          meshPoints: []
        };
        const o = ((i = L.meshPoints.find((I) => I.type === "Hrzn")) === null || i === void 0 ? void 0 : i.values) || [], _ = ((r = L.meshPoints.find((I) => I.type === "Vrtc")) === null || r === void 0 ? void 0 : r.values) || [];
        for (let I = 0; I < o.length; I++)
          d.customEnvelopeWarp.meshPoints.push({ x: o[I], y: _[I] });
        (L.quiltSliceX || L.quiltSliceY) && (d.customEnvelopeWarp.quiltSliceX = ((w = (h = L.quiltSliceX) === null || h === void 0 ? void 0 : h[0]) === null || w === void 0 ? void 0 : w.values) || [], d.customEnvelopeWarp.quiltSliceY = ((Z = (U = L.quiltSliceY) === null || U === void 0 ? void 0 : U[0]) === null || Z === void 0 ? void 0 : Z.values) || []);
      }
      return d;
    }
    function z(e) {
      var i, r;
      return e.deformNumCols != null || e.deformNumRows != null || ((i = e.customEnvelopeWarp) === null || i === void 0 ? void 0 : i.quiltSliceX) || ((r = e.customEnvelopeWarp) === null || r === void 0 ? void 0 : r.quiltSliceY);
    }
    function C(e) {
      const i = e.bounds, r = Object.assign(Object.assign({ warpStyle: a.warpStyle.encode(e.style) }, e.values ? { warpValues: e.values } : { warpValue: e.value || 0 }), { warpPerspective: e.perspective || 0, warpPerspectiveOther: e.perspectiveOther || 0, warpRotate: a.Ornt.encode(e.rotate), bounds: (
        /*1 ? { // testing
            _classID: 'classFloatRect',
            'Top ': bounds && bounds.top && bounds.top.value || 0,
            Left: bounds && bounds.left && bounds.left.value || 0,
            Btom: bounds && bounds.bottom && bounds.bottom.value || 0,
            Rght: bounds && bounds.right && bounds.right.value || 0,
        } :*/
        {
          "Top ": (0, a.unitsValue)(i && i.top || { units: "Pixels", value: 0 }, "bounds.top"),
          Left: (0, a.unitsValue)(i && i.left || { units: "Pixels", value: 0 }, "bounds.left"),
          Btom: (0, a.unitsValue)(i && i.bottom || { units: "Pixels", value: 0 }, "bounds.bottom"),
          Rght: (0, a.unitsValue)(i && i.right || { units: "Pixels", value: 0 }, "bounds.right")
        }
      ), uOrder: e.uOrder || 0, vOrder: e.vOrder || 0 }), h = z(e);
      if (h) {
        const U = r;
        U.deformNumRows = e.deformNumRows || 0, U.deformNumCols = e.deformNumCols || 0;
      }
      const w = e.customEnvelopeWarp;
      if (w) {
        const U = w.meshPoints || [];
        if (h) {
          const Z = r;
          Z.customEnvelopeWarp = {
            _name: "",
            _classID: "customEnvelopeWarp",
            quiltSliceX: [{
              type: "quiltSliceX",
              values: w.quiltSliceX || []
            }],
            quiltSliceY: [{
              type: "quiltSliceY",
              values: w.quiltSliceY || []
            }],
            meshPoints: [
              { type: "Hrzn", values: U.map((d) => d.x) },
              { type: "Vrtc", values: U.map((d) => d.y) }
            ]
          };
        } else
          r.customEnvelopeWarp = {
            _name: "",
            _classID: "customEnvelopeWarp",
            meshPoints: [
              { type: "Hrzn", values: U.map((Z) => Z.x) },
              { type: "Vrtc", values: U.map((Z) => Z.y) }
            ]
          };
      }
      return r;
    }
    y("PlLd", V("placedLayer"), (e, i, r) => {
      if ((0, l.readSignature)(e) !== "plcL")
        throw new Error("Invalid PlLd signature");
      if ((0, l.readInt32)(e) !== 3)
        throw new Error("Invalid PlLd version");
      const h = (0, l.readPascalString)(e, 1), w = (0, l.readInt32)(e), U = (0, l.readInt32)(e);
      (0, l.readInt32)(e);
      const Z = (0, l.readInt32)(e);
      if (!ne[Z])
        throw new Error("Invalid PlLd type");
      const d = [];
      for (let _ = 0; _ < 8; _++)
        d.push((0, l.readFloat64)(e));
      const L = (0, l.readInt32)(e);
      if (L !== 0)
        throw new Error(`Invalid Warp version ${L}`);
      const o = (0, a.readVersionAndDescriptor)(e);
      i.placedLayer = i.placedLayer || {
        id: h,
        type: ne[Z],
        pageNumber: w,
        totalPages: U,
        transform: d,
        warp: B(o)
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.placedLayer;
      if ((0, f.writeSignature)(e, "plcL"), (0, f.writeInt32)(e, 3), !r.id || typeof r.id != "string" || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(r.id))
        throw new Error("Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)");
      if ((0, f.writePascalString)(e, r.id, 1), (0, f.writeInt32)(e, r.pageNumber || 1), (0, f.writeInt32)(e, r.totalPages || 1), (0, f.writeInt32)(e, 16), ne.indexOf(r.type) === -1)
        throw new Error("Invalid placedLayer type");
      (0, f.writeInt32)(e, ne.indexOf(r.type));
      for (let Z = 0; Z < 8; Z++)
        (0, f.writeFloat64)(e, r.transform[Z]);
      (0, f.writeInt32)(e, 0);
      const h = se(r), U = z(h) ? "quiltWarp" : "warp";
      (0, a.writeVersionAndDescriptor)(e, "", U, C(h), U);
    });
    function F(e) {
      return new Float32Array(e.buffer.slice(e.byteOffset), 0, e.byteLength / 4);
    }
    function N(e) {
      return new Uint32Array(e.buffer.slice(e.byteOffset), 0, e.byteLength / 4);
    }
    function J(e) {
      return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
    }
    function W(e) {
      const i = [];
      for (let r = 0; r < e.length; r += 2)
        i.push({ x: e[r], y: e[r + 1] });
      return i;
    }
    function n(e) {
      const i = [];
      for (let r = 0; r < e.length; r++)
        i.push(e[r].x, e[r].y);
      return i;
    }
    function p(e) {
      return W(F(e));
    }
    function g(e) {
      return {
        x: (0, a.parseUnits)(e.Hrzn),
        y: (0, a.parseUnits)(e.Vrtc)
      };
    }
    function E(e) {
      return {
        _name: "",
        _classID: "Pnt ",
        Hrzn: (0, a.unitsValue)(e.x, "x"),
        Vrtc: (0, a.unitsValue)(e.y, "y")
      };
    }
    function G(e, i) {
      const r = {
        name: e["Nm  "],
        opacity: (0, a.parsePercent)(e.blendOptions.Opct),
        blendMode: a.BlnM.decode(e.blendOptions["Md  "]),
        enabled: e.enab,
        hasOptions: e.hasoptions,
        foregroundColor: (0, a.parseColor)(e.FrgC),
        backgroundColor: (0, a.parseColor)(e.BckC)
      };
      if ("Fltr" in e)
        switch (e.Fltr._classID) {
          case "boxblur":
            return Object.assign(Object.assign({}, r), { type: "box blur", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "GsnB":
            return Object.assign(Object.assign({}, r), { type: "gaussian blur", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "MtnB":
            return Object.assign(Object.assign({}, r), { type: "motion blur", filter: {
              angle: e.Fltr.Angl,
              distance: (0, a.parseUnits)(e.Fltr.Dstn)
            } });
          case "RdlB":
            return Object.assign(Object.assign({}, r), { type: "radial blur", filter: {
              amount: e.Fltr.Amnt,
              method: a.BlrM.decode(e.Fltr.BlrM),
              quality: a.BlrQ.decode(e.Fltr.BlrQ)
            } });
          case "shapeBlur":
            return Object.assign(Object.assign({}, r), { type: "shape blur", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "]),
              customShape: { name: e.Fltr.customShape["Nm  "], id: e.Fltr.customShape.Idnt }
            } });
          case "SmrB":
            return Object.assign(Object.assign({}, r), { type: "smart blur", filter: {
              radius: e.Fltr["Rds "],
              threshold: e.Fltr.Thsh,
              quality: a.SmBQ.decode(e.Fltr.SmBQ),
              mode: a.SmBM.decode(e.Fltr.SmBM)
            } });
          case "surfaceBlur":
            return Object.assign(Object.assign({}, r), { type: "surface blur", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "]),
              threshold: e.Fltr.Thsh
            } });
          case "Dspl":
            return Object.assign(Object.assign({}, r), { type: "displace", filter: {
              horizontalScale: e.Fltr.HrzS,
              verticalScale: e.Fltr.VrtS,
              displacementMap: a.DspM.decode(e.Fltr.DspM),
              undefinedAreas: a.UndA.decode(e.Fltr.UndA),
              displacementFile: {
                signature: e.Fltr.DspF.sig,
                path: e.Fltr.DspF.path
                // TODO: this is decoded incorrectly ???
              }
            } });
          case "Pnch":
            return Object.assign(Object.assign({}, r), { type: "pinch", filter: {
              amount: e.Fltr.Amnt
            } });
          case "Plr ":
            return Object.assign(Object.assign({}, r), { type: "polar coordinates", filter: {
              conversion: a.Cnvr.decode(e.Fltr.Cnvr)
            } });
          case "Rple":
            return Object.assign(Object.assign({}, r), { type: "ripple", filter: {
              amount: e.Fltr.Amnt,
              size: a.RplS.decode(e.Fltr.RplS)
            } });
          case "Shr ":
            return Object.assign(Object.assign({}, r), { type: "shear", filter: {
              shearPoints: e.Fltr.ShrP.map((h) => ({ x: h.Hrzn, y: h.Vrtc })),
              shearStart: e.Fltr.ShrS,
              shearEnd: e.Fltr.ShrE,
              undefinedAreas: a.UndA.decode(e.Fltr.UndA)
            } });
          case "Sphr":
            return Object.assign(Object.assign({}, r), { type: "spherize", filter: {
              amount: e.Fltr.Amnt,
              mode: a.SphM.decode(e.Fltr.SphM)
            } });
          case "Twrl":
            return Object.assign(Object.assign({}, r), { type: "twirl", filter: {
              angle: e.Fltr.Angl
            } });
          case "Wave":
            return Object.assign(Object.assign({}, r), { type: "wave", filter: {
              numberOfGenerators: e.Fltr.NmbG,
              type: a.Wvtp.decode(e.Fltr.Wvtp),
              wavelength: { min: e.Fltr.WLMn, max: e.Fltr.WLMx },
              amplitude: { min: e.Fltr.AmMn, max: e.Fltr.AmMx },
              scale: { x: e.Fltr.SclH, y: e.Fltr.SclV },
              randomSeed: e.Fltr.RndS,
              undefinedAreas: a.UndA.decode(e.Fltr.UndA)
            } });
          case "ZgZg":
            return Object.assign(Object.assign({}, r), { type: "zigzag", filter: {
              amount: e.Fltr.Amnt,
              ridges: e.Fltr.NmbR,
              style: a.ZZTy.decode(e.Fltr.ZZTy)
            } });
          case "AdNs":
            return Object.assign(Object.assign({}, r), { type: "add noise", filter: {
              amount: (0, a.parsePercent)(e.Fltr.Nose),
              distribution: a.Dstr.decode(e.Fltr.Dstr),
              monochromatic: e.Fltr.Mnch,
              randomSeed: e.Fltr.FlRs
            } });
          case "DstS":
            return Object.assign(Object.assign({}, r), { type: "dust and scratches", filter: {
              radius: e.Fltr["Rds "],
              threshold: e.Fltr.Thsh
            } });
          case "Mdn ":
            return Object.assign(Object.assign({}, r), { type: "median", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "denoise":
            return Object.assign(Object.assign({}, r), { type: "reduce noise", filter: {
              preset: e.Fltr.preset,
              removeJpegArtifact: e.Fltr.removeJPEGArtifact,
              reduceColorNoise: (0, a.parsePercent)(e.Fltr.ClNs),
              sharpenDetails: (0, a.parsePercent)(e.Fltr.Shrp),
              channelDenoise: e.Fltr.channelDenoise.map((h) => Object.assign({ channels: h.Chnl.map(a.Chnl.decode), amount: h.Amnt }, h.EdgF ? { preserveDetails: h.EdgF } : {}))
            } });
          case "ClrH":
            return Object.assign(Object.assign({}, r), { type: "color halftone", filter: {
              radius: e.Fltr["Rds "],
              angle1: e.Fltr.Ang1,
              angle2: e.Fltr.Ang2,
              angle3: e.Fltr.Ang3,
              angle4: e.Fltr.Ang4
            } });
          case "Crst":
            return Object.assign(Object.assign({}, r), { type: "crystallize", filter: {
              cellSize: e.Fltr.ClSz,
              randomSeed: e.Fltr.FlRs
            } });
          case "Mztn":
            return Object.assign(Object.assign({}, r), { type: "mezzotint", filter: {
              type: a.MztT.decode(e.Fltr.MztT),
              randomSeed: e.Fltr.FlRs
            } });
          case "Msc ":
            return Object.assign(Object.assign({}, r), { type: "mosaic", filter: {
              cellSize: (0, a.parseUnits)(e.Fltr.ClSz)
            } });
          case "Pntl":
            return Object.assign(Object.assign({}, r), { type: "pointillize", filter: {
              cellSize: e.Fltr.ClSz,
              randomSeed: e.Fltr.FlRs
            } });
          case "Clds":
            return Object.assign(Object.assign({}, r), { type: "clouds", filter: {
              randomSeed: e.Fltr.FlRs
            } });
          case "DfrC":
            return Object.assign(Object.assign({}, r), { type: "difference clouds", filter: {
              randomSeed: e.Fltr.FlRs
            } });
          case "Fbrs":
            return Object.assign(Object.assign({}, r), { type: "fibers", filter: {
              variance: e.Fltr.Vrnc,
              strength: e.Fltr.Strg,
              randomSeed: e.Fltr.RndS
            } });
          case "LnsF":
            return Object.assign(Object.assign({}, r), { type: "lens flare", filter: {
              brightness: e.Fltr.Brgh,
              position: { x: e.Fltr.FlrC.Hrzn, y: e.Fltr.FlrC.Vrtc },
              lensType: a.Lns.decode(e.Fltr["Lns "])
            } });
          case "smartSharpen":
            return Object.assign(Object.assign({}, r), { type: "smart sharpen", filter: {
              amount: (0, a.parsePercent)(e.Fltr.Amnt),
              radius: (0, a.parseUnits)(e.Fltr["Rds "]),
              threshold: e.Fltr.Thsh,
              angle: e.Fltr.Angl,
              moreAccurate: e.Fltr.moreAccurate,
              blur: a.blurType.decode(e.Fltr.blur),
              preset: e.Fltr.preset,
              shadow: {
                fadeAmount: (0, a.parsePercent)(e.Fltr.sdwM.Amnt),
                tonalWidth: (0, a.parsePercent)(e.Fltr.sdwM.Wdth),
                radius: e.Fltr.sdwM["Rds "]
              },
              highlight: {
                fadeAmount: (0, a.parsePercent)(e.Fltr.hglM.Amnt),
                tonalWidth: (0, a.parsePercent)(e.Fltr.hglM.Wdth),
                radius: e.Fltr.hglM["Rds "]
              }
            } });
          case "UnsM":
            return Object.assign(Object.assign({}, r), { type: "unsharp mask", filter: {
              amount: (0, a.parsePercent)(e.Fltr.Amnt),
              radius: (0, a.parseUnits)(e.Fltr["Rds "]),
              threshold: e.Fltr.Thsh
            } });
          case "Dfs ":
            return Object.assign(Object.assign({}, r), { type: "diffuse", filter: {
              mode: a.DfsM.decode(e.Fltr["Md  "]),
              randomSeed: e.Fltr.FlRs
            } });
          case "Embs":
            return Object.assign(Object.assign({}, r), { type: "emboss", filter: {
              angle: e.Fltr.Angl,
              height: e.Fltr.Hght,
              amount: e.Fltr.Amnt
            } });
          case "Extr":
            return Object.assign(Object.assign({}, r), { type: "extrude", filter: {
              type: a.ExtT.decode(e.Fltr.ExtT),
              size: e.Fltr.ExtS,
              depth: e.Fltr.ExtD,
              depthMode: a.ExtR.decode(e.Fltr.ExtR),
              randomSeed: e.Fltr.FlRs,
              solidFrontFaces: e.Fltr.ExtF,
              maskIncompleteBlocks: e.Fltr.ExtM
            } });
          case "Tls ":
            return Object.assign(Object.assign({}, r), { type: "tiles", filter: {
              numberOfTiles: e.Fltr.TlNm,
              maximumOffset: e.Fltr.TlOf,
              fillEmptyAreaWith: a.FlCl.decode(e.Fltr.FlCl),
              randomSeed: e.Fltr.FlRs
            } });
          case "TrcC":
            return Object.assign(Object.assign({}, r), { type: "trace contour", filter: {
              level: e.Fltr["Lvl "],
              edge: a.CntE.decode(e.Fltr["Edg "])
            } });
          case "Wnd ":
            return Object.assign(Object.assign({}, r), { type: "wind", filter: {
              method: a.WndM.decode(e.Fltr.WndM),
              direction: a.Drct.decode(e.Fltr.Drct)
            } });
          case "Dntr":
            return Object.assign(Object.assign({}, r), { type: "de-interlace", filter: {
              eliminate: a.IntE.decode(e.Fltr.IntE),
              newFieldsBy: a.IntC.decode(e.Fltr.IntC)
            } });
          case "Cstm":
            return Object.assign(Object.assign({}, r), { type: "custom", filter: {
              scale: e.Fltr["Scl "],
              offset: e.Fltr.Ofst,
              matrix: e.Fltr.Mtrx
            } });
          case "HghP":
            return Object.assign(Object.assign({}, r), { type: "high pass", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "Mxm ":
            return Object.assign(Object.assign({}, r), { type: "maximum", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "Mnm ":
            return Object.assign(Object.assign({}, r), { type: "minimum", filter: {
              radius: (0, a.parseUnits)(e.Fltr["Rds "])
            } });
          case "Ofst":
            return Object.assign(Object.assign({}, r), { type: "offset", filter: {
              horizontal: e.Fltr.Hrzn,
              vertical: e.Fltr.Vrtc,
              undefinedAreas: a.FlMd.decode(e.Fltr["Fl  "])
            } });
          case "rigidTransform":
            return Object.assign(Object.assign({}, r), { type: "puppet", filter: {
              rigidType: e.Fltr.rigidType,
              bounds: [
                { x: e.Fltr.PuX0, y: e.Fltr.PuY0 },
                { x: e.Fltr.PuX1, y: e.Fltr.PuY1 },
                { x: e.Fltr.PuX2, y: e.Fltr.PuY2 },
                { x: e.Fltr.PuX3, y: e.Fltr.PuY3 }
              ],
              puppetShapeList: e.Fltr.puppetShapeList.map((h) => ({
                rigidType: h.rigidType,
                // TODO: VrsM
                // TODO: VrsN
                originalVertexArray: p(h.originalVertexArray),
                deformedVertexArray: p(h.deformedVertexArray),
                indexArray: Array.from(N(h.indexArray)),
                pinOffsets: W(h.pinOffsets),
                posFinalPins: W(h.posFinalPins),
                pinVertexIndices: h.pinVertexIndices,
                selectedPin: h.selectedPin,
                pinPosition: W(h.PinP),
                pinRotation: h.PnRt,
                pinOverlay: h.PnOv,
                pinDepth: h.PnDp,
                meshQuality: h.meshQuality,
                meshExpansion: h.meshExpansion,
                meshRigidity: h.meshRigidity,
                imageResolution: h.imageResolution,
                meshBoundaryPath: {
                  pathComponents: h.meshBoundaryPath.pathComponents.map((w) => ({
                    shapeOperation: w.shapeOperation.split(".")[1],
                    paths: w.SbpL.map((U) => ({
                      closed: U.Clsp,
                      points: U["Pts "].map((Z) => ({
                        anchor: g(Z.Anch),
                        forward: g(Z["Fwd "]),
                        backward: g(Z["Bwd "]),
                        smooth: Z.Smoo
                      }))
                    }))
                  }))
                }
              }))
            } });
          case "PbPl": {
            const h = [], w = e.Fltr;
            for (let U = 0; U < O.length && w[`PN${O[U]}a`]; U++)
              for (let Z = 0; Z < O.length && w[`PN${O[U]}${O[Z]}`]; Z++)
                h.push({
                  name: w[`PN${O[U]}${O[Z]}`],
                  value: w[`PF${O[U]}${O[Z]}`]
                });
            return Object.assign(Object.assign({}, r), { type: "oil paint plugin", filter: {
              name: e.Fltr.KnNm,
              gpu: e.Fltr.GpuY,
              lighting: e.Fltr.LIWy,
              parameters: h
            } });
          }
          // case 2089: return {
          // 	...base,
          // 	type: 'adaptive wide angle',
          // 	params: {
          // 		correction: prjM.decode(f.Fltr.prjM),
          // 		focalLength: f.Fltr.focL,
          // 		cropFactor: f.Fltr.CrpF,
          // 		imageScale: f.Fltr.imgS,
          // 		imageX: f.Fltr.imgX,
          // 		imageY: f.Fltr.imgY,
          // 	},
          // };
          case "HsbP":
            return Object.assign(Object.assign({}, r), { type: "hsb/hsl", filter: {
              inputMode: a.ClrS.decode(e.Fltr.Inpt),
              rowOrder: a.ClrS.decode(e.Fltr.Otpt)
            } });
          case "oilPaint":
            return Object.assign(Object.assign({}, r), { type: "oil paint", filter: {
              lightingOn: e.Fltr.lightingOn,
              stylization: e.Fltr.stylization,
              cleanliness: e.Fltr.cleanliness,
              brushScale: e.Fltr.brushScale,
              microBrush: e.Fltr.microBrush,
              lightDirection: e.Fltr.LghD,
              specularity: e.Fltr.specularity
            } });
          case "LqFy":
            return Object.assign(Object.assign({}, r), { type: "liquify", filter: {
              liquifyMesh: e.Fltr.LqMe
            } });
          case "perspectiveWarpTransform":
            return Object.assign(Object.assign({}, r), { type: "perspective warp", filter: {
              vertices: e.Fltr.vertices.map(g),
              warpedVertices: e.Fltr.warpedVertices.map(g),
              quads: e.Fltr.quads.map((h) => h.indices)
            } });
          case "Crvs":
            return Object.assign(Object.assign({}, r), { type: "curves", filter: Object.assign({ presetKind: a.presetKindType.decode(e.Fltr.presetKind) }, e.Fltr.Adjs ? {
              adjustments: e.Fltr.Adjs.map((h) => {
                const w = h.Chnl.map(a.Chnl.decode);
                if (h["Crv "])
                  return {
                    channels: w,
                    curve: h["Crv "].map((U) => {
                      const Z = { x: U.Hrzn, y: U.Vrtc };
                      return U.Cnty && (Z.curved = !0), Z;
                    })
                  };
                if (h.Mpng)
                  return { channels: w, values: h.Mpng };
                throw new Error("Unknown curve adjustment");
              })
            } : {}) });
          case "BrgC":
            return Object.assign(Object.assign({}, r), { type: "brightness/contrast", filter: {
              brightness: e.Fltr.Brgh,
              contrast: e.Fltr.Cntr,
              useLegacy: !!e.Fltr.useLegacy
            } });
          default:
            if (i.throwForMissingFeatures)
              throw new Error(`Unknown filter classId: ${e.Fltr._classID}`);
            return;
        }
      else
        switch (e.filterID) {
          case 1098281575:
            return Object.assign(Object.assign({}, r), { type: "average" });
          case 1114403360:
            return Object.assign(Object.assign({}, r), { type: "blur" });
          case 1114403405:
            return Object.assign(Object.assign({}, r), { type: "blur more" });
          case 1148416099:
            return Object.assign(Object.assign({}, r), { type: "despeckle" });
          case 1180922912:
            return Object.assign(Object.assign({}, r), { type: "facet" });
          case 1181902701:
            return Object.assign(Object.assign({}, r), { type: "fragment" });
          case 1399353968:
            return Object.assign(Object.assign({}, r), { type: "sharpen" });
          case 1399353925:
            return Object.assign(Object.assign({}, r), { type: "sharpen edges" });
          case 1399353933:
            return Object.assign(Object.assign({}, r), { type: "sharpen more" });
          case 1181639749:
            return Object.assign(Object.assign({}, r), { type: "find edges" });
          case 1399616122:
            return Object.assign(Object.assign({}, r), { type: "solarize" });
          case 1314149187:
            return Object.assign(Object.assign({}, r), { type: "ntsc colors" });
          case 1231976050:
            return Object.assign(Object.assign({}, r), { type: "invert" });
          default:
            if (i.throwForMissingFeatures)
              throw new Error(`Unknown filterID: ${e.filterID}`);
        }
    }
    function M(e, i) {
      return {
        enabled: e.enab,
        validAtPosition: e.validAtPosition,
        maskEnabled: e.filterMaskEnable,
        maskLinked: e.filterMaskLinked,
        maskExtendWithWhite: e.filterMaskExtendWithWhite,
        list: e.filterFXList.map((r) => G(r, i)).filter((r) => !!r)
      };
    }
    function re(e) {
      return (0, a.unitsValue)(e.radius, "radius");
    }
    function Q(e) {
      const i = {
        _name: "",
        _classID: "filterFX",
        "Nm  ": e.name,
        blendOptions: {
          _name: "",
          _classID: "blendOptions",
          Opct: (0, a.unitsPercentF)(e.opacity),
          "Md  ": a.BlnM.encode(e.blendMode)
        },
        enab: e.enabled,
        hasoptions: e.hasOptions,
        FrgC: (0, a.serializeColor)(e.foregroundColor),
        BckC: (0, a.serializeColor)(e.backgroundColor)
      };
      switch (e.type) {
        case "average":
          return Object.assign(Object.assign({}, i), { filterID: 1098281575 });
        case "blur":
          return Object.assign(Object.assign({}, i), { filterID: 1114403360 });
        case "blur more":
          return Object.assign(Object.assign({}, i), { filterID: 1114403405 });
        case "box blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Box Blur",
            _classID: "boxblur",
            "Rds ": re(e.filter)
          }, filterID: 697 });
        case "gaussian blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            // _name: '高斯模糊', // Testing
            _name: "Gaussian Blur",
            _classID: "GsnB",
            "Rds ": re(e.filter)
          }, filterID: 1198747202 });
        case "motion blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Motion Blur",
            _classID: "MtnB",
            Angl: e.filter.angle,
            Dstn: (0, a.unitsValue)(e.filter.distance, "distance")
          }, filterID: 1299476034 });
        case "radial blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Radial Blur",
            _classID: "RdlB",
            Amnt: e.filter.amount,
            BlrM: a.BlrM.encode(e.filter.method),
            BlrQ: a.BlrQ.encode(e.filter.quality)
          }, filterID: 1382313026 });
        case "shape blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Shape Blur",
            _classID: "shapeBlur",
            "Rds ": re(e.filter),
            customShape: {
              _name: "",
              _classID: "customShape",
              "Nm  ": e.filter.customShape.name,
              Idnt: e.filter.customShape.id
            }
          }, filterID: 702 });
        case "smart blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Smart Blur",
            _classID: "SmrB",
            "Rds ": e.filter.radius,
            Thsh: e.filter.threshold,
            SmBQ: a.SmBQ.encode(e.filter.quality),
            SmBM: a.SmBM.encode(e.filter.mode)
          }, filterID: 1399681602 });
        case "surface blur":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Surface Blur",
            _classID: "surfaceBlur",
            "Rds ": re(e.filter),
            Thsh: e.filter.threshold
          }, filterID: 701 });
        case "displace":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Displace",
            _classID: "Dspl",
            HrzS: e.filter.horizontalScale,
            VrtS: e.filter.verticalScale,
            DspM: a.DspM.encode(e.filter.displacementMap),
            UndA: a.UndA.encode(e.filter.undefinedAreas),
            DspF: {
              sig: e.filter.displacementFile.signature,
              path: e.filter.displacementFile.path
            }
          }, filterID: 1148416108 });
        case "pinch":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Pinch",
            _classID: "Pnch",
            Amnt: e.filter.amount
          }, filterID: 1349411688 });
        case "polar coordinates":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Polar Coordinates",
            _classID: "Plr ",
            Cnvr: a.Cnvr.encode(e.filter.conversion)
          }, filterID: 1349284384 });
        case "ripple":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Ripple",
            _classID: "Rple",
            Amnt: e.filter.amount,
            RplS: a.RplS.encode(e.filter.size)
          }, filterID: 1383099493 });
        case "shear":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Shear",
            _classID: "Shr ",
            ShrP: e.filter.shearPoints.map((r) => ({ _name: "", _classID: "Pnt ", Hrzn: r.x, Vrtc: r.y })),
            UndA: a.UndA.encode(e.filter.undefinedAreas),
            ShrS: e.filter.shearStart,
            ShrE: e.filter.shearEnd
          }, filterID: 1399353888 });
        case "spherize":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Spherize",
            _classID: "Sphr",
            Amnt: e.filter.amount,
            SphM: a.SphM.encode(e.filter.mode)
          }, filterID: 1399875698 });
        case "twirl":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Twirl",
            _classID: "Twrl",
            Angl: e.filter.angle
          }, filterID: 1417114220 });
        case "wave":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Wave",
            _classID: "Wave",
            Wvtp: a.Wvtp.encode(e.filter.type),
            NmbG: e.filter.numberOfGenerators,
            WLMn: e.filter.wavelength.min,
            WLMx: e.filter.wavelength.max,
            AmMn: e.filter.amplitude.min,
            AmMx: e.filter.amplitude.max,
            SclH: e.filter.scale.x,
            SclV: e.filter.scale.y,
            UndA: a.UndA.encode(e.filter.undefinedAreas),
            RndS: e.filter.randomSeed
          }, filterID: 1466005093 });
        case "zigzag":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "ZigZag",
            _classID: "ZgZg",
            Amnt: e.filter.amount,
            NmbR: e.filter.ridges,
            ZZTy: a.ZZTy.encode(e.filter.style)
          }, filterID: 1516722791 });
        case "add noise":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Add Noise",
            _classID: "AdNs",
            Dstr: a.Dstr.encode(e.filter.distribution),
            Nose: (0, a.unitsPercentF)(e.filter.amount),
            Mnch: e.filter.monochromatic,
            FlRs: e.filter.randomSeed
          }, filterID: 1097092723 });
        case "despeckle":
          return Object.assign(Object.assign({}, i), { filterID: 1148416099 });
        case "dust and scratches":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Dust & Scratches",
            _classID: "DstS",
            "Rds ": e.filter.radius,
            Thsh: e.filter.threshold
          }, filterID: 1148417107 });
        case "median":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Median",
            _classID: "Mdn ",
            "Rds ": re(e.filter)
          }, filterID: 1298427424 });
        case "reduce noise":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Reduce Noise",
            _classID: "denoise",
            ClNs: (0, a.unitsPercentF)(e.filter.reduceColorNoise),
            Shrp: (0, a.unitsPercentF)(e.filter.sharpenDetails),
            removeJPEGArtifact: e.filter.removeJpegArtifact,
            channelDenoise: e.filter.channelDenoise.map((r) => Object.assign({ _name: "", _classID: "channelDenoiseParams", Chnl: r.channels.map((h) => a.Chnl.encode(h)), Amnt: r.amount }, r.preserveDetails ? { EdgF: r.preserveDetails } : {})),
            preset: e.filter.preset
          }, filterID: 633 });
        case "color halftone":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Color Halftone",
            _classID: "ClrH",
            "Rds ": e.filter.radius,
            Ang1: e.filter.angle1,
            Ang2: e.filter.angle2,
            Ang3: e.filter.angle3,
            Ang4: e.filter.angle4
          }, filterID: 1131180616 });
        case "crystallize":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Crystallize",
            _classID: "Crst",
            ClSz: e.filter.cellSize,
            FlRs: e.filter.randomSeed
          }, filterID: 1131574132 });
        case "facet":
          return Object.assign(Object.assign({}, i), { filterID: 1180922912 });
        case "fragment":
          return Object.assign(Object.assign({}, i), { filterID: 1181902701 });
        case "mezzotint":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Mezzotint",
            _classID: "Mztn",
            MztT: a.MztT.encode(e.filter.type),
            FlRs: e.filter.randomSeed
          }, filterID: 1299870830 });
        case "mosaic":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Mosaic",
            _classID: "Msc ",
            ClSz: (0, a.unitsValue)(e.filter.cellSize, "cellSize")
          }, filterID: 1299407648 });
        case "pointillize":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Pointillize",
            _classID: "Pntl",
            ClSz: e.filter.cellSize,
            FlRs: e.filter.randomSeed
          }, filterID: 1349416044 });
        case "clouds":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Clouds",
            _classID: "Clds",
            FlRs: e.filter.randomSeed
          }, filterID: 1131177075 });
        case "difference clouds":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Difference Clouds",
            _classID: "DfrC",
            FlRs: e.filter.randomSeed
          }, filterID: 1147564611 });
        case "fibers":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Fibers",
            _classID: "Fbrs",
            Vrnc: e.filter.variance,
            Strg: e.filter.strength,
            RndS: e.filter.randomSeed
          }, filterID: 1180856947 });
        case "lens flare":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Lens Flare",
            _classID: "LnsF",
            Brgh: e.filter.brightness,
            FlrC: {
              _name: "",
              _classID: "Pnt ",
              Hrzn: e.filter.position.x,
              Vrtc: e.filter.position.y
            },
            "Lns ": a.Lns.encode(e.filter.lensType)
          }, filterID: 1282306886 });
        case "sharpen":
          return Object.assign(Object.assign({}, i), { filterID: 1399353968 });
        case "sharpen edges":
          return Object.assign(Object.assign({}, i), { filterID: 1399353925 });
        case "sharpen more":
          return Object.assign(Object.assign({}, i), { filterID: 1399353933 });
        case "smart sharpen":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Smart Sharpen",
            _classID: "smartSharpen",
            Amnt: (0, a.unitsPercentF)(e.filter.amount),
            "Rds ": re(e.filter),
            Thsh: e.filter.threshold,
            Angl: e.filter.angle,
            moreAccurate: e.filter.moreAccurate,
            blur: a.blurType.encode(e.filter.blur),
            preset: e.filter.preset,
            sdwM: {
              _name: "Parameters",
              _classID: "adaptCorrectTones",
              Amnt: (0, a.unitsPercentF)(e.filter.shadow.fadeAmount),
              Wdth: (0, a.unitsPercentF)(e.filter.shadow.tonalWidth),
              "Rds ": e.filter.shadow.radius
            },
            hglM: {
              _name: "Parameters",
              _classID: "adaptCorrectTones",
              Amnt: (0, a.unitsPercentF)(e.filter.highlight.fadeAmount),
              Wdth: (0, a.unitsPercentF)(e.filter.highlight.tonalWidth),
              "Rds ": e.filter.highlight.radius
            }
          }, filterID: 698 });
        case "unsharp mask":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Unsharp Mask",
            _classID: "UnsM",
            Amnt: (0, a.unitsPercentF)(e.filter.amount),
            "Rds ": re(e.filter),
            Thsh: e.filter.threshold
          }, filterID: 1433301837 });
        case "diffuse":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Diffuse",
            _classID: "Dfs ",
            "Md  ": a.DfsM.encode(e.filter.mode),
            FlRs: e.filter.randomSeed
          }, filterID: 1147564832 });
        case "emboss":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Emboss",
            _classID: "Embs",
            Angl: e.filter.angle,
            Hght: e.filter.height,
            Amnt: e.filter.amount
          }, filterID: 1164796531 });
        case "extrude":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Extrude",
            _classID: "Extr",
            ExtS: e.filter.size,
            ExtD: e.filter.depth,
            ExtF: e.filter.solidFrontFaces,
            ExtM: e.filter.maskIncompleteBlocks,
            ExtT: a.ExtT.encode(e.filter.type),
            ExtR: a.ExtR.encode(e.filter.depthMode),
            FlRs: e.filter.randomSeed
          }, filterID: 1165522034 });
        case "find edges":
          return Object.assign(Object.assign({}, i), { filterID: 1181639749 });
        case "solarize":
          return Object.assign(Object.assign({}, i), { filterID: 1399616122 });
        case "tiles":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Tiles",
            _classID: "Tls ",
            TlNm: e.filter.numberOfTiles,
            TlOf: e.filter.maximumOffset,
            FlCl: a.FlCl.encode(e.filter.fillEmptyAreaWith),
            FlRs: e.filter.randomSeed
          }, filterID: 1416393504 });
        case "trace contour":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Trace Contour",
            _classID: "TrcC",
            "Lvl ": e.filter.level,
            "Edg ": a.CntE.encode(e.filter.edge)
          }, filterID: 1416782659 });
        case "wind":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Wind",
            _classID: "Wnd ",
            WndM: a.WndM.encode(e.filter.method),
            Drct: a.Drct.encode(e.filter.direction)
          }, filterID: 1466852384 });
        case "de-interlace":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "De-Interlace",
            _classID: "Dntr",
            IntE: a.IntE.encode(e.filter.eliminate),
            IntC: a.IntC.encode(e.filter.newFieldsBy)
          }, filterID: 1148089458 });
        case "ntsc colors":
          return Object.assign(Object.assign({}, i), { filterID: 1314149187 });
        case "invert":
          return Object.assign(Object.assign({}, i), { filterID: 1231976050 });
        case "custom":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Custom",
            _classID: "Cstm",
            "Scl ": e.filter.scale,
            Ofst: e.filter.offset,
            Mtrx: e.filter.matrix
          }, filterID: 1131639917 });
        case "high pass":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "High Pass",
            _classID: "HghP",
            "Rds ": re(e.filter)
          }, filterID: 1214736464 });
        case "maximum":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Maximum",
            _classID: "Mxm ",
            "Rds ": re(e.filter)
          }, filterID: 1299737888 });
        case "minimum":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Minimum",
            _classID: "Mnm ",
            "Rds ": re(e.filter)
          }, filterID: 1299082528 });
        case "offset":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Offset",
            _classID: "Ofst",
            Hrzn: e.filter.horizontal,
            Vrtc: e.filter.vertical,
            "Fl  ": a.FlMd.encode(e.filter.undefinedAreas)
          }, filterID: 1332114292 });
        case "puppet":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Rigid Transform",
            _classID: "rigidTransform",
            null: ["Ordn.Trgt"],
            // TODO: ???
            rigidType: e.filter.rigidType,
            puppetShapeList: e.filter.puppetShapeList.map((r) => ({
              _name: "",
              _classID: "puppetShape",
              rigidType: r.rigidType,
              VrsM: 1,
              // TODO: ???
              VrsN: 0,
              // TODO: ???
              originalVertexArray: J(new Float32Array(n(r.originalVertexArray))),
              deformedVertexArray: J(new Float32Array(n(r.deformedVertexArray))),
              indexArray: J(new Uint32Array(r.indexArray)),
              pinOffsets: n(r.pinOffsets),
              posFinalPins: n(r.posFinalPins),
              pinVertexIndices: r.pinVertexIndices,
              PinP: n(r.pinPosition),
              PnRt: r.pinRotation,
              PnOv: r.pinOverlay,
              PnDp: r.pinDepth,
              meshQuality: r.meshQuality,
              meshExpansion: r.meshExpansion,
              meshRigidity: r.meshRigidity,
              imageResolution: r.imageResolution,
              meshBoundaryPath: {
                _name: "",
                _classID: "pathClass",
                pathComponents: r.meshBoundaryPath.pathComponents.map((h) => ({
                  _name: "",
                  _classID: "PaCm",
                  shapeOperation: `shapeOperation.${h.shapeOperation}`,
                  SbpL: h.paths.map((w) => ({
                    _name: "",
                    _classID: "Sbpl",
                    Clsp: w.closed,
                    "Pts ": w.points.map((U) => ({
                      _name: "",
                      _classID: "Pthp",
                      Anch: E(U.anchor),
                      "Fwd ": E(U.forward),
                      "Bwd ": E(U.backward),
                      Smoo: U.smooth
                    }))
                  }))
                }))
              },
              selectedPin: r.selectedPin
            })),
            PuX0: e.filter.bounds[0].x,
            PuX1: e.filter.bounds[1].x,
            PuX2: e.filter.bounds[2].x,
            PuX3: e.filter.bounds[3].x,
            PuY0: e.filter.bounds[0].y,
            PuY1: e.filter.bounds[1].y,
            PuY2: e.filter.bounds[2].y,
            PuY3: e.filter.bounds[3].y
          }, filterID: 991 });
        case "oil paint plugin": {
          const r = {};
          for (let h = 0; h < e.filter.parameters.length; h++) {
            const { name: w, value: U } = e.filter.parameters[h], Z = `${O[Math.floor(h / O.length)]}${O[h % O.length]}`;
            r[`PN${Z}`] = w, r[`PT${Z}`] = 0, r[`PF${Z}`] = U;
          }
          return Object.assign(Object.assign({}, i), { Fltr: Object.assign({ _name: "Oil Paint Plugin", _classID: "PbPl", KnNm: e.filter.name, GpuY: e.filter.gpu, LIWy: e.filter.lighting, FPth: "1" }, r), filterID: 1348620396 });
        }
        case "oil paint":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Oil Paint",
            _classID: "oilPaint",
            lightingOn: e.filter.lightingOn,
            stylization: e.filter.stylization,
            cleanliness: e.filter.cleanliness,
            brushScale: e.filter.brushScale,
            microBrush: e.filter.microBrush,
            LghD: e.filter.lightDirection,
            specularity: e.filter.specularity
          }, filterID: 1122 });
        case "liquify":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Liquify",
            _classID: "LqFy",
            LqMe: e.filter.liquifyMesh
          }, filterID: 1282492025 });
        case "perspective warp":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Perspective Warp",
            _classID: "perspectiveWarpTransform",
            vertices: e.filter.vertices.map(E),
            warpedVertices: e.filter.warpedVertices.map(E),
            quads: e.filter.quads.map((r) => ({ indices: r }))
          }, filterID: 442 });
        case "curves":
          return Object.assign(Object.assign({}, i), { Fltr: Object.assign({ _name: "Curves", _classID: "Crvs", presetKind: a.presetKindType.encode(e.filter.presetKind) }, e.filter.adjustments ? {
            Adjs: e.filter.adjustments.map((r) => "curve" in r ? {
              _name: "",
              _classID: "CrvA",
              Chnl: r.channels.map(a.Chnl.encode),
              "Crv ": r.curve.map((h) => Object.assign({ _name: "", _classID: "Pnt ", Hrzn: h.x, Vrtc: h.y }, h.curved ? { Cnty: !0 } : {}))
            } : {
              _name: "",
              _classID: "CrvA",
              Chnl: r.channels.map(a.Chnl.encode),
              Mpng: r.values
            })
          } : {}), filterID: 1131574899 });
        case "brightness/contrast":
          return Object.assign(Object.assign({}, i), { Fltr: {
            _name: "Brightness/Contrast",
            _classID: "BrgC",
            Brgh: e.filter.brightness,
            Cntr: e.filter.contrast,
            useLegacy: !!e.filter.useLegacy
          }, filterID: 1114793795 });
        // case 'hsb/hsl': return {
        // TODO: ...
        // };
        default:
          throw new Error(`Unknow filter type: ${e.type}`);
      }
    }
    function se(e) {
      if (e.warp)
        return e.warp;
      if (!e.width || !e.height)
        throw new Error("You must provide width and height of the linked image in placedLayer");
      const i = e.width, r = e.height, h = 0, w = i / 3, U = i * 2 / 3, Z = i, d = 0, L = r / 3, o = r * 2 / 3, _ = r;
      return {
        style: "custom",
        value: 0,
        perspective: 0,
        perspectiveOther: 0,
        rotate: "horizontal",
        bounds: {
          top: { value: 0, units: "Pixels" },
          left: { value: 0, units: "Pixels" },
          bottom: { value: r, units: "Pixels" },
          right: { value: i, units: "Pixels" }
        },
        uOrder: 4,
        vOrder: 4,
        customEnvelopeWarp: {
          meshPoints: [
            { x: h, y: d },
            { x: w, y: d },
            { x: U, y: d },
            { x: Z, y: d },
            { x: h, y: L },
            { x: w, y: L },
            { x: U, y: L },
            { x: Z, y: L },
            { x: h, y: o },
            { x: w, y: o },
            { x: U, y: o },
            { x: Z, y: o },
            { x: h, y: _ },
            { x: w, y: _ },
            { x: U, y: _ },
            { x: Z, y: _ }
          ]
        }
      };
    }
    y("SoLd", V("placedLayer"), (e, i, r) => {
      if ((0, l.readSignature)(e) !== "soLD")
        throw new Error("Invalid SoLd type");
      const h = (0, l.readInt32)(e);
      if (h !== 4 && h !== 5)
        throw new Error("Invalid SoLd version");
      const w = (0, a.readVersionAndDescriptor)(e, !0);
      i.placedLayer = {
        id: w.Idnt,
        placed: w.placed,
        type: ne[w.Type],
        pageNumber: w.PgNm,
        totalPages: w.totalPages,
        frameStep: (0, a.frac)(w.frameStep),
        duration: (0, a.frac)(w.duration),
        frameCount: w.frameCount,
        transform: w.Trnf,
        width: w["Sz  "].Wdth,
        height: w["Sz  "].Hght,
        resolution: (0, a.parseUnits)(w.Rslt),
        warp: B(w.quiltWarp || w.warp)
      }, w.nonAffineTransform && w.nonAffineTransform.some((U, Z) => U !== w.Trnf[Z]) && (i.placedLayer.nonAffineTransform = w.nonAffineTransform), w.Crop && (i.placedLayer.crop = w.Crop), w.comp && (i.placedLayer.comp = w.comp), w.compInfo && (i.placedLayer.compInfo = {
        compID: w.compInfo.compID,
        originalCompID: w.compInfo.originalCompID
      }), w.filterFX && (i.placedLayer.filter = M(w.filterFX, e)), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r, h;
      (0, f.writeSignature)(e, "soLD"), (0, f.writeInt32)(e, 4);
      const w = i.placedLayer;
      if (!w.id || typeof w.id != "string" || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(w.id))
        throw new Error("Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)");
      const U = Object.assign(Object.assign({ Idnt: w.id, placed: (r = w.placed) !== null && r !== void 0 ? r : w.id, PgNm: w.pageNumber || 1, totalPages: w.totalPages || 1 }, w.crop ? { Crop: w.crop } : {}), {
        frameStep: w.frameStep || { numerator: 0, denominator: 600 },
        duration: w.duration || { numerator: 0, denominator: 600 },
        frameCount: w.frameCount || 0,
        Annt: 16,
        Type: ne.indexOf(w.type),
        Trnf: w.transform,
        nonAffineTransform: (h = w.nonAffineTransform) !== null && h !== void 0 ? h : w.transform,
        // quiltWarp: {} as any,
        warp: C(se(w)),
        "Sz  ": {
          _name: "",
          _classID: "Pnt ",
          Wdth: w.width || 0,
          // TODO: find size ?
          Hght: w.height || 0
          // TODO: find size ?
        },
        Rslt: w.resolution ? (0, a.unitsValue)(w.resolution, "resolution") : { units: "Density", value: 72 }
      });
      if (w.filter && (U.filterFX = {
        _name: "",
        _classID: "filterFXStyle",
        enab: w.filter.enabled,
        validAtPosition: w.filter.validAtPosition,
        filterMaskEnable: w.filter.maskEnabled,
        filterMaskLinked: w.filter.maskLinked,
        filterMaskExtendWithWhite: w.filter.maskExtendWithWhite,
        filterFXList: w.filter.list.map((Z) => Q(Z))
      }), w.warp && z(w.warp)) {
        const Z = C(w.warp);
        U.quiltWarp = Z, U.warp = {
          warpStyle: "warpStyle.warpNone",
          warpValue: Z.warpValue,
          warpPerspective: Z.warpPerspective,
          warpPerspectiveOther: Z.warpPerspectiveOther,
          warpRotate: Z.warpRotate,
          bounds: Z.bounds,
          uOrder: Z.uOrder,
          vOrder: Z.vOrder
        };
      } else
        delete U.quiltWarp;
      w.comp && (U.comp = w.comp), w.compInfo && (U.compInfo = w.compInfo), (0, a.writeVersionAndDescriptor)(e, "", "null", U, U.quiltWarp ? "quiltWarp" : "warp");
    }), H("SoLE", "SoLd"), y("fxrp", V("referencePoint"), (e, i) => {
      i.referencePoint = {
        x: (0, l.readFloat64)(e),
        y: (0, l.readFloat64)(e)
      };
    }, (e, i) => {
      (0, f.writeFloat64)(e, i.referencePoint.x), (0, f.writeFloat64)(e, i.referencePoint.y);
    }), y("Lr16", () => !1, (e, i, r, h, w) => {
      (0, l.readLayerInfo)(e, h, w);
    }, (e, i) => {
    }), y("Lr32", () => !1, (e, i, r, h, w) => {
      (0, l.readLayerInfo)(e, h, w);
    }, (e, i) => {
    }), y("LMsk", V("userMask"), (e, i) => {
      if (i.userMask = {
        colorSpace: (0, l.readColor)(e),
        opacity: (0, l.readUint16)(e) / 255
      }, (0, l.readUint8)(e) !== 128)
        throw new Error("Invalid flag value");
      (0, l.skipBytes)(e, 1);
    }, (e, i) => {
      const r = i.userMask;
      (0, f.writeColor)(e, r.colorSpace), (0, f.writeUint16)(e, (0, S.clamp)(r.opacity, 0, 1) * 255), (0, f.writeUint8)(e, 128), (0, f.writeZeros)(e, 1);
    }), S.MOCK_HANDLERS ? y("Patt", (e) => e._Patt !== void 0, (e, i, r) => {
      i._Patt = (0, l.readBytes)(e, r());
    }, (e, i) => !1) : y(
      "Patt",
      // TODO: handle also Pat2 & Pat3
      // TODO: handle also Pat2 & Pat3
      (e) => !!(e.patterns && e.patterns.length > 0),
      (e, i, r) => {
        for (; r() > 0; ) {
          const h = (0, l.readPattern)(e);
          i.patterns === void 0 && (i.patterns = []), i.patterns.push(h);
        }
      },
      (e, i, r, h) => {
        const w = i.patterns || [];
        for (const U of w)
          (0, f.writePattern)(e, U);
      }
    ), H("Pat2", "Patt"), H("Pat3", "Patt"), S.MOCK_HANDLERS && y(
      "CAI ",
      // Content Authenticity Initiative / C2PA provenance metadata
      // Content Authenticity Initiative / C2PA provenance metadata
      (e) => e._CAI_ !== void 0,
      (e, i, r) => {
        i._CAI_ = (0, l.readBytes)(e, r());
      },
      (e, i) => {
        (0, f.writeBytes)(e, i._CAI_);
      }
    ), S.MOCK_HANDLERS && y(
      "OCIO",
      // Document color management info
      // Document color management info
      (e) => e._OCIO !== void 0,
      (e, i, r) => {
        i._OCIO = (0, l.readBytes)(e, r());
      },
      (e, i) => {
        (0, f.writeBytes)(e, i._OCIO);
      }
    ), S.MOCK_HANDLERS && y(
      "GenI",
      // Generative Fill / generative AI (Firefly) features
      // Generative Fill / generative AI (Firefly) features
      (e) => e._GenI !== void 0,
      (e, i, r) => {
        i._GenI = (0, l.readBytes)(e, r());
      },
      (e, i) => {
        (0, f.writeBytes)(e, i._GenI);
      }
    );
    function me(e) {
      const i = (0, l.readInt32)(e), r = (0, l.readInt32)(e), h = (0, l.readInt32)(e), w = (0, l.readInt32)(e);
      return { top: i, left: r, bottom: h, right: w };
    }
    function te(e, i) {
      (0, f.writeInt32)(e, i.top), (0, f.writeInt32)(e, i.left), (0, f.writeInt32)(e, i.bottom), (0, f.writeInt32)(e, i.right);
    }
    y("Anno", (e) => e.annotations !== void 0, (e, i, r) => {
      const h = (0, l.readUint16)(e), w = (0, l.readUint16)(e);
      if (h !== 2 || w !== 1)
        throw new Error("Invalid Anno version");
      const U = (0, l.readUint32)(e), Z = [];
      for (let d = 0; d < U; d++) {
        (0, l.readUint32)(e);
        const L = (0, l.readSignature)(e), o = !!(0, l.readUint8)(e);
        (0, l.readUint8)(e), (0, l.readUint16)(e);
        const _ = me(e), I = me(e), x = (0, l.readColor)(e), b = (0, l.readPascalString)(e, 2), X = (0, l.readPascalString)(e, 2), u = (0, l.readPascalString)(e, 2);
        (0, l.readUint32)(e), (0, l.readSignature)(e);
        const $ = (0, l.readUint32)(e);
        let be;
        if (L === "txtA")
          $ >= 2 && (0, l.readUint16)(e) === 65279 ? be = (0, l.readUnicodeStringWithLength)(e, ($ - 2) / 2) : (e.offset -= 2, be = (0, l.readAsciiString)(e, $)), be = be.replace(/\r/g, `
`);
        else if (L === "sndA")
          be = (0, l.readBytes)(e, $);
        else
          throw new Error("Unknown annotation type");
        Z.push({
          type: L === "txtA" ? "text" : "sound",
          open: o,
          iconLocation: _,
          popupLocation: I,
          color: x,
          author: b,
          name: X,
          date: u,
          data: be
        });
      }
      i.annotations = Z, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.annotations;
      (0, f.writeUint16)(e, 2), (0, f.writeUint16)(e, 1), (0, f.writeUint32)(e, r.length);
      for (const h of r) {
        const w = h.type === "sound";
        if (w && !(h.data instanceof Uint8Array))
          throw new Error("Sound annotation data should be Uint8Array");
        if (!w && typeof h.data != "string")
          throw new Error("Text annotation data should be string");
        const U = e.offset;
        (0, f.writeUint32)(e, 0), (0, f.writeSignature)(e, w ? "sndA" : "txtA"), (0, f.writeUint8)(e, h.open ? 1 : 0), (0, f.writeUint8)(e, 28), (0, f.writeUint16)(e, 1), te(e, h.iconLocation), te(e, h.popupLocation), (0, f.writeColor)(e, h.color), (0, f.writePascalString)(e, h.author || "", 2), (0, f.writePascalString)(e, h.name || "", 2), (0, f.writePascalString)(e, h.date || "", 2);
        const Z = e.offset;
        (0, f.writeUint32)(e, 0), (0, f.writeSignature)(e, w ? "sndM" : "txtC"), (0, f.writeUint32)(e, 0);
        const d = e.offset;
        if (w)
          (0, f.writeBytes)(e, h.data);
        else {
          (0, f.writeUint16)(e, 65279);
          const L = h.data.replace(/\n/g, "\r");
          for (let o = 0; o < L.length; o++)
            (0, f.writeUint16)(e, L.charCodeAt(o));
        }
        e.view.setUint32(U, e.offset - U, !1), e.view.setUint32(Z, e.offset - Z, !1), e.view.setUint32(d - 4, e.offset - d, !1);
      }
    });
    function ve(e) {
      y(e, (i) => {
        const r = i;
        return !(!r.linkedFiles || !r.linkedFiles.length || e === "lnkE" && !r.linkedFiles.some((h) => h.linkedFile));
      }, (i, r, h, w) => {
        const U = r;
        for (U.linkedFiles = U.linkedFiles || []; h() > 8; ) {
          let Z = le(i);
          const d = i.offset, L = (0, l.readSignature)(i), o = (0, l.readInt32)(i), _ = (0, l.readPascalString)(i, 1), I = (0, l.readUnicodeString)(i), x = (0, l.readSignature)(i).trim(), b = (0, l.readSignature)(i).trim(), X = le(i), $ = (0, l.readUint8)(i) ? (0, a.readVersionAndDescriptor)(i) : void 0, be = L === "liFE" ? (0, a.readVersionAndDescriptor)(i) : void 0, ge = { id: _, name: I };
          if (x && (ge.type = x), b && (ge.creator = b), $ && (ge.descriptor = {
            compInfo: {
              compID: $.compInfo.compID,
              originalCompID: $.compInfo.originalCompID
            }
          }), L === "liFE" && o > 3) {
            const De = (0, l.readInt32)(i), Ne = (0, l.readUint8)(i), s = (0, l.readUint8)(i), D = (0, l.readUint8)(i), ae = (0, l.readUint8)(i), K = (0, l.readFloat64)(i), t = Math.floor(K), T = (K - t) * 1e3;
            ge.time = new Date(Date.UTC(De, Ne, s, D, ae, t, T)).toISOString();
          }
          const Ce = L === "liFE" ? le(i) : 0;
          for (L === "liFA" && (0, l.skipBytes)(i, 8), L === "liFD" && (ge.data = (0, l.readBytes)(i, X)), o >= 5 && (ge.childDocumentID = (0, l.readUnicodeString)(i)), o >= 6 && (ge.assetModTime = (0, l.readFloat64)(i)), o >= 7 && (ge.assetLockedState = (0, l.readUint8)(i)), L === "liFE" && o === 2 && (ge.data = (0, l.readBytes)(i, Ce)), i.skipLinkedFilesData && (ge.data = void 0), e === "lnkE" && (ge.linkedFile = {
            fileSize: Ce,
            name: (be == null ? void 0 : be["Nm  "]) || "",
            fullPath: (be == null ? void 0 : be.fullPath) || "",
            originalPath: (be == null ? void 0 : be.originalPath) || "",
            relativePath: (be == null ? void 0 : be.relPath) || ""
          }), U.linkedFiles.push(ge); Z % 4; )
            Z++;
          i.offset = d + Z;
        }
        (0, l.skipBytes)(i, h());
      }, (i, r) => {
        var h, w, U, Z, d, L, o, _, I;
        const x = r;
        for (const b of x.linkedFiles) {
          if (e === "lnkE" != !!b.linkedFile)
            continue;
          let X = 2;
          b.assetLockedState != null ? X = 7 : b.assetModTime != null ? X = 6 : b.childDocumentID != null ? X = 5 : e === "lnkE" && (X = 3), ce(i, 0);
          const u = i.offset;
          if ((0, f.writeSignature)(i, e === "lnkE" ? "liFE" : b.data ? "liFD" : "liFA"), (0, f.writeInt32)(i, X), !b.id || typeof b.id != "string" || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(b.id))
            throw new Error("Linked file ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)");
          if ((0, f.writePascalString)(i, b.id, 1), (0, f.writeUnicodeStringWithPadding)(i, b.name || ""), (0, f.writeSignature)(i, b.type ? `${b.type}    `.substring(0, 4) : "    "), (0, f.writeSignature)(i, b.creator ? `${b.creator}    `.substring(0, 4) : "\0\0\0\0"), ce(i, b.data ? b.data.byteLength : 0), b.descriptor && b.descriptor.compInfo) {
            const be = {
              compInfo: {
                compID: b.descriptor.compInfo.compID,
                originalCompID: b.descriptor.compInfo.originalCompID
              }
            };
            (0, f.writeUint8)(i, 1), (0, a.writeVersionAndDescriptor)(i, "", "null", be);
          } else
            (0, f.writeUint8)(i, 0);
          if (e === "lnkE") {
            const be = {
              descVersion: 2,
              "Nm  ": (w = (h = b.linkedFile) === null || h === void 0 ? void 0 : h.name) !== null && w !== void 0 ? w : "",
              fullPath: (Z = (U = b.linkedFile) === null || U === void 0 ? void 0 : U.fullPath) !== null && Z !== void 0 ? Z : "",
              originalPath: (L = (d = b.linkedFile) === null || d === void 0 ? void 0 : d.originalPath) !== null && L !== void 0 ? L : "",
              relPath: (_ = (o = b.linkedFile) === null || o === void 0 ? void 0 : o.relativePath) !== null && _ !== void 0 ? _ : ""
            };
            (0, a.writeVersionAndDescriptor)(i, "", "ExternalFileLink", be);
            const ge = b.time ? new Date(b.time) : /* @__PURE__ */ new Date();
            (0, f.writeInt32)(i, ge.getUTCFullYear()), (0, f.writeUint8)(i, ge.getUTCMonth()), (0, f.writeUint8)(i, ge.getUTCDate()), (0, f.writeUint8)(i, ge.getUTCHours()), (0, f.writeUint8)(i, ge.getUTCMinutes()), (0, f.writeFloat64)(i, ge.getUTCSeconds() + ge.getUTCMilliseconds() / 1e3);
          }
          b.data ? (0, f.writeBytes)(i, b.data) : ce(i, ((I = b.linkedFile) === null || I === void 0 ? void 0 : I.fileSize) || 0), X >= 5 && (0, f.writeUnicodeStringWithPadding)(i, b.childDocumentID || ""), X >= 6 && (0, f.writeFloat64)(i, b.assetModTime || 0), X >= 7 && (0, f.writeUint8)(i, b.assetLockedState || 0);
          let $ = i.offset - u;
          for (i.view.setUint32(u - 4, $, !1); $ % 4; )
            $++, (0, f.writeUint8)(i, 0);
        }
      });
    }
    ve("lnk2"), ve("lnkE"), H("lnkD", "lnk2"), H("lnk3", "lnk2"), y("pths", V("pathList"), (e, i) => {
      (0, a.readVersionAndDescriptor)(e, !0), i.pathList = [];
    }, (e, i) => {
      const r = {
        pathList: []
        // TODO: write paths
      };
      (0, a.writeVersionAndDescriptor)(e, "", "pathsDataClass", r);
    }), y("lyvr", V("version"), (e, i) => i.version = (0, l.readUint32)(e), (e, i) => (0, f.writeUint32)(e, i.version)), y(
      "lfxs",
      () => !1,
      // TODO: not sure when we actually need to write this section
      // NOTE: this might be insufficient
      // target => target.effects !== undefined && (
      // 	!!target.effects.dropShadow?.some(e => e.choke) ||
      // 	!!target.effects.innerShadow?.some(e => e.choke) ||
      // 	!!target.effects.outerGlow?.choke ||
      // 	!!target.effects.innerGlow?.choke
      // ),
      (e, i, r) => {
        if ((0, l.readUint32)(e) !== 0)
          throw new Error("Invalid lfxs version");
        const w = (0, a.readVersionAndDescriptor)(e);
        i.effects = (0, a.parseEffects)(w, !!e.logMissingFeatures), (0, l.skipBytes)(e, r());
      },
      (e, i, r, h) => {
        const w = (0, a.serializeEffects)(i.effects, !!h.logMissingFeatures, !0);
        (0, f.writeUint32)(e, 0), (0, a.writeVersionAndDescriptor)(e, "", "null", w);
      }
    );
    function ue(e) {
      return (i) => !!i.adjustment && i.adjustment.type === e;
    }
    y("brit", ue("brightness/contrast"), (e, i, r) => {
      i.adjustment || (i.adjustment = {
        type: "brightness/contrast",
        brightness: (0, l.readInt16)(e),
        contrast: (0, l.readInt16)(e),
        meanValue: (0, l.readInt16)(e),
        labColorOnly: !!(0, l.readUint8)(e),
        useLegacy: !0
      }), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r;
      const h = i.adjustment;
      (0, f.writeInt16)(e, h.brightness || 0), (0, f.writeInt16)(e, h.contrast || 0), (0, f.writeInt16)(e, (r = h.meanValue) !== null && r !== void 0 ? r : 127), (0, f.writeUint8)(e, h.labColorOnly ? 1 : 0), (0, f.writeZeros)(e, 1);
    });
    function Fe(e) {
      const i = (0, l.readInt16)(e), r = (0, l.readInt16)(e), h = (0, l.readInt16)(e), w = (0, l.readInt16)(e), U = (0, l.readInt16)(e) / 100;
      return { shadowInput: i, highlightInput: r, shadowOutput: h, highlightOutput: w, midtoneInput: U };
    }
    function _e(e, i) {
      (0, f.writeInt16)(e, i.shadowInput), (0, f.writeInt16)(e, i.highlightInput), (0, f.writeInt16)(e, i.shadowOutput), (0, f.writeInt16)(e, i.highlightOutput), (0, f.writeInt16)(e, Math.round(i.midtoneInput * 100));
    }
    y("levl", ue("levels"), (e, i, r) => {
      if ((0, l.readUint16)(e) !== 2)
        throw new Error("Invalid levl version");
      const h = [];
      for (let L = 0; L < 29 && r(); L++)
        h.push(Fe(e));
      const [w, U, Z, d] = h;
      if (i.adjustment = Object.assign(Object.assign({}, i.adjustment), {
        type: "levels",
        rgb: w,
        red: U,
        green: Z,
        blue: d
      }), r()) {
        if ((0, l.readSignature)(e) !== "Lvls")
          throw new Error("Invalid levl signature");
        if ((0, l.readUint16)(e) !== 3)
          throw new Error("Invalid levl version");
        const L = (0, l.readUint16)(e);
        for (let o = 0; o < L - h.length && r(); o++)
          h.push(Fe(e));
      }
      (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment, h = {
        shadowInput: 0,
        highlightInput: 255,
        shadowOutput: 0,
        highlightOutput: 255,
        midtoneInput: 1
      };
      (0, f.writeUint16)(e, 2), _e(e, r.rgb || h), _e(e, r.red || h), _e(e, r.green || h), _e(e, r.blue || h);
      for (let w = 0; w < 25; w++)
        _e(e, h);
      (0, f.writeSignature)(e, "Lvls"), (0, f.writeUint16)(e, 3), (0, f.writeUint16)(e, 62);
      for (let w = 0; w < 33; w++)
        _e(e, h);
    });
    function Oe(e) {
      const i = (0, l.readUint16)(e), r = [];
      for (let h = 0; h < i; h++) {
        const w = (0, l.readInt16)(e), U = (0, l.readInt16)(e);
        r.push({ input: U, output: w });
      }
      return r;
    }
    function Ie(e, i) {
      (0, f.writeUint16)(e, i.length);
      for (const r of i)
        (0, f.writeUint16)(e, r.output), (0, f.writeUint16)(e, r.input);
    }
    y("curv", ue("curves"), (e, i, r) => {
      if ((0, l.readUint8)(e), (0, l.readUint16)(e) !== 1)
        throw new Error("Invalid curv version");
      (0, l.readUint16)(e);
      const h = (0, l.readUint16)(e), w = { type: "curves" };
      h & 1 && (w.rgb = Oe(e)), h & 2 && (w.red = Oe(e)), h & 4 && (w.green = Oe(e)), h & 8 && (w.blue = Oe(e)), i.adjustment = Object.assign(Object.assign({}, i.adjustment), w), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment, { rgb: h, red: w, green: U, blue: Z } = r;
      let d = 0, L = 0;
      h && h.length && (d |= 1, L++), w && w.length && (d |= 2, L++), U && U.length && (d |= 4, L++), Z && Z.length && (d |= 8, L++), (0, f.writeUint8)(e, 0), (0, f.writeUint16)(e, 1), (0, f.writeUint16)(e, 0), (0, f.writeUint16)(e, d), h && h.length && Ie(e, h), w && w.length && Ie(e, w), U && U.length && Ie(e, U), Z && Z.length && Ie(e, Z), (0, f.writeSignature)(e, "Crv "), (0, f.writeUint16)(e, 4), (0, f.writeUint16)(e, 0), (0, f.writeUint16)(e, L), h && h.length && ((0, f.writeUint16)(e, 0), Ie(e, h)), w && w.length && ((0, f.writeUint16)(e, 1), Ie(e, w)), U && U.length && ((0, f.writeUint16)(e, 2), Ie(e, U)), Z && Z.length && ((0, f.writeUint16)(e, 3), Ie(e, Z));
    }), y("expA", ue("exposure"), (e, i, r) => {
      if ((0, l.readUint16)(e) !== 1)
        throw new Error("Invalid expA version");
      i.adjustment = Object.assign(Object.assign({}, i.adjustment), { type: "exposure", exposure: (0, l.readFloat32)(e), offset: (0, l.readFloat32)(e), gamma: (0, l.readFloat32)(e) }), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment;
      (0, f.writeUint16)(e, 1), (0, f.writeFloat32)(e, r.exposure), (0, f.writeFloat32)(e, r.offset), (0, f.writeFloat32)(e, r.gamma), (0, f.writeZeros)(e, 2);
    }), y("vibA", ue("vibrance"), (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      i.adjustment = { type: "vibrance" }, h.vibrance !== void 0 && (i.adjustment.vibrance = h.vibrance), h.Strt !== void 0 && (i.adjustment.saturation = h.Strt), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment, h = {};
      r.vibrance !== void 0 && (h.vibrance = r.vibrance), r.saturation !== void 0 && (h.Strt = r.saturation), (0, a.writeVersionAndDescriptor)(e, "", "null", h);
    });
    function xe(e) {
      return {
        a: (0, l.readInt16)(e),
        b: (0, l.readInt16)(e),
        c: (0, l.readInt16)(e),
        d: (0, l.readInt16)(e),
        hue: (0, l.readInt16)(e),
        saturation: (0, l.readInt16)(e),
        lightness: (0, l.readInt16)(e)
      };
    }
    function Ae(e, i) {
      const r = i || {};
      (0, f.writeInt16)(e, r.a || 0), (0, f.writeInt16)(e, r.b || 0), (0, f.writeInt16)(e, r.c || 0), (0, f.writeInt16)(e, r.d || 0), (0, f.writeInt16)(e, r.hue || 0), (0, f.writeInt16)(e, r.saturation || 0), (0, f.writeInt16)(e, r.lightness || 0);
    }
    y("hue2", ue("hue/saturation"), (e, i, r) => {
      if ((0, l.readUint16)(e) !== 2)
        throw new Error("Invalid hue2 version");
      i.adjustment = Object.assign(Object.assign({}, i.adjustment), { type: "hue/saturation", master: xe(e), reds: xe(e), yellows: xe(e), greens: xe(e), cyans: xe(e), blues: xe(e), magentas: xe(e) }), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment;
      (0, f.writeUint16)(e, 2), Ae(e, r.master), Ae(e, r.reds), Ae(e, r.yellows), Ae(e, r.greens), Ae(e, r.cyans), Ae(e, r.blues), Ae(e, r.magentas);
    });
    function ze(e) {
      return {
        cyanRed: (0, l.readInt16)(e),
        magentaGreen: (0, l.readInt16)(e),
        yellowBlue: (0, l.readInt16)(e)
      };
    }
    function Pe(e, i) {
      (0, f.writeInt16)(e, i.cyanRed || 0), (0, f.writeInt16)(e, i.magentaGreen || 0), (0, f.writeInt16)(e, i.yellowBlue || 0);
    }
    y("blnc", ue("color balance"), (e, i, r) => {
      i.adjustment = {
        type: "color balance",
        shadows: ze(e),
        midtones: ze(e),
        highlights: ze(e),
        preserveLuminosity: !!(0, l.readUint8)(e)
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment;
      Pe(e, r.shadows || {}), Pe(e, r.midtones || {}), Pe(e, r.highlights || {}), (0, f.writeUint8)(e, r.preserveLuminosity ? 1 : 0), (0, f.writeZeros)(e, 1);
    }), y("blwh", ue("black & white"), (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      i.adjustment = {
        type: "black & white",
        reds: h["Rd  "],
        yellows: h.Yllw,
        greens: h["Grn "],
        cyans: h["Cyn "],
        blues: h["Bl  "],
        magentas: h.Mgnt,
        useTint: !!h.useTint,
        presetKind: h.bwPresetKind,
        presetFileName: h.blackAndWhitePresetFileName
      }, h.tintColor !== void 0 && (i.adjustment.tintColor = (0, a.parseColor)(h.tintColor)), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment, h = {
        "Rd  ": r.reds || 0,
        Yllw: r.yellows || 0,
        "Grn ": r.greens || 0,
        "Cyn ": r.cyans || 0,
        "Bl  ": r.blues || 0,
        Mgnt: r.magentas || 0,
        useTint: !!r.useTint,
        tintColor: (0, a.serializeColor)(r.tintColor),
        bwPresetKind: r.presetKind || 0,
        blackAndWhitePresetFileName: r.presetFileName || ""
      };
      (0, a.writeVersionAndDescriptor)(e, "", "null", h);
    }), y("phfl", ue("photo filter"), (e, i, r) => {
      const h = (0, l.readUint16)(e);
      if (h !== 2 && h !== 3)
        throw new Error("Invalid phfl version");
      let w;
      h === 2 ? w = (0, l.readColor)(e) : w = {
        l: (0, l.readInt32)(e) / 100,
        a: (0, l.readInt32)(e) / 100,
        b: (0, l.readInt32)(e) / 100
      }, i.adjustment = {
        type: "photo filter",
        color: w,
        density: (0, l.readUint32)(e) / 100,
        preserveLuminosity: !!(0, l.readUint8)(e)
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment;
      (0, f.writeUint16)(e, 2), (0, f.writeColor)(e, r.color || { l: 0, a: 0, b: 0 }), (0, f.writeUint32)(e, (r.density || 0) * 100), (0, f.writeUint8)(e, r.preserveLuminosity ? 1 : 0), (0, f.writeZeros)(e, 3);
    });
    function Re(e) {
      const i = (0, l.readInt16)(e), r = (0, l.readInt16)(e), h = (0, l.readInt16)(e);
      (0, l.skipBytes)(e, 2);
      const w = (0, l.readInt16)(e);
      return { red: i, green: r, blue: h, constant: w };
    }
    function Ve(e, i) {
      const r = i || {};
      (0, f.writeInt16)(e, r.red), (0, f.writeInt16)(e, r.green), (0, f.writeInt16)(e, r.blue), (0, f.writeZeros)(e, 2), (0, f.writeInt16)(e, r.constant);
    }
    y("mixr", ue("channel mixer"), (e, i, r) => {
      if ((0, l.readUint16)(e) !== 1)
        throw new Error("Invalid mixr version");
      const h = i.adjustment = Object.assign(Object.assign({}, i.adjustment), { type: "channel mixer", monochrome: !!(0, l.readUint16)(e) });
      h.monochrome || (h.red = Re(e), h.green = Re(e), h.blue = Re(e)), h.gray = Re(e), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment;
      (0, f.writeUint16)(e, 1), (0, f.writeUint16)(e, r.monochrome ? 1 : 0), r.monochrome ? (Ve(e, r.gray), (0, f.writeZeros)(e, 30)) : (Ve(e, r.red), Ve(e, r.green), Ve(e, r.blue), Ve(e, r.gray));
    });
    const Ge = (0, S.createEnum)("colorLookupType", "3dlut", {
      "3dlut": "3DLUT",
      abstractProfile: "abstractProfile",
      deviceLinkProfile: "deviceLinkProfile"
    }), Be = (0, S.createEnum)("LUTFormatType", "look", {
      look: "LUTFormatLOOK",
      cube: "LUTFormatCUBE",
      "3dl": "LUTFormat3DL"
    }), v = (0, S.createEnum)("colorLookupOrder", "rgb", {
      rgb: "rgbOrder",
      bgr: "bgrOrder"
    });
    y("clrL", ue("color lookup"), (e, i, r) => {
      if ((0, l.readUint16)(e) !== 1)
        throw new Error("Invalid clrL version");
      const h = (0, a.readVersionAndDescriptor)(e);
      i.adjustment = { type: "color lookup" };
      const w = i.adjustment;
      h.lookupType !== void 0 && (w.lookupType = Ge.decode(h.lookupType)), h["Nm  "] !== void 0 && (w.name = h["Nm  "]), h.Dthr !== void 0 && (w.dither = h.Dthr), h.profile !== void 0 && (w.profile = h.profile), h.LUTFormat !== void 0 && (w.lutFormat = Be.decode(h.LUTFormat)), h.dataOrder !== void 0 && (w.dataOrder = v.decode(h.dataOrder)), h.tableOrder !== void 0 && (w.tableOrder = v.decode(h.tableOrder)), h.LUT3DFileData !== void 0 && (w.lut3DFileData = h.LUT3DFileData), h.LUT3DFileName !== void 0 && (w.lut3DFileName = h.LUT3DFileName), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.adjustment, h = {};
      r.lookupType !== void 0 && (h.lookupType = Ge.encode(r.lookupType)), r.name !== void 0 && (h["Nm  "] = r.name), r.dither !== void 0 && (h.Dthr = r.dither), r.profile !== void 0 && (h.profile = r.profile), r.lutFormat !== void 0 && (h.LUTFormat = Be.encode(r.lutFormat)), r.dataOrder !== void 0 && (h.dataOrder = v.encode(r.dataOrder)), r.tableOrder !== void 0 && (h.tableOrder = v.encode(r.tableOrder)), r.lut3DFileData !== void 0 && (h.LUT3DFileData = r.lut3DFileData), r.lut3DFileName !== void 0 && (h.LUT3DFileName = r.lut3DFileName), (0, f.writeUint16)(e, 1), (0, a.writeVersionAndDescriptor)(e, "", "null", h);
    }), y("nvrt", ue("invert"), (e, i, r) => {
      i.adjustment = { type: "invert" }, (0, l.skipBytes)(e, r());
    }, () => {
    }), y("post", ue("posterize"), (e, i, r) => {
      i.adjustment = {
        type: "posterize",
        levels: (0, l.readUint16)(e)
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r;
      const h = i.adjustment;
      (0, f.writeUint16)(e, (r = h.levels) !== null && r !== void 0 ? r : 4), (0, f.writeZeros)(e, 2);
    }), y("thrs", ue("threshold"), (e, i, r) => {
      i.adjustment = {
        type: "threshold",
        level: (0, l.readUint16)(e)
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r;
      const h = i.adjustment;
      (0, f.writeUint16)(e, (r = h.level) !== null && r !== void 0 ? r : 128), (0, f.writeZeros)(e, 2);
    });
    const A = ["", "", "", "rgb", "hsb", "", "lab"];
    y("grdm", ue("gradient map"), (e, i, r) => {
      const h = (0, l.readUint16)(e);
      if (h !== 1 && h !== 3)
        throw new Error("Invalid grdm version");
      const w = {
        type: "gradient map",
        gradientType: "solid"
      };
      w.reverse = !!(0, l.readUint8)(e), w.dither = !!(0, l.readUint8)(e);
      const U = !!(0, l.readUint8)(e);
      if (e.offset--, U) {
        const I = (0, l.readSignature)(e);
        w.method = a.gradientInterpolationMethodType.decode(I);
      }
      w.name = (0, l.readUnicodeString)(e), w.colorStops = [], w.opacityStops = [];
      const Z = (0, l.readUint16)(e);
      for (let I = 0; I < Z; I++)
        w.colorStops.push({
          location: (0, l.readUint32)(e),
          midpoint: (0, l.readUint32)(e) / 100,
          color: (0, l.readColor)(e)
        }), (0, l.skipBytes)(e, 2);
      const d = (0, l.readUint16)(e);
      for (let I = 0; I < d; I++)
        w.opacityStops.push({
          location: (0, l.readUint32)(e),
          midpoint: (0, l.readUint32)(e) / 100,
          opacity: (0, l.readUint16)(e) / 255
        });
      if ((0, l.readUint16)(e) !== 2)
        throw new Error("Invalid grdm expansion count");
      const o = (0, l.readUint16)(e);
      if (w.smoothness = o / 4096, (0, l.readUint16)(e) !== 32)
        throw new Error("Invalid grdm length");
      w.gradientType = (0, l.readUint16)(e) ? "noise" : "solid", w.randomSeed = (0, l.readUint32)(e), w.addTransparency = !!(0, l.readUint16)(e), w.restrictColors = !!(0, l.readUint16)(e), w.roughness = (0, l.readUint32)(e) / 4096, w.colorModel = A[(0, l.readUint16)(e)] || "rgb", w.min = [
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768
      ], w.max = [
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768,
        (0, l.readUint16)(e) / 32768
      ], (0, l.skipBytes)(e, r());
      for (const I of w.colorStops)
        I.location /= o;
      for (const I of w.opacityStops)
        I.location /= o;
      i.adjustment = w;
    }, (e, i) => {
      var r, h, w;
      const U = i.adjustment;
      (0, f.writeUint16)(e, U.method !== void 0 ? 3 : 1), (0, f.writeUint8)(e, U.reverse ? 1 : 0), (0, f.writeUint8)(e, U.dither ? 1 : 0), U.method !== void 0 && (0, f.writeSignature)(e, a.gradientInterpolationMethodType.encode(U.method)), (0, f.writeUnicodeStringWithPadding)(e, U.name || ""), (0, f.writeUint16)(e, U.colorStops && U.colorStops.length || 0);
      const Z = Math.round(((r = U.smoothness) !== null && r !== void 0 ? r : 1) * 4096);
      for (const L of U.colorStops || [])
        (0, f.writeUint32)(e, Math.round(L.location * Z)), (0, f.writeUint32)(e, Math.round(L.midpoint * 100)), (0, f.writeColor)(e, L.color), (0, f.writeZeros)(e, 2);
      (0, f.writeUint16)(e, U.opacityStops && U.opacityStops.length || 0);
      for (const L of U.opacityStops || [])
        (0, f.writeUint32)(e, Math.round(L.location * Z)), (0, f.writeUint32)(e, Math.round(L.midpoint * 100)), (0, f.writeUint16)(e, Math.round(L.opacity * 255));
      (0, f.writeUint16)(e, 2), (0, f.writeUint16)(e, Z), (0, f.writeUint16)(e, 32), (0, f.writeUint16)(e, U.gradientType === "noise" ? 1 : 0), (0, f.writeUint32)(e, U.randomSeed || 0), (0, f.writeUint16)(e, U.addTransparency ? 1 : 0), (0, f.writeUint16)(e, U.restrictColors ? 1 : 0), (0, f.writeUint32)(e, Math.round(((h = U.roughness) !== null && h !== void 0 ? h : 1) * 4096));
      const d = A.indexOf((w = U.colorModel) !== null && w !== void 0 ? w : "rgb");
      (0, f.writeUint16)(e, d === -1 ? 3 : d);
      for (let L = 0; L < 4; L++)
        (0, f.writeUint16)(e, Math.round((U.min && U.min[L] || 0) * 32768));
      for (let L = 0; L < 4; L++)
        (0, f.writeUint16)(e, Math.round((U.max && U.max[L] || 0) * 32768));
      (0, f.writeZeros)(e, 4);
    });
    function Y(e) {
      return {
        c: (0, l.readInt16)(e),
        m: (0, l.readInt16)(e),
        y: (0, l.readInt16)(e),
        k: (0, l.readInt16)(e)
      };
    }
    function de(e, i) {
      const r = i || {};
      (0, f.writeInt16)(e, r.c), (0, f.writeInt16)(e, r.m), (0, f.writeInt16)(e, r.y), (0, f.writeInt16)(e, r.k);
    }
    y("selc", ue("selective color"), (e, i) => {
      if ((0, l.readUint16)(e) !== 1)
        throw new Error("Invalid selc version");
      const r = (0, l.readUint16)(e) ? "absolute" : "relative";
      (0, l.skipBytes)(e, 8), i.adjustment = {
        type: "selective color",
        mode: r,
        reds: Y(e),
        yellows: Y(e),
        greens: Y(e),
        cyans: Y(e),
        blues: Y(e),
        magentas: Y(e),
        whites: Y(e),
        neutrals: Y(e),
        blacks: Y(e)
      };
    }, (e, i) => {
      const r = i.adjustment;
      (0, f.writeUint16)(e, 1), (0, f.writeUint16)(e, r.mode === "absolute" ? 1 : 0), (0, f.writeZeros)(e, 8), de(e, r.reds), de(e, r.yellows), de(e, r.greens), de(e, r.cyans), de(e, r.blues), de(e, r.magentas), de(e, r.whites), de(e, r.neutrals), de(e, r.blacks);
    }), y("CgEd", (e) => {
      const i = e.adjustment;
      return i ? i.type === "brightness/contrast" && !i.useLegacy || (i.type === "levels" || i.type === "curves" || i.type === "exposure" || i.type === "channel mixer" || i.type === "hue/saturation") && i.presetFileName !== void 0 : !1;
    }, (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      if (h.Vrsn !== 1)
        throw new Error("Invalid CgEd version");
      "presetFileName" in h ? i.adjustment = Object.assign(Object.assign({}, i.adjustment), { presetKind: h.presetKind, presetFileName: h.presetFileName }) : "curvesPresetFileName" in h ? i.adjustment = Object.assign(Object.assign({}, i.adjustment), { presetKind: h.curvesPresetKind, presetFileName: h.curvesPresetFileName }) : "mixerPresetFileName" in h ? i.adjustment = Object.assign(Object.assign({}, i.adjustment), { presetKind: h.mixerPresetKind, presetFileName: h.mixerPresetFileName }) : i.adjustment = {
        type: "brightness/contrast",
        brightness: h.Brgh,
        contrast: h.Cntr,
        meanValue: h.means,
        useLegacy: !!h.useLegacy,
        labColorOnly: !!h["Lab "],
        auto: !!h.Auto
      }, (0, l.skipBytes)(e, r());
    }, (e, i) => {
      var r, h, w, U;
      const Z = i.adjustment;
      if (Z.type === "levels" || Z.type === "exposure" || Z.type === "hue/saturation") {
        const d = {
          Vrsn: 1,
          presetKind: (r = Z.presetKind) !== null && r !== void 0 ? r : 1,
          presetFileName: Z.presetFileName || ""
        };
        (0, a.writeVersionAndDescriptor)(e, "", "null", d);
      } else if (Z.type === "curves") {
        const d = {
          Vrsn: 1,
          curvesPresetKind: (h = Z.presetKind) !== null && h !== void 0 ? h : 1,
          curvesPresetFileName: Z.presetFileName || ""
        };
        (0, a.writeVersionAndDescriptor)(e, "", "null", d);
      } else if (Z.type === "channel mixer") {
        const d = {
          Vrsn: 1,
          mixerPresetKind: (w = Z.presetKind) !== null && w !== void 0 ? w : 1,
          mixerPresetFileName: Z.presetFileName || ""
        };
        (0, a.writeVersionAndDescriptor)(e, "", "null", d);
      } else if (Z.type === "brightness/contrast") {
        const d = {
          Vrsn: 1,
          Brgh: Z.brightness || 0,
          Cntr: Z.contrast || 0,
          means: (U = Z.meanValue) !== null && U !== void 0 ? U : 127,
          "Lab ": !!Z.labColorOnly,
          useLegacy: !!Z.useLegacy,
          Auto: !!Z.auto
        };
        (0, a.writeVersionAndDescriptor)(e, "", "null", d);
      } else
        throw new Error("Unhandled CgEd case");
    });
    function pe(e) {
      const i = [];
      function r(h) {
        var w;
        if (h.children)
          for (const U of h.children)
            ((w = U.text) === null || w === void 0 ? void 0 : w.index) !== void 0 && (i[U.text.index] = U), r(U);
      }
      return r(e), i;
    }
    y("Txt2", V("engineData"), (e, i, r, h) => {
      const w = (0, l.readBytes)(e, r());
      i.engineData = (0, q.fromByteArray)(w);
      const U = pe(h), Z = (0, P.parseEngineData)(w), L = (0, ye.decodeEngineData2)(Z).ResourceDict.TextFrameSet;
      if (L)
        for (let o = 0; o < L.length; o++) {
          const _ = U[o];
          L[o].path && (_ != null && _.text) && (_.text.textPath = L[o].path);
        }
    }, (e, i) => {
      const r = (0, q.toByteArray)(i.engineData);
      (0, f.writeBytes)(e, r);
    }), y("FEid", V("filterEffectsMasks"), (e, i, r) => {
      const h = (0, l.readInt32)(e);
      if (h < 1 || h > 3)
        throw new Error(`Invalid filterEffects version ${h}`);
      for (i.filterEffectsMasks = []; r() > 8; ) {
        if ((0, l.readUint32)(e))
          throw new Error("filterEffects: 64 bit length is not supported");
        const w = (0, l.readUint32)(e), U = e.offset + w, Z = (0, l.readPascalString)(e, 1), d = (0, l.readInt32)(e);
        if (d !== 1)
          throw new Error(`Invalid filterEffect version ${d}`);
        if ((0, l.readUint32)(e))
          throw new Error("filterEffect: 64 bit length is not supported");
        (0, l.readUint32)(e);
        const L = (0, l.readInt32)(e), o = (0, l.readInt32)(e), _ = (0, l.readInt32)(e), I = (0, l.readInt32)(e), x = (0, l.readInt32)(e), b = (0, l.readInt32)(e), X = [];
        for (let $ = 0; $ < b + 2; $++)
          if ((0, l.readInt32)(e)) {
            if ((0, l.readUint32)(e))
              throw new Error("filterEffect: 64 bit length is not supported");
            const ge = (0, l.readUint32)(e);
            if (!ge)
              throw new Error("filterEffect: Empty channel");
            const Ce = (0, l.readUint16)(e), De = (0, l.readBytes)(e, ge - 2);
            X.push({ compressionMode: Ce, data: De });
          } else
            X.push(void 0);
        if (i.filterEffectsMasks.push({ id: Z, top: L, left: o, bottom: _, right: I, depth: x, channels: X }), e.offset < U && (0, l.readUint8)(e)) {
          const $ = (0, l.readInt32)(e), be = (0, l.readInt32)(e), ge = (0, l.readInt32)(e), Ce = (0, l.readInt32)(e);
          if ((0, l.readUint32)(e))
            throw new Error("filterEffect: 64 bit length is not supported");
          const De = (0, l.readUint32)(e), Ne = (0, l.readUint16)(e), s = (0, l.readBytes)(e, De - 2);
          i.filterEffectsMasks[i.filterEffectsMasks.length - 1].extra = { top: $, left: be, bottom: ge, right: Ce, compressionMode: Ne, data: s };
        }
        e.offset = U;
        let u = w;
        for (; u % 4; )
          e.offset++, u++;
      }
    }, (e, i) => {
      var r;
      (0, f.writeInt32)(e, 3);
      for (const h of i.filterEffectsMasks) {
        (0, f.writeUint32)(e, 0), (0, f.writeUint32)(e, 0);
        const w = e.offset;
        (0, f.writePascalString)(e, h.id, 1), (0, f.writeInt32)(e, 1), (0, f.writeUint32)(e, 0), (0, f.writeUint32)(e, 0);
        const U = e.offset;
        (0, f.writeInt32)(e, h.top), (0, f.writeInt32)(e, h.left), (0, f.writeInt32)(e, h.bottom), (0, f.writeInt32)(e, h.right), (0, f.writeInt32)(e, h.depth);
        const Z = Math.max(0, h.channels.length - 2);
        (0, f.writeInt32)(e, Z);
        for (let o = 0; o < Z + 2; o++) {
          const _ = h.channels[o];
          (0, f.writeInt32)(e, _ ? 1 : 0), _ && ((0, f.writeUint32)(e, 0), (0, f.writeUint32)(e, _.data.length + 2), (0, f.writeUint16)(e, _.compressionMode), (0, f.writeBytes)(e, _.data));
        }
        e.view.setUint32(U - 4, e.offset - U, !1);
        const d = (r = i.filterEffectsMasks[i.filterEffectsMasks.length - 1]) === null || r === void 0 ? void 0 : r.extra;
        d && ((0, f.writeUint8)(e, 1), (0, f.writeInt32)(e, d.top), (0, f.writeInt32)(e, d.left), (0, f.writeInt32)(e, d.bottom), (0, f.writeInt32)(e, d.right), (0, f.writeUint32)(e, 0), (0, f.writeUint32)(e, d.data.byteLength + 2), (0, f.writeUint16)(e, d.compressionMode), (0, f.writeBytes)(e, d.data));
        let L = e.offset - w;
        for (e.view.setUint32(w - 4, L, !1); L % 4; )
          (0, f.writeZeros)(e, 1), L++;
      }
    }), H("FXid", "FEid"), y("FMsk", V("filterMask"), (e, i) => {
      i.filterMask = {
        colorSpace: (0, l.readColor)(e),
        opacity: (0, l.readUint16)(e) / 255
      };
    }, (e, i) => {
      var r;
      (0, f.writeColor)(e, i.filterMask.colorSpace), (0, f.writeUint16)(e, (0, S.clamp)((r = i.filterMask.opacity) !== null && r !== void 0 ? r : 1, 0, 1) * 255);
    }), y(
      "artd",
      // document-wide artboard info
      // document-wide artboard info
      (e) => e.artboards !== void 0,
      (e, i, r) => {
        const h = (0, a.readVersionAndDescriptor)(e);
        i.artboards = {
          count: h["Cnt "],
          autoExpandOffset: { horizontal: h.autoExpandOffset.Hrzn, vertical: h.autoExpandOffset.Vrtc },
          origin: { horizontal: h.origin.Hrzn, vertical: h.origin.Vrtc },
          autoExpandEnabled: h.autoExpandEnabled,
          autoNestEnabled: h.autoNestEnabled,
          autoPositionEnabled: h.autoPositionEnabled,
          shrinkwrapOnSaveEnabled: !!h.shrinkwrapOnSaveEnabled,
          docDefaultNewArtboardBackgroundColor: (0, a.parseColor)(h.docDefaultNewArtboardBackgroundColor),
          docDefaultNewArtboardBackgroundType: h.docDefaultNewArtboardBackgroundType
        }, (0, l.skipBytes)(e, r());
      },
      (e, i) => {
        var r, h, w, U, Z;
        const d = i.artboards, L = {
          "Cnt ": d.count,
          autoExpandOffset: d.autoExpandOffset ? { Hrzn: d.autoExpandOffset.horizontal, Vrtc: d.autoExpandOffset.vertical } : { Hrzn: 0, Vrtc: 0 },
          origin: d.origin ? { Hrzn: d.origin.horizontal, Vrtc: d.origin.vertical } : { Hrzn: 0, Vrtc: 0 },
          autoExpandEnabled: (r = d.autoExpandEnabled) !== null && r !== void 0 ? r : !0,
          autoNestEnabled: (h = d.autoNestEnabled) !== null && h !== void 0 ? h : !0,
          autoPositionEnabled: (w = d.autoPositionEnabled) !== null && w !== void 0 ? w : !0,
          shrinkwrapOnSaveEnabled: (U = d.shrinkwrapOnSaveEnabled) !== null && U !== void 0 ? U : !0,
          docDefaultNewArtboardBackgroundColor: (0, a.serializeColor)(d.docDefaultNewArtboardBackgroundColor),
          docDefaultNewArtboardBackgroundType: (Z = d.docDefaultNewArtboardBackgroundType) !== null && Z !== void 0 ? Z : 1
        };
        (0, a.writeVersionAndDescriptor)(e, "", "null", L, "artd");
      }
    );
    function oe(e) {
      return Object.keys(e).map((i) => e[i]).some((i) => Array.isArray(i) && i.length > 1);
    }
    y("lfx2", (e) => e.effects !== void 0 && !oe(e.effects), (e, i, r) => {
      if ((0, l.readUint32)(e) !== 0)
        throw new Error("Invalid lfx2 version");
      const w = (0, a.readVersionAndDescriptor)(e);
      i.effects = (0, a.parseEffects)(w, !!e.logMissingFeatures), (0, l.skipBytes)(e, r());
    }, (e, i, r, h) => {
      const w = (0, a.serializeEffects)(i.effects, !!h.logMissingFeatures, !0);
      (0, f.writeUint32)(e, 0), (0, a.writeVersionAndDescriptor)(e, "", "null", w);
    }), y("cinf", V("compositorUsed"), (e, i, r) => {
      const h = (0, a.readVersionAndDescriptor)(e);
      function w(U) {
        return U.split(".")[1];
      }
      i.compositorUsed = {
        description: h.description,
        reason: h.reason,
        engine: w(h.Engn)
      }, h.Vrsn && (i.compositorUsed.version = h.Vrsn), h.psVersion && (i.compositorUsed.photoshopVersion = h.psVersion), h.enableCompCore && (i.compositorUsed.enableCompCore = w(h.enableCompCore)), h.enableCompCoreGPU && (i.compositorUsed.enableCompCoreGPU = w(h.enableCompCoreGPU)), h.enableCompCoreThreads && (i.compositorUsed.enableCompCoreThreads = w(h.enableCompCoreThreads)), h.compCoreSupport && (i.compositorUsed.compCoreSupport = w(h.compCoreSupport)), h.compCoreGPUSupport && (i.compositorUsed.compCoreGPUSupport = w(h.compCoreGPUSupport)), (0, l.skipBytes)(e, r());
    }, (e, i) => {
      const r = i.compositorUsed, h = {
        Vrsn: r.version || { major: 1, minor: 0, fix: 0 }
      };
      r.photoshopVersion && (h.psVersion = r.photoshopVersion), h.description = r.description, h.reason = r.reason, h.Engn = `Engn.${r.engine}`, r.enableCompCore && (h.enableCompCore = `enable.${r.enableCompCore}`), r.enableCompCoreGPU && (h.enableCompCoreGPU = `enable.${r.enableCompCoreGPU}`), r.enableCompCoreThreads && (h.enableCompCoreThreads = `enable.${r.enableCompCoreThreads}`), r.compCoreSupport && (h.compCoreSupport = `reason.${r.compCoreSupport}`), r.compCoreGPUSupport && (h.compCoreGPUSupport = `reason.${r.compCoreGPUSupport}`), (0, a.writeVersionAndDescriptor)(e, "", "null", h);
    }), y("extn", (e) => e._extn !== void 0, (e, i) => {
      const r = (0, a.readVersionAndDescriptor)(e);
      S.MOCK_HANDLERS && (i._extn = r);
    }, (e, i) => {
      S.MOCK_HANDLERS && (0, a.writeVersionAndDescriptor)(e, "", "null", i._extn);
    }), y("iOpa", V("fillOpacity"), (e, i) => {
      i.fillOpacity = (0, l.readUint8)(e) / 255, (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.fillOpacity * 255), (0, f.writeZeros)(e, 3);
    }), y("brst", V("channelBlendingRestrictions"), (e, i, r) => {
      for (i.channelBlendingRestrictions = []; r() > 4; )
        i.channelBlendingRestrictions.push((0, l.readInt32)(e));
    }, (e, i) => {
      for (const r of i.channelBlendingRestrictions)
        (0, f.writeInt32)(e, r);
    }), y("tsly", V("transparencyShapesLayer"), (e, i) => {
      i.transparencyShapesLayer = !!(0, l.readUint8)(e), (0, l.skipBytes)(e, 3);
    }, (e, i) => {
      (0, f.writeUint8)(e, i.transparencyShapesLayer ? 1 : 0), (0, f.writeZeros)(e, 3);
    });
  })(Xt)), Xt;
}
var Un;
function At() {
  if (Un) return $e;
  Un = 1, Object.defineProperty($e, "__esModule", { value: !0 }), $e.createWriter = S, $e.getWriterBuffer = l, $e.getWriterBufferNoCopy = f, $e.writeUint8 = a, $e.writeInt16 = P, $e.writeUint16 = ee, $e.writeUint16LE = ye, $e.writeInt32 = O, $e.writeInt32LE = y, $e.writeUint32 = H, $e.writeFloat32 = V, $e.writeFloat64 = le, $e.writeFixedPoint32 = ce, $e.writeFixedPointPath32 = ie, $e.writeBytes = he, $e.writeZeros = fe, $e.writeSignature = ne, $e.writeAsciiString = B, $e.writePascalString = z, $e.writeUnicodeStringWithoutLength = C, $e.writeUnicodeStringWithoutLengthLE = F, $e.writeUnicodeString = N, $e.writeUnicodeStringWithPadding = J, $e.writeSection = n, $e.writePsd = g, $e.writeColor = Ge, $e.writePattern = Be;
  const c = mt(), q = en(), k = Xn();
  function S(v = 4096) {
    const A = new ArrayBuffer(v), Y = new DataView(A);
    return { buffer: A, view: Y, offset: 0, tempBuffer: void 0 };
  }
  function l(v) {
    return v.buffer.slice(0, v.offset);
  }
  function f(v) {
    return new Uint8Array(v.buffer, 0, v.offset);
  }
  function a(v, A) {
    const Y = ue(v, 1);
    v.view.setUint8(Y, A);
  }
  function P(v, A) {
    const Y = ue(v, 2);
    v.view.setInt16(Y, A, !1);
  }
  function ee(v, A) {
    const Y = ue(v, 2);
    v.view.setUint16(Y, A, !1);
  }
  function ye(v, A) {
    const Y = ue(v, 2);
    v.view.setUint16(Y, A, !0);
  }
  function O(v, A) {
    const Y = ue(v, 4);
    v.view.setInt32(Y, A, !1);
  }
  function y(v, A) {
    const Y = ue(v, 4);
    v.view.setInt32(Y, A, !0);
  }
  function H(v, A) {
    const Y = ue(v, 4);
    v.view.setUint32(Y, A, !1);
  }
  function V(v, A) {
    const Y = ue(v, 4);
    v.view.setFloat32(Y, A, !1);
  }
  function le(v, A) {
    const Y = ue(v, 8);
    v.view.setFloat64(Y, A, !1);
  }
  function ce(v, A) {
    O(v, A * 65536);
  }
  function ie(v, A) {
    O(v, A * (1 << 24));
  }
  function he(v, A) {
    A && (ve(v, v.offset + A.length), new Uint8Array(v.buffer).set(A, v.offset), v.offset += A.length);
  }
  function fe(v, A) {
    for (let Y = 0; Y < A; Y++)
      a(v, 0);
  }
  function ne(v, A) {
    if (A.length !== 4)
      throw new Error(`Invalid signature: '${A}'`);
    for (let Y = 0; Y < 4; Y++)
      a(v, A.charCodeAt(Y));
  }
  function B(v, A) {
    for (let Y = 0; Y < A.length; Y++)
      a(v, A.charCodeAt(Y));
  }
  function z(v, A, Y) {
    let de = A.length;
    if (de > 255)
      throw new Error("String too long");
    a(v, de);
    for (let pe = 0; pe < de; pe++) {
      const oe = A.charCodeAt(pe);
      a(v, oe < 128 ? oe : 63);
    }
    for (; ++de % Y; )
      a(v, 0);
  }
  function C(v, A) {
    for (let Y = 0; Y < A.length; Y++)
      ee(v, A.charCodeAt(Y));
  }
  function F(v, A) {
    for (let Y = 0; Y < A.length; Y++)
      ye(v, A.charCodeAt(Y));
  }
  function N(v, A) {
    H(v, A.length), C(v, A);
  }
  function J(v, A) {
    H(v, A.length + 1);
    for (let Y = 0; Y < A.length; Y++)
      ee(v, A.charCodeAt(Y));
    ee(v, 0);
  }
  function W(v = []) {
    let A = 0;
    for (const Y of v) {
      const { width: de, height: pe } = xe(Y);
      if (A = Math.max(A, 2 * pe + 2 * de * pe), Y.mask) {
        const { width: oe, height: e } = xe(Y.mask);
        A = Math.max(A, 2 * e + 2 * oe * e);
      }
      if (Y.realMask) {
        const { width: oe, height: e } = xe(Y.realMask);
        A = Math.max(A, 2 * e + 2 * oe * e);
      }
      Y.children && (A = Math.max(A, W(Y.children)));
    }
    return A;
  }
  function n(v, A, Y, de = !1, pe = !1) {
    pe && H(v, 0);
    const oe = v.offset;
    H(v, 0), Y();
    let e = v.offset - oe - 4, i = e;
    for (; i % A; )
      a(v, 0), i++;
    de && (e = i), v.view.setUint32(oe, e, !1);
  }
  function p(v) {
    var A;
    (A = v.children) === null || A === void 0 || A.forEach(p);
    const Y = v.imageData;
    if (Y && (Y.data instanceof Uint32Array || Y.data instanceof Uint16Array))
      throw new Error("imageData has incorrect bitDepth");
    if ("mask" in v && v.mask) {
      const de = v.mask.imageData;
      if (de && (de.data instanceof Uint32Array || de.data instanceof Uint16Array))
        throw new Error("mask imageData has incorrect bitDepth");
    }
  }
  function g(v, A, Y = {}) {
    var de;
    if (!(+A.width > 0 && +A.height > 0))
      throw new Error("Invalid document size");
    if ((A.width > 3e4 || A.height > 3e4) && !Y.psb)
      throw new Error("Document size is too large (max is 30000x30000, use PSB format instead)");
    const pe = (de = A.bitsPerChannel) !== null && de !== void 0 ? de : 8;
    if (pe !== 8)
      throw new Error("bitsPerChannel other than 8 are not supported for writing");
    p(A);
    const oe = Object.assign({}, A.imageResources), e = Object.assign(Object.assign({}, Y), { layerIds: /* @__PURE__ */ new Set(), layerToId: /* @__PURE__ */ new Map() });
    e.generateThumbnail && (oe.thumbnail = Fe(A));
    let i = A.imageData;
    if (!i && A.canvas && (i = A.canvas.getContext("2d").getImageData(0, 0, A.canvas.width, A.canvas.height)), i && (A.width !== i.width || A.height !== i.height))
      throw new Error("Document canvas must have the same size as document");
    const r = !!i && (0, c.hasAlpha)(i), h = Math.max(W(A.children), 8 * A.width * A.height + 2 * A.height);
    v.tempBuffer = new Uint8Array(h), ne(v, "8BPS"), ee(v, Y.psb ? 2 : 1), fe(v, 6), ee(v, r ? 4 : 3), H(v, A.height), H(v, A.width), ee(v, pe), ee(
      v,
      3
      /* ColorMode.RGB */
    ), n(v, 1, () => {
      var o, _, I;
      if (A.palette) {
        for (let x = 0; x < 256; x++)
          a(v, ((o = A.palette[x]) === null || o === void 0 ? void 0 : o.r) || 0);
        for (let x = 0; x < 256; x++)
          a(v, ((_ = A.palette[x]) === null || _ === void 0 ? void 0 : _.g) || 0);
        for (let x = 0; x < 256; x++)
          a(v, ((I = A.palette[x]) === null || I === void 0 ? void 0 : I.b) || 0);
      }
    });
    const w = [];
    me(w, A.children), w.length || w.push({}), oe.layersGroup = w.map((o) => o.linkGroup || 0), oe.layerGroupsEnabledId = w.map((o) => o.linkGroupEnabled == !1 ? 0 : 1), n(v, 1, () => {
      for (const o of k.resourceHandlers) {
        const _ = o.has(oe), I = _ === !1 ? 0 : _ === !0 ? 1 : _;
        for (let x = 0; x < I; x++)
          ne(v, "8BIM"), ee(v, o.key), z(v, "", 2), n(v, 2, () => o.write(v, oe, x));
      }
    }), n(v, 2, () => {
      E(v, w, A, r, e), Q(v, A.globalLayerMaskInfo), se(v, A, A, e);
    }, void 0, !!e.psb);
    const U = r ? [0, 1, 2, 3] : [0, 1, 2], Z = i ? i.width : A.width, d = i ? i.height : A.height, L = { data: new Uint8Array(Z * d * 4), width: Z, height: d };
    if (ee(
      v,
      1
      /* Compression.RleCompressed */
    ), c.RAW_IMAGE_DATA && A.imageDataRaw)
      console.log("writing raw image data"), he(v, A.imageDataRaw);
    else {
      if (i && L.data.set(new Uint8Array(i.data.buffer, i.data.byteOffset, i.data.byteLength)), r) {
        const o = L.width * L.height * 4, _ = L.data;
        for (let I = 0; I < o; I += 4) {
          const x = _[I + 3];
          if (x != 0 && x != 255) {
            const b = x / 255, X = 255 * (1 - b);
            _[I + 0] = _[I + 0] * b + X, _[I + 1] = _[I + 1] * b + X, _[I + 2] = _[I + 2] * b + X;
          }
        }
      }
      he(v, (0, c.writeDataRLE)(v.tempBuffer, L, U, !!Y.psb));
    }
  }
  function E(v, A, Y, de, pe) {
    n(v, 4, () => {
      var oe;
      P(v, de ? -A.length : A.length);
      const e = A.map((i, r) => Ie(v.tempBuffer, i, r === 0, pe));
      for (const i of e) {
        const { layer: r, top: h, left: w, bottom: U, right: Z, channels: d } = i;
        O(v, h), O(v, w), O(v, U), O(v, Z), ee(v, d.length);
        for (const o of d)
          P(v, o.id), pe.psb && H(v, 0), H(v, o.length);
        ne(v, "8BIM"), ne(v, c.fromBlendMode[r.blendMode] || "norm"), a(v, Math.round((0, c.clamp)((oe = r.opacity) !== null && oe !== void 0 ? oe : 1, 0, 1) * 255)), a(v, r.clipping ? 1 : 0);
        let L = 8;
        r.transparencyProtected && (L |= 1), r.hidden && (L |= 2), (r.vectorMask || r.sectionDivider && r.sectionDivider.type !== 0 || r.adjustment) && (L |= 16), r.effectsOpen && (L |= 32), a(v, L), a(v, 0), n(v, 1, () => {
          G(v, r, i), re(v, r), z(v, (r.name || "").substring(0, 255), 4), se(v, r, Y, pe);
        });
      }
      for (const i of e)
        for (const r of i.channels)
          ee(v, r.compression), r.data && he(v, r.data);
    }, !0, pe.psb);
  }
  function G(v, { mask: A, realMask: Y }, de) {
    n(v, 1, () => {
      if (!A && !Y)
        return;
      let pe = 0, oe = 0, e = 0;
      A && (A.userMaskDensity !== void 0 && (pe |= 1), A.userMaskFeather !== void 0 && (pe |= 2), A.vectorMaskDensity !== void 0 && (pe |= 4), A.vectorMaskFeather !== void 0 && (pe |= 8), A.disabled && (oe |= 2), A.positionRelativeToLayer && (oe |= 1), A.fromVectorData && (oe |= 8), pe && (oe |= 16));
      const i = de.mask || {};
      if (O(v, i.top || 0), O(v, i.left || 0), O(v, i.bottom || 0), O(v, i.right || 0), a(v, A && A.defaultColor || 0), a(v, oe), Y) {
        Y.disabled && (e |= 2), Y.positionRelativeToLayer && (e |= 1), Y.fromVectorData && (e |= 8);
        const r = de.realMask || {};
        a(v, e), a(v, Y.defaultColor || 0), O(v, r.top || 0), O(v, r.left || 0), O(v, r.bottom || 0), O(v, r.right || 0);
      }
      pe && A && (a(v, pe), A.userMaskDensity !== void 0 && a(v, Math.round(A.userMaskDensity * 255)), A.userMaskFeather !== void 0 && le(v, A.userMaskFeather), A.vectorMaskDensity !== void 0 && a(v, Math.round(A.vectorMaskDensity * 255)), A.vectorMaskFeather !== void 0 && le(v, A.vectorMaskFeather)), fe(v, 2);
    });
  }
  function M(v, A) {
    a(v, A[0]), a(v, A[1]), a(v, A[2]), a(v, A[3]);
  }
  function re(v, A) {
    n(v, 1, () => {
      const Y = A.blendingRanges;
      if (Y) {
        M(v, Y.compositeGrayBlendSource), M(v, Y.compositeGraphBlendDestinationRange);
        for (const de of Y.ranges)
          M(v, de.sourceRange), M(v, de.destRange);
      }
    });
  }
  function Q(v, A) {
    n(v, 1, () => {
      A && (ee(v, A.overlayColorSpace), ee(v, A.colorSpace1), ee(v, A.colorSpace2), ee(v, A.colorSpace3), ee(v, A.colorSpace4), ee(v, Math.round(A.opacity * 255)), a(v, A.kind), fe(v, 3));
    });
  }
  function se(v, A, Y, de) {
    for (const pe of q.infoHandlers) {
      let oe = pe.key;
      if (!(oe === "Txt2" && de.invalidateTextLayers) && (oe === "vmsk" && de.psb && (oe = "vsms"), pe.has(A))) {
        const e = de.psb && c.largeAdditionalInfoKeys.indexOf(oe) !== -1, i = oe !== "Txt2" && oe !== "cinf" && oe !== "extn" && oe !== "CAI " && oe !== "OCIO", r = oe === "levl" || oe === "Txt2" || oe === "luni" || oe === "vmsk" || oe === "artb" || oe === "artd" || oe === "vogk" || oe === "SoLd" || oe === "lnk2" || oe === "vscg" || oe === "vsms" || oe === "GdFl" || oe === "lmfx" || oe === "lrFX" || oe === "cinf" || oe === "PlLd" || oe === "Anno" || oe === "CAI " || oe === "OCIO" || oe === "GenI" || oe === "FEid" || oe === "curv" || oe === "CgEd" || oe === "vibA" || oe === "blwh" || oe === "grdm";
        ne(v, e ? "8B64" : "8BIM"), ne(v, oe), n(v, r ? 4 : 2, () => {
          pe.write(v, A, Y, de);
        }, i, e);
      }
    }
  }
  function me(v, A) {
    if (A)
      for (const Y of A) {
        if (Y.children && Y.canvas)
          throw new Error("Invalid layer, cannot have both 'canvas' and 'children' properties");
        if (Y.children && Y.imageData)
          throw new Error("Invalid layer, cannot have both 'imageData' and 'children' properties");
        Y.children ? (v.push({
          name: "</Layer group>",
          sectionDivider: {
            type: 3
          }
          // blendingRanges: children[0].blendingRanges,
          // nameSource: 'lset',
          // id: layerIds.shift(),
          // protected: {
          // 	transparency: false,
          // 	composite: false,
          // 	position: false,
          // },
          // layerColor: 'red',
          // timestamp: timestamps.shift(),
          // referencePoint: { x: 0, y: 0 },
        }), me(v, Y.children), v.push(Object.assign(Object.assign({}, Y), { blendMode: Y.blendMode === "pass through" ? "normal" : Y.blendMode, sectionDivider: {
          type: Y.opened === !1 ? 2 : 1,
          key: c.fromBlendMode[Y.blendMode] || "pass",
          subType: 0
        } }))) : v.push(Object.assign({}, Y));
      }
  }
  function te(v, A) {
    let Y = v.buffer.byteLength;
    do
      Y *= 2;
    while (A > Y);
    const de = new ArrayBuffer(Y), pe = new Uint8Array(de), oe = new Uint8Array(v.buffer);
    pe.set(oe), v.buffer = de, v.view = new DataView(v.buffer);
  }
  function ve(v, A) {
    A > v.buffer.byteLength && te(v, A);
  }
  function ue(v, A) {
    const Y = v.offset;
    return ve(v, v.offset += A), Y;
  }
  function Fe(v) {
    const A = (0, c.createCanvas)(10, 10);
    let Y = 1;
    v.width > v.height ? (A.width = 160, A.height = Math.floor(v.height * (A.width / v.width)), Y = A.width / v.width) : (A.height = 160, A.width = Math.floor(v.width * (A.height / v.height)), Y = A.height / v.height);
    const de = A.getContext("2d");
    return de.scale(Y, Y), v.imageData ? de.drawImage((0, c.imageDataToCanvas)(v.imageData), 0, 0) : v.canvas && de.drawImage(v.canvas, 0, 0), A;
  }
  function _e(v, A, Y, de, pe, oe) {
    let e = de.top | 0, i = de.left | 0, r = de.right | 0, h = de.bottom | 0, { width: w, height: U } = xe(de), Z = de.imageData;
    if (!Z && de.canvas && w && U && (Z = de.canvas.getContext("2d").getImageData(0, 0, w, U)), Z && (Z.width !== w || Z.height !== U))
      throw new Error("Invalid imageData dimentions");
    r = i + w, h = e + U;
    let d, L;
    c.RAW_IMAGE_DATA && Y[oe ? "realMaskDataRaw" : "maskDataRaw"] ? (d = Y[oe ? "realMaskDataRaw" : "maskDataRaw"], L = Y[oe ? "realMaskDataRawCompression" : "maskDataRawCompression"]) : Z ? pe.compress ? (d = (0, c.writeDataZipWithoutPrediction)(Z, [0]), L = 2) : (d = (0, c.writeDataRLE)(v, Z, [0], !!pe.psb), L = 1) : (d = new Uint8Array(0), L = 1), A.channels.push({ id: oe ? -3 : -2, compression: L, data: d, length: 2 + d.length }), A[oe ? "realMask" : "mask"] = { top: e, left: i, right: r, bottom: h };
  }
  function Oe(v) {
    return v ? {
      top: v.top || 0,
      left: v.left || 0,
      right: v.right || 0,
      bottom: v.bottom || 0
    } : void 0;
  }
  function Ie(v, A, Y, de) {
    if (A.rawData)
      return Object.assign(Object.assign({ layer: A, channels: A.rawData.channels.map((oe) => {
        var e, i;
        return Object.assign(Object.assign({}, oe), { length: 2 + ((i = (e = oe.data) === null || e === void 0 ? void 0 : e.byteLength) !== null && i !== void 0 ? i : 0) });
      }) }, Oe(A)), { mask: Oe(A.mask), realMask: Oe(A.realMask) });
    const pe = ze(v, A, Y, de);
    return A.mask && _e(v, pe, A, A.mask, de, !1), A.realMask && _e(v, pe, A, A.realMask, de, !0), pe;
  }
  function xe({ canvas: v, imageData: A }) {
    var Y, de, pe, oe;
    const e = (de = (Y = A == null ? void 0 : A.width) !== null && Y !== void 0 ? Y : v == null ? void 0 : v.width) !== null && de !== void 0 ? de : 0, i = (oe = (pe = A == null ? void 0 : A.height) !== null && pe !== void 0 ? pe : v == null ? void 0 : v.height) !== null && oe !== void 0 ? oe : 0;
    return { width: e, height: i };
  }
  function Ae(v, A, Y, de, pe) {
    if (v.data instanceof Uint32Array || v.data instanceof Uint16Array)
      throw new Error("imageData has incorrect bit depth");
    const oe = (0, c.createImageData)(de, pe), e = v.data, i = oe.data;
    for (let r = 0; r < pe; r++)
      for (let h = 0; h < de; h++) {
        let w = (h + A + (r + Y) * v.width) * 4, U = (h + r * de) * 4;
        i[U] = e[w], i[U + 1] = e[w + 1], i[U + 2] = e[w + 2], i[U + 3] = e[w + 3];
      }
    return oe;
  }
  function ze(v, A, Y, de) {
    var pe;
    let oe = A.top | 0, e = A.left | 0, i = A.right | 0, r = A.bottom | 0, h = [
      { id: -1, compression: 0, data: void 0, length: 2 },
      { id: 0, compression: 0, data: void 0, length: 2 },
      { id: 1, compression: 0, data: void 0, length: 2 },
      { id: 2, compression: 0, data: void 0, length: 2 }
    ], { width: w, height: U } = xe(A);
    if (!(A.canvas || A.imageData) || !w || !U)
      return i = e, r = oe, { layer: A, top: oe, left: e, right: i, bottom: r, channels: h };
    i = e + w, r = oe + U;
    let Z = A.imageData || A.canvas.getContext("2d").getImageData(0, 0, w, U);
    if (de.trimImageData) {
      const L = Ve(Z);
      if (L.left !== 0 || L.top !== 0 || L.right !== Z.width || L.bottom !== Z.height) {
        if (e += L.left, oe += L.top, i -= Z.width - L.right, r -= Z.height - L.bottom, w = i - e, U = r - oe, !w || !U)
          return { layer: A, top: oe, left: e, right: i, bottom: r, channels: h };
        Z = Ae(Z, L.left, L.top, w, U);
      }
    }
    const d = [
      0,
      1,
      2
    ];
    return (!Y || de.noBackground || A.mask || (0, c.hasAlpha)(Z) || c.RAW_IMAGE_DATA && (!((pe = A.imageDataRaw) === null || pe === void 0) && pe[-1])) && d.unshift(
      -1
      /* ChannelID.Transparency */
    ), h = d.map((L) => {
      const o = (0, c.offsetForChannel)(L, !1);
      let _, I;
      return c.RAW_IMAGE_DATA && A.imageDataRaw ? (_ = A.imageDataRaw[L], I = A.imageDataRawCompression[L]) : de.compress ? (_ = (0, c.writeDataZipWithoutPrediction)(Z, [o]), I = 2) : (_ = (0, c.writeDataRLE)(v, Z, [o], !!de.psb), I = 1), { id: L, compression: I, data: _, length: 2 + _.length };
    }), { layer: A, top: oe, left: e, right: i, bottom: r, channels: h };
  }
  function Pe({ data: v, width: A }, Y, de, pe) {
    const oe = (Y * A + de) * 4 + 3 | 0, e = oe + (pe - de) * 4 | 0;
    for (let i = oe; i < e; i = i + 4 | 0)
      if (v[i] !== 0)
        return !1;
    return !0;
  }
  function Re({ data: v, width: A }, Y, de, pe) {
    const oe = A * 4 | 0, e = de * oe + Y * 4 + 3 | 0;
    for (let i = de, r = e; i < pe; i++, r = r + oe | 0)
      if (v[r] !== 0)
        return !1;
    return !0;
  }
  function Ve(v) {
    let A = 0, Y = 0, de = v.width, pe = v.height;
    for (; A < pe && Pe(v, A, Y, de); )
      A++;
    for (; pe > A && Pe(v, pe - 1, Y, de); )
      pe--;
    for (; Y < de && Re(v, Y, A, pe); )
      Y++;
    for (; de > Y && Re(v, de - 1, A, pe); )
      de--;
    return { top: A, left: Y, right: de, bottom: pe };
  }
  function Ge(v, A) {
    A ? "r" in A ? (ee(
      v,
      0
      /* ColorSpace.RGB */
    ), ee(v, Math.round(A.r * 257)), ee(v, Math.round(A.g * 257)), ee(v, Math.round(A.b * 257)), ee(v, 0)) : "fr" in A ? (ee(
      v,
      0
      /* ColorSpace.RGB */
    ), ee(v, Math.round(A.fr * 255 * 257)), ee(v, Math.round(A.fg * 255 * 257)), ee(v, Math.round(A.fb * 255 * 257)), ee(v, 0)) : "l" in A ? (ee(
      v,
      7
      /* ColorSpace.Lab */
    ), P(v, Math.round(A.l * 1e4)), P(v, Math.round(A.a < 0 ? A.a * 12800 : A.a * 12700)), P(v, Math.round(A.b < 0 ? A.b * 12800 : A.b * 12700)), ee(v, 0)) : "h" in A ? (ee(
      v,
      1
      /* ColorSpace.HSB */
    ), ee(v, Math.round(A.h * 65535)), ee(v, Math.round(A.s * 65535)), ee(v, Math.round(A.b * 65535)), ee(v, 0)) : "c" in A ? (ee(
      v,
      2
      /* ColorSpace.CMYK */
    ), ee(v, Math.round(A.c * 257)), ee(v, Math.round(A.m * 257)), ee(v, Math.round(A.y * 257)), ee(v, Math.round(A.k * 257))) : (ee(
      v,
      8
      /* ColorSpace.Grayscale */
    ), ee(v, Math.round(A.k * 1e4 / 255)), fe(v, 6)) : (ee(
      v,
      0
      /* ColorSpace.RGB */
    ), fe(v, 8));
  }
  function Be(v, A) {
    const Y = A.bounds.w, de = A.bounds.h, pe = { width: Y, height: de, data: A.data };
    H(v, 0);
    const oe = v.offset;
    H(v, 1), H(
      v,
      3
      /* ColorMode.RGB */
    ), P(v, A.x), P(v, A.y), N(v, A.name + "\0"), z(v, A.id, 1), H(v, 3), H(v, 0);
    const e = v.offset, i = A.bounds.y, r = A.bounds.x, h = i + de, w = r + Y;
    H(v, i), H(v, r), H(v, h), H(v, w), H(v, 24);
    for (let d = 0; d < 26; d++) {
      const L = d < 3 ? d : d === 25 ? 3 : -1;
      if (L < 0) {
        H(v, 0);
        continue;
      }
      const o = new Uint8Array(Y * de + 2 * de + 2 * Y + 16), _ = (0, c.writeDataRLE)(o, pe, [L], !1);
      H(v, 1), H(v, _.length + 4 + 16 + 2 + 1), H(v, 8), H(v, i), H(v, r), H(v, h), H(v, w), ee(v, 8), a(v, 1), he(v, _);
    }
    const U = v.offset - e;
    let Z = v.offset - oe;
    for (; Z % 4; )
      fe(v, 1), Z++;
    v.view.setUint32(e - 4, U, !1), v.view.setUint32(oe - 4, Z, !1);
  }
  return $e;
}
var Lt = {}, Ln;
function yi() {
  if (Ln) return Lt;
  Ln = 1, Object.defineProperty(Lt, "__esModule", { value: !0 }), Lt.readAbr = ye;
  const c = Qt(), q = bt(), k = ["off", "fade", "pen pressure", "pen tilt", "stylus wheel", "initial direction", "direction", "initial rotation", "rotation"], S = ["round point", "round blunt", "round curve", "round angle", "round fan", "flat point", "flat blunt", "flat curve", "flat angle", "flat fan"], l = ["erodible point", "erodible flat", "erodible round", "erodible square", "erodible triangle", "custom"], f = {
    _: "brush",
    MixB: "mixer brush",
    SmTl: "smudge brush"
    // PbTl
    // ErTl
  };
  function a(O) {
    return {
      control: k[O.bVTy],
      steps: O.fStp,
      jitter: (0, c.parsePercent)(O.jitter),
      minimum: (0, c.parsePercent)(O["Mnm "])
    };
  }
  function P(O) {
    switch (O._classID) {
      case "computedBrush":
        return {
          type: "computed",
          size: (0, c.parseUnitsToNumber)(O.Dmtr, "Pixels"),
          angle: (0, c.parseAngle)(O.Angl),
          roundness: (0, c.parsePercent)(O.Rndn),
          spacingOn: O.Intr,
          spacing: (0, c.parsePercent)(O.Spcn),
          flipX: O.flipX,
          flipY: O.flipY,
          hardness: (0, c.parsePercent)(O.Hrdn)
        };
      case "sampledBrush":
        return {
          type: "sampled",
          size: (0, c.parseUnitsToNumber)(O.Dmtr, "Pixels"),
          angle: (0, c.parseAngle)(O.Angl),
          roundness: (0, c.parsePercent)(O.Rndn),
          spacingOn: O.Intr,
          spacing: (0, c.parsePercent)(O.Spcn),
          flipX: O.flipX,
          flipY: O.flipY,
          name: O["Nm  "],
          sampledData: O.sampledData
        };
      case "dBrush":
        return {
          type: "dynamic",
          shape: S[O["Shp "]],
          angle: (0, c.parseAngle)(O.Angl),
          size: (0, c.parseUnitsToNumber)(O.Dmtr, "Pixels"),
          density: (0, c.parsePercent)(O.Dnst),
          length: (0, c.parsePercent)(O.Lngt),
          clumping: (0, c.parsePercent)(O.clumping),
          thickness: (0, c.parsePercent)(O.thickness),
          stiffness: (0, c.parsePercent)(O.stiffness),
          physics: O.physics,
          spacing: (0, c.parsePercent)(O.Spcn),
          spacingOn: O.Intr,
          flipX: O.flipX,
          flipY: O.flipY
        };
      case "dTips":
        return Object.assign(Object.assign({
          type: "tips",
          angle: (0, c.parseAngle)(O.Angl),
          size: (0, c.parseUnitsToNumber)(O.Dmtr, "Pixels"),
          shape: S[O["Shp "]],
          physics: O.physics,
          spacing: (0, c.parsePercent)(O.Spcn),
          spacingOn: O.Intr,
          flipX: O.flipX,
          flipY: O.flipY,
          // tips:
          tipsType: l[O.dtipsType],
          tipsLengthRatio: (0, c.parsePercent)(O.dtipsLengthRatio),
          tipsHardness: (0, c.parsePercent)(O.dtipsHardness)
        }, O.dtipsGridSize && O.dtipsErodibleTipHeightMap ? {
          tipsGridSize: O.dtipsGridSize,
          tipsErodibleTipHeightMap: ee(O.dtipsErodibleTipHeightMap)
        } : {}), {
          // airbrush
          tipsAirbrushCutoffAngle: O.dtipsAirbrushCutoffAngle,
          tipsAirbrushGranularity: (0, c.parsePercent)(O.dtipsAirbrushGranularity),
          tipsAirbrushStreakiness: (0, c.parsePercent)(O.dtipsAirbrushStreakiness),
          tipsAirbrushSplatSize: (0, c.parsePercent)(O.dtipsAirbrushSplatSize),
          tipsAirbrushSplatCount: O.dtipsAirbrushSplatCount
        });
      default:
        throw new Error(`Unknown brush classId: ${O._classID}`);
    }
  }
  function ee(O) {
    const y = [];
    for (let H = 0; H < O.byteLength; H++)
      y.push(O[H]);
    return y;
  }
  function ye(O, y = {}) {
    var H, V, le, ce;
    const ie = (0, q.createReader)(O.buffer, O.byteOffset, O.byteLength), he = (0, q.readInt16)(ie), fe = [], ne = [], B = [];
    if (he === 1 || he === 2)
      throw new Error(`Unsupported ABR version (${he})`);
    if (he === 6 || he === 7 || he === 9 || he === 10) {
      const z = (0, q.readInt16)(ie);
      if (z !== 1 && z !== 2)
        throw new Error("Unsupported ABR minor version");
      for (; ie.offset < ie.view.byteLength; ) {
        (0, q.checkSignature)(ie, "8BIM");
        const C = (0, q.readSignature)(ie);
        let F = (0, q.readUint32)(ie);
        const N = ie.offset + F;
        switch (C) {
          case "samp": {
            for (; ie.offset < N; ) {
              let J = (0, q.readUint32)(ie);
              for (; J & 3; )
                J++;
              const W = ie.offset + J, n = (0, q.readPascalString)(ie, 1);
              (0, q.skipBytes)(ie, z === 1 ? 10 : 264);
              const p = (0, q.readInt32)(ie), g = (0, q.readInt32)(ie), E = (0, q.readInt32)(ie) - p, G = (0, q.readInt32)(ie) - g;
              if (G <= 0 || E <= 0)
                throw new Error("Invalid bounds");
              const M = (0, q.readInt16)(ie), re = (0, q.readUint8)(ie), Q = new Uint8Array(G * E);
              if (M === 8)
                if (re === 0)
                  Q.set((0, q.readBytes)(ie, Q.byteLength));
                else if (re === 1)
                  (0, q.readDataRLE)(ie, { width: G, height: E, data: Q }, G, E, M, 1, [0], !1);
                else
                  throw new Error("Invalid compression");
              else if (M === 16)
                if (re === 0)
                  for (let se = 0; se < Q.byteLength; se++)
                    Q[se] = (0, q.readUint16)(ie) >> 8;
                else throw re === 1 ? new Error("not implemented (16bit RLE)") : new Error("Invalid compression");
              else
                throw new Error("Invalid depth");
              fe.push({ id: n, bounds: { x: g, y: p, w: G, h: E }, alpha: Q }), ie.offset = W;
            }
            break;
          }
          case "desc": {
            const J = (0, c.readVersionAndDescriptor)(ie, !0);
            for (const W of J.Brsh) {
              const n = {
                name: W["Nm  "],
                shape: P(W.Brsh),
                spacing: (0, c.parsePercent)(W.Spcn),
                // TODO: brushGroup ???
                wetEdges: W.Wtdg,
                noise: W.Nose,
                // TODO: TxtC ??? smoothing / build-up ?
                // TODO: 'Rpt ' ???
                useBrushSize: W.useBrushSize
                // ???
              };
              W.interpretation != null && (n.interpretation = W.interpretation), W.protectTexture != null && (n.protectTexture = W.protectTexture), W.useTipDynamics && (n.shapeDynamics = {
                tiltScale: (0, c.parsePercent)(W.tiltScale),
                sizeDynamics: a(W.szVr),
                angleDynamics: a(W.angleDynamics),
                roundnessDynamics: a(W.roundnessDynamics),
                flipX: W.flipX,
                flipY: W.flipY,
                brushProjection: W.brushProjection,
                minimumDiameter: (0, c.parsePercent)(W.minimumDiameter),
                minimumRoundness: (0, c.parsePercent)(W.minimumRoundness)
              }), W.useScatter && (n.scatter = {
                count: W["Cnt "],
                bothAxes: W.bothAxes,
                countDynamics: a(W.countDynamics),
                scatterDynamics: a(W.scatterDynamics)
              }), W.useTexture && W.Txtr && (n.texture = {
                id: W.Txtr.Idnt,
                name: W.Txtr["Nm  "],
                blendMode: c.BlnM.decode(W.textureBlendMode),
                depth: (0, c.parsePercent)(W.textureDepth),
                depthMinimum: (0, c.parsePercent)(W.minimumDepth),
                depthDynamics: a(W.textureDepthDynamics),
                scale: (0, c.parsePercent)(W.textureScale),
                invert: W.InvT,
                brightness: W.textureBrightness,
                contrast: W.textureContrast,
                textureEachTip: !!W.TxtC
              });
              const p = W.dualBrush;
              p && p.useDualBrush && (n.dualBrush = {
                flip: p.Flip,
                shape: P(p.Brsh),
                blendMode: c.BlnM.decode(p.BlnM),
                useScatter: p.useScatter,
                spacing: (0, c.parsePercent)(p.Spcn),
                count: p["Cnt "],
                bothAxes: p.bothAxes,
                countDynamics: a(p.countDynamics),
                scatterDynamics: a(p.scatterDynamics)
              }), W.useColorDynamics && (n.colorDynamics = {
                foregroundBackground: a(W.clVr),
                hue: (0, c.parsePercent)(W["H   "]),
                saturation: (0, c.parsePercent)(W.Strt),
                brightness: (0, c.parsePercent)(W.Brgh),
                purity: (0, c.parsePercent)(W.purity),
                perTip: W.colorDynamicsPerTip
              }), W.usePaintDynamics && (n.transfer = {
                flowDynamics: a(W.prVr),
                opacityDynamics: a(W.opVr),
                wetnessDynamics: a(W.wtVr),
                mixDynamics: a(W.mxVr)
              }), W.useBrushPose && (n.brushPose = {
                overrideAngle: W.overridePoseAngle,
                overrideTiltX: W.overridePoseTiltX,
                overrideTiltY: W.overridePoseTiltY,
                overridePressure: W.overridePosePressure,
                pressure: (0, c.parsePercent)(W.brushPosePressure),
                tiltX: W.brushPoseTiltX,
                tiltY: W.brushPoseTiltY,
                angle: W.brushPoseAngle
              });
              const g = W.toolOptions;
              g && (n.toolOptions = {
                type: f[g._classID] || "brush",
                brushPreset: g.brushPreset,
                flow: (H = g.flow) !== null && H !== void 0 ? H : 100,
                smooth: (V = g.Smoo) !== null && V !== void 0 ? V : 0,
                mode: c.BlnM.decode(g["Md  "] || "BlnM.Nrml"),
                // sometimes mode is missing
                opacity: (le = g.Opct) !== null && le !== void 0 ? le : 100,
                smoothing: !!g.smoothing,
                smoothingValue: g.smoothingValue || 0,
                smoothingRadiusMode: !!g.smoothingRadiusMode,
                smoothingCatchup: !!g.smoothingCatchup,
                smoothingCatchupAtEnd: !!g.smoothingCatchupAtEnd,
                smoothingZoomCompensation: !!g.smoothingZoomCompensation,
                pressureSmoothing: !!g.pressureSmoothing,
                usePressureOverridesSize: !!g.usePressureOverridesSize,
                usePressureOverridesOpacity: !!g.usePressureOverridesOpacity,
                useLegacy: !!g.useLegacy
              }, g.prVr && (n.toolOptions.flowDynamics = a(g.prVr)), g.opVr && (n.toolOptions.opacityDynamics = a(g.opVr)), g.szVr && (n.toolOptions.sizeDynamics = a(g.szVr)), "wetness" in g && (n.toolOptions.wetness = g.wetness), "dryness" in g && (n.toolOptions.dryness = g.dryness), "mix" in g && (n.toolOptions.mix = g.mix), "autoFill" in g && (n.toolOptions.autoFill = g.autoFill), "autoClean" in g && (n.toolOptions.autoClean = g.autoClean), "loadSolidColorOnly" in g && (n.toolOptions.loadSolidColorOnly = g.loadSolidColorOnly), "sampleAllLayers" in g && (n.toolOptions.sampleAllLayers = g.sampleAllLayers), "SmdF" in g && (n.toolOptions.smudgeFingerPainting = g.SmdF), "SmdS" in g && (n.toolOptions.smudgeSampleAllLayers = g.SmdS), "Prs " in g && (n.toolOptions.strength = g["Prs "])), ne.push(n);
            }
            break;
          }
          case "patt": {
            for (; ie.offset < N; )
              B.push((0, q.readPattern)(ie));
            ie.offset = N;
            break;
          }
          case "phry": {
            const J = (0, c.readVersionAndDescriptor)(ie);
            y.logMissingFeatures && !((ce = J.hierarchy) === null || ce === void 0) && ce.length;
            break;
          }
          default:
            throw new Error(`Invalid brush type: ${C}`);
        }
        for (; F % 4; )
          ie.offset++, F++;
      }
    } else
      throw new Error(`Unsupported ABR version (${he})`);
    return { samples: fe, patterns: B, brushes: ne };
  }
  return Lt;
}
var Mt = {}, Mn;
function wi() {
  if (Mn) return Mt;
  Mn = 1, Object.defineProperty(Mt, "__esModule", { value: !0 }), Mt.readCsh = k;
  const c = en(), q = bt();
  function k(S) {
    const l = (0, q.createReader)(S.buffer, S.byteOffset, S.byteLength), f = { shapes: [] };
    if ((0, q.checkSignature)(l, "cush"), (0, q.readUint32)(l) !== 2)
      throw new Error("Invalid version");
    const a = (0, q.readUint32)(l);
    for (let P = 0; P < a; P++) {
      const ee = (0, q.readUnicodeString)(l);
      for (; l.offset % 4; )
        l.offset++;
      if ((0, q.readUint32)(l) !== 1)
        throw new Error("Invalid shape version");
      const ye = (0, q.readUint32)(l), O = l.offset + ye, y = (0, q.readPascalString)(l, 1), H = (0, q.readUint32)(l), V = (0, q.readUint32)(l), le = (0, q.readUint32)(l), ie = (0, q.readUint32)(l) - V, he = le - H, fe = { paths: [] };
      (0, c.readVectorMask)(l, fe, ie, he, O - l.offset), f.shapes.push(Object.assign({ name: ee, id: y, width: ie, height: he }, fe)), l.offset = O;
    }
    return f;
  }
  return Mt;
}
var Ye = {}, Tn;
function Si() {
  if (Tn) return Ye;
  Tn = 1, Object.defineProperty(Ye, "__esModule", { value: !0 }), Ye.Compression = Ye.ChannelID = Ye.LayerCompCapturedInfo = Ye.SectionDividerType = Ye.ColorMode = void 0;
  var c;
  (function(f) {
    f[f.Bitmap = 0] = "Bitmap", f[f.Grayscale = 1] = "Grayscale", f[f.Indexed = 2] = "Indexed", f[f.RGB = 3] = "RGB", f[f.CMYK = 4] = "CMYK", f[f.Multichannel = 7] = "Multichannel", f[f.Duotone = 8] = "Duotone", f[f.Lab = 9] = "Lab";
  })(c || (Ye.ColorMode = c = {}));
  var q;
  (function(f) {
    f[f.Other = 0] = "Other", f[f.OpenFolder = 1] = "OpenFolder", f[f.ClosedFolder = 2] = "ClosedFolder", f[f.BoundingSectionDivider = 3] = "BoundingSectionDivider";
  })(q || (Ye.SectionDividerType = q = {}));
  var k;
  (function(f) {
    f[f.None = 0] = "None", f[f.Visibility = 1] = "Visibility", f[f.Position = 2] = "Position", f[f.Appearance = 4] = "Appearance";
  })(k || (Ye.LayerCompCapturedInfo = k = {}));
  var S;
  (function(f) {
    f[f.Color0 = 0] = "Color0", f[f.Color1 = 1] = "Color1", f[f.Color2 = 2] = "Color2", f[f.Color3 = 3] = "Color3", f[f.Transparency = -1] = "Transparency", f[f.UserMask = -2] = "UserMask", f[f.RealUserMask = -3] = "RealUserMask";
  })(S || (Ye.ChannelID = S = {}));
  var l;
  return (function(f) {
    f[f.RawData = 0] = "RawData", f[f.RleCompressed = 1] = "RleCompressed", f[f.ZipWithoutPrediction = 2] = "ZipWithoutPrediction", f[f.ZipWithPrediction = 3] = "ZipWithPrediction";
  })(l || (Ye.Compression = l = {})), Ye;
}
var Rn;
function _i() {
  return Rn || (Rn = 1, (function(c) {
    var q = ct && ct.__createBinding || (Object.create ? (function(y, H, V, le) {
      le === void 0 && (le = V);
      var ce = Object.getOwnPropertyDescriptor(H, V);
      (!ce || ("get" in ce ? !H.__esModule : ce.writable || ce.configurable)) && (ce = { enumerable: !0, get: function() {
        return H[V];
      } }), Object.defineProperty(y, le, ce);
    }) : (function(y, H, V, le) {
      le === void 0 && (le = V), y[le] = H[V];
    })), k = ct && ct.__exportStar || function(y, H) {
      for (var V in y) V !== "default" && !Object.prototype.hasOwnProperty.call(H, V) && q(H, y, V);
    };
    Object.defineProperty(c, "__esModule", { value: !0 }), c.getCompositeCanvas = c.getCompositeImageData = c.getLayerRealMaskCanvas = c.getLayerMaskCanvas = c.getLayerCanvas = c.getLayerRealMaskImageData = c.getLayerMaskImageData = c.getLayerImageData = c.decodeLayerPixels = c.byteArrayToBase64 = c.initializeCanvas = void 0, c.readPsd = P, c.writePsd = ee, c.writePsdUint8Array = ye, c.writePsdBuffer = O;
    const S = At(), l = bt();
    Object.defineProperty(c, "decodeLayerPixels", { enumerable: !0, get: function() {
      return l.decodeLayerPixels;
    } }), Object.defineProperty(c, "getLayerImageData", { enumerable: !0, get: function() {
      return l.getLayerImageData;
    } }), Object.defineProperty(c, "getLayerMaskImageData", { enumerable: !0, get: function() {
      return l.getLayerMaskImageData;
    } }), Object.defineProperty(c, "getLayerRealMaskImageData", { enumerable: !0, get: function() {
      return l.getLayerRealMaskImageData;
    } }), Object.defineProperty(c, "getLayerCanvas", { enumerable: !0, get: function() {
      return l.getLayerCanvas;
    } }), Object.defineProperty(c, "getLayerMaskCanvas", { enumerable: !0, get: function() {
      return l.getLayerMaskCanvas;
    } }), Object.defineProperty(c, "getLayerRealMaskCanvas", { enumerable: !0, get: function() {
      return l.getLayerRealMaskCanvas;
    } }), Object.defineProperty(c, "getCompositeImageData", { enumerable: !0, get: function() {
      return l.getCompositeImageData;
    } }), Object.defineProperty(c, "getCompositeCanvas", { enumerable: !0, get: function() {
      return l.getCompositeCanvas;
    } });
    const f = Jt();
    k(yi(), c), k(wi(), c);
    var a = mt();
    Object.defineProperty(c, "initializeCanvas", { enumerable: !0, get: function() {
      return a.initializeCanvas;
    } }), k(Si(), c), c.byteArrayToBase64 = f.fromByteArray;
    function P(y, H) {
      const V = "buffer" in y ? (0, l.createReader)(y.buffer, y.byteOffset, y.byteLength) : (0, l.createReader)(y);
      return (0, l.readPsd)(V, H);
    }
    function ee(y, H) {
      const V = (0, S.createWriter)();
      return (0, S.writePsd)(V, y, H), (0, S.getWriterBuffer)(V);
    }
    function ye(y, H) {
      const V = (0, S.createWriter)();
      return (0, S.writePsd)(V, y, H), (0, S.getWriterBufferNoCopy)(V);
    }
    function O(y, H) {
      if (typeof Buffer > "u")
        throw new Error("Buffer not supported on this platform");
      return Buffer.from(ye(y, H));
    }
  })(ct)), ct;
}
var qn = _i();
qn.initializeCanvas(Vn);
async function vi(c, q = {}) {
  const k = q.meshDensity ?? 2, S = qn.readPsd(c, {
    skipThumbnail: !0,
    skipCompositeImageData: !0
  });
  try {
    let H = function(le, ce) {
      var he, fe;
      if (le.hidden)
        return;
      const ie = Ii(le.name || `layer_${ee.length + 1}`);
      if (le.children && le.children.length > 0) {
        ee.push({
          id: ie,
          name: le.name || ie,
          parent_id: ce,
          visible: !0,
          locked: !1,
          kind: { type: "Part", collapsed: !1 }
        });
        for (const ne of le.children)
          H(ne, ie);
        return;
      }
      if (le.canvas || le.width && le.height) {
        const ne = le.left ?? 0, B = le.top ?? 0, z = le.width ?? ((he = le.canvas) == null ? void 0 : he.width) ?? 0, C = le.height ?? ((fe = le.canvas) == null ? void 0 : fe.height) ?? 0;
        if (z <= 0 || C <= 0)
          return;
        const F = `tex_${ie}`, N = `${ie}.png`;
        let J;
        if (le.canvas && typeof le.canvas.toBuffer == "function") {
          const p = le.canvas;
          try {
            J = p.toBuffer("image/png");
          } finally {
            pt(p), delete le.canvas;
          }
        } else {
          const p = Vn(z, C);
          try {
            const g = p.getContext("2d");
            le.canvas && g.drawImage(le.canvas, 0, 0), J = p.toBuffer("image/png");
          } finally {
            pt(p);
          }
        }
        ye.push({
          id: F,
          path: `textures/${N}`,
          width: z,
          height: C
        }), O.push({
          id: F,
          buffer: J,
          filename: N
        });
        const W = P.get(ie);
        let n;
        if (W && W.kind.type === "ArtMesh")
          n = {
            ...W.kind,
            texture_id: F
          };
        else {
          const p = ii(ne, B, z, C, k);
          n = {
            texture_id: F,
            vertices: p.vertices,
            uvs: p.uvs,
            indices: p.indices,
            blend_mode: "normal",
            opacity: le.opacity ?? 1,
            draw_order: y++,
            mask_ids: []
          };
        }
        ee.push({
          id: ie,
          name: le.name || ie,
          parent_id: W ? W.parent_id : ce,
          visible: !0,
          locked: !1,
          kind: {
            type: "ArtMesh",
            ...n
          }
        });
      }
    };
    const l = S.width, f = S.height, a = q.existingProject, P = /* @__PURE__ */ new Map();
    if (a)
      for (const le of a.nodes)
        P.set(le.id, le);
    const ee = [], ye = [], O = [];
    let y = 10;
    if (S.children)
      for (const le of S.children)
        H(le, null);
    return { project: {
      format_version: 1,
      canvas: {
        width: l,
        height: f,
        origin_x: 0.5,
        origin_y: 0.5,
        background_color: "#18181b"
      },
      parameters: (a == null ? void 0 : a.parameters) ?? [
        { id: "ParamAngleX", name: "Angle X", min: -30, max: 30, default: 0 },
        { id: "ParamAngleY", name: "Angle Y", min: -30, max: 30, default: 0 },
        { id: "ParamEyeLOpen", name: "Eye Left Open", min: 0, max: 1, default: 1 },
        { id: "ParamEyeROpen", name: "Eye Right Open", min: 0, max: 1, default: 1 },
        { id: "ParamMouthForm", name: "Mouth Form", min: -1, max: 1, default: 0 },
        { id: "ParamMouthOpen", name: "Mouth Open", min: 0, max: 1, default: 0 }
      ],
      nodes: ee,
      keyforms: (a == null ? void 0 : a.keyforms) ?? [],
      textures: ye
    }, extractedTextures: O };
  } finally {
    ki(S), ni();
  }
}
function pt(c) {
  if (c)
    try {
      c.width = 0, c.height = 0;
    } catch {
    }
}
function ki(c) {
  const q = (k) => {
    pt(k.canvas), delete k.canvas, pt(k.thumbnail), delete k.thumbnail;
    for (const S of [k.mask, k.realMask])
      S && (pt(S.canvas), delete S.canvas);
    for (const S of k.children ?? [])
      q(S);
  };
  pt(c.canvas), delete c.canvas, pt(c.thumbnail), delete c.thumbnail;
  for (const k of c.children ?? [])
    q(k);
}
function Ii(c) {
  return c.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, "");
}
const Bn = it.dirname(ti(import.meta.url));
let nt = null;
function jn() {
  nt = new zn({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#141416",
    title: "L2DEditor",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 10 },
    webPreferences: {
      preload: it.join(Bn, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), process.env.VITE_DEV_SERVER_URL ? nt.loadURL(process.env.VITE_DEV_SERVER_URL) : nt.loadFile(it.join(Bn, "../dist/index.html")), nt.on("closed", () => {
    nt = null;
  });
}
Tt.whenReady().then(() => {
  jn(), Tt.on("activate", () => {
    zn.getAllWindows().length === 0 && jn();
  });
});
Tt.on("window-all-closed", () => {
  process.platform !== "darwin" && Tt.quit();
});
Rt.handle("l2d:open-project-dialog", async () => {
  if (!nt) return null;
  const { canceled: c, filePaths: q } = await Kt.showOpenDialog(nt, {
    title: "Open L2DEditor Project",
    properties: ["openDirectory", "openFile"],
    filters: [{ name: "L2D Project", extensions: ["json", "l2dproj"] }]
  });
  if (c || q.length === 0) return null;
  let k = q[0];
  if (ot.statSync(k).isDirectory() && (k = it.join(k, "project.json")), ot.existsSync(k)) {
    const S = ot.readFileSync(k, "utf-8");
    return { path: k, content: S };
  }
  return null;
});
Rt.handle("l2d:save-project", async (c, q, k) => {
  try {
    return ot.writeFileSync(q, k, "utf-8"), !0;
  } catch (S) {
    return console.error("Failed to save project:", S), !1;
  }
});
Rt.handle("l2d:save-project-as-dialog", async (c, q, k) => {
  if (!nt) return null;
  const { canceled: S, filePath: l } = await Kt.showSaveDialog(nt, {
    title: "Save Project As",
    defaultPath: k || "project.json",
    filters: [
      { name: "L2D Project JSON", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (S || !l) return null;
  try {
    return ot.writeFileSync(l, q, "utf-8"), { path: l, success: !0 };
  } catch (f) {
    return console.error("Failed to save project:", f), { error: f.message || String(f), success: !1 };
  }
});
Rt.handle("l2d:import-psd-dialog", async () => {
  if (!nt) return null;
  const { canceled: c, filePaths: q } = await Kt.showOpenDialog(nt, {
    title: "Select Photoshop (.psd) File",
    filters: [{ name: "Photoshop Document", extensions: ["psd"] }],
    properties: ["openFile"]
  });
  if (c || q.length === 0) return null;
  const k = q[0], S = it.join(it.dirname(k), `${it.basename(k, ".psd")}.l2dproj`);
  try {
    const l = ot.readFileSync(k), { project: f, extractedTextures: a } = await vi(l, { meshDensity: 2 });
    ot.mkdirSync(S, { recursive: !0 });
    const P = it.join(S, "textures");
    ot.mkdirSync(P, { recursive: !0 });
    for (const O of a)
      ot.writeFileSync(it.join(P, O.filename), O.buffer);
    const ee = it.join(S, "project.json"), ye = JSON.stringify(f, null, 2);
    return ot.writeFileSync(ee, ye, "utf-8"), { outputPath: ee, projectContent: ye };
  } catch (l) {
    return console.error("Failed to import PSD:", l), null;
  }
});
