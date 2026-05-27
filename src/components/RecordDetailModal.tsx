import React from 'react';
import { X, Trash2, Edit2 } from 'lucide-react';
import { Expense } from '../types';

interface RecordDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onEdit: () => void;
  onDelete: () => void;
  exchangeRate: number;
}

export default function RecordDetailModal({
  isOpen,
  onClose,
  expense,
  onEdit,
  onDelete,
  exchangeRate
}: RecordDetailModalProps) {
  if (!isOpen || !expense) return null;

  const recDate = new Date(expense.date);
  const formattedDate = isNaN(recDate.getTime()) ? expense.date : recDate.toLocaleString('zh-TW', { hour12: false });
  const isJpy = expense.currency === 'JPY';
  const displayAmount = `${isJpy ? '¥' : '$'}${Number(expense.amount || 0).toLocaleString()}`;
  const convertedTwd = isJpy ? Math.round(expense.amount * exchangeRate) : null;

  // Shorten user emails for cleaner metadata display
  const userAlias = expense.userEmail ? expense.userEmail.split('@')[0] : '未知';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-white border-b border-[#21262d] pb-3">
          消費明細詳情 🗺️
        </h2>

        <div className="space-y-3 p-4 bg-[#0d1117] border border-[#21262d] rounded-xl text-gray-300 text-sm">
          <div className="flex justify-between py-1 border-b border-[#161b22]">
            <span className="text-gray-500 font-medium">消費項目:</span>
            <span className="font-semibold text-white text-right break-all">{expense.title}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-[#161b22]">
            <span className="text-gray-500 font-medium">分類標籤:</span>
            <span className="font-semibold text-white">{expense.category || '未分類'}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-[#161b22]">
            <span className="text-gray-500 font-medium">代墊金額:</span>
            <span className="font-bold text-[#58a6ff] text-base font-mono">{displayAmount}</span>
          </div>

          {convertedTwd !== null && (
            <div className="flex justify-between py-1 border-b border-[#161b22]">
              <span className="text-gray-500 font-medium">台幣換算:</span>
              <span className="font-semibold text-emerald-400 font-mono">≈ NT$ {convertedTwd.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between py-1 border-b border-[#161b22]">
            <span className="text-gray-500 font-medium">支付方式:</span>
            <span className="font-semibold text-white">
              {expense.paymentMethod} {expense.cardName ? `(${expense.cardName})` : ''}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-[#161b22]">
            <span className="text-gray-500 font-medium">記帳時間:</span>
            <span className="font-semibold text-white text-right">{formattedDate}</span>
          </div>

          <div className="flex justify-between py-1 text-xs text-gray-500 font-mono mt-2 pt-2 border-t border-[#21262d]">
            <span>寫入帳號:</span>
            <span>{userAlias}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onEdit}
            className="flex-1 bg-gradient-to-r from-[#238636] to-[#2ea043] hover:brightness-110 text-white font-semibold flex items-center justify-center gap-1.5 py-3 rounded-xl transition-all shadow-md cursor-pointer text-sm"
          >
            <Edit2 className="w-4 h-4" /> 編輯
          </button>
          <button
            onClick={onDelete}
            className="flex-1 bg-gradient-to-r from-[#da3633] to-[#f85149] hover:brightness-110 text-white font-semibold flex items-center justify-center gap-1.5 py-3 rounded-xl transition-all shadow-md cursor-pointer text-sm"
          >
            <Trash2 className="w-4 h-4" /> 刪除
          </button>
        </div>

        <div className="mt-3">
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
