"use client";

import { useExams } from "@/lib/exam-context";
import ExamSwitcher from "./ExamSwitcher";
import { useState, useEffect, useMemo } from "react";
import { WorkflowNode } from "@/lib/types";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ff4444",
  high: "#ffaa00",
  medium: "#00ff88",
};

// Commit tree layout constants
const SPINE_X = 300; // Center spine X position
const NODE_R_TOPIC = 10; // Topic circle radius (20px diameter)
const NODE_R_SUB = 6; // Subtopic circle radius (12px diameter)
const V_STEP = 80; // Vertical step between spine nodes
const BRANCH_X = 140; // Horizontal offset for subtopic branches
const MILESTONE_W = 500; // Milestone diamond label width
const PAD_TOP = 60;

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
        const res = await fetch("/api/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: currentExam.topics }),
        });
        if (!res.ok) throw new Error("Failed");
        setWorkflow(currentExam.id, await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkflow();
  }, [currentExam, loading, setWorkflow]);

  const layout = useMemo(() => {
    if (!currentExam?.workflowResult) return null;
    const { nodes, milestones } = currentExam.workflowResult;
    const milestoneSet = new Set(milestones.map((m) => m.afterNodeId));

    // Separate spine (topic/milestone) from subtopics
    const spineNodes: WorkflowNode[] = [];
    const subtopicsByParent = new Map<string, WorkflowNode[]>();

    for (const node of nodes) {
      if (node.type === "subtopic") {
        const parentId = node.depends_on.find((d) => {
          const p = nodes.find((n) => n.id === d);
          return p && p.type !== "subtopic";
        }) || node.depends_on[0];
        if (parentId) {
          if (!subtopicsByParent.has(parentId)) subtopicsByParent.set(parentId, []);
          subtopicsByParent.get(parentId)!.push(node);
        }
      } else {
        spineNodes.push(node);
      }
    }

    // Position spine nodes vertically
    interface SpinePos {
      x: number;
      y: number;
      node: WorkflowNode;
      isMilestone: boolean;
    }
    interface SubPos {
      x: number;
      y: number;
      parentX: number;
      parentY: number;
      node: WorkflowNode;
      side: "left" | "right";
    }

    const spinePositions: SpinePos[] = [];
    const subPositions: SubPos[] = [];
    let curY = PAD_TOP;
    let branchSide: "left" | "right" = "left";

    // Insert milestones after the right nodes
    const milestoneLabels = new Map(milestones.map((m) => [m.afterNodeId, m.label]));

    for (let i = 0; i < spineNodes.length; i++) {
      const node = spineNodes[i];

      if (node.type === "milestone") {
        // Milestone diamond
        spinePositions.push({ x: SPINE_X, y: curY, node, isMilestone: true });
        curY += V_STEP;
        continue;
      }

      // Topic node on spine
      spinePositions.push({ x: SPINE_X, y: curY, node, isMilestone: false });

      // Branch subtopics off the spine
      const subs = subtopicsByParent.get(node.id);
      if (subs && subs.length > 0) {
        const parentY = curY;
        subs.forEach((sub, j) => {
          const subY = parentY + 20 + j * 36;
          const subX = branchSide === "left" ? SPINE_X - BRANCH_X : SPINE_X + BRANCH_X;
          subPositions.push({
            x: subX,
            y: subY,
            parentX: SPINE_X,
            parentY,
            node: sub,
            side: branchSide,
          });
        });
        // Extra vertical space for subtopics
        curY += Math.max(0, (subs.length - 1) * 36 + 20);
        branchSide = branchSide === "left" ? "right" : "left";
      }

      // Check if a milestone should appear after this node
      if (milestoneSet.has(node.id)) {
        curY += V_STEP * 0.6;
        const mlLabel = milestoneLabels.get(node.id) || "Milestone";
        spinePositions.push({
          x: SPINE_X,
          y: curY,
          node: { id: `ml-after-${node.id}`, label: mlLabel, type: "milestone", duration: 0, depends_on: [], complexity: 0, priority: "medium" },
          isMilestone: true,
        });
      }

      curY += V_STEP;
    }

    const svgHeight = curY + 60;
    const svgWidth = SPINE_X * 2;

    // Build dependency set for highlight
    const depMap = new Map<string, Set<string>>();
    for (const n of nodes) {
      depMap.set(n.id, new Set(n.depends_on));
    }

    return { spinePositions, subPositions, svgHeight, svgWidth, depMap, nodes };
  }, [currentExam?.workflowResult]);

  // Get all connected nodes for highlight
  const connectedNodes = useMemo(() => {
    if (!selectedNode || !layout) return null;
    const connected = new Set<string>();
    connected.add(selectedNode.id);

    // Walk dependencies (upstream)
    const walkUp = (id: string) => {
      const deps = layout.depMap.get(id);
      if (deps) {
        for (const d of Array.from(deps)) {
          if (!connected.has(d)) {
            connected.add(d);
            walkUp(d);
          }
        }
      }
    };
    walkUp(selectedNode.id);

    // Walk dependents (downstream)
    for (const n of layout.nodes) {
      if (n.depends_on.includes(selectedNode.id)) {
        connected.add(n.id);
      }
    }

    return connected;
  }, [selectedNode, layout]);

  if (!currentExam || currentExam.topics.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-muted text-sm">Upload study material first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <div className="font-mono text-accent text-sm animate-pulse">GENERATING WORKFLOW...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-danger text-sm">{error}</p>
            <button onClick={() => { setError(""); setLoading(false); }}
              className="mt-4 px-4 py-2 border border-accent text-accent font-mono text-xs rounded-lg hover:bg-accent/10">
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  const wf = currentExam.workflowResult;
  if (!wf || !layout) return null;
  const { totalMinutes } = wf;
  const { spinePositions, subPositions, svgHeight, svgWidth } = layout;

  const getNodeOpacity = (nodeId: string) => {
    if (!connectedNodes) return 1;
    return connectedNodes.has(nodeId) ? 1 : 0.15;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ExamSwitcher />
      <div className="flex-1 flex overflow-hidden">
        {/* Left: SVG commit tree */}
        <div className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-white text-2xl font-bold">Workflow</h2>
              <p className="font-mono text-muted text-xs tracking-wider mt-1">STUDY ORDER — COMMIT TREE</p>
            </div>
            <div className="font-mono text-sm text-white">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
            </div>
          </div>

          {/* Color legend */}
          <div className="flex items-center gap-6 mb-4">
            {Object.entries(PRIORITY_COLORS).map(([k, c]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                <span className="font-mono text-[10px] tracking-wider text-muted uppercase">{k}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <svg width={14} height={14}><polygon points="7,0 14,7 7,14 0,7" fill="#00ff88" opacity={0.4} /></svg>
              <span className="font-mono text-[10px] tracking-wider text-muted">MILESTONE</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <svg width={svgWidth} height={svgHeight} style={{ minWidth: svgWidth }}>
              {/* Spine line (vertical) */}
              {spinePositions.length > 1 && (() => {
                const firstY = spinePositions[0].y;
                const lastY = spinePositions[spinePositions.length - 1].y;
                return (
                  <line
                    x1={SPINE_X} y1={firstY} x2={SPINE_X} y2={lastY}
                    stroke="#333" strokeWidth={2}
                  />
                );
              })()}

              {/* Spine connector arrows between nodes */}
              {spinePositions.map((pos, i) => {
                if (i === 0) return null;
                const prev = spinePositions[i - 1];
                const midY = (prev.y + pos.y) / 2;
                return (
                  <polygon
                    key={`arrow-${i}`}
                    points={`${SPINE_X - 4},${midY - 4} ${SPINE_X},${midY + 4} ${SPINE_X + 4},${midY - 4}`}
                    fill="#555"
                    opacity={getNodeOpacity(pos.node.id)}
                  />
                );
              })}

              {/* Subtopic branch lines */}
              {subPositions.map((sub, i) => {
                const opacity = getNodeOpacity(sub.node.id);
                return (
                  <g key={`branch-${i}`} opacity={opacity}>
                    {/* Horizontal line from spine to subtopic */}
                    <line
                      x1={sub.parentX} y1={sub.parentY}
                      x2={sub.parentX + (sub.side === "left" ? -20 : 20)} y2={sub.parentY}
                      stroke="#333" strokeWidth={1.5}
                    />
                    {/* Vertical line down to subtopic level */}
                    <line
                      x1={sub.parentX + (sub.side === "left" ? -20 : 20)} y1={sub.parentY}
                      x2={sub.parentX + (sub.side === "left" ? -20 : 20)} y2={sub.y}
                      stroke="#333" strokeWidth={1.5} strokeDasharray="4,3"
                    />
                    {/* Horizontal line to subtopic node */}
                    <line
                      x1={sub.parentX + (sub.side === "left" ? -20 : 20)} y1={sub.y}
                      x2={sub.x} y2={sub.y}
                      stroke="#333" strokeWidth={1.5} strokeDasharray="4,3"
                    />
                  </g>
                );
              })}

              {/* Milestone diamonds */}
              {spinePositions.filter((p) => p.isMilestone).map((pos) => {
                const opacity = getNodeOpacity(pos.node.id);
                const dSize = 14;
                return (
                  <g key={pos.node.id} opacity={opacity}>
                    <polygon
                      points={`${pos.x},${pos.y - dSize} ${pos.x + dSize},${pos.y} ${pos.x},${pos.y + dSize} ${pos.x - dSize},${pos.y}`}
                      fill="#00ff8830"
                      stroke="#00ff88"
                      strokeWidth={1.5}
                    />
                    {/* Full width label */}
                    <rect
                      x={pos.x - MILESTONE_W / 2}
                      y={pos.y - 12}
                      width={MILESTONE_W}
                      height={24}
                      rx={3}
                      fill="#00ff8808"
                      stroke="#00ff8820"
                      strokeWidth={1}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill="#00ff88"
                      fontSize={11}
                      fontFamily="IBM Plex Mono"
                    >
                      ◆ {pos.node.label}
                    </text>
                  </g>
                );
              })}

              {/* Topic nodes on spine */}
              {spinePositions.filter((p) => !p.isMilestone).map((pos) => {
                const color = PRIORITY_COLORS[pos.node.priority] || "#00ff88";
                const isSel = selectedNode?.id === pos.node.id;
                const isHovered = hoveredNode === pos.node.id;
                const opacity = getNodeOpacity(pos.node.id);

                return (
                  <g
                    key={pos.node.id}
                    onClick={() => setSelectedNode(isSel ? null : pos.node)}
                    onMouseEnter={() => setHoveredNode(pos.node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: "pointer" }}
                    opacity={opacity}
                  >
                    {/* Selection ring */}
                    {isSel && (
                      <circle
                        cx={pos.x} cy={pos.y}
                        r={NODE_R_TOPIC + 4}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    )}
                    {/* Node circle */}
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={NODE_R_TOPIC}
                      fill={color}
                      stroke={isHovered || isSel ? "#fff" : color}
                      strokeWidth={isHovered || isSel ? 2 : 0}
                    />
                    {/* Label (right side) */}
                    <text
                      x={pos.x + NODE_R_TOPIC + 14}
                      y={pos.y - 4}
                      fill="#fff"
                      fontSize={12}
                      fontFamily="IBM Plex Mono"
                    >
                      {pos.node.label}
                    </text>
                    {/* Duration + complexity */}
                    <text
                      x={pos.x + NODE_R_TOPIC + 14}
                      y={pos.y + 12}
                      fill="#666"
                      fontSize={10}
                      fontFamily="IBM Plex Mono"
                    >
                      {pos.node.duration}min · C:{pos.node.complexity}
                    </text>

                    {/* Hover tooltip */}
                    {isHovered && !isSel && (
                      <g>
                        <rect
                          x={pos.x + NODE_R_TOPIC + 10}
                          y={pos.y + 18}
                          width={180}
                          height={32}
                          rx={4}
                          fill="#1a1a1a"
                          stroke="#333"
                          strokeWidth={1}
                        />
                        <text
                          x={pos.x + NODE_R_TOPIC + 18}
                          y={pos.y + 32}
                          fill={color}
                          fontSize={10}
                          fontFamily="IBM Plex Mono"
                        >
                          {pos.node.priority.toUpperCase()} · {pos.node.duration}min
                        </text>
                        <text
                          x={pos.x + NODE_R_TOPIC + 18}
                          y={pos.y + 44}
                          fill="#888"
                          fontSize={9}
                          fontFamily="IBM Plex Mono"
                        >
                          Click for details
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Subtopic nodes */}
              {subPositions.map((sub) => {
                const color = PRIORITY_COLORS[sub.node.priority] || "#00ff88";
                const isSel = selectedNode?.id === sub.node.id;
                const isHovered = hoveredNode === sub.node.id;
                const opacity = getNodeOpacity(sub.node.id);
                const labelX = sub.side === "left" ? sub.x - NODE_R_SUB - 8 : sub.x + NODE_R_SUB + 8;
                const anchor = sub.side === "left" ? "end" : "start";

                return (
                  <g
                    key={sub.node.id}
                    onClick={() => setSelectedNode(isSel ? null : sub.node)}
                    onMouseEnter={() => setHoveredNode(sub.node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: "pointer" }}
                    opacity={opacity}
                  >
                    {isSel && (
                      <circle
                        cx={sub.x} cy={sub.y}
                        r={NODE_R_SUB + 3}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                        opacity={0.5}
                      />
                    )}
                    <circle
                      cx={sub.x} cy={sub.y}
                      r={NODE_R_SUB}
                      fill={color}
                      stroke={isHovered || isSel ? "#fff" : color}
                      strokeWidth={isHovered || isSel ? 1.5 : 0}
                    />
                    <text
                      x={labelX}
                      y={sub.y + 4}
                      textAnchor={anchor}
                      fill="#aaa"
                      fontSize={10}
                      fontFamily="IBM Plex Mono"
                    >
                      {sub.node.label.length > 22 ? sub.node.label.substring(0, 22) + "…" : sub.node.label}
                    </text>
                  </g>
                );
              })}

              {/* Estimated completion at bottom */}
              <text
                x={SPINE_X}
                y={svgHeight - 20}
                textAnchor="middle"
                fill="#555"
                fontSize={11}
                fontFamily="IBM Plex Mono"
              >
                ESTIMATED COMPLETION: {Math.floor(totalMinutes / 60)}H {totalMinutes % 60}M
              </text>
            </svg>
          </div>
        </div>

        {/* Right: Node detail panel */}
        {selectedNode && (
          <div className="w-80 border-l border-border bg-surface p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] tracking-[0.15em] text-muted">NODE DETAIL</div>
              <button
                onClick={() => setSelectedNode(null)}
                className="font-mono text-xs text-muted hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: PRIORITY_COLORS[selectedNode.priority] || "#00ff88" }}
              />
              <h3 className="font-heading text-white text-lg font-bold">{selectedNode.label}</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">TYPE</span>
                <span className="font-mono text-xs text-white uppercase">{selectedNode.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">DURATION</span>
                <span className="font-mono text-xs text-white">{selectedNode.duration} min</span>
              </div>
              <div className="flex justify-between">
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
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">COMPLEXITY</span>
                <span className="font-mono text-xs text-white">{selectedNode.complexity}/10</span>
              </div>
              {selectedNode.depends_on.length > 0 && (
                <div>
                  <span className="font-mono text-xs text-muted block mb-2">DEPENDS ON</span>
                  <div className="space-y-1">
                    {selectedNode.depends_on.map((depId) => {
                      const depNode = wf.nodes.find((n) => n.id === depId);
                      return depNode ? (
                        <button
                          key={depId}
                          onClick={() => setSelectedNode(depNode)}
                          className="block w-full text-left font-mono text-xs text-accent hover:text-white transition-colors"
                        >
                          → {depNode.label}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Link to flashcards */}
            {currentExam.flashcards.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="font-mono text-[10px] tracking-wider text-muted mb-2">RELATED FLASHCARDS</div>
                <div className="space-y-1">
                  {currentExam.flashcards
                    .filter((f) => f.topic?.toLowerCase().includes(selectedNode.label.toLowerCase().split(" ")[0]))
                    .slice(0, 3)
                    .map((f, i) => (
                      <div key={i} className="font-mono text-xs text-muted/70 truncate">
                        Q: {f.question}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
