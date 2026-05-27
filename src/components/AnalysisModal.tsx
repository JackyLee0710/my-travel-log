import React, { useEffect, useRef } from 'react';
import { X, TrendingUp, BarChart2, PieChart } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { Expense, Category } from '../types';

// Register all standard Chart.js modules
Chart.register(...registerables);

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: Expense[];
  exchangeRate: number;
  categories: Category[];
}

export default function AnalysisModal({
  isOpen,
  onClose,
  records,
  exchangeRate,
  categories
}: AnalysisModalProps) {
  const categoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const paymentChartRef = useRef<HTMLCanvasElement | null>(null);
  const dailyChartRef = useRef<HTMLCanvasElement | null>(null);

  const categoryInstanceRef = useRef<Chart | null>(null);
  const paymentInstanceRef = useRef<Chart | null>(null);
  const dailyInstanceRef = useRef<Chart | null>(null);

  // Compute metrics
  const filteredExpenses = records.filter(r => r.paymentMethod !== '交通卡');
  const totalCount = filteredExpenses.length;

  let maxExpenseText = '無';
  let avgExpenseVal = 0;
  let topCategoryText = '無';

  if (totalCount > 0) {
    let maxTwd = -1;
    let totalTwd = 0;
    const catSums: { [key: string]: number } = {};

    filteredExpenses.forEach(r => {
      const amt = Number(r.amount) || 0;
      const twd = r.currency === 'JPY' ? amt * exchangeRate : amt;
      totalTwd += twd;

      if (twd > maxTwd) {
        maxTwd = twd;
        maxExpenseText = `${r.title} (${r.currency === 'JPY' ? '¥' : '$'}${amt.toLocaleString()})`;
      }

      catSums[r.category] = (catSums[r.category] || 0) + twd;
    });

    avgExpenseVal = Math.round(totalTwd / totalCount);

    // Find top category
    let bestCat = '';
    let bestCatSum = -1;
    Object.entries(catSums).forEach(([cat, sum]) => {
      if (sum > bestCatSum) {
        bestCat = cat;
        bestCatSum = sum;
      }
    });

    if (bestCat) {
      const catObj = categories.find(c => c.name === bestCat);
      topCategoryText = catObj ? `${catObj.emoji} ${bestCat}` : bestCat;
    }
  }

  useEffect(() => {
    if (!isOpen || totalCount === 0) return;

    // Destroy existing instances to prevent overlays
    if (categoryInstanceRef.current) categoryInstanceRef.current.destroy();
    if (paymentInstanceRef.current) paymentInstanceRef.current.destroy();
    if (dailyInstanceRef.current) dailyInstanceRef.current.destroy();

    // Compile chart data
    const catSums: { [key: string]: number } = {};
    const paySums: { [key: string]: number } = {};
    const dailySums: { [key: string]: number } = {};

    filteredExpenses.forEach(r => {
      const amt = Number(r.amount) || 0;
      const twd = r.currency === 'JPY' ? amt * exchangeRate : amt;

      // Category sum
      const catName = r.category || '其它';
      catSums[catName] = (catSums[catName] || 0) + twd;

      // Payment method sum
      const payName = `${r.paymentMethod}${r.cardName ? ` (${r.cardName})` : ''}`;
      paySums[payName] = (paySums[payName] || 0) + twd;

      // 日期加總 (Format YYYY-MM-DD to MM/DD)
      const datePart = r.date.split('T')[0];
      const parts = datePart.split('-');
      const label = parts.length >= 3 ? `${Number(parts[1])}/${Number(parts[2])}` : datePart;
      dailySums[label] = (dailySums[label] || 0) + twd;
    });

    // 1. Render Category Chart (Doughnut)
    if (categoryChartRef.current) {
      const labels = Object.keys(catSums);
      const data = Object.values(catSums).map(v => Math.round(v));
      const colors = labels.map(label => {
        const cat = categories.find(c => c.name === label);
        return cat ? cat.color : '#4B5563';
      });

      categoryInstanceRef.current = new Chart(categoryChartRef.current, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderColor: '#161b22',
            borderWidth: 1.5,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#c9d1d9', font: { size: 10, family: 'sans-serif' } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: NT$ ${ctx.parsed.toLocaleString()}`
              }
            }
          }
        }
      });
    }

    // 2. Render Payment Chart (Pie)
    if (paymentChartRef.current) {
      const labels = Object.keys(paySums);
      const data = Object.values(paySums).map(v => Math.round(v));
      const baseColors: { [key: string]: string } = {
        '震': '#58a6ff',
        '沛': '#ff7b72',
        '現金': '#e3b341',
        '交通卡': '#8b949e'
      };
      const colors = labels.map(label => {
        for (const k in baseColors) {
          if (label.startsWith(k)) return baseColors[k];
        }
        return '#79c0ff';
      });

      paymentInstanceRef.current = new Chart(paymentChartRef.current, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderColor: '#161b22',
            borderWidth: 1.5,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#c9d1d9', font: { size: 10, family: 'sans-serif' } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: NT$ ${ctx.parsed.toLocaleString()}`
              }
            }
          }
        }
      });
    }

    // 3. Render Daily Trend Chart (Line)
    if (dailyChartRef.current) {
      // Sort keys chronologically
      const sortedDays = Object.keys(dailySums).sort((a, b) => {
        const parseDay = (s: string) => {
          const parts = s.split('/');
          return parts.length === 2 ? Number(parts[0]) * 100 + Number(parts[1]) : 0;
        };
        return parseDay(a) - parseDay(b);
      });
      const data = sortedDays.map(day => Math.round(dailySums[day]));

      dailyInstanceRef.current = new Chart(dailyChartRef.current, {
        type: 'line',
        data: {
          labels: sortedDays,
          datasets: [{
            label: '每日消費',
            data: data,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#58a6ff',
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { color: '#21262d' },
              ticks: { color: '#8b949e', font: { size: 9 } }
            },
            y: {
              grid: { color: '#21262d' },
              ticks: { color: '#8b949e', font: { size: 9 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` 總額: NT$ ${ctx.parsed.y.toLocaleString()}`
              }
            }
          }
        }
      });
    }

    return () => {
      // Clean up instances on unload
      if (categoryInstanceRef.current) categoryInstanceRef.current.destroy();
      if (paymentInstanceRef.current) paymentInstanceRef.current.destroy();
      if (dailyInstanceRef.current) dailyInstanceRef.current.destroy();
    };
  }, [isOpen, records, exchangeRate, categories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center border-b border-[#30363d] pb-3 mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📊 沖繩旅行開銷分析
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {totalCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400 text-sm italic">
            <span>🏝️ 目前尚無消費數據可供圖表分析！</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Highlights Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-center">
                <div className="text-[11px] text-gray-400">🏆 最大單筆支出</div>
                <div className="text-xs font-bold text-[#ff7b72] mt-1 truncate" title={maxExpenseText}>
                  {maxExpenseText}
                </div>
              </div>
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-center">
                <div className="text-[11px] text-gray-400">🏷️ 最常消費類別</div>
                <div className="text-xs font-bold text-[#e3b341] mt-1 truncate">
                  {topCategoryText}
                </div>
              </div>
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-center">
                <div className="text-[11px] text-gray-400">☕ 平均單筆金額</div>
                <div className="text-xs font-bold text-[#58a6ff] mt-1 font-mono">
                  NT$ {avgExpenseVal.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21262d] text-center">
                <div className="text-[11px] text-gray-400">📊 行程記帳筆數</div>
                <div className="text-xs font-bold text-[#39d353] mt-1">
                  {totalCount} 筆
                </div>
              </div>
            </div>

            {/* Category Chart Container */}
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#21262d] space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#58a6ff] font-bold justify-center">
                <PieChart className="w-3.5 h-3.5" /> 消費類別比例分佈
              </div>
              <div className="relative h-44 w-full">
                <canvas ref={categoryChartRef}></canvas>
              </div>
            </div>

            {/* Payment Method Chart Container */}
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#21262d] space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#58a6ff] font-bold justify-center">
                <BarChart2 className="w-3.5 h-3.5" /> 支付方式與代墊佔比
              </div>
              <div className="relative h-44 w-full">
                <canvas ref={paymentChartRef}></canvas>
              </div>
            </div>

            {/* Daily Trend Chart Container */}
            <div className="bg-[#0d1117] p-4 rounded-xl border border-[#21262d] space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#58a6ff] font-bold justify-center">
                <TrendingUp className="w-3.5 h-3.5" /> 每日消費趨勢變動 (台幣折算)
              </div>
              <div className="relative h-40 w-full">
                <canvas ref={dailyChartRef}></canvas>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-[#30363d]">
          <button
            onClick={onClose}
            className="w-full bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-300 font-semibold py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
