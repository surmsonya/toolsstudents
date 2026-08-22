/**
 * Единый нормализованный сигнал −1…1, которым управляется модель.
 * Производители по приоритету: центроид движения с камеры (этап 4),
 * указатель, наклон устройства. Сцена не знает, кто из них пишет.
 */
export type PointerSignal = { x: number; y: number };

export type PointerTracker = {
  signal: PointerSignal;
  dispose: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Наклон в градусах, отображаемый на полный размах сигнала. */
const TILT_RANGE = 26;

export function createPointerTracker(): PointerTracker {
  const signal: PointerSignal = { x: 0, y: 0 };

  // pointermove покрывает и мышь, и протаскивание пальцем
  const handlePointerMove = (event: PointerEvent) => {
    const { innerWidth, innerHeight } = window;
    if (innerWidth === 0 || innerHeight === 0) {
      return;
    }

    signal.x = clamp((event.clientX / innerWidth) * 2 - 1, -1, 1);
    signal.y = clamp((event.clientY / innerHeight) * 2 - 1, -1, 1);
  };

  const recenter = () => {
    signal.x = 0;
    signal.y = 0;
  };

  // Базовая ориентация снимается с первого события: держат телефон как держат.
  // Поворот экрана здесь не учитывается — на этапе 4 добавим screen.orientation.
  let baseBeta: number | null = null;
  let baseGamma: number | null = null;

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) {
      return;
    }

    if (baseBeta === null || baseGamma === null) {
      baseBeta = beta;
      baseGamma = gamma;
      return;
    }

    signal.x = clamp((gamma - baseGamma) / TILT_RANGE, -1, 1);
    signal.y = clamp((beta - baseBeta) / TILT_RANGE, -1, 1);
  };

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", recenter);
  window.addEventListener("blur", recenter);

  // iOS 13+ требует DeviceOrientationEvent.requestPermission() по жесту.
  // Просить его отдельным окном ради наклона не стоит — там сработает
  // протаскивание пальцем, а на этапе 4 появится центроид камеры.
  window.addEventListener("deviceorientation", handleOrientation, {
    passive: true,
  });

  return {
    signal,
    dispose() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", recenter);
      window.removeEventListener("blur", recenter);
      window.removeEventListener("deviceorientation", handleOrientation);
    },
  };
}
