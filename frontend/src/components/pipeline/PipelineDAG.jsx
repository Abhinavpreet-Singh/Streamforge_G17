import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { Cpu } from 'lucide-react';
import PipelineNode from '../PipelineNode';
import { useApp } from '../../hooks/useApp';

const nodeTypes = { pipelineNode: PipelineNode };

export default function PipelineDAG({ className = '' }) {
  const { pipelineNodes, pipelineEdges } = useApp();

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="p-3 border-b border-neutral-100 flex items-center gap-2 shrink-0">
        <Cpu size={16} />
        <h2 className="text-sm font-semibold">Stream DAG</h2>
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={pipelineNodes}
          edges={pipelineEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.15}
        >
          <Background variant="dots" gap={16} size={1} color="#e5e5e5" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
