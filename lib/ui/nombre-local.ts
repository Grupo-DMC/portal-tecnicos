/**
 * El nombre con que se lista un local: «Cliente · Marca · Sucursal». Si el
 * local está en un mall, la «sucursal» es el nombre del mall. Se omite la marca
 * cuando repite el nombre del cliente.
 */
export function nombreLocal(opts: {
  cliente?: string | null;
  marca?: string | null;
  sucursal: string;
  mall?: string | null;
}): string {
  const marca = opts.marca && opts.marca !== opts.cliente ? opts.marca : null;
  return [opts.cliente, marca, opts.mall || opts.sucursal].filter(Boolean).join(" · ");
}
