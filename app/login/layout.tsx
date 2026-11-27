import { FUENTES } from "../fuentes";
import "./login.css";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={FUENTES}>{children}</div>;
}
