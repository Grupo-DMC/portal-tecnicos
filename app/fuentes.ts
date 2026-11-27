// Tipografías del rediseño: títulos y cifras en Outfit, texto en Figtree.
// next/font las sirve desde el propio sitio: no hay pedido a Google.
import { Figtree, Outfit } from "next/font/google";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/** Clases que declaran las dos variables de fuente en el contenedor que las usa. */
export const FUENTES = `${outfit.variable} ${figtree.variable}`;
