/**
 * Жизненный цикл камеры: разрешение, поток, автостарт, пауза в фоне.
 * Ничего не знает о сцене — отдаёт наружу только `<video>` через колбэк,
 * а сцена сама решает, что с ним делать (см. `scene.ts#setCameraActive`).
 */
export type CameraStatus = "idle" | "pending" | "active" | "blocked";

export type CameraController = {
  getStatus: () => CameraStatus;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

type CameraControllerOptions = {
  onStatusChange: (status: CameraStatus) => void;
  onStreamChange: (video: HTMLVideoElement | null) => void;
};

export function createCameraController(
  options: CameraControllerOptions,
): CameraController {
  const { onStatusChange, onStreamChange } = options;

  let status: CameraStatus = "idle";
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let disposed = false;
  let resumeAfterHide = false;
  let permissionStatus: PermissionStatus | null = null;

  const setStatus = (next: CameraStatus) => {
    if (status === next) {
      return;
    }
    status = next;
    onStatusChange(status);
  };

  const teardownStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;

    if (video) {
      video.pause();
      video.srcObject = null;
    }
    video = null;

    onStreamChange(null);
  };

  const handleTrackEnded = () => {
    // Трек умер сам — разрешение отозвали в настройках браузера или
    // устройство отобрал другой таб. Не ошибка страницы, просто гасим поток.
    if (disposed) {
      return;
    }
    teardownStream();
    setStatus("idle");
  };

  const start = () => {
    if (disposed || status === "active" || status === "pending") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      // страница остаётся рабочей без камеры — просто обычный сценарий
      // с указателем/наклоном вместо центроида
      setStatus("blocked");
      return;
    }

    setStatus("pending");

    void (async () => {
      let nextStream: MediaStream;
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      } catch (error) {
        if (disposed) {
          return;
        }
        const name = (error as DOMException | undefined)?.name;
        setStatus(
          name === "NotAllowedError" || name === "SecurityError"
            ? "blocked"
            : "idle",
        );
        console.error("камера /sonya не запустилась", error);
        return;
      }

      if (disposed) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      stream = nextStream;
      stream
        .getTracks()
        .forEach((track) => track.addEventListener("ended", handleTrackEnded));

      const nextVideo = document.createElement("video");
      nextVideo.playsInline = true;
      nextVideo.muted = true;
      nextVideo.srcObject = stream;

      try {
        await nextVideo.play();
      } catch (playError) {
        // Автозапуск без явного жеста браузер отклонил — это политика
        // автовоспроизведения (характерно для iOS), а не блокировка камеры.
        // Откатываемся к обычному сценарию с нажатием.
        console.error("автозапуск камеры /sonya отклонён", playError);
        teardownStream();
        setStatus("idle");
        return;
      }

      if (disposed) {
        teardownStream();
        return;
      }

      video = nextVideo;
      setStatus("active");
      onStreamChange(video);
    })();
  };

  const stop = () => {
    if (status !== "active" && status !== "pending") {
      return;
    }
    resumeAfterHide = false;
    teardownStream();
    setStatus("idle");
  };

  // Свёрнутая вкладка не должна держать индикатор камеры включённым —
  // это читается как слежка. Трек полностью останавливается и запрашивается
  // заново при возврате: разрешение уже выдано, второго запроса не будет.
  const handleVisibility = () => {
    if (document.hidden) {
      if (status === "active") {
        resumeAfterHide = true;
        teardownStream();
        setStatus("idle");
      }
    } else if (resumeAfterHide) {
      resumeAfterHide = false;
      start();
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);

  // Автостарт: у вернувшегося посетителя с выданным разрешением поток
  // стартует сам, без панели. Там, где Permissions API недоступен (Safari),
  // автостарта нет — обычный сценарий с нажатием.
  void (async () => {
    if (!navigator.permissions?.query) {
      return;
    }

    try {
      permissionStatus = await navigator.permissions.query({
        name: "camera",
      });
      if (disposed) {
        return;
      }

      if (permissionStatus.state === "granted") {
        start();
      } else if (permissionStatus.state === "denied") {
        setStatus("blocked");
      }

      permissionStatus.addEventListener("change", () => {
        if (disposed || !permissionStatus) {
          return;
        }
        if (permissionStatus.state === "denied") {
          resumeAfterHide = false;
          teardownStream();
          setStatus("blocked");
        }
      });
    } catch {
      // "camera" не поддержан Permissions API — обычный сценарий с нажатием
    }
  })();

  return {
    getStatus: () => status,
    start,
    stop,
    dispose() {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      teardownStream();
    },
  };
}
