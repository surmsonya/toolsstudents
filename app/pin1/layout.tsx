import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ПИН1",
};

export default function Pin1Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
