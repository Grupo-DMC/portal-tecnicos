# Textos quitados (etapa 2)

Regla aplicada: si el texto informa un **dato** o una **advertencia**, se queda; si explica la **interfaz**, se va.
Nunca se quitan errores, estados vacíos, «Obligatorio»/«Opcional», confirmaciones de borrado ni «No lo ve el cliente».
Generado por `scripts/limpiar-textos.py` (el script es la fuente; para devolver un texto, se quita su línea y se restaura el archivo).

## Quitados (50)

| Pantalla | Texto | Archivo |
|---|---|---|
| Panel · Problemas abiertos por tipo | Toca un tipo para destacarlo. | `components/admin/PanelDashboard.tsx` |
| Panel · Sucursales con más fallas | Histórico y cuántos siguen sin cerrar. | `components/admin/PanelDashboard.tsx` |
| Panel · Tiempo en sitio por tipo de trabajo | Minutos promedio desde que el técnico inicia hasta que cierra el acta. | `components/admin/PanelDashboard.tsx` |
| Panel · Reagendamientos | «Últimos registrados.» (queda el conteo de registros) | `components/admin/PanelDashboard.tsx` |
| Visitas · Acciones múltiples | Puedes juntar visitas de varias búsquedas y páginas. | `components/admin/VisitasTable.tsx` |
| Nueva visita / Corregir visita · Hasta (margen) | Al técnico le aparece en «Hoy» cada día del margen, hasta que la cierre. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita · Técnico ayudante | Si van dos al local. Lo ve en su celular; el acta la llena el asignado. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita · Motivo | Marca todos los que correspondan. El primero es el que encabeza la ficha del técnico. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita · Personas del local | Quienes ya recibieron o firmaron en esta tienda. Al elegir una se llenan sus datos abajo. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita · RUT del responsable | Opcional al agendar. Si va, el técnico lo encuentra ya escrito en el acta. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita / Reagendar · Hora de llegada | Si la dejas vacía, el técnico la realiza en cualquier momento del día. | `components/admin/VisitaDialogos.tsx` |
| Nueva visita / Reagendar · Hora de llegada | Si la dejas vacía, el técnico la realiza en cualquier momento del día. | `components/admin/VisitaDialogos.tsx` |
| Visitas masivas · Motivo para todos | Marca todos los que correspondan. El primero es el que encabeza la ficha del técnico. | `components/admin/VisitasMasivasDialogo.tsx` |
| Visitas masivas · Qué hay que hacer | Se copia a cada local, salvo a los que tengan su propio detalle. | `components/admin/VisitasMasivasDialogo.tsx` |
| Visitas masivas · Cuándo | La hora es opcional y va en cada local, si hace falta. | `components/admin/VisitasMasivasDialogo.tsx` |
| Visitas en lote · Confirmación | Si quitas visitas de la lista, el número cambia. | `components/admin/VisitasLoteDialogo.tsx` |
| Editar acta · Fotos y video | Lo que quites no se borra: queda guardado e inactivo, y su número va al registro. Un video de más de 1 minuto o 720p se ajusta solo al agregarlo. | `components/admin/editar-acta/secciones-evidencia.tsx` |
| Editar acta · Firma de la tienda | Se conserva tal cual: no se edita. | `components/admin/editar-acta/secciones-evidencia.tsx` |
| Editar acta · Firma de la tienda | Es la firma que dejó la tienda al cerrar el acta, con su hora. Si corriges el nombre o el RUT del responsable y eran los mismos que van bajo la firma, ese texto se corrige también; la firma no. | `components/admin/editar-acta/secciones-evidencia.tsx` |
| Editar acta · ¿Por qué se edita el acta? | Es obligatorio y queda en el registro de la visita junto con lo que cambiaste. (queda «Obligatorio») | `components/admin/editar-acta/secciones-evidencia.tsx` |
| Editar acta · Índice de secciones | El punto morado marca las secciones que llevan cambios sin guardar. | `components/admin/editar-acta/secciones-evidencia.tsx` |
| Editar acta · Sucursal y responsable | Quien recibió al técnico y firmó el acta. | `components/admin/editar-acta/secciones.tsx` |
| Editar acta · Motivo y trabajo realizado | Cada motivo con lo que se hizo en él. Lo marcado es lo que sale en el acta. | `components/admin/editar-acta/secciones.tsx` |
| Problemas · Checklist de gestión (cajón) | Lo que conviene mover esta semana para bajar los problemas sin cerrar. | `components/admin/ProblemasView.tsx` |
| Nueva visita · Aviso de problemas sin resolver | Marca arriba los que va a resolver: quedan como «Agendado» y el técnico confirma en el acta si quedaron solucionados. | `components/admin/AvisoProblemas.tsx` |
| Sucursal (formulario) · Mall | Al elegirlo, la sucursal toma la dirección, la comuna y la región del mall. Sin mall, escribe la dirección de la calle. | `components/admin/maestros/useSucursalForm.ts` |
| Sucursal (formulario) · Plan de calibración | Su cliente no está en plan, pero esta tienda puede estarlo por su cuenta. | `components/admin/maestros/useSucursalForm.ts` |
| Usuarios · Cuenta · Técnico vinculado | Con este técnico ve sus visitas asignadas y llena sus actas desde el panel de técnico. | `components/admin/maestros/UsuariosTable.tsx` |
| Usuarios · Roles y permisos | Cada usuario del panel tiene un rol y puede hacer lo que su rol tenga marcado. El rol se le asigna en la pestaña Cuentas. | `components/admin/RolesView.tsx` |
| Checklist · Introducción | Acá vive todo lo que el técnico elige desde listas en su celular. Cada bloque es una lista distinta. Para cambiar el orden, agarra una fila de su manilla y suéltala donde va; también puedes clonar una entrada… | `components/admin/checklist/listas-simples.tsx` |
| Checklist · Motivos y sus trabajos | Coordinación agenda la visita con uno o varios motivos… | `components/admin/checklist/listas.tsx` |
| Checklist · Tipos de problema | Lo que el técnico elige al levantar un problema… | `components/admin/checklist/listas.tsx` |
| Checklist · Todos los trabajos | Los mismos trabajos de la Lista 1, vistos desde el otro lado… | `components/admin/checklist/listas.tsx` |
| Checklist · Gestión de problemas | Los pasos que coordinación va marcando en «Problemas»… | `components/admin/checklist/listas-simples.tsx` |
| Checklist · Estados del problema | Los estados entre los que se elige en «Cambiar estado o tipo»… | `components/admin/checklist/listas-simples.tsx` |
| Checklist · Cargos del responsable | Los cargos que se ofrecen para quien recibe y firma en la tienda… | `components/admin/checklist/listas-simples.tsx` |
| Checklist · Así lo ve el técnico | Con los cambios que todavía no guardas. | `components/admin/checklist/VistaTecnico.tsx` |
| Checklist · Trabajo · Aparece bajo estos motivos | El técnico solo ve este trabajo bajo los motivos marcados. Al marcar uno, el trabajo entra al final de ese motivo. | `components/admin/checklist/desplegables.tsx` |
| Checklist · Trabajo · Grupos de subdetalles | Cada grupo sale en el celular con su nombre y sus propias opciones. Un mismo subtrabajo no puede repetirse en dos grupos del trabajo. | `components/admin/checklist/desplegables.tsx` |
| Mi cuenta · Datos | El correo es con el que entras al sistema. | `components/admin/CuentaView.tsx` |
| Visitas en papel · Introducción | Para pasar al sistema los informes que se hicieron a mano. Cada informe entra como visita completada, con el folio del año del informe, sin fotos, video ni firma dibujada. Lo que escribes se guarda en este navegador hasta que lo guardes en el sistema. | `components/admin/papel/carga.tsx` |
| Técnico · Agregar visita | Mismo formulario que usa coordinación para crear una visita, para cuando no te la asignaron o la haces fuera de tu planificación. | `components/mobile/NuevaVisitaSheet.tsx` |
| Técnico · Agregar visita · Motivo | (marca todos los que correspondan) | `components/mobile/NuevaVisitaSheet.tsx` |
| Técnico · Visita · Reagendar | Queda registrada la fecha anterior y el motivo; coordinación lo ve al instante. | `components/mobile/DetalleVisita.tsx` |
| Técnico · Visita · Iniciar visita | Al iniciar se registra la hora en el acta. El formulario guarda sección por sección. | `components/mobile/DetalleVisita.tsx` |
| Técnico · Visita · Reagendar · Hora | Si no pones hora, la visita queda para cualquier momento de ese día. | `components/mobile/DetalleVisita.tsx` |
| Técnico · Formulario · Trabajo realizado | Toca para marcar. Las opciones que llevan cantidad muestran − y + al marcarlas. | `components/mobile/formulario/hojas.tsx` |
| Técnico · Formulario · Problemas detectados | Si encontraste otro, agrégalo abajo aunque los de arriba hayan quedado solucionados. | `components/mobile/formulario/secciones.tsx` |
| Técnico · Formulario · Problemas detectados | Cada problema se llena en su propia ficha para no saturar esta pantalla. | `components/mobile/formulario/secciones.tsx` |
| Técnico · Formulario · Revisar y guardar | Vas a ver el acta completa antes de guardar nada. | `components/mobile/formulario/secciones-evidencia.tsx` |

## Dudosos — no se quitaron (22)

| Pantalla | Texto | Por qué se deja | Archivo |
|---|---|---|---|
| Panel · Técnicos | Cerradas dentro de la fecha programada, frente a la meta de 92%. | Explica el indicador, pero trae el dato de la meta (92 %), que no se ve en otra parte. | `components/admin/PanelDashboard.tsx` |
| Panel · Tiempo promedio de resolución | Horas desde que se levanta el problema hasta que se cierra. Semanal, últimas 12 semanas. | Explica la medida, pero trae el período (últimas 12 semanas) y la unidad. | `components/admin/PanelDashboard.tsx` |
| Cancelar / liberar visita · Motivo | Queda guardado en la bitácora de la visita junto con tu usuario y la fecha. | Informa que queda registro (advertencia de trazabilidad), no explica un control. | `components/admin/VisitaDialogos.tsx` |
| Visitas en lote · Nueva fecha y hora para todas | Vacía = cada visita conserva la suya. | Dice qué pasa con el campo vacío: sin él, se podría creer que vacío borra la fecha. | `components/admin/VisitasLoteDialogo.tsx` |
| Visitas en lote · Motivo para todas | Sin marcar = cada visita conserva sus motivos. Si marcas, reemplazan a los que tenía. | Advierte que marcar reemplaza los motivos. | `components/admin/VisitasLoteDialogo.tsx` |
| Visitas en lote · Motivo del cambio | Queda en la bitácora de cada visita junto con tu usuario y la fecha. | Advertencia de trazabilidad. | `components/admin/VisitasLoteDialogo.tsx` |
| Editar acta · Problemas detectados | Agrega los que faltan, corrige los que hay o quita los que sobran. El estado de cada problema se cambia en Problemas: … | La primera frase explica la interfaz, pero la segunda es una regla (dónde se cambia el estado). | `components/admin/editar-acta/secciones.tsx` |
| Nueva visita · Aviso de problemas sin resolver | Los problemas siguen como están. Queda registrado que se avisó y que la visita es por otra cosa. | Informa la consecuencia de la respuesta (dato), aunque suena a explicación. | `components/admin/AvisoProblemas.tsx` |
| Sucursal (formulario) · Garantía | Cuenta desde la fecha de instalación. Si la dejas vacía rige el plan de garantía de su cliente, si lo tiene. | Regla de negocio (de dónde sale la garantía), no solo interfaz. | `components/admin/maestros/useSucursalForm.ts` |
| Sucursal (formulario) · Plan de calibración (bloqueado) | Todas las tiendas de un cliente en plan de calibración lo están. Se cambia en el cliente. | Explica por qué el campo está bloqueado y dónde se cambia. | `components/admin/maestros/useSucursalForm.ts` |
| Cliente (formulario) · Plan de calibración | Si está en plan, todas sus sucursales lo están. Si no, cada sucursal puede estarlo por su cuenta. | Regla de negocio. | `components/admin/maestros/ClientesTable.tsx` |
| Cliente (formulario) · Garantía | Cubre todos sus locales, contando desde la instalación de cada uno. Un local con garantía propia manda sobre este plan. | Regla de negocio (precedencia). | `components/admin/maestros/ClientesTable.tsx` |
| Usuarios · Permisos del celular | Qué puede hacer un técnico desde la app del celular. Lo heredan todas las cuentas de técnico; ven solo sus propias visitas, sin importar estos permisos. | La primera frase explica; la segunda es una regla de seguridad. | `components/admin/RolesView.tsx` |
| Usuarios · Contraseña temporal entregada | Entrégasela por teléfono o en persona. Al entrar, el sistema le va a pedir que la cambie. | Indicación de seguridad y dato de lo que pasa al entrar. | `components/admin/SolicitudesPasswordView.tsx` |
| Checklist · Comentario interno | Lo que el técnico marca en la sección «Comentario interno» del acta… Es solo para coordinación: no aparece en el PDF… | Explica la lista, pero incluye la advertencia de que no sale en el PDF. | `components/admin/checklist/listas-simples.tsx` |
| Checklist · Secciones obligatorias del acta | El técnico no puede cerrar la visita hasta llenar las secciones que marques acá. Las tres primeras son obligatorias siempre. Vale para las actas que se cierren desde ahora… | Advierte desde cuándo rige el cambio. | `components/admin/checklist/secciones-acta.tsx` |
| Mi cuenta · Contraseña | Mínimo 10 caracteres y distinta de tu correo. Al cambiarla se cierran tus sesiones en otros equipos. | Reglas de la contraseña y advertencia de cierre de sesiones (se reemplaza por las reglas en vivo de la demo al rehacer Mi cuenta). | `components/admin/CuentaView.tsx` |
| Técnico · Visita · No se pudo hacer | La visita queda PENDIENTE y vuelve a tu lista hasta cerrarla. | Informa el estado en que queda la visita. | `components/mobile/DetalleVisita.tsx` |
| Técnico · Formulario · Fotos del trabajo | Al final del trabajo: pórtico terminado, etiqueta de serie y cada problema que dejes anotado. | Dice qué fotografiar: es una instrucción de trabajo, no de la interfaz. | `components/mobile/formulario/secciones-evidencia.tsx` |
| Técnico · Formulario · Video del trabajo | Para lo que una foto no alcanza a mostrar: la falsa alarma sonando, el pórtico… | Instrucción de trabajo. | `components/mobile/formulario/secciones-evidencia.tsx` |
| Técnico · Firma · Pantalla girada | Gira el teléfono para verlo derecho — ya puedes firmar así / La pantalla no se mueve mientras firmas | Explica la interfaz, pero sin él la firma girada desorienta. | `components/mobile/FirmaSheet.tsx` |
| Técnico · Formulario · Edición del acta | Así va a quedar el acta corregida. La firma de la tienda es la misma de cuando se cerró. / Al confirmar queda registrado qué cambiaste, cuándo y por qué… | Advertencias de trazabilidad y de la firma. | `components/mobile/formulario/pantallas.tsx` |

## Pendientes en pantallas que se rehacen

Estas pantallas se reconstruyen desde la demo en las etapas siguientes y salen ya sin textos explicativos; lo que se quite ahí se suma a esta lista:
Campanita (etapa 3), Usuarios (etapa 4), Nueva visita y Visitas masivas (etapa 5), Checklist y Mi cuenta (etapa 7).
