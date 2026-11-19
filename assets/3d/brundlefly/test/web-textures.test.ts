import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

interface TextureInfo {
  index: number
  texCoord?: number
  extensions?: { KHR_texture_transform?: { texCoord?: number } }
}

interface Material {
  name: string
  pbrMetallicRoughness?: { baseColorTexture?: TextureInfo, metallicRoughnessTexture?: TextureInfo }
  normalTexture?: TextureInfo
  occlusionTexture?: TextureInfo
  emissiveTexture?: TextureInfo
}

test('every textured web primitive supplies the coordinates selected by its material', () => {
  // Consume the delivered exporter output, including both eye markers.
  const bytes = readFileSync(new URL('../brundlefly-web.glb', import.meta.url))
  assert.equal(bytes.readUInt32LE(0), 0x46546C67)
  assert.equal(bytes.readUInt32LE(4), 2)
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as {
    meshes: { name: string, primitives: { material?: number, attributes: Record<string, number> }[] }[]
    materials: Material[]
    accessors: { count: number, type: string, componentType: number }[]
  }
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      if (primitive.material === undefined)
        continue
      const material = gltf.materials[primitive.material]!
      const textures = [material.pbrMetallicRoughness?.baseColorTexture,
        material.pbrMetallicRoughness?.metallicRoughnessTexture,
        material.normalTexture, material.occlusionTexture, material.emissiveTexture]
      for (const texture of textures) {
        if (!texture)
          continue
        const coordinate = texture.extensions?.KHR_texture_transform?.texCoord ?? texture.texCoord ?? 0
        const context = `${mesh.name}: ${material.name} texture coordinate ${coordinate}`
        assert.ok(Number.isInteger(coordinate) && coordinate >= 0, context)
        const accessor = gltf.accessors[primitive.attributes[`TEXCOORD_${coordinate}`]!]
        assert.ok(accessor, `${context} has no attribute`)
        assert.equal(accessor.type, 'VEC2', context)
        assert.equal(accessor.count, gltf.accessors[primitive.attributes.POSITION!]!.count, context)
      }
    }
  }
})
