"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

const MOBILE_PREVIEW_QUERY = "(max-width: 700px)";

const links = [
  {
    label: "sweet-crepe",
    href: "https://sweet-crepe-eab810.netlify.app",
    className: "sweet-crepe",
    telegram: {
      label: "тгк\u00A0@design_patch",
      href: "https://t.me/design_patch",
    },
    description: "растягиваешь изображение по\u00A0модулям сетки",
    previewImage: "/sweet-crepe.png",
  },
  {
    label: "pinmusepad",
    href: "https://pinmusepad.netlify.app/",
    className: "pinmusepad",
    telegram: {
      label: "тг\u00A0@Lexusghf",
      href: "https://t.me/Lexusghf",
    },
    description: "вкатиться в\u00A0создание музыки",
    previewImage: null,
  },
  {
    label: "SCANNER-STUDIO",
    href: "https://irina-mov.github.io/scannerstudio_designpatch/",
    className: "scanner-studio",
    telegram: {
      label: "тгк\u00A0@design_patch",
      href: "https://t.me/design_patch",
    },
    description: "запускаешь сканирование и\u00A0перетаскиваешь изображение",
    previewImage: "/scanner-studio.png",
  },
  {
    label: "pinbrushbalovstvo",
    href: "https://pinbrushbalovstvo.netlify.app",
    className: "pinbrushbalovstvo",
    telegram: {
      label: "тг\u00A0@Lexusghf",
      href: "https://t.me/Lexusghf",
    },
    description: "тул для рисования на\u00A0телефоне",
    previewImage: "/pinbrushbalovstvo.png",
  },
  {
    label: "dither-excalibrator",
    href: "https://dither-excalibrator.netlify.app/",
    className: "dither-excalibrator",
    telegram: {
      label: "тгк\u00A0@bysevostick01",
      href: "https://t.me/bysevostick01",
    },
    description:
      "нажимаешь randomize и\u00A0получаешь разные степени пикселизации изображения",
    previewImage: "/dither-excalibrator.png",
  },
  {
    label: "ascii-vision",
    href: "https://risenve.github.io/ascii-vision/",
    className: "ascii-vision",
    telegram: {
      label: "тгк\u00A0@sargsyanstd",
      href: "https://t.me/sargsyanstd",
    },
    description: "создание фото и\u00A0видео с\u00A0ASCII",
    previewImage: "/ascii-vision.png",
  },
  {
    label: "kripibykva",
    href: "https://kripibykva.netlify.app",
    className: "kripibykva",
    telegram: {
      label: "тгк\u00A0@neurokva",
      href: "https://t.me/neurokva",
    },
    description: "обработка фото в\u00A0крипи стилистике",
    previewImage: "/kripibykva.png",
  },
];

type Project = (typeof links)[number];

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
        src="/model.glb"
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
    </main>
  );
}
