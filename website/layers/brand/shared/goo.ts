import { Color, DoubleSide, ShaderMaterial } from 'three'
import type { Texture } from 'three'

export type GooInput = { time: number, breath: number, flow: number, wetness: number, key: number, fill: number, rim: number }

/** One moving wet surface for puddles, strands, and hanging drops. The caller owns the texture. */
export function createGooMaterial(texture: Texture) {
  const uniforms = {
    uTexture: { value: texture },
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uFlow: { value: 0 },
    uWetness: { value: 0.85 },
    uKey: { value: 1 },
    uFill: { value: 1 },
    uRim: { value: 1 },
    uOlive: { value: new Color('#777648') },
    uWing: { value: new Color('#A4B5A0') },
    uBruise: { value: new Color('#69404B') },
    uCold: { value: new Color('#418B90') },
  }
  const material = new ShaderMaterial({
    name: 'Brundlefly-living-mucus',
    uniforms,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uBreath;
      uniform float uFlow;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vView;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec3 worldNormal = normalize(vec3(
          dot(viewNormal, viewMatrix[0].xyz),
          dot(viewNormal, viewMatrix[1].xyz),
          dot(viewNormal, viewMatrix[2].xyz)
        ));
        float pulse = sin(uTime * 1.2 + world.x * 0.6 + world.z * 0.42);
        float creep = sin(world.x * 4.7 + world.z * 3.1 - uTime * 0.32)
          * cos(world.y * 5.2 + world.z * 2.7 + uTime * 0.19);
        world += worldNormal * (pulse * uBreath * 0.015 + creep * uFlow * 0.012);
        // World-space amplitudes stay small even on extremely flattened puddle meshes.
        world.y = max(world.y, -2.215);
        vWorld = world;
        vec4 view = viewMatrix * vec4(world, 1.0);
        vView = view.xyz;
        vNormal = viewNormal;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform float uFlow;
      uniform float uWetness;
      uniform float uKey;
      uniform float uFill;
      uniform float uRim;
      uniform vec3 uOlive;
      uniform vec3 uWing;
      uniform vec3 uBruise;
      uniform vec3 uCold;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vView;
      varying vec3 vNormal;

      vec2 filmCoordinates(vec2 p) {
        float drift = uTime * uFlow;
        vec2 current = vec2(
          sin(p.y * 3.7 + drift * 0.12),
          cos(p.x * 4.3 - drift * 0.1)
        );
        return fract(p + current * 0.065 + vec2(drift * 0.009, -drift * 0.016));
      }

      float film(vec2 p) {
        float drift = uTime * uFlow;
        float membrane = dot(texture2D(uTexture, filmCoordinates(p)).rgb, vec3(0.299, 0.587, 0.114));
        float wrinkles = sin(p.x * 27.0 + sin(p.y * 13.0 + drift * 0.16) * 2.1)
          * cos(p.y * 19.0 - drift * 0.13);
        return membrane * 0.78 + wrinkles * 0.08;
      }

      void main() {
        vec3 surfaceNormal = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 geometric = normalize(cross(dFdx(vView), dFdy(vView))) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 normal = normalize(mix(surfaceNormal, geometric, 0.18));
        // World projection gives puddles continuous grain. Tube UVs retain downward flow.
        float horizontal = smoothstep(0.5, 0.92, abs(dot(normal, normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0)))));
        vec2 filmUv = mix(vUv * vec2(1.65, 2.5), vWorld.xz * 0.42, horizontal);
        float height = film(filmUv);
        vec3 textureColor = texture2D(uTexture, filmCoordinates(filmUv)).rgb;
        vec3 surfaceDx = dFdx(vView);
        vec3 surfaceDy = dFdy(vView);
        vec3 gradientX = cross(surfaceDy, normal);
        vec3 gradientY = cross(normal, surfaceDx);
        float determinant = dot(surfaceDx, gradientX);
        vec3 bump = sign(determinant) * (dFdx(height) * gradientX + dFdy(height) * gradientY);
        normal = normalize(abs(determinant) * normal - bump * (0.06 + uWetness * 0.09));
        vec3 viewDirection = normalize(-vView);
        vec3 keyLight = normalize(mat3(viewMatrix) * vec3(-0.45, 0.85, 0.65));
        vec3 rimLight = normalize(mat3(viewMatrix) * vec3(0.7, 0.4, -0.4));
        float diffuse = max(dot(normal, keyLight), 0.0);
        float fresnel = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 5.0);
        float sheen = pow(max(dot(normal, normalize(keyLight + viewDirection)), 0.0), mix(70.0, 180.0, uWetness));
        float rimSheen = pow(max(dot(normal, normalize(rimLight + viewDirection)), 0.0), 95.0);
        // Pigment belongs beneath the clear film. Texture chroma retains the generated mucus detail.
        vec3 body = mix(uOlive * 0.65, textureColor * vec3(0.65, 0.72, 0.4), 0.55);
        body = mix(body, uBruise * 0.14, (1.0 - smoothstep(0.18, 0.42, height)) * 0.25);
        float vein = smoothstep(0.28, 0.61, height);
        float streak = 0.3 + 0.7 * smoothstep(-0.4, 0.7,
          sin(filmUv.x * 34.0 + sin(filmUv.y * 21.0) * 2.8 - uTime * uFlow * 0.2));
        float wetIslands = vein * streak;
        vec3 color = body * (0.2 + uFill * 0.17 + diffuse * 0.45 * uKey);
        color += uWing * sheen * (0.1 + uWetness * 0.9) * (0.2 + wetIslands * 0.8) * uKey;
        color += uOlive * fresnel * uWetness * wetIslands * 0.09;
        color += uCold * rimSheen * wetIslands * uWetness * uRim * 0.12;
        float opacity = clamp(0.3 + height * 0.14 + wetIslands * 0.15 + sheen * 0.38, 0.25, 0.74);
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  return {
    material,
    update({ time, breath, flow, wetness, key, fill, rim }: GooInput) {
      uniforms.uTime.value = breath === 0 && flow === 0 ? 0 : time
      uniforms.uBreath.value = breath
      uniforms.uFlow.value = flow
      uniforms.uWetness.value = wetness
      uniforms.uKey.value = key / 90
      uniforms.uFill.value = fill / 0.65
      uniforms.uRim.value = rim / 0.4
    },
    dispose() { material.dispose() },
  }
}
