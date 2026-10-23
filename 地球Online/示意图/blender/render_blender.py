#!/usr/bin/env python3
"""用 Blender（bpy）+ Cycles 真 3D 渲染：京都底板 + 卡通小人，向《潜水员戴夫》新画风靠。
场景数据来自 ../render_trip_book.py（同一份地图与地标模板），色调为「清朗海天」。

  python3 render_blender.py hero   → 小人特写（海报机位，景深）
  python3 render_blender.py plate  → 底板全景（微缩模型机位）
  python3 render_blender.py both
输出到本目录：blender_hero.png / blender_plate.png
"""
import sys, os, math, random
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, ".."))
import bpy
from mathutils import Vector
import render_trip_book as rb

MODE = sys.argv[1] if len(sys.argv) > 1 else "hero"
SAMPLES = int(os.environ.get("SAMPLES", "64"))
LZ = 0.55          # 一层积木的高度（单位：格）

# ---------------- 清理 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 3
scene.render.image_settings.file_format = "PNG"
try:
    scene.view_settings.view_transform = "AgX"
except Exception:
    pass
for lk in ("AgX - Punchy", "Punchy", "AgX - Medium High Contrast", "Medium High Contrast"):
    try:
        scene.view_settings.look = lk; break
    except Exception:
        continue
print("look:", scene.view_settings.look)

# ---------------- 工具 ----------------
def srgb(c, k=1.0):
    return tuple(((v / 255.0) ** 2.2) * k for v in c) + (1.0,)


MATS = {}


def material(name, color, rough=0.6, sss=0.0, bump=0.0, spec=0.5, emission=None, alpha=1.0):
    """color: 0–255 三元组；bump: 噪声凹凸强度（布料 / 石头）"""
    key = (name, tuple(color), rough, sss, bump, spec, emission, alpha)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    for nm, val in (("Specular IOR Level", spec), ("Subsurface Weight", sss), ("Alpha", alpha)):
        if nm in bsdf.inputs:
            bsdf.inputs[nm].default_value = val
    if sss and "Subsurface Radius" in bsdf.inputs:
        bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = srgb(emission); bsdf.inputs["Emission Strength"].default_value = 2.0
    if bump:
        noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 60.0; noise.inputs["Detail"].default_value = 6.0
        bmp = nt.nodes.new("ShaderNodeBump"); bmp.inputs["Strength"].default_value = bump
        nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"]); nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    if alpha < 1.0:
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    MATS[key] = m
    return m


def link(obj):
    scene.collection.objects.link(obj); return obj


def box(x0, y0, x1, y1, z0, z1, mat, bevel=0.05, name="box"):
    """地图坐标 (x, y) → 世界 (x, -y)；z 以层计"""
    me = bpy.data.meshes.new(name)
    X0, X1 = x0, x1; Y0, Y1 = -y1, -y0; Z0, Z1 = z0 * LZ, z1 * LZ
    v = [(X0, Y0, Z0), (X1, Y0, Z0), (X1, Y1, Z0), (X0, Y1, Z0), (X0, Y0, Z1), (X1, Y0, Z1), (X1, Y1, Z1), (X0, Y1, Z1)]
    f = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me.from_pydata(v, [], f); me.update(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL"); mod.width = min(bevel, (x1 - x0) * 0.3, (y1 - y0) * 0.3, max(0.01, (z1 - z0) * LZ * 0.3)); mod.segments = 3
        ob.data.shade_smooth() if hasattr(ob.data, "shade_smooth") else None
        try:
            mod2 = ob.modifiers.new("smooth", "SMOOTH_BY_ANGLE")
        except Exception:
            pass
    return ob


_SPHERE = None
def sphere(center, r, mat, scale=(1, 1, 1), name="sph"):
    global _SPHERE
    if _SPHERE is None:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0)
        _SPHERE = bpy.context.active_object.data
        bpy.data.objects.remove(bpy.context.active_object)
        for p in _SPHERE.polygons:
            p.use_smooth = True
    ob = link(bpy.data.objects.new(name, _SPHERE.copy()))
    ob.data.materials.append(mat)
    ob.location = center; ob.scale = (r * scale[0], r * scale[1], r * scale[2])
    return ob


def cylinder(center, r, h, mat, rot=(0, 0, 0), scale=(1, 1, 1), name="cyl"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=h, location=center, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; ob.scale = scale
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


# ---------------- 色调：清朗海天 ----------------
GROUND = dict(U=(222, 216, 204), G=(178, 212, 112), F=(90, 168, 98), Z=(90, 168, 98), M=(96, 148, 116), W=(56, 172, 230), O=(28, 132, 210),
              P=(156, 206, 110), S=(246, 234, 190), Y=(136, 204, 104))
M_GROUND = {k: material("ground_" + k, v, rough=0.9 if k not in "WO" else 0.12, bump=0.0 if k not in "WO" else 0.35) for k, v in GROUND.items()}
M_ROAD = material("road", (250, 250, 246), rough=0.85)
M_BRIDGE = material("bridge", (214, 178, 132), rough=0.7)
M_RAIL = material("rail", (86, 92, 104), rough=0.5)
M_TRUNK = material("trunk", (112, 74, 44), rough=0.9, bump=0.3)
M_CANOPY = [material("canopy%d" % i, c, rough=0.75) for i, c in enumerate(((52, 150, 74), (70, 170, 88), (96, 186, 96), (40, 132, 70)))]
M_HILL = [material("hill%d" % i, c, rough=0.9, bump=0.25) for i, c in enumerate(((78, 134, 112), (100, 156, 124), (130, 176, 140)))]
M_BAMBOO = material("bamboo", (150, 200, 118), rough=0.6)


def build_plate(sc):
    g = sc["ground"]; COLS, ROWS = rb.COLS, rb.ROWS
    # 展示台座：像摆在桌上的模型
    base = material("base", (238, 232, 220), rough=0.5, spec=0.4)
    box(-0.6, -0.6, COLS + 0.6, ROWS + 0.6, -0.9 / LZ, -0.16 / LZ, base, bevel=0.12)
    # 地面：按类别合并成一张网格（每格一块 1×1×0.16 的板）
    per = {}
    for y in range(ROWS):
        for x in range(COLS):
            per.setdefault(g[y][x], []).append((x, y))
    for cls, cells in per.items():
        verts, faces = [], []
        for (x, y) in cells:
            X0, X1, Y0, Y1 = x, x + 1, -(y + 1), -y
            z0 = -0.16; z1 = -0.02 if cls in "WO" else 0.0
            base = len(verts)
            verts += [(X0, Y0, z0), (X1, Y0, z0), (X1, Y1, z0), (X0, Y1, z0), (X0, Y0, z1), (X1, Y0, z1), (X1, Y1, z1), (X0, Y1, z1)]
            faces += [tuple(base + i for i in q) for q in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0))]
        me = bpy.data.meshes.new("ground_" + cls); me.from_pydata(verts, [], faces); me.update(); me.materials.append(M_GROUND[cls])
        link(bpy.data.objects.new("ground_" + cls, me))
    water = lambda x, y: g[y][x] in "WO"
    for (x, y) in sc.get("hroads", set()):
        box(x, y + .28, x + 1, y + .72, 0, 0.06, M_BRIDGE if water(x, y) else M_ROAD, bevel=0)
    for (x, y) in sc.get("vroads", set()):
        box(x + .28, y, x + .72, y + 1, 0, 0.075, M_BRIDGE if water(x, y) else M_ROAD, bevel=0)
    for (x, y) in sc.get("hrails", set()):
        for k in (.44, .55):
            box(x, y + k, x + 1, y + k + .025, 0, 0.09, M_RAIL, bevel=0)
        for k in (.15, .5, .85):
            box(x + k - .04, y + .38, x + k + .04, y + .62, 0, 0.05, M_BRIDGE, bevel=0)
    for (x, y) in sc.get("vrails", set()):
        for k in (.44, .55):
            box(x + k, y, x + k + .025, y + 1, 0, 0.09, M_RAIL, bevel=0)
    rnd = random.Random(11)
    hroads, vroads = sc.get("hroads", set()), sc.get("vroads", set())
    for y in range(ROWS):
        for x in range(COLS):
            t = g[y][x]
            if t == "M":
                h = 1 + (x * 3 + y * 5) % 3
                sphere((x + .5, -(y + .5), -0.05), 0.95, M_HILL[h - 1], scale=(1.25, 1.25, 0.32 + 0.22 * h))
                if (x * 5 + y * 3) % 3 == 0:
                    sphere((x + .5, -(y + .5), 0.62 + 0.22 * h), 0.22, M_CANOPY[(x + y) % 4])
            elif t == "F" and (x * 5 + y * 3) % 2 == 0:
                k = 0.85 + rnd.random() * 0.35
                cylinder((x + .5, -(y + .5), 0.28 * k), 0.07, 0.6 * k, M_TRUNK)
                m = M_CANOPY[(x * 7 + y) % 4]
                sphere((x + .5, -(y + .5), 0.72 * k), 0.36 * k, m); sphere((x + .32, -(y + .62), 0.88 * k), 0.26 * k, m); sphere((x + .66, -(y + .38), 0.96 * k), 0.24 * k, m)
            elif t == "Z":
                for (u, v, hh) in ((.2, .3, 1.4), (.6, .15, 1.7), (.45, .7, 1.3), (.8, .6, 1.55)):
                    cylinder((x + u, -(y + v), hh / 2), 0.035, hh, M_BAMBOO)
            elif t == "U" and (x * 7 + y * 13) % 5 == 0 and (x, y) not in hroads and (x, y) not in vroads and (x, y) not in sc.get("nohouse", set()):
                box(x + .3, y + .3, x + .7, y + .7, 0, .45, material("house", rb.C["house"], rough=0.8), bevel=0.04)
                box(x + .26, y + .26, x + .74, y + .74, .45, .6, material("houseroof", rb.C["houseroof"], rough=0.7), bevel=0.03)
            elif t == "P" and (x * 7 + y * 13) % 4 == 0:
                cylinder((x + .5, -(y + .5), 0.2), 0.05, 0.4, M_TRUNK)
                sphere((x + .5, -(y + .5), 0.55), 0.3, M_CANOPY[1])
    for (kind, ax, ay, name, role) in sc["landmarks"]:
        boxes, _ = rb.T(kind, ax, ay)
        for (x0, y0, x1, y1, z0, z1, base, top) in boxes:
            m = material("lm_" + str(base), base, rough=0.55 if base in (rb.C["red"], rb.C["gold"], rb.C["glass"]) else 0.8, bump=0.15 if base in (rb.C["wood"], rb.C["wood2"], rb.C["stone"]) else 0.0)
            box(x0, y0, x1, y1, z0, z1, m, bevel=0.06)


def build_hero(pos, scale=0.62, facing=(0, -1)):
    """女生旅行者：双丸子 + 长侧发 + 齐刘海、草帽配珊瑚缎带、浅青连衣裙、小挎包、玛丽珍鞋。
    眼睛正视、微笑；比例大头短身，四肢圆润贴身，避免「管子手」。pos 为地图坐标，facing 为朝向（地图坐标系）"""
    skin = material("skin", (255, 218, 190), rough=0.5, sss=0.35, spec=0.35)
    hair = material("hair", (72, 46, 36), rough=0.42, spec=0.6)
    hat = material("hat", (242, 214, 140), rough=0.7, bump=0.35)
    ribbon = material("ribbon", (255, 111, 77), rough=0.55)
    dress = material("dress", (118, 196, 184), rough=0.85, bump=0.25)
    dress2 = material("dress2", (96, 176, 166), rough=0.85, bump=0.25)
    collar = material("collar", (250, 250, 246), rough=0.8)
    shoe = material("shoe", (150, 48, 58), rough=0.35, spec=0.6)
    sock = material("sock", (250, 250, 246), rough=0.9)
    white = material("eyewhite", (255, 255, 255), rough=0.3, spec=0.6)
    pupil = material("pupil", (40, 30, 34), rough=0.2, spec=0.9)
    iris = material("iris", (70, 46, 40), rough=0.3, spec=0.7)
    mouthm = material("mouth", (214, 92, 100), rough=0.5)
    blush = material("blush", (255, 160, 160), rough=0.8)
    bag = material("bag", (196, 150, 98), rough=0.8, bump=0.3)
    ox, oy = pos[0] + .5, -(pos[1] + .5)
    fx, fy = facing[0], -facing[1]
    ang = math.atan2(fy, fx) + math.pi / 2
    parts = []
    def P(x, y, z):
        cx, cy = x * math.cos(ang) - y * math.sin(ang), x * math.sin(ang) + y * math.cos(ang)
        return (ox + cx * scale, oy + cy * scale, z * scale)
    S = lambda r: r * scale
    rz = ang   # 绕 Z 的整体朝向，用于圆柱 / 圆锥的旋转
    # 腿、袜、鞋
    for dx in (-0.3, 0.3):
        parts.append(cylinder(P(dx, 0, 0.5), S(0.19), S(0.55), skin, rot=(0, 0, rz)))
        parts.append(cylinder(P(dx, 0, 0.3), S(0.2), S(0.14), sock, rot=(0, 0, rz)))
        parts.append(sphere(P(dx, -0.06, 0.16), S(0.28), shoe, scale=(1.0, 1.35, 0.55)))
    # 裙子（圆锥）+ 上身 + 领子
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=S(1.05), radius2=S(0.62), depth=S(0.8), location=P(0, 0, 0.78), rotation=(0, 0, rz))
    cone = bpy.context.active_object; cone.data.materials.append(dress2)
    for pg in cone.data.polygons: pg.use_smooth = True
    parts.append(cone)
    parts.append(sphere(P(0, 0, 1.32), S(0.82), dress, scale=(0.86, 0.66, 0.78)))
    parts.append(sphere(P(0, -0.02, 1.86), S(0.5), collar, scale=(0.86, 0.6, 0.22)))
    # 手臂：肩球 + 短臂 + 手，贴身微张
    for dx in (-1, 1):
        parts.append(sphere(P(dx * 0.72, 0.0, 1.68), S(0.21), dress))
        parts.append(cylinder(P(dx * 0.86, 0.02, 1.32), S(0.17), S(0.62), dress, rot=(0, math.radians(14 * dx), rz)))
        parts.append(sphere(P(dx * 0.98, 0.02, 1.0), S(0.2), skin))
    # 小挎包（右髋）
    parts.append(sphere(P(0.92, -0.12, 1.0), S(0.22), bag, scale=(0.9, 0.55, 0.8)))
    # 头、后发、侧发、刘海、丸子
    parts.append(sphere(P(0, 0, 2.55), S(1.0), skin))
    parts.append(sphere(P(0, 0.14, 2.62), S(1.06), hair, scale=(1.0, 1.0, 0.95)))
    parts.append(sphere(P(0, -0.7, 3.0), S(0.98), hair, scale=(0.98, 0.5, 0.42)))           # 齐刘海
    for dx in (-1, 1):
        parts.append(sphere(P(dx * 0.92, -0.02, 2.05), S(0.42), hair, scale=(0.72, 0.9, 1.9)))  # 长侧发到肩
        parts.append(sphere(P(dx * 1.0, 0.16, 2.98), S(0.3), hair))                            # 丸子
    # 草帽：帽顶 + 宽檐 + 缎带
    parts.append(sphere(P(0, 0.06, 3.42), S(0.95), hat, scale=(1.0, 1.0, 0.55)))
    parts.append(cylinder(P(0, 0.06, 3.3), S(1.72), S(0.06), hat, rot=(math.radians(5), 0, rz)))
    parts.append(cylinder(P(0, 0.06, 3.42), S(0.98), S(0.16), ribbon, rot=(0, 0, rz)))
    # 眼睛：正视，眼白 + 深瞳 + 高光；细眉
    for dx in (-0.38, 0.38):
        parts.append(sphere(P(dx, -0.88, 2.42), S(0.23), white, scale=(1.0, 0.55, 1.25)))
        parts.append(sphere(P(dx, -1.0, 2.4), S(0.14), iris, scale=(1.0, 0.45, 1.15)))
        parts.append(sphere(P(dx, -1.05, 2.4), S(0.085), pupil, scale=(1.0, 0.5, 1.1)))
        parts.append(sphere(P(dx - 0.05, -1.1, 2.5), S(0.035), white))
        parts.append(cylinder(P(dx, -0.95, 2.8), S(0.03), S(0.26), hair, rot=(0, math.radians(90), math.radians(-10 * (1 if dx < 0 else -1)) + rz)))
        parts.append(sphere(P(dx * 1.85, -0.76, 2.2), S(0.13), blush, scale=(1.0, 0.3, 0.6)))
    # 微笑
    parts.append(sphere(P(0, -0.96, 2.08), S(0.15), mouthm, scale=(1.5, 0.3, 0.42)))
    return parts


def setup_world_lights(mode="hero"):
    world = bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
    nt = world.node_tree; bg = nt.nodes["Background"]
    if mode == "plate":
        # 亮的天空渐变（上蓝下白），靠太阳出对比
        coord = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = -0.15; mr.inputs["From Max"].default_value = 0.75
        ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (0.92, 0.96, 1.0, 1); ramp.color_ramp.elements[1].color = (0.30, 0.56, 0.92, 1)
        mr.inputs["From Min"].default_value = 0.0; mr.inputs["From Max"].default_value = 1.0
        nt.links.new(coord.outputs["Window"], sep.inputs["Vector"]); nt.links.new(sep.outputs["Y"], mr.inputs["Value"])   # 屏幕竖向：下浅上蓝
        nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 1.0
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 6.5; sun.angle = math.radians(4); sun.color = (1.0, 0.93, 0.84)
        so = link(bpy.data.objects.new("sun", sun)); so.rotation_euler = (math.radians(42), 0, math.radians(30))
        rim = bpy.data.lights.new("rim", "AREA"); rim.energy = 6000; rim.size = 14; rim.color = (1.0, 0.8, 0.6)
        ro = link(bpy.data.objects.new("rim", rim)); return so, ro
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
        try:
            sky.sky_type = t; break
        except TypeError:
            continue
    for attr, val in (("sun_elevation", math.radians(48)), ("sun_rotation", math.radians(215)), ("sun_disc", False), ("altitude", 300), ("air_density", 1.2), ("dust_density", 1.6)):
        try:
            setattr(sky, attr, val)
        except Exception:
            pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 0.42
    # 太阳：左前上方，软阴影
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.6; sun.angle = math.radians(6); sun.color = (1.0, 0.93, 0.84)
    so = link(bpy.data.objects.new("sun", sun)); so.rotation_euler = (math.radians(50), 0, math.radians(35))
    # 轮廓光：右后方暖色面光
    rim = bpy.data.lights.new("rim", "AREA"); rim.energy = 3200; rim.size = 6; rim.color = (1.0, 0.76, 0.5)
    ro = link(bpy.data.objects.new("rim", rim)); return so, ro


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render(path, res, cam_loc, target, lens, fstop, focus, samples=None):
    cam = bpy.data.cameras.new("cam"); cam.lens = lens
    cam.dof.use_dof = True; cam.dof.aperture_fstop = fstop; cam.dof.focus_distance = (Vector(cam_loc) - Vector(focus)).length
    co = link(bpy.data.objects.new("cam", cam)); co.location = cam_loc; aim(co, target); scene.camera = co
    scene.render.resolution_x, scene.render.resolution_y = res; scene.render.resolution_percentage = 100
    if samples:
        scene.cycles.samples = samples
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(co)
    print("rendered", path)


if __name__ == "__main__":
    sc = rb.SCENES["kyoto"]
    build_plate(sc)
    hero_cell = (28, 18)     # 伏见稻荷鸟居前
    build_hero(hero_cell, scale=0.62, facing=(-1, 1))
    so, ro = setup_world_lights("plate" if MODE == "plate" else "hero")
    hx, hy = hero_cell[0] + .5, -(hero_cell[1] + .5)
    ro.location = (hx + 4.5, hy + 3.5, 3.6); aim(ro, (hx, hy, 1.4))
    if MODE in ("hero", "both"):
        render(os.path.join(HERE, "blender_hero.png"), (1200, 900), (hx - 5.6, hy - 6.6, 2.9), (hx - 0.1, hy + 0.1, 1.4), 70, 2.2, (hx, hy, 1.55))
    if MODE in ("plate", "both"):
        cx, cy = rb.COLS / 2, -rb.ROWS / 2
        ro.location = (cx + 30, cy + 18, 22); aim(ro, (cx, cy, 0))
        render(os.path.join(HERE, "blender_plate.png"), (1600, 1000), (cx + 21, cy - 24, 17), (cx + 1.5, cy + 1.5, 0.3), 38, 5.6, (cx + 2, cy - 2, 0.5))
