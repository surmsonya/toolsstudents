import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "sonya",
};

export default function SonyaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
