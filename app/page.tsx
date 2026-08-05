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
  },
  {
    label: "pinmusepad",
    href: "https://pinmusepad.netlify.app/",
    className: "pinmusepad",
  },
  {
    label: "pinbrushbalovstvo",
    href: "https://pinbrushbalovstvo.netlify.app",
    className: "pinbrushbalovstvo",
  },
  {
    label: "dither-excalibrator",
    href: "https://dither-excalibrator.netlify.app/",
    className: "dither-excalibrator",
  },
  {
    label: "ascii-vision",
    href: "https://risenve.github.io/ascii-vision/",
    className: "ascii-vision",
  },
  {
    label: "kripibykva",
    href: "https://kripibykva.netlify.app",
    className: "kripibykva",
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
          <a
            className={`catalog-link ${link.className}`}
            href={link.href}
            key={link.label}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </main>
  );
}
