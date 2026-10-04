"""Create an editable, disconnected star-and-dot heart for UNFOLD."""

import math
import random

import bmesh
import bpy


ROOT = "/Volumes/ORICO/UNFOLD"
BLEND_PATH = f"{ROOT}/models/星屑のハート.blend"
GLB_PATH = f"{ROOT}/models/星屑のハート.glb"
PREVIEW_PATH = f"{ROOT}/models/星屑のハート.png"
randomizer = random.Random(2809)

# The inspected untitled scene is empty; leave any unrelated scene content alone.
assert not bpy.data.filepath and not list(bpy.context.scene.objects)
scene = bpy.context.scene
collection = bpy.data.collections.new("星屑のハート｜離れた立体パーツ")
scene.collection.children.link(collection)


def material(name, color, emission):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = 0.18
    bsdf.inputs["Roughness"].default_value = 0.33
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = emission
    return mat


materials = [
    material("01｜桜色", (0.98, 0.28, 0.53), 0.28),
    material("02｜シャンパンゴールド", (1.0, 0.69, 0.25), 0.25),
    material("03｜氷の青", (0.25, 0.76, 1.0), 0.35),
    material("04｜白いきらめき", (0.91, 0.94, 1.0), 0.38),
]


def star_mesh(name, mat):
    # XY in the image becomes XZ in Blender, so GLB's Y-up export remains upright.
    ring = []
    for i in range(10):
        angle = math.pi / 2 + i * math.pi / 5
        radius = 1.0 if i % 2 == 0 else 0.43
        ring.append((math.cos(angle) * radius, math.sin(angle) * radius))
    verts = [(0, -0.24, 0), (0, 0.24, 0)]
    verts += [(x, -0.24, z) for x, z in ring]
    verts += [(x, 0.24, z) for x, z in ring]
    faces = []
    for i in range(10):
        j = (i + 1) % 10
        faces.append((0, 2 + i, 2 + j))
        faces.append((1, 12 + j, 12 + i))
        faces.append((2 + i, 12 + i, 12 + j, 2 + j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(mat)
    return mesh


def dot_mesh(name, mat):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    return mesh


star_meshes = [star_mesh(f"星の造形｜{i + 1}", mat) for i, mat in enumerate(materials)]
dot_meshes = [dot_mesh(f"ドットの造形｜{i + 1}", mat) for i, mat in enumerate(materials)]
created = []


def place(kind, index, x, z, size, depth):
    palette = star_meshes if kind == "星" else dot_meshes
    mesh = palette[index % len(palette)]
    obj = bpy.data.objects.new(f"{kind}_{len(created) + 1:03d}", mesh)
    collection.objects.link(obj)
    obj.location = (x, depth, z)
    obj.scale = (size, size, size)
    created.append(obj)
    return obj


def heart(t):
    x = 16 * math.sin(t) ** 3
    z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    return (x * 0.11, z * 0.11 + 0.17)


# Resample by distance to keep visible gaps between the individual star meshes.
dense = [heart(i * 2 * math.pi / 4096) for i in range(4097)]
lengths = [0.0]
for a, b in zip(dense, dense[1:]):
    lengths.append(lengths[-1] + math.dist(a, b))
outline = []
cursor = 0
for i in range(68):
    distance = lengths[-1] * i / 68
    while cursor < 4095 and lengths[cursor + 1] < distance:
        cursor += 1
    span = max(lengths[cursor + 1] - lengths[cursor], 1e-8)
    f = (distance - lengths[cursor]) / span
    outline.append(tuple(dense[cursor][a] * (1 - f) + dense[cursor + 1][a] * f for a in (0, 1)))

for i, (x, z) in enumerate(outline):
    size = randomizer.uniform(0.072, 0.092)
    place("星", i, x + randomizer.uniform(-0.014, 0.014),
          z + randomizer.uniform(-0.014, 0.014), size,
          randomizer.uniform(-0.18, 0.18))


def inside_polygon(x, z, polygon):
    inside = False
    j = len(polygon) - 1
    for i, (xi, zi) in enumerate(polygon):
        xj, zj = polygon[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


interior = []
for _ in range(700):
    if len(interior) >= 110:
        break
    x = randomizer.uniform(-1.55, 1.55)
    z = randomizer.uniform(-1.45, 1.26)
    if not inside_polygon(x, z, outline):
        continue
    if min(math.dist((x, z), pt) for pt in outline) < 0.20:
        continue
    if any(math.dist((x, z), pt) < 0.105 for pt in interior):
        continue
    interior.append((x, z))

for i, (x, z) in enumerate(interior):
    if i % 8 == 0:
        place("星", i + 1, x, z, randomizer.uniform(0.057, 0.081),
              randomizer.uniform(-0.22, 0.13))
    else:
        place("ドット", i + 1, x, z, randomizer.uniform(0.025, 0.049),
              randomizer.uniform(-0.22, 0.13))

satellites = [
    (-2.11, 0.93), (-2.25, 0.26), (-2.00, -0.50), (-1.80, -1.26),
    (2.07, 1.06), (2.26, 0.36), (2.05, -0.52), (1.78, -1.20),
]
for i, (x, z) in enumerate(satellites):
    place("星", i + 2, x, z, 0.09 if i % 3 else 0.12,
          randomizer.uniform(-0.12, 0.15))

# Camera and lights are kept in the editable .blend, but excluded from the GLB.
camera_data = bpy.data.cameras.new("正面プレビュー")
camera = bpy.data.objects.new("正面プレビュー", camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -8, 0.04)
camera.rotation_euler = (math.pi / 2, 0, 0)
camera_data.type = "ORTHO"
camera_data.ortho_scale = 5.8
scene.camera = camera

for name, location, energy, color in [
    ("キーライト", (-2.6, -3.7, 3.6), 580, (1.0, 0.83, 0.88)),
    ("フィルライト", (3.2, -2.7, 1.0), 350, (0.48, 0.75, 1.0)),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = 4.5
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (math.atan2(location[2], -location[1]), 0, 0)

world = bpy.data.worlds.new("夜空")
world.use_nodes = True
background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
background.inputs["Color"].default_value = (0.012, 0.018, 0.045, 1)
background.inputs["Strength"].default_value = 0.65
scene.world = world

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.view_settings.view_transform = "AgX"

bpy.ops.object.select_all(action="DESELECT")
for obj in created:
    obj.select_set(True)
bpy.context.view_layer.objects.active = created[0]
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB",
                          use_selection=True, export_cameras=False,
                          export_lights=False, export_yup=True)
bpy.ops.render.render(write_still=True)

result = {
    "blend": BLEND_PATH,
    "glb": GLB_PATH,
    "preview": PREVIEW_PATH,
    "mesh_parts": len(created),
    "outline_stars": len(outline),
    "interior_parts": len(interior),
    "satellite_stars": len(satellites),
}
