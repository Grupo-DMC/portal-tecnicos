import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { comprimirFoto, girarFoto } from "@/lib/ui/imagen";
import { useGirarFotos } from "@/components/ui/useGirarFotos";
import { GaleriaFotos } from "@/components/mobile/formulario/piezas";
import { Fotos } from "@/components/admin/editar-acta/piezas";
import type { FotoForm } from "@/lib/ui/borrador";

// jsdom no dibuja: se simulan Image y el canvas para mirar qué se le pide al
// dibujar (tamaño del lienzo y giro) y qué imagen sale.

let ctx: {
  fillRect: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillStyle: string;
};
let lienzos: HTMLCanvasElement[];
let anchoFoto: number;
let altoFoto: number;
let fallaCarga: boolean;

beforeEach(() => {
  lienzos = [];
  anchoFoto = 4000;
  altoFoto = 3000;
  fallaCarga = false;
  ctx = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    lienzos.push(this);
    return ctx as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement) {
    return `data:image/jpeg;base64,GIRADA-${this.width}x${this.height}`;
  });
  class ImagenFalsa {
    width = anchoFoto;
    height = altoFoto;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => (fallaCarga ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", ImagenFalsa);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("girarFoto", () => {
  it("a la derecha: el lienzo queda de pie, gira 90° y devuelve la imagen ya girada", async () => {
    // 4000×3000 se reduce a 1600×1200; girada, el lienzo es 1200×1600.
    const salida = await girarFoto("data:image/jpeg;base64,AAAA", 90);
    expect(lienzos[0].width).toBe(1200);
    expect(lienzos[0].height).toBe(1600);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(salida).toBe("data:image/jpeg;base64,GIRADA-1200x1600");
  });

  it("a la izquierda gira al otro lado", async () => {
    await girarFoto("/api/visita/foto/7", -90);
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 2);
  });

  it("si no se puede leer la imagen, lanza (el llamador deja la foto como estaba)", async () => {
    fallaCarga = true;
    await expect(girarFoto("/api/visita/foto/7", 90)).rejects.toThrow();
  });

  it("al reducir una foto sin giro el lienzo conserva su forma y no rota", async () => {
    await comprimirFoto("data:image/jpeg;base64," + "A".repeat(400_000));
    expect(lienzos[0].width).toBe(1600);
    expect(lienzos[0].height).toBe(1200);
    expect(ctx.rotate).not.toHaveBeenCalled();
  });
});

describe("useGirarFotos", () => {
  function montar(inicial: FotoForm[], alFallar = vi.fn()) {
    return renderHook(() => {
      const [fotos, setFotos] = useState(inicial);
      const girar = useGirarFotos(fotos, setFotos, { alFallar });
      return { fotos, girar };
    });
  }

  it("una foto nueva solo cambia su imagen", async () => {
    const { result } = montar([{ id: 1, src: "data:image/jpeg;base64,AAAA" }]);
    await act(() => result.current.girar(1, 90));
    expect(result.current.fotos[0].src).toBe("data:image/jpeg;base64,GIRADA-1200x1600");
    expect(result.current.fotos[0].girada).toBeUndefined();
  });

  it("una foto ya guardada queda marcada como girada para reemplazar a la del servidor", async () => {
    const { result } = montar([{ id: 1, dbId: 55, src: "/api/visita/foto/55" }]);
    await act(() => result.current.girar(1, -90));
    expect(result.current.fotos[0]).toMatchObject({ dbId: 55, girada: true, src: expect.stringContaining("GIRADA") });
  });

  it("dos toques seguidos no se pisan: el segundo espera a que termine el primero", async () => {
    const { result } = montar([{ id: 1, src: "data:image/jpeg;base64,AAAA" }]);
    await act(async () => {
      void result.current.girar(1, 90);
      void result.current.girar(1, 90);
    });
    await waitFor(() => expect(result.current.fotos[0].src).toContain("GIRADA"));
    expect(ctx.rotate).toHaveBeenCalledTimes(1);
  });

  it("si falla, avisa y no toca la foto", async () => {
    fallaCarga = true;
    const alFallar = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = montar([{ id: 1, src: "data:image/jpeg;base64,AAAA" }], alFallar);
    await act(() => result.current.girar(1, 90));
    expect(alFallar).toHaveBeenCalledTimes(1);
    expect(result.current.fotos[0].src).toBe("data:image/jpeg;base64,AAAA");
  });
});

describe("los botones de girar", () => {
  const foto: FotoForm = { id: 4, src: "data:image/jpeg;base64,AAAA" };

  it("en el celular: cada foto trae girar a la izquierda y a la derecha", async () => {
    const u = userEvent.setup();
    const onGirar = vi.fn();
    render(<GaleriaFotos fotos={[foto]} onQuitar={vi.fn()} onGirar={onGirar} onCamara={vi.fn()} onArchivos={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "Girar la foto a la derecha" }));
    await u.click(screen.getByRole("button", { name: "Girar la foto a la izquierda" }));
    expect(onGirar).toHaveBeenNthCalledWith(1, foto, 90);
    expect(onGirar).toHaveBeenNthCalledWith(2, foto, -90);
  });

  it("en el panel: lo mismo, y una foto guardada que se giró queda marcada", async () => {
    const u = userEvent.setup();
    const onGirar = vi.fn();
    render(
      <Fotos
        titulo="Fotos del trabajo"
        fotos={[{ id: 4, dbId: 55, src: "/api/visita/foto/55", girada: true }]}
        onQuitar={vi.fn()}
        onGirar={onGirar}
        onAgregar={vi.fn()}
        onPegar={vi.fn()}
        onCopiar={vi.fn()}
        copiarA="el comentario interno"
      />
    );
    expect(screen.getByText("Girada")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Girar la foto a la izquierda" }));
    expect(onGirar).toHaveBeenCalledWith(4, -90);
  });
});
