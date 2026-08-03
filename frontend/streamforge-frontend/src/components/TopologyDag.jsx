import { useMemo } from 'react';
import ReactFlow, { Background, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { TOKENS, statusColor } from '../lib/simulation';

const nodeBase = {
  style: {
    background: TOKENS.bgPanelRaised,
    border: `1px solid ${TOKENS.line}`,
    borderRadius: 8,
    color: TOKENS.text1,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    padding: '8px 10px',
  },
};

export default function TopologyDag({ workers, height = 460 }) {
  const { nodes, edges } = useMemo(() => {
    const cols = Math.min(8, Math.ceil(Math.sqrt(workers.length * 1.6)));
    const colGap = 130, rowGap = 90;
    const gridWidth = colGap * (cols - 1);
    const topicX = gridWidth / 2 + 60;

    const nodes = [
      {
        id: 'topic',
        position: { x: topicX - 90, y: 0 },
        data: { label: <div><div style={{ fontWeight: 700 }}>truck-telemetry</div><div style={{ color: TOKENS.text3, fontSize: 9.5 }}>32 partitions · Avro + Schema Registry</div></div> },
        ...nodeBase,
        style: { ...nodeBase.style, width: 220 },
      },
      ...workers.map((w, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const c = statusColor(w.status);
        return {
          id: w.id,
          position: { x: 60 + col * colGap, y: 130 + row * rowGap },
          data: { label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />{w.id.replace('Worker-', 'w')}</div> },
          ...nodeBase,
          style: { ...nodeBase.style, border: `1px solid ${c}`, width: 92 },
        };
      }),
      {
        id: 'store',
        position: { x: topicX - 100, y: 130 + Math.ceil(workers.length / cols) * rowGap + 40 },
        data: { label: <div><div style={{ fontWeight: 700 }}>RocksDB state store</div><div style={{ color: TOKENS.text3, fontSize: 9.5 }}>rolling avg per truck</div></div> },
        ...nodeBase,
        style: { ...nodeBase.style, border: `1px solid ${TOKENS.violet}`, width: 220 },
      },
      {
        id: 'sink',
        position: { x: topicX - 70, y: 130 + Math.ceil(workers.length / cols) * rowGap + 140 },
        data: { label: <div><div style={{ fontWeight: 700 }}>changelog topic</div><div style={{ color: TOKENS.text3, fontSize: 9.5 }}>recovery source of truth</div></div> },
        ...nodeBase,
        style: { ...nodeBase.style, width: 180 },
      },
    ];

    const edges = [
      ...workers.map((w) => ({
        id: `topic-${w.id}`,
        source: 'topic',
        target: w.id,
        animated: w.status === 'healthy',
        style: { stroke: w.status === 'failed' ? TOKENS.red : TOKENS.line, strokeDasharray: w.status === 'failed' ? '4 4' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: w.status === 'failed' ? TOKENS.red : TOKENS.text3, width: 14, height: 14 },
      })),
      ...workers.map((w) => ({
        id: `${w.id}-store`,
        source: w.id,
        target: 'store',
        animated: w.status === 'healthy',
        style: { stroke: TOKENS.line },
      })),
      {
        id: 'store-sink',
        source: 'store',
        target: 'sink',
        animated: true,
        style: { stroke: TOKENS.cyan },
        markerEnd: { type: MarkerType.ArrowClosed, color: TOKENS.cyan, width: 14, height: 14 },
      },
    ];

    return { nodes, edges };
  }, [workers]);

  return (
    <div style={{ height, background: TOKENS.bgInset, borderRadius: 10, border: `1px solid ${TOKENS.lineSoft}` }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background color={TOKENS.lineSoft} gap={24} />
      </ReactFlow>
    </div>
  );
}
