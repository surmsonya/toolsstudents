export const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const assetPath = (path: `/${string}`) => `${PUBLIC_BASE_PATH}${path}`;

export type Project = {
  label: string;
  href: string;
  className: string;
  telegram: {
    label: string;
    href: string;
  };
  description: string;
  previewImage: string | null;
};

export const links: Project[] = [
  {
    label: "sweet-crepe",
    href: "https://sweet-crepe-eab810.netlify.app",
    className: "sweet-crepe",
    telegram: {
      label: "тгк\u00A0@design_patch",
      href: "https://t.me/design_patch",
    },
    description: "растягиваешь изображение по\u00A0модулям сетки",
    previewImage: assetPath("/sweet-crepe.webp"),
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
    previewImage: assetPath("/scanner-studio.webp"),
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
    previewImage: assetPath("/pinbrushbalovstvo.webp"),
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
    previewImage: assetPath("/dither-excalibrator.webp"),
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
    previewImage: assetPath("/ascii-vision.webp"),
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
    previewImage: assetPath("/kripibykva.webp"),
  },
];

export type SonyaLink = {
  label: string;
  href: string;
  className: string;
};

/**
 * ПЛЕЙСХОЛДЕР. Ждём настоящий список ссылок для /sonya.
 * Пока стоят подписи с первой страницы — они дают честные типографические
 * метрики, чтобы оценить раскладку. Позиции задаются классами s-01…s-07
 * в app/sonya/sonya.css, поэтому замена списка не трогает разметку.
 */
export const sonyaLinks: SonyaLink[] = [
  {
    label: "sweet-crepe",
    href: "https://sweet-crepe-eab810.netlify.app",
    className: "s-01",
  },
  { label: "pinmusepad", href: "https://pinmusepad.netlify.app/", className: "s-02" },
  {
    label: "SCANNER-STUDIO",
    href: "https://irina-mov.github.io/scannerstudio_designpatch/",
    className: "s-03",
  },
  {
    label: "pinbrushbalovstvo",
    href: "https://pinbrushbalovstvo.netlify.app",
    className: "s-04",
  },
  {
    label: "dither-excalibrator",
    href: "https://dither-excalibrator.netlify.app/",
    className: "s-05",
  },
  { label: "ascii-vision", href: "https://risenve.github.io/ascii-vision/", className: "s-06" },
  { label: "kripibykva", href: "https://kripibykva.netlify.app", className: "s-07" },
];
