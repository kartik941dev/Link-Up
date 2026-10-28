import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Download,
  RotateCw,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  FileText,
  FileCode,
  FileCheck,
  Search,
  Sparkles,
  Share2,
  ArrowRight
} from 'lucide-react';
import { GraphNode, GraphLink, GraphStats } from '../../types/graph.js';
import { ContentType } from '../../types/card.js';

interface SimulatedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimulatedLink {
  source: SimulatedNode;
  target: SimulatedNode;
  weight: number;
  similarity_score: number;
  edge_type: string;
  reason: string;
}

interface KnowledgeGraphViewProps {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: GraphStats;
  loading: boolean;
  onRebuild: () => Promise<void>;
  minSimilarity: number;
  onMinSimilarityChange: (val: number) => void;
  onExport: (format: 'png' | 'svg' | 'json' | 'csv') => void;
}

const TYPE_COLORS: Record<ContentType, { main: string; glow: string; label: string }> = {
  pdf: { main: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', label: 'PDF' },
  docx: { main: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.4)', label: 'DOCX' },
  note: { main: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', label: 'NOTE' },
  link: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', label: 'LINK' },
};

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  nodes,
  links,
  stats,
  loading,
  onRebuild,
  minSimilarity,
  onMinSimilarityChange,
  onExport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction State
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<SimulatedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimulatedNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimulatedNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  // Simulation Nodes and Links
  const simNodesRef = useRef<SimulatedNode[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Build Simulated Nodes
  useEffect(() => {
    const existingMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    simNodesRef.current.forEach((n) => {
      existingMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
    });

    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;

    simNodesRef.current = nodes.map((n, i) => {
      const existing = existingMap.get(n.id);
      const angle = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
      const dist = 120 + Math.random() * 150;

      // Base radius by centrality (18px up to 34px)
      const normCentrality = Math.max(0, Math.min(1, n.centrality || 0));
      const radius = 18 + normCentrality * 16;

      return {
        ...n,
        x: existing ? existing.x : width / 2 + Math.cos(angle) * dist,
        y: existing ? existing.y : height / 2 + Math.sin(angle) * dist,
        vx: existing ? existing.vx : (Math.random() - 0.5) * 2,
        vy: existing ? existing.vy : (Math.random() - 0.5) * 2,
        radius,
      };
    });
  }, [nodes]);

  // Active Simulated Links (filtered by minSimilarity)
  const simLinks: SimulatedLink[] = useMemo(() => {
    const nodeMap = new Map<string, SimulatedNode>();
    simNodesRef.current.forEach((n) => nodeMap.set(n.id, n));

    return links
      .filter((l) => l.similarity_score >= minSimilarity)
      .map((l) => {
        const src = nodeMap.get(l.source);
        const tgt = nodeMap.get(l.target);
        if (!src || !tgt) return null;
        return {
          source: src,
          target: tgt,
          weight: l.weight,
          similarity_score: l.similarity_score,
          edge_type: l.edge_type,
          reason: l.reason,
        };
      })
      .filter(Boolean) as SimulatedLink[];
  }, [links, minSimilarity, nodes]);

  // Connected nodes map for hover/selection highlight
  const connectedNodeIds = useMemo(() => {
    const active = hoveredNode || selectedNode;
    if (!active) return new Set<string>();

    const set = new Set<string>([active.id]);
    simLinks.forEach((l) => {
      if (l.source.id === active.id) set.add(l.target.id);
      if (l.target.id === active.id) set.add(l.source.id);
    });
    return set;
  }, [hoveredNode, selectedNode, simLinks]);

  // Physics Simulation Step
  const runPhysicsStep = useCallback(() => {
    const simNodes = simNodesRef.current;
    if (!simNodes.length) return;

    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const damping = 0.82;
    const repulsionStrength = 2200;
    const springLength = 140;
    const springStrength = 0.045;
    const centerPull = 0.012;

    // 1. Repulsion between all pairs
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + 100;
        const dist = Math.sqrt(distSq);

        const force = repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (a !== draggedNode) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b !== draggedNode) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // 2. Spring attraction along links
    simLinks.forEach((l) => {
      const a = l.source;
      const b = l.target;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const delta = dist - springLength;

      // Higher similarity = tighter spring
      const strength = springStrength * (0.8 + l.similarity_score * 0.4);
      const fx = (dx / dist) * delta * strength;
      const fy = (dy / dist) * delta * strength;

      if (a !== draggedNode) {
        a.vx += fx;
        a.vy += fy;
      }
      if (b !== draggedNode) {
        b.vx -= fx;
        b.vy -= fy;
      }
    });

    // 3. Center gravity pull & Integration
    simNodes.forEach((n) => {
      if (n === draggedNode) return;

      n.vx += (centerX - n.x) * centerPull;
      n.vy += (centerY - n.y) * centerPull;

      n.vx *= damping;
      n.vy *= damping;

      n.x += n.vx;
      n.y += n.vy;
    });
  }, [simLinks, draggedNode]);

  // Main Canvas Render Loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply Pan & Zoom
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hasFocus = hoveredNode !== null || selectedNode !== null || searchQuery.trim() !== '';

    // 1. Draw Links
    simLinks.forEach((l) => {
      const isConnected =
        connectedNodeIds.has(l.source.id) && connectedNodeIds.has(l.target.id);
      const isHighlighted = (hoveredNode || selectedNode) && isConnected;

      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);

      // Edge width based on similarity
      const baseWidth = 1 + l.similarity_score * 3.5;

      if (isHighlighted) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = baseWidth + 1.5;
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 10;
      } else if (hasFocus) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.15;
        ctx.shadowBlur = 0;
      } else {
        const alpha = 0.2 + (l.similarity_score - 0.5) * 1.5;
        ctx.strokeStyle = `rgba(99, 102, 241, ${Math.min(0.8, Math.max(0.18, alpha))})`;
        ctx.lineWidth = baseWidth;
        ctx.globalAlpha = Math.min(0.85, Math.max(0.2, alpha));
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });

    // 2. Draw Nodes
    simNodesRef.current.forEach((n) => {
      const isSelected = selectedNode?.id === n.id;
      const isHovered = hoveredNode?.id === n.id;
      const isConnected = connectedNodeIds.has(n.id);
      const matchesSearch =
        searchQuery.trim() === '' ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

      let alpha = 1.0;
      if (hasFocus) {
        alpha = isHovered || isSelected || isConnected || matchesSearch ? 1.0 : 0.25;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      const colors = TYPE_COLORS[n.content_type] || TYPE_COLORS.note;

      // Glow halo on selection/hover or hub node
      if (isSelected || isHovered || n.centrality >= 0.7) {
        ctx.shadowColor = isSelected ? '#38bdf8' : colors.main;
        ctx.shadowBlur = isSelected ? 22 : 14;
      } else {
        ctx.shadowBlur = 4;
        ctx.shadowColor = colors.glow;
      }

      // Outer circle border
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#111827';
      ctx.fill();

      ctx.lineWidth = isSelected ? 3.5 : isHovered ? 2.5 : 1.8;
      ctx.strokeStyle = isSelected ? '#38bdf8' : colors.main;
      ctx.stroke();

      // Inner fill badge
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius - 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();

      ctx.shadowBlur = 0;

      // Glyph / Type Label in Node Center
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(10, Math.floor(n.radius * 0.42))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colors.label, n.x, n.y);

      // Card Title Text Below Node
      const title = n.title.length > 22 ? n.title.substring(0, 20) + '...' : n.title;
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Title background capsule
      const textWidth = ctx.measureText(title).width;
      const textY = n.y + n.radius + 6;
      ctx.fillStyle = isSelected
        ? 'rgba(14, 165, 233, 0.35)'
        : 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = isSelected
        ? 'rgba(56, 189, 248, 0.5)'
        : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      const padX = 7;
      const padY = 3;
      ctx.roundRect(
        n.x - textWidth / 2 - padX,
        textY - padY,
        textWidth + padX * 2,
        18,
        5
      );
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
      ctx.fillText(title, n.x, textY + 1);

      ctx.restore();
    });

    ctx.restore();
  }, [simLinks, transform, connectedNodeIds, hoveredNode, selectedNode, searchQuery]);

  // Animation Loop
  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      runPhysicsStep();
      renderCanvas();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [runPhysicsStep, renderCanvas]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Screen Coordinates to Canvas World Coordinates
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return {
        x: (screenX - transform.x) / transform.k,
        y: (screenY - transform.y) / transform.k,
      };
    },
    [transform]
  );

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Check if clicked on a node
    const clicked = simNodesRef.current.find((n) => {
      const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      return dist <= n.radius + 6;
    });

    if (clicked) {
      setDraggedNode(clicked);
      setSelectedNode(clicked);
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (draggedNode) {
      draggedNode.x = x;
      draggedNode.y = y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
      return;
    }

    if (isDraggingCanvas) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
      return;
    }

    // Hover detection
    const hovered = simNodesRef.current.find((n) => {
      const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
      return dist <= n.radius + 6;
    });
    setHoveredNode(hovered || null);
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const newK = Math.max(0.3, Math.min(3.5, prev.k * zoomFactor));
      return {
        x: mouseX - (mouseX - prev.x) * (newK / prev.k),
        y: mouseY - (mouseY - prev.y) * (newK / prev.k),
        k: newK,
      };
    });
  };

  // Zoom Button Controls
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }
    const factor = direction === 'in' ? 1.25 : 0.8;
    setTransform((prev) => ({
      ...prev,
      k: Math.max(0.3, Math.min(3.5, prev.k * factor)),
    }));
  };

  // Rebuild Trigger
  const handleRebuildClick = async () => {
    try {
      setIsRebuilding(true);
      await onRebuild();
    } finally {
      setIsRebuilding(false);
    }
  };

  // Export handlers
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create an offscreen canvas to render a high-res styled image
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const bgGradient = ctx.createRadialGradient(
      exportCanvas.width / 2,
      exportCanvas.height / 2,
      100,
      exportCanvas.width / 2,
      exportCanvas.height / 2,
      exportCanvas.width / 1.2
    );
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#080c14');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw active canvas content over background
    ctx.drawImage(canvas, 0, 0);

    // Title watermark in corner
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('LinkUp Knowledge Graph', 30, 45);
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Exported on ${new Date().toLocaleDateString()} • ${nodes.length} cards • ${simLinks.length} connections`, 30, 70);

    // Trigger download
    const link = document.createElement('a');
    link.download = `linkup-knowledge-graph-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png', 1.0);
    link.click();
    setShowExportMenu(false);
  };

  const handleDownloadSVG = () => {
    const width = containerRef.current?.clientWidth || 1000;
    const height = containerRef.current?.clientHeight || 700;

    const linksSvg = simLinks
      .map(
        (l) =>
          `<line x1="${l.source.x}" y1="${l.source.y}" x2="${l.target.x}" y2="${l.target.y}" stroke="#6366f1" stroke-width="${1 + l.similarity_score * 3}" stroke-opacity="${0.2 + l.similarity_score * 0.6}" />`
      )
      .join('\n');

    const nodesSvg = simNodesRef.current
      .map((n) => {
        const color = TYPE_COLORS[n.content_type]?.main || '#10b981';
        return `
        <g transform="translate(${n.x}, ${n.y})">
          <circle r="${n.radius}" fill="#111827" stroke="${color}" stroke-width="2" />
          <text text-anchor="middle" dy="4" fill="#ffffff" font-size="11" font-weight="bold">${TYPE_COLORS[n.content_type]?.label || 'NOTE'}</text>
          <text text-anchor="middle" dy="${n.radius + 15}" fill="#e2e8f0" font-size="10">${n.title.replace(/[<&]/g, '')}</text>
        </g>
      `;
      })
      .join('\n');

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="#080c14" />
        <g transform="translate(${transform.x}, ${transform.y}) scale(${transform.k})">
          ${linksSvg}
          ${nodesSvg}
        </g>
      </svg>
    `;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `linkup-knowledge-graph-${Date.now()}.svg`;
    link.click();
    setShowExportMenu(false);
  };

  const handleDownloadJSON = () => {
    onExport('json');
    setShowExportMenu(false);
  };

  const handleDownloadCSV = () => {
    onExport('csv');
    setShowExportMenu(false);
  };

  // Connected Neighbors for Selected Node Drawer
  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const list: Array<{ card: GraphNode; edge: SimulatedLink }> = [];
    simLinks.forEach((l) => {
      if (l.source.id === selectedNode.id) {
        list.push({ card: l.target, edge: l });
      } else if (l.target.id === selectedNode.id) {
        list.push({ card: l.source, edge: l });
      }
    });
    return list.sort((a, b) => b.edge.similarity_score - a.edge.similarity_score);
  }, [selectedNode, simLinks]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 120px)',
        minHeight: '620px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        background: 'radial-gradient(ellipse at 50% 50%, #0d1527 0%, #080c14 100%)',
      }}
    >
      {/* Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: draggedNode
            ? 'grabbing'
            : hoveredNode
            ? 'pointer'
            : isDraggingCanvas
            ? 'grabbing'
            : 'grab',
        }}
      />

      {/* Top Floating Control Bar */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '1.25rem',
          left: '1.25rem',
          right: '1.25rem',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          zIndex: 10,
        }}
      >
        {/* Left: Search filter & Threshold slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Search Node */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-glass-input)',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter graph nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
                width: '160px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Similarity Threshold Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sliders size={14} /> Threshold:
            </span>
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={minSimilarity}
              onChange={(e) => onMinSimilarityChange(parseFloat(e.target.value))}
              style={{
                cursor: 'pointer',
                accentColor: 'var(--accent-primary)',
                width: '110px',
              }}
            />
            <span
              className="badge badge-indigo"
              style={{ fontSize: '0.75rem', fontWeight: 700 }}
            >
              {Math.round(minSimilarity * 100)}%
            </span>
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              <strong>{nodes.length}</strong> Cards
            </span>
            <span>•</span>
            <span>
              <strong>{simLinks.length}</strong> Connections
            </span>
            {stats.avgSimilarity > 0 && (
              <>
                <span>•</span>
                <span>Avg: <strong>{Math.round(stats.avgSimilarity * 100)}%</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions & Dual Download Suite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Rebuild Connections */}
          <button
            className="btn btn-secondary"
            onClick={handleRebuildClick}
            disabled={isRebuilding || loading}
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
            title="Recalculate pairwise cosine connections and PageRank scores"
          >
            <RotateCw
              size={15}
              style={{
                animation: isRebuilding ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isRebuilding ? 'Rebuilding...' : 'Rebuild'}</span>
          </button>

          {/* Download Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowExportMenu((prev) => !prev)}
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              <Download size={15} />
              <span>Download Graph</span>
            </button>

            {showExportMenu && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '240px',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  zIndex: 30,
                  boxShadow: 'var(--glass-shadow-hover)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                }}
              >
                <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Visual Export (Images)
                </div>
                <button
                  onClick={handleDownloadPNG}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <Share2 size={15} style={{ color: 'var(--accent-secondary)' }} />
                  <span>Download High-Res PNG</span>
                </button>
                <button
                  onClick={handleDownloadSVG}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <FileCode size={15} style={{ color: 'var(--accent-cyan)' }} />
                  <span>Download Vector SVG</span>
                </button>

                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.2rem 0' }} />

                <div style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Data Export (Graph Datasets)
                </div>
                <button
                  onClick={handleDownloadJSON}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <FileText size={15} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Export JSON Dataset</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <FileCheck size={15} style={{ color: 'var(--accent-amber)' }} />
                  <span>Export CSV (Nodes & Edges)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Zoom & Canvas Controls (Bottom Right) */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          right: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          padding: '0.4rem',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => handleZoom('in')}
          className="btn btn-ghost"
          style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="btn btn-ghost"
          style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => handleZoom('reset')}
          className="btn btn-ghost"
          style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)' }}
          title="Reset View"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '1.25rem',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.1rem',
          zIndex: 10,
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1' }} />
          <span>PDF</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ea5e9' }} />
          <span>DOCX</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
          <span>Note</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
          <span>Link</span>
        </div>
        <div style={{ height: '12px', width: '1px', background: 'var(--border-subtle)' }} />
        <span>Node Size = PageRank Centrality</span>
      </div>

      {/* Slide-over Inspection Panel for Selected Node */}
      {selectedNode && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: '1.25rem',
            bottom: '1.25rem',
            right: '1.25rem',
            width: '380px',
            maxWidth: 'calc(100% - 2.5rem)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 20,
            overflowY: 'auto',
            animation: 'fadeIn 0.2s ease-out',
            boxShadow: 'var(--glass-shadow-hover)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                className={`badge badge-${
                  selectedNode.content_type === 'pdf'
                    ? 'indigo'
                    : selectedNode.content_type === 'note'
                    ? 'emerald'
                    : selectedNode.content_type === 'docx'
                    ? 'sky'
                    : 'amber'
                }`}
              >
                {selectedNode.content_type.toUpperCase()}
              </span>
              {selectedNode.centrality >= 0.6 && (
                <span className="badge badge-indigo">
                  <Sparkles size={11} style={{ marginRight: '0.25rem' }} /> Hub Concept
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="btn btn-ghost"
              style={{ padding: '0.35rem', borderRadius: '50%' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.35 }}>
            {selectedNode.title}
          </h2>

          {/* Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PageRank Centrality</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                {Math.round(selectedNode.centrality * 100)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Connected Concepts</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {selectedNeighbors.length}
              </div>
            </div>
          </div>

          {/* Snippet */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Content Excerpt
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
                background: 'var(--bg-glass-input)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {selectedNode.snippet || 'No text content available for this card.'}
            </p>
          </div>

          {/* Tags */}
          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {selectedNode.tags.map((t) => (
                  <span key={t.id} className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                    #{t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connected Concepts List */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Connected Concepts ({selectedNeighbors.length})</span>
            </div>

            {selectedNeighbors.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No connections above the {Math.round(minSimilarity * 100)}% threshold. Lower the threshold slider to reveal more associations.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedNeighbors.map(({ card, edge }) => (
                  <div
                    key={card.id}
                    onClick={() => {
                      const target = simNodesRef.current.find((n) => n.id === card.id);
                      if (target) setSelectedNode(target);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '0.5rem', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {card.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {edge.reason}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="badge badge-sky" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                        {Math.round(edge.similarity_score * 100)}%
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
