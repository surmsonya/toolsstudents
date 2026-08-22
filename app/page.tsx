"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { assetPath, links, type Project } from "./catalog-data";

/*
 * Лист заменяет ховерное превью и при сужении окна, и на тач-устройстве
 * любой ширины. Условие должно совпадать с тем, по которому в globals.css
 * прячется .catalog-preview, иначе между ними останется щель.
 */
const MOBILE_PREVIEW_QUERY = "(max-width: 700px), (hover: none)";

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLAnchorElement>(null);

  const closeMobilePreview = () => {
    setSelectedProject(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const handleProjectClick = (
    event: MouseEvent<HTMLAnchorElement>,
    project: Project,
  ) => {
    if (!window.matchMedia(MOBILE_PREVIEW_QUERY).matches) {
      return;
    }

    event.preventDefault();
    lastTriggerRef.current = event.currentTarget;
    setSelectedProject(project);
  };

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProject(null);
        window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProject]);

  return (
    <main className="catalog" aria-label="PIN tools catalog">
      <model-viewer
        class="catalog-model"
        src={assetPath("/model.glb")}
        poster={assetPath("/model-poster.webp")}
        alt="Interactive 3D model"
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="8deg"
        camera-controls
        interaction-prompt="none"
        shadow-intensity="0"
        loading="eager"
      />

      <nav className="catalog-links" aria-label="Project links">
        {links.map((link) => (
          <div
            className={`catalog-item ${link.className}${
              selectedProject?.href === link.href ? " is-selected" : ""
            }`}
            key={link.label}
          >
            <a
              className="catalog-link"
              href={link.href}
              onClick={(event) => handleProjectClick(event, link)}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>

            <div className="catalog-preview">
              <div className="catalog-preview-window">
                {link.previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    aria-hidden="true"
                    className="catalog-preview-image"
                    decoding="async"
                    loading="lazy"
                    src={link.previewImage}
                  />
                ) : (
                  <iframe
                    aria-hidden="true"
                    loading="lazy"
                    src={link.href}
                    tabIndex={-1}
                    title={`Превью ${link.label}`}
                  />
                )}
              </div>
              <p>
                <a
                  className="catalog-telegram"
                  href={link.telegram.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.telegram.label}
                </a>
                <span>{link.description}</span>
              </p>
            </div>
          </div>
        ))}
      </nav>

      {selectedProject ? (
        <div className="mobile-sheet-layer">
          <button
            aria-label="закрыть превью"
            className="mobile-sheet-backdrop"
            onClick={closeMobilePreview}
            tabIndex={-1}
            type="button"
          />

          <section
            aria-labelledby="mobile-sheet-title"
            aria-modal="true"
            className="mobile-sheet"
            role="dialog"
          >
            <header className="mobile-sheet-header">
              <h2 id="mobile-sheet-title">{selectedProject.label}</h2>
              <button
                aria-label="закрыть превью"
                className="mobile-sheet-close"
                onClick={closeMobilePreview}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="mobile-sheet-preview">
              {selectedProject.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  src={selectedProject.previewImage}
                />
              ) : (
                <iframe
                  aria-hidden="true"
                  loading="lazy"
                  src={selectedProject.href}
                  tabIndex={-1}
                  title={`Превью ${selectedProject.label}`}
                />
              )}
            </div>

            <div className="mobile-sheet-copy">
              <a
                href={selectedProject.telegram.href}
                rel="noreferrer"
                target="_blank"
              >
                {selectedProject.telegram.label}
              </a>
              <p>{selectedProject.description}</p>
            </div>

            <a
              className="mobile-sheet-action"
              href={selectedProject.href}
              rel="noreferrer"
              target="_blank"
            >
              открыть тул
            </a>
          </section>
        </div>
      ) : null}

      <Link className="catalog-switch" href="/sonya">
        sonya
      </Link>

      <Script
        src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
        strategy="afterInteractive"
        type="module"
      />
    </main>
  );
}
