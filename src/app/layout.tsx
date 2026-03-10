import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atlas Platform",
  description: "AtlasPayments Platform Service",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
