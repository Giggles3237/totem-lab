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


def setup_scene():
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
    edge = medallion_base(accent)
    pale = material("Crystal highlight", tuple(min(1, component * 1.35 + 0.12) for component in accent), metallic=0.42, roughness=0.12, emission=0.12)
    if kind == "sun":
        add_cube("Sun core", (0, 0, 0.72), (0.74, 0.74, 0.30), pale, math.radians(45))
        for angle in range(0, 360, 45):
            radians = math.radians(angle)
            add_cone("Sun ray", (math.cos(radians) * 1.02, math.sin(radians) * 1.02, 0.65), 0.22, 0.38, 4, edge, radians)
    elif kind == "leaf":
        leaf = add_sphere("Emerald leaf", (0, 0.05, 0.68), (0.86, 1.18, 0.28), pale)
        leaf.rotation_euler.z = math.radians(-28)
        add_cube("Leaf vein", (0, 0, 0.98), (0.05, 1.02, 0.05), edge, math.radians(-28))
    elif kind == "water":
        add_sphere("Tide crystal", (0, 0, 0.72), (0.95, 0.95, 0.5), pale)
        add_torus("Tide orbit", 0.95, 0.09, 0.91, edge, (1, 0.58, 1))
    elif kind == "flame":
        add_cone("Ember shard", (0, -0.05, 0.82), 1.14, 0.75, 3, pale, 0)
        add_cone("Inner flame", (0, -0.14, 1.20), 0.48, 0.30, 3, edge, math.pi)
    elif kind == "moon":
        add_torus("Lunar arc", 0.82, 0.26, 0.72, pale)
        add_sphere("Moon pearl", (0.58, 0.46, 0.76), (0.25, 0.25, 0.2), edge)
    elif kind == "crown":
        star_mesh("Crown star", 6, 1.15, 0.52, 0.44, 0.72, pale)
        add_sphere("Crown core", (0, 0, 1.02), (0.31, 0.31, 0.18), edge)
    elif kind == "wild":
        add_torus("Wild reactor", 0.73, 0.23, 0.72, pale)
        for angle in range(0, 360, 120):
            radians = math.radians(angle)
            add_cone("Wild spike", (math.cos(radians) * 1.02, math.sin(radians) * 1.02, 0.82), 0.25, 0.45, 3, edge, radians)
        add_sphere("Wild core", (0, 0, 0.95), (0.28, 0.28, 0.16), edge)


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
