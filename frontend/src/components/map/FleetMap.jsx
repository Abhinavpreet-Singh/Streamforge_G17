import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../hooks/useApp';

function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function FleetMap({ className = '' }) {
  const {
    mapCenter,
    mapZoom,
    animatedTrucks,
    selectedTruck,
    telemetry,
    tumbleLabel,
    selectTruckOnMap,
    resetMapView,
  } = useApp();

  return (
    <div className={`flex flex-col min-h-0 bg-white ${className}`}>
      <div className="p-3 border-b border-neutral-200 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <MapPin size={16} />
          <div>
            <h2 className="text-sm font-semibold">Fleet Map</h2>
            <p className="text-[10px] text-neutral-400 font-mono">
              {animatedTrucks.some((t) => t.gpsSource === 'kafka')
                ? 'Live GPS from Kafka telemetry'
                : 'Simulated routes until GPS arrives'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetMapView}
          className="text-[10px] font-mono px-2 py-1 bg-neutral-100 border border-neutral-200 rounded flex items-center gap-1"
        >
          <RefreshCw size={10} /> Reset
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <ChangeMapView center={mapCenter} zoom={mapZoom} />
          {animatedTrucks.map((truck) => {
            const sel = selectedTruck?.truck_id === truck.truck_id;
            return (
              <CircleMarker
                key={truck.truck_id}
                center={truck.coords}
                radius={sel ? 12 : truck.isAnomalous ? 10 : 6}
                fillColor={truck.isAnomalous ? '#f43f5e' : '#10b981'}
                color={sel ? '#2563eb' : truck.isAnomalous ? '#be123c' : '#047857'}
                weight={sel ? 3 : 2}
                fillOpacity={0.7}
                eventHandlers={{ click: () => selectTruckOnMap(truck) }}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    <b>Truck #{truck.truck_id}</b>
                    <div className="font-mono mt-1">{truck.last_temperature?.toFixed(2)} °C</div>
                    <div className="font-mono text-neutral-500">
                      Tumble: {truck.tumbling_avg != null ? truck.tumbling_avg.toFixed(2) : `pending (${tumbleLabel})`}
                    </div>
                    <div className="font-mono text-neutral-500">
                      Hop: {truck.hopping_avg != null ? truck.hopping_avg.toFixed(2) : 'pending'}
                    </div>
                    {truck.fuel_level != null && (
                      <div className="font-mono text-neutral-500">Fuel: {Number(truck.fuel_level).toFixed(0)}%</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="p-2 border-t text-[10px] font-mono text-neutral-500 flex justify-between shrink-0">
        <span>Active trucks: {telemetry.trucks.length}</span>
        <span className="text-emerald-600">● healthy</span>
        <span className="text-rose-500">● anomaly &gt;42°C</span>
      </div>
    </div>
  );
}
