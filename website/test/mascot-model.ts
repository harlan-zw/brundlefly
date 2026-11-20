// Test support: loads the real model file in node. Its textures need a browser to decode, so the file is read without them.
// The skeleton, the skin, and the clips are the file's own.
import { readFileSync } from 'node:fs'
import type { AnimationClip, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

type Material = { normalTexture?: unknown, occlusionTexture?: unknown, emissiveTexture?: unknown, extensions?: unknown
  pbrMetallicRoughness?: { baseColorTexture?: unknown, metallicRoughnessTexture?: unknown } }
type Document = { images?: unknown, textures?: unknown, samplers?: unknown, materials?: Material[] }

export async function loadMascotModel(path = new URL('../../assets/3d/brundlefly/brundlefly-web.glb', import.meta.url)): Promise<{ scene: Object3D, animations: AnimationClip[] }> {
  const file = readFileSync(path)
  // A binary glTF file is a 12 byte header, a JSON chunk, and a binary chunk. Only the JSON chunk changes here.
  const jsonLength = file.readUInt32LE(12)
  const document = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as Document
  delete document.images
  delete document.textures
  delete document.samplers
  for (const material of document.materials ?? []) {
    delete material.normalTexture
    delete material.occlusionTexture
    delete material.emissiveTexture
    delete material.extensions
    delete material.pbrMetallicRoughness?.baseColorTexture
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture
  }
  const text = Buffer.from(JSON.stringify(document), 'utf8')
  const json = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)])
  const rest = file.subarray(20 + jsonLength)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546C67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + json.length + rest.length, 8)
  header.writeUInt32LE(json.length, 12)
  header.writeUInt32LE(0x4E4F534A, 16)
  const packed = Buffer.concat([header, json, rest])
  const model = await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer, '')
  return { scene: model.scene, animations: model.animations }
}
