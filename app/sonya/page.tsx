"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { assetPath, sonyaLinks } from "../catalog-data";
import { PALETTE } from "./shaders";
import "./sonya.css";

// только типы: сами модули приходят динамическим импортом ниже
import type { SceneHandle } from "./scene";
import type { PointerTracker } from "./tracking";

export default function SonyaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

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
    </main>
  );
}
