"use client";

import { useExams } from "@/lib/exam-context";
import ExamSwitcher from "./ExamSwitcher";
import { useState, useEffect } from "react";
import { WorkflowNode } from "@/lib/types";

const PRIORITY_COLORS: Record<string, string> = { critical: "#ff4444", high: "#ffaa00", medium: "#00ff88" };
const NODE_RADIUS: Record<string, number> = { topic: 20, subtopic: 12, milestone: 16 };

export default function WorkflowView() {
  const { currentExam, setWorkflow } = useExams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!currentExam || currentExam.topics.length === 0 || currentExam.workflowResult || loading) return;
    const fetchWorkflow = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics: currentExam.topics }) });
        if (!res.ok) throw new Error("Failed");
        setWorkflow(currentExam.id, await res.json());
      } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
      finally { setLoading(false); }
    };
    fetchWorkflow();
  }, [currentExam, loading, setWorkflow]);

  if (!currentExam || currentExam.topics.length === 0) {
    return (<div className="flex-1 flex flex-col"><ExamSwitcher /><div className="flex-1 flex items-center justify-center"><p className="font-mono text-muted text-sm">Upload study material first.</p></div></div>);
  }
  if (loading) {
    return (<div className="flex-1 flex flex-col"><ExamSwitcher /><div className="flex-1 flex items-center justify-center"><div className="font-mono text-accent text-sm animate-pulse">GENERATING WORKFLOW...</div></div></div>);
  }
  if (error) {
    return (<div className="flex-1 flex flex-col"><ExamSwitcher /><div className="flex-1 flex items-center justify-center"><div className="text-center"><p className="font-mono text-danger text-sm">{error}</p><button onClick={() => { setError(""); setLoading(false); }} className="mt-4 px-4 py-2 border border-accent text-accent font-mono text-xs rounded-lg hover:bg-accent/10">RETRY</button></div></div></div>);
  }

  const wf = currentExam.workflowResult;
  if (!wf) return null;
  const { nodes, totalMinutes, milestones } = wf;
  const milestoneMap = new Map(milestones.map((m) => [m.afterNodeId, m.label]));

  const getDeps = (nodeId: string): Set<string> => {
    const deps = new Set<string>();
    const q = [nodeId];
    while (q.length > 0) { const c = q.shift()!; deps.add(c); nodes.forEach((n) => { if (n.depends_on.includes(c) && !deps.has(n.id)) q.push(n.id); }); }
    const up = (id: string) => { const n = nodes.find((x) => x.id === id); if (n) n.depends_on.forEach((d) => { if (!deps.has(d)) { deps.add(d); up(d); } }); };
    up(nodeId);
    return deps;
  };

  const selDeps = selectedNode ? getDeps(selectedNode.id) : null;
  const W = 600, SP = 80, H = nodes.length * SP + 100, CX = W / 2;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ExamSwitcher />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="font-heading text-white text-2xl font-bold">Workflow</h2><p className="font-mono text-muted text-xs tracking-wider mt-1">OPTIMAL STUDY SEQUENCE</p></div>
            <div className="font-mono text-sm text-white">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total</div>
          </div>
          <div className="flex items-center gap-6 mb-6">
            {Object.entries(PRIORITY_COLORS).map(([k, c]) => (<div key={k} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} /><span className="font-mono text-[10px] tracking-wider text-muted uppercase">{k}</span></div>))}
          </div>
          <svg width={W} height={H} className="mx-auto" style={{ minHeight: H }}>
            <line x1={CX} y1={40} x2={CX} y2={H - 40} stroke="#1e1e1e" strokeWidth={2} />
            {nodes.map((node, i) => {
              const y = 60 + i * SP, r = NODE_RADIUS[node.type] || 12, color = PRIORITY_COLORS[node.priority] || "#00ff88";
              const isSub = node.type === "subtopic", isMil = node.type === "milestone";
              const ox = isSub ? (i % 2 === 0 ? -80 : 80) : 0, nx = CX + ox;
              const isSel = selectedNode?.id === node.id, dim = selDeps && !selDeps.has(node.id), hov = hoveredNode === node.id;
              const ml = milestoneMap.get(node.id);
              return (
                <g key={node.id} onClick={() => setSelectedNode(isSel ? null : node)} onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer", opacity: dim ? 0.2 : 1, transition: "opacity 0.2s" }}>
                  {i > 0 && <line x1={CX} y1={60 + (i - 1) * SP + (NODE_RADIUS[nodes[i - 1].type] || 12)} x2={CX} y2={y - r} stroke={dim ? "#1e1e1e" : "#333"} strokeWidth={1} />}
                  {isSub && <line x1={CX} y1={y} x2={nx} y2={y} stroke={dim ? "#1e1e1e" : "#333"} strokeWidth={1} strokeDasharray="4,4" />}
                  {isMil ? <rect x={nx - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${nx} ${y})`} fill="transparent" stroke={color} strokeWidth={isSel ? 3 : 2} />
                    : <circle cx={nx} cy={y} r={r} fill={isSel ? color : "transparent"} stroke={color} strokeWidth={isSel ? 3 : 2} />}
                  <text x={nx + (isSub ? (ox > 0 ? r + 8 : -(r + 8)) : r + 10)} y={y - 4} textAnchor={isSub && ox < 0 ? "end" : "start"} fill={dim ? "#333" : "#fff"} fontSize={11} fontFamily="IBM Plex Mono">{node.label}</text>
                  <text x={nx + (isSub ? (ox > 0 ? r + 8 : -(r + 8)) : r + 10)} y={y + 12} textAnchor={isSub && ox < 0 ? "end" : "start"} fill={dim ? "#1e1e1e" : "#666"} fontSize={9} fontFamily="IBM Plex Mono">{node.duration}min • C:{node.complexity}</text>
                  {ml && <g><line x1={CX - 120} y1={y + SP / 2} x2={CX + 120} y2={y + SP / 2} stroke="#00ff88" strokeWidth={1} strokeDasharray="2,4" /><text x={CX} y={y + SP / 2 - 6} textAnchor="middle" fill="#00ff88" fontSize={10} fontFamily="IBM Plex Mono">◆ {ml}</text></g>}
                  {hov && !dim && <g><rect x={nx + r + 20} y={y - 30} width={200} height={40} rx={4} fill="#141414" stroke="#1e1e1e" /><text x={nx + r + 28} y={y - 12} fill="#fff" fontSize={10} fontFamily="IBM Plex Mono">{node.label}</text><text x={nx + r + 28} y={y + 2} fill="#666" fontSize={9} fontFamily="IBM Plex Mono">{node.duration}min • {node.priority}</text></g>}
                </g>);
            })}
            <defs><marker id="arrow" viewBox="0 0 10 10" refX={10} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333" /></marker></defs>
            <text x={CX} y={H - 15} textAnchor="middle" fill="#666" fontSize={10} fontFamily="IBM Plex Mono">EST: {Math.floor(totalMinutes / 60)}H {totalMinutes % 60}M</text>
          </svg>
        </div>
        {selectedNode && (
          <div className="w-80 border-l border-border bg-surface p-6 overflow-auto">
            <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-3">NODE DETAIL</div>
            <h3 className="font-heading text-white text-lg font-bold mb-4">{selectedNode.label}</h3>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="font-mono text-xs text-muted">TYPE</span><span className="font-mono text-xs text-white uppercase">{selectedNode.type}</span></div>
              <div className="flex justify-between"><span className="font-mono text-xs text-muted">DURATION</span><span className="font-mono text-xs text-white">{selectedNode.duration} min</span></div>
              <div className="flex justify-between"><span className="font-mono text-xs text-muted">PRIORITY</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded border" style={{ color: PRIORITY_COLORS[selectedNode.priority], borderColor: PRIORITY_COLORS[selectedNode.priority] + "44" }}>{selectedNode.priority.toUpperCase()}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
