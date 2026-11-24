"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

import { assetPath, pin2Links, type Project } from "./catalog-data";
import { PageSwitch } from "./page-switch";
// Визуал главной взят со страницы sonya: та же сцена, та же типографика
// в difference-слое, тот же лист превью. Отличия — в pin2.css.
import "./sonya/sonya.css";
import "./pin2.css";

// только типы: сами модули приходят динамическим импортом ниже
import type { SceneHandle } from "./sonya/scene";
import type { PointerTracker } from "./sonya/tracking";

/**
 * Где превью не показать наведением, оно показывается нижним листом
 * по нажатию. Условие то же, по которому прячется ховерное превью.
 */
const SHEET_QUERY = "(max-width: 700px), (hover: none)";

/** Белая модель: тень — светло-серая, чтобы форма читалась на чёрном. */
const WHITE_MODEL = {
  shadow: "#a8a8a8",
  mid: "#e0e0e0",
  light: "#ffffff",
} as const;

export default function Pin2Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [sheetLink, setSheetLink] = useState<Project | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    let scene: SceneHandle | null = null;
    let tracker: PointerTracker | null = null;

    void (async () => {
      const [{ createScene }, { createPointerTracker }] = await Promise.all([
        import("./sonya/scene"),
        import("./sonya/tracking"),
      ]);

      if (cancelled) {
        return;
      }

      tracker = createPointerTracker();

      scene = createScene({
        canvas,
        modelUrl: assetPath("/pin2-model.glb"),
        pointer: tracker.signal,
        background: "black",
        modelPalette: WHITE_MODEL,
        onReady: () => setIsReady(true),
        onError: (error) => {
          // страница остаётся рабочей: ссылки на месте, фон чёрный
          console.error("сцена главной не загрузилась", error);
        },
      });
    })();

    return () => {
      cancelled = true;
      scene?.dispose();
      tracker?.dispose();
    };
  }, []);

  const closeSheet = () => {
    setSheetLink(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: Project,
  ) => {
    if (!window.matchMedia(SHEET_QUERY).matches) {
      return;
    }

    event.preventDefault();
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

  return (
    <main aria-label="ПИН2" className="sonya pin2">
      <canvas
        aria-hidden="true"
        className={`sonya-canvas${isReady ? " is-ready" : ""}`}
        ref={canvasRef}
      />

      <nav className="sonya-links" aria-label="Ссылки">
        {pin2Links.map((link) => (
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

            <div className="sonya-preview">
              <div aria-hidden="true" className="sonya-preview-window">
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
              <p>
                <a
                  className="pin2-telegram"
                  href={link.telegram.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.telegram.label}
                </a>
                {link.description}
              </p>
            </div>
          </div>
        ))}
      </nav>

      <PageSwitch current="pin2" />

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
            aria-labelledby="pin2-sheet-title"
            aria-modal="true"
            className="sonya-sheet"
            role="dialog"
          >
            <header className="sonya-sheet-header">
              <h2 id="pin2-sheet-title">{sheetLink.label}</h2>
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

            <div className="sonya-sheet-copy">
              <a
                className="pin2-sheet-telegram"
                href={sheetLink.telegram.href}
                rel="noreferrer"
                target="_blank"
              >
                {sheetLink.telegram.label}
              </a>
              <p>{sheetLink.description}</p>
            </div>

            <a
              className="sonya-sheet-action"
              href={sheetLink.href}
              rel="noreferrer"
              target="_blank"
            >
              открыть тул
            </a>
          </section>
        </div>
      ) : null}
    </main>
  );
}
