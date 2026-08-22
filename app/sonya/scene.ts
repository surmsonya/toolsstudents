import {
  Box3,
  Camera,
  ClampToEdgeWrapping,
  ColorManagement,
  Group,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import {
  DRACO_GLTF_CONFIG,
  DRACOLoader,
} from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  ACCUMULATE_FRAGMENT,
  BACKGROUND_TONES,
  COMPOSITE_FRAGMENT,
  FULLSCREEN_VERTEX,
  MODEL_FRAGMENT,
  MODEL_VERTEX,
  PALETTE,
  TONE_STEPS,
  hexToRgb,
} from "./shaders";
import type { PointerSignal } from "./tracking";

type SceneOptions = {
  canvas: HTMLCanvasElement;
  modelUrl: string;
  pointer: PointerSignal;
  onReady?: () => void;
  onError?: (error: unknown) => void;
};

export type SceneHandle = {
  dispose: () => void;
};

/** Доля высоты экрана, которую занимает модель. 1 / 1.3 ≈ 78%, как на первой странице. */
const FRAME_MARGIN = 1.3;
/** Фоновое вращение — тот же градус в секунду, что у model-viewer на первой странице. */
const AUTO_SPIN = MathUtils.degToRad(8);
const MAX_YAW = MathUtils.degToRad(22);
const MAX_PITCH = MathUtils.degToRad(14);
/** Жёсткость возврата модели к цели: больше — резче слежение. */
const DAMPING = 4;

/*
 * Накопление. Все три величины заданы «в секунду», а не «за кадр»:
 * иначе след на телефоне с его 30 кадрами тянулся бы вдвое иначе,
 * чем на десктопе.
 */
/** Скорость подмешивания источника: доля 1 − e⁻ᵏᵗ ≈ 7% за кадр при 60 fps. */
const SOURCE_RATE = 4.35;
/** Затухание старого содержимого. */
const DECAY_RATE = 0.32;
/** Расползание следа от центра, доля за секунду. */
const ZOOM_RATE = 0.085;
/** Во сколько раз буфер накопления мельче кадра. */
const FIELD_SCALE = 2;
/**
 * Прогон накопления до первого показа: с пустого буфера поле набирается
 * около секунды, и без прогрева страница открывалась бы чёрной.
 */
const PRIME_STEPS = 90;
const PRIME_DELTA = 1 / 60;

export function createScene(options: SceneOptions): SceneHandle {
  const { canvas, modelUrl, pointer, onReady, onError } = options;

  // Палитра задана в sRGB «на глаз» и должна доехать до экрана без пересчёта:
  // сцена не физическая, конвертации только увели бы тона от заданных.
  ColorManagement.enabled = false;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(PALETTE.shadow, 1);
  // фон рисуется первым и кладёт цвет во весь кадр, модель — поверх него
  renderer.autoClear = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  const group = new Group();
  scene.add(group);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");

  const uniforms = {
    uShadow: { value: hexToRgb(PALETTE.shadow) },
    uMid: { value: hexToRgb(PALETTE.mid) },
    uLight: { value: hexToRgb(PALETTE.light) },
    uSteps: { value: TONE_STEPS },
    uTime: { value: 0 },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: MODEL_VERTEX,
    fragmentShader: MODEL_FRAGMENT,
  });

  /*
   * Фон — два полноэкранных прохода. Накопление живёт в паре FBO
   * половинного разрешения: читаем из одного, пишем в другой, меняем местами.
   * Композит берёт накопленное поле и давит его в три тона палитры.
   *
   * Вершинный шейдер обоих проходов пишет gl_Position напрямую, поэтому
   * камера здесь формальность: её матрицы не участвуют.
   */
  const quadGeometry = new PlaneGeometry(2, 2);
  const quadCamera = new Camera();

  const accumulateUniforms = {
    uPrev: { value: null as WebGLRenderTarget["texture"] | null },
    uAspect: { value: new Vector2(1, 1) },
    uTime: uniforms.uTime,
    uMix: { value: 0 },
    uDecay: { value: 1 },
    uZoom: { value: 1 },
    // этап 3 переведёт это с нуля и подмешает разностный кадр камеры
    uCameraMix: { value: 0 },
  };

  const accumulateMaterial = new ShaderMaterial({
    uniforms: accumulateUniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: ACCUMULATE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const compositeUniforms = {
    uField: { value: null as WebGLRenderTarget["texture"] | null },
    uShadow: uniforms.uShadow,
    uMid: uniforms.uMid,
    uLight: uniforms.uLight,
    uSteps: { value: BACKGROUND_TONES - 1 },
  };

  const compositeMaterial = new ShaderMaterial({
    uniforms: compositeUniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const makeQuad = (quadMaterial: ShaderMaterial) => {
    const mesh = new Mesh(quadGeometry, quadMaterial);
    // квад уже в клип-пространстве, отсечение по пирамиде тут врёт
    mesh.frustumCulled = false;

    const quadScene = new Scene();
    quadScene.add(mesh);
    return quadScene;
  };

  const accumulateScene = makeQuad(accumulateMaterial);
  const compositeScene = makeQuad(compositeMaterial);

  const makeField = (width: number, height: number) =>
    new WebGLRenderTarget(width, height, {
      // 8 бит на канал не переживают затухание: маленькие значения
      // округлялись бы к соседней ступени и след шёл бы полосами
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });

  let fields: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
  let readIndex = 0;
  const drawingSize = new Vector2();

  /** Один шаг накопления: старое поле разъезжается и гаснет, источник подмешивается. */
  const accumulate = (step: number) => {
    if (!fields) {
      return;
    }

    accumulateUniforms.uMix.value = 1 - Math.exp(-step * SOURCE_RATE);
    accumulateUniforms.uDecay.value = Math.exp(-step * DECAY_RATE);
    accumulateUniforms.uZoom.value = 1 + step * ZOOM_RATE;
    accumulateUniforms.uPrev.value = fields[readIndex].texture;

    const target = fields[1 - readIndex];
    renderer.setRenderTarget(target);
    renderer.render(accumulateScene, quadCamera);
    renderer.setRenderTarget(null);

    readIndex = 1 - readIndex;
    compositeUniforms.uField.value = fields[readIndex].texture;
  };

  /** Прогрев: с пустого буфера поле набирается около секунды. */
  const primeField = () => {
    for (let i = 0; i < PRIME_STEPS; i += 1) {
      uniforms.uTime.value += PRIME_DELTA;
      accumulate(PRIME_DELTA);
    }
  };

  /**
   * Перенос поля в новую пару буферов: тот же проход, но без источника
   * и без затухания — по сути копия с растяжением. Один кадр вместо
   * девяноста, поэтому перетаскивание окна не спотыкается, и след
   * не начинается заново на каждый пиксель ширины.
   */
  const carryOver = (previous: WebGLRenderTarget) => {
    if (!fields) {
      return;
    }

    accumulateUniforms.uMix.value = 0;
    accumulateUniforms.uDecay.value = 1;
    accumulateUniforms.uZoom.value = 1;
    accumulateUniforms.uPrev.value = previous.texture;

    renderer.setRenderTarget(fields[readIndex]);
    renderer.render(accumulateScene, quadCamera);
    renderer.setRenderTarget(null);

    compositeUniforms.uField.value = fields[readIndex].texture;
  };

  const resizeField = () => {
    renderer.getDrawingBufferSize(drawingSize);
    const width = Math.max(1, Math.round(drawingSize.x / FIELD_SCALE));
    const height = Math.max(1, Math.round(drawingSize.y / FIELD_SCALE));

    if (fields && fields[0].width === width && fields[0].height === height) {
      return;
    }

    const previous = fields;
    const carried = previous ? previous[readIndex] : null;

    fields = [makeField(width, height), makeField(width, height)];
    readIndex = 0;

    // ячейки шума считаем квадратными, иначе на широком экране
    // жгуты растягиваются в горизонтальные полосы
    const aspect = width / height;
    accumulateUniforms.uAspect.value.set(
      Math.max(aspect, 1),
      Math.max(1 / aspect, 1),
    );

    if (carried) {
      carryOver(carried);
    } else {
      // первая пара буферов пуста — без прогрева страница открылась бы чёрной
      primeField();
    }

    previous?.forEach((field) => field.dispose());
  };

  let modelRadius = { vertical: 1, horizontal: 1 };
  let disposed = false;
  let frameId = 0;
  let ready = false;

  const timer = new Timer();
  let spin = 0;
  let yaw = 0;
  let pitch = 0;
  let sinceRender = 0;

  const fitCamera = () => {
    const vFov = MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

    const distance = Math.max(
      modelRadius.vertical / Math.tan(vFov / 2),
      modelRadius.horizontal / Math.tan(hFov / 2),
    );

    camera.position.set(0, 0, distance * FRAME_MARGIN);
    camera.lookAt(0, 0, 0);
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitCamera();
    camera.updateProjectionMatrix();
    resizeField();
  };

  const render = () => {
    renderer.clear();
    renderer.render(compositeScene, quadCamera);
    renderer.render(scene, camera);
  };

  const frame = (timestamp: number) => {
    frameId = requestAnimationFrame(frame);

    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.1);

    // 30 кадров на телефонах, 60 на десктопе
    const minFrameTime = coarsePointer.matches ? 1 / 32 : 0;
    sinceRender += delta;
    if (sinceRender < minFrameTime) {
      return;
    }

    const step = sinceRender;
    sinceRender = 0;

    if (!reducedMotion.matches) {
      spin += step * AUTO_SPIN;
      uniforms.uTime.value += step;
      accumulate(step);
    }

    const targetYaw = pointer.x * MAX_YAW;
    // курсор вниз — модель смотрит вниз, поэтому знак обратный
    const targetPitch = -pointer.y * MAX_PITCH;
    const damping = 1 - Math.exp(-step * DAMPING);

    yaw += (targetYaw - yaw) * damping;
    pitch += (targetPitch - pitch) * damping;

    group.rotation.y = spin + yaw;
    group.rotation.x = pitch;

    render();
  };

  const start = () => {
    if (disposed || frameId !== 0) {
      return;
    }

    // сбрасываем накопленное время, иначе после паузы прилетит огромная дельта
    timer.reset();
    frameId = requestAnimationFrame(frame);
  };

  const stop = () => {
    if (frameId !== 0) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const handleVisibility = () => {
    if (document.hidden) {
      stop();
    } else if (ready && !reducedMotion.matches) {
      start();
    }
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    stop();
  };

  const observer = new ResizeObserver(() => {
    resize();
    if (ready && frameId === 0 && !document.hidden) {
      render();
    }
  });
  observer.observe(canvas);

  document.addEventListener("visibilitychange", handleVisibility);
  canvas.addEventListener("webglcontextlost", handleContextLost);

  // модель сжата draco; берём урезанный под glTF декодер, пути к нему
  // раскладывает бандлер — своей копии в public держать не нужно
  const dracoLoader = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
  const loader = new GLTFLoader().setDRACOLoader(dracoLoader);

  loader.load(
    modelUrl,
    (gltf) => {
      if (disposed) {
        return;
      }

      const model = gltf.scene;
      model.traverse((child) => {
        if ((child as Mesh).isMesh) {
          (child as Mesh).material = material;
        }
      });

      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());

      // центрируем в исходных единицах, масштабируем группой: если применить
      // масштаб к самой модели, сдвиг центра останется в старом масштабе
      // и модель уедет из кадра
      model.position.sub(center);

      // нормируем по высоте: вертикальный радиус модели становится единицей
      const scale = size.y > 0 ? 2 / size.y : 1;
      group.scale.setScalar(scale);

      modelRadius = {
        vertical: 1,
        // при вращении вокруг Y горизонтальный габарит гуляет между X и Z —
        // берём худший случай, чтобы модель не выезжала за кадр
        horizontal: (Math.hypot(size.x, size.z) / 2) * scale,
      };

      group.add(model);
      resize();
      ready = true;

      render();
      onReady?.();

      if (!reducedMotion.matches && !document.hidden) {
        start();
      }
    },
    undefined,
    (error) => {
      if (!disposed) {
        onError?.(error);
      }
    },
  );

  resize();

  return {
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);

      group.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
        }
      });

      material.dispose();
      quadGeometry.dispose();
      accumulateMaterial.dispose();
      compositeMaterial.dispose();
      fields?.forEach((field) => field.dispose());
      timer.dispose();
      dracoLoader.dispose();
      renderer.dispose();
    },
  };
}
