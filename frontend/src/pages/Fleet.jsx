import FleetMap from '../components/map/FleetMap';
import PageLayout from '../components/layout/PageLayout';
import { useApp } from '../hooks/useApp';

function formatTemp(value) {
  if (value === undefined || value === null) return '—';
  return `${Number(value).toFixed(1)}°C`;
}

function formatFuel(value) {
  if (value === undefined || value === null) return '—';
  return `${Number(value).toFixed(0)}%`;
}

export default function Fleet() {
  const {
    animatedTrucks,
    selectedTruck,
    processorRunning,
    telemetry,
    selectTruckOnMap,
    setSelectedTruck,
    navigateTo,
  } = useApp();

  const trucks = animatedTrucks.length > 0 ? animatedTrucks : telemetry.trucks;

  const handleRowClick = (truck) => {
    setSelectedTruck(truck);
    selectTruckOnMap(truck);
  };

  return (
    <PageLayout className="bg-white">
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0">
          <FleetMap className="h-full" />
        </div>

        <aside className="w-full max-w-md lg:w-96 shrink-0 border-l border-neutral-200 flex flex-col min-h-0 bg-neutral-50">
          <div className="p-4 border-b border-neutral-200 bg-white shrink-0">
            <h2 className="text-sm font-semibold text-neutral-900">Fleet roster</h2>
            <p className="text-[10px] font-mono text-neutral-400 mt-1">
              {trucks.length} active truck{trucks.length === 1 ? '' : 's'}
            </p>
            {!processorRunning && (
              <div className="mt-2 rounded border border-amber-100 bg-amber-50 px-2 py-1.5 flex items-center justify-between gap-2">
                <p className="text-xs text-amber-700">Start the processor to see window averages.</p>
                <button
                  type="button"
                  onClick={() => navigateTo('operations')}
                  className="text-[10px] font-medium px-2 py-1 rounded bg-neutral-900 text-white shrink-0"
                >
                  Operations
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-xs font-mono">
              <thead className="bg-neutral-50 text-neutral-500 sticky top-0">
                <tr>
                  <th className="p-2.5 text-left font-medium">Truck</th>
                  <th className="p-2.5 text-left font-medium">Temp</th>
                  <th className="p-2.5 text-left font-medium">Tumble</th>
                  <th className="p-2.5 text-left font-medium">Hop</th>
                </tr>
              </thead>
              <tbody>
                {trucks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-400">
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
                        <td className="p-2.5 font-semibold">#{truck.truck_id}</td>
                        <td className="p-2.5">{formatTemp(truck.last_temperature)}</td>
                        <td className="p-2.5">{formatTemp(truck.tumbling_avg)}</td>
                        <td className="p-2.5">{formatTemp(truck.hopping_avg)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedTruck && (
            <div className="p-4 border-t border-neutral-200 bg-white shrink-0">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">
                Truck #{selectedTruck.truck_id}
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <dt className="text-neutral-400">Temperature</dt>
                  <dd className="text-neutral-900 mt-0.5">{formatTemp(selectedTruck.last_temperature)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Status</dt>
                  <dd className="mt-0.5">
                    {selectedTruck.last_temperature > 42 ? (
                      <span className="text-rose-600">Anomaly</span>
                    ) : (
                      <span className="text-emerald-600">Healthy</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Tumbling avg</dt>
                  <dd className="text-neutral-900 mt-0.5">{formatTemp(selectedTruck.tumbling_avg)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Hopping avg</dt>
                  <dd className="text-neutral-900 mt-0.5">{formatTemp(selectedTruck.hopping_avg)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Fuel</dt>
                  <dd className="text-neutral-900 mt-0.5">{formatFuel(selectedTruck.fuel_level)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">GPS</dt>
                  <dd className="text-neutral-900 mt-0.5">
                    {selectedTruck.latitude != null && selectedTruck.longitude != null
                      ? `${Number(selectedTruck.latitude).toFixed(3)}, ${Number(selectedTruck.longitude).toFixed(3)}`
                      : selectedTruck.gpsSource === 'simulated'
                        ? 'simulated'
                        : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </main>
    </PageLayout>
  );
}
