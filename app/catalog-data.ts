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
  description: string;
  /**
   * Скриншот для тех адресов, которые не встраиваются в iframe:
   * фигма отдаёт 403, t.me — frame-ancestors только для web.telegram.org.
   * null означает живое окно с сайтом.
   */
  previewImage: string | null;
};

/**
 * Позиции задаются классами s-01…s-07 в app/sonya/sonya.css,
 * поэтому порядок в массиве и есть раскладка на экране.
 * Неразрывные пробелы записаны escape-последовательностями — так их
 * видно в исходнике, и они переживают правки.
 */
export const sonyaLinks: SonyaLink[] = [
  {
    label: "sonyazoya",
    href: "https://zoyasonya.vercel.app",
    className: "s-01",
    description:
      "Коллаборация преподавательниц Щелочи! Соня-нейронки, Зоя-иллюстрация! А вместе-взрыв приколов и\u00A0арта",
    previewImage: assetPath("/sonyazoya.jpg"),
  },
  {
    label: "linocut",
    href: "https://apriltool.netlify.app",
    className: "s-02",
    description:
      "Веб инструмент, созданный в\u00A0рамках апрельской айдентики телеграм канала Щелочи",
    previewImage: assetPath("/linocut.jpg"),
  },
  {
    label: "Alkali-neuro",
    href: "https://aiteam-i9s6-nine.vercel.app",
    className: "s-03",
    description:
      "чем вдохновляются артовые ребята вокруг нас? задаваясь этим вопросом, я навайбкодила сайт с\u00A0рефами от\u00A0участников команды НЕЙРО Щ (бонус: к\u00A0рефам приложены коды мудбордов для\u00A0миджа 👅)",
    previewImage: null,
  },
  {
    label: "Fake-print",
    href: "https://www.figma.com/community/plugin/1667255153798092716/fake-print",
    className: "s-04",
    description:
      "Фигма плагин, культивирующий препринт эстетику. В\u00A0cmyk не переводит, dpi не повышает, но метки накладывает элегантнейше и настроен очень удобно!",
    previewImage: assetPath("/fake-print.jpg"),
  },
  {
    label: "Proof-marks",
    href: "https://www.figma.com/community/plugin/1666113501156385382/proof-marks",
    className: "s-05",
    description:
      "плагин для\u00A0фигмы, который расставляет непечатаемые символы в\u00A0тексте и позволяет их кастомизировать!",
    previewImage: assetPath("/proof-marks.png"),
  },
  {
    label: "Fifa-sh-bot",
    href: "https://t.me/fifa_sh_bot",
    className: "s-06",
    description:
      "⚽️⚽️⚽️⚽️⚽️\nщелочные фифа карточки на\u00A0сезон чм2026\n\nСТАНЬ УЧАСТНИКОМ Щ КОМАНДЫ С ФИФА Щ БОТ",
    previewImage: assetPath("/fifa-sh-bot.jpg"),
  },
  {
    label: "Pin-bot",
    href: "https://t.me/pin_sholotch_bot",
    className: "s-07",
    description: "обучающий бот-тамагочи для\u00A0студентов курса ПИН",
    previewImage: assetPath("/pin-bot.jpg"),
  },
];
