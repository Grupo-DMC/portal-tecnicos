# Limpieza de textos explicativos de interfaz (etapa 2 del rediseño según panel-operacion.html).
# Regla: si el texto informa un DATO o una ADVERTENCIA, se queda; si explica la INTERFAZ, se va.
# Nunca se quitan: errores, estados vacíos, «Obligatorio»/«Opcional», confirmaciones de borrado
# ni «No lo ve el cliente». Cada cambio queda registrado en docs/textos-quitados.md (se genera aquí).
# Uso: python scripts/limpiar-textos.py   (idempotente: lo ya quitado se salta)
import re, sys, io, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
quitados, dudosos, saltados = [], [], []

def leer(f): return io.open(os.path.join(RAIZ, f), encoding="utf8").read()
def escribir(f, s): io.open(os.path.join(RAIZ, f), "w", encoding="utf8", newline="\n").write(s)

def lit(f, viejo, nuevo, pantalla, texto):
    """Reemplazo literal (exacto) en un archivo."""
    s = leer(f)
    if viejo not in s:
        if nuevo and nuevo in s or texto[:40] not in s: saltados.append((f, texto)); quitados.append((pantalla, texto, f)); return
        print("NO ENCONTRADO", f, viejo[:70]); sys.exit(1)
    escribir(f, s.replace(viejo, nuevo, 1)); quitados.append((pantalla, texto, f))

def ayuda(f, texto, pantalla):
    """Quita una propiedad `ayuda: "…"` (o `ayuda="…"`) de un campo."""
    s = leer(f)
    pat = re.compile(r'\s+ayuda(?:: |=)(["`])' + re.escape(texto) + r'\1,?')
    if not pat.search(s):
        if texto not in s: saltados.append((f, texto)); quitados.append((pantalla, texto, f)); return
        print("NO ENCONTRADO", f, texto[:70]); sys.exit(1)
    escribir(f, pat.sub("", s, 1)); quitados.append((pantalla, texto, f))

def elemento(f, frase, pantalla, texto, etiqueta="p"):
    """Quita el elemento <p>/<div> completo que contiene `frase` (de su apertura a su cierre)."""
    s = leer(f)
    i = s.find(frase)
    if i < 0: saltados.append((f, texto)); quitados.append((pantalla, texto, f)); return
    ini = s.rfind("<" + etiqueta, 0, i)
    j = ini; prof = 0
    for m in re.finditer(r"<(/?)" + etiqueta + r"\b[^>]*?(/?)>", s[ini:]):
        if m.group(1): prof -= 1
        elif not m.group(2): prof += 1
        if prof == 0: j = ini + m.end(); break
    linea_ini = s.rfind("\n", 0, ini)
    escribir(f, s[:linea_ini] + s[j:]); quitados.append((pantalla, texto, f))

def duda(pantalla, texto, f, por_que):
    dudosos.append((pantalla, texto, f, por_que))

A = "components/admin/"; M = "components/mobile/"

# ---------------- Panel ----------------
lit(A + "PanelDashboard.tsx", '              bajada="Toca un tipo para destacarlo."\n', "", "Panel · Problemas abiertos por tipo", "Toca un tipo para destacarlo.")
lit(A + "PanelDashboard.tsx", ' bajada="Histórico y cuántos siguen sin cerrar."', "", "Panel · Sucursales con más fallas", "Histórico y cuántos siguen sin cerrar.")
lit(A + "PanelDashboard.tsx", '              bajada="Minutos promedio desde que el técnico inicia hasta que cierra el acta."\n', "", "Panel · Tiempo en sitio por tipo de trabajo", "Minutos promedio desde que el técnico inicia hasta que cierra el acta.")
lit(A + "PanelDashboard.tsx", 'bajada={`Últimos registrados. ${plural(d.reagendasLista.length, "registro", "registros")}.`}', 'bajada={`${plural(d.reagendasLista.length, "registro", "registros")}.`}', "Panel · Reagendamientos", "«Últimos registrados.» (queda el conteo de registros)")
duda("Panel · Técnicos", "Cerradas dentro de la fecha programada, frente a la meta de 92%.", A + "PanelDashboard.tsx", "Explica el indicador, pero trae el dato de la meta (92 %), que no se ve en otra parte.")
duda("Panel · Tiempo promedio de resolución", "Horas desde que se levanta el problema hasta que se cierra. Semanal, últimas 12 semanas.", A + "PanelDashboard.tsx", "Explica la medida, pero trae el período (últimas 12 semanas) y la unidad.")

# ---------------- Visitas ----------------
lit(A + "VisitasTable.tsx", '              <p className="v-bulk-hint">Puedes juntar visitas de varias búsquedas y páginas.</p>\n', "", "Visitas · Acciones múltiples", "Puedes juntar visitas de varias búsquedas y páginas.")
ayuda(A + "VisitaDialogos.tsx", "Al técnico le aparece en «Hoy» cada día del margen, hasta que la cierre.", "Nueva visita / Corregir visita · Hasta (margen)")
ayuda(A + "VisitaDialogos.tsx", "Si van dos al local. Lo ve en su celular; el acta la llena el asignado.", "Nueva visita · Técnico ayudante")
ayuda(A + "VisitaDialogos.tsx", "Marca todos los que correspondan. El primero es el que encabeza la ficha del técnico.", "Nueva visita · Motivo")
ayuda(A + "VisitaDialogos.tsx", "Quienes ya recibieron o firmaron en esta tienda. Al elegir una se llenan sus datos abajo.", "Nueva visita · Personas del local")
ayuda(A + "VisitaDialogos.tsx", "Opcional al agendar. Si va, el técnico lo encuentra ya escrito en el acta.", "Nueva visita · RUT del responsable")
for _ in range(2):
    lit(A + "VisitaDialogos.tsx", '        : "Si la dejas vacía, el técnico la realiza en cualquier momento del día.",', "        : undefined,", "Nueva visita / Reagendar · Hora de llegada", "Si la dejas vacía, el técnico la realiza en cualquier momento del día.")
duda("Cancelar / liberar visita · Motivo", "Queda guardado en la bitácora de la visita junto con tu usuario y la fecha.", A + "VisitaDialogos.tsx", "Informa que queda registro (advertencia de trazabilidad), no explica un control.")
ayuda(A + "VisitasMasivasDialogo.tsx", "Marca todos los que correspondan. El primero es el que encabeza la ficha del técnico.", "Visitas masivas · Motivo para todos")
ayuda(A + "VisitasMasivasDialogo.tsx", "Se copia a cada local, salvo a los que tengan su propio detalle.", "Visitas masivas · Qué hay que hacer")
lit(A + "VisitasMasivasDialogo.tsx", '        : "La hora es opcional y va en cada local, si hace falta.",', "        : undefined,", "Visitas masivas · Cuándo", "La hora es opcional y va en cada local, si hace falta.")
ayuda(A + "VisitasLoteDialogo.tsx", "Si quitas visitas de la lista, el número cambia.", "Visitas en lote · Confirmación")
duda("Visitas en lote · Nueva fecha y hora para todas", "Vacía = cada visita conserva la suya.", A + "VisitasLoteDialogo.tsx", "Dice qué pasa con el campo vacío: sin él, se podría creer que vacío borra la fecha.")
duda("Visitas en lote · Motivo para todas", "Sin marcar = cada visita conserva sus motivos. Si marcas, reemplazan a los que tenía.", A + "VisitasLoteDialogo.tsx", "Advierte que marcar reemplaza los motivos.")
duda("Visitas en lote · Motivo del cambio", "Queda en la bitácora de cada visita junto con tu usuario y la fecha.", A + "VisitasLoteDialogo.tsx", "Advertencia de trazabilidad.")

# ---------------- Detalle de visita / editar acta ----------------
ayuda(A + "editar-acta/secciones-evidencia.tsx", "Lo que quites no se borra: queda guardado e inactivo, y su número va al registro. Un video de más de 1 minuto o 720p se ajusta solo al agregarlo.", "Editar acta · Fotos y video")
ayuda(A + "editar-acta/secciones-evidencia.tsx", "Se conserva tal cual: no se edita.", "Editar acta · Firma de la tienda")
elemento(A + "editar-acta/secciones-evidencia.tsx", "Es la firma que dejó la tienda al cerrar el acta, con su hora.", "Editar acta · Firma de la tienda", "Es la firma que dejó la tienda al cerrar el acta, con su hora. Si corriges el nombre o el RUT del responsable y eran los mismos que van bajo la firma, ese texto se corrige también; la firma no.")
lit(A + "editar-acta/secciones-evidencia.tsx", "            Es obligatorio y queda en el registro de la visita junto con lo que cambiaste.", "            Obligatorio", "Editar acta · ¿Por qué se edita el acta?", "Es obligatorio y queda en el registro de la visita junto con lo que cambiaste. (queda «Obligatorio»)")
elemento(A + "editar-acta/secciones-evidencia.tsx", "El punto morado marca las secciones que llevan cambios sin guardar.", "Editar acta · Índice de secciones", "El punto morado marca las secciones que llevan cambios sin guardar.")
ayuda(A + "editar-acta/secciones.tsx", "Quien recibió al técnico y firmó el acta.", "Editar acta · Sucursal y responsable")
ayuda(A + "editar-acta/secciones.tsx", "Cada motivo con lo que se hizo en él. Lo marcado es lo que sale en el acta.", "Editar acta · Motivo y trabajo realizado")
duda("Editar acta · Problemas detectados", "Agrega los que faltan, corrige los que hay o quita los que sobran. El estado de cada problema se cambia en Problemas: …", A + "editar-acta/secciones.tsx", "La primera frase explica la interfaz, pero la segunda es una regla (dónde se cambia el estado).")

# ---------------- Problemas ----------------
lit(A + "ProblemasView.tsx", '          bajada="Lo que conviene mover esta semana para bajar los problemas sin cerrar."\n', "", "Problemas · Checklist de gestión (cajón)", "Lo que conviene mover esta semana para bajar los problemas sin cerrar.")
lit(A + "AvisoProblemas.tsx", '            ? "Marca arriba los que va a resolver: quedan como «Agendado» y el técnico confirma en el acta si quedaron solucionados."', "            ? null", "Nueva visita · Aviso de problemas sin resolver", "Marca arriba los que va a resolver: quedan como «Agendado» y el técnico confirma en el acta si quedaron solucionados.")
duda("Nueva visita · Aviso de problemas sin resolver", "Los problemas siguen como están. Queda registrado que se avisó y que la visita es por otra cosa.", A + "AvisoProblemas.tsx", "Informa la consecuencia de la respuesta (dato), aunque suena a explicación.")

# ---------------- Clientes / Sucursales / Malls ----------------
ayuda(A + "maestros/useSucursalForm.ts", "Al elegirlo, la sucursal toma la dirección, la comuna y la región del mall. Sin mall, escribe la dirección de la calle.", "Sucursal (formulario) · Mall")
ayuda(A + "maestros/useSucursalForm.ts", "Su cliente no está en plan, pero esta tienda puede estarlo por su cuenta.", "Sucursal (formulario) · Plan de calibración")
duda("Sucursal (formulario) · Garantía", "Cuenta desde la fecha de instalación. Si la dejas vacía rige el plan de garantía de su cliente, si lo tiene.", A + "maestros/useSucursalForm.ts", "Regla de negocio (de dónde sale la garantía), no solo interfaz.")
duda("Sucursal (formulario) · Plan de calibración (bloqueado)", "Todas las tiendas de un cliente en plan de calibración lo están. Se cambia en el cliente.", A + "maestros/useSucursalForm.ts", "Explica por qué el campo está bloqueado y dónde se cambia.")
duda("Cliente (formulario) · Plan de calibración", "Si está en plan, todas sus sucursales lo están. Si no, cada sucursal puede estarlo por su cuenta.", A + "maestros/ClientesTable.tsx", "Regla de negocio.")
duda("Cliente (formulario) · Garantía", "Cubre todos sus locales, contando desde la instalación de cada uno. Un local con garantía propia manda sobre este plan.", A + "maestros/ClientesTable.tsx", "Regla de negocio (precedencia).")

# ---------------- Usuarios ----------------
ayuda(A + "maestros/UsuariosTable.tsx", "Con este técnico ve sus visitas asignadas y llena sus actas desde el panel de técnico.", "Usuarios · Cuenta · Técnico vinculado")
elemento(A + "RolesView.tsx", "Cada usuario del panel tiene un rol y puede hacer lo que su rol tenga marcado.", "Usuarios · Roles y permisos", "Cada usuario del panel tiene un rol y puede hacer lo que su rol tenga marcado. El rol se le asigna en la pestaña Cuentas.")
duda("Usuarios · Permisos del celular", "Qué puede hacer un técnico desde la app del celular. Lo heredan todas las cuentas de técnico; ven solo sus propias visitas, sin importar estos permisos.", A + "RolesView.tsx", "La primera frase explica; la segunda es una regla de seguridad.")
duda("Usuarios · Contraseña temporal entregada", "Entrégasela por teléfono o en persona. Al entrar, el sistema le va a pedir que la cambie.", A + "SolicitudesPasswordView.tsx", "Indicación de seguridad y dato de lo que pasa al entrar.")

# ---------------- Checklist ----------------
elemento(A + "checklist/listas-simples.tsx", "Acá vive todo lo que el técnico elige desde listas en su celular.", "Checklist · Introducción", "Acá vive todo lo que el técnico elige desde listas en su celular. Cada bloque es una lista distinta. Para cambiar el orden, agarra una fila de su manilla y suéltala donde va; también puedes clonar una entrada…")
for f, frase, pant in [
    (A + "checklist/listas.tsx", "Coordinación agenda la visita con uno o varios motivos", "Checklist · Motivos y sus trabajos"),
    (A + "checklist/listas.tsx", "Lo que el técnico elige al levantar un problema", "Checklist · Tipos de problema"),
    (A + "checklist/listas.tsx", "Los mismos trabajos de la Lista 1, vistos desde el otro lado", "Checklist · Todos los trabajos"),
    (A + "checklist/listas-simples.tsx", "Los pasos que coordinación va marcando en «Problemas»", "Checklist · Gestión de problemas"),
    (A + "checklist/listas-simples.tsx", "Los estados entre los que se elige en «Cambiar estado o tipo»", "Checklist · Estados del problema"),
    (A + "checklist/listas-simples.tsx", "Los cargos que se ofrecen para quien recibe y firma en la tienda", "Checklist · Cargos del responsable"),
]:
    s = leer(f); m = re.search(r'\n\s*bajada="(' + re.escape(frase) + r'[^"]*)"', s)
    if m: escribir(f, s.replace(m.group(0), "", 1)); quitados.append((pant, m.group(1), f))
    else: saltados.append((f, frase)); quitados.append((pant, frase + "…", f))
lit(A + "checklist/VistaTecnico.tsx", ' bajada="Con los cambios que todavía no guardas."', "", "Checklist · Así lo ve el técnico", "Con los cambios que todavía no guardas.")
lit(A + "checklist/desplegables.tsx", '                  ? "El técnico solo ve este trabajo bajo los motivos marcados. Al marcar uno, el trabajo entra al final de ese motivo."', "                  ? null", "Checklist · Trabajo · Aparece bajo estos motivos", "El técnico solo ve este trabajo bajo los motivos marcados. Al marcar uno, el trabajo entra al final de ese motivo.")
elemento(A + "checklist/desplegables.tsx", "Cada grupo sale en el celular con su nombre y sus propias opciones.", "Checklist · Trabajo · Grupos de subdetalles", "Cada grupo sale en el celular con su nombre y sus propias opciones. Un mismo subtrabajo no puede repetirse en dos grupos del trabajo.")
duda("Checklist · Comentario interno", "Lo que el técnico marca en la sección «Comentario interno» del acta… Es solo para coordinación: no aparece en el PDF…", A + "checklist/listas-simples.tsx", "Explica la lista, pero incluye la advertencia de que no sale en el PDF.")
duda("Checklist · Secciones obligatorias del acta", "El técnico no puede cerrar la visita hasta llenar las secciones que marques acá. Las tres primeras son obligatorias siempre. Vale para las actas que se cierren desde ahora…", A + "checklist/secciones-acta.tsx", "Advierte desde cuándo rige el cambio.")

# ---------------- Mi cuenta ----------------
lit(A + "CuentaView.tsx", '<Seccion titulo="Datos" bajada="El correo es con el que entras al sistema.">', '<Seccion titulo="Datos">', "Mi cuenta · Datos", "El correo es con el que entras al sistema.")
duda("Mi cuenta · Contraseña", "Mínimo 10 caracteres y distinta de tu correo. Al cambiarla se cierran tus sesiones en otros equipos.", A + "CuentaView.tsx", "Reglas de la contraseña y advertencia de cierre de sesiones (se reemplaza por las reglas en vivo de la demo al rehacer Mi cuenta).")

# ---------------- Visitas en papel ----------------
elemento(A + "papel/carga.tsx", "Para pasar al sistema los informes que se hicieron a mano.", "Visitas en papel · Introducción", "Para pasar al sistema los informes que se hicieron a mano. Cada informe entra como visita completada, con el folio del año del informe, sin fotos, video ni firma dibujada. Lo que escribes se guarda en este navegador hasta que lo guardes en el sistema.")

# ---------------- Panel de técnico (celular) ----------------
elemento(M + "NuevaVisitaSheet.tsx", "Mismo formulario que usa coordinación para crear una visita", "Técnico · Agregar visita", "Mismo formulario que usa coordinación para crear una visita, para cuando no te la asignaron o la haces fuera de tu planificación.")
lit(M + "NuevaVisitaSheet.tsx", ' <span className="opacity-70 normal-case tracking-normal">(marca todos los que correspondan)</span>', "", "Técnico · Agregar visita · Motivo", "(marca todos los que correspondan)")
ayuda(M + "DetalleVisita.tsx", "Queda registrada la fecha anterior y el motivo; coordinación lo ve al instante.", "Técnico · Visita · Reagendar")
lit(M + "DetalleVisita.tsx", "              Al iniciar se registra la hora en el acta. El formulario guarda sección por sección.\n", "", "Técnico · Visita · Iniciar visita", "Al iniciar se registra la hora en el acta. El formulario guarda sección por sección.")
lit(M + "DetalleVisita.tsx", "? ` Van dos técnicos: quien abre", "? `Van dos técnicos: quien abre", "Técnico · Visita · Iniciar visita", "(espacio inicial del aviso de dos técnicos, que se queda)")
quitados.pop()
lit(M + "DetalleVisita.tsx", '                <p className="-mt-1 mb-0 text-cap opacity-66">Si no pones hora, la visita queda para cualquier momento de ese día.</p>\n', "", "Técnico · Visita · Reagendar · Hora", "Si no pones hora, la visita queda para cualquier momento de ese día.")
duda("Técnico · Visita · No se pudo hacer", "La visita queda PENDIENTE y vuelve a tu lista hasta cerrarla.", M + "DetalleVisita.tsx", "Informa el estado en que queda la visita.")
elemento(M + "formulario/hojas.tsx", "Toca para marcar. Las opciones que llevan cantidad muestran", "Técnico · Formulario · Trabajo realizado", "Toca para marcar. Las opciones que llevan cantidad muestran − y + al marcarlas.")
lit(M + "formulario/secciones.tsx", '              <p className="m-0 mt-1 text-meta opacity-60">Si encontraste otro, agrégalo abajo aunque los de arriba hayan quedado solucionados.</p>\n', "", "Técnico · Formulario · Problemas detectados", "Si encontraste otro, agrégalo abajo aunque los de arriba hayan quedado solucionados.")
lit(M + "formulario/secciones.tsx", '          <p className="m-0 mb-3.5 text-meta opacity-60">Cada problema se llena en su propia ficha para no saturar esta pantalla.</p>\n', "", "Técnico · Formulario · Problemas detectados", "Cada problema se llena en su propia ficha para no saturar esta pantalla.")
lit(M + "formulario/secciones-evidencia.tsx", '            ? "Vas a ver el acta completa antes de guardar nada."', "            ? null", "Técnico · Formulario · Revisar y guardar", "Vas a ver el acta completa antes de guardar nada.")
duda("Técnico · Formulario · Fotos del trabajo", "Al final del trabajo: pórtico terminado, etiqueta de serie y cada problema que dejes anotado.", M + "formulario/secciones-evidencia.tsx", "Dice qué fotografiar: es una instrucción de trabajo, no de la interfaz.")
duda("Técnico · Formulario · Video del trabajo", "Para lo que una foto no alcanza a mostrar: la falsa alarma sonando, el pórtico…", M + "formulario/secciones-evidencia.tsx", "Instrucción de trabajo.")
duda("Técnico · Firma · Pantalla girada", "Gira el teléfono para verlo derecho — ya puedes firmar así / La pantalla no se mueve mientras firmas", M + "FirmaSheet.tsx", "Explica la interfaz, pero sin él la firma girada desorienta.")
duda("Técnico · Formulario · Edición del acta", "Así va a quedar el acta corregida. La firma de la tienda es la misma de cuando se cerró. / Al confirmar queda registrado qué cambiaste, cuándo y por qué…", M + "formulario/pantallas.tsx", "Advertencias de trazabilidad y de la firma.")

# ---------------- registro ----------------
def tabla(filas, cols):
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for f in filas: out.append("| " + " | ".join(x.replace("|", "\\|").replace("\n", " ") for x in f) + " |")
    return "\n".join(out)

previo = []
ruta = os.path.join(RAIZ, "docs", "textos-quitados.md")
doc = f"""# Textos quitados (etapa 2)

Regla aplicada: si el texto informa un **dato** o una **advertencia**, se queda; si explica la **interfaz**, se va.
Nunca se quitan errores, estados vacíos, «Obligatorio»/«Opcional», confirmaciones de borrado ni «No lo ve el cliente».
Generado por `scripts/limpiar-textos.py` (el script es la fuente; para devolver un texto, se quita su línea y se restaura el archivo).

## Quitados ({len(quitados)})

{tabla([(p, t, f"`{f}`") for p, t, f in quitados], ["Pantalla", "Texto", "Archivo"])}

## Dudosos — no se quitaron ({len(dudosos)})

{tabla([(p, t, por, f"`{f}`") for p, t, f, por in dudosos], ["Pantalla", "Texto", "Por qué se deja", "Archivo"])}

## Pendientes en pantallas que se rehacen

Estas pantallas se reconstruyen desde la demo en las etapas siguientes y salen ya sin textos explicativos; lo que se quite ahí se suma a esta lista:
Campanita (etapa 3), Usuarios (etapa 4), Nueva visita y Visitas masivas (etapa 5), Checklist y Mi cuenta (etapa 7).
"""
if saltados and not quitados:
    print("Nada que hacer: ya estaba aplicado.")
else:
    io.open(ruta, "w", encoding="utf8", newline="\n").write(doc)
print(f"quitados={len(quitados)} dudosos={len(dudosos)} saltados={len(saltados)}")

