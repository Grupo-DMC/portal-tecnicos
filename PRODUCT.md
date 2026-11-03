# Product

<!-- impeccable:product-schema 1 -->

> Escrito sin entrevista, a pedido del dueño del proyecto («haz que corra nomás»), a partir del
> código, el README y los textos de la app. Lo marcado _(deducido)_ no está confirmado: corrígelo
> cuando haga falta con `/impeccable init`.

## Platform

web

## Users

- **Coordinación (escritorio).** Personal de oficina de Grupo dMC que programa visitas, asigna
  técnicos, sigue el día, resuelve problemas abiertos, reagenda lo que no se pudo hacer y cierra
  administrativamente las actas. Trabaja en `/admin/*`, con permisos por rol (administrador,
  coordinación y otros roles configurables).
- **Técnicos en terreno (celular).** Hacen mantenciones e instalaciones de sistemas de seguridad
  en tiendas de malls y sucursales. Usan `/tecnico/*` en el celular, de pie, dentro del local, a
  menudo sin señal: registran el trabajo, sacan fotos y videos, levantan problemas, recogen la
  firma y cierran el acta.

## Product Purpose

Reemplazar el formulario de visita en papel por un registro digital de cada visita técnica, desde
su programación hasta el acta firmada en PDF que se envía al cliente. El sistema funciona en
paralelo al papel hasta el traspaso a DMC_Core (texto del login). El éxito se ve en visitas
cerradas a tiempo frente a lo programado (meta interna del 92% en el panel), problemas abiertos
resueltos y actas completas, con evidencia.

## Positioning

Es una herramienta interna, no un producto a la venta. Lo que la distingue de un formulario
genérico es que el acta se puede llenar sin señal y se envía sola cuando vuelve la conexión, y que
cada visita queda trazada de punta a punta: motivos, trabajos, problemas, fotos, videos, firma, PDF
y bitácora de cambios.

## Operating Context

- Estructura de los clientes: zonas → malls → clientes (razón social y nombre de fantasía) →
  marcas → sucursales o tiendas, con contactos que se heredan.
- El acta lleva checklist (motivos, trabajos realizados, problemas por tipo), fotos internas y para
  el cliente, videos de hasta un minuto a 720p, firma del responsable de la tienda y RUT.
- Visitas en papel: las que todavía llegan en papel se cargan y confirman en `/admin/visitas/papel`.
- Descargas: PDF del acta y zips de actas y multimedia por local.
- Estados de visita: programada, en curso, completada, pendiente, reagendada, cancelada.
  Estados de problema: abierto, agendado, espera repuesto, resuelto.

## Capabilities and Constraints

- Next.js (App Router, Server Actions), React 19, Tailwind CSS 4, TypeScript, SQL Server.
- Sin modo demo: sin base de datos la app no arranca. Las pruebas visuales se hacen contra una base
  desechable local (`tests/e2e/base.ts`), nunca contra la de producción.
- CSP con nonce por petición; las fuentes se sirven desde el propio sitio (next/font).
- Interfaz y textos en español de Chile.

## Brand Commitments

- Grupo dMC, «Ideas tecnológicas de seguridad». Logo en `public/DMC-logo.png`: morado #762282
  («MC»), lila #C69DC8 («d») y gris #3B3636.
- El morado del logo es el color de marca de la app y del PDF del acta (decidido por el dueño en
  noviembre de 2026). El rojo queda solo para alarmas.
- Tipografía: Fira Sans para textos y títulos; Fira Code solo para cifras y datos (decidido por el
  dueño, a partir de la recomendación de ui-ux-pro-max).
- Esquinas rectas en toda la interfaz _(deducido del sistema actual)_.

## Evidence on Hand

- Logo: `public/DMC-logo.png`. No hay fotografías, testimonios ni datos públicos de clientes.
- Los datos de clientes, sucursales y visitas son reales y viven en la base de producción: no se
  copian a capturas, demos ni documentación.

## Product Principles

1. **El técnico en terreno primero:** todo lo del celular debe funcionar con una mano, con mala luz y
   sin señal.
2. **Nada se pierde:** lo que se guarda se envía solo cuando vuelve la señal, y cada cambio queda en
   la bitácora.
3. **El color significa algo:** el morado marca la acción y la selección; el rojo, solo lo que está
   mal o atrasado.
4. **Números que se pueden comprobar:** cada cifra del panel lleva a las visitas que la forman.

## Accessibility & Inclusion

- Contraste de texto de al menos 4,5:1, objetivos táctiles de unos 44 px en el celular y respeto de
  la preferencia de menos movimiento del sistema _(deducido de las reglas aplicadas en el rediseño)_.
