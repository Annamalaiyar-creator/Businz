import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipboardList, TrendingUp, Percent, CheckCircle2, XCircle, Clock, Cpu,
  Calendar, Filter, AlertTriangle, AlertCircle, Info, ShieldCheck, Factory,
  Users, Layers, Award, BarChart2, Package, ArrowUpRight, ArrowDownRight, Settings,
  MoreHorizontal, Plus, RefreshCw, Check, Maximize2, Sparkles, SlidersHorizontal, ArrowUpDown, Hourglass,
  Truck, FileText, IndianRupee
} from 'lucide-react';
import POStatusOverview from './POStatusOverview';
import DailyProductionTrendChart from './DailyProductionTrendChart';
import StatusBadge from './StatusBadge';
import { prodModuleEngine } from '../utils/productionModuleEngine';
import { fetchCloudStore } from '../utils/supabaseDataSync';

export default function ProductionAdminView({ activeTab, userRole }) {
  const isDispatchView = userRole === 'Dispatch Head' || activeTab === 'Dispatch Dashboard';
  const isFloorView = userRole === 'Floor Employee' || userRole === 'Machine Operator' || activeTab === 'Floor Employee' || activeTab === 'Operator Workspace';
  const [selectedMonth, setSelectedMonth] = useState('07');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [trendFilter, setTrendFilter] = useState('Daily');
  const [activeTrendIndex, setActiveTrendIndex] = useState(6);

  // Live BOM Store for Dispatch views
  const [bomStore, setBomStore] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    const loadBoms = async () => {
      try {
        let boms = null;
        try {
          const apiRes = await fetch('/api/boms');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json && Array.isArray(json.data)) {
              boms = json.data;
            }
          }
        } catch (_) {}

        if (boms === null) {
          boms = await fetchCloudStore('bom_store', []);
        }

        if (Array.isArray(boms) && boms.length > 0) {
          const parseBomSeq = (code) => {
            const m = String(code || '').match(/BOM-(\d+)/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const sorted = [...boms].sort((a, b) => {
            const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
            const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
            if (seqA !== seqB) return seqB - seqA;
            const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
            const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
            return dateB - dateA;
          });
          setBomStore(sorted);
        }
      } catch (_) {}
    };

    loadBoms();
    // Gentle 90s safety fallback check only when active and tab is visible (replaces aggressive 5s polling)
    const fallbackInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadBoms();
      }
    }, 90000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadBoms();
      }
    };

    const handleUpdate = (e) => {
      if (e?.detail?.bom) {
        const newBom = e.detail.bom;
        setBomStore(prev => {
          const k = newBom.bomCode || newBom.code || newBom.id;
          const filtered = (prev || []).filter(b => b && (b.bomCode !== k && b.code !== k && b.id !== k));
          return [newBom, ...filtered];
        });
      } else {
        loadBoms();
      }
    };

    window.addEventListener('controlroom_bom_store_updated', handleUpdate);
    window.addEventListener('controlroom_storage_update', handleUpdate);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(fallbackInterval);
      window.removeEventListener('controlroom_bom_store_updated', handleUpdate);
      window.removeEventListener('controlroom_storage_update', handleUpdate);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Live Zoho Inventory Work Orders State
  const [workOrders, setWorkOrders] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('controlroom_prod_dismissed_alerts') || '[]');
    } catch (e) {
      return [];
    }
  });

  const handleDismissAlert = (id) => {
    const updated = [...dismissedAlerts, id];
    setDismissedAlerts(updated);
    try {
      localStorage.setItem('controlroom_prod_dismissed_alerts', JSON.stringify(updated));
    } catch (e) { }
  };

  // New Work Order Form State
  const [newWO, setNewWO] = useState({
    productName: 'Mini Rail 100 mm',
    plannedQty: '500',
    rawMaterial: 'Raw Aluminum Coil 1.5mm',
    customer: 'Vikram Solar',
    targetDate: new Date().toISOString().split('T')[0],
    delayReason: 'Normal Production'
  });

  // Fetch Work Orders from Server
  const fetchWorkOrders = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/workorders');
      let serverWOs = [];
      if (res.ok) {
        const data = await res.json();
        if (data.workOrders && Array.isArray(data.workOrders)) {
          serverWOs = data.workOrders;
        }
      }
      const engineWOs = prodModuleEngine.getWorkOrders() || [];
      const woMap = new Map();
      
      // Combine engine work orders first
      engineWOs.forEach(wo => {
        const key = wo.id || wo.workOrderNo;
        if (key) {
          woMap.set(key, {
            id: wo.id,
            workOrderNo: wo.id || wo.workOrderNo,
            productName: wo.finishedProductCode || wo.productName || 'Solar Mounting Rail',
            plannedQty: wo.targetQty || wo.plannedQty || 500,
            completedQty: wo.completedQty || 0,
            delayDays: wo.delayDays || 0,
            delayReason: wo.delayReason || 'Normal Production',
            status: wo.status || 'In Progress',
            statusColor: wo.statusColor || '#EA580C',
            rawMaterial: wo.rawMaterial || 'Raw Alu Coil',
            customer: wo.customer || 'Solar Client',
            targetDate: wo.targetDate || wo.date || new Date().toISOString().split('T')[0]
          });
        }
      });

      // Overlay server work orders
      serverWOs.forEach(wo => {
        const key = wo.workOrderNo || wo.id;
        if (key) {
          woMap.set(key, { ...woMap.get(key), ...wo });
        }
      });

      setWorkOrders(Array.from(woMap.values()));
    } catch (err) {
      console.error('Failed to fetch work orders:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const [, setEngineTick] = useState(0);

  useEffect(() => {
    fetchWorkOrders();
    const unsubscribe = prodModuleEngine.subscribe(() => {
      setEngineTick(t => t + 1);
      fetchWorkOrders();
    });
    return () => unsubscribe();
  }, []);

  const realEngineWOs = prodModuleEngine.getWorkOrders();

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/workorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWO)
      });
      if (res.ok) {
        setShowCreateModal(false);
        fetchWorkOrders();
      }
    } catch (err) {
      console.error('Failed to create work order:', err);
    }
  };

  // Canvas Refs
  const statusDonutRef = useRef(null);
  const trendComboRef = useRef(null);
  const qualityDonutRef = useRef(null);
  const containerRef = useRef(null);

  // Helper for drawing rounded-corner annular sectors matching reference image
  const drawAnnularSector = (ctx, cx, cy, innerR, outerR, startAngle, endAngle, cornerRadius, color) => {
    const gap = 0.045; // Clean radial gap between sectors
    const a1 = startAngle + gap / 2;
    const a2 = endAngle - gap / 2;
    if (a2 <= a1 + 0.01) return;

    ctx.save();
    ctx.beginPath();
    // Outer arc
    ctx.arc(cx, cy, outerR, a1, a2, false);
    // Inner arc in reverse
    ctx.arc(cx, cy, innerR, a2, a1, true);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Round corner join effect matching reference image rounded sector corners
    ctx.lineWidth = cornerRadius;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  };

  // 1. Production Status Donut Canvas (Exact Reference Donut System with Annular Sectors & Rounded Sector Corners)
  const drawStatusDonut = () => {
    const canvas = statusDonutRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 190;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const x = size / 2;
    const y = size / 2;
    const outerRadius = 82;
    const innerRadius = 58;
    const cornerRadius = 4;

    // Proportional percentages calculated dynamically from realEngineWOs
    const list = realEngineWOs || [];
    const totalCount = list.length || 1;
    let completedCount = 0;
    let inProgressCount = 0;
    let plannedCount = 0;
    let approvedCount = 0;
    let delayedCount = 0;

    list.forEach(wo => {
      const st = String(wo.status || '').toUpperCase();
      if (st.includes('COMPLET') || st.includes('DONE')) completedCount++;
      else if (st.includes('PROGRESS')) inProgressCount++;
      else if (st.includes('APPROV')) approvedCount++;
      else if (st.includes('DELAY') || st.includes('OVERDUE')) delayedCount++;
      else plannedCount++;
    });

    const segments = list.length > 0 ? [
      { color: '#22C55E', pct: completedCount / totalCount },
      { color: '#0084FF', pct: inProgressCount / totalCount },
      { color: '#06B6D4', pct: plannedCount / totalCount },
      { color: '#38BDF8', pct: approvedCount / totalCount },
      { color: '#F43F5E', pct: delayedCount / totalCount }
    ] : [
      { color: '#22C55E', pct: 0.50 },
      { color: '#0084FF', pct: 0.25 },
      { color: '#06B6D4', pct: 0.25 }
    ];

    let currentAngle = -Math.PI / 2;

    segments.forEach(seg => {
      if (seg.pct <= 0) return;

      const arcSpan = seg.pct * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + arcSpan;

      drawAnnularSector(ctx, x, y, innerRadius, outerRadius, startAngle, endAngle, cornerRadius, seg.color);

      currentAngle += arcSpan;
    });
  };

  // Trend Chart Data (Matches Procurement Area Line + Bar Trend System)
  const trendData = [
    { date: '18-Jul', planned: 720, actual: 654, pct: '90.8%' },
    { date: '19-Jul', planned: 690, actual: 612, pct: '88.7%' },
    { date: '20-Jul', planned: 760, actual: 724, pct: '95.3%' },
    { date: '21-Jul', planned: 780, actual: 702, pct: '90.0%' },
    { date: '22-Jul', planned: 770, actual: 736, pct: '95.6%' },
    { date: '23-Jul', planned: 750, actual: 690, pct: '92.0%' },
    { date: '24-Jul', planned: 810, actual: 744, pct: '91.9%' }
  ];

  const handleTrendMouseMove = (e) => {
    const canvas = trendComboRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const paddingLeft = 40;
    const paddingRight = 20;
    const graphWidth = rect.width - paddingLeft - paddingRight;
    const count = trendData.length;

    let idx = Math.round(((x - paddingLeft) / graphWidth) * (count - 1));
    if (idx < 0) idx = 0;
    if (idx > count - 1) idx = count - 1;

    if (idx !== activeTrendIndex) {
      setActiveTrendIndex(idx);
    }
  };

  // 2. Daily Production Trend Canvas (Strictly DM Sans Font)
  const drawTrendCombo = () => {
    const canvas = trendComboRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = 185;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 22;
    const paddingBottom = 28;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    // Y Grid Lines & Axis Labels
    const yLabels = ['1,000', '800', '600', '400', '200', '0'];
    const gridRows = 5;

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridRows; i++) {
      const y = paddingTop + (graphHeight / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillText(yLabels[i], paddingLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    // X Axis Date Labels
    ctx.textAlign = 'center';
    trendData.forEach((d, i) => {
      const x = paddingLeft + (graphWidth / (trendData.length - 1)) * i;
      ctx.fillStyle = i === activeTrendIndex ? '#1e3a8a' : '#64748b';
      ctx.font = i === activeTrendIndex ? 'bold 10.5px "DM Sans", sans-serif' : '10px "DM Sans", sans-serif';
      ctx.fillText(d.date, x, height - 6);
    });

    const maxNos = 1000;
    const points = trendData.map((d, i) => ({
      x: paddingLeft + (graphWidth / (trendData.length - 1)) * i,
      y: paddingTop + graphHeight - (graphHeight * (d.actual / maxNos))
    }));

    // Active Column Highlight
    const activePoint = points[activeTrendIndex];
    const columnWidth = 30;
    ctx.fillStyle = 'rgba(37, 99, 235, 0.06)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(activePoint.x - (columnWidth / 2), paddingTop, columnWidth, graphHeight, 6);
    } else {
      ctx.rect(activePoint.x - (columnWidth / 2), paddingTop, columnWidth, graphHeight);
    }
    ctx.fill();

    // Smooth Bezier Spline Curve
    const drawSpline = (fill = false) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;

        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
      }

      if (fill) {
        ctx.lineTo(points[points.length - 1].x, paddingTop + graphHeight);
        ctx.lineTo(points[0].x, paddingTop + graphHeight);
        ctx.closePath();
      }
    };

    // Linear Area Gradient
    const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + graphHeight);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.00)');
    ctx.fillStyle = gradient;
    drawSpline(true);
    ctx.fill();

    // Smooth Blue Stroke Line
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2.5;
    drawSpline(false);
    ctx.stroke();

    // Dots on Points
    points.forEach((pt, i) => {
      const isActive = i === activeTrendIndex;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isActive ? '#2563EB' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.stroke();

      // Tooltip / Value Pill above active point
      if (isActive) {
        const valText = `${trendData[i].actual} Nos (${trendData[i].pct})`;
        ctx.font = 'bold 10px "DM Sans", sans-serif';
        const textWidth = ctx.measureText(valText).width;
        const pillW = textWidth + 14;
        const pillH = 20;
        const pillX = Math.max(paddingLeft, Math.min(width - paddingRight - pillW, pt.x - pillW / 2));
        const pillY = pt.y - 26;

        ctx.fillStyle = '#1E3A8A';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        else ctx.rect(pillX, pillY, pillW, pillH);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(valText, pillX + pillW / 2, pillY + 14);
      }
    });
  };

  // 3. Quality Breakdown Donut Canvas
  const drawQualityDonut = () => {
    const canvas = qualityDonutRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 160;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const x = size / 2;
    const y = size / 2;
    const radius = 64;
    const thickness = 14;

    // Background track
    ctx.beginPath();
    ctx.arc(x, y, radius - (thickness / 2), 0, 2 * Math.PI);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = thickness;
    ctx.stroke();

    const segments = [
      { color: '#0284c7', value: 54 / 116 }, // Dim. Out (Cyan - like Draft)
      { color: '#16a34a', value: 28 / 116 }, // Scratch (Green - like Approved)
      { color: '#ea580c', value: 18 / 116 }, // Bent (Orange - like Part. Rec)
      { color: '#2563eb', value: 10 / 116 }, // Offset (Blue - like Fully Rec)
      { color: '#dc2626', value: 6 / 116 }   // Others (Red - like Cancelled)
    ];

    let startAngle = -Math.PI / 2;

    segments.forEach(seg => {
      if (seg.value <= 0) return;
      const angle = seg.value * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(x, y, radius - (thickness / 2), startAngle, startAngle + angle, false);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';
      ctx.stroke();
      startAngle += angle;
    });
  };

  useEffect(() => {
    const renderAllCharts = () => {
      drawStatusDonut();
      drawTrendCombo();
      drawQualityDonut();
    };

    renderAllCharts();

    window.addEventListener('resize', renderAllCharts);

    let observer = null;
    if (window.ResizeObserver && containerRef.current) {
      observer = new ResizeObserver(() => {
        renderAllCharts();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', renderAllCharts);
      if (observer) observer.disconnect();
    };
  }, [activeTrendIndex, trendFilter]);

  // Top 5 Delayed Production Orders dynamically from real prodModuleEngine store (strictly excluding completed/approved/closed orders)
  const displayOrders = useMemo(() => {
    const isCompleted = (statusStr) => {
      if (!statusStr) return false;
      const s = String(statusStr).toUpperCase();
      return s.includes('COMPLETED') || s.includes('CLOSED') || s.includes('APPROVED') || s.includes('DONE');
    };

    // Filter engine work orders to keep ONLY active delayed/overdue/pending orders
    const delayedFromEngine = (realEngineWOs || [])
      .filter(wo => !isCompleted(wo.status))
      .map(wo => {
        let stColor = '#D97706';
        let delayText = wo.delayDays || '1 Day';
        let statusText = 'Delayed';

        if (wo.status === 'OVERDUE' || wo.status === 'PENDING_MATERIAL') {
          stColor = '#DC2626';
          delayText = '2 Days';
          statusText = 'Overdue';
        } else if (wo.status === 'IN_PROGRESS' || wo.status === 'PLANNED') {
          delayText = '1 Day';
          statusText = 'Delayed';
        } else {
          statusText = (wo.status || 'PLANNED').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        return {
          workOrderNo: wo.id,
          productName: wo.finishedProductName || 'Mini Rail Profile',
          plannedQty: typeof wo.targetQty === 'number' ? `${wo.targetQty} ${wo.unit || 'Nos'}` : (wo.targetQty || '500 Nos'),
          completedQty: wo.actualGoodOutput || 0,
          delayDays: delayText,
          delayReason: wo.instructions || 'Material / Processing Delay',
          status: statusText,
          statusColor: stColor
        };
      });

    return delayedFromEngine.slice(0, 5);
  }, [realEngineWOs]);

  // Real Dynamic Production Statistics calculated from realEngineWOs
  const dynamicStats = useMemo(() => {
    const list = realEngineWOs || [];
    let totalPlanQty = 0;
    let totalGoodQty = 0;
    let totalScrapQty = 0;
    let totalDowntimeHrs = 0;

    // By Product breakdown map
    const productMap = {};
    // By Machine utilization map
    const machineMap = {};

    list.forEach(wo => {
      const plan = Number(wo.targetQty || wo.quantity || 0);
      const isCompleted = String(wo.status || '').toUpperCase().includes('COMPLET') || String(wo.status || '').toUpperCase().includes('DONE');
      const act = Number(wo.actualGoodOutput || (isCompleted ? plan : 0));
      const scrap = Number(wo.scrapQty || wo.rejectedQty || 0);
      const dt = Number(wo.downtimeHours || wo.delayHours || 0);

      totalPlanQty += plan;
      totalGoodQty += act;
      totalScrapQty += scrap;
      totalDowntimeHrs += dt;

      // Group product
      const pName = wo.finishedProductName || wo.productName || 'Solar Component';
      if (!productMap[pName]) {
        productMap[pName] = { name: pName, plan: 0, act: 0 };
      }
      productMap[pName].plan += plan;
      productMap[pName].act += act;

      // Group machine
      const mName = wo.machineName || wo.machineId || (wo.routing && wo.routing[0]?.workCenter) || 'CNC Cutting Machine';
      if (!machineMap[mName]) {
        machineMap[mName] = { name: mName, plan: 0, act: 0 };
      }
      machineMap[mName].plan += plan;
      machineMap[mName].act += act;
    });

    const achievePct = totalPlanQty > 0 ? ((totalGoodQty / totalPlanQty) * 100).toFixed(1) : (totalGoodQty > 0 ? '100.0' : '0.0');
    const qualityYield = (totalGoodQty + totalScrapQty) > 0 ? ((totalGoodQty / (totalGoodQty + totalScrapQty)) * 100).toFixed(1) : '98.5';

    // Formatted product rows
    const productRows = Object.values(productMap).map(p => ({
      name: p.name,
      plan: `${p.plan.toLocaleString()} Nos`,
      act: `${p.act.toLocaleString()} Nos`,
      pct: p.plan > 0 ? Math.min(100, Math.round((p.act / p.plan) * 100)) : (p.act > 0 ? 100 : 0)
    }));

    // Formatted machine rows
    const machineRows = Object.values(machineMap).map(m => ({
      name: m.name,
      plan: m.plan.toLocaleString(),
      act: m.act.toLocaleString(),
      util: m.plan > 0 ? Math.min(100, Math.round((m.act / m.plan) * 100)) : (m.act > 0 ? 85 : 75)
    }));

    return {
      totalPlan: totalPlanQty > 0 ? totalPlanQty.toLocaleString() : '0',
      totalProd: totalGoodQty > 0 ? totalGoodQty.toLocaleString() : '0',
      planAchievement: `${achievePct}%`,
      goodProd: totalGoodQty > 0 ? totalGoodQty.toLocaleString() : '0',
      qualityYield: `${qualityYield}%`,
      rejection: totalScrapQty > 0 ? totalScrapQty.toLocaleString() : '0',
      downtime: totalDowntimeHrs > 0 ? `${totalDowntimeHrs.toFixed(1)} Hrs` : '0.0 Hrs',
      productRows: productRows.length > 0 ? productRows : [
        { name: 'Mini Rail 100 mm', plan: '0 Nos', act: '0 Nos', pct: 0 }
      ],
      machineRows: machineRows.length > 0 ? machineRows : [
        { name: 'CNC Cutting Machine', plan: '0', act: '0', util: 0 }
      ],
      operatorRows: (() => {
        const opMap = {};
        list.forEach(wo => {
          const opName = wo.operatorName || wo.supervisor || (wo.routing && wo.routing[0]?.operator) || 'Plant Operator';
          const mach = wo.machineName || 'Production Line';
          if (!opMap[opName]) {
            opMap[opName] = { name: opName, machine: mach, total: 0, good: 0 };
          }
          opMap[opName].total += Number(wo.targetQty || 0);
          opMap[opName].good += Number(wo.actualGoodOutput || wo.targetQty || 0);
        });
        const ops = Object.values(opMap).map(o => {
          const effNum = o.total > 0 ? Math.min(100, Math.round((o.good / o.total) * 100)) : 95;
          const grade = effNum >= 95 ? 'A+' : effNum >= 90 ? 'A' : 'B+';
          const color = effNum >= 90 ? '#16A34A' : '#EAB308';
          return {
            name: o.name,
            machine: o.machine,
            eff: `${effNum}%`,
            grade,
            color
          };
        });
        return ops.length > 0 ? ops : [
          { name: 'Senthil Kumar', machine: 'Roll Forming', eff: '96.2%', grade: 'A+', color: '#16A34A' },
          { name: 'Murugan', machine: 'CNC Cutting', eff: '94.0%', grade: 'A', color: '#16A34A' },
          { name: 'Ramesh', machine: 'Punching Line', eff: '91.5%', grade: 'A', color: '#16A34A' }
        ];
      })()
    };
  }, [realEngineWOs]);

  // Get logged-in user profile details
  const loggedEmail = localStorage.getItem('controlroom_logged_user') || 'production.head@vrm.com';
  const roleName = userRole || 'Production Head';

  return (
    <div ref={containerRef} style={{ fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', paddingTop: '0px' }}>

      {/* PERSONALIZED WELCOME BANNER CARD */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Welcome back, {(() => {
                const storedName = localStorage.getItem('controlroom_logged_user_name');
                if (storedName && storedName !== 'undefined' && storedName !== 'null') return storedName;
                try {
                  const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
                  const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
                  const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
                  const match = allEmps.find(e => e && (e.role === userRole || (userRole.includes('Supervisor') && String(e.role).includes('Supervisor')) || (userRole.includes('Dispatch') && String(e.role).includes('Dispatch'))));
                  if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
                } catch(e) {}
                if (userRole === 'Production Head') return 'Senthil Kumar';
                if (userRole === 'Dispatch Head') return 'Kalpana';
                if (userRole === 'Floor Supervisor') return 'Floor Supervisor';
                if (userRole === 'Floor Employee') return 'Floor Employee';
                if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
                return userRole || 'Production Team';
              })()}!
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Here is your plant output overview, work order progress & shift efficiency metrics for today.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 2 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zoho Integration</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06B6D4', boxShadow: '0 0 8px #06B6D4' }}></span>
              Connected & Synced
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plant Status</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 8px #22C55E' }}></span>
              Line 1 & 2 Active
            </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.05) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* ROW 1: KPI SUMMARY CARDS (5 CARDS FOR DISPATCH / 6 CARDS FOR FLOOR & PRODUCTION) */}
      <div style={{ display: 'grid', gridTemplateColumns: isDispatchView ? 'repeat(5, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
        {(isFloorView ? [
          {
            title: 'SHIFT TARGET QTY',
            value: '1,200',
            trend: 'Target for Shift A',
            trendUp: true,
            icon: Factory,
            iconColor: '#FFFFFF',
            iconBg: '#0284C7',
            bottomPrefix: 'Shift A Target',
            bottomHighlight: ''
          },
          {
            title: 'UNITS COMPLETED TODAY',
            value: '942',
            trend: '78.5% of Shift Target',
            trendUp: true,
            icon: CheckCircle2,
            iconColor: '#FFFFFF',
            iconBg: '#15803D',
            bottomPrefix: 'Shift A Actual',
            bottomHighlight: ''
          },
          {
            title: 'SHIFT EFFICIENCY %',
            value: '94.2%',
            trend: '↑ 2.1% vs Yesterday',
            trendUp: true,
            icon: TrendingUp,
            iconColor: '#FFFFFF',
            iconBg: '#6B21A8',
            bottomPrefix: 'Operator OEE',
            bottomHighlight: ''
          },
          {
            title: 'CURRENT LINE SPEED',
            value: '42 m/min',
            trend: 'Optimal Speed',
            trendUp: true,
            icon: Cpu,
            iconColor: '#FFFFFF',
            iconBg: '#0E7490',
            bottomPrefix: 'CNC Line 1',
            bottomHighlight: ''
          },
          {
            title: 'REJECTED UNITS',
            value: '12',
            trend: '1.2% Rejection Rate',
            trendUp: false,
            icon: AlertCircle,
            iconColor: '#FFFFFF',
            iconBg: '#DC2626',
            bottomPrefix: 'Pass QA Check',
            bottomHighlight: ''
          },
          {
            title: 'ACTIVE MACHINE',
            value: 'CNC Line 01',
            trend: 'Running Smoothly',
            trendUp: true,
            icon: Settings,
            iconColor: '#FFFFFF',
            iconBg: '#D97706',
            bottomPrefix: 'Status: RUNNING',
            bottomHighlight: ''
          }
        ] : isDispatchView ? [
          {
            title: 'DISPATCHED TODAY',
            value: '28',
            trend: '12.4% vs Last Month',
            trendUp: true,
            icon: Truck,
            iconColor: '#FFFFFF',
            iconBg: '#0284C7',
            bottomPrefix: 'Till 09:30 AM',
            bottomHighlight: ''
          },
          {
            title: 'DISPATCHED (MTD)',
            value: '352',
            trend: '12.6% vs Last Month',
            trendUp: true,
            icon: Package,
            iconColor: '#FFFFFF',
            iconBg: '#6B21A8',
            bottomPrefix: 'This Month',
            bottomHighlight: ''
          },
          {
            title: 'ON TIME DISPATCH %',
            value: '96.4%',
            trend: '4.2% vs Last Month',
            trendUp: true,
            icon: CheckCircle2,
            iconColor: '#FFFFFF',
            iconBg: '#0D9488',
            bottomPrefix: 'This Month',
            bottomHighlight: ''
          },
          {
            title: 'DISPATCH PENDING',
            value: '14',
            trend: '2 vs Last Month',
            trendUp: false,
            icon: Clock,
            iconColor: '#FFFFFF',
            iconBg: '#EA580C',
            bottomPrefix: 'This Month',
            bottomHighlight: ''
          },
          {
            title: 'DISPATCH VALUE (MTD)',
            value: '₹ 3.26 Cr',
            trend: '14.8% vs Last Month',
            trendUp: true,
            icon: IndianRupee,
            iconColor: '#FFFFFF',
            iconBg: '#A21CAF',
            bottomPrefix: 'This Month',
            bottomHighlight: ''
          }
        ] : [
          {
            title: 'TOTAL PLAN (NOS)',
            value: dynamicStats.totalPlan,
            trend: 'Live Target',
            trendUp: true,
            icon: ClipboardList,
            iconColor: '#16A34A',
            iconBg: '#F0FDF4',
            bottomPrefix: 'Work orders planned: ',
            bottomHighlight: `${dynamicStats.totalPlan} NOS`
          },
          {
            title: 'TOTAL PRODUCTION',
            value: dynamicStats.totalProd,
            trend: dynamicStats.planAchievement,
            trendUp: true,
            icon: TrendingUp,
            iconColor: '#0284C7',
            iconBg: '#F0F9FF',
            bottomPrefix: 'Actual output: ',
            bottomHighlight: `${dynamicStats.totalProd} units`
          },
          {
            title: 'PLAN ACHIEVEMENT',
            value: dynamicStats.planAchievement,
            trend: 'Real-time',
            trendUp: true,
            icon: Percent,
            iconColor: '#8B5CF6',
            iconBg: '#F3E8FF',
            bottomPrefix: 'Plant progress: ',
            bottomHighlight: `${dynamicStats.planAchievement} achieved`
          },
          {
            title: 'GOOD PRODUCTION',
            value: dynamicStats.goodProd,
            trend: dynamicStats.qualityYield,
            trendUp: true,
            icon: CheckCircle2,
            iconColor: '#059669',
            iconBg: '#ECFDF5',
            bottomPrefix: 'Quality yield rate: ',
            bottomHighlight: `${dynamicStats.qualityYield} passed`
          },
          {
            title: 'REJECTION (NOS)',
            value: dynamicStats.rejection,
            trend: 'Scrap logged',
            trendUp: false,
            icon: XCircle,
            iconColor: '#DC2626',
            iconBg: '#FEF2F2',
            bottomPrefix: 'Total rejection: ',
            bottomHighlight: `${dynamicStats.rejection} NOS`
          },
          {
            title: 'DOWNTIME (HRS)',
            value: dynamicStats.downtime,
            trend: 'Live hours',
            trendUp: true,
            icon: Clock,
            iconColor: '#D97706',
            iconBg: '#FFF7ED',
            bottomPrefix: 'Plant downtime: ',
            bottomHighlight: dynamicStats.downtime
          }
        ]).map((kpi, kIdx) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={kIdx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #EAEFEF',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
                transition: 'all 0.2s ease',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              {/* Top Main Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#64748B',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {kpi.title}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                    {kpi.value}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: kpi.trendUp ? '#059669' : '#DC2626',
                      backgroundColor: kpi.trendUp ? '#ECFDF5' : '#FEF2F2',
                      border: kpi.trendUp ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      padding: '1.5px 6px',
                      borderRadius: '6px',
                      lineHeight: '1.2'
                    }}
                  >
                    {kpi.trendUp ? (
                      <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                    ) : (
                      <ArrowDownRight style={{ width: '12px', height: '12px' }} />
                    )}
                    {kpi.trend}
                  </span>
                </div>
              </div>

              {/* Bottom Sub-Card Box */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#64748B',
                  lineHeight: '1.3',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <span>{kpi.bottomPrefix}</span>
                <span style={{ color: kpi.trendUp ? '#059669' : '#DC2626', fontWeight: '800' }}>
                  {kpi.bottomHighlight}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2 CONTINUOUS FLEX COLUMNS LAYOUT (ORIGINAL SCRIPT DESIGN) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '12px', width: '100%', boxSizing: 'border-box', alignItems: 'start' }}>

        {/* ==================== LEFT CONTINUOUS FLEX COLUMN ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>

          {/* 1. STATUS BREAKDOWN WITH MASTER PIE CHART COMPONENT */}
          <POStatusOverview
            title={isFloorView ? "My Assigned Work Orders" : isDispatchView ? "Dispatch Orders by Status" : "Work Orders by Status"}
            totalCount={String(realEngineWOs.length)}
            totalLabel={isFloorView ? "ASSIGNED WOs" : isDispatchView ? "TOTAL ORDERS" : "TOTAL ORDERS"}
            items={[
              {
                name: 'In Production',
                count: `${realEngineWOs.filter(w => w.status === 'IN_PROGRESS' || w.status === 'ACCEPTED').length} WOs`,
                color: '#0284C7',
                pct: realEngineWOs.length ? (realEngineWOs.filter(w => w.status === 'IN_PROGRESS' || w.status === 'ACCEPTED').length / realEngineWOs.length) : 0
              },
              {
                name: 'Completed & Approved',
                count: `${realEngineWOs.filter(w => w.status === 'APPROVED_CLOSED').length} WOs`,
                color: '#16A34A',
                pct: realEngineWOs.length ? (realEngineWOs.filter(w => w.status === 'APPROVED_CLOSED').length / realEngineWOs.length) : 0
              },
              {
                name: 'Pending Verification',
                count: `${realEngineWOs.filter(w => w.status === 'COMPLETED_PENDING_VERIFICATION').length} WOs`,
                color: '#0E7490',
                pct: realEngineWOs.length ? (realEngineWOs.filter(w => w.status === 'COMPLETED_PENDING_VERIFICATION').length / realEngineWOs.length) : 0
              },
              {
                name: 'Draft / Pending Material',
                count: `${realEngineWOs.filter(w => w.status === 'PENDING_MATERIAL' || w.status === 'DRAFT' || w.status === 'MATERIAL_RESERVED').length} WOs`,
                color: '#EA580C',
                pct: realEngineWOs.length ? (realEngineWOs.filter(w => w.status === 'PENDING_MATERIAL' || w.status === 'DRAFT' || w.status === 'MATERIAL_RESERVED').length / realEngineWOs.length) : 0
              }
            ]}
          />

          {/* 2. DAILY DISPATCH / PRODUCTION TREND WITH CORAL ORANGE BAR DESIGN */}
          <DailyProductionTrendChart
            title={isDispatchView ? "Daily Dispatch Volume & On-Time %" : "Workflow Runs Over Time"}
            mainValue={isDispatchView ? "352" : "6,324"}
          />

          {/* 3. DISPATCH / PRODUCTION / MY MACHINE PRODUCTION */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isFloorView ? 'My Machine Output (CNC Line 01)' : isDispatchView ? 'Dispatch by Product / Profile (MTD)' : 'Production by Product / Profile'}
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Product / Profile <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                      </div>
                    </th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isFloorView ? 'Shift Target' : isDispatchView ? 'Orders' : 'Planned'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isFloorView ? 'Completed' : isDispatchView ? 'Dispatched Qty' : 'Actual'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'On Time %' : 'Achievement %'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(isFloorView ? [
                    { name: 'Mini Rail 100 mm', plan: '600 Nos', act: '542 Nos', pct: 90.3 },
                    { name: 'Mini Rail 60 mm', plan: '400 Nos', act: '320 Nos', pct: 80.0 },
                    { name: 'Long Rail 3000 mm', plan: '200 Nos', act: '80 Nos', pct: 40.0 }
                  ] : isDispatchView ? [
                    { name: 'Mini Rail 100 mm', plan: '18', act: '12,450 Nos', pct: 97.2 },
                    { name: 'Mini Rail 60 mm', plan: '12', act: '8,300 Nos', pct: 96.1 },
                    { name: 'Long Rail 3000 mm', plan: '8', act: '5,200 Nos', pct: 95.0 },
                    { name: 'Mid Clamp 35 mm', plan: '11', act: '22,600 Nos', pct: 94.5 },
                    { name: 'End Clamp 35 mm', plan: '6', act: '8,900 Nos', pct: 100 },
                    { name: 'Other Accessories', plan: '9', act: '6,420 Nos', pct: 96.0 }
                  ] : dynamicStats.productRows).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 10px', color: '#0F172A', fontWeight: '700' }}>{row.name}</td>
                      <td style={{ padding: '7px 10px', color: '#64748B' }}>{row.plan}</td>
                      <td style={{ padding: '7px 10px', color: '#0F172A', fontWeight: '700' }}>{row.act}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '60px', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${row.pct}%`, height: '100%', backgroundColor: '#0284C7' }}></div>
                          </div>
                          <strong style={{ fontSize: '10.5px', color: '#0284C7', fontWeight: '800' }}>{row.pct}%</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: '800', color: '#0F172A', borderTop: '1px solid #CBD5E1', backgroundColor: '#F8FAFC' }}>
                    <td style={{ padding: '7px 10px' }}>Total Output</td>
                    <td style={{ padding: '7px 10px' }}>{isFloorView ? '1,200 Nos' : isDispatchView ? '64' : `${dynamicStats.totalPlan} Nos`}</td>
                    <td style={{ padding: '7px 10px' }}>{isFloorView ? '942 Nos' : isDispatchView ? '63,870' : `${dynamicStats.totalProd} Nos`}</td>
                    <td style={{ padding: '7px 10px', color: '#0284C7' }}>{isFloorView ? '78.5%' : isDispatchView ? '96.4%' : dynamicStats.planAchievement}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. DISPATCH DELAY REASONS / DOWNTIME ANALYSIS */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isFloorView ? 'My Shift Downtime Log' : isDispatchView ? 'Dispatch Delay Analysis' : 'Downtime Analysis'}
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Reason <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                      </div>
                    </th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isFloorView ? 'Duration' : isDispatchView ? 'Delayed Orders' : 'Hours'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>% of Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {(isFloorView ? [
                    { reason: 'Tool Change / Setup', hrs: '25 Mins', pct: 5.2 },
                    { reason: 'Material Coil Change', hrs: '15 Mins', pct: 3.1 },
                    { reason: 'Minor Jam / Sensor Check', hrs: '10 Mins', pct: 2.0 }
                  ] : isDispatchView ? [
                    { reason: 'Material Not Ready from Production', hrs: '6 Orders', pct: 42.8 },
                    { reason: 'Vehicle / Transporter Delay', hrs: '4 Orders', pct: 28.5 },
                    { reason: 'Packing / Labeling Pending', hrs: '2 Orders', pct: 14.3 },
                    { reason: 'Customer Payment / Hold', hrs: '1 Order', pct: 7.2 },
                    { reason: 'Documentation / E-Way Bill Hold', hrs: '1 Order', pct: 7.2 }
                  ] : [
                    { reason: 'Machine Breakdown', hrs: '12.6 hrs', pct: 39.9 },
                    { reason: 'Material Not Ready', hrs: '7.8 hrs', pct: 24.7 },
                    { reason: 'Tool Change / Setup', hrs: '5.4 hrs', pct: 17.1 },
                    { reason: 'Quality Check / Rejection', hrs: '3.2 hrs', pct: 10.1 },
                    { reason: 'Operator Absence', hrs: '2.6 hrs', pct: 8.2 }
                  ]).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: idx === (isFloorView ? 2 : 4) ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 10px', color: '#0F172A', fontWeight: '700' }}>{row.reason}</td>
                      <td style={{ padding: '7px 10px', color: '#DC2626', fontWeight: '800' }}>{row.hrs}</td>
                      <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '600' }}>{row.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. VEHICLE UTILIZATION / QUALITY REJECTION BREAKDOWN */}
          <POStatusOverview
            title={isDispatchView ? "Vehicle Fleet Status Breakdown" : "Quality Rejection Breakdown"}
            totalCount={isDispatchView ? "32" : "116"}
            totalLabel={isDispatchView ? "TOTAL VEHICLES" : "TOTAL REJECTS"}
            items={isDispatchView ? [
              { name: 'Loaded & Dispatched', count: '18 Vehicles', color: '#15803D', pct: 0.563 },
              { name: 'In Transit', count: '6 Vehicles', color: '#0284C7', pct: 0.187 },
              { name: 'Loading at Yard', count: '4 Vehicles', color: '#EAB308', pct: 0.125 },
              { name: 'Waiting for Loading', count: '4 Vehicles', color: '#EC4899', pct: 0.125 }
            ] : [
              { name: 'Dim. Out', count: '54 Nos', color: '#0284C7', pct: 0.465 },
              { name: 'Scratch', count: '28 Nos', color: '#16A34A', pct: 0.241 },
              { name: 'Bent', count: '18 Nos', color: '#EA580C', pct: 0.155 },
              { name: 'Offset', count: '10 Nos', color: '#2563EB', pct: 0.086 },
              { name: 'Others', count: '6 Nos', color: '#DC2626', pct: 0.053 }
            ]}
          />

        </div>

        {/* ==================== RIGHT CONTINUOUS FLEX COLUMN ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>

          {/* 1. TOP 5 DELAYED PRODUCTION ORDERS / DISPATCH ORDERS */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isDispatchView ? 'Top 5 Delayed Dispatch Orders' : 'Top 5 Delayed Production Orders'}
                </span>
                <span style={{ fontSize: '9.5px', color: isDispatchView ? '#2563EB' : '#0E7490', fontWeight: '700', backgroundColor: isDispatchView ? '#EFF6FF' : '#ECFEFF', padding: '2px 8px', borderRadius: '8px' }}>
                  {isDispatchView ? 'Synced with Zoho' : 'Internal Businz'}
                </span>
              </div>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Order No. <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                      </div>
                    </th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'Customer / Destination' : 'Product / Profile'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'Dispatch Qty' : 'Planned'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Delay</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(isDispatchView ? (
                    (bomStore || []).filter(b => b && b.status && b.status !== 'Draft').slice(0, 5).map(b => {
                      const totalQty = (b.items || []).reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0);
                      const packedQty = (b.dispatchPacking || []).filter(p => p.packed).length;
                      const totalItems = (b.dispatchPacking || b.items || []).length;
                      let statusText = 'Pending Packing';
                      if (b.status === 'Closed' || b.status === 'Fully Dispatched & Delivered') statusText = 'Dispatched';
                      else if (packedQty > 0 && packedQty === totalItems) statusText = 'Packed';
                      else if (packedQty > 0) statusText = 'Partially Packed';
                      else if (b.status.includes('Production')) statusText = 'In Production';
                      else if (b.status.includes('Confirmed')) statusText = 'Sales Confirmed';

                      return {
                        workOrderNo: b.bomCode || b.code || b.id,
                        productName: b.customerName || b.companyName || 'Corporate Client',
                        plannedQty: `${totalQty.toLocaleString('en-IN')} Nos`,
                        delayDays: b.salesConfirmed ? 'On Schedule' : '1 Day',
                        status: statusText
                      };
                    })
                  ) : displayOrders).map((ord, idx) => (
                    <tr key={idx} style={{ borderBottom: idx === (isDispatchView ? Math.min((bomStore || []).length, 5) - 1 : displayOrders.length - 1) ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '600' }}>{ord.workOrderNo}</td>
                      <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{ord.productName}</td>
                      <td style={{ padding: '7px 10px', color: '#64748B' }}>{ord.plannedQty}</td>
                      <td style={{ padding: '7px 10px', fontWeight: '800', color: ord.delayDays === 'On Schedule' ? '#16A34A' : (ord.status === 'Overdue' ? '#DC2626' : '#D97706') }}>{ord.delayDays || 'On Schedule'}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <StatusBadge status={ord.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. VEHICLES IN TRANSIT / MACHINE PERFORMANCE */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isDispatchView ? 'Vehicles in Transit' : 'Machine Performance'}
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isDispatchView ? 'Vehicle / Transporter' : 'Machine / Line'} <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                      </div>
                    </th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'Order No' : 'Planned'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'Dispatched' : 'Actual'}</th>
                    <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>{isDispatchView ? 'ETA' : 'Utilization'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(isDispatchView ? [
                    { name: 'TN 09 AB 1234 (SRS Logistics)', plan: 'WO-2', act: '23-Jul-2026', util: 92, label: '24-Jul-2026' },
                    { name: 'TN 37 CD 5678 (VRM Transport)', plan: 'WO-3', act: '23-Jul-2026', util: 88, label: '24-Jul-2026' },
                    { name: 'KA 01 EF 9012 (Safe Way)', plan: 'WO-4', act: '23-Jul-2026', util: 95, label: '24-Jul-2026' },
                    { name: 'TN 88 U 7890 (Speed Cargo)', plan: 'WO-5', act: '23-Jul-2026', util: 90, label: '25-Jul-2026' }
                  ] : dynamicStats.machineRows).map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: idx === (isDispatchView ? 4 : dynamicStats.machineRows.length - 1) ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 10px', color: '#0F172A', fontWeight: '700' }}>{m.name}</td>
                      <td style={{ padding: '7px 10px', color: '#64748B' }}>{m.plan}</td>
                      <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{m.act}</td>
                      <td style={{ padding: '7px 10px' }}>
                        {isDispatchView ? (
                          <span style={{ fontSize: '9.5px', fontWeight: '800', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 6px', borderRadius: '4px' }}>
                            {m.label}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '60px', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${m.util}%`, height: '100%', backgroundColor: '#2563EB' }}></div>
                            </div>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0F172A' }}>{m.util}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. DOCUMENT CHECKLIST & INVOICES PENDING / MACHINE OPERATOR PERFORMANCE */}
          {isDispatchView ? (
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Document Checklist (Today)
                </span>
              </div>

              <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Document Name</th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Required</th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Completed</th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Tax Invoices', req: 28, comp: 27, pend: '1 Pending', color: '#DC2626' },
                      { name: 'E-Way Bills', req: 28, comp: 28, pend: 'Done', color: '#16A34A' },
                      { name: 'LR / Delivery Challans', req: 28, comp: 28, pend: 'Done', color: '#16A34A' },
                      { name: 'Packing Lists', req: 28, comp: 27, pend: '1 Pending', color: '#DC2626' },
                      { name: 'Test Certificates (TC)', req: 12, comp: 10, pend: '2 Pending', color: '#D97706' }
                    ].map((doc, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === 4 ? 'none' : '1px solid #F1F5F9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{doc.name}</td>
                        <td style={{ padding: '7px 10px', color: '#64748B' }}>{doc.req}</td>
                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#16A34A' }}>{doc.comp}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ color: doc.color, fontWeight: '800', fontSize: '10px' }}>
                            {doc.pend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Machine Operator Performance
                </span>
              </div>

              <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Operator <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                        </div>
                      </th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Machine</th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Efficiency</th>
                      <th style={{ padding: '7px 10px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dynamicStats.operatorRows.map((op, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === dynamicStats.operatorRows.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{op.name}</td>
                        <td style={{ padding: '7px 10px', color: '#64748B' }}>{op.machine}</td>
                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>{op.eff}</td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ backgroundColor: op.color, color: 'white', padding: '2px 7px', borderRadius: '8px', fontWeight: '800', fontSize: '10px' }}>
                            {op.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. FLEET SLA COMPLIANCE / OEE ANALYSIS */}
          {isDispatchView ? (
            <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, boxSizing: 'border-box' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                DISPATCH PERFORMANCE METRICS <span style={{ color: '#64748B', fontWeight: '600', fontSize: '11px' }}>(THIS MONTH)</span>
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Avg Loading</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={14} /></div>
                  <strong style={{ fontSize: '15px', color: '#0F172A' }}>52 Mins</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↓ 8 Mins</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Avg Waiting</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FFF7ED', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Hourglass size={14} /></div>
                  <strong style={{ fontSize: '15px', color: '#0F172A' }}>41 Mins</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 10 Mins</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Right First Time</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={14} /></div>
                  <strong style={{ fontSize: '15px', color: '#0F172A' }}>99.0%</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 1.2%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Documentation</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={14} /></div>
                  <strong style={{ fontSize: '15px', color: '#0F172A' }}>98.5%</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 1.0%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Complaints</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} /></div>
                  <strong style={{ fontSize: '15px', color: '#0F172A' }}>2</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↓ 1</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
                <div><span style={{ color: '#64748B' }}>Total Dispatches:</span> <strong>352 Orders</strong></div>
                <div><span style={{ color: '#64748B' }}>On-Time Dispatches:</span> <strong style={{ color: '#16A34A' }}>339 Orders</strong></div>
                <div><span style={{ color: '#64748B' }}>Delayed Dispatches:</span> <strong style={{ color: '#DC2626' }}>13 Orders</strong></div>
              </div>
            </div>
          ) : (
            <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, boxSizing: 'border-box' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OEE ANALYSIS <span style={{ color: '#64748B', fontWeight: '600', fontSize: '11px' }}>(THIS MONTH)</span>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', color: '#0F172A', fontFamily: "'DM Sans', sans-serif" }}>
                    90.2%
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>AVAILABILITY</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', color: '#0F172A', fontFamily: "'DM Sans', sans-serif" }}>
                    88.7%
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>PERFORMANCE</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', color: '#0F172A', fontFamily: "'DM Sans', sans-serif" }}>
                    90.1%
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>QUALITY</span>
                </div>

                <span style={{ fontSize: '18px', fontWeight: '800', color: '#64748B' }}>=</span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', color: '#FFFFFF', fontFamily: "'DM Sans', sans-serif" }}>
                    86.3%
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#1e3a8a', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>OEE</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
                <div><span style={{ color: '#64748B' }}>Planned Time:</span> <strong>744.0 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Ideal Cycle Time:</span> <strong>744.0 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Total Output:</span> <strong>4,862 Nos</strong></div>

                <div><span style={{ color: '#64748B' }}>Run Time:</span> <strong>671.5 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Actual Cycle Time:</span> <strong>838.2 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Good Output:</span> <strong>4,746 Nos</strong></div>

                <div><span style={{ color: '#64748B' }}>Downtime:</span> <strong style={{ color: '#DC2626' }}>72.5 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Performance Loss:</span> <strong style={{ color: '#D97706' }}>94.2 Hrs</strong></div>
                <div><span style={{ color: '#64748B' }}>Rejects:</span> <strong style={{ color: '#DC2626' }}>116 Nos</strong></div>
              </div>
            </div>
          )}

          {/* 5. SHIFT WISE PRODUCTION */}
          <div className="section-card" style={{ padding: '14px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'DM Sans', sans-serif" }}>
              SHIFT WISE PRODUCTION
            </span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '5px 6px', fontWeight: '700' }}>Shift</th>
                  <th style={{ padding: '5px 6px', fontWeight: '700' }}>Actual</th>
                  <th style={{ padding: '5px 6px', fontWeight: '700' }}>Achiev.%</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '6px 6px', color: '#334155', fontWeight: '600' }}>1st Shift (06:00-02:00)</td>
                  <td style={{ padding: '6px 6px', fontWeight: '700' }}>2,438</td>
                  <td style={{ padding: '6px 6px', color: '#16A34A', fontWeight: '800' }}>92.4%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '6px 6px', color: '#334155', fontWeight: '600' }}>2nd Shift (02:00-10:00)</td>
                  <td style={{ padding: '6px 6px', fontWeight: '700' }}>2,424</td>
                  <td style={{ padding: '6px 6px', color: '#16A34A', fontWeight: '800' }}>91.8%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 6. TODAY'S SNAPSHOT */}
          <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, boxSizing: 'border-box' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TODAY'S SNAPSHOT
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Today's Plan</span>
                <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>253</strong>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Today's Prod.</span>
                <strong style={{ fontSize: '15px', color: '#16A34A', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>241</strong>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Achiev. %</span>
                <strong style={{ fontSize: '15px', color: '#2563EB', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>95.3%</strong>
              </div>

              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#991B1B', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Rejection</span>
                <strong style={{ fontSize: '15px', color: '#DC2626', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>5</strong>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Operators</span>
                <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>24</strong>
              </div>

              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', color: '#166534', fontWeight: '700', display: 'block', fontFamily: "'DM Sans', sans-serif" }}>Machines</span>
                <strong style={{ fontSize: '15px', color: '#16A34A', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>6/8</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE PRODUCTION WORK ORDER MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '460px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Factory style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Create Production Work Order</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}>×</button>
            </div>

            <form onSubmit={handleCreateWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Product / Profile</label>
                <select
                  value={newWO.productName}
                  onChange={(e) => setNewWO({ ...newWO, productName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: '600', backgroundColor: '#F8FAFC' }}
                >
                  <option value="Mini Rail 100 mm">Mini Rail 100 mm</option>
                  <option value="Long Rail 3000 mm">Long Rail 3000 mm</option>
                  <option value="Mid Clamp 35 mm">Mid Clamp 35 mm</option>
                  <option value="End Clamp 35 mm">End Clamp 35 mm</option>
                  <option value="Alu. Bracket">Alu. Bracket</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Planned Qty (Nos)</label>
                  <input
                    type="number"
                    value={newWO.plannedQty}
                    onChange={(e) => setNewWO({ ...newWO, plannedQty: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: '600', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Target Date</label>
                  <input
                    type="date"
                    value={newWO.targetDate}
                    onChange={(e) => setNewWO({ ...newWO, targetDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: '600', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Raw Material Requirement</label>
                <input
                  type="text"
                  value={newWO.rawMaterial}
                  onChange={(e) => setNewWO({ ...newWO, rawMaterial: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: '600', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Customer / Client Name</label>
                <input
                  type="text"
                  value={newWO.customer}
                  onChange={(e) => setNewWO({ ...newWO, customer: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: '600', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  Sync to Zoho Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
