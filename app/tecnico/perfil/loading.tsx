import { MarcoTecnico } from "@/components/ui/esqueletos";
import { Sk } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <MarcoTecnico>
      <div className="tp-main" role="status" aria-busy="true" aria-label="Mi cuenta">
        <Sk w={150} h={30} r={8} />
        <Sk h={120} r={16} />
        <Sk h={220} r={16} />
        <Sk h={160} r={16} />
      </div>
    </MarcoTecnico>
  );
}
