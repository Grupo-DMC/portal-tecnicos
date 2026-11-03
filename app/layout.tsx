import type { Metadata } from "next";
import { connection } from "next/server";
import { Fira_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Par «Dashboard Data» de ui-ux-pro-max: Fira Sans para el texto y los
// títulos, Fira Code solo para cifras y datos (KPI, folios, horas).
// next/font los sirve desde el propio sitio: no hay pedido a Google.
const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
// Fira Code va completa y local (licencia OFL en app/fonts): el recorte de
// Google le quita las variantes, y sin `cv11` el cero sale tachado y en un
// tablero vacío «0%» se lee como «Ø%».
const firaCode = localFont({
  variable: "--font-fira-code",
  src: "./fonts/FiraCode-VF.woff2",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DMC Contingencia",
  description: "Sistema de técnicos en terreno y panel de coordinación de Grupo DMC",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El nonce de la CSP se genera por petición: la página no puede prerenderse
  // estática o sus scripts saldrían sin él.
  await connection();
  return (
    <html lang="es" className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
