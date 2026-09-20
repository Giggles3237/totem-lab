import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "assets", "renders")
os.makedirs(OUTPUT, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name, color, metallic=0.35, roughness=0.23, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emission:
        node.inputs["Emission Color"].default_value = (*color, 1)
        node.inputs["Emission Strength"].default_value = emission
    return mat


def bevel(obj, amount=0.12, segments=4):
    modifier = obj.modifiers.new("Soft forged edge", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return obj


def add_cylinder(name, radius, depth, z, mat, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, min(0.12, depth * 0.2), 4)
    return obj


def add_torus(name, major, minor, z, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=64, minor_segments=16, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_cube(name, location, scale, mat, rotation=0):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=(0, 0, rotation))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return bevel(obj, 0.16, 5)


def add_sphere(name, location, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_cone(name, location, radius, depth, vertices, mat, rotation=0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.05, depth=depth, location=location, rotation=(0, 0, rotation))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return bevel(obj, 0.08, 3)


def star_mesh(name, points, outer, inner, depth, z, mat):
    vertices = []
    for level in (-depth / 2, depth / 2):
        for index in range(points * 2):
            angle = math.pi / 2 + index * math.pi / points
            radius = outer if index % 2 == 0 else inner
            vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, z + level))
    faces = []
    count = points * 2
    faces.append(tuple(range(count - 1, -1, -1)))
    faces.append(tuple(range(count, count * 2)))
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return bevel(obj, 0.09, 4)


def polygon_mesh(name, points, depth, z, mat, bevel_amount=0.12):
    vertices = []
    for level in (-depth / 2, depth / 2):
        vertices.extend((x, y, z + level) for x, y in points)
    count = len(points)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return bevel(obj, bevel_amount, 5)


def scaled(points, amount):
    return [(x * amount, y * amount) for x, y in points]


def add_cartoon_face(accent, y=0.12, spread=0.36):
    ink = material("Cartoon face", (0.015, 0.025, 0.045), metallic=0.0, roughness=0.42)
    shine = material("Eye sparkle", (1.0, 1.0, 0.92), metallic=0.0, roughness=0.25, emission=0.05)
    for x in (-spread, spread):
        add_sphere("Eye", (x, y, 0.98), (0.16, 0.22, 0.09), ink)
        add_sphere("Eye glint", (x - 0.045, y + 0.06, 1.08), (0.045, 0.06, 0.025), shine)
    add_cube("Smile", (0, y - 0.43, 0.98), (0.24, 0.045, 0.035), ink, math.radians(-3))


def cartoon_shape(name, points, accent, face=True):
    outline = material("Ink outline", (0.018, 0.028, 0.05), metallic=0.05, roughness=0.38)
    body = material("Candy body", accent, metallic=0.06, roughness=0.3, emission=0.04)
    highlight_color = tuple(min(1, component * 0.58 + 0.42) for component in accent)
    highlight = material("Candy highlight", highlight_color, metallic=0.0, roughness=0.22, emission=0.03)
    polygon_mesh(name + " outline", scaled(points, 1.13), 0.42, 0.30, outline, 0.15)
    polygon_mesh(name, points, 0.48, 0.58, body, 0.16)
    add_sphere(name + " shine", (-0.48, 0.72, 0.94), (0.24, 0.39, 0.07), highlight)
    if face:
        add_cartoon_face(accent)
    return body, outline, highlight


def setup_scene():
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.camera_add(location=(0, 0, 8))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 5.4
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -2.8, 6))
    key = bpy.context.object
    key.data.energy = 850
    key.data.shape = "DISK"
    key.data.size = 4
    key.data.color = (1.0, 0.78, 0.48)

    bpy.ops.object.light_add(type="AREA", location=(3.8, 2.2, 4.5))
    rim = bpy.context.object
    rim.data.energy = 1000
    rim.data.size = 3
    rim.data.color = (0.25, 0.75, 1.0)

    bpy.ops.object.light_add(type="AREA", location=(0, 0, 7))
    fill = bpy.context.object
    fill.data.energy = 300
    fill.data.size = 5

    scene.world.color = (0.005, 0.008, 0.015)


def medallion_base(accent):
    dark = material("Obsidian", (0.025, 0.035, 0.055), metallic=0.72, roughness=0.2)
    edge = material("Charged edge", accent, metallic=0.55, roughness=0.16, emission=0.24)
    add_cylinder("Obsidian medallion", 2.0, 0.38, 0.12, dark, 64)
    add_torus("Charged rim", 1.69, 0.13, 0.38, edge)
    add_torus("Inner circuit", 1.31, 0.035, 0.42, edge)
    for angle in range(0, 360, 60):
        radians = math.radians(angle)
        add_cube("Circuit notch", (math.cos(radians) * 1.52, math.sin(radians) * 1.52, 0.44), (0.08, 0.2, 0.07), edge, -radians)
    return edge


def build_symbol(kind, accent):
    if kind == "sun":
        points = []
        for index in range(20):
            angle = math.pi / 2 + index * math.pi / 10
            radius = 1.85 if index % 2 == 0 else 1.30
            points.append((math.cos(angle) * radius, math.sin(angle) * radius))
        cartoon_shape("Sunburst", points, accent)
    elif kind == "leaf":
        points = [(0.18, 2.02), (-0.60, 1.56), (-1.25, 0.72), (-1.32, -0.20), (-0.76, -1.08), (0, -1.82), (0.22, -0.86), (0.92, -0.28), (1.35, 0.65), (0.86, 1.52)]
        _, outline, _ = cartoon_shape("Leaf", points, accent, face=False)
        add_cube("Leaf vein", (0.02, -0.08, 0.98), (0.065, 1.24, 0.04), outline, math.radians(-18))
        add_cube("Left leaf vein", (-0.42, 0.15, 0.98), (0.045, 0.47, 0.035), outline, math.radians(48))
        add_cube("Right leaf vein", (0.42, -0.25, 0.98), (0.045, 0.42, 0.035), outline, math.radians(-52))
    elif kind == "water":
        points = [(0, 2.05), (-0.46, 1.35), (-1.02, 0.50), (-1.28, -0.28), (-1.08, -1.08), (-0.45, -1.62), (0, -1.77), (0.45, -1.62), (1.08, -1.08), (1.28, -0.28), (1.02, 0.50), (0.46, 1.35)]
        cartoon_shape("Water drop", points, accent)
    elif kind == "flame":
        points = [(0.12, 2.05), (-0.35, 1.28), (-0.88, 0.74), (-0.70, 1.55), (-1.38, 0.62), (-1.45, -0.38), (-0.92, -1.30), (0, -1.78), (0.95, -1.27), (1.42, -0.36), (1.16, 0.62), (0.62, 1.18)]
        body, _, highlight = cartoon_shape("Flame", points, accent)
        inner = [(0, 0.98), (-0.48, 0.20), (-0.40, -0.62), (0, -0.98), (0.45, -0.58), (0.52, 0.15)]
        polygon_mesh("Inner flame", inner, 0.20, 0.91, highlight, 0.08)
    elif kind == "moon":
        points = [(1.48, 1.62), (0.54, 1.92), (-0.52, 1.58), (-1.25, 0.82), (-1.46, -0.14), (-1.14, -1.10), (-0.35, -1.73), (0.70, -1.70), (1.48, -1.17), (0.54, -1.08), (-0.04, -0.51), (-0.20, 0.11), (0.03, 0.73), (0.63, 1.22)]
        cartoon_shape("Crescent moon", points, accent, face=False)
        add_cartoon_face(accent, y=-0.02, spread=0.28)
    elif kind == "crown":
        points = [(-1.62, -1.34), (-1.58, 0.88), (-0.72, 0.18), (-0.18, 1.62), (0.45, 0.16), (1.55, 1.02), (1.40, -1.34)]
        cartoon_shape("Crown", points, accent)
    elif kind == "wild":
        points = [(0.52, 2.00), (-1.30, 0.28), (-0.30, 0.20), (-0.72, -2.00), (1.34, 0.18), (0.30, 0.22)]
        cartoon_shape("Wild bolt", points, accent, face=False)
        add_cartoon_face(accent, y=0.22, spread=0.25)


def build_guardian(kind, accent):
    stone = material("Guardian stone", (0.035, 0.045, 0.07), metallic=0.66, roughness=0.28)
    edge = material("Guardian charge", accent, metallic=0.45, roughness=0.16, emission=0.3)
    add_cylinder("Guardian shield", 2.0, 0.48, 0.08, stone, 8)
    add_torus("Guardian halo", 1.55, 0.12, 0.4, edge, (1, 1, 1))
    add_cube("Brow", (0, 0.28, 0.66), (1.04, 0.25, 0.2), stone)
    add_sphere("Left eye", (-0.52, 0.18, 0.92), (0.18, 0.23, 0.12), edge)
    add_sphere("Right eye", (0.52, 0.18, 0.92), (0.18, 0.23, 0.12), edge)
    add_cube("Nose", (0, -0.15, 0.76), (0.17, 0.55, 0.18), stone)
    if kind == "vine":
        for angle in (-32, 32):
            radians = math.radians(angle)
            add_sphere("Vine leaf", (math.sin(radians) * 1.03, -0.82, 0.82), (0.34, 0.64, 0.16), edge)
    elif kind == "ember":
        for x in (-0.58, 0, 0.58):
            add_cone("Ember crown", (x, 1.02 + abs(x) * 0.18, 0.72), 0.30, 0.55, 3, edge)
    elif kind == "moon":
        add_torus("Moon crest", 0.63, 0.18, 0.73, edge, (1, 1, 1))
    elif kind == "storm":
        bolt = star_mesh("Storm crest", 4, 0.82, 0.30, 0.28, 0.72, edge)
        bolt.scale.x = 0.72
        bolt.rotation_euler.z = math.radians(22.5)


def render_asset(group, name, color):
    clear_scene()
    setup_scene()
    if group == "symbols":
        build_symbol(name, color)
    else:
        build_guardian(name, color)
    scene = bpy.context.scene
    directory = os.path.join(OUTPUT, group)
    os.makedirs(directory, exist_ok=True)
    scene.render.filepath = os.path.join(directory, f"{name}.png")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", f"{group}-{name}.blend"))
    bpy.ops.render.render(write_still=True)


SYMBOLS = {
    "sun": (1.0, 0.57, 0.08),
    "leaf": (0.12, 0.82, 0.46),
    "water": (0.10, 0.58, 1.0),
    "flame": (1.0, 0.15, 0.06),
    "moon": (0.58, 0.28, 1.0),
    "crown": (1.0, 0.90, 0.47),
    "wild": (0.63, 1.0, 0.08),
}

GUARDIANS = {
    "vine": (0.12, 0.82, 0.46),
    "ember": (1.0, 0.18, 0.05),
    "moon": (0.58, 0.28, 1.0),
    "storm": (0.10, 0.70, 1.0),
}

for asset_name, asset_color in SYMBOLS.items():
    render_asset("symbols", asset_name, asset_color)

for asset_name, asset_color in GUARDIANS.items():
    render_asset("guardians", asset_name, asset_color)

print(f"Rendered {len(SYMBOLS) + len(GUARDIANS)} original assets to {OUTPUT}")
