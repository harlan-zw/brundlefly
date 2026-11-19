import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Color, NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, Vector2 } from 'three'
import type { WebGLRenderer, WebGLRenderTarget } from 'three'
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

test('default desktop finishing bounds 4K allocations and reserves depth and samples for the scene', () => {
  const scene = new Scene()
  const pixels = new Vector2(3840, 2160)
  let target: WebGLRenderTarget | null = null
  const draws: { target: WebGLRenderTarget | null, scene: boolean }[] = []
  const renderer = {
    autoClear: true,
    outputColorSpace: SRGBColorSpace,
    toneMapping: NoToneMapping,
    toneMappingExposure: 1,
    getDrawingBufferSize: (size: Vector2) => size.copy(pixels),
    getPixelRatio: () => 1.5,
    extensions: { has: () => true },
    getContext: () => ({ RENDERBUFFER: 0x8D41, RGBA16F: 0x881A, DEPTH_COMPONENT24: 0x81A6, SAMPLES: 0x80A9,
      getInternalformatParameter: () => new Int32Array([4, 2]) }),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => { target = next },
    getClearColor: (colour: Color) => colour.set(0),
    getClearAlpha: () => 1,
    setClearColor: () => {},
    clear: () => {},
    render: (object: unknown) => { draws.push({ target, scene: object === scene }) },
  } as unknown as WebGLRenderer
  const quality = resolveSceneQuality({ requested: undefined, coarsePointer: false, cores: 12, memory: 8, shortSide: 2160 })
  const finish = createSceneFinish(renderer, scene, new PerspectiveCamera(), quality)!
  const frame = { time: 0, focus: 1, focusDistance: 3 }
  const checkFrame = (width: number, height: number) => {
    draws.length = 0
    finish.render(frame)
    const sceneDraws = draws.filter(draw => draw.scene)
    assert.equal(sceneDraws.length, 1)
    const sceneTarget = sceneDraws[0]!.target!
    assert.equal(sceneTarget.width, width)
    assert.equal(sceneTarget.height, height)
    assert.equal(sceneTarget.samples, 4)
    assert.ok(sceneTarget.depthTexture)
    const targets = new Set(draws.map(draw => draw.target).filter(value => value !== null))
    assert.ok(targets.size > 2, 'exercise the scene, compositor, and bloom targets')
    for (const allocated of targets) {
      assert.ok(allocated.width * allocated.height <= 1920 * 1080, `${allocated.width}x${allocated.height} exceeds the pixel budget`)
      if (allocated !== sceneTarget) {
        assert.equal(allocated.samples, 0, 'finishing targets must be single-sample')
        assert.equal(allocated.depthBuffer, false, 'finishing targets do not need depth')
        assert.equal(allocated.depthTexture, null)
      }
    }
    assert.ok(draws.some(draw => draw.target === null), 'present the finished picture')
    assert.equal(target, null, 'restore the caller target')
  }
  try {
    checkFrame(1920, 1080)
    pixels.set(7680, 4320)
    finish.setSize(5120, 2880)
    checkFrame(1920, 1080)
    pixels.set(1280, 720)
    finish.setSize(1280 / 1.5, 720 / 1.5)
    checkFrame(1280, 720)
  } finally {
    finish.dispose()
  }
})
