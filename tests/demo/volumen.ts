import { deflateSync } from "node:zlib";
import bcrypt from "bcryptjs";
import sql from "mssql";
import { CLAVE_E2E } from "../e2e/base";
import { T } from "@/lib/db/esquema";

// Volumen parecido al de la demo panel-operacion.html, para comparar React con ella con datos reales.
// Va SOLO a la base local de comparación (tests/demo/base.ts → dmc_test_demo0001), nunca a producción.
// Es determinista: la misma semilla da siempre los mismos datos, relativos a la fecha de hoy.

/* ---------- utilidades ---------- */
let semilla = 20261126;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a: number, b: number) => a + Math.floor(azar() * (b - a + 1));
const uno = <X>(xs: readonly X[]): X => xs[Math.floor(azar() * xs.length)];
const q = (s: string | null | undefined) => (s == null ? "NULL" : `N'${s.replace(/'/g, "''")}'`);
const dia = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
function dv(cuerpo: number): string {
  let s = 0, m = 2;
  for (const c of String(cuerpo).split("").reverse()) { s += Number(c) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}
const rut = (cuerpo: number) => `${cuerpo.toLocaleString("de-DE")}-${dv(cuerpo)}`;

/** PNG de un color (con una franja), para que la evidencia tenga miniaturas reales. */
function png(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
    return ~c >>> 0;
  };
  const trozo = (tipo: string, datos: Buffer) => {
    const t = Buffer.concat([Buffer.from(tipo), datos]);
    const out = Buffer.alloc(8 + datos.length + 4);
    out.writeUInt32BE(datos.length, 0);
    t.copy(out, 4);
    out.writeUInt32BE(crc(t), 8 + datos.length);
    return out;
  };
  const filas = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    filas[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const franja = y > h * 0.62;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      filas[o] = franja ? 235 : r; filas[o + 1] = franja ? 230 : g; filas[o + 2] = franja ? 225 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(filas)), trozo("IEND", Buffer.alloc(0))]);
}

/* ---------- catálogos (como la demo) ---------- */
const SECCIONES_MOTIVO: [string, [string, string][]][] = [
  ["Antenas de seguridad", [
    ["VISITA_DE_CALIBRACION", "Visita de calibración"], ["INSTALACION_DE_ANTENAS", "Instalacion de antenas"],
    ["DES_INSTALACION_DE_ANTENAS", "Des Instalacion de antenas"], ["RE_INSTALACION_DE_ANTENAS", "Re Instalacion de antenas"],
    ["REVISION_DE_CONDICIONES_LOCA", "Revisión de condiciones local"],
  ]],
  ["Contadores de personas", [
    ["INSTALACION_DE_CONTADORES_DE", "Instalación de contadores de personas"], ["REINSTALACION_DE_CONTADORES_", "Reinstalación de contadores de personas"],
    ["CALIBRACION_DE_CONTADORES_DE", "Calibración de contadores de personas"], ["REVISION_DE_CONDICIONES_DE_C", "Revisión de condiciones de contadores de personas"],
  ]],
];
const TRABAJOS: [string, string, string[]][] = [
  ["MODELO_ANTENA", "Modelo de antena instaladas", ["SD-51&52", "AM Master 9000", "Antena RF 8.2 MHz"]],
  ["CAMBIO_ACCESORIOS", "Cambio de accesorios", ["Cambio de cable UTP", "Cambio de RJ45", "Fuente de poder"]],
  ["CONECTIVIDAD_ANTENAS", "Conectividad antenas", ["Modulo Wifi", "Modulo de red RJ45"]],
  ["ACTUALIZACION_PLACAS", "Actualización de placas antenas", ["Placa TX", "Placa RX", "Placa desactivador"]],
  ["CAMBIO_PLACAS", "Cambio de placas antenas", ["Placa TX", "Placa RX"]],
  ["CALIBRACION_CONTADOR", "Calibración del contador", ["Sensor de entrada", "Sensor de salida"]],
];
const PROBLEMAS: [string, string, string[]][] = [
  ["PLACAS_DANADAS", "Placas dañadas", ["AM Master 9000", "Placa RX", "Placa TX"]],
  ["ANTENA_CON_PROBLEMA", "Antena con problema", ["Antena RF 8.2 MHz", "AM Master 9000"]],
  ["PLACAS_CON_PROBLEMA", "Placas con problema", ["Placa RX", "Placa TX"]],
  ["CABLEADO_CON_PROBLEMAS", "Cableado con problemas", ["Cable UTP (Sincronización)", "Cable de poder"]],
  ["CONEXION_DE_RED", "Conexión de red", ["Modulo de red RJ45", "Router del local"]],
  ["SIN_ENERGIA", "Sin energía", ["Enchufe del pórtico", "Fuente de poder"]],
];
const INTERNOS = ["Falla de placas", "Cliente pidió cotización", "Repuesto pendiente", "Mal uso del local"];
const CARGOS = ["Responsable de tienda", "Jefe de tienda", "Subgerente", "Guardia", "Prevención de pérdidas"];

/* ---------- maestros ---------- */
const CLIENTES = [
  ["Maui And Sons", "Maui And Sons S.a.", ["Maui And Sons", "Maui", "Inside", "Ripcurl/Volcom"]],
  ["TUA", "Tua Retail S.A.", ["TUA", "Antiage"]], ["Pillin", "Pillin S.a.", ["Pillin"]],
  ["Cannon Home", "Representaciones Canontex Ltda.", ["Cannon Home"]], ["Ficcus", "Manzano y Cía. Ltda.", ["Ficcus"]],
  ["Puma", "Puma Chile SpA", ["Puma"]], ["Equinox", "Equinox Los Andes SpA", ["Equinox", "Nike", "Marathon"]],
  ["Lippi", "The Andes Brands S.A.", ["Lippi"]], ["100% Futbol", "Comercial Cien por Ciento Fútbol SpA", ["100% Futbol"]],
  ["Bata", "Bata Chile S.A.", ["Bata"]], ["Totto", "Totto Chile Ltda.", ["Totto"]], ["Adidas TSR", "Adidas Chile Ltda.", ["Adidas TSR"]],
  ["Rockford", "Rockford S.A.", ["Rockford"]], ["Doite", "Doite S.A.", ["Doite"]], ["Kayser", "Kayser Chile S.A.", ["Kayser"]],
  ["Moto Trainer", "Moto Trainer SpA", ["Moto Trainer"]], ["Hush Puppies", "Forus S.A.", ["Hush Puppies", "Columbia"]],
  ["Caterpillar", "Calzados Cat Ltda.", ["Caterpillar"]], ["Gap", "Gap Chile SpA", ["Gap"]], ["Prueba Interna", "Cliente de Prueba SpA", ["Prueba"]],
  // Textos al límite, para probar que nada empuje el layout a lo ancho.
  ["Comercializadora Internacional de Calzado", "Comercializadora Internacional de Artículos Deportivos, Calzado y Vestuario Limitada", ["Distribuidora Sudamericana de Ropa Outdoor y Accesorios"]],
] as const;
const MALLS: [string, string, string, string][] = [
  ["Mall Plaza Vespucio", "Av. Vicuña Mackenna 7110", "La Florida", "Metropolitana"],
  ["Centro Comercial Paseo Costanera Premium Outlet Puerto Montt", "Avenida Diego Portales Esquina Calle Urmeneta 1130, Local 214-B", "Puerto Montt", "Los Lagos"],
  ["Cenco Costanera Center", "Av. Andrés Bello 2425", "Providencia", "Metropolitana"],
  ["Arauco Maipú", "Av. Américo Vespucio 399", "Maipú", "Metropolitana"],
  ["Mall Plaza Los Dominicos", "Av. Padre Hurtado Sur 875", "Las Condes", "Metropolitana"],
  ["Mall Plaza Egaña", "Av. Larraín 5862", "La Reina", "Metropolitana"],
  ["Cenco Alto Las Condes", "Av. Pdte. Kennedy 9001", "Las Condes", "Metropolitana"],
  ["Arauco Premium Outlet", "Av. Pdte. Eduardo Frei 3351", "Quilicura", "Metropolitana"],
  ["Mall Plaza Oeste", "Av. Américo Vespucio 1501", "Cerrillos", "Metropolitana"],
  ["Mall Plaza Norte", "Av. Américo Vespucio 1737", "Huechuraba", "Metropolitana"],
  ["Viña Outlet Park", "Camino Internacional 2400", "Viña del Mar", "Valparaíso"],
  ["Espacio Urbano 15 Norte", "Av. 15 Norte 961", "Viña del Mar", "Valparaíso"],
  ["Outlet Quilpué", "Av. Los Carrera 1000", "Quilpué", "Valparaíso"],
  ["Open Plaza Rancagua", "Av. Manuel Montt 3732", "Rancagua", "O'Higgins"],
  ["Mall Plaza Calama", "Av. Balmaceda 3242", "Calama", "Antofagasta"],
  ["Mallplaza Copiapó", "Maipú 109", "Copiapó", "Atacama"],
  ["Portal Temuco", "Av. Alemania 0671", "Temuco", "Araucanía"],
  ["Portal Cenco Temuco", "Av. Manuel Montt 3984", "Temuco", "Araucanía"],
  ["Mall Portal Valdivia", "Arauco 561", "Valdivia", "Los Ríos"],
  ["Vivo Outlet Chillán", "Av. Collín 1050", "Chillán", "Ñuble"],
  ["Mall del Centro Concepción", "Barros Arana 1068", "Concepción", "Biobío"],
  ["Mall Plaza San Bernardo", "Av. Pdte. Jorge Alessandri 20040", "San Bernardo", "Metropolitana"],
  ["Patio Outlet Maipú", "Av. Pajaritos 4500", "Maipú", "Metropolitana"],
];
const CALLES: [string, string, string][] = [
  ["Av. Providencia 2124", "Providencia", "Metropolitana"], ["Ahumada 312", "Santiago", "Metropolitana"],
  ["Av. Libertad 1348", "Viña del Mar", "Valparaíso"], ["Calle Los Carrera 3546", "Calama", "Antofagasta"],
  ["Barros Arana 820", "Concepción", "Biobío"],
];
const TECNICOS: [string, string, string, string][] = [
  ["Alexis", "Abarzua", "aabarzua@example.com", "+56 9 6123 4501"],
  ["Manuel", "Zambrano", "mzambrano@example.com", "+56 9 6123 4502"],
  ["Richard", "Diaz", "rdiaz@example.com", "+56 9 6123 4503"],
  ["Rodrigo", "Carvajal", "rcarvajal@example.com", "+56 9 6123 4504"],
  ["Harold", "Peralta", "hperalta@example.com", "+56 9 6123 4505"],
];
const PERSONAS = ["Silena Basoalto", "Javiera Soto", "Camila Rojas", "Pedro Muñoz", "Daniela Fuentes", "Ignacio Vera", "Valentina Pérez", "Tomás Herrera"];
const SOLICITUDES = [
  "Calibrar antenas", "La antena de la salida no detecta etiquetas duras.", "Retirar las antenas: la tienda cierra a fin de mes.",
  "Revisar el contador de personas de la entrada secundaria.", "Falsa alarma cada 10 minutos desde el lunes.",
  "Mantención preventiva de las antenas y revisión del contador.", "Instalar 2 pórticos nuevos en el acceso principal.",
];
const HALLAZGOS = [
  "La antena suena sin motivo en horario punta; el local lo reporta varias veces al día.",
  "Placa con quemadura en el conector de alimentación; hay que reemplazarla.",
  "Una de las antenas del pórtico no enciende el LED de estado.",
  "Cable utp problema se cambia", "El enchufe del pórtico está suelto y corta la energía.",
];

export async function sembrarVolumen(pool: sql.ConnectionPool): Promise<void> {
  const run = (s: string) => pool.request().batch(s);

  /* Catálogos */
  for (const [i, [seccion, motivos]] of SECCIONES_MOTIVO.entries()) {
    await run(`INSERT INTO ${T.catalogo_seccion} (tipo, nombre, orden) VALUES ('MOTIVO', ${q(seccion)}, ${i + 1});`);
    for (const [j, [codigo, nombre]] of motivos.entries())
      await run(`INSERT INTO ${T.catalogo_motivo} (codigo, nombre, seccion_id, orden)
        SELECT '${codigo}', ${q(nombre)}, id, ${j + 1} FROM ${T.catalogo_seccion} WHERE tipo = 'MOTIVO' AND nombre = ${q(seccion)};`);
  }
  // Los dos motivos de la siembra mínima también van en la primera sección.
  await run(`UPDATE ${T.catalogo_motivo} SET seccion_id = (SELECT id FROM ${T.catalogo_seccion} WHERE nombre = N'Antenas de seguridad'), orden = orden + 10 WHERE seccion_id IS NULL;`);
  for (const [i, [codigo, nombre, subs]] of TRABAJOS.entries()) {
    await run(`INSERT INTO ${T.catalogo_trabajo} (codigo, nombre, orden) VALUES ('${codigo}', ${q(nombre)}, ${i + 2});`);
    for (const [j, s] of subs.entries())
      await run(`INSERT INTO ${T.catalogo_trabajo_subtrabajo} (trabajo_id, etiqueta, orden, permite_cantidad) SELECT id, ${q(s)}, ${j}, 1 FROM ${T.catalogo_trabajo} WHERE codigo = '${codigo}';`);
  }
  await run(`INSERT INTO ${T.catalogo_motivo_trabajo} (motivo_id, trabajo_id, orden)
    SELECT m.id, t.id, ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY t.orden)
      FROM ${T.catalogo_motivo} m CROSS JOIN ${T.catalogo_trabajo} t
     WHERE NOT EXISTS (SELECT 1 FROM ${T.catalogo_motivo_trabajo} x WHERE x.motivo_id = m.id AND x.trabajo_id = t.id)
       AND (t.id + m.id) % 3 <> 0;`);
  for (const [i, [codigo, nombre, ops]] of PROBLEMAS.entries()) {
    await run(`INSERT INTO ${T.catalogo_problema} (codigo, nombre, orden) VALUES ('${codigo}', ${q(nombre)}, ${i + 3});`);
    for (const [j, o] of ops.entries())
      await run(`INSERT INTO ${T.catalogo_problema_opcion} (problema_id, etiqueta, orden, permite_cantidad) SELECT id, ${q(o)}, ${j}, 1 FROM ${T.catalogo_problema} WHERE codigo = '${codigo}';`);
  }
  await run(`INSERT INTO ${T.catalogo_problema_opcion} (problema_id, etiqueta, orden, permite_cantidad) SELECT id, N'Antena RF 8.2 MHz', 0, 1 FROM ${T.catalogo_problema} WHERE codigo = 'ANTENA_NO_DETECTA';`);
  await run(INTERNOS.map((n, i) => `INSERT INTO ${T.catalogo_interno} (codigo, nombre, orden) VALUES ('INT_${i + 1}', ${q(n)}, ${i + 1});`).join("\n"));
  await run(CARGOS.map((n, i) => `INSERT INTO ${T.catalogo_cargo} (codigo, nombre, orden) VALUES ('CARGO_${i + 1}', ${q(n)}, ${i + 1});`).join("\n"));

  /* Malls */
  await run(MALLS.map(([n, d, c, r]) => `INSERT INTO ${T.mall} (nombre, direccion, comuna, region) VALUES (${q(n)}, ${q(d)}, ${q(c)}, ${q(r)});`).join("\n"));
  const malls = (await pool.request().query<{ id: string; nombre: string; comuna: string; region: string }>(`SELECT id, nombre, comuna, region FROM ${T.mall} ORDER BY id`)).recordset;

  /* Clientes, marcas y sucursales */
  let cuerpoRut = 76100000;
  for (const [ci, [fant, razon, marcas]] of CLIENTES.entries()) {
    cuerpoRut += entre(1000, 90000);
    const plan = ci % 3 === 2 ? "NULL" : "1";
    await run(`INSERT INTO ${T.cliente} (rut, razon_social, nombre_fantasia, plan_calibracion, garantia_meses) VALUES ('${rut(cuerpoRut)}', ${q(razon)}, ${q(fant)}, ${plan}, ${ci % 4 === 0 ? 12 : "NULL"});`);
    for (const m of marcas) await run(`INSERT INTO ${T.marca} (cliente_id, nombre) SELECT id, ${q(m)} FROM ${T.cliente} WHERE nombre_fantasia = ${q(fant)};`);
    const n = fant === "Prueba Interna" ? 0 : Math.max(2, 16 - ci + entre(-2, 3));
    const usados = new Set<string>();
    for (let k = 0; k < n; k++) {
      const marca = uno(marcas);
      const mall = k % 5 === 4 ? null : uno(malls);
      const calle = uno(CALLES);
      let nombre = mall ? (marca === fant ? mall.nombre : `${marca}, ${mall.nombre}`) : marca === fant ? calle[1] : `${marca}, ${calle[1]}`;
      let x = 2;
      while (usados.has(`${marca}|${nombre}`)) nombre = `${nombre.replace(/ \(\d+\)$/, "")} (${x++})`;
      usados.add(`${marca}|${nombre}`);
      const activo = k === n - 1 && ci % 6 === 5 ? 0 : 1;
      await run(`INSERT INTO ${T.sucursal} (cliente_id, marca_id, mall_id, nombre, codigo, direccion, comuna, region, telefono, activo, motivo_inactivo, fecha_instalacion, remota)
        SELECT c.id, m.id, ${mall ? mall.id : "NULL"}, ${q(nombre)}, ${k % 3 === 0 ? `'${marca.slice(0, 2).toUpperCase()}-${100 + ci * 20 + k}'` : "NULL"},
               ${q(mall ? MALLS.find((y) => y[0] === mall.nombre)![1] : calle[0])}, ${q(mall ? mall.comuna : calle[1])}, ${q(mall ? mall.region : calle[2])},
               ${k % 2 ? "'+56 2 2333 4203'" : "NULL"}, ${activo}, ${activo ? "NULL" : "N'Cerró el local'"}, '${dia(-entre(200, 900))}', ${k % 4 === 0 ? 0 : "NULL"}
          FROM ${T.cliente} c JOIN ${T.marca} m ON m.cliente_id = c.id
         WHERE c.nombre_fantasia = ${q(fant)} AND m.nombre = ${q(marca)};`);
    }
  }
  // El cliente de prueba sin locales activos, y uno inactivo.
  await run(`INSERT INTO ${T.cliente} (rut, razon_social, nombre_fantasia, activo, motivo_inactivo) VALUES ('${rut(79900001)}', N'Comercial Antigua Ltda.', N'Antigua', 0, N'Dejó de ser cliente');`);

  /* Técnicos y cuentas */
  const hash = await bcrypt.hash(CLAVE_E2E, 6);
  for (const [i, [n, a, email, tel]] of TECNICOS.entries())
    await run(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, apellido_materno, email, telefono) VALUES ('${rut(15000000 + i * 1234567)}', ${q(n)}, ${q(a)}, N'Soto', '${email}', '${tel}');`);
  await run(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, email, activo, motivo_inactivo) VALUES ('${rut(18765432)}', N'Esteban', N'Pacheco', 'epacheco@example.com', 0, N'Renunció');`);
  await run(`INSERT INTO ${T.tecnico} (rut, nombres, apellido_paterno, apellido_materno, email, telefono) VALUES ('${rut(19876543)}', N'Maximiliano Alejandro', N'Valenzuela-Echeverría', N'Santibáñez', 'maximiliano.valenzuela.echeverria.santibanez@contratistas-externos.example.com', '+56 9 8765 4321');`);
  for (const [i, [, , email]] of TECNICOS.entries()) {
    if (i === 3) continue; // Rodrigo queda sin cuenta, para «Crearle una cuenta».
    await run(`INSERT INTO ${T.usuario} (email, password_hash, tecnico_id, ultimo_acceso_en) SELECT '${email}', N'${hash}', id, DATEADD(minute, -${entre(5, 3000)}, SYSDATETIME()) FROM ${T.tecnico} WHERE email = '${email}';
      INSERT INTO ${T.usuario_rol} (usuario_id, rol) SELECT id, 'TECNICO' FROM ${T.usuario} WHERE email = '${email}';`);
  }
  await run(`
    INSERT INTO ${T.rol} (nombre, descripcion, es_sistema) VALUES (N'Secretaria', N'Agenda visitas y mantiene contactos.', 0), (N'Post-Venta', N'Sigue los problemas.', 0);
    INSERT INTO ${T.rol_permiso} (rol_id, permiso) SELECT r.id, x.p FROM ${T.rol} r CROSS JOIN (VALUES ('panel.ver'), ('visitas.ver'), ('visitas.crear'), ('clientes.ver')) x (p) WHERE r.nombre = N'Secretaria';
    INSERT INTO ${T.rol_permiso} (rol_id, permiso) SELECT r.id, x.p FROM ${T.rol} r CROSS JOIN (VALUES ('panel.ver'), ('problemas.ver')) x (p) WHERE r.nombre = N'Post-Venta';
    INSERT INTO ${T.usuario} (email, password_hash, rol_id, ultimo_acceso_en) SELECT 'secretaria@example.com', N'${hash}', id, DATEADD(hour, -3, SYSDATETIME()) FROM ${T.rol} WHERE nombre = N'Secretaria';
    INSERT INTO ${T.usuario} (email, password_hash, rol_id, activo, motivo_inactivo, ultimo_acceso_en) SELECT 'postventa@example.com', N'${hash}', id, 0, N'Renunció', DATEADD(day, -16, SYSDATETIME()) FROM ${T.rol} WHERE nombre = N'Post-Venta';
    INSERT INTO ${T.usuario_rol} (usuario_id, rol) SELECT id, 'COORDINADOR' FROM ${T.usuario} WHERE email IN ('secretaria@example.com', 'postventa@example.com');
    INSERT INTO ${T.solicitud_password} (email, usuario_id, mensaje, estado, creado_en) SELECT email, id, N'Olvidé mi contraseña', 'PENDIENTE', DATEADD(minute, -40, SYSDATETIME()) FROM ${T.usuario} WHERE email = 'rdiaz@example.com';
    INSERT INTO ${T.solicitud_password} (email, usuario_id, estado, atendido_en, creado_en) SELECT email, id, 'ATENDIDA', DATEADD(day, -3, SYSDATETIME()), DATEADD(day, -3, SYSDATETIME()) FROM ${T.usuario} WHERE email = 'mzambrano@example.com';
  `);

  await run(`INSERT INTO ${T.usuario} (email, password_hash, tecnico_id) SELECT email, N'${hash}', id FROM ${T.tecnico} WHERE email LIKE 'maximiliano.%';
    INSERT INTO ${T.usuario_rol} (usuario_id, rol) SELECT id, 'TECNICO' FROM ${T.usuario} WHERE email LIKE 'maximiliano.%';`);

  /* Referencias para las visitas */
  const sucursales = (await pool.request().query<{ id: string; cliente_id: string }>(`SELECT id, cliente_id FROM ${T.sucursal} WHERE activo = 1 ORDER BY id`)).recordset;
  const tecnicos = (await pool.request().query<{ id: string }>(`SELECT id FROM ${T.tecnico} WHERE activo = 1 ORDER BY id`)).recordset.map((t) => t.id);
  const motivos = (await pool.request().query<{ codigo: string }>(`SELECT codigo FROM ${T.catalogo_motivo} ORDER BY orden`)).recordset.map((m) => m.codigo);
  const trabajos = (await pool.request().query<{ codigo: string; subs: string }>(`
    SELECT t.codigo, STRING_AGG(s.etiqueta, '|') AS subs FROM ${T.catalogo_trabajo} t LEFT JOIN ${T.catalogo_trabajo_subtrabajo} s ON s.trabajo_id = t.id GROUP BY t.codigo`)).recordset;
  const problemas = (await pool.request().query<{ codigo: string; ops: string | null }>(`
    SELECT p.codigo, STRING_AGG(o.etiqueta, '|') AS ops FROM ${T.catalogo_problema} p LEFT JOIN ${T.catalogo_problema_opcion} o ON o.problema_id = p.id GROUP BY p.codigo`)).recordset;
  const internos = (await pool.request().query<{ codigo: string }>(`SELECT codigo FROM ${T.catalogo_interno}`)).recordset.map((x) => x.codigo);

  /* Visitas: 12 meses hacia atrás y una semana hacia adelante */
  const foto = png(320, 240, [42, 36, 48]);
  const foto2 = png(320, 240, [31, 90, 58]);
  const bloques: string[] = [];
  for (let i = 0; i < 1180; i++) {
    const offset = i < 24 ? entre(0, 7) : i < 40 ? 0 : -entre(1, 365);
    const s = uno(sucursales);
    const tec = uno(tecnicos);
    const ayu = azar() < 0.12 ? tecnicos.find((t) => t !== tec)! : null;
    const mots = [uno(motivos), ...(azar() < 0.25 ? [uno(motivos)] : [])].filter((m, k, a) => a.indexOf(m) === k);
    const hora = azar() < 0.35 ? `'${String(entre(9, 18)).padStart(2, "0")}:${uno(["00", "30"])}'` : "NULL";
    let estado: string;
    if (offset > 0) estado = "PROGRAMADA";
    else if (offset === 0) estado = uno(["PROGRAMADA", "PROGRAMADA", "EN_CURSO", "COMPLETADA", "COMPLETADA"]);
    else estado = azar() < 0.86 ? "COMPLETADA" : uno(["CANCELADA", "CANCELADA_ADMIN", "REAGENDADA", "PENDIENTE"]);
    const persona = uno(PERSONAS);
    let b = `
      INSERT INTO ${T.visita} (cliente_id, sucursal_id, tecnico_id, tecnico_ayudante_id, motivo_codigo, estado, fecha_programada, fecha_hasta, hora_programada,
                               trabajo_solicitado, indicaciones_acceso, responsable_nombre, responsable_cargo, responsable_telefono, creado_en)
      VALUES (${s.cliente_id}, ${s.id}, ${tec}, ${ayu ?? "NULL"}, '${mots[0]}', '${estado}', '${dia(offset)}', ${azar() < 0.08 ? `'${dia(offset + 2)}'` : "NULL"}, ${hora},
              ${q(uno(SOLICITUDES))}, ${azar() < 0.2 ? "N'Entrar por la puerta de servicio del nivel -1; pedir la llave al guardia.'" : "NULL"},
              ${azar() < 0.5 ? q(persona) : "NULL"}, ${q(uno(CARGOS))}, ${azar() < 0.4 ? "'+56 9 6620 1188'" : "NULL"}, DATEADD(day, ${Math.min(offset, 0) - entre(1, 6)}, SYSDATETIME()));
      SET @id = SCOPE_IDENTITY();
      ${mots.map((m, k) => `INSERT INTO ${T.visita_motivo} (visita_id, motivo_codigo, orden) VALUES (@id, '${m}', ${k});`).join("\n")}`;
    if (estado === "COMPLETADA" || estado === "EN_CURSO") {
      const ini = `DATEADD(minute, ${entre(9 * 60, 17 * 60)}, CAST('${dia(offset)}' AS datetime2(0)))`;
      const minutos = uno([4, 7, 12, 17, 22, 35, 53, 62]);
      const interno = estado === "COMPLETADA" && azar() < 0.15;
      b += `
      INSERT INTO ${T.visita_ejecucion} (visita_id, hora_inicio, hora_termino, responsable_nombre, responsable_rut, responsable_cargo, motivo_real_codigo, observaciones, comentario_interno, dispositivo)
      VALUES (@id, ${ini}, ${estado === "COMPLETADA" ? `DATEADD(minute, ${minutos}, ${ini})` : "NULL"}, ${q(persona)}, '${rut(entre(8000000, 22000000))}', ${q(uno(CARGOS))}, '${mots[0]}',
              ${azar() < 0.3 ? "N'Operativo, se deja funcionando.'" : "NULL"},
              ${interno ? q(uno(["Conviene cambiar la placa RX antes de diciembre; la tienda tiene mucho flujo.", "El guardia dio la clave del rack: usuario admin, clave Dmc2026!"])) : "NULL"}, N'Android 14, Samsung A54');`;
      if (estado === "COMPLETADA") {
        for (const [k, t] of [uno(trabajos), ...(azar() < 0.5 ? [uno(trabajos)] : [])].filter((x, k, a) => a.indexOf(x) === k).entries()) {
          b += `
      INSERT INTO ${T.visita_trabajo} (visita_id, trabajo_codigo, motivo_codigo, orden) VALUES (@id, '${t.codigo}', '${mots[0]}', ${k + 1});
      SET @t = SCOPE_IDENTITY();
      ${(t.subs ?? "").split("|").filter(Boolean).slice(0, entre(1, 2)).map((sub, j) => `INSERT INTO ${T.visita_trabajo_subtrabajo} (visita_trabajo_id, etiqueta, cantidad, orden) VALUES (@t, ${q(sub)}, ${entre(1, 4)}, ${j});`).join("\n")}`;
        }
        if (interno) b += `\nINSERT INTO ${T.visita_interno} (visita_id, interno_codigo) VALUES (@id, '${uno(internos)}');`;
        b += `\nINSERT INTO ${T.visita_firma} (visita_id, nombre, rut, imagen_url, firmado_en) VALUES (@id, ${q(persona)}, '${rut(entre(8000000, 22000000))}', N'/api/visita/firma/0', DATEADD(minute, ${minutos}, ${ini}));
      UPDATE ${T.visita_firma} SET imagen_url = CONCAT('/api/visita/firma/', CAST(id AS varchar(20))) WHERE visita_id = @id;`;
        if (azar() < 0.18) {
          const p = uno(problemas);
          const abierto = offset > -120 && azar() < 0.65;
          b += `
      INSERT INTO ${T.problema} (visita_id, tipo_codigo, estado, descripcion, resuelto_en, creado_en)
      VALUES (@id, '${p.codigo}', '${abierto ? "ABIERTO" : "RESUELTO"}', ${q(uno(HALLAZGOS))}, ${abierto ? "NULL" : `DATEADD(day, ${offset + entre(1, 9)}, SYSDATETIME())`}, DATEADD(day, ${offset}, SYSDATETIME()));
      ${p.ops ? `INSERT INTO ${T.problema_item} (problema_id, etiqueta, cantidad) VALUES (SCOPE_IDENTITY(), ${q(p.ops.split("|")[0])}, ${entre(1, 3)});` : ""}`;
        }
        if (offset > -20 && azar() < 0.5) b += `
      INSERT INTO ${T.visita_foto} (visita_id, archivo_url, contenido, mime, bytes, orden, tomada_en) VALUES (@id, N'x', @foto, 'image/png', ${foto.length}, 0, SYSDATETIME()), (@id, N'x', @foto2, 'image/png', ${foto2.length}, 1, SYSDATETIME());
      UPDATE ${T.visita_foto} SET archivo_url = CONCAT('/api/visita/foto/', CAST(id AS varchar(20))) WHERE visita_id = @id;`;
      }
    }
    if (estado === "REAGENDADA" || (estado === "CANCELADA" && azar() < 0.5)) b += `
      INSERT INTO ${T.reagendamiento} (visita_id, fecha_anterior, motivo, origen, creado_en)
      VALUES (@id, '${dia(offset)}', ${q(estado === "CANCELADA" ? `Cancelada automáticamente: el técnico no la completó en el plazo (fecha asignada ${dia(offset).split("-").reverse().join("-")}, con 1 día de tolerancia).` : "La tienda pidió cambiar el día por inventario.")}, '${estado === "CANCELADA" ? "WEB" : "MOVIL"}', DATEADD(day, ${offset + 1}, SYSDATETIME()));`;
    bloques.push(b);
  }
  for (let i = 0; i < bloques.length; i += 40) {
    await pool.request().input("foto", sql.VarBinary(sql.MAX), foto).input("foto2", sql.VarBinary(sql.MAX), foto2)
      .batch(`DECLARE @id bigint, @t bigint;\n${bloques.slice(i, i + 40).join("\n")}`);
  }

  /* Personas del local y contactos */
  await run(`
    INSERT INTO ${T.persona_local} (sucursal_id, nombre, rut, telefono, cargo)
      SELECT TOP 120 s.id, N'Javiera Soto', NULL, '+56 9 6620 1188', N'Jefe de tienda' FROM ${T.sucursal} s ORDER BY s.id;
    INSERT INTO ${T.contacto} (nombre, email, telefono) VALUES (N'Paula Contreras', 'paula@example.com', '+56 9 5555 1001'), (N'Jorge Lagos', 'jorge@example.com', NULL);
    INSERT INTO ${T.contacto_cargo} (contacto_id, cargo, alcance_tipo, alcance_id)
      SELECT (SELECT id FROM ${T.contacto} WHERE nombre = N'Paula Contreras'), N'Jefa de operaciones', 'CLIENTE', id FROM ${T.cliente} WHERE nombre_fantasia = N'Maui And Sons';
    INSERT INTO ${T.contacto_cargo} (contacto_id, cargo, alcance_tipo, alcance_texto)
      VALUES ((SELECT id FROM ${T.contacto} WHERE nombre = N'Jorge Lagos'), N'Supervisor zonal', 'REGION', N'Metropolitana');
  `);
}
