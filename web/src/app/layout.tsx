import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pilatea - Reservas", template: "%s | Pilatea" },
  description: "Reservá tus clases de Pilates Reformer, HIIT Barre y Yoga en Estudio Pilatea.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body className="flex min-h-screen flex-col antialiased">{children}</body>
    </html>
  );
}
