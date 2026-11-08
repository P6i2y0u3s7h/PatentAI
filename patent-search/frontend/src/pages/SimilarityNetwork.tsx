import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Building,
  Hash,
  Tag,
  Cpu,
  Upload,
  RotateCcw,
  Sliders,
  FolderOpen,
} from 'lucide-react';
import { HeroWordReveal } from '../components/AnimatedText';
import { patentNetworkApi } from '../api/patentNetworkApi';
import { compareApi } from '../api/compareApi';
import {
  PatentNetworkResponse,
  PatentNetworkHistoryEntry,
  NetworkNode,
  NetworkEdge,
  PatentSummaryItem,
} from '../types/patent';

interface SimNode extends NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export const SimilarityNetwork: React.FC = () => {
  // Input parameters
  const [selectedPatentId, setSelectedPatentId] = useState('US-2024-001');
  const [searchQuery, setSearchQuery] = useState('');
  const [topK, setTopK] = useState(12);
  const [minSimilarity, setMinSimilarity] = useState(0.20);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Catalog list for picker
  const [catalog, setCatalog] = useState<PatentSummaryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Network State
  const [networkData, setNetworkData] = useState<PatentNetworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Selection State
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  // Filters State
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMinScore, setFilterMinScore] = useState<number>(0.0);
  const [showFilters, setShowFilters] = useState(false);

  // History State
  const [history, setHistory] = useState<PatentNetworkHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Canvas ref & transform (zoom, pan, drag)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<NetworkEdge[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<SimNode | null>(null);

  // Load catalog & history on mount
  useEffect(() => {
    loadCatalog();
    loadHistory();
    // Auto-generate initial network with top catalog patent
    handleGenerate('US-2024-001');
  }, []);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await compareApi.listPatents();
      setCatalog(res.patents || []);
    } catch (_) {}
    finally {
      setLoadingCatalog(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await patentNetworkApi.getHistory(10);
      setHistory(res.entries || []);
    } catch (_) {}
  };

  const handleGenerate = async (patentIdToUse?: string) => {
    setLoading(true);
    setError(null);
    setSelectedNode(null);

    try {
      const pId = patentIdToUse || selectedPatentId;
      let result: PatentNetworkResponse;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('pdf_file', selectedFile);
        formData.append('top_k', topK.toString());
        formData.append('min_similarity', minSimilarity.toString());
        result = await patentNetworkApi.generateNetwork(formData);
      } else if (searchQuery.trim()) {
        const formData = new FormData();
        formData.append('query_text', searchQuery.trim());
        formData.append('top_k', topK.toString());
        formData.append('min_similarity', minSimilarity.toString());
        result = await patentNetworkApi.generateNetwork(formData);
      } else {
        result = await patentNetworkApi.generateByPatentId(pId, topK);
      }

      setNetworkData(result);
      initializeSimulation(result);
      loadHistory();
    } catch (err: any) {
      console.error('[SimilarityNetwork] Error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to generate similarity network.');
    } finally {
      setLoading(false);
    }
  };

  // Node Category Colors
  const getCategoryColor = (cat: string): string => {
    const c = cat.toLowerCase();
    if (c.includes('artificial') || c.includes('neural') || c.includes('machine')) return '#06B6D4'; // Cyan
    if (c.includes('quantum') || c.includes('computing')) return '#8B5CF6'; // Violet
    if (c.includes('autonomous') || c.includes('vehicle') || c.includes('lidar')) return '#3B82F6'; // Blue
    if (c.includes('healthcare') || c.includes('biomedical') || c.includes('medical')) return '#10B981'; // Emerald
    if (c.includes('semiconductor') || c.includes('hardware')) return '#F59E0B'; // Amber
    if (c.includes('privacy') || c.includes('security')) return '#EC4899'; // Pink
    return '#14B8A6'; // Teal
  };

  // Initialize Force-Directed Simulation
  const initializeSimulation = (data: PatentNetworkResponse) => {
    const width = 800;
    const height = 600;
    const cx = width / 2;
    const cy = height / 2;

    const nodes: SimNode[] = data.nodes.map((n, idx) => {
      const isCentral = n.is_central;
      const angle = (idx / Math.max(1, data.nodes.length - 1)) * 2 * Math.PI;
      const distance = isCentral ? 0 : 160 + (1 - n.similarity_score) * 140;

      return {
        ...n,
        x: isCentral ? cx : cx + Math.cos(angle) * distance + (Math.random() - 0.5) * 40,
        y: isCentral ? cy : cy + Math.sin(angle) * distance + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: isCentral ? 28 : Math.max(14, Math.round(n.similarity_score * 22)),
        color: isCentral ? '#06B6D4' : getCategoryColor(n.category),
      };
    });

    setSimNodes(nodes);
    setSimEdges(data.edges);

    // Auto-select central node
    const central = nodes.find((n) => n.is_central);
    if (central) setSelectedNode(central);

    // Reset pan/zoom
    transformRef.current = { x: 0, y: 0, scale: 1 };
  };

  // Physics Simulation Step (Spring forces + Coulomb repulsion)
  useEffect(() => {
    if (!simNodes.length) return;

    let animId: number;
    let iteration = 0;

    const tick = () => {
      iteration++;
      if (iteration > 240 && !draggedNodeRef.current) {
        // Stabilized; stop continuous simulation to save CPU
        drawCanvas();
        return;
      }

      const cx = 400;
      const cy = 300;

      // 1. Repulsion between all node pairs
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.radius + b.radius + 30;

          if (dist < 350) {
            const force = (3000 / (dist * dist)) * (dist < minDist ? 2.5 : 1);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!a.is_central && a !== draggedNodeRef.current) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (!b.is_central && b !== draggedNodeRef.current) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
      }

      // 2. Spring attraction along edges
      for (const edge of simEdges) {
        const sourceNode = simNodes.find((n) => n.id === edge.source);
        const targetNode = simNodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 180 * (1.1 - edge.similarity * 0.4);
          const force = (dist - targetDist) * 0.035;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!sourceNode.is_central && sourceNode !== draggedNodeRef.current) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (!targetNode.is_central && targetNode !== draggedNodeRef.current) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      }

      // 3. Central gravity and velocity dampening
      for (const node of simNodes) {
        if (node.is_central) {
          node.x = cx;
          node.y = cy;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        if (node === draggedNodeRef.current) continue;

        // Weak pull toward center
        node.vx += (cx - node.x) * 0.005;
        node.vy += (cy - node.y) * 0.005;

        // Damping
        node.vx *= 0.85;
        node.vy *= 0.85;

        node.x += node.vx;
        node.y += node.vy;
      }

      drawCanvas();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [simNodes, simEdges]);

  // Render Canvas Graph
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply pan & zoom
    ctx.translate(transformRef.current.x, transformRef.current.y);
    ctx.scale(transformRef.current.scale, transformRef.current.scale);

    // Filtered visible nodes
    const visibleNodes = simNodes.filter((n) => {
      if (filterCategory !== 'all' && n.category !== filterCategory && !n.is_central) {
        return false;
      }
      if (n.similarity_score < filterMinScore && !n.is_central) {
        return false;
      }
      return true;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    // 1. Draw Edges
    for (const edge of simEdges) {
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;

      const sourceNode = simNodes.find((n) => n.id === edge.source);
      const targetNode = simNodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;

      const isConnectedToSelected =
        selectedNode && (sourceNode.id === selectedNode.id || targetNode.id === selectedNode.id);

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);

      if (isConnectedToSelected) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)'; // Glowing cyan
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = `rgba(148, 163, 184, ${Math.max(0.12, edge.similarity * 0.35)})`;
        ctx.lineWidth = Math.max(1, edge.similarity * 2.5);
      }
      ctx.stroke();

      // Draw edge percentage label if connected to selected node
      if (isConnectedToSelected && edge.similarity) {
        const mx = (sourceNode.x + targetNode.x) / 2;
        const my = (sourceNode.y + targetNode.y) / 2;
        ctx.fillStyle = '#06B6D4';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(edge.similarity * 100)}%`, mx, my - 4);
      }
    }

    // 2. Draw Nodes
    for (const node of visibleNodes) {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;

      // Glow halo
      if (node.is_central || isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isSelected ? 9 : 6), 0, Math.PI * 2);
        ctx.fillStyle = node.is_central
          ? 'rgba(6, 182, 212, 0.25)'
          : isSelected
          ? 'rgba(139, 92, 246, 0.3)'
          : 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
      }

      // Main Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border ring
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      // Central node inner pulse dot
      if (node.is_central) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      // Node Label (Patent ID + Short Title)
      ctx.fillStyle = isSelected ? '#FFFFFF' : '#CBD5E1';
      ctx.font = node.is_central ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.id, node.x, node.y + node.radius + 13);

      // Similarity badge below label
      if (!node.is_central) {
        ctx.fillStyle = '#06B6D4';
        ctx.font = '9px monospace';
        ctx.fillText(`${Math.round(node.similarity_score * 100)}%`, node.x, node.y + node.radius + 24);
      }
    }

    ctx.restore();
  }, [simNodes, simEdges, selectedNode, hoveredNode, filterCategory, filterMinScore]);

  // Handle Canvas Zoom
  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      transformRef.current = { x: 0, y: 0, scale: 1 };
    } else {
      const factor = direction === 'in' ? 1.25 : 0.8;
      transformRef.current.scale = Math.min(3.0, Math.max(0.4, transformRef.current.scale * factor));
    }
    drawCanvas();
  };

  // Convert mouse event coordinates to graph coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = (mouseX - transformRef.current.x) / transformRef.current.scale;
    const y = (mouseY - transformRef.current.y) / transformRef.current.scale;
    return { x, y };
  };

  // Mouse Handlers for Dragging & Clicking Nodes
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    // Check if clicked a node
    const clickedNode = simNodes.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = x;
      draggedNodeRef.current.y = y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      drawCanvas();
      return;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
      drawCanvas();
      return;
    }

    // Hover check
    const hoverMatch = simNodes.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    });

    if (hoverMatch !== hoveredNode) {
      setHoveredNode(hoverMatch || null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hoverMatch ? 'pointer' : 'grab';
      }
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    transformRef.current.scale = Math.min(3.0, Math.max(0.4, transformRef.current.scale * factor));
    drawCanvas();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#0B1020] border border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] mb-2.5"
          >
            <Share2 size={14} className="text-cyan-400" />
            <span>Interactive Patent Similarity Network</span>
          </motion.div>

          <HeroWordReveal
            prefixText="Vector"
            gradientText="Semantic Technology Graph"
            className="text-3xl sm:text-4xl font-bold font-heading text-slate-100 tracking-tight"
          />

          <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
            Explore organic prior-art clusters and technological proximity. Drag nodes, adjust semantic
            similarity thresholds, and inspect shared concepts across indexed patent filings.
          </p>
        </div>

        {/* History & Controls */}
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500/40 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5"
            >
              <FolderOpen size={14} className="text-cyan-400" />
              <span>History ({history.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 ${
              showFilters
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:text-cyan-300'
            }`}
          >
            <Sliders size={14} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-[#0B1020]/90 space-y-3">
              <span className="text-xs font-semibold text-slate-200">Past Similarity Networks</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setSelectedPatentId(h.central_patent_id);
                      handleGenerate(h.central_patent_id);
                      setShowHistory(false);
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 text-left transition-all"
                  >
                    <div className="text-xs font-semibold text-cyan-300 truncate">
                      {h.central_patent_id} - {h.central_title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">
                      {h.node_count} connected nodes
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seed Controls Panel */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Catalog Dropdown */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-300 font-mono flex items-center justify-between">
              <span>Select Seed Patent (Catalog)</span>
              <span className="text-[10px] text-slate-500 font-normal">Real Database Records</span>
            </label>
            <select
              value={selectedPatentId}
              onChange={(e) => {
                setSelectedPatentId(e.target.value);
                setSearchQuery('');
                setSelectedFile(null);
              }}
              className="w-full bg-[#070A14] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none transition-all truncate"
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.title} ({p.assignee})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Query Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 font-mono">
              Or Keyword / Concept
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. quantum superposition"
                className="w-full bg-[#070A14] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-all"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-300 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>{loading ? 'Clustering...' : 'Build Network'}</span>
          </button>
        </div>

        {/* Collapsible Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {/* Category Filter */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Category Filter:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-[#070A14] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="all">All Technology Domains</option>
                  {networkData?.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Similarity Threshold Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Min Similarity:</span>
                  <span className="text-cyan-400 font-bold">{Math.round(filterMinScore * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={filterMinScore}
                  onChange={(e) => setFilterMinScore(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Node Density / Top K */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Cluster Size:</span>
                  <span className="text-cyan-400 font-bold">{topK} nodes</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Main Interactive Canvas & Details Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Visualizer Card */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-4 border border-slate-800 relative bg-[#04060C] min-h-[580px] flex flex-col justify-between overflow-hidden">
          {/* Canvas Floating Overlay Controls */}
          <div className="absolute top-6 left-6 z-10 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-slate-300">
            <button
              type="button"
              onClick={() => handleZoom('in')}
              title="Zoom In"
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleZoom('out')}
              title="Zoom Out"
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleZoom('reset')}
              title="Reset View"
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {/* Legend Overlay */}
          <div className="absolute top-6 right-6 z-10 hidden sm:flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              Central Seed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
              AI & Neural
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Autonomous
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Biomedical
            </span>
          </div>

          {/* Interactive HTML5 Canvas */}
          <div className="flex-1 w-full h-[520px] relative">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              className="w-full h-full cursor-grab active:cursor-grabbing block"
            />
          </div>

          {/* Bottom Canvas Stats Bar */}
          {networkData && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <span>Total Nodes: <strong className="text-slate-200">{simNodes.length}</strong></span>
                <span>Interconnections: <strong className="text-slate-200">{simEdges.length}</strong></span>
                <span>Avg Proximity: <strong className="text-cyan-400">{Math.round(networkData.avg_similarity * 100)}%</strong></span>
              </div>
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Drag nodes to reposition • Scroll to zoom • Click to inspect
              </span>
            </div>
          )}
        </div>

        {/* Patent Details Inspector Panel */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-5 bg-[#0B1020]/90 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      selectedNode.is_central
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    {selectedNode.is_central ? 'Central Seed Patent' : 'Similar Patent'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 mt-1.5 leading-snug">
                    {selectedNode.title}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400 whitespace-nowrap">
                  {Math.round(selectedNode.similarity_score * 100)}% Match
                </span>
              </div>

              {/* Patent Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
                    <Hash size={11} /> Publication ID
                  </span>
                  <p className="font-mono font-semibold text-slate-200">{selectedNode.id}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
                    <Building size={11} /> Assignee
                  </span>
                  <p className="text-slate-200 truncate">{selectedNode.assignee}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
                    <Calendar size={11} /> Date
                  </span>
                  <p className="font-mono text-slate-300">{selectedNode.publication_date}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
                    <Tag size={11} /> IPC Class
                  </span>
                  <p className="font-mono text-cyan-300">{selectedNode.ipc_class}</p>
                </div>
              </div>

              {/* Shared Concepts */}
              {selectedNode.shared_concepts && selectedNode.shared_concepts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    Shared Technical Concepts
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.shared_concepts.map((concept, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-[10px] font-mono"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Abstract */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Abstract
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans max-h-48 overflow-y-auto pr-1">
                  {selectedNode.abstract || 'No abstract text available in index.'}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                {!selectedNode.is_central && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatentId(selectedNode.id);
                      handleGenerate(selectedNode.id);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>Re-Center Network on this Patent</span>
                  </button>
                )}

                <a
                  href={selectedNode.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={13} className="text-cyan-400" />
                  <span>Inspect on Google Patents</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2 my-auto">
              <Info size={24} className="mx-auto text-slate-600" />
              <p className="text-xs font-medium">Click on any patent node in the network to inspect claims, abstract, and shared concepts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
