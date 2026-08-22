"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { assetPath, sonyaLinks, type SonyaLink } from "../catalog-data";
import { createCameraController, type CameraStatus } from "./camera";
import { PALETTE } from "./shaders";
import "./sonya.css";

// только типы: сами модули приходят динамическим импортом ниже
import type { SceneHandle } from "./scene";
import type { PointerTracker } from "./tracking";

/**
 * Там, где превью не показать наведением, оно показывается нижним листом
 * по нажатию — ровно тот же жест, что на первой странице. Условие то же,
 * по которому прячется ховерное превью, чтобы между ними не осталось щели:
 * узкое окно или тач-устройство любой ширины.
 */
const SHEET_QUERY = "(max-width: 700px), (hover: none)";

export default function SonyaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sheetLink, setSheetLink] = useState<SonyaLink | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLAnchorElement>(null);

  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraControllerRef = useRef<ReturnType<
    typeof createCameraController
  > | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraPanelOpen, setCameraPanelOpen] = useState(false);
  const cameraCloseButtonRef = useRef<HTMLButtonElement>(null);
  const cameraTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    let scene: SceneHandle | null = null;
    let tracker: PointerTracker | null = null;

    // three и трекинг подгружаются только на клиенте и только на этом маршруте
    void (async () => {
      const [{ createScene }, { createPointerTracker }] = await Promise.all([
        import("./scene"),
        import("./tracking"),
      ]);

      if (cancelled) {
        return;
      }

      tracker = createPointerTracker();

      scene = createScene({
        canvas,
        modelUrl: assetPath("/model.glb"),
        pointer: tracker.signal,
        onReady: () => setIsReady(true),
        onError: (error) => {
          // страница остаётся рабочей: ссылки на месте, фон в цвете палитры
          console.error("сцена /sonya не загрузилась", error);
        },
      });

      sceneRef.current = scene;
      // камера могла включиться раньше, чем сцена успела загрузиться
      if (cameraVideoRef.current) {
        scene.setCameraActive(cameraVideoRef.current);
      }
    })();

    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene?.dispose();
      tracker?.dispose();
    };
  }, []);

  useEffect(() => {
    const controller = createCameraController({
      onStatusChange: setCameraStatus,
      onStreamChange: (video) => {
        cameraVideoRef.current = video;
        sceneRef.current?.setCameraActive(video);
      },
    });
    cameraControllerRef.current = controller;

    return () => {
      cameraControllerRef.current = null;
      controller.dispose();
    };
  }, []);

  const closeSheet = () => {
    setSheetLink(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: SonyaLink,
  ) => {
    if (!window.matchMedia(SHEET_QUERY).matches) {
      return;
    }

    event.preventDefault();
    setCameraPanelOpen(false);
    lastTriggerRef.current = event.currentTarget;
    setSheetLink(link);
  };

  useEffect(() => {
    if (!sheetLink) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetLink(null);
        window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sheetLink]);

  const closeCameraPanel = () => {
    setCameraPanelOpen(false);
    window.requestAnimationFrame(() => cameraTriggerRef.current?.focus());
  };

  const handleCameraTriggerClick = () => {
    if (cameraStatus === "active") {
      cameraControllerRef.current?.stop();
      return;
    }

    setSheetLink(null);
    setCameraPanelOpen(true);
  };

  const handleCameraEnable = () => {
    cameraControllerRef.current?.start();
    setCameraPanelOpen(false);
  };

  useEffect(() => {
    if (!cameraPanelOpen) {
      return;
    }

    cameraCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCameraPanelOpen(false);
        window.requestAnimationFrame(() => cameraTriggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraPanelOpen]);

  const cameraTriggerLabel =
    cameraStatus === "active"
      ? "выключить камеру"
      : cameraStatus === "blocked"
        ? "камера заблокирована"
        : "включить камеру";

  return (
    <main
      aria-label="sonya"
      className="sonya"
      style={{ background: PALETTE.shadow }}
    >
      <canvas
        aria-hidden="true"
        className={`sonya-canvas${isReady ? " is-ready" : ""}`}
        ref={canvasRef}
      />

      <nav className="sonya-links" aria-label="Ссылки">
        {sonyaLinks.map((link) => (
          <div className={`sonya-item ${link.className}`} key={link.label}>
            <a
              className="sonya-link"
              href={link.href}
              onClick={(event) => handleLinkClick(event, link)}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>

            {/*
              Превью лежит внутри пункта, а не отдельным слоем: так оно всегда
              под своим заголовком и по его левому краю, а раскладка правится
              позициями s-01…s-07, а не пересчётом в JS. Показ по наведению —
              чистым CSS, как на первой странице.
            */}
            <div aria-hidden="true" className="sonya-preview">
              <div className="sonya-preview-window">
                {link.previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="sonya-preview-image"
                    decoding="async"
                    loading="lazy"
                    src={link.previewImage}
                  />
                ) : (
                  <iframe
                    loading="lazy"
                    src={link.href}
                    tabIndex={-1}
                    title={`Превью ${link.label}`}
                  />
                )}
              </div>
              <p>{link.description}</p>
            </div>
          </div>
        ))}

        {/*
          Строка без подложки, тот же трекинг, что у ссылок каталога,
          кегль меньше — живёт в том же difference-слое и инвертирует фон.
        */}
        <button
          className="sonya-camera-trigger"
          disabled={cameraStatus === "pending"}
          onClick={handleCameraTriggerClick}
          ref={cameraTriggerRef}
          type="button"
        >
          {cameraTriggerLabel}
        </button>

        <Link className="sonya-switch" href="/">
          пин тулз
        </Link>
      </nav>

      {/*
        Лист и панель камеры рендерятся вне слоя ссылок: там difference,
        и серая подложка ушла бы в инверсию вместе с содержимым. Здесь они
        остаются плоскими и матовыми поверх кипящего фона — тем же куском
        первой страницы.
      */}
      {sheetLink ? (
        <div className="sonya-sheet-layer">
          <button
            aria-label="закрыть превью"
            className="sonya-sheet-backdrop"
            onClick={closeSheet}
            tabIndex={-1}
            type="button"
          />

          <section
            aria-labelledby="sonya-sheet-title"
            aria-modal="true"
            className="sonya-sheet"
            role="dialog"
          >
            <header className="sonya-sheet-header">
              <h2 id="sonya-sheet-title">{sheetLink.label}</h2>
              <button
                aria-label="закрыть превью"
                className="sonya-sheet-close"
                onClick={closeSheet}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="sonya-sheet-preview">
              {sheetLink.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  src={sheetLink.previewImage}
                />
              ) : (
                <iframe
                  aria-hidden="true"
                  loading="lazy"
                  src={sheetLink.href}
                  tabIndex={-1}
                  title={`Превью ${sheetLink.label}`}
                />
              )}
            </div>

            <p className="sonya-sheet-copy">{sheetLink.description}</p>

            <a
              className="sonya-sheet-action"
              href={sheetLink.href}
              rel="noreferrer"
              target="_blank"
            >
              открыть
            </a>
          </section>
        </div>
      ) : null}

      {cameraPanelOpen ? (
        <div className="sonya-sheet-layer">
          <button
            aria-label="закрыть"
            className="sonya-sheet-backdrop"
            onClick={closeCameraPanel}
            tabIndex={-1}
            type="button"
          />

          <section
            aria-labelledby="sonya-camera-title"
            aria-modal="true"
            className="sonya-sheet sonya-camera-panel"
            role="dialog"
          >
            <header className="sonya-sheet-header">
              <h2 id="sonya-camera-title">камера</h2>
              <button
                aria-label="закрыть"
                className="sonya-sheet-close"
                onClick={closeCameraPanel}
                ref={cameraCloseButtonRef}
                type="button"
              >
                ×
              </button>
            </header>

            {cameraStatus === "blocked" ? (
              <>
                <p className="sonya-sheet-copy">
                  Доступ к камере отключён в настройках браузера. Чтобы
                  включить, разрешите камеру для этого сайта и обновите
                  страницу.
                </p>
                <div className="sonya-camera-actions">
                  <button
                    className="sonya-sheet-action"
                    onClick={closeCameraPanel}
                    type="button"
                  >
                    понятно
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sonya-sheet-copy">
                  Изображение остаётся в браузере и никуда не отправляется.
                </p>
                <div className="sonya-camera-actions">
                  <button
                    className="sonya-sheet-action"
                    onClick={handleCameraEnable}
                    type="button"
                  >
                    включить
                  </button>
                  <button
                    className="sonya-sheet-action"
                    onClick={closeCameraPanel}
                    type="button"
                  >
                    не надо
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
