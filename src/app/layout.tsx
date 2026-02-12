import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AduanaSys - Automatización de Despachos",
  description:
    "Sistema inteligente de procesamiento de facturas para despachantes de aduana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
