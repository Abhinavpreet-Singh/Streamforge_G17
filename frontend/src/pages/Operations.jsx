import ChaosPanel from "../components/chaos/ChaosPanel";

export default function Operations() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Operations Dashboard
      </h1>

      <p className="text-gray-600">
        Monitor workers and perform chaos testing.
      </p>

      <ChaosPanel />
    </div>
  );
}