import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CampoTelefono from "@/components/ui/CampoTelefono";

function Campo({ inicial = "", alCambiar }: { inicial?: string; alCambiar?: (v: string) => void }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <label htmlFor="t">Teléfono</label>
      <CampoTelefono
        id="t"
        value={v}
        onChange={(x) => {
          setV(x);
          alCambiar?.(x);
        }}
      />
      <output data-testid="valor">{v}</output>
    </>
  );
}

const valor = () => screen.getByTestId("valor").textContent;

describe("CampoTelefono · el «+56 9» es un adorno fijo", () => {
  it("muestra el prefijo fuera del texto editable", () => {
    render(<Campo />);
    expect(screen.getByText("+56 9")).toBeInTheDocument();
    expect(screen.getByLabelText("Teléfono")).toHaveValue("");
  });

  it("escribir 8 dígitos guarda «+56 9 1234 5678»", async () => {
    const u = userEvent.setup();
    render(<Campo />);
    await u.type(screen.getByLabelText("Teléfono"), "12345678");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("1234 5678");
    expect(valor()).toBe("+56 9 1234 5678");
  });

  it("el primer dígito puede ser un 9 sin confundirse con el prefijo", async () => {
    const u = userEvent.setup();
    render(<Campo />);
    await u.type(screen.getByLabelText("Teléfono"), "91234567");
    expect(valor()).toBe("+56 9 9123 4567");
  });

  it("el retroceso solo borra dígitos: el prefijo no se va", async () => {
    const u = userEvent.setup();
    render(<Campo inicial="+56 9 1234 5678" />);
    const campo = screen.getByLabelText("Teléfono");
    await u.click(campo);
    await u.keyboard("{Backspace}".repeat(20));
    expect(campo).toHaveValue("");
    expect(valor()).toBe("");
    expect(screen.getByText("+56 9")).toBeInTheDocument();
  });

  it("descarta letras y símbolos, y pasa de 8 dígitos no escribe más", async () => {
    const u = userEvent.setup();
    render(<Campo />);
    await u.type(screen.getByLabelText("Teléfono"), "ab12-34 5678999");
    expect(valor()).toBe("+56 9 1234 5678");
  });

  it.each(["+56 9 1234 5678", "56912345678", "912345678", "+56912345678"])("pegar «%s» no duplica el prefijo", async (pegado) => {
    const u = userEvent.setup();
    render(<Campo />);
    await u.click(screen.getByLabelText("Teléfono"));
    await u.paste(pegado);
    expect(valor()).toBe("+56 9 1234 5678");
  });

  it("con menos de 8 dígitos avisa; vacío y completo no", async () => {
    const u = userEvent.setup();
    render(<Campo />);
    expect(screen.queryByText(/8 dígitos/)).toBeNull();
    await u.type(screen.getByLabelText("Teléfono"), "1234");
    expect(screen.getByText(/necesita 8 dígitos/)).toBeInTheDocument();
    await u.type(screen.getByLabelText("Teléfono"), "5678");
    expect(screen.queryByText(/8 dígitos/)).toBeNull();
  });

  it("un número de antes con otra forma se conserva y se avisa, sin deformarlo", () => {
    render(<Campo inicial="+56 2 2299 4100" />);
    expect(screen.getByLabelText("Teléfono")).toHaveValue("");
    expect(screen.getByText(/Número guardado: \+56 2 2299 4100/)).toBeInTheDocument();
    expect(valor()).toBe("+56 2 2299 4100");
  });

  it("con name, el valor completo viaja en un campo oculto", () => {
    const { container } = render(<CampoTelefono id="t" name="telefono" value="+56 9 1234 5678" onChange={() => {}} />);
    const oculto = container.querySelector('input[type="hidden"][name="telefono"]') as HTMLInputElement;
    expect(oculto.value).toBe("+56 9 1234 5678");
  });
});
