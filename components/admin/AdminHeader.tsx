import type { ReactNode } from "react";

/** La cabecera de una sección del panel: título, botones y, si las hay, pestañas. */
export default function AdminHeader({
  title,
  children,
  pestanas,
}: {
  title: string;
  children?: ReactNode;
  /** Pestañas de la sección, bajo el título (ver Usuarios). */
  pestanas?: ReactNode;
}) {
  return (
    <header className="cabecera">
      <div className="top">
        <div>
          <h1>{title}</h1>
        </div>
        {children ? <div className="v-actions">{children}</div> : null}
      </div>
      {pestanas ? <div className="cab-pestanas">{pestanas}</div> : null}
    </header>
  );
}
