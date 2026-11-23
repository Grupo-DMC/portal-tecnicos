import { Figtree, Outfit } from "next/font/google";
import "./login.css";

// Tipografías del login (títulos Outfit, texto Figtree). next/font las sirve
// desde el propio sitio, igual que Fira Sans: no hay pedido a Google.
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500", "600"] });

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${outfit.variable} ${figtree.variable}`}>{children}</div>;
}
