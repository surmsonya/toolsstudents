/**
 * Палитра второй страницы: монохром с уходом в тёплую грязь.
 * Единственный источник правды — и для шейдеров, и для фона страницы.
 * Меняется правкой трёх значений; количество ступеней постеризации ниже.
 */
export const PALETTE = {
  shadow: "#0d0b09",
  mid: "#4a4038",
  light: "#e8e2d6",
} as const;

/** Ступеней тона на модели. Меньше — грубее, ближе к печати. */
export const TONE_STEPS = 6;

/**
 * Тонов в фоне. Три — как в палитре: тень, грязь, кость.
 * В шейдер уходит число интервалов между ними (тонов минус один).
 */
export const BACKGROUND_TONES = 3;

/**
 * Форма источника: как сырой fbm раскладывается по трём тонам.
 * `floor`/`ceil` — окно значений шума, которое вообще доезжает до кадра,
 * `gamma` — насколько сильно середина утягивается в тень.
 * Подобрано замером: тень ≈ ⅔ фона, кость — редкие пики.
 */
export const FIELD_SHAPE = {
  floor: 0.34,
  ceil: 0.83,
  gamma: 2.0,
} as const;

export const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

/**
 * Упорядоченный дизеринг Байера 8×8 без текстуры, рекурсией по 2×2.
 * Возвращает [0, 1). Один и тот же чанк работает в модели и в фоне.
 */
export const BAYER_CHUNK = /* glsl */ `
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

float bayer8(vec2 a) {
  return bayer4(0.5 * a) * 0.25 + bayer2(a);
}
`;

/** Три тона палитры и рампа между ними — общее для модели и фона. */
export const PALETTE_CHUNK = /* glsl */ `
uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uLight;

vec3 ramp(float t) {
  return t < 0.5
    ? mix(uShadow, uMid, t * 2.0)
    : mix(uMid, uLight, (t - 0.5) * 2.0);
}
`;

/**
 * Долинный шум с domain warping: fbm от координат, сдвинутых другим fbm.
 * Даёт медленно перетекающие жгуты вместо равномерной ваты.
 */
export const FBM_CHUNK = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  // поворот между октавами разбивает решётку value-шума: без него
  // на пологих местах видна сетка целочисленных координат
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  float sum = 0.0;
  float amp = 0.5;

  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p);
    p = turn * p * 2.03;
    amp *= 0.5;
  }

  return sum;
}

float warpedFbm(vec2 p, float t) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, t * 0.05)),
    fbm(p + vec2(5.2, 1.3) - vec2(t * 0.04, 0.0))
  );

  return fbm(p + 2.2 * q + vec2(0.0, t * 0.02));
}
`;

/** Полноэкранный квад: позиция уже в клип-пространстве, матрицы не нужны. */
export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Снимок видео с камеры в буфер поля: сэмплируем с учётом соотношения
 * сторон (cover — обрезаем лишнее, не сжимаем) и зеркалим по X, как в зеркале.
 * Пишем яркость в .r — тем же каналом, что у самого поля, поэтому
 * накопительный проход читает оба источника одинаково.
 */
export const CAMERA_BLIT_FRAGMENT = /* glsl */ `
uniform sampler2D uVideo;
uniform vec2 uCoverScale;

varying vec2 vUv;

void main() {
  vec2 uv = (vUv - 0.5) * uCoverScale + 0.5;
  uv.x = 1.0 - uv.x;
  uv = clamp(uv, 0.0, 1.0);

  vec3 color = texture2D(uVideo, uv).rgb;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vec3(luma), 1.0);
}
`;

/**
 * Накопительный проход (ping-pong FBO, половинное разрешение).
 * Каждый кадр: старое содержимое чуть разъезжается от центра и гаснет,
 * поверх подмешивается доля источника.
 *
 * Источников два: процедурный FBM и разностный кадр камеры (только то,
 * что изменилось между uCameraCurrent и uCameraPrevious — эти буферы
 * снимает `CAMERA_BLIT_FRAGMENT`, тем же ping-pong, что и у самого поля).
 * uCameraMix — единая uniform кроссфейда между ними, ~2 с на переход.
 */
export const ACCUMULATE_FRAGMENT = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uAspect;
uniform float uTime;
uniform float uMix;
uniform float uDecay;
uniform float uZoom;
uniform float uCameraMix;
uniform sampler2D uCameraCurrent;
uniform sampler2D uCameraPrevious;

varying vec2 vUv;

${FBM_CHUNK}

void main() {
  // делим, а не умножаем: выборка стягивается к центру, значит содержимое
  // расползается наружу. Координата при этом остаётся внутри 0…1,
  // и края не размазываются в полосы через clamp-to-edge
  vec2 drift = (vUv - 0.5) / uZoom + 0.5;
  float prev = texture2D(uPrev, drift).r * uDecay;

  vec2 p = (vUv - 0.5) * uAspect * 2.6;
  float field = warpedFbm(p, uTime);

  // fbm из четырёх октав живёт около 0.5; растягиваем и подтягиваем к тени,
  // чтобы костяной тон остался редким пиком, а не половиной кадра
  field = pow(
    smoothstep(${FIELD_SHAPE.floor.toFixed(2)}, ${FIELD_SHAPE.ceil.toFixed(2)}, field),
    ${FIELD_SHAPE.gamma.toFixed(2)}
  );

  float current = texture2D(uCameraCurrent, vUv).r;
  float previous = texture2D(uCameraPrevious, vUv).r;
  // усиление: слабое шевеление в тёмной комнате тоже должно быть видно
  float cameraDiff = clamp(abs(current - previous) * 6.0, 0.0, 1.0);

  float source = mix(field, cameraDiff, uCameraMix);

  gl_FragColor = vec4(vec3(mix(prev, source, uMix)), 1.0);
}
`;

/** Композит фона: накопленное поле → дизеринг Байера → три тона палитры. */
export const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D uField;
uniform float uSteps;

varying vec2 vUv;

${PALETTE_CHUNK}
${BAYER_CHUNK}

void main() {
  float tone = texture2D(uField, vUv).r;

  // дизеринг берётся от пикселя экрана, а не от поля: зерно должно быть
  // одного размера с зерном модели, иначе фон читается как отдельный слой
  float dither = bayer8(gl_FragCoord.xy) - 0.5;
  tone = clamp(floor(tone * uSteps + dither + 0.5) / uSteps, 0.0, 1.0);

  gl_FragColor = vec4(ramp(tone), 1.0);
}
`;

export const MODEL_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

/**
 * У модели нет UV — только POSITION и NORMAL, поэтому весь материал
 * считается от нормали в пространстве вида (matcap-подход).
 *
 * Отражение живого кадра камеры подмешивается по вектору reflect(-V, N),
 * спроецированному в UV кадра, с коэффициентом uEnvMix — вне камеры он
 * равен нулю, и шейдер работает как чистый matcap.
 */
export const MODEL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSteps;
uniform sampler2D uCameraVideo;
uniform float uEnvMix;
uniform float uCameraVideoAspect;

varying vec3 vNormal;
varying vec3 vViewDir;

${PALETTE_CHUNK}
${BAYER_CHUNK}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  vec3 keyDir = normalize(vec3(0.45, 0.75, 0.55));
  vec3 fillDir = normalize(vec3(-0.65, -0.25, 0.35));

  float key = max(dot(N, keyDir), 0.0);
  float fill = max(dot(N, fillDir), 0.0);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float spec = pow(max(dot(reflect(-keyDir, N), V), 0.0), 42.0);

  // медленный масляный дрейф, чтобы поверхность не была мёртвой
  float drift = sin(N.x * 4.1 + uTime * 0.31) * sin(N.y * 3.3 - uTime * 0.24);

  // ключевой свет берётся без заворота: с ним вся модель уезжала
  // в светлую половину рампы и читалась серым пластиком
  float tone = 0.08
    + key * 0.52
    + fill * 0.18
    + fresnel * 0.26
    + spec * 0.80
    + drift * 0.05;

  tone = clamp(tone, 0.0, 1.0);

  // отражение комнаты: reflect(-V, N) как UV кадра, зеркалим по X (как
  // в зеркале, а не как на видео с себя) и подмешиваем сильнее на гранях —
  // тем же fresnel, что уже посчитан для блика
  vec3 R = reflect(-V, N);
  vec2 envUv = R.xy * 0.5 + 0.5;
  envUv = (envUv - 0.5) * vec2(1.0, uCameraVideoAspect) + 0.5;
  envUv.x = 1.0 - envUv.x;
  envUv = clamp(envUv, 0.0, 1.0);

  vec3 envColor = texture2D(uCameraVideo, envUv).rgb;
  float envLuma = dot(envColor, vec3(0.299, 0.587, 0.114));
  tone = mix(tone, tone * 0.35 + envLuma * 0.65, uEnvMix * fresnel);
  tone = clamp(tone, 0.0, 1.0);

  // постеризация с упорядоченным дизерингом — печатная грязь вместо градиента
  float dither = bayer8(gl_FragCoord.xy) - 0.5;
  tone = clamp(floor(tone * uSteps + dither + 0.5) / uSteps, 0.0, 1.0);

  gl_FragColor = vec4(ramp(tone), 1.0);
}
`;
