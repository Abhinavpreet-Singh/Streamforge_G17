import FleetMap from "../components/map/FleetMap";
import { useApp } from "../hooks/useApp";

export default function Fleet() {
  const {
    telemetry,
    selectedTruck,
    setSelectedTruck,
    selectTruckOnMap,
    processorRunning,
  } = useApp();

  const trucks = telemetry?.trucks || [];

  return (
    <div className="flex h-[calc(100vh-80px)]">

      {/* Left Side - Map */}
      <div className="flex-1">
        <FleetMap className="h-full w-full" />
      </div>

      {/* Right Side */}
      <div className="w-96 border-l bg-white overflow-auto">

        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Fleet</h2>

          {!processorRunning && (
            <p className="text-red-500 mt-2">
              Processor isn't running
            </p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Truck</th>
              <th>Temp</th>
              <th>Tumbling</th>
              <th>Hopping</th>
            </tr>
          </thead>

          <tbody>

            {trucks.map((truck) => (
              <tr
                key={truck.truck_id}
                className={`cursor-pointer ${
                  selectedTruck?.truck_id === truck.truck_id
                    ? "bg-blue-100"
                    : ""
                }`}
                onClick={() => {
                  setSelectedTruck(truck);
                  selectTruckOnMap(truck);
                }}
              >
                <td className="p-2">
                  {truck.truck_id}
                </td>

                <td>{truck.temperature?.toFixed?.(1) ?? "-"}</td>

                <td>
                  {truck.tumbling_avg?.toFixed?.(1) ?? "-"}
                </td>

                <td>
                  {truck.hopping_avg?.toFixed?.(1) ?? "-"}
                </td>
              </tr>
            ))}

          </tbody>
        </table>

        {selectedTruck && (
          <div className="p-4 border-t">
            <h3 className="font-bold mb-2">
              Truck Details
            </h3>

            <p>ID : {selectedTruck.truck_id}</p>
            <p>Temperature : {selectedTruck.temperature}</p>
            <p>Tumbling Avg : {selectedTruck.tumbling_avg}</p>
            <p>Hopping Avg : {selectedTruck.hopping_avg}</p>
          </div>
        )}

      </div>
    </div>
  );
}