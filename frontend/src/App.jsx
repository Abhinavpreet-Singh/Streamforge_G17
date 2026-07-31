import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

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
  const [flowNodes, setFlowNodes] = useState([]);
  const [flowEdges, setFlowEdges] = useState([]);

  const [throughputHistory, setThroughputHistory] = useState([]);

  const [currentRate, setCurrentRate] = useState(0);
  const [history, setHistory] = useState([]);
  useEffect(() => {
  console.log("History updated:", history);
   }, [history]);


  // Fetch topology

  useEffect(() => {

    axios
      .get("http://127.0.0.1:8000/topology")
      .then((response)=> {

      const data = response.data;

      setTopology(data);


      const convertedNodes =
      data.dag.nodes.map((node,index)=>({

      id: node.id,

      position:{
      x:250,
      y:index*100
      },

      data:{
      label:node.label
      },

      style:nodeStyle

      }));


      const convertedEdges =
      data.dag.edges.map((edge,index)=>({

      id:`e${index}`,

      source:edge.source,

      target:edge.target

     }));


     setFlowNodes(convertedNodes);
     setFlowEdges(convertedEdges);


      })
       .catch((error)=>{
        console.log("Topology error:", error);
       });
      },[]);



  // WebSocket live metrics

  useEffect(() => {


    const ws = new WebSocket(
      "ws://127.0.0.1:8000/ws/live"
    );


    ws.onopen = () => {
      console.log("WebSocket connected");
    };



    ws.onmessage = (event) => {


      try {


        const message = JSON.parse(event.data);
        const data = message.data || message;
        console.log("WS DATA:", data);
        const newPoint = {
        time: new Date().toLocaleTimeString(),
        ingestion: data.ingestion_rate,
        filtered: data.filter_rate
       };
       setHistory(prev => [...prev, newPoint].slice(-60));
       

        if(data.ingestion_rate !== undefined)
        {


          setCurrentRate(
            data.ingestion_rate
          );



          setThroughputHistory(prev => [

            ...prev,

            {

              time:
                new Date()
                .toLocaleTimeString(),

              ingestion:
                data.ingestion_rate,


              filtered:
                data.filter_rate || 0

            }

          ].slice(-60));


        }



      }

      catch(error){

        console.log(
          "WS parse error",
          error
        );

      }


    };



    ws.onerror = (error)=>{
      console.log(
        "WebSocket error",
        error
      );
    };



    ws.onclose = ()=>{
      console.log(
        "WebSocket closed"
      );
    };



    return ()=>{

      ws.close();

    };


  }, []);






  return (

    <div
      style={{
        width:"100vw",
        height:"100vh",
        overflow:"auto"
      }}
    >



      <div
        style={{
          padding:"10px",
          background:"#222",
          color:"white",
          fontSize:"18px",
          fontWeight:"bold"
        }}
      >

        Status:
        {" "}
        {topology?.status?.length ?? 0}


        {" | "}


        Kafka:


        {" "}

        {
          topology?.status === "active"
          ?
          "Active ✅"
          :
          "Inactive ❌"
        }
        { " | "}
        Pipeline Nodes:
        {" "}
        {
          topology?.dag?.nodes?.length ?? 0
     }


      
      </div>


      {/* PASTE THE CHART HERE 👇 */}

      <div style={{ width:"100%", height:300 }}>

        <h2>Live Throughput</h2>

        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={history}>

            <CartesianGrid />

            <XAxis dataKey="time" />

            <YAxis />

            <Tooltip />

            <Line 
              type="monotone"
              dataKey="ingestion"
            />

            <Line 
              type="monotone"
              dataKey="filtered"
            />

          </LineChart>

        </ResponsiveContainer>

      </div>





      {/* Throughput Card */}


      <div
        style={{
          margin:"15px",
          padding:"20px",
          background:"#f5f5f5",
          borderRadius:"10px"
        }}
      >

        <h2>
          Live Throughput
        </h2>


        <h1>
          {currentRate}
          {" "}
          events/sec
        </h1>



        <div
          style={{
            width:"100%",
            height:"300px"
          }}
        >


        <ResponsiveContainer>


        <AreaChart
          data={throughputHistory}
        >


          <CartesianGrid
            strokeDasharray="3 3"
          />


          <XAxis
            dataKey="time"
          />


          <YAxis />


          <Tooltip />



          <Area

            type="monotone"

            dataKey="ingestion"

            name="Ingestion Rate"

            stroke="#8884d8"

            fill="#8884d8"

          />



          <Area

            type="monotone"

            dataKey="filtered"

            name="Filtered Rate"

            stroke="#82ca9d"

            fill="#82ca9d"

          />



        </AreaChart>


        </ResponsiveContainer>


        </div>



      </div>







      {/* React Flow topology */}


      <div
        style={{
          width:"100%",
          height:"600px"
        }}
      >

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
        />

      </div>



    </div>


  );

}



export default App;