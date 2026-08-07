import FleetMap from '../components/map/FleetMap';
import PageLayout from '../components/layout/PageLayout';
import { useApp } from '../hooks/useApp';

function formatTemp(value) {
  if (value === undefined || value === null) return '—';
  return `${Number(value).toFixed(1)}°C`;
}

export default function Fleet() {
  const {
    animatedTrucks,
    selectedTruck,
    processorRunning,
    telemetry,
    selectTruckOnMap,
    setSelectedTruck,
  } = useApp();

  const trucks = animatedTrucks.length > 0 ? animatedTrucks : telemetry.trucks;

  const handleRowClick = (truck) => {
    setSelectedTruck(truck);
    if (truck.coords) selectTruckOnMap(truck);
  };

  return (
    <PageLayout className="bg-white">
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0">
          <FleetMap className="h-full" />
        </div>

        <aside className="w-full max-w-md lg:w-96 shrink-0 border-l border-neutral-200 flex flex-col min-h-0 bg-white">
          <div className="p-4 border-b border-neutral-100 shrink-0">
            <p className="text-xs font-mono text-neutral-400">
              {trucks.length} active truck{trucks.length === 1 ? '' : 's'}
            </p>
            {!processorRunning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mt-2">
                Start the stream processor to see window averages.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-neutral-50 text-neutral-500 sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium">Truck</th>
                  <th className="p-2 text-left font-medium">Temp</th>
                  <th className="p-2 text-left font-medium">Tumble</th>
                  <th className="p-2 text-left font-medium">Hop</th>
                </tr>
              </thead>
              <tbody>
                {trucks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-neutral-400">
                      Waiting for truck readings…
                    </td>
                  </tr>
                ) : (
                  trucks.map((truck) => {
                    const selected = selectedTruck?.truck_id === truck.truck_id;
                    const anomalous = truck.last_temperature > 42;
                    return (
                      <tr
                        key={truck.truck_id}
                        onClick={() => handleRowClick(truck)}
                        className={`cursor-pointer border-t border-neutral-100 ${
                          selected ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                        } ${anomalous ? 'text-rose-700' : 'text-neutral-800'}`}
                      >
                        <td className="p-2 font-semibold">#{truck.truck_id}</td>
                        <td className="p-2">{formatTemp(truck.last_temperature)}</td>
                        <td className="p-2">{formatTemp(truck.tumbling_avg)}</td>
                        <td className="p-2">{formatTemp(truck.hopping_avg)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedTruck && (
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 shrink-0">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">
                Truck #{selectedTruck.truck_id}
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <dt className="text-neutral-400">Temperature</dt>
                  <dd>{formatTemp(selectedTruck.last_temperature)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Status</dt>
                  <dd>{selectedTruck.last_temperature > 42 ? 'Anomaly' : 'Healthy'}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Tumbling avg</dt>
                  <dd>{formatTemp(selectedTruck.tumbling_avg)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Hopping avg</dt>
                  <dd>{formatTemp(selectedTruck.hopping_avg)}</dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </main>
    </PageLayout>
  );
}
