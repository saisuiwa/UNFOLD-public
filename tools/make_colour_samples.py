"""Colour sample GLBs for UNFOLD: 1 object up to 100 objects, each with its own colours.

Run:  python3 tools/make_colour_samples.py <out_dir> [id ...]
Writes <out_dir>/<id>.glb and <out_dir>/samples.json (id, name, objects, triangles).
Colours are vertex colours (COLOR_0, linear) except the earth, which uses an embedded PNG texture
(so both ways UNFOLD reads colours are covered). No third-party packages.
"""
import json, math, os, random, struct, sys, zlib

def lin(c):  # sRGB 0-255 -> linear 0-1
    c = c / 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def vnoise(x, y, z, seed=0):
    """smooth value noise in 3D (for patterns that wrap around a sphere without seams)"""
    def h(i, j, k):
        n = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) ^ (seed * 2654435761)
        n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
        return (n & 0xffff) / 0xffff
    xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
    xf, yf, zf = x - xi, y - yi, z - zi
    s = lambda t: t * t * (3 - 2 * t)
    u, v, w = s(xf), s(yf), s(zf)
    def L(a, b, t): return a + (b - a) * t
    return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
             L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w)

def fbm(x, y, z, seed=0, oct=4):
    a, f, s = .5, 1, 0
    for o in range(oct): s += a * vnoise(x * f, y * f, z * f, seed + o); a *= .5; f *= 2
    return s


class Obj:
    """one object = one glTF node/mesh. positions, colours (sRGB 0-255, per vertex), optional uv, triangle indices"""
    def __init__(self): self.p, self.c, self.uv, self.i = [], [], [], []
    def v(self, pos, col, uv=None):
        self.p.append(pos); self.c.append(col)
        if uv is not None: self.uv.append(uv)
        return len(self.p) - 1
    def tri(self, a, b, c): self.i += [a, b, c]


def grid(o, nu, nv, fn):
    """surface from fn(u,v) -> (pos, colour[, uv]) on a (nu+1)x(nv+1) grid"""
    base = len(o.p)
    for j in range(nv + 1):
        for i in range(nu + 1):
            r = fn(i / nu, j / nv); o.v(r[0], r[1], r[2] if len(r) > 2 else None)
    for j in range(nv):
        for i in range(nu):
            a = base + j * (nu + 1) + i; b = a + nu + 1
            o.tri(a, b, a + 1); o.tri(a + 1, b, b + 1)
    return o


def sphere(c, r, col, seg=48, ring=24, sq=(1, 1, 1), uv=False):
    """col(nx,ny,nz,u,v) -> sRGB"""
    def f(u, v):
        th, ph = v * math.pi, u * 2 * math.pi
        n = (math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph))
        p = tuple(c[k] + n[k] * r * sq[k] for k in range(3))
        return (p, col(*n, u, v), (u, v)) if uv else (p, col(*n, u, v))
    return grid(Obj(), seg, ring, f)


def torus(c, R, r, col, seg=96, ring=40):
    def f(u, v):
        a, b = u * 2 * math.pi, v * 2 * math.pi
        x = (R + r * math.cos(b)) * math.cos(a); z = (R + r * math.cos(b)) * math.sin(a); y = r * math.sin(b)
        return ((c[0] + x, c[1] + y, c[2] + z), col(u, v, math.sin(b)))
    return grid(Obj(), seg, ring, f)


def lathe(c, profile, col, seg=48):
    """surface of revolution around y: profile = [(radius, y), ...] bottom to top; col(t_along_profile, angle_u, y)"""
    n = len(profile) - 1
    def f(u, t):
        k = min(n - 1, int(t * n)); w = t * n - k
        rad = profile[k][0] + (profile[k + 1][0] - profile[k][0]) * w
        y = profile[k][1] + (profile[k + 1][1] - profile[k][1]) * w
        a = u * 2 * math.pi
        return ((c[0] + rad * math.cos(a), c[1] + y, c[2] + rad * math.sin(a)), col(t, u, y))
    return grid(Obj(), seg, max(8, n * 6), f)


def box(c, s, col, rot=0.0):
    o = Obj(); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    cs, sn = math.cos(rot), math.sin(rot)
    def P(x, y, z): return (c[0] + x * cs - z * sn, c[1] + y, c[2] + x * sn + z * cs)
    faces = [((1, 0, 0), (0, 1, 0), (0, 0, 1)), ((-1, 0, 0), (0, 1, 0), (0, 0, -1)), ((0, 1, 0), (0, 0, 1), (1, 0, 0)),
             ((0, -1, 0), (0, 0, -1), (1, 0, 0)), ((0, 0, 1), (1, 0, 0), (0, 1, 0)), ((0, 0, -1), (-1, 0, 0), (0, 1, 0))]
    for n, a, b in faces:
        shade = .82 + .18 * (n[1] + 1) / 2   # a little baked shading so faces read apart even when flat-coloured
        cc = tuple(min(255, x * shade) for x in col)
        q = []
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            q.append(o.v(P(n[0] * hx + (a[0] * su + b[0] * sv) * hx, n[1] * hy + (a[1] * su + b[1] * sv) * hy, n[2] * hz + (a[2] * su + b[2] * sv) * hz), cc))
        o.tri(q[0], q[1], q[2]); o.tri(q[0], q[2], q[3])
    return o


def star(c, r, depth, col, points=5, rot=0.0, tilt=0.0):
    """extruded star prism"""
    o = Obj(); pts = []
    for k in range(points * 2):
        a = rot + k * math.pi / points; rr = r if k % 2 == 0 else r * .45
        pts.append((rr * math.sin(a), rr * math.cos(a)))
    ct, st = math.cos(tilt), math.sin(tilt)
    def P(x, y, z): return (c[0] + x, c[1] + y * ct - z * st, c[2] + y * st + z * ct)
    for side, z in ((1, depth / 2), (-1, -depth / 2)):
        m = o.v(P(0, 0, z), col); ring = [o.v(P(x, y, z), col) for x, y in pts]
        for k in range(len(ring)):
            a, b = ring[k], ring[(k + 1) % len(ring)]
            o.tri(m, b, a) if side > 0 else o.tri(m, a, b)
    dark = tuple(x * .7 for x in col)
    for k in range(len(pts)):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % len(pts)]
        q = [o.v(P(x0, y0, depth / 2), dark), o.v(P(x1, y1, depth / 2), dark), o.v(P(x1, y1, -depth / 2), dark), o.v(P(x0, y0, -depth / 2), dark)]
        o.tri(q[0], q[2], q[1]); o.tri(q[0], q[3], q[2])
    return o


def png(w, h, px):
    raw = b''.join(b'\x00' + bytes(v for x in range(w) for v in px(x, y)) for y in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b'')


def write_glb(path, objs, texture=None, fit=None):
    """objs: list of Obj. texture: (png_bytes, index of the obj that uses it via its uv) or None.
    fit='frame' marks a scene meant to fill the 16:9 picture (asset.extras.unfold.fit, read by app/model-import.js)"""
    bin_ = bytearray(); views, acc = [], []
    def add(vals, fmt, typ, ctype, target, count, minmax=None):
        while len(bin_) % 4: bin_.append(0)
        raw = struct.pack('<' + fmt * len(vals), *vals); off = len(bin_); bin_.extend(raw)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': count, 'type': typ}
        if minmax: a.update(minmax)
        acc.append(a); return len(acc) - 1
    meshes, nodes, tris = [], [], 0
    for k, o in enumerate(objs):
        flat = [x for p in o.p for x in p]
        mm = {'min': [min(flat[i::3]) for i in range(3)], 'max': [max(flat[i::3]) for i in range(3)]}
        attrs = {'POSITION': add(flat, 'f', 'VEC3', 5126, 34962, len(o.p), mm)}
        textured = texture is not None and texture[1] == k
        if textured: attrs['TEXCOORD_0'] = add([x for t in o.uv for x in t], 'f', 'VEC2', 5126, 34962, len(o.uv))
        else: attrs['COLOR_0'] = add([lin(x) for c in o.c for x in c], 'f', 'VEC3', 5126, 34962, len(o.c))
        prim = {'attributes': attrs, 'indices': add(o.i, 'I', 'SCALAR', 5125, 34963, len(o.i)), 'material': 1 if textured else 0}
        meshes.append({'primitives': [prim]}); nodes.append({'mesh': k}); tris += len(o.i) // 3
    gl = {'asset': {'version': '2.0', 'generator': 'UNFOLD make_colour_samples.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
          'nodes': nodes, 'meshes': meshes, 'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .8}}]}
    if fit: gl['asset']['extras'] = {'unfold': {'fit': fit}}
    if texture:
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); bin_.extend(texture[0]); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(texture[0])})
        gl['materials'].append({'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .8}})
        gl['textures'] = [{'source': 0, 'sampler': 0}]; gl['samplers'] = [{'magFilter': 9729, 'minFilter': 9729}]
        gl['images'] = [{'bufferView': len(views) - 1, 'mimeType': 'image/png'}]
    while len(bin_) % 4: bin_.append(0)
    gl.update({'buffers': [{'byteLength': len(bin_)}], 'bufferViews': views, 'accessors': acc})
    j = json.dumps(gl, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(j) + len(bin_)) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_))
    return tris


# ---- the samples ------------------------------------------------------------------------------------------------------

def watermelon():
    dark, light = rgb('1f6b2a'), rgb('7cc35a')
    def col(x, y, z, u, v):
        a = math.atan2(z, x) + .35 * (fbm(x * 2, y * 2, z * 2, 3) - .5) * 2
        stripe = (math.sin(a * 8) + 1) / 2
        return mix(light, dark, stripe ** .6)
    return [sphere((0, 0, 0), 1, col, 96, 48, sq=(1.12, .95, 1))]


def earth():
    W, H = 512, 256
    ocean, deep, land, hill, ice = rgb('2a7fd4'), rgb('17508f'), rgb('5aa845'), rgb('a3894e'), rgb('f2f6f8')
    def px(x, y):
        u, v = x / W, y / H; th, ph = v * math.pi, u * 2 * math.pi
        n = (math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph))
        e = fbm(n[0] * 1.8 + 3, n[1] * 1.8, n[2] * 1.8, 11, 5)
        if abs(n[1]) > .88: return ice
        if e < .52: return tuple(int(x) for x in mix(deep, ocean, min(1, max(0, (e - .35) / .17))))
        return tuple(int(x) for x in mix(land, hill, min(1, (e - .52) / .15)))
    return [sphere((0, 0, 0), 1, lambda *a: (255, 255, 255), 96, 48, uv=True)], png(W, H, px)


def donut():
    icing, dough, rim = rgb('f48fb1'), rgb('d99a52'), rgb('b8742f')
    sprinkles = [rgb(h) for h in ('ffffff', 'ffd54f', '4fc3f7', '81c784', 'ba68c8', 'ff7043')]
    rnd = random.Random(7); spots = [(rnd.random(), rnd.uniform(.05, .45), rnd.choice(sprinkles)) for _ in range(90)]
    def col(u, v, top):
        edge = .15 + .08 * math.sin(u * 2 * math.pi * 9)
        if top > -edge:
            for su, sv, c in spots:
                du = min(abs(u - su), 1 - abs(u - su)) * 6; dv = abs(v - sv)
                if du * du + dv * dv < .0009: return c
            return icing
        return mix(dough, rim, .5 + .5 * math.cos(v * 2 * math.pi))
    return [torus((0, 0, 0), 1, .45, col, 160, 64)]


def saturn():
    band = [rgb(h) for h in ('e8d3a6', 'd8b27a', 'c9935a', 'eedfba', 'b98a55')]
    planet = sphere((0, 0, 0), 1, lambda x, y, z, u, v: band[int((y * .5 + .5) * 14 + 2 * fbm(x * 3, y * 3, z * 3, 5)) % len(band)], 72, 36)
    ring = Obj()
    rc = [rgb('cdb38a'), rgb('8a7a62'), rgb('e9dcc0'), rgb('a99470')]
    def f(u, t):
        rr = 1.35 + t * .9; a = u * 2 * math.pi
        return ((rr * math.cos(a), 0, rr * math.sin(a)), rc[int(t * 7.99) % len(rc)])
    grid(ring, 128, 8, f)
    # single sided is enough: UNFOLD draws both sides
    tilt = math.radians(22)
    for o in (planet, ring):
        o.p = [(x, y * math.cos(tilt) - z * math.sin(tilt), y * math.sin(tilt) + z * math.cos(tilt)) for x, y, z in o.p]
    return [planet, ring]


def mushroom():
    red, white, cream, gill = rgb('e53935'), rgb('fffaf0'), rgb('f3e2c3'), rgb('d8c3a0')
    rnd = random.Random(3); dots = [(rnd.uniform(-1, 1), rnd.uniform(.25, 1), rnd.uniform(-1, 1)) for _ in range(40)]
    dots = [tuple(d / math.sqrt(sum(x * x for x in dd)) for d in dd) for dd in dots]
    def capcol(x, y, z, u, v):
        if y < .05: return gill
        for d in dots:
            if (x - d[0]) ** 2 + (y - d[1]) ** 2 + (z - d[2]) ** 2 < .03: return white
        return red
    cap = sphere((0, .55, 0), 1.1, capcol, 72, 36, sq=(1, .62, 1))
    cap.i = [k for t in range(0, len(cap.i), 3) for k in cap.i[t:t + 3] if all(cap.p[q][1] >= .5 for q in cap.i[t:t + 3])]
    stem = lathe((0, -1, 0), [(.38, 0), (.42, .4), (.36, 1.1), (.4, 1.6)], lambda t, u, y: cream, 48)
    return [cap, stem]


def icecream():
    waffle, line = rgb('e0a85a'), rgb('a86b2c')
    def conecol(t, u, y):
        a = u * 2 * math.pi
        g = (math.sin(a * 6 + y * 9) > .93) or (math.sin(a * 6 - y * 9) > .93)
        return line if g else waffle
    cone = lathe((0, -1.6, 0), [(0.02, 0), (.62, 1.7)], conecol, 64)
    def scoop(base, spot):
        return lambda x, y, z, u, v: spot if fbm(x * 5, y * 5, z * 5, 9) > .68 else mix(base, (255, 255, 255), .1 * vnoise(x * 9, y * 9, z * 9))
    straw = sphere((0, .45, 0), .7, scoop(rgb('f6a6c1'), rgb('c2185b')), 64, 32)
    mint = sphere((0, 1.38, 0), .6, scoop(rgb('a5e3c8'), rgb('4e342e')), 64, 32)
    return [cone, straw, mint]


def snowman():
    snow, coal, carrot, hat, band = rgb('f7fbff'), rgb('263238'), rgb('ff7a1a'), rgb('37474f'), rgb('d32f2f')
    sc = lambda x, y, z, u, v: mix(snow, rgb('cfe3f5'), max(0, -y) * .5)
    body = sphere((0, -.9, 0), 1, sc, 64, 32); head = sphere((0, .45, 0), .62, sc, 48, 24)
    eyes = [sphere((sx * .22, .58, .55), .07, lambda *a: coal, 12, 8) for sx in (-1, 1)]
    nose = lathe((0, .42, .5), [(.11, 0), (.0, .55)], lambda *a: carrot, 24)
    nose.p = [(x, .42 + (z - .5), .5 + (y - .42)) for x, y, z in nose.p]   # point it forward
    top = lathe((0, .9, 0), [(.0, 0), (.62, 0), (.62, .05), (.38, .06), (.38, .7), (.0, .7)],
                lambda t, u, y: band if 1.0 < y < 1.12 else hat, 48)
    return [body, head, eyes[0], eyes[1], nose, top]


def solar():
    specs = [('ffb300', 1.0, 'ff6f00'), ('9e9e9e', .16, '757575'), ('e6b980', .26, 'c48a4a'), ('2e7dd7', .28, '43a047'),
             ('d84315', .2, '8d2c0b'), ('d7b48a', .6, 'a1774a'), ('ead9b0', .5, 'c9a86b'), ('80deea', .36, '4fb3bf'), ('3f51b5', .35, '283593')]
    objs, x = [], -3.6
    for k, (a, r, b) in enumerate(specs):
        x += r + (.18 if k else 0)
        ca, cb = rgb(a), rgb(b)
        objs.append(sphere((x, 0, 0), r, lambda X, Y, Z, u, v, ca=ca, cb=cb, k=k: mix(ca, cb, fbm(X * 3 + k, Y * 6, Z * 3, k)), 40, 20))
        x += r
    return objs


def blocks():
    objs, n = [], 0
    for layer, count in enumerate((7, 6, 5, 3, 2, 1)):
        for i in range(count):
            h = (n * 37) % 360 / 360; n += 1
            r, g, b = [255 * (.5 + .5 * math.cos(2 * math.pi * (h + o))) for o in (0, 1 / 3, 2 / 3)]
            objs.append(box(((i - (count - 1) / 2) * .62, layer * .62 - 1.4, 0), (.56, .56, .56), (r, g, b), rot=.15 * (n % 3 - 1)))
    return objs


def stardust():
    rnd = random.Random(42); objs = []
    pal = [rgb(h) for h in ('ffd54f', 'ff8a65', 'f06292', 'ba68c8', '64b5f6', '4dd0e1', '81c784', 'fff59d')]
    for k in range(100):
        while True:
            p = (rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))
            if sum(x * x for x in p) < 1: break
        objs.append(star(tuple(x * 2.2 for x in p), rnd.uniform(.12, .26), .07, rnd.choice(pal), rot=rnd.uniform(0, 1), tilt=rnd.uniform(-.8, .8)))
    return objs


SAMPLES = [
    ('watermelon', 'スイカ', watermelon), ('earth', '地球（テクスチャ）', earth), ('donut', 'ドーナツ', donut),
    ('saturn', '土星', saturn), ('mushroom', 'きのこ', mushroom), ('icecream', 'アイス2段', icecream),
    ('snowman', '雪だるま', snowman), ('solar', '太陽系', solar), ('blocks', '虹の積み木', blocks), ('stardust', '星くず100', stardust),
]


# ---- more helpers (many objects) ----------------------------------------------------------------------------------------

def rotate(o, c, ax=0.0, ay=0.0, az=0.0):
    """rotate an object about point c (x, then y, then z)"""
    def R(p):
        x, y, z = p[0] - c[0], p[1] - c[1], p[2] - c[2]
        y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
        x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
        x, y = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
        return (x + c[0], y + c[1], z + c[2])
    o.p = [R(p) for p in o.p]; return o


def merge(*objs):
    """several parts that belong to one object (a balloon and its string) as one glTF mesh"""
    m = Obj()
    for o in objs:
        base = len(m.p); m.p += o.p; m.c += o.c; m.i += [k + base for k in o.i]
    return m


def extrude(c, outline, depth, col, side=None):
    """flat shape from a star-convex outline [(x,y)...] around (0,0), extruded along z. col(x,y) -> sRGB for the faces"""
    o = Obj()
    for sgn in (1, -1):
        m = o.v((c[0], c[1], c[2] + sgn * depth / 2), col(0, 0))
        ring = [o.v((c[0] + x, c[1] + y, c[2] + sgn * depth / 2), col(x, y)) for x, y in outline]
        for k in range(len(ring)):
            a, b = ring[k], ring[(k + 1) % len(ring)]
            o.tri(m, b, a) if sgn > 0 else o.tri(m, a, b)
    sc = side or tuple(x * .8 for x in col(0, 0))
    for k in range(len(outline)):
        (x0, y0), (x1, y1) = outline[k], outline[(k + 1) % len(outline)]
        q = [o.v((c[0] + x0, c[1] + y0, c[2] + depth / 2), sc), o.v((c[0] + x1, c[1] + y1, c[2] + depth / 2), sc),
             o.v((c[0] + x1, c[1] + y1, c[2] - depth / 2), sc), o.v((c[0] + x0, c[1] + y0, c[2] - depth / 2), sc)]
        o.tri(q[0], q[2], q[1]); o.tri(q[0], q[3], q[2])
    return o


def heart_outline(r, n=40):
    pts = []
    for k in range(n):
        t = k / n * 2 * math.pi
        x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x / 17 * r, (y + 3) / 17 * r))
    return pts


def petal_outline(r, n=28):
    pts = []
    for k in range(n):
        t = k / n * 2 * math.pi
        x = .55 * math.sin(t) * r; y = -math.cos(t) * r
        if y > .55 * r: y -= .35 * r * max(0, 1 - abs(x) / (.18 * r))   # the notch at the tip
        pts.append((x, y))
    return pts


def hue(h, s=.75, l=.6):
    a = s * min(l, 1 - l)
    f = lambda n: l - a * max(-1, min((n + h * 12) % 12 - 3, 9 - (n + h * 12) % 12, 1))
    return (255 * f(0), 255 * f(8), 255 * f(4))


def cubelet(c, s, faces):
    """a box whose 6 faces each have their own colour: faces = {'+x':col, ...}; missing faces are black plastic"""
    o = Obj(); h = s / 2
    spec = [('+x', (1, 0, 0), (0, 1, 0), (0, 0, 1)), ('-x', (-1, 0, 0), (0, 1, 0), (0, 0, -1)), ('+y', (0, 1, 0), (0, 0, 1), (1, 0, 0)),
            ('-y', (0, -1, 0), (0, 0, -1), (1, 0, 0)), ('+z', (0, 0, 1), (1, 0, 0), (0, 1, 0)), ('-z', (0, 0, -1), (-1, 0, 0), (0, 1, 0))]
    for key, n, a, b in spec:
        cc = faces.get(key, (24, 24, 26))
        for inset, colr in ((1, (20, 20, 22)), (.86, cc)):   # black edge, coloured sticker slightly in front
            q = []
            for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                off = h * (1.002 if inset < 1 else 1)
                q.append(o.v(tuple(c[k] + n[k] * off + (a[k] * su + b[k] * sv) * h * inset for k in range(3)), colr))
            o.tri(q[0], q[1], q[2]); o.tri(q[0], q[2], q[3])
    return o


# ---- many objects -------------------------------------------------------------------------------------------------------

def rubik():
    col = {'+x': rgb('d32f2f'), '-x': rgb('ff8f00'), '+y': rgb('fafafa'), '-y': rgb('fdd835'), '+z': rgb('1e88e5'), '-z': rgb('43a047')}
    objs = []
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in (-1, 0, 1):
                f = {}
                if i == 1: f['+x'] = col['+x']
                if i == -1: f['-x'] = col['-x']
                if j == 1: f['+y'] = col['+y']
                if j == -1: f['-y'] = col['-y']
                if k == 1: f['+z'] = col['+z']
                if k == -1: f['-z'] = col['-z']
                objs.append(cubelet((i * .68, j * .68, k * .68), .66, f))
    for o in objs: rotate(o, (0, 0, 0), .5, .7, 0)
    return objs


def balloons():
    rnd = random.Random(5); objs = []
    for k in range(30):
        h = k / 30; c = hue(h, .85, .58)
        x, y, z = rnd.uniform(-2.2, 2.2), rnd.uniform(.2, 1.8), rnd.uniform(-1, 1)
        ball = sphere((x, y, z), .32, lambda X, Y, Z, u, v, c=c: mix(c, (255, 255, 255), max(0, X * .4 + Y * .6 - .55) * 2.2), 20, 12, sq=(1, 1.2, 1))
        knot = lathe((x, y - .42, z), [(.0, 0), (.07, .04), (.0, .06)], lambda *a, c=c: c, 10)
        string = box((x, y - 1.15, z), (.012, 1.45, .012), rgb('eeeeee'))
        objs.append(merge(ball, knot, string))
    return objs


def gems():
    rnd = random.Random(8); objs = []
    pal = [rgb(h) for h in ('e91e63', '00bcd4', '7c4dff', '00e676', 'ffc400', 'ff3d00', '2979ff', 'f50057')]
    for k in range(40):
        c = rnd.choice(pal); r = rnd.uniform(.16, .3)
        p = (rnd.uniform(-2, 2), rnd.uniform(-1.1, 1.1), rnd.uniform(-.6, .6))
        g = lathe(p, [(.0, -r * 1.1), (r, 0), (r * .62, r * .42), (.0, r * .42)],
                  lambda t, u, y, c=c: mix(c, (255, 255, 255), .45 * (int(u * 8) % 2) + .25 * (t > .6)), 8)
        objs.append(rotate(g, p, rnd.uniform(-.6, .6), rnd.uniform(0, 3), rnd.uniform(-.6, .6)))
    return objs


def dna():
    objs = []
    for k in range(32):
        t = k / 31; y = (t - .5) * 4.2; a = t * 4 * math.pi
        p1 = (math.cos(a) * .7, y, math.sin(a) * .7); p2 = (-p1[0], y, -p1[2])
        objs.append(sphere(p1, .14, lambda *q: rgb('ff4081'), 16, 8)); objs.append(sphere(p2, .14, lambda *q: rgb('40c4ff'), 16, 8))
        rung = box((0, y, 0), (1.25, .05, .05), hue(k / 32, .7, .62)); objs.append(rotate(rung, (0, y, 0), 0, -a, 0))
    for o in objs: rotate(o, (0, 0, 0), 0, 0, math.radians(-70))
    return objs


def macarons():
    pastel = [rgb(h) for h in ('f8bbd0', 'b2dfdb', 'fff59d', 'd1c4e9', 'ffccbc', 'c5e1a5', 'b3e5fc')]
    objs, n = [], 0
    for layer, (count, rad) in enumerate(((10, 1.25), (7, .9), (5, .58), (1, 0))):
        y = layer * .36 - .6
        for i in range(count):
            a = i / max(1, count) * 2 * math.pi + layer * .4
            p = (math.cos(a) * rad, y, math.sin(a) * rad); c = pastel[n % len(pastel)]; n += 1
            top = lathe((p[0], p[1] + .05, p[2]), [(.32, 0), (.34, .04), (.3, .1), (.0, .13)], lambda *q, c=c: c, 28)
            bot = lathe((p[0], p[1] - .05, p[2]), [(.0, -.13), (.3, -.1), (.34, -.04), (.32, 0)], lambda *q, c=c: c, 28)
            fill = lathe(p, [(.28, -.05), (.29, 0), (.28, .05)], lambda *q: rgb('fff8e1'), 28)
            objs.append(merge(top, bot, fill))
    return objs


def dominoes():
    objs = []
    for k in range(36):
        t = k / 36; a = t * 2.6 * math.pi; r = .5 + t * 1.6
        p = (math.cos(a) * r, -.2, math.sin(a) * r)
        d = box(p, (.08, .7, .36), hue(t, .8, .55), rot=-a)
        objs.append(rotate(d, (p[0], -.55, p[2]), 0, 0, 0))
    for o in objs: rotate(o, (0, 0, 0), .55, 0, 0)
    return objs


# ---- fill the frame (asset.extras.unfold.fit = "frame") ------------------------------------------------------------------

def field(rnd, n, w=8.0, h=4.5, d=1.5):
    return [(rnd.uniform(-w, w), rnd.uniform(-h, h), rnd.uniform(-d, d)) for _ in range(n)]


def confetti():
    rnd = random.Random(21); pal = [rgb(h) for h in ('ff1744', 'ffea00', '00e5ff', '76ff03', 'd500f9', 'ff9100', 'ffffff', '2979ff')]
    return [rotate(box(p, (.34, .16, .02), rnd.choice(pal)), p, rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3)) for p in field(rnd, 240)]


def sakura():
    rnd = random.Random(33); objs = []
    for p in field(rnd, 160):
        base, tip = rgb('f06292'), rgb('fde4ec'); r = rnd.uniform(.22, .36)
        petal = extrude(p, petal_outline(r), .02, lambda x, y, r=r: mix(base, tip, min(1, (y / r + 1) / 1.4)))
        objs.append(rotate(petal, p, rnd.uniform(-1.2, 1.2), rnd.uniform(-1.2, 1.2), rnd.uniform(0, 6.3)))
    return objs


def hearts():
    rnd = random.Random(14); pal = [rgb(h) for h in ('ff1744', 'ff4081', 'f50057', 'ff80ab', 'e040fb', 'ff6e40')]
    objs = []
    for p in field(rnd, 120):
        c = rnd.choice(pal); r = rnd.uniform(.25, .5)
        h = extrude(p, heart_outline(r), .12, lambda x, y, c=c, r=r: mix(c, (255, 255, 255), max(0, (y / r - .2)) * .35))
        objs.append(rotate(h, p, rnd.uniform(-.4, .4), rnd.uniform(-.8, .8), rnd.uniform(-.5, .5)))
    return objs


def bubbles():
    rnd = random.Random(9); objs = []
    for p in field(rnd, 55):
        r = rnd.uniform(.25, .75); ph = rnd.random()
        col = lambda x, y, z, u, v, ph=ph: mix(hue((ph + .5 * x + .35 * y + .3 * fbm(x * 2, y * 2, z * 2, 4)) % 1, .7, .78), (255, 255, 255), max(0, x * -.5 + y * .7 - .4) * 1.6)
        objs.append(sphere(p, r, col, 28, 14))
    return objs


def starry_sky():
    rnd = random.Random(77); objs = []
    pal = [rgb(h) for h in ('fffde7', 'fff59d', 'b3e5fc', 'ffffff', 'ffe082', 'f8bbd0')]
    for k, p in enumerate(field(rnd, 400, d=1.0)):
        big = k < 14; r = rnd.uniform(.28, .45) if big else rnd.uniform(.05, .13)
        objs.append(star(p, r, .05, rnd.choice(pal[:3]) if big else rnd.choice(pal), rot=rnd.uniform(0, 1), tilt=rnd.uniform(-.4, .4)))
    return objs


MORE = [
    ('rubik', 'ルービックキューブ', rubik, None), ('balloons', '風船30', balloons, None), ('gems', '宝石40', gems, None),
    ('dna', 'DNAビーズ', dna, None), ('macarons', 'マカロンタワー', macarons, None), ('dominoes', 'ドミノのうず', dominoes, None),
    ('confetti', '紙吹雪（画面いっぱい）', confetti, 'frame'), ('sakura', '桜吹雪（画面いっぱい）', sakura, 'frame'),
    ('hearts', 'ハート吹雪（画面いっぱい）', hearts, 'frame'), ('bubbles', 'シャボン玉（画面いっぱい）', bubbles, 'frame'),
    ('starry', '星空（画面いっぱい）', starry_sky, 'frame'),
]

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); index = []
    only = set(sys.argv[2:])   # optional: just these ids
    for key, name, fn, fit in [(*x, None) for x in SAMPLES] + MORE:
        if only and key not in only: continue
        r = fn(); objs, tex = (r if isinstance(r, tuple) else (r, None))
        path = os.path.join(out, key + '.glb')
        tris = write_glb(path, objs, (tex, 0) if tex else None, fit)
        index.append({'id': key, 'name': name, 'objects': len(objs), 'triangles': tris, 'bytes': os.path.getsize(path), 'fit': fit})
        print(f'{key:11s} {name:14s} objects={len(objs):3d} tris={tris:6d} {os.path.getsize(path) / 1024:7.0f}KB')
    json.dump(index, open(os.path.join(out, 'samples.json'), 'w'), ensure_ascii=False, indent=1)
