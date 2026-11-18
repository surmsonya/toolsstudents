import Link from "next/link";

/**
 * Порядок страниц сайта: ПИН2 — главная, за ней sonya, за ней ПИН1.
 * На каждой странице в серой плашке остаются ссылки на две другие,
 * в этом же порядке.
 */
const PAGES = [
  { id: "pin2", href: "/", label: "пин2" },
  { id: "sonya", href: "/sonya", label: "sonya" },
  { id: "pin1", href: "/pin1", label: "пин1" },
] as const;

export type PageId = (typeof PAGES)[number]["id"];

export function PageSwitch({ current }: { current: PageId }) {
  return (
    <nav aria-label="Страницы" className="page-switch">
      {PAGES.filter((page) => page.id !== current).map((page) => (
        <Link className="page-switch-link" href={page.href} key={page.id}>
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
