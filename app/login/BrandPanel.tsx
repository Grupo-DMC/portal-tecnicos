"use client";

import Image from "next/image";
import { useRef } from "react";
import WavesCanvas from "./WavesCanvas";

/** Panel del banner: foto con velo morado, ondas animadas y mensaje de marca. */
export default function BrandPanel() {
  const asideRef = useRef<HTMLElement>(null);
  return (
    <aside className="brand" ref={asideRef} aria-hidden="true">
      <Image className="photo" src="/login/banner.jpg" alt="" fill sizes="(max-width: 960px) 100vw, 58vw" priority />
      <WavesCanvas targetRef={asideRef} />
      <div className="brand-copy">
        <p className="brand-kicker">Ideas tecnológicas de seguridad</p>
        <h2>Visitas en terreno, registradas aunque no haya señal.</h2>
        <p>Accede al sistema de técnicos de Grupo DMC con tu cuenta.</p>
      </div>
    </aside>
  );
}
