// Makes brundlefly-web.glb smaller with no loss that shows. Run after export_model.py --web:
//   node compact_glb.ts <in.glb> <out.glb>
// It stores each normal as three signed bytes, each texture coordinate as two unsigned shorts,
// and each set of skin weights as four unsigned bytes. Positions stay as floats.
// Byte normals need the glTF extension KHR_mesh_quantization. three.js reads it with no decoder.
import { readFileSync, writeFileSync } from 'node:fs'

const FLOAT = 5126
const BYTE = 5120
const UNSIGNED_BYTE = 5121
const UNSIGNED_SHORT = 5123
const ARRAY_BUFFER = 34962
const EXTENSION = 'KHR_mesh_quantization'

interface Accessor { bufferView: number, byteOffset?: number, componentType: number, count: number, type: string, normalized?: boolean, min?: number[], max?: number[] }
interface BufferView { buffer: number, byteOffset?: number, byteLength: number, byteStride?: number, target?: number }
interface Gltf {
  accessors: Accessor[]
  bufferViews: BufferView[]
  buffers: { byteLength: number }[]
  meshes: { name?: string, primitives: { attributes: Record<string, number> }[] }[]
  extensionsUsed?: string[]
  extensionsRequired?: string[]
}
interface Glb { gltf: Gltf, bin: Buffer }
interface Packed { data: Buffer, componentType: number, byteStride?: number }

function readGlb(path: string): Glb {
  const bytes = readFileSync(path)
  if (bytes.readUInt32LE(0) !== 0x46546C67 || bytes.readUInt32LE(4) !== 2)
    throw new Error(`${path} is not a glTF 2.0 binary file.`)
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as Gltf
  const binStart = 20 + jsonLength
  const binLength = bytes.readUInt32LE(binStart)
  return { gltf, bin: bytes.subarray(binStart + 8, binStart + 8 + binLength) }
}

/** The floats of an accessor that owns its whole buffer view. Another layout is an error: this tool does not handle it. */
function floatsOf({ gltf, bin }: Glb, index: number, width: number): Float32Array {
  const accessor = gltf.accessors[index]!
  const view = gltf.bufferViews[accessor.bufferView]!
  const shared = gltf.accessors.filter(other => other.bufferView === accessor.bufferView).length > 1
  if (accessor.componentType !== FLOAT || shared || view.byteStride || (accessor.byteOffset ?? 0) !== 0)
    throw new Error(`Accessor ${index} is not a plain float accessor with its own buffer view.`)
  const start = view.byteOffset ?? 0
  return new Float32Array(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + accessor.count * width * 4))
}

function packNormals(values: Float32Array): Packed {
  const data = Buffer.alloc(values.length / 3 * 4)                 // three bytes and one byte of padding
  for (let i = 0; i < values.length / 3; i++) {
    const [x, y, z] = [values[i * 3]!, values[i * 3 + 1]!, values[i * 3 + 2]!]
    const length = Math.hypot(x, y, z) || 1
    for (const [k, v] of [x, y, z].entries())
      data.writeInt8(Math.max(-127, Math.min(127, Math.round(v / length * 127))), i * 4 + k)
  }
  return { data, componentType: BYTE, byteStride: 4 }
}

function packCoordinates(values: Float32Array): Packed {
  const data = Buffer.alloc(values.length * 2)
  for (const [i, v] of values.entries()) {
    if (v < -0.001 || v > 1.001)
      throw new Error(`A texture coordinate is ${v}. Normalised shorts hold 0 to 1 only.`)
    data.writeUInt16LE(Math.round(Math.max(0, Math.min(1, v)) * 65535), i * 2)
  }
  return { data, componentType: UNSIGNED_SHORT }
}

/** Four weights as bytes that sum to exactly 255. The largest weight takes the rounding error. */
function packWeights(values: Float32Array): Packed {
  const data = Buffer.alloc(values.length)
  for (let i = 0; i < values.length; i += 4) {
    const weights = [values[i]!, values[i + 1]!, values[i + 2]!, values[i + 3]!]
    const sum = weights.reduce((a, b) => a + b, 0) || 1
    const bytes = weights.map(w => Math.round(w / sum * 255))
    const largest = bytes.indexOf(Math.max(...bytes))
    bytes[largest]! += 255 - bytes.reduce((a, b) => a + b, 0)
    bytes.forEach((b, k) => data.writeUInt8(b, i + k))
  }
  return { data, componentType: UNSIGNED_BYTE }
}

const packers: Record<string, { width: number, pack: (values: Float32Array) => Packed }> = {
  NORMAL: { width: 3, pack: packNormals },
  TEXCOORD_0: { width: 2, pack: packCoordinates },
  WEIGHTS_0: { width: 4, pack: packWeights },
}

function compact(glb: Glb): Buffer {
  const { gltf, bin } = glb
  const replaced = new Map<number, Buffer>()
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      for (const [name, { width, pack }] of Object.entries(packers)) {
        const index = primitive.attributes[name]
        if (index === undefined || gltf.accessors[index]!.componentType !== FLOAT)
          continue
        const accessor = gltf.accessors[index]!
        const packed = pack(floatsOf(glb, index, width))
        accessor.componentType = packed.componentType
        accessor.normalized = true
        delete accessor.min
        delete accessor.max
        const view = gltf.bufferViews[accessor.bufferView]!
        view.target = ARRAY_BUFFER
        if (packed.byteStride)
          view.byteStride = packed.byteStride
        replaced.set(accessor.bufferView, packed.data)
      }
    }
  }
  // Lay the buffer views out again, each on a four byte boundary.
  const parts: Buffer[] = []
  let offset = 0
  for (const [index, view] of gltf.bufferViews.entries()) {
    const start = view.byteOffset ?? 0
    const data = replaced.get(index) ?? bin.subarray(start, start + view.byteLength)
    const padding = (4 - data.length % 4) % 4
    view.byteOffset = offset
    view.byteLength = data.length
    parts.push(data, Buffer.alloc(padding))
    offset += data.length + padding
  }
  gltf.buffers[0]!.byteLength = offset
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), EXTENSION])]
  gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired ?? []), EXTENSION])]

  const json = Buffer.from(JSON.stringify(gltf))
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
  const binChunk = Buffer.concat(parts)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546C67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunkHeader = (length: number, type: number) => {
    const out = Buffer.alloc(8)
    out.writeUInt32LE(length, 0)
    out.writeUInt32LE(type, 4)
    return out
  }
  return Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4E4F534A), jsonChunk, chunkHeader(binChunk.length, 0x004E4942), binChunk])
}

const [input, output] = process.argv.slice(2)
if (!input || !output)
  throw new Error('Usage: node compact_glb.ts <in.glb> <out.glb>')
const before = readFileSync(input).length
const result = compact(readGlb(input))
writeFileSync(output, result)
console.log(`COMPACT ${before} bytes to ${result.length} bytes, ${before - result.length} saved`)
