import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Category } from '../types';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  hiddenCategories: string[];
  onSave: (cat: Category, editingName: string | null) => void;
  onUnhide: (name: string) => void;
  onEditClick: (cat: Category) => void;
  editingCategory: Category | null;
}

export default function AddCategoryModal({
  isOpen,
  onClose,
  categories,
  hiddenCategories,
  onSave,
  onUnhide,
  onEditClick,
  editingCategory
}: AddCategoryModalProps) {
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');

  useEffect(() => {
    if (editingCategory) {
      setEmoji(editingCategory.emoji);
      setName(editingCategory.name);
      setColor(editingCategory.color);
    } else {
      setEmoji('');
      setName('');
      setColor('#3B82F6');
    }
  }, [editingCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emoji.trim() || !name.trim() || !color) return;

    onSave(
      {
        emoji: emoji.trim(),
        name: name.trim(),
        color: color
      },
      editingCategory ? editingCategory.name : null
    );

    // reset fields
    setEmoji('');
    setName('');
    setColor('#3B82F6');
  };

  const hiddenObjs = categories.filter((c) => hiddenCategories.includes(c.name));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all duration-300">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-white">
          {editingCategory ? '✏️ 修改分類項目' : '🍣 新增/管理分類項目'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">分類符號 / Emoji</label>
              <input
                type="text"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-2.5 px-3 text-base focus:outline-none focus:border-[#58a6ff] focus:ring-2 focus:ring-[#58a6ff]/15 transition-all"
                placeholder="輸入 Emoji (如: 🍣)"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">分類名稱</label>
              <input
                type="text"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-2.5 px-3 text-base focus:outline-none focus:border-[#58a6ff] focus:ring-2 focus:ring-[#58a6ff]/15 transition-all"
                placeholder="分類名稱 (如: 美食飲料)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">分類色調</label>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-10 border border-[#30363d] rounded-xl overflow-hidden cursor-pointer bg-[#0d1117]">
                  <input
                    type="color"
                    className="absolute -top-2 -left-2 w-[200%] h-[200%] border-0 cursor-pointer p-0 bg-transparent"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
                <div
                  className="w-10 h-10 rounded-xl border border-[#30363d] transition-colors duration-200"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-400 text-xs font-mono">{color.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#1f6feb] to-[#388bfd] hover:brightness-110 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md cursor-pointer text-sm"
            >
              {editingCategory ? '儲存變更' : '新增分類'}
            </button>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-[#30363d]">
            <h3 className="text-xs font-bold text-slate-300">隱藏的分類</h3>
            <div className="border border-[#30363d] rounded-xl bg-[#0d1117] max-h-[140px] overflow-y-auto divide-y divide-[#21262d]">
              {hiddenObjs.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 italic">無隱藏的分類</div>
              ) : (
                hiddenObjs.map((cat) => (
                  <div key={cat.name} className="flex justify-between items-center p-2 text-xs">
                    <span className="text-gray-300 flex items-center gap-1.5">
                      <span className="inline-block p-1 rounded-md" style={{ backgroundColor: `${cat.color}22`, border: `1px solid ${cat.color}` }}>
                        {cat.emoji}
                      </span>
                      <span>{cat.name}</span>
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditClick(cat)}
                        className="bg-[#21262d] hover:bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-[11px]"
                      >
                        修改
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnhide(cat.name)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 py-1 px-2.5 rounded-lg transition-colors cursor-pointer text-[11px]"
                      >
                        還原顯示
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>

        <div className="mt-4 pt-2">
          <button
            type="button"
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
