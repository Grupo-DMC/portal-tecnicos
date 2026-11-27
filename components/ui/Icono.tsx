// Íconos del rediseño: trazo sobre 24×24, sin relleno. Los pinta `.dmc svg.i`.

const TRAZOS = {
  panel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  visitas: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M4 10h16" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  reagendas: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v5h-5M12 8v5l3 2" />
    </>
  ),
  problemas: <path d="M12 3 2 20h20ZM12 10v4M12 17h.01" />,
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5" />
    </>
  ),
  clientes: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  malls: <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />,
  sucursales: <path d="M3 9.5 4.5 4h15L21 9.5M4 10v10h16V10M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9.5 20v-5h5v5" />,
  contactos: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  checklist: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mas: <path d="M12 5v14M5 12h14" />,
  lista: <path d="M4 6h16M4 12h16M4 18h10" />,
  multiple: (
    <>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="3" y="14" width="6" height="6" rx="1" />
      <path d="M13 7h8M13 17h8" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  filtros: <path d="M4 6h16M7 12h10M10 18h4" />,
  descargar: <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />,
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
  abajo: <path d="m6 9 6 6 6-6" />,
  ficha: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />,
  quitar: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  inicio: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" />,
  cuenta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  listo: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bitacora: <path d="M5 4h11l3 3v13H5ZM9 10h6M9 14h6" />,
  editar: <path d="M4 20h4L19 9l-4-4L4 16Z" />,
  correo: <path d="M3 6h18v12H3ZM3 7l9 7 9-7" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  adelante: <path d="m9 6 6 6-6 6" />,
  salir: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  cambiar: <path d="M7 7h13l-4-4M17 17H4l4 4" />,
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export default function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      {TRAZOS[nombre]}
    </svg>
  );
}
