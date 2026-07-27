import { useEffect, useState } from "react";
import axios from "axios";
import { ReactFlow } from "reactflow";
import "reactflow/dist/style.css";

const nodeStyle = {
  background: "#90EE90",
  border: "2px solid green",
  borderRadius: "8px",
  padding: "10px",
};

const nodes = [
  {
    id: "1",
    position: { x: 250, y: 20 },
    data: { label: "Producer" },
    style: nodeStyle,
  },
  {
    id: "2",
    position: { x: 250, y: 120 },
    data: { label: "Kafka (truck-telemetry)" },
    style: nodeStyle,
  },
  {
    id: "3",
    position: { x: 250, y: 220 },
    data: { label: "Dedup" },
    style: nodeStyle,
  },
  {
    id: "4",
    position: { x: 250, y: 320 },
    data: { label: "Filter / Map" },
    style: nodeStyle,
  },
  {
    id: "5",
    position: { x: 250, y: 420 },
    data: { label: "Windows" },
    style: nodeStyle,
  },
  {
    id: "6",
    position: { x: 250, y: 520 },
    data: { label: "RocksDB Store" },
    style: nodeStyle,
  },
  {
    id: "7",
    position: { x: 250, y: 620 },
    data: { label: "Truck Averages" },
    style: nodeStyle,
  },
];

const edges = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e2-3", source: "2", target: "3" },
  { id: "e3-4", source: "3", target: "4" },
  { id: "e4-5", source: "4", target: "5" },
  { id: "e5-6", source: "5", target: "6" },
  { id: "e6-7", source: "6", target: "7" },
];

function App() {
  const [topology, setTopology] = useState(null);

  useEffect(() => {
    const fetchTopology = () => {
      axios
        .get("http://127.0.0.1:8000/topology")
        .then((response) => {
          console.log(response.data);
          setTopology(response.data);
        })
        .catch((error) => {
          console.error(error);
        });
    };

    fetchTopology();

    const interval = setInterval(fetchTopology, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div
        style={{
          padding: "10px",
          background: "#222",
          color: "white",
          fontSize: "18px",
          fontWeight: "bold",
        }}
      >
        Workers: {topology ? topology.workers.length : 0}
        {" | "}
        Kafka: {topology?.kafka_connected ? "Connected ✅" : "Disconnected ❌"}
      </div>

      <div style={{ width: "100%", height: "90%" }}>
        <ReactFlow nodes={nodes} edges={edges} fitView />
      </div>
    </div>
  );
}

export default App;