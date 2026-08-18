import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PIN Tools — 3D catalog",
  description: "A one-screen collection of PIN web experiments.",
};

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

export default function Home() {
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
          <div className={`catalog-item ${link.className}`} key={link.label}>
            <a
              className="catalog-link"
              href={link.href}
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
    </main>
  );
}
