"""Make a larger-framed UNFOLD variant from the original editable heart."""

import bpy


ROOT = "/Volumes/ORICO/UNFOLD"
SOURCE = f"{ROOT}/models/星屑のハート.blend"
DEST_BLEND = f"{ROOT}/models/星屑のハート_大きめ.blend"
DEST_GLB = f"{ROOT}/models/星屑のハート_大きめ.glb"
DEST_PREVIEW = f"{ROOT}/models/星屑のハート_大きめ.png"

assert bpy.data.filepath == SOURCE, "Open the original 星屑のハート.blend first"
scene = bpy.context.scene
parts = [o for o in scene.objects if o.type == "MESH" and
         (o.name.startswith("星_") or o.name.startswith("ドット_"))]
assert len(parts) == 186, f"Unexpected original part count: {len(parts)}"


def model_extent(objects):
    bpy.context.view_layer.update()
    coords = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    return max(max(v[i] for v in coords) - min(v[i] for v in coords)
               for i in range(3))


before = model_extent(parts)
# The far-out accent stars control UNFOLD's automatic 3.5-unit normalization.
# Remove only these eight in the new version; the original .blend and GLB stay intact.
for n in range(179, 187):
    obj = bpy.data.objects.get(f"星_{n:03d}")
    assert obj is not None, n
    bpy.data.objects.remove(obj, do_unlink=True)

parts = [o for o in scene.objects if o.type == "MESH" and
         (o.name.startswith("星_") or o.name.startswith("ドット_"))]
assert len(parts) == 178
after = model_extent(parts)
scene.camera.data.ortho_scale = 4.8
scene.render.filepath = DEST_PREVIEW

bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=DEST_BLEND)
bpy.ops.export_scene.gltf(filepath=DEST_GLB, export_format="GLB",
                          use_selection=True, export_cameras=False,
                          export_lights=False, export_yup=True)
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.render.render(write_still=True)

result = {
    "blend": DEST_BLEND,
    "glb": DEST_GLB,
    "preview": DEST_PREVIEW,
    "mesh_parts": len(parts),
    "old_extent": round(before, 4),
    "new_extent": round(after, 4),
    "size_increase_in_unfold_percent": round((before / after - 1) * 100, 1),
}
