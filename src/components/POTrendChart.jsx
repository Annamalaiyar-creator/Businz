import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, ChevronRight } from 'lucide-react';

export default function POTrendChart({ purchaseOrders = [], sidebarCollapsed }) {
  const canvasRef = useRef(null);
  const [filter, setFilter] = useState('Month');
  const [activeIndex, setActiveIndex] = useState(6);

  const safeOrders = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  const monthLabels = ['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26', 'Jul-26'];

  const monthlyValues = monthLabels.map(m => {
    const matching = safeOrders.filter(po => {
      const d = String(po.poDate || po.date || '').toLowerCase();
      return d.includes(m.toLowerCase().slice(0, 3));
    });
    const sum = matching.reduce((acc, po) => {
      return acc + (Number(String(po.amount || po.total || 0).replace(/[^0-9.]+/g, '')) || 0);
    }, 0);
    const crValue = sum > 0 ? (sum / 10000000) : 0;
    return {
      date: m,
      crValue,
      val: `₹${sum.toLocaleString('en-IN')} (${matching.length} POs)`
    };
  });

  const tooltipData = monthlyValues;

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const paddingLeft = 36;
    const paddingRight = 20;
    const graphWidth = rect.width - paddingLeft - paddingRight;
    const count = 7;
    
    let idx = Math.round(((x - paddingLeft) / graphWidth) * (count - 1));
    if (idx < 0) idx = 0;
    if (idx > count - 1) idx = count - 1;
    
    if (idx !== activeIndex) {
      setActiveIndex(idx);
    }
  };

  const handleMouseLeave = () => {
    setActiveIndex(6);
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth * window.devicePixelRatio;
    canvas.height = container.clientHeight * window.devicePixelRatio;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, container.clientWidth, container.clientHeight);

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const paddingLeft = 36;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const yLabels = ['5 Cr', '4 Cr', '3 Cr', '2 Cr', '1 Cr', '0'];
    const gridRows = 5;

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, system-ui';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridRows; i++) {
      const y = paddingTop + (graphHeight / gridRows) * i;
      
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillText(yLabels[i], paddingLeft - 8, y + 4);
    }
    ctx.setLineDash([]);

    const months = ['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26', 'Jul-26'];
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
      const x = paddingLeft + (graphWidth / (months.length - 1)) * i;
      ctx.fillText(m, x, height - 10);
    });

    const dataValues = monthlyValues.map(m => m.crValue);
    const maxVal = Math.max(5, ...dataValues);

    const points = dataValues.map((val, i) => {
      return {
        x: paddingLeft + (graphWidth / (months.length - 1)) * i,
        y: paddingTop + graphHeight - (graphHeight * (val / maxVal))
      };
    });

    const activePoint = points[activeIndex];
    const columnWidth = 28;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(activePoint.x - (columnWidth / 2), paddingTop, columnWidth, graphHeight, 8);
    } else {
      ctx.rect(activePoint.x - (columnWidth / 2), paddingTop, columnWidth, graphHeight);
    }
    ctx.fill();

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

    const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + graphHeight);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');
    ctx.fillStyle = gradient;
    drawSpline(true);
    ctx.fill();

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSpline(false);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(activePoint.x, activePoint.y, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    const tooltipW = 110;
    const tooltipH = 46;
    let tooltipX = activePoint.x - (tooltipW / 2);
    
    // Boundary collision checks to prevent clipping
    if (tooltipX < paddingLeft) {
      tooltipX = paddingLeft;
    }
    if (tooltipX + tooltipW > width - paddingRight) {
      tooltipX = width - paddingRight - tooltipW;
    }
    
    const tooltipY = activePoint.y - tooltipH - 12;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 8);
    } else {
      ctx.rect(tooltipX, tooltipY, tooltipW, tooltipH);
    }
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 9px Inter, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(tooltipData[activeIndex].date, tooltipX + 10, tooltipY + 16);

    const valText = tooltipData[activeIndex].val;
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 10px Inter, system-ui';
    ctx.fillText(valText, tooltipX + 10, tooltipY + 30);
    
    const valWidth = ctx.measureText(valText).width;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'normal 9px Inter, system-ui';
    ctx.fillText(' value', tooltipX + 10 + valWidth, tooltipY + 30);
  };

  useEffect(() => {
    drawChart();
    window.addEventListener('resize', drawChart);
    const timer = setTimeout(drawChart, 210);

    return () => {
      window.removeEventListener('resize', drawChart);
      clearTimeout(timer);
    };
  }, [sidebarCollapsed, activeIndex]);

  return (
    <div 
      className="section-card" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        padding: 0, 
        overflow: 'hidden',
        gridColumn: 'span 2'
      }}
    >
      {/* Header section */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: 'var(--spacing-16) var(--spacing-24) 0 var(--spacing-24)' 
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          Purchase Order Trend
        </span>
        <button className="btn btn-icon" style={{ width: '32px', height: '32px' }}>
          <MoreHorizontal style={{ width: '16px', height: '16px', color: 'var(--color-text-secondary)' }} />
        </button>
      </div>

      {/* Chart Canvas Area */}
      <div style={{ position: 'relative', flex: 1, minHeight: '190px', width: '100%', padding: '0 16px' }}>
        <canvas 
          ref={canvasRef} 
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
        ></canvas>
      </div>

      {/* Bottom Separator Action Bar */}
      <div 
        style={{ 
          padding: '12px var(--spacing-24)', 
          borderTop: '1px solid var(--color-border)',
          backgroundColor: '#fafbfc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {/* Segmented Filter Control */}
        <div 
          style={{ 
            display: 'flex', 
            border: '1px solid var(--color-border)', 
            borderRadius: '8px', 
            overflow: 'hidden',
            backgroundColor: 'white'
          }}
        >
          {['Month', 'Year'].map((opt) => (
            <button 
              key={opt}
              onClick={() => setFilter(opt)}
              style={{
                border: 'none',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: filter === opt ? '#f1f5f9' : 'transparent',
                color: filter === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderRight: opt !== 'Year' ? '1px solid var(--color-border)' : 'none'
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* View report Link */}
        <a 
          href="#" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '6px 12px',
            backgroundColor: 'white',
            fontSize: '11px', 
            fontWeight: 'bold', 
            color: 'var(--color-text-primary)',
            textDecoration: 'none'
          }}
        >
          View report
          <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--color-text-secondary)' }} />
        </a>
      </div>
    </div>
  );
}
