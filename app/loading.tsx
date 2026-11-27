// Raíz: solo redirige al panel que corresponde. Fondo del sistema, sin texto.
export default function Loading() {
  return <div className="min-h-screen" style={{ background: "#f6f3f8" }} role="status" aria-busy="true" aria-label="Abriendo el sistema" />;
}
