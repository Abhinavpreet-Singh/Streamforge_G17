import { Handle, Position } from 'reactflow';
import { Activity, Cpu, Filter, Layers, Database, Radio, CheckCircle } from 'lucide-react';

const iconMap = {
  input: Radio,
  process: Cpu,
  filter: Filter,
  window: Layers,
  storage: Database,
  output: CheckCircle,
};

export default function PipelineNode({ data }) {
  const Icon = iconMap[data.type] || Activity;
  const isHealthy = data.status !== 'crashed';
  
  return (
    <div className={`px-4 py-3 bg-white border rounded-lg shadow-sm w-56 font-sans transition-all duration-300 ${
      isHealthy ? 'border-neutral-200 hover:border-neutral-400' : 'border-rose-300 bg-rose-50/30'
    }`}>
      {data.type !== 'input' && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 !bg-neutral-400 border-none"
        />
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-md ${
          isHealthy ? 'bg-neutral-100 text-neutral-800' : 'bg-rose-100 text-rose-600'
        }`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-900 truncate">{data.label}</p>
          <p className="text-[10px] text-neutral-500 font-mono">
            {isHealthy ? 'Active' : 'Offline / Interrupted'}
          </p>
        </div>
        <div className={`w-2 h-2 rounded-full ${
          isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
        }`} />
      </div>

      <div className="border-t border-neutral-100 pt-2 mt-2 font-mono text-[11px] text-neutral-600 flex flex-col gap-1">
        {data.metricName && (
          <div className="flex justify-between">
            <span>{data.metricName}:</span>
            <span className="font-bold text-neutral-900">{data.metricValue || '0'}</span>
          </div>
        )}
        {data.subMetricName && (
          <div className="flex justify-between text-neutral-500">
            <span>{data.subMetricName}:</span>
            <span>{data.subMetricValue || '0'}</span>
          </div>
        )}
      </div>

      {data.type !== 'output' && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 !bg-neutral-400 border-none"
        />
      )}
    </div>
  );
}
