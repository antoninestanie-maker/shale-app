import BenchmarkPanel from "../components/BenchmarkPanel";
import type { AppData } from "../lib/types";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

export default function BenchmarkView({ data, refresh }: Props) {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <header>
        <h1 className="text-3xl text-text">Human Benchmark</h1>
        <p className="mt-1 text-sm text-text-dim">
          Mesure tes réflexes et ta mémoire. Le test de réaction sert aussi de
          contrôle avant de trader (« alcootest »).
        </p>
      </header>

      <ResizableGrid gridId="benchmark" className="mt-4">
        <ResizablePanel id="benchmark-panel" defaultW={12}>
          <BenchmarkPanel data={data} refresh={refresh} />
        </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}
