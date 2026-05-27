import React, { useState } from 'react';
import { X, MapPin } from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export default function CreateTripModal({ isOpen, onClose, onCreate }: CreateTripModalProps) {
  const [newTripName, setNewTripName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;
    setLoading(true);
    try {
      await onCreate(newTripName.trim());
      setNewTripName('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-opacity duration-300">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-white flex items-center justify-center gap-2">
          <span>🏕️</span> 建立新旅遊群組
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              id="newTripNameInput"
              className="w-full padding-control bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-3 px-4 text-base focus:outline-none focus:border-[#58a6ff] focus:ring-3 focus:ring-[#58a6ff]/15 transition-all placeholder:text-[#484f58]"
              placeholder="例如：2026 沖繩夏日大冒險 🐕"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="bg-blue-950/20 border border-blue-900/40 text-blue-400 p-3 rounded-lg text-left text-xs leading-relaxed">
            💡 建立旅程後，您將自動加入為第一位旅伴。之後可以分享網址給其他旅伴，他們點開即可加入共同記帳！
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !newTripName.trim()}
              className="flex-1 bg-gradient-to-r from-[#1f6feb] to-[#388bfd] hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
            >
              {loading ? '正在建立...' : '確認建立 🗺️'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-300 font-semibold py-3 rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
