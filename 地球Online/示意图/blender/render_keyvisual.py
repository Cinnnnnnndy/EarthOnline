#!/usr/bin/env python3
"""关键视觉 v2 —— 对照《潜水员戴夫》新画风再分析、再改。

上一版（元球拼小人）失败：元球阈值让头、发缩成三分之二，五官悬空、被树挡住。这版换思路：

· 角色 = 真正的网格：骨架线 + Skin 修改器 + 细分 → 一体成型的身体与四肢（行走姿势，2 骨 IK 摆手臂）
· 脸 = 手绘贴图投影（Pillow 画：大眼、虹膜渐变、双高光、睫毛、眉、腮红、张嘴笑），眼睛区域高光泽
· 头发 = 发帽（布尔切出脸）+ 锥形贝塞尔发丝（刘海七缕、两侧长发）+ 双丸子；草帽半透光，缎带
· 连衣裙 = 旋转面建模的裙身、八褶裙摆、泡泡袖、白领、珊瑚腰带；玛丽珍鞋、袜口、斜挎包
· 场景 = 伏见稻荷式千本鸟居沿弯路退向远方（透视引导线）、樱花树（噪声置换的团状树冠）、莲池、石灯笼、
  远山与五重塔、云层天空；前景虚化的花瓣
· 光 = 低角度暖阳（能照进帽檐下的脸）+ 冷补光 + 强暖轮廓光；按视深混入雾色的空气透视；f/2.8 景深
· 后期 = post.py（辉光、分级、暗角、颗粒）

  SAMPLES=96 RES=1920x816 python3 render_keyvisual.py → blender_keyvisual.png（再跑 post.py 得 _post 版）
"""
import sys, os, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, ".."))
import bpy
from mathutils import Vector, Euler
import render_blender as rbl          # 复用：场景重置、Cycles 设置、material()、link()、aim()
from PIL import Image, ImageDraw, ImageFilter, ImageChops

scene = bpy.context.scene
SAMPLES = int(os.environ.get("SAMPLES", "96"))
RES = tuple(int(v) for v in os.environ.get("RES", "1920x816").split("x"))
OUT = os.environ.get("OUT", os.path.join(HERE, "blender_keyvisual.png"))
scene.cycles.samples = SAMPLES
scene.view_settings.exposure = -0.35
link = rbl.link; srgb = rbl.srgb; material = rbl.material
rnd = random.Random(7)


# ====================================================================== 几何工具
def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def mesh_obj(name, verts, faces, mat, parent=None, do_smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if mat: me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    if do_smooth: smooth(ob)
    if parent: ob.parent = parent
    return ob


def sph(name, c, r, mat, scale=(1, 1, 1), rot=(0, 0, 0), parent=None, segs=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=1.0, location=c, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; ob.scale = (r * scale[0], r * scale[1], r * scale[2])
    ob.data.materials.append(mat); smooth(ob)
    if parent: ob.parent = parent
    return ob


def ico(name, c, r, mat, sub=3, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1.0, location=c)
    ob = bpy.context.active_object; ob.name = name; ob.scale = (r * scale[0], r * scale[1], r * scale[2])
    ob.data.materials.append(mat); smooth(ob)
    if parent: ob.parent = parent
    return ob


def cone(name, c, r1, r2, h, mat, rot=(0, 0, 0), verts=48, fill="NGON", parent=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, end_fill_type=fill, location=c, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    ob.data.materials.append(mat); smooth(ob)
    if parent: ob.parent = parent
    return ob


def cyl(name, c, r, h, mat, rot=(0, 0, 0), verts=32, parent=None, scale=(1, 1, 1)):
    return cone(name, c, r, r, h, mat, rot=rot, verts=verts, parent=parent, scale=scale)


def bx(name, c, dims, mat, rz=0.0, bevel=0.03, parent=None):
    """以 c 为中心、世界尺寸 dims 的圆角盒，绕 Z 转 rz"""
    hx, hy, hz = dims[0] / 2, dims[1] / 2, dims[2] / 2
    v = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    f = [(3, 2, 1, 0), (5, 6, 7, 4), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]   # 法线朝外（布尔切割依赖）
    ob = mesh_obj(name, v, f, mat, parent=parent, do_smooth=False)
    ob.location = c; ob.rotation_euler = (0, 0, rz)
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL"); m.width = min(bevel, hx * 0.6, hy * 0.6, hz * 0.6); m.segments = 3
        smooth(ob)
        try:
            ob.modifiers.new("sm", "SMOOTH_BY_ANGLE")
        except Exception:
            pass
    return ob


def lathe(name, prof, mat, segs=64, yscale=1.0, fold=None, cap_top=False, cap_bot=False, parent=None, c=(0, 0, 0)):
    """旋转面：prof=[(r, z)...]；fold=(k, [amp_i]) 给每圈加 cos(kθ) 褶皱"""
    verts, faces = [], []; n = len(prof)
    for i, (r, z) in enumerate(prof):
        a = fold[1][i] if fold else 0.0
        for j in range(segs):
            th = 2 * math.pi * j / segs
            rr = r + (a * math.cos(fold[0] * th) if fold else 0.0)
            verts.append((c[0] + rr * math.cos(th), c[1] + rr * math.sin(th) * yscale, c[2] + z))
    for i in range(n - 1):
        for j in range(segs):
            a_, b_, c_, d_ = i * segs + j, i * segs + (j + 1) % segs, (i + 1) * segs + (j + 1) % segs, (i + 1) * segs + j
            faces.append((a_, b_, c_, d_))
    if cap_bot: faces.append(tuple(reversed(range(segs))))
    if cap_top: faces.append(tuple(range((n - 1) * segs, n * segs)))
    return mesh_obj(name, verts, faces, mat, parent=parent)


def strand(name, pts, mat, parent=None, res=16, bevres=6):
    """锥形发丝 / 带子：pts=[(x, y, z, radius)...] 的贝塞尔管"""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = bevres
    cu.resolution_u = res; cu.use_fill_caps = True; cu.materials.append(mat)
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y, z, r) in zip(sp.bezier_points, pts):
        bp.co = (x, y, z); bp.handle_left_type = bp.handle_right_type = "AUTO"; bp.radius = r
    ob = link(bpy.data.objects.new(name, cu))
    if parent: ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, parent=None):
    ob = link(bpy.data.objects.new(name, None)); ob.location = loc; ob.rotation_euler = rot; ob.scale = (scale,) * 3
    if parent: ob.parent = parent
    return ob


def ik_elbow(s, h, l1, l2, pole):
    """两骨 IK：肩 s、手 h、上下臂长、极向量 → 肘位置"""
    s, h, pole = Vector(s), Vector(h), Vector(pole)
    d = (h - s); L = d.length; L = min(L, l1 + l2 - 1e-3); ax = d.normalized()
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L); hgt = math.sqrt(max(0.0, l1 * l1 - a * a))
    perp = pole - ax * pole.dot(ax)
    return tuple(s + ax * a + perp.normalized() * hgt)


# ====================================================================== 材质
def principled(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(color); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        nm = k.replace("_", " ")
        if nm in b.inputs:
            b.inputs[nm].default_value = v
    return m, nt, b


def noise_color(nt, b, c0, c1, scale=6.0, detail=3.0):
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = scale; noise.inputs["Detail"].default_value = detail
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = srgb(c0); ramp.color_ramp.elements[1].color = srgb(c1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return ramp


def add_bump(nt, b, strength, scale=60.0, detail=6.0):
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = scale; noise.inputs["Detail"].default_value = detail
    bmp = nt.nodes.new("ShaderNodeBump"); bmp.inputs["Strength"].default_value = strength
    nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"]); nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])


def mat_cloth(name, color, weave=0.3, scale=110.0, rough=0.9):
    m, nt, b = principled(name, color, rough, Sheen_Weight=0.45)
    w1 = nt.nodes.new("ShaderNodeTexWave"); w1.wave_type = "BANDS"; w1.bands_direction = "X"; w1.inputs["Scale"].default_value = scale; w1.inputs["Distortion"].default_value = 0.5
    w2 = nt.nodes.new("ShaderNodeTexWave"); w2.wave_type = "BANDS"; w2.bands_direction = "Y"; w2.inputs["Scale"].default_value = scale; w2.inputs["Distortion"].default_value = 0.5
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    nt.links.new(w1.outputs["Fac"], mul.inputs[0]); nt.links.new(w2.outputs["Fac"], mul.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = weave
    nt.links.new(mul.outputs["Value"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    noise_color(nt, b, tuple(int(c * 0.9) for c in color), color, scale=5.0)
    return m


def mat_skin(name, color=(255, 218, 192)):
    m, nt, b = principled(name, color, 0.5, Subsurface_Weight=0.32, Specular_IOR_Level=0.4, Coat_Weight=0.05)
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.15)
    noise_color(nt, b, color, (250, 196, 176), scale=2.5, detail=2.0)
    return m


def mat_face(face_png, eye_png, color=(255, 218, 192)):
    """皮肤 + 正面平面投影的脸部贴图；眼睛区域低粗糙、高清漆"""
    m, nt, b = principled("face", color, 0.5, Subsurface_Weight=0.32, Specular_IOR_Level=0.4)
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.15)
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    u = nt.nodes.new("ShaderNodeMath"); u.operation = "MULTIPLY_ADD"; u.inputs[1].default_value = 0.5; u.inputs[2].default_value = 0.5; nt.links.new(sep.outputs["X"], u.inputs[0])
    v = nt.nodes.new("ShaderNodeMath"); v.operation = "MULTIPLY_ADD"; v.inputs[1].default_value = 0.5; v.inputs[2].default_value = 0.5; nt.links.new(sep.outputs["Z"], v.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(u.outputs["Value"], comb.inputs["X"]); nt.links.new(v.outputs["Value"], comb.inputs["Y"])
    front = nt.nodes.new("ShaderNodeMapRange"); front.inputs["From Min"].default_value = -0.35; front.inputs["From Max"].default_value = 0.05
    front.inputs["To Min"].default_value = 1.0; front.inputs["To Max"].default_value = 0.0; nt.links.new(sep.outputs["Y"], front.inputs["Value"])
    img = nt.nodes.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(face_png); img.projection = "FLAT"; img.extension = "CLIP"
    nt.links.new(comb.outputs["Vector"], img.inputs["Vector"])
    fac = nt.nodes.new("ShaderNodeMath"); fac.operation = "MULTIPLY"; nt.links.new(img.outputs["Alpha"], fac.inputs[0]); nt.links.new(front.outputs["Result"], fac.inputs[1])
    ramp = noise_color(nt, b, color, (250, 196, 176), scale=2.5, detail=2.0)
    mix = nt.nodes.new("ShaderNodeMixRGB"); nt.links.new(fac.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"]); nt.links.new(img.outputs["Color"], mix.inputs["Color2"]); nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    eye = nt.nodes.new("ShaderNodeTexImage"); eye.image = bpy.data.images.load(eye_png); eye.image.colorspace_settings.name = "Non-Color"; eye.projection = "FLAT"; eye.extension = "CLIP"
    nt.links.new(comb.outputs["Vector"], eye.inputs["Vector"])
    efac = nt.nodes.new("ShaderNodeMath"); efac.operation = "MULTIPLY"; nt.links.new(eye.outputs["Color"], efac.inputs[0]); nt.links.new(front.outputs["Result"], efac.inputs[1])
    for sock, lo, hi in (("Roughness", 0.5, 0.06), ("Coat Weight", 0.05, 0.9), ("Subsurface Weight", 0.32, 0.0), ("Specular IOR Level", 0.4, 0.9)):
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = lo; mr.inputs["To Max"].default_value = hi
        nt.links.new(efac.outputs["Value"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], b.inputs[sock])
    return m


def mat_hair(name, color=(66, 40, 30)):
    m, nt, b = principled(name, color, 0.46, Specular_IOR_Level=0.6, Coat_Weight=0.15, Coat_Roughness=0.2)
    noise_color(nt, b, tuple(int(c * 0.72) for c in color), color, scale=30.0, detail=4.0)
    add_bump(nt, b, 0.18, scale=45.0)
    return m


def mat_straw(name, color=(244, 216, 142)):
    """草帽：编织凹凸 + 半透光（阳光透过帽檐）"""
    m = mat_cloth(name, color, weave=0.6, scale=45.0, rough=0.75)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; out = nt.get_output_node("ALL") or nt.nodes["Material Output"]
    tr = nt.nodes.new("ShaderNodeBsdfTranslucent"); tr.inputs["Color"].default_value = srgb((255, 226, 150))
    mix = nt.nodes.new("ShaderNodeMixShader"); mix.inputs["Fac"].default_value = 0.32
    nt.links.new(b.outputs["BSDF"], mix.inputs[1]); nt.links.new(tr.outputs["BSDF"], mix.inputs[2]); nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return m


def mat_paint(name, color, rough=0.32):
    m, nt, b = principled(name, color, rough, Coat_Weight=0.5, Coat_Roughness=0.1, Specular_IOR_Level=0.6)
    add_bump(nt, b, 0.08, scale=25.0)
    return m


def mat_foliage(name, c0, c1):
    m, nt, b = principled(name, c1, 0.7, Subsurface_Weight=0.25, Specular_IOR_Level=0.35)
    b.inputs["Subsurface Radius"].default_value = (0.3, 0.6, 0.2)
    noise_color(nt, b, c0, c1, scale=2.2, detail=3.0)
    return m


def mat_water(name):
    m, nt, b = principled(name, (46, 176, 214), 0.06, Coat_Weight=0.6, Coat_Roughness=0.05, Specular_IOR_Level=0.8)
    noise_color(nt, b, (32, 150, 196), (72, 196, 224), scale=0.35, detail=2.0)
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3.0; noise.inputs["Detail"].default_value = 5.0; noise.inputs["Roughness"].default_value = 0.7
    bmp = nt.nodes.new("ShaderNodeBump"); bmp.inputs["Strength"].default_value = 0.25
    nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"]); nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])
    return m


def apply_haze(color=(0.78, 0.87, 0.98), start=10.0, end=70.0, strength=0.65):
    """空气透视：每个材质按相机视深混入雾色（比体积散射便宜得多）"""
    for m in bpy.data.materials:
        nt = m.node_tree
        if not nt or "HAZE" in m:
            continue
        out = nt.get_output_node("ALL") or nt.nodes.get("Material Output")
        if not out or not out.inputs["Surface"].is_linked:
            continue
        src = out.inputs["Surface"].links[0].from_socket
        cam = nt.nodes.new("ShaderNodeCameraData")
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = start; mr.inputs["From Max"].default_value = end
        mr.inputs["To Min"].default_value = 0.0; mr.inputs["To Max"].default_value = strength
        nt.links.new(cam.outputs["View Z Depth"], mr.inputs["Value"])
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (color[0], color[1], color[2], 1.0); em.inputs["Strength"].default_value = 1.0
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(mr.outputs["Result"], mix.inputs["Fac"]); nt.links.new(src, mix.inputs[1]); nt.links.new(em.outputs["Emission"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"]); m["HAZE"] = 1


# ====================================================================== 脸部贴图（Pillow）
def make_face_textures(face_path, eye_path, N=1024):
    SS = 2; W = N * SS
    X = lambda x: (x * 0.5 + 0.5) * W
    Y = lambda z: (1 - (z * 0.5 + 0.5)) * W
    box = lambda cx, cz, hw, hh: [X(cx - hw), Y(cz + hh), X(cx + hw), Y(cz - hh)]
    def arc(cx, cz, rx, rz, a0, a1, n=40):
        return [(X(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n))), Y(cz + rz * math.sin(math.radians(a0 + (a1 - a0) * i / n)))) for i in range(n + 1)]
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0)); eye = Image.new("L", (W, W), 0); de = ImageDraw.Draw(eye)
    # 腮红（模糊层）
    bl = Image.new("RGBA", (W, W), (0, 0, 0, 0)); db = ImageDraw.Draw(bl)
    for sx in (-1, 1):
        db.ellipse(box(sx * 0.62, -0.30, 0.17, 0.10), fill=(255, 118, 122, 150))
    im.alpha_composite(bl.filter(ImageFilter.GaussianBlur(W * 0.022)))
    LASH = (44, 28, 26, 255)
    for sx in (-1, 1):
        cx, cz = sx * 0.40, -0.08
        L = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dl = ImageDraw.Draw(L)
        dl.ellipse(box(cx, cz, 0.155, 0.20), fill=(255, 255, 255, 255))
        # 虹膜：深外环 → 琥珀 → 下半更亮；瞳孔；两点高光
        I = Image.new("RGBA", (W, W), (0, 0, 0, 0)); di = ImageDraw.Draw(I)
        ix, iz, r = cx + sx * 0.01, cz - 0.03, 0.15
        di.ellipse(box(ix, iz, r, r), fill=(56, 32, 26, 255))
        di.ellipse(box(ix, iz - 0.008, r * 0.86, r * 0.86), fill=(124, 72, 44, 255))
        di.ellipse(box(ix, iz - 0.045, r * 0.62, r * 0.52), fill=(184, 122, 66, 255))
        di.ellipse(box(ix, iz + 0.01, 0.068, 0.075), fill=(26, 16, 18, 255))
        di.ellipse(box(ix - 0.05, iz + 0.07, 0.048, 0.05), fill=(255, 255, 255, 255))
        di.ellipse(box(ix + 0.055, iz - 0.065, 0.02, 0.022), fill=(255, 255, 255, 235))
        I.putalpha(ImageChops.multiply(I.split()[3], L.split()[3])); L.alpha_composite(I)
        # 上眼睑阴影（眼白顶部一弯浅灰）
        S = Image.new("RGBA", (W, W), (0, 0, 0, 0)); ds = ImageDraw.Draw(S)
        ds.ellipse(box(cx, cz + 0.16, 0.17, 0.10), fill=(120, 100, 110, 110)); S.putalpha(ImageChops.multiply(S.split()[3], L.split()[3])); L.alpha_composite(S)
        im.alpha_composite(L)
        # 睫毛线：上缘厚弯月 + 外眼角上翘一撇
        lash = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dla = ImageDraw.Draw(lash)
        outer = arc(cx, cz, 0.168, 0.222, 0, 180); inner = arc(cx, cz - 0.012, 0.15, 0.17, 180, 0)
        dla.polygon(outer + inner, fill=LASH)
        dla.polygon([(X(cx + sx * 0.15), Y(cz + 0.07)), (X(cx + sx * 0.25), Y(cz + 0.15)), (X(cx + sx * 0.11), Y(cz + 0.175))], fill=LASH)
        im.alpha_composite(lash)
        de.ellipse(box(cx, cz, 0.155, 0.20), fill=255)
    # 眉：上扬的弧
    d = ImageDraw.Draw(im)
    for sx in (-1, 1):
        d.arc(box(sx * 0.42, 0.20, 0.17, 0.11), 200, 340, fill=(74, 46, 36, 255), width=int(W * 0.02))
    # 张嘴笑：上缘微弯（嘴角上扬）+ 下缘大弧；牙、舌、深色轮廓
    xs = [-0.2 + 0.4 * i / 40 for i in range(41)]
    top = [(X(x), Y(-0.46 + 0.04 * (x / 0.2) ** 2)) for x in xs]
    bot = [(X(x), Y(-0.42 - 0.22 * (1 - (x / 0.2) ** 2))) for x in reversed(xs)]
    M = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dm = ImageDraw.Draw(M)
    dm.polygon(top + bot, fill=(142, 46, 58, 255))
    teeth = [(X(x), Y(-0.46 + 0.04 * (x / 0.2) ** 2 - 0.06)) for x in reversed(xs)]
    T = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dt = ImageDraw.Draw(T); dt.polygon(top + teeth, fill=(255, 250, 244, 255))
    dt.ellipse(box(0, -0.62, 0.10, 0.06), fill=(236, 122, 132, 255))
    T.putalpha(ImageChops.multiply(T.split()[3], M.split()[3])); M.alpha_composite(T)
    dm2 = ImageDraw.Draw(M); dm2.line(top + bot + [top[0]], fill=(104, 34, 44, 255), width=int(W * 0.006), joint="curve")
    im.alpha_composite(M)
    im.resize((N, N), Image.LANCZOS).save(face_path); eye.resize((N, N), Image.LANCZOS).save(eye_path)


# ====================================================================== 小人
def build_hero(loc, facing_deg, look_deg, S=0.5):
    """loc 世界位置；facing_deg 身体朝向（0 = 朝 -Y）；look_deg 头相对身体的转角；S 头半径的世界尺寸"""
    face_png, eye_png = os.path.join(HERE, "hero_face.png"), os.path.join(HERE, "hero_eyes.png")
    make_face_textures(face_png, eye_png)
    skin = mat_skin("skin_k"); face = mat_face(face_png, eye_png); hair = mat_hair("hair_k")
    dress = mat_cloth("dress_k", (118, 198, 188)); dress2 = mat_cloth("dress2_k", (96, 178, 170))
    collar = mat_cloth("collar_k", (252, 250, 244), weave=0.2); coral = mat_paint("coral_k", (255, 108, 76), rough=0.45)
    straw = mat_straw("straw_k"); shoe = mat_paint("shoe_k", (150, 46, 58), rough=0.28); sock = mat_cloth("sock_k", (250, 248, 240), weave=0.5, scale=80)
    bag = mat_cloth("bag_k", (198, 150, 96), weave=0.25, scale=40, rough=0.8); bag2 = mat_cloth("bag2_k", (166, 118, 70), weave=0.25, scale=40, rough=0.8)
    gold = principled("gold_k", (240, 196, 90), 0.3, Metallic=1.0)[0]
    body = empty("hero", loc, (0, 0, math.radians(facing_deg)), S)
    head = empty("head", (0, 0, 0), (0, 0, math.radians(look_deg)), 1.0, parent=body)
    phi = math.radians(look_deg)
    h2b = lambda p: (p[0] * math.cos(phi) - p[1] * math.sin(phi), p[0] * math.sin(phi) + p[1] * math.cos(phi), p[2])
    # ---- 身体：骨架线 + Skin 修改器（右手 x<0 扶帽檐，左手后摆；左腿前、右腿后）
    hand_r = h2b((-1.22, -0.78, 4.32))
    J = {"pelvis": (0, 0, 1.55), "chest": (0, 0, 2.45), "neck": (0, 0, 3.02),
         "sh_r": (-0.72, 0, 2.75), "sh_l": (0.72, 0, 2.75),
         "hand_r": hand_r, "hand_l": (1.02, 0.58, 1.18),
         "hip_r": (-0.33, 0, 1.4), "hip_l": (0.33, 0, 1.4),
         "knee_r": (-0.37, 0.24, 0.76), "ankle_r": (-0.4, 0.5, 0.34),
         "knee_l": (0.37, -0.3, 0.78), "ankle_l": (0.39, -0.56, 0.28)}
    J["elbow_r"] = ik_elbow(J["sh_r"], hand_r, 1.0, 1.0, (-1, -0.3, 0))
    J["elbow_l"] = ik_elbow(J["sh_l"], J["hand_l"], 0.95, 0.95, (0.6, 0.5, -0.4))
    R = {"pelvis": 0.5, "chest": 0.52, "neck": 0.27, "sh_r": 0.25, "sh_l": 0.25, "elbow_r": 0.2, "elbow_l": 0.2, "hand_r": 0.23, "hand_l": 0.23,
         "hip_r": 0.3, "hip_l": 0.3, "knee_r": 0.25, "knee_l": 0.25, "ankle_r": 0.22, "ankle_l": 0.22}
    names = list(J.keys()); idx = {n: i for i, n in enumerate(names)}
    edges = [("pelvis", "chest"), ("chest", "neck"), ("chest", "sh_r"), ("chest", "sh_l"), ("sh_r", "elbow_r"), ("elbow_r", "hand_r"), ("sh_l", "elbow_l"), ("elbow_l", "hand_l"),
             ("pelvis", "hip_r"), ("pelvis", "hip_l"), ("hip_r", "knee_r"), ("knee_r", "ankle_r"), ("hip_l", "knee_l"), ("knee_l", "ankle_l")]
    me = bpy.data.meshes.new("body"); me.from_pydata([J[n] for n in names], [(idx[a], idx[b]) for a, b in edges], []); me.update(); me.materials.append(skin)
    ob = link(bpy.data.objects.new("body", me)); ob.parent = body
    sk = ob.modifiers.new("skin", "SKIN"); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
    for n in names:
        me.skin_vertices[0].data[idx[n]].radius = (R[n], R[n])
    me.skin_vertices[0].data[idx["pelvis"]].use_root = True
    sub = ob.modifiers.new("sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 3
    # ---- 连衣裙：裙身、泡泡袖、白领与珊瑚蝴蝶结、腰带、八褶裙摆
    lathe("bodice", [(0.42, 1.45), (0.62, 1.7), (0.67, 2.0), (0.64, 2.35), (0.56, 2.7), (0.4, 2.92), (0.31, 3.04)], dress, yscale=0.8, cap_top=True, parent=body)
    for n in ("sh_r", "sh_l"):
        x, y, z = J[n]; sph("sleeve_" + n, (x * 1.08, y, z - 0.02), 0.36, dress, scale=(1.0, 0.92, 0.85), parent=body)
    lathe("collar", [(0.31, 2.98), (0.54, 2.9), (0.56, 2.99), (0.33, 3.06)], collar, yscale=0.85, parent=body)
    for sx in (-1, 1):
        sph("bow%d" % sx, (sx * 0.13, -0.48, 2.95), 0.1, coral, scale=(1.3, 0.6, 0.8), parent=body)
    sph("bowknot", (0, -0.5, 2.95), 0.06, coral, parent=body)
    lathe("belt", [(0.66, 1.72), (0.69, 1.79), (0.66, 1.86)], coral, yscale=0.8, parent=body)
    prof = [(0.60, 1.78), (0.72, 1.6), (0.9, 1.32), (1.08, 1.05), (1.2, 0.88)]
    lathe("skirt", prof, dress2, yscale=0.9, fold=(8, [0.0, 0.012, 0.035, 0.065, 0.085]), cap_top=True, parent=body)
    # ---- 袜口、玛丽珍鞋
    for n, pitch in (("ankle_r", 24), ("ankle_l", -4)):
        x, y, z = J[n]
        sph("sock_" + n, (x, y, z + 0.1), 0.245, sock, scale=(1, 1, 0.8), parent=body)
        rot = (math.radians(pitch), 0, 0)
        sph("shoe_" + n, (x, y - 0.12, z - 0.14), 0.31, shoe, scale=(0.95, 1.5, 0.55), rot=rot, parent=body)
        bx("strap_" + n, (x, y - 0.04, z - 0.02), (0.62, 0.08, 0.07), shoe, bevel=0.02, parent=body)
        sph("buckle_" + n, (x + (0.3 if x > 0 else -0.3), y - 0.05, z - 0.01), 0.04, gold, parent=body)
    # ---- 斜挎包 + 背带
    bg = bx("bag", (0.98, -0.02, 1.42), (0.5, 0.26, 0.4), bag, rz=math.radians(-12), bevel=0.07, parent=body)
    bx("bagflap", (0.98, -0.02, 1.55), (0.52, 0.29, 0.16), bag2, rz=math.radians(-12), bevel=0.05, parent=body)
    sph("bagbtn", (0.98, -0.18, 1.45), 0.035, gold, parent=body)
    strand("strap", [(0.92, -0.1, 1.62, 0.045), (0.42, -0.6, 2.35, 0.045), (-0.3, -0.5, 2.92, 0.045), (-0.66, 0.05, 2.95, 0.045), (-0.62, 0.45, 2.55, 0.045)], bag2, parent=body)
    # ---- 头：脸贴图球 + 鼻
    sph("headball", (0, 0, 4.05), 1.0, face, scale=(1.0, 0.95, 1.0), parent=head, segs=64)
    sph("nose", (0, -0.97, 3.9), 0.07, skin, parent=head)
    # ---- 头发：发帽（切出脸）+ 刘海 + 侧发 + 双丸子
    cap = sph("haircap", (0, 0.1, 4.12), 1.07, hair, parent=head, segs=64)
    cutter = bx("cutter", (0, -1.4, 3.4), (3.0, 2.2, 2.8), None, bevel=0, parent=head); cutter.hide_render = True; cutter.display_type = "WIRE"
    bo = cap.modifiers.new("cut", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cutter
    for i in range(6):
        x0 = -0.72 + 0.288 * i; k = abs(x0) / 0.72; sgn = 1 if x0 >= 0 else -1
        ln = (0.0, 0.12, -0.05, 0.1, -0.02, 0.06)[i]                       # 长短错落
        strand("fringe%d" % i, [(x0 * 0.8, -0.62, 4.95, 0.26), (x0 * 1.0, -0.97, 4.66, 0.22), (x0 * 1.08 + sgn * 0.06, -1.03, 4.48 - 0.32 * k - ln, 0.1)], hair, parent=head)
    for sx in (-1, 1):
        strand("side%d" % sx, [(sx * 1.0, -0.22, 4.6, 0.25), (sx * 1.14, -0.4, 3.7, 0.21), (sx * 1.02, -0.5, 2.85, 0.12), (sx * 0.9, -0.42, 2.62, 0.05)], hair, parent=head)
        sph("bun%d" % sx, (sx * 0.95, 0.36, 4.35), 0.38, hair, parent=head)
        sph("buntie%d" % sx, (sx * 1.05, 0.12, 4.15), 0.1, coral, scale=(1.4, 0.7, 0.7), parent=head)
    # ---- 草帽：帽顶、帽檐（开口锥面 + 加厚）、缎带与飘带
    hatc = (0, 0.42, 5.32)
    sph("crown", hatc, 1.06, straw, scale=(1.0, 1.0, 0.6), parent=head)
    brim = cone("brim", (0, 0.42, 4.97), 2.05, 1.0, 0.26, straw, rot=(math.radians(-10), math.radians(-12), 0), verts=96, fill="NOTHING", parent=head)
    so = brim.modifiers.new("solid", "SOLIDIFY"); so.thickness = 0.04; so.offset = 0
    cyl("ribbon", (0, 0.42, 5.06), 1.07, 0.22, coral, verts=64, parent=head)
    strand("rib1", [(0.25, 1.42, 5.02, 0.07), (0.42, 1.62, 4.6, 0.06), (0.38, 1.55, 4.15, 0.02)], coral, parent=head)
    strand("rib2", [(-0.05, 1.46, 5.02, 0.07), (-0.2, 1.7, 4.55, 0.06), (-0.12, 1.62, 4.2, 0.02)], coral, parent=head)
    return body


# ====================================================================== 场景
P0, P1, P2 = (2.4, -10.0), (1.6, 8.0), (-7.0, 26.0)
RIM_XY = (5.2, 3.4)          # 轮廓光的水平位置，附近不种树
PAGODA = (-10.5, 31.0)       # 五重塔：鸟居尽头左侧


def path_pt(t):
    return ((1 - t) ** 2 * P0[0] + 2 * t * (1 - t) * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * t * (1 - t) * P1[1] + t * t * P2[1])


def path_tan(t):
    tx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]); ty = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1])
    L = math.hypot(tx, ty); return tx / L, ty / L


_ARC = None
def path_at(s):
    """按弧长取点：(x, y), (tx, ty), (nx, ny)"""
    global _ARC
    if _ARC is None:
        pts = [path_pt(i / 600) for i in range(601)]; acc = [0.0]
        for a, b in zip(pts, pts[1:]):
            acc.append(acc[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        _ARC = (pts, acc)
    pts, acc = _ARC
    s = max(0.0, min(s, acc[-1] - 1e-6))
    lo, hi = 0, len(acc) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if acc[mid] <= s: lo = mid
        else: hi = mid
    f = (s - acc[lo]) / max(1e-9, acc[hi] - acc[lo]); t = (lo + f) / 600
    x, y = path_pt(t); tx, ty = path_tan(t)
    return (x, y), (tx, ty), (-ty, tx)


def build_env():
    grass = principled("grass", (150, 198, 96), 0.9)[0]; noise_color(grass.node_tree, grass.node_tree.nodes["Principled BSDF"], (112, 168, 76), (170, 212, 104), scale=0.35, detail=4.0)
    add_bump(grass.node_tree, grass.node_tree.nodes["Principled BSDF"], 0.2, scale=8.0)
    sand = principled("sand", (224, 212, 186), 0.85)[0]; add_bump(sand.node_tree, sand.node_tree.nodes["Principled BSDF"], 0.15, scale=30.0)
    verm = mat_paint("vermilion", (230, 70, 40)); black = principled("lacquer", (34, 32, 38), 0.35, Coat_Weight=0.4)[0]
    stone = principled("stone", (150, 150, 146), 0.9)[0]; add_bump(stone.node_tree, stone.node_tree.nodes["Principled BSDF"], 0.4, scale=20.0)
    trunk = principled("trunkk", (104, 68, 42), 0.9)[0]; add_bump(trunk.node_tree, trunk.node_tree.nodes["Principled BSDF"], 0.5, scale=12.0)
    fol = [mat_foliage("fol%d" % i, a, b) for i, (a, b) in enumerate((((40, 130, 66), (96, 190, 96)), ((56, 150, 78), (120, 204, 106)), ((70, 160, 74), (150, 214, 98)), ((36, 120, 72), (88, 176, 108))))]
    sakura = mat_foliage("sakura", (236, 140, 170), (255, 216, 226)); sakura2 = mat_foliage("sakura2", (226, 118, 152), (255, 196, 210))
    water = mat_water("water"); pad = principled("pad", (74, 150, 78), 0.6)[0]; lotus = mat_paint("lotus", (255, 150, 176), rough=0.5)
    hillm = [principled("hill%d" % i, c, 0.9)[0] for i, c in enumerate(((84, 146, 118), (108, 166, 128), (132, 184, 138)))]
    wood = principled("wood", (72, 48, 38), 0.8)[0]; roof = principled("roof", (56, 62, 76), 0.6, Coat_Weight=0.2)[0]; wall = principled("wall", (236, 230, 216), 0.9)[0]
    gold = principled("gold", (240, 196, 90), 0.3, Metallic=1.0)[0]; reed = mat_foliage("reed", (140, 170, 70), (190, 206, 96))
    petal = principled("petal", (255, 176, 196), 0.5, Subsurface_Weight=0.3)[0]
    # 地面
    bpy.ops.mesh.primitive_plane_add(size=500, location=(0, 60, 0)); g = bpy.context.active_object; g.data.materials.append(grass)
    flower = [mat_paint("flower%d" % i, c, rough=0.5) for i, c in enumerate(((255, 120, 140), (255, 236, 120), (255, 255, 255), (255, 150, 90)))]
    for i in range(110):
        s = 3.0 + rnd.random() * 34; (x, y), _, (nx, ny) = path_at(s); sx = 1 if rnd.random() < 0.5 else -1
        off = 1.35 + rnd.random() * 1.6; px, py = x + nx * off * sx, y + ny * off * sx
        if sx > 0 and -3 < y < 13: continue
        m = flower[rnd.randrange(4)]
        for k in range(rnd.randrange(2, 5)):
            qx, qy = px + rnd.uniform(-0.18, 0.18), py + rnd.uniform(-0.18, 0.18)
            sph("flower", (qx, qy, 0.09), 0.028 + rnd.random() * 0.018, m, segs=8)
            cone("stem", (qx, qy, 0.045), 0.008, 0.008, 0.09, grass, verts=6)
    # 小径：沿弧长采样的带面 + 边石
    verts, faces = [], []; W = 1.15; n = 0
    for i in range(0, 42 * 10 + 1):
        s = i / 10; (x, y), _, (nx, ny) = path_at(s)
        verts += [(x - nx * W, y - ny * W, 0.03), (x + nx * W, y + ny * W, 0.03)]
        if i: faces.append((n - 2, n - 1, n + 1, n))
        n += 2
    mesh_obj("path", verts, faces, sand, do_smooth=False)
    for i in range(1, 80):
        s = 0.5 * i + rnd.random() * 0.3; (x, y), _, (nx, ny) = path_at(s); sx = 1 if i % 2 else -1
        if rnd.random() < 0.55:
            sph("stone%d" % i, (x + nx * (W + 0.12) * sx, y + ny * (W + 0.12) * sx, 0.02), 0.08 + rnd.random() * 0.08, stone, scale=(1.4, 1.0, 0.6), segs=16)
    # 千本鸟居：沿小径每 1.6 一座（从小人身后开始）
    for i in range(14):
        s = 10.4 + 2.2 * i; (x, y), (tx, ty), (nx, ny) = path_at(s); rz = math.atan2(ty, tx)
        for sx in (-1, 1):
            px, py = x + nx * 1.3 * sx, y + ny * 1.3 * sx
            cone("post", (px, py, 1.75), 0.15, 0.125, 3.5, verm, verts=24)
            cyl("postbase", (px, py, 0.14), 0.21, 0.28, black, verts=24)
        bx("kasagi", (x, y, 3.56), (3.3, 0.28, 0.22), verm, rz=rz, bevel=0.04)
        bx("kasagi2", (x, y, 3.72), (3.45, 0.32, 0.11), black, rz=rz, bevel=0.03)
        bx("nuki", (x, y, 2.98), (2.95, 0.2, 0.2), verm, rz=rz, bevel=0.04)
        bx("gaku", (x, y, 3.27), (0.24, 0.22, 0.38), black, rz=rz, bevel=0.03)
    # 石灯笼一对（第一座鸟居前）
    (x, y), (tx, ty), (nx, ny) = path_at(9.4)
    for sx in (-1, 1):
        px, py = x + nx * 2.0 * sx, y + ny * 2.0 * sx
        bx("lbase", (px, py, 0.18), (0.7, 0.7, 0.36), stone, bevel=0.04); cyl("lcol", (px, py, 0.85), 0.14, 1.0, stone)
        bx("lmid", (px, py, 1.45), (0.5, 0.5, 0.2), stone, bevel=0.03); bx("lbox", (px, py, 1.75), (0.42, 0.42, 0.42), stone, bevel=0.03)
        sph("lglow", (px, py, 1.75), 0.15, principled("lamp", (255, 214, 150), 0.5, Emission_Color=srgb((255, 200, 120)), Emission_Strength=6.0)[0], segs=16)
        cone("lroof", (px, py, 2.1), 0.5, 0.1, 0.32, stone, rot=(0, 0, math.radians(45)), verts=4)
        sph("ltop", (px, py, 2.34), 0.09, stone, segs=16)
    # 树：樱花在近处、绿树向远处
    def tree(x, y, r, m, trunk_h=None):
        th = trunk_h or 1.5 * r
        cone("trunk", (x, y, th / 2), 0.16 * r, 0.11 * r, th, trunk, verts=12)
        tex = bpy.data.textures.get("foliage") or bpy.data.textures.new("foliage", "CLOUDS"); tex.noise_scale = 0.7; tex.noise_depth = 3
        for (dx, dy, dz, rr) in ((0, 0, th + 0.55 * r, 1.0), (0.55 * r, 0.2 * r, th + 0.95 * r, 0.75), (-0.5 * r, -0.25 * r, th + 0.85 * r, 0.7), (0.05 * r, -0.5 * r, th + 1.2 * r, 0.62)):
            ob = ico("canopy", (x + dx, y + dy, dz), r * rr, m, sub=3)
            d = ob.modifiers.new("disp", "DISPLACE"); d.texture = tex; d.strength = 0.62; d.mid_level = 0.5; d.texture_coords = "GLOBAL"
    placed = []
    for i in range(28):
        s = 10.0 + i * 1.25 + rnd.random() * 0.6; (x, y), _, (nx, ny) = path_at(s)
        for sx in (-1, 1):
            if sx > 0 and -3 < y < 10: continue                       # 右侧留给莲池
            off = 3.6 + rnd.random() * 2.4; px, py = x + nx * off * sx, y + ny * off * sx
            if any(math.hypot(px - a, py - b) < 2.4 for a, b in placed) or math.hypot(px - RIM_XY[0], py - RIM_XY[1]) < 3.5: continue
            r = (0.9 + rnd.random() * 0.5) if y < 9 else (1.1 + rnd.random() * 0.8)
            tree(px, py, r, (sakura if rnd.random() < 0.5 else sakura2) if s < 22 else fol[rnd.randrange(4)])
            placed.append((px, py))
    for i in range(60):
        px, py = rnd.uniform(-34, 34), rnd.uniform(12, 36)
        (cx, cy), _, _ = path_at(min(41.5, max(0, (py + 10) * 1.05)))
        if math.hypot(px - cx, py - cy) < 5.5 or math.hypot(px - PAGODA[0], py - PAGODA[1]) < 4.5 or any(math.hypot(px - a, py - b) < 2.4 for a, b in placed): continue
        tree(px, py, 1.2 + rnd.random() * 1.2, fol[rnd.randrange(4)]); placed.append((px, py))
    # 莲池（右侧）：椭圆水面、荷叶、莲花、芦苇
    cxp, cyp, ra, rb = 8.6, 5.6, 5.6, 4.6
    ring = [(cxp + ra * math.cos(2 * math.pi * i / 64), cyp + rb * math.sin(2 * math.pi * i / 64), 0.02) for i in range(64)]
    mesh_obj("pond", ring, [tuple(range(64))], water, do_smooth=False)
    ring2 = [(cxp + (ra + 0.5) * math.cos(2 * math.pi * i / 64), cyp + (rb + 0.5) * math.sin(2 * math.pi * i / 64), 0.012) for i in range(64)]
    mesh_obj("pondrim", ring2, [tuple(range(64))], sand, do_smooth=False)
    for i in range(16):
        a = rnd.random() * 2 * math.pi; rr = rnd.random() * 0.8; px, py = cxp + ra * rr * math.cos(a), cyp + rb * rr * math.sin(a)
        cyl("pad", (px, py, 0.04), 0.28 + rnd.random() * 0.3, 0.03, pad, verts=20)
        if rnd.random() < 0.4: sph("lotus", (px, py, 0.2), 0.16, lotus, scale=(1, 1, 1.2), segs=20)
    for i in range(40):
        a = rnd.uniform(math.radians(200), math.radians(330)); px, py = cxp + (ra + 0.3) * math.cos(a), cyp + (rb + 0.3) * math.sin(a)
        cone("reed", (px + rnd.uniform(-0.3, 0.3), py + rnd.uniform(-0.3, 0.3), 0.6), 0.03, 0.0, 1.2 + rnd.random() * 0.6, reed, verts=6)
    # 远山 + 五重塔
    tex = bpy.data.textures.new("hilltex", "CLOUDS"); tex.noise_scale = 6.0
    for i, (hx, hy, hr) in enumerate(((-16, 40, 17), (4, 46, 21), (20, 40, 15), (-32, 38, 14), (34, 42, 16))):
        ob = ico("hill", (hx, hy, -1.5), hr, hillm[i % 3], sub=3, scale=(1.0, 1.0, 0.38))
        d = ob.modifiers.new("disp", "DISPLACE"); d.texture = tex; d.strength = 0.2; d.texture_coords = "GLOBAL"
    px, py, base = PAGODA[0], PAGODA[1], 0.0
    for k in range(5):
        w = 3.0 - 0.35 * k; z0 = base + k * 1.25
        bx("tier", (px, py, z0 + 0.52), (w * 0.8, w * 0.8, 1.04), wall, bevel=0.02); bx("tierf", (px, py, z0 + 0.54), (w * 0.84, w * 0.84, 0.32), wood, bevel=0.02)
        cone("eave", (px, py, z0 + 1.16), w, w * 0.35, 0.44, roof, rot=(0, 0, math.radians(45)), verts=4)
    cyl("spire", (px, py, base + 5 * 1.25 + 0.9), 0.1, 1.8, gold, verts=12)
    # 前景虚化的花瓣
    return petal


def petals(cam_loc, aim_pt, mat, n=10):
    f = (Vector(aim_pt) - Vector(cam_loc)).normalized(); up = Vector((0, 0, 1)); right = f.cross(up).normalized(); up2 = right.cross(f)
    for i in range(n):
        d = rnd.uniform(1.4, 3.6); p = Vector(cam_loc) + f * d + right * rnd.uniform(-0.55, 0.55) * d + up2 * rnd.uniform(-0.28, 0.3) * d
        sph("petal%d" % i, tuple(p), 0.035 + rnd.random() * 0.025, mat, scale=(1.0, 0.65, 0.18), rot=(rnd.random() * 3, rnd.random() * 3, rnd.random() * 3), segs=12)


def world_and_lights(sun_az_deg=-105, sun_el_deg=32):
    world = bpy.data.worlds.new("WorldK"); scene.world = world; world.use_nodes = True
    nt = world.node_tree; bg = nt.nodes["Background"]; out = nt.nodes["World Output"]
    # 相机看到：渐变 + 云；照明用：物理天空
    coord = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(coord.outputs["Window"], sep.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (0.90, 0.95, 1.0, 1); ramp.color_ramp.elements[1].color = (0.26, 0.55, 0.96, 1)
    ramp.color_ramp.elements[0].position = 0.32; ramp.color_ramp.elements[1].position = 1.0
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3.0; noise.inputs["Detail"].default_value = 9.0; noise.inputs["Roughness"].default_value = 0.62
    mapping = nt.nodes.new("ShaderNodeMapping"); mapping.inputs["Scale"].default_value = (1.0, 2.6, 1.0)
    nt.links.new(coord.outputs["Window"], mapping.inputs["Vector"]); nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.44; cr.color_ramp.elements[0].color = (0, 0, 0, 1); cr.color_ramp.elements[1].position = 0.6; cr.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(noise.outputs["Fac"], cr.inputs["Fac"])
    mask = nt.nodes.new("ShaderNodeMapRange"); mask.inputs["From Min"].default_value = 0.4; mask.inputs["From Max"].default_value = 0.62; nt.links.new(sep.outputs["Y"], mask.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; nt.links.new(cr.outputs["Color"], mul.inputs[0]); nt.links.new(mask.outputs["Result"], mul.inputs[1])
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.inputs["Color2"].default_value = (1.0, 0.99, 0.97, 1)
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"]); nt.links.new(mul.outputs["Value"], mix.inputs["Fac"]); nt.links.new(mix.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 1.0
    sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"; sky.sun_elevation = math.radians(sun_el_deg + 8); sky.sun_rotation = math.radians(90 - sun_az_deg); sky.sun_disc = False
    bg2 = nt.nodes.new("ShaderNodeBackground"); nt.links.new(sky.outputs["Color"], bg2.inputs["Color"]); bg2.inputs["Strength"].default_value = 0.5
    lp = nt.nodes.new("ShaderNodeLightPath"); ms = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], ms.inputs["Fac"]); nt.links.new(bg2.outputs["Background"], ms.inputs[1]); nt.links.new(bg.outputs["Background"], ms.inputs[2]); nt.links.new(ms.outputs["Shader"], out.inputs["Surface"])
    sun = bpy.data.lights.new("sunK", "SUN"); sun.energy = 6.5; sun.angle = math.radians(2.0); sun.color = (1.0, 0.86, 0.68)
    so = link(bpy.data.objects.new("sunK", sun)); so.rotation_euler = (math.radians(90 - sun_el_deg), 0, math.radians(sun_az_deg))
    return so


def key_lights(target):
    rim = bpy.data.lights.new("rimK", "AREA"); rim.energy = 8000; rim.size = 3.0; rim.color = (1.0, 0.7, 0.42)
    ro = link(bpy.data.objects.new("rimK", rim)); ro.location = (RIM_XY[0], RIM_XY[1], target[2] + 4.2); rbl.aim(ro, target)
    fill = bpy.data.lights.new("fillK", "AREA"); fill.energy = 380; fill.size = 9; fill.color = (0.72, 0.84, 1.0)
    fo = link(bpy.data.objects.new("fillK", fill)); fo.location = (target[0] - 7, target[1] - 5, target[2] + 3); rbl.aim(fo, target)
    kick = bpy.data.lights.new("kickK", "AREA"); kick.energy = 800; kick.size = 2.4; kick.color = (1.0, 0.82, 0.62)
    ko = link(bpy.data.objects.new("kickK", kick)); ko.location = (target[0] - 3.5, target[1] - 4.5, target[2] - 0.2); rbl.aim(ko, target)   # 低位补光：照进帽檐下


if __name__ == "__main__":
    petal = build_env()
    (hx, hy), _, (nx, ny) = path_at(8.0); hx += nx * 0.45; hy += ny * 0.45     # 小人站在小径上、鸟居入口之前
    cam_loc = (-1.3, -10.6, 1.7); aim_pt = (0.6, 0.5, 1.38)
    fx, fy = cam_loc[0] - hx, cam_loc[1] - hy
    look_world = math.degrees(math.atan2(fx, -fy))          # 头正对镜头
    facing = look_world - 16                                 # 身体略向画面中心转
    hero = build_hero((hx, hy, 0.0), facing, look_world - facing, S=0.5)
    VIEW = os.environ.get("VIEW", "key")
    if VIEW == "closeup":                       # 角色近景：60 mm，肩上构图
        d = Vector((cam_loc[0] - hx, cam_loc[1] - hy, 0)).normalized() * 3.6
        cam_loc = (hx + d.x, hy + d.y, 2.15); aim_pt = (hx, hy, 1.95); RES = (1200, 1200); OUT = os.environ.get("OUT", os.path.join(HERE, "blender_keyvisual_closeup.png"))
    else:
        petals(cam_loc, aim_pt, petal)
    world_and_lights(); key_lights((hx, hy, 2.0))
    apply_haze()
    scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100
    cam = bpy.data.cameras.new("camK"); cam.lens = 60 if VIEW == "closeup" else 32; cam.sensor_width = 36
    cam.dof.use_dof = True; cam.dof.aperture_fstop = 2.2 if VIEW == "closeup" else 1.8; cam.dof.aperture_blades = 7
    co = link(bpy.data.objects.new("camK", cam)); co.location = cam_loc; rbl.aim(co, aim_pt)
    cam.dof.focus_distance = (Vector(cam_loc) - Vector((hx, hy, 2.0))).length; scene.camera = co
    scene.render.filepath = OUT
    print("hero at", (round(hx, 2), round(hy, 2)), "facing", round(facing, 1), "look", round(look_world, 1), "look:", scene.view_settings.view_transform, scene.view_settings.look)
    bpy.ops.render.render(write_still=True)
    print("rendered", OUT)
