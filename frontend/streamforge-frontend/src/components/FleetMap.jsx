import { useEffect, useRef, useState } from 'react';
import { TOKENS } from '../lib/simulation';

export default function FleetMap({ trucks, tempWarn }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 440 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: 440 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    ctx.strokeStyle = TOKENS.lineSoft;
    ctx.lineWidth = 1;
    for (let x = 0; x < size.w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke(); }
    for (let y = 0; y < size.h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke(); }

    trucks.forEach((tk) => {
      const x = tk.x * size.w, y = tk.y * size.h;
      const color = tk.breach ? TOKENS.red : tk.temp > tempWarn ? TOKENS.amber : TOKENS.cyan;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = tk.breach ? 1 : 0.8;
      ctx.arc(x, y, tk.breach ? 3.4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (tk.breach) {
        ctx.beginPath();
        ctx.strokeStyle = color + '55';
        ctx.lineWidth = 1.5;
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }, [trucks, size, tempWarn]);

  return (
    <div ref={wrapRef} className="fleet-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
