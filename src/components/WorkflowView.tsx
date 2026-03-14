"use client";

import { useApp } from "@/lib/store";
import { useState, useEffect } from "react";
import { WorkflowNode } from "@/lib/types";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ff4444",
  high: "#ffaa00",
  medium: "#00ff88",
};

const NODE_RADIUS: Record<string, number> = {
  topic: 20,
  subtopic: 12,
  milestone: 16,
};

export default function WorkflowView() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { analysisResult, workflowResult } = state;

  useEffect(() => {
    if (!analysisResult || workflowResult || loading) return;

    const fetchWorkflow = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: analysisResult.topics }),
        });
        if (!res.ok) throw new Error("Failed to generate workflow");
        const result = await res.json();
        dispatch({ type: "SET_WORKFLOW", result });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [analysisResult, workflowResult, loading, dispatch]);

  if (!analysisResult) return null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-accent text-sm animate-pulse">
            GENERATING WORKFLOW...
          </div>
          <p className="font-mono text-muted text-xs mt-2">
            Building optimal study sequence
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-danger text-sm">{error}</p>
          <button
            onClick={() => {
              setError("");
              setLoading(false);
            }}
            className="mt-4 px-4 py-2 border border-accent text-accent font-mono text-xs rounded-lg hover:bg-accent/10"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  if (!workflowResult) return null;

  const { nodes, totalMinutes, milestones } = workflowResult;
  const milestoneMap = new Map(milestones.map((m) => [m.afterNodeId, m.label]));

  const getDependents = (nodeId: string): Set<string> => {
    const deps = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      deps.add(current);
      nodes.forEach((n) => {
        if (n.depends_on.includes(current) && !deps.has(n.id)) {
          queue.push(n.id);
        }
      });
    }
    // Also add dependencies (upstream)
    const findUpstream = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node) {
        node.depends_on.forEach((depId) => {
          if (!deps.has(depId)) {
            deps.add(depId);
            findUpstream(depId);
          }
        });
      }
    };
    findUpstream(nodeId);
    return deps;
  };

  const selectedDeps = selectedNode
    ? getDependents(selectedNode.id)
    : null;

  const svgWidth = 600;
  const nodeSpacing = 80;
  const svgHeight = nodes.length * nodeSpacing + 100;
  const centerX = svgWidth / 2;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-heading text-white text-2xl font-bold">
              Workflow
            </h2>
            <p className="font-mono text-muted text-xs tracking-wider mt-1">
              OPTIMAL STUDY SEQUENCE
            </p>
          </div>
          <div className="font-mono text-sm text-white">
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
          </div>
        </div>

        <div className="flex items-center gap-6 mb-6">
          {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                {key}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rotate-45 border border-accent" style={{ backgroundColor: 'transparent' }} />
            <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
              MILESTONE
            </span>
          </div>
        </div>

        <svg
          width={svgWidth}
          height={svgHeight}
          className="mx-auto"
          style={{ minHeight: svgHeight }}
        >
          {/* Spine line */}
          <line
            x1={centerX}
            y1={40}
            x2={centerX}
            y2={svgHeight - 40}
            stroke="#1e1e1e"
            strokeWidth={2}
          />

          {nodes.map((node, i) => {
            const y = 60 + i * nodeSpacing;
            const radius = NODE_RADIUS[node.type] || 12;
            const color = PRIORITY_COLORS[node.priority] || "#00ff88";
            const isSubtopic = node.type === "subtopic";
            const isMilestone = node.type === "milestone";
            const offsetX = isSubtopic
              ? i % 2 === 0
                ? -80
                : 80
              : 0;
            const nodeX = centerX + offsetX;
            const isSelected = selectedNode?.id === node.id;
            const isDimmed =
              selectedDeps && !selectedDeps.has(node.id);
            const isHovered = hoveredNode === node.id;
            const milestoneLabelAfter = milestoneMap.get(node.id);

            // Draw connection line from spine to offset node
            const connectionLine = isSubtopic ? (
              <line
                x1={centerX}
                y1={y}
                x2={nodeX}
                y2={y}
                stroke={isDimmed ? "#1e1e1e" : "#333"}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            ) : null;

            // Draw arrow from previous node
            const depLine =
              i > 0 ? (
                <line
                  x1={centerX}
                  y1={60 + (i - 1) * nodeSpacing + (NODE_RADIUS[nodes[i - 1].type] || 12)}
                  x2={centerX}
                  y2={y - radius}
                  stroke={isDimmed ? "#1e1e1e" : "#333"}
                  strokeWidth={1}
                  markerEnd={isDimmed ? undefined : "url(#arrow)"}
                />
              ) : null;

            return (
              <g
                key={node.id}
                onClick={() =>
                  setSelectedNode(isSelected ? null : node)
                }
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  cursor: "pointer",
                  opacity: isDimmed ? 0.2 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {depLine}
                {connectionLine}

                {isMilestone ? (
                  <rect
                    x={nodeX - radius}
                    y={y - radius}
                    width={radius * 2}
                    height={radius * 2}
                    transform={`rotate(45 ${nodeX} ${y})`}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                ) : (
                  <circle
                    cx={nodeX}
                    cy={y}
                    r={radius}
                    fill={isSelected ? color : "transparent"}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                )}

                {/* Label */}
                <text
                  x={nodeX + (isSubtopic ? (offsetX > 0 ? radius + 8 : -(radius + 8)) : radius + 10)}
                  y={y - 4}
                  textAnchor={isSubtopic && offsetX < 0 ? "end" : "start"}
                  fill={isDimmed ? "#333" : "#fff"}
                  fontSize={11}
                  fontFamily="IBM Plex Mono"
                >
                  {node.label}
                </text>

                {/* Duration + complexity */}
                <text
                  x={nodeX + (isSubtopic ? (offsetX > 0 ? radius + 8 : -(radius + 8)) : radius + 10)}
                  y={y + 12}
                  textAnchor={isSubtopic && offsetX < 0 ? "end" : "start"}
                  fill={isDimmed ? "#1e1e1e" : "#666"}
                  fontSize={9}
                  fontFamily="IBM Plex Mono"
                >
                  {node.duration}min • C:{node.complexity}
                </text>

                {/* Milestone label */}
                {milestoneLabelAfter && (
                  <g>
                    <line
                      x1={centerX - 120}
                      y1={y + nodeSpacing / 2}
                      x2={centerX + 120}
                      y2={y + nodeSpacing / 2}
                      stroke="#00ff88"
                      strokeWidth={1}
                      strokeDasharray="2,4"
                    />
                    <text
                      x={centerX}
                      y={y + nodeSpacing / 2 - 6}
                      textAnchor="middle"
                      fill="#00ff88"
                      fontSize={10}
                      fontFamily="IBM Plex Mono"
                    >
                      ◆ {milestoneLabelAfter}
                    </text>
                  </g>
                )}

                {/* Tooltip on hover */}
                {isHovered && !isDimmed && (
                  <g>
                    <rect
                      x={nodeX + radius + 20}
                      y={y - 30}
                      width={200}
                      height={40}
                      rx={4}
                      fill="#141414"
                      stroke="#1e1e1e"
                    />
                    <text
                      x={nodeX + radius + 28}
                      y={y - 12}
                      fill="#fff"
                      fontSize={10}
                      fontFamily="IBM Plex Mono"
                    >
                      {node.label}
                    </text>
                    <text
                      x={nodeX + radius + 28}
                      y={y + 2}
                      fill="#666"
                      fontSize={9}
                      fontFamily="IBM Plex Mono"
                    >
                      {node.duration}min • {node.priority} • C:{node.complexity}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX={10}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#333" />
            </marker>
          </defs>

          {/* Estimated completion */}
          <text
            x={centerX}
            y={svgHeight - 15}
            textAnchor="middle"
            fill="#666"
            fontSize={10}
            fontFamily="IBM Plex Mono"
          >
            ESTIMATED COMPLETION: {Math.floor(totalMinutes / 60)}H{" "}
            {totalMinutes % 60}M
          </text>
        </svg>
      </div>

      {/* Right panel: selected node detail */}
      {selectedNode && (
        <div className="w-80 border-l border-border bg-surface p-6 overflow-auto">
          <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-3">
            NODE DETAIL
          </div>
          <h3 className="font-heading text-white text-lg font-bold mb-4">
            {selectedNode.label}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">TYPE</span>
              <span className="font-mono text-xs text-white uppercase">
                {selectedNode.type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">DURATION</span>
              <span className="font-mono text-xs text-white">
                {selectedNode.duration} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">COMPLEXITY</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }, (_, j) => (
                  <div
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${
                      j < selectedNode.complexity ? "bg-accent" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">PRIORITY</span>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded border"
                style={{
                  color: PRIORITY_COLORS[selectedNode.priority],
                  borderColor: PRIORITY_COLORS[selectedNode.priority] + "44",
                }}
              >
                {selectedNode.priority.toUpperCase()}
              </span>
            </div>

            {selectedNode.depends_on.length > 0 && (
              <div>
                <span className="font-mono text-[10px] tracking-[0.15em] text-muted">
                  DEPENDS ON
                </span>
                <div className="mt-2 space-y-1">
                  {selectedNode.depends_on.map((depId) => {
                    const dep = nodes.find((n) => n.id === depId);
                    return dep ? (
                      <div
                        key={depId}
                        className="font-mono text-xs text-white/70"
                      >
                        → {dep.label}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {analysisResult?.flashcards && (
              <div>
                <span className="font-mono text-[10px] tracking-[0.15em] text-muted">
                  RELATED FLASHCARDS
                </span>
                <div className="mt-2 space-y-2">
                  {analysisResult.flashcards
                    .filter((f) =>
                      f.front
                        .toLowerCase()
                        .includes(selectedNode.label.toLowerCase().split(" ")[0])
                    )
                    .slice(0, 3)
                    .map((f, i) => (
                      <div
                        key={i}
                        className="p-2 bg-bg border border-border rounded text-xs font-mono text-muted"
                      >
                        {f.front}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
