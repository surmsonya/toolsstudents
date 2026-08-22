import {
  Box3,
  Camera,
  ClampToEdgeWrapping,
  ColorManagement,
  DataTexture,
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
  VideoTexture,
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
  CAMERA_BLIT_FRAGMENT,
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
  /** Камера включилась/выключилась — сцена сама заводит текстуру и кроссфейд. */
  setCameraActive: (video: HTMLVideoElement | null) => void;
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

/**
 * Кроссфейд «шум ↔ камера», единая uniform на фон и модель (§3 плана):
 * ~2 с до почти полного перехода — 1 − e⁻ᵏᵗ при k=1.6 даёт 0.96 за 2 с.
 */
const CAMERA_CROSSFADE_RATE = 1.6;
/** Ниже этого порога кроссфейд считается завершённым — можно освобождать текстуру. */
const CAMERA_MIX_EPSILON = 0.002;

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

  // Заглушка для сэмплеров камеры, пока камера выключена: без реальной
  // текстуры WebGL ругается на несвязанный сэмплер, даже если её вклад
  // умножается на нулевой uCameraMix/uEnvMix.
  const blackTexture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blackTexture.needsUpdate = true;

  const uniforms = {
    uShadow: { value: hexToRgb(PALETTE.shadow) },
    uMid: { value: hexToRgb(PALETTE.mid) },
    uLight: { value: hexToRgb(PALETTE.light) },
    uSteps: { value: TONE_STEPS },
    uTime: { value: 0 },
    uCameraVideo: { value: blackTexture as VideoTexture | DataTexture },
    uEnvMix: { value: 0 },
    uCameraVideoAspect: { value: 1 },
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
    uCameraMix: { value: 0 },
    uCameraCurrent: { value: blackTexture as WebGLRenderTarget["texture"] },
    uCameraPrevious: { value: blackTexture as WebGLRenderTarget["texture"] },
  };

  const accumulateMaterial = new ShaderMaterial({
    uniforms: accumulateUniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: ACCUMULATE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  /** Снимок кадра камеры в буфер поля — см. `CAMERA_BLIT_FRAGMENT`. */
  const camBlitUniforms = {
    uVideo: { value: blackTexture as VideoTexture | DataTexture },
    uCoverScale: { value: new Vector2(1, 1) },
  };

  const camBlitMaterial = new ShaderMaterial({
    uniforms: camBlitUniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: CAMERA_BLIT_FRAGMENT,
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
  const camBlitScene = makeQuad(camBlitMaterial);

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

  // Камера: живая VideoTexture для отражения на модели плюс пара буферов
  // «текущий/предыдущий кадр» того же размера, что и поле, — накопительный
  // проход сравнивает их и получает разностный кадр (см. shaders.ts).
  let cameraTexture: VideoTexture | null = null;
  let cameraVideoAspect = 4 / 3;
  let camFields: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
  let camReadIndex = 0;
  let cameraMixTarget = 0;
  let cameraMixValue = 0;

  /** cover-crop: доля UV кадра камеры, которая реально попадает в буфер. */
  const coverScale = (containerAspect: number, imageAspect: number) =>
    containerAspect > imageAspect
      ? ([1, imageAspect / containerAspect] as const)
      : ([containerAspect / imageAspect, 1] as const);

  const blitCameraFrame = (target: WebGLRenderTarget) => {
    if (!cameraTexture) {
      return;
    }
    camBlitUniforms.uVideo.value = cameraTexture;
    const [scaleX, scaleY] = coverScale(
      target.width / target.height,
      cameraVideoAspect,
    );
    camBlitUniforms.uCoverScale.value.set(scaleX, scaleY);

    renderer.setRenderTarget(target);
    renderer.render(camBlitScene, quadCamera);
    renderer.setRenderTarget(null);
  };

  /** Заводит (или пересоздаёт под новый размер) буферы кадров камеры. */
  const ensureCamFields = () => {
    if (!fields || !cameraTexture) {
      return;
    }

    const width = fields[0].width;
    const height = fields[0].height;
    if (camFields && camFields[0].width === width && camFields[0].height === height) {
      return;
    }

    camFields?.forEach((field) => field.dispose());
    camFields = [makeField(width, height), makeField(width, height)];
    camReadIndex = 0;

    // Снимаем текущий кадр в оба буфера: иначе первый расчёт разницы
    // сравнивал бы живое видео с пустым (чёрным) буфером — вспышка на
    // весь экран вместо тихого старта.
    blitCameraFrame(camFields[0]);
    blitCameraFrame(camFields[1]);
    accumulateUniforms.uCameraCurrent.value = camFields[0].texture;
    accumulateUniforms.uCameraPrevious.value = camFields[1].texture;
  };

  /** Один шаг разностного кадра: снимок текущего кадра, диф со старым. */
  const updateCameraDiff = () => {
    if (!camFields || !cameraTexture) {
      return;
    }

    const writeTarget = camFields[1 - camReadIndex];
    blitCameraFrame(writeTarget);

    accumulateUniforms.uCameraCurrent.value = writeTarget.texture;
    accumulateUniforms.uCameraPrevious.value = camFields[camReadIndex].texture;

    camReadIndex = 1 - camReadIndex;
  };

  const releaseCameraTexture = () => {
    cameraTexture?.dispose();
    cameraTexture = null;
    camFields?.forEach((field) => field.dispose());
    camFields = null;
    accumulateUniforms.uCameraCurrent.value = blackTexture;
    accumulateUniforms.uCameraPrevious.value = blackTexture;
    uniforms.uCameraVideo.value = blackTexture;
  };

  const setCameraActive = (video: HTMLVideoElement | null) => {
    if (video) {
      cameraTexture?.dispose();
      cameraTexture = new VideoTexture(video);
      cameraTexture.minFilter = LinearFilter;
      cameraTexture.magFilter = LinearFilter;
      cameraTexture.generateMipmaps = false;

      const readAspect = () => {
        if (video.videoWidth && video.videoHeight) {
          cameraVideoAspect = video.videoWidth / video.videoHeight;
          uniforms.uCameraVideoAspect.value = cameraVideoAspect;
        }
      };
      readAspect();
      if (!video.videoWidth) {
        video.addEventListener("loadedmetadata", readAspect, { once: true });
      }

      uniforms.uCameraVideo.value = cameraTexture;
      cameraMixTarget = 1;
      ensureCamFields();
    } else {
      cameraMixTarget = 0;
      // текстуру не гасим сразу — кроссфейд ещё идёт кадры, снимок
      // остаётся источником диффа, пока uCameraMix не дойдёт до нуля
    }
  };

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

    if (!fields || fields[0].width !== width || fields[0].height !== height) {
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
    }

    // буферы кадров камеры того же размера, что и поле — держим их в шаге
    ensureCamFields();
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

      // Единая uniform кроссфейда «шум ↔ камера» на фон и модель (§3 плана).
      const crossfadeDamping = 1 - Math.exp(-step * CAMERA_CROSSFADE_RATE);
      cameraMixValue += (cameraMixTarget - cameraMixValue) * crossfadeDamping;
      accumulateUniforms.uCameraMix.value = cameraMixValue;
      uniforms.uEnvMix.value = cameraMixValue;

      if (cameraTexture) {
        if (cameraMixTarget === 0 && cameraMixValue <= CAMERA_MIX_EPSILON) {
          // кроссфейд назад к шуму завершён — освобождаем ресурсы камеры
          releaseCameraTexture();
        } else {
          updateCameraDiff();
        }
      }

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
    setCameraActive,
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
      camBlitMaterial.dispose();
      fields?.forEach((field) => field.dispose());
      camFields?.forEach((field) => field.dispose());
      cameraTexture?.dispose();
      blackTexture.dispose();
      timer.dispose();
      dracoLoader.dispose();
      renderer.dispose();
    },
  };
}
