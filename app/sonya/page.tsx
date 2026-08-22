"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { assetPath, sonyaLinks, type SonyaLink } from "../catalog-data";
import { PALETTE } from "./shaders";
import "./sonya.css";

// только типы: сами модули приходят динамическим импортом ниже
import type { SceneHandle } from "./scene";
import type { PointerTracker } from "./tracking";

/**
 * Там, где наведения нет, превью показывается нижним листом по нажатию —
 * ровно тот же жест, что на первой странице. Условие то же, по которому
 * прячется ховерное превью, чтобы между ними не осталось щели.
 */
const NO_HOVER_QUERY = "(hover: none)";

export default function SonyaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [sheetLink, setSheetLink] = useState<SonyaLink | null>(null);
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
    link: SonyaLink,
  ) => {
    if (!window.matchMedia(NO_HOVER_QUERY).matches) {
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

        <Link className="sonya-switch" href="/">
          пин тулз
        </Link>
      </nav>

      {/*
        Лист рендерится вне слоя ссылок: там difference, и серая подложка
        ушла бы в инверсию вместе с содержимым. Здесь он остаётся плоским
        и матовым поверх кипящего фона — тем же куском первой страницы,
        каким на этапе 3 станет панель камеры.
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
    </main>
  );
}
