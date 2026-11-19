import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PerspectiveCamera, Scene, Vector2 } from 'three'
import type { WebGLRenderer } from 'three'
import { createSceneFinish } from '../layers/brand/shared/scene-finish.ts'
import { resolveSceneQuality } from '../layers/brand/shared/scene-quality.ts'

for (const tier of ['medium', 'high']) {
  for (const [reason, floatColour, samples, supported] of [
    ['half-float colour is unavailable', false, [4, 2], false],
    ['half-float samples are unavailable', true, [], false],
    ['the requested sample count is unavailable', true, [1], false],
    ['the requested targets are supported', true, [4, 2], true],
  ] as const) {
    test(`${tier} selects the rendering path when ${reason}`, () => {
      const renderer = {
        getDrawingBufferSize: (size: Vector2) => size.set(1280, 720),
        getPixelRatio: () => 1,
        extensions: { has: () => floatColour },
        getContext: () => ({ RENDERBUFFER: 0x8D41, RGBA16F: 0x881A, DEPTH_COMPONENT24: 0x81A6, SAMPLES: 0x80A9,
          getInternalformatParameter: () => new Int32Array(samples) }),
      } as unknown as WebGLRenderer
      const quality = resolveSceneQuality({ requested: tier, coarsePointer: false, cores: 12, memory: 8, shortSide: 720 })

      const finish = createSceneFinish(renderer, new Scene(), new PerspectiveCamera(), quality)

      finish?.dispose()
      if (supported) assert.notEqual(finish, undefined)
      else assert.equal(finish, undefined)
    })
  }
}
