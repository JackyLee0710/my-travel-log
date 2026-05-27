import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Share2, 
  LogOut, 
  Globe, 
  FolderPlus, 
  Sliders, 
  Download, 
  Upload, 
  Check, 
  MapPin, 
  AlertCircle, 
  Coins, 
  Clock, 
  ChevronDown, 
  BarChart3, 
  Trash, 
  UserPlus, 
  Settings, 
  ArrowRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { Trip, Expense, Category } from './types';
import CreateTripModal from './components/CreateTripModal';
import AddCategoryModal from './components/AddCategoryModal';
import RecordDetailModal from './components/RecordDetailModal';
import AnalysisModal from './components/AnalysisModal';

// Initial categories definition
const initialCategories: Category[] = [
  { name: "美食飲料", emoji: "🍣", color: "#EA580C" },
  { name: "衣服飾品", emoji: "👕", color: "#2563EB" },
  { name: "當地住宿", emoji: "🏠", color: "#10B981" },
  { name: "大眾運輸", emoji: "🚌", color: "#FFFFFF" },
  { name: "門票費用", emoji: "🤿", color: "#0D9488" },
  { name: "神社參拜", emoji: "⛩️", color: "#C83232" },
  { name: "紀念品", emoji: "🗾", color: "#7878FF" },
  { name: "伴手禮", emoji: "🎁", color: "#F0A30A" },
  { name: "我哪知道", emoji: "🤷", color: "#4B5563" },
  { name: "去程機票", emoji: "✈️", color: "#388BFD" },
  { name: "回程機票", emoji: "✈️", color: "#388BFD" }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Trips lists
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [targetTripToJoin, setTargetTripToJoin] = useState<Trip | null>(null);

  // Master records
  const [records, setRecords] = useState<Expense[]>([]);

  // Config categories
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Split-bill exchange rate
  const [exchangeRate, setExchangeRate] = useState<number>(0.2);

  // New item form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'JPY' | 'TWD'>('JPY');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPayer, setSelectedPayer] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [timestamp, setTimestamp] = useState('');

  // Active form editing ID
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Modals state
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isRecordDetailOpen, setIsRecordDetailOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState<Expense | null>(null);

  // Custom modal-style alert notifications
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);

  // Haptic feedback particles (Confetti animation inside React)
  const [confettis, setConfettis] = useState<{ id: number; left: number; top: number; color: string; delay: number; duration: number }[]>([]);

  const triggerHaptic = (ms = 15) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const showFlash = (text: string, isError = false) => {
    setNotification({ text, isError });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const throwConfetti = () => {
    const colors = ['#58a6ff', '#388bfd', '#1f6feb', '#2ea043', '#f2cc60'];
    const newConfettis = Array.from({ length: 50 }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      top: -20,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.8,
      duration: Math.random() * 2 + 1.5
    }));
    setConfettis(newConfettis);
    setTimeout(() => {
      setConfettis([]);
    }, 4000);
  };

  const getFormattedCurrentTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // 1. Setup Auth state changed observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Load Whitelist state verified
        try {
          const userEmail = user.email || '';
          if (!userEmail) {
            setIsAuthorized(false);
            setAuthLoading(false);
            return;
          }

          // Case-insensitive query path read
          const whitelistRef = doc(db, 'allowed_users', userEmail.toLowerCase());
          const whitelistSnap = await getDoc(whitelistRef);

          if (whitelistSnap.exists()) {
            setIsAuthorized(true);
          } else {
            console.warn(`User ${userEmail} is not present in allowed_users collection.`);
            setIsAuthorized(false);
          }
        } catch (err) {
          console.error("Failed to verify user whitelist:", err);
          // If the whitelist collection does not exist or permission denied, let's fallback to prompt the user
          setIsAuthorized(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthorized(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Load Local Preferences
  useEffect(() => {
    const localRate = localStorage.getItem('exchangeRate');
    if (localRate) setExchangeRate(parseFloat(localRate));

    const localCategories = localStorage.getItem('categories');
    if (localCategories) setCategories(JSON.parse(localCategories));

    const localHiddenCategories = localStorage.getItem('hiddenCategories');
    if (localHiddenCategories) setHiddenCategories(JSON.parse(localHiddenCategories));

    setTimestamp(getFormattedCurrentTime());
  }, []);

  // 3. Trip listing or sharing verification
  useEffect(() => {
    if (!currentUser || isAuthorized !== true) return;

    const tripsCol = collection(db, 'trips');
    const q = query(tripsCol, where('members', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Trip[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Trip);
      });

      // Sort trips by newest first
      list.sort((a, b) => b.id.localeCompare(a.id));
      setTrips(list);

      // Handle query string or default selections
      const params = new URLSearchParams(window.location.search);
      const urlTripId = params.get('trip');

      if (urlTripId) {
        // Check if the user is a current member of the requested trip from url
        const userIsMember = list.some(t => t.id === urlTripId);
        if (userIsMember) {
          setSelectedTripId(urlTripId);
          setTargetTripToJoin(null);
        } else {
          // Fetch trip document dynamically to invite them to join
          const tripDocRef = doc(db, 'trips', urlTripId);
          getDoc(tripDocRef).then((tripSnap) => {
            if (tripSnap.exists()) {
              setTargetTripToJoin({ id: tripSnap.id, ...tripSnap.data() } as Trip);
              setSelectedTripId('');
            } else {
              showFlash('該旅群連結或代碼已失效 ❌', true);
              if (list.length > 0) {
                setSelectedTripId(list[0].id);
              }
            }
          }).catch(err => {
            console.error("Failed to check invitation details:", err);
          });
        }
      } else {
        // Fallback to local storage choice
        const storedTripId = localStorage.getItem('selectedTripId');
        if (storedTripId && list.some(t => t.id === storedTripId)) {
          setSelectedTripId(storedTripId);
        } else if (list.length > 0) {
          setSelectedTripId(list[0].id);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trips');
    });

    return () => unsubscribe();
  }, [currentUser, isAuthorized]);

  // 4. Expenses Real-time Sync snapshot listener
  useEffect(() => {
    if (!selectedTripId || !currentUser || isAuthorized !== true) {
      setRecords([]);
      return;
    }

    const expensesCol = collection(db, 'trips', selectedTripId, 'expenses');
    const unsubscribeSnapshot = onSnapshot(expensesCol, (snapshot) => {
      const expensesList: Expense[] = [];
      snapshot.forEach(docSnap => {
        expensesList.push({ id: docSnap.id, ...docSnap.data() } as Expense);
      });

      // Sort by datetime (descending)
      expensesList.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(expensesList);
    }, (error) => {
      // Gracefully capture constraints & errors
      if (error.code === 'permission-denied') {
        console.warn("User does not have access permissions for this trip expense subcollection.");
      } else {
        handleFirestoreError(error, OperationType.LIST, `trips/${selectedTripId}/expenses`);
      }
    });

    return () => unsubscribeSnapshot();
  }, [selectedTripId, currentUser, isAuthorized]);

  // Handle Google Auth Pop-up login
  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      triggerHaptic(25);
    } catch (err: any) {
      console.error(err);
      showFlash(`登入失敗: ${err.message}`, true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setAuthLoading(true);
      await signOut(auth);
      setTrips([]);
      setRecords([]);
      setSelectedTripId('');
      setTargetTripToJoin(null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Create a Trip document
  const handleCreateTrip = async (name: string) => {
    if (!currentUser) return;
    try {
      const tripId = `TRIP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const tripDocRef = doc(db, 'trips', tripId);
      
      const newTrip: Trip = {
        id: tripId,
        name,
        members: [currentUser.uid],
        createdAt: new Date().toISOString()
      };

      await setDoc(tripDocRef, newTrip);
      
      localStorage.setItem('selectedTripId', tripId);
      setSelectedTripId(tripId);
      setTargetTripToJoin(null);

      // Update router query param
      const newUrl = `${window.location.origin}${window.location.pathname}?trip=${tripId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);

      showFlash(`成功建立旅群：「${name}」！`, false);
      throwConfetti();
      triggerHaptic(30);
    } catch (err: any) {
      console.error("Failed to make a trip:", err);
      showFlash('建立旅程失敗，請檢查權限 ❌', true);
    }
  };

  // Join shared trip by key/URL
  const handleJoinTrip = async () => {
    if (!currentUser || !targetTripToJoin) return;
    try {
      const tripDocRef = doc(db, 'trips', targetTripToJoin.id);
      await updateDoc(tripDocRef, {
        members: arrayUnion(currentUser.uid)
      });

      showFlash(`已成功加入「${targetTripToJoin.name}」共同記帳！🎉`, false);
      throwConfetti();
      triggerHaptic(30);

      setSelectedTripId(targetTripToJoin.id);
      localStorage.setItem('selectedTripId', targetTripToJoin.id);
      setTargetTripToJoin(null);
    } catch (err: any) {
      console.error("Failed to join trip:", err);
      showFlash('加入旅群遭遇權限拒絕！', true);
    }
  };

  // Copy current url to share
  const copyShareLink = () => {
    if (!selectedTripId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${selectedTripId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showFlash('分享特連結已複製！邀請旅伴點擊即可共同記帳 📎', false);
      triggerHaptic(20);
    }).catch(() => {
      showFlash(`手動複製連結碼：${shareUrl}`, false);
    });
  };

  // Category changes saving
  const handleSaveCategoryInApp = (cat: Category, editingName: string | null) => {
    let updated: Category[];
    if (editingName) {
      updated = categories.map(c => c.name === editingName ? cat : c);
      // Migrate corresponding hidden references down
      if (editingName !== cat.name) {
        const index = hiddenCategories.indexOf(editingName);
        if (index > -1) {
          const cpy = [...hiddenCategories];
          cpy[index] = cat.name;
          setHiddenCategories(cpy);
          localStorage.setItem('hiddenCategories', JSON.stringify(cpy));
        }
      }
      showFlash(`編輯分類「${cat.name}」完成`, false);
    } else {
      if (categories.some(c => c.name === cat.name)) {
        showFlash('此分類已存在！', true);
        return;
      }
      updated = [...categories, cat];
      showFlash(`已新增分類：${cat.name}`, false);
    }

    setCategories(updated);
    setEditingCategory(null);
    localStorage.setItem('categories', JSON.stringify(updated));
  };

  const handleUnhideCategoryInApp = (name: string) => {
    const list = hiddenCategories.filter(n => n !== name);
    setHiddenCategories(list);
    localStorage.setItem('hiddenCategories', JSON.stringify(list));
    showFlash(`已顯示分類：${name}`, false);
  };

  // Reset core tracking fields
  const handleResetForm = () => {
    setTitle('');
    setAmount('');
    setSelectedCategory('');
    setSelectedPayer('');
    setSelectedCard('');
    setTimestamp(getFormattedCurrentTime());
    setEditingExpenseId(null);
  };

  // Submit expense record to database
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTripId) {
      showFlash('您目前不在合法的旅群中！', true);
      return;
    }

    const valAmount = parseFloat(amount);
    if (!title.trim() || isNaN(valAmount) || valAmount <= 0 || !selectedCategory || !selectedPayer) {
      showFlash('請確實填寫項目、金額、分類和支付人！', true);
      triggerHaptic(40);
      return;
    }

    const expenseId = editingExpenseId || `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const collectionPath = `trips/${selectedTripId}/expenses`;
    const docRef = doc(db, collectionPath, expenseId);

    const data: Expense = {
      id: expenseId,
      title: title.trim(),
      amount: valAmount,
      currency,
      category: selectedCategory,
      paymentMethod: selectedPayer,
      cardName: (selectedPayer === '震' || selectedPayer === '沛') ? (selectedCard || '其他') : null,
      date: timestamp || new Date().toISOString(),
      userId: currentUser.uid,
      userEmail: currentUser.email || 'unknown@domain.com'
    };

    try {
      if (editingExpenseId) {
        // Merging server properties to avoid breaking timestamps
        const oldSnap = await getDoc(docRef);
        if (oldSnap.exists()) {
          const oldData = oldSnap.data() as Expense;
          data.createdAt = oldData.createdAt;
          data.userId = oldData.userId;
          data.userEmail = oldData.userEmail;
        }
      } else {
        data.createdAt = serverTimestamp();
      }

      await setDoc(docRef, data);
      showFlash(editingExpenseId ? '代墊消費數據修改成功 ✨' : '雲端記帳成功！💰', false);
      throwConfetti();
      triggerHaptic(30);
      handleResetForm();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `${collectionPath}/${expenseId}`);
    }
  };

  const handleEditRecordTrigger = () => {
    if (!activeExpense) return;
    setTitle(activeExpense.title);
    setAmount(String(activeExpense.amount));
    setCurrency(activeExpense.currency);
    setSelectedCategory(activeExpense.category);
    setSelectedPayer(activeExpense.paymentMethod);
    setSelectedCard(activeExpense.cardName || '');
    setTimestamp(activeExpense.date);
    setEditingExpenseId(activeExpense.id);

    setIsRecordDetailOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    triggerHaptic(15);
  };

  const handleDeleteRecordTrigger = async () => {
    if (!activeExpense || !selectedTripId) return;

    if (window.confirm(`確認要刪除「${activeExpense.title}」這項雲端記帳 record 嗎？`)) {
      const collectionPath = `trips/${selectedTripId}/expenses`;
      try {
        await deleteDoc(doc(db, collectionPath, activeExpense.id));
        showFlash('雲端支出已完全刪除 🗑️', false);
        setIsRecordDetailOpen(false);
        handleResetForm();
      } catch (err) {
        console.error(err);
        handleFirestoreError(err, OperationType.DELETE, `${collectionPath}/${activeExpense.id}`);
      }
    }
  };

  // Bulk export as CSV format
  const handleExportCsvInApp = () => {
    if (records.length === 0) {
      showFlash('目前此旅程尚無任何支出記帳資料！', true);
      return;
    }

    const header = 'ID,消費時間,項目,分類,幣別,金額,支付方式,卡別,代墊帳號\n';
    const rows = records.map(r => {
      const escape = (str: any) => {
        if (str === null || str === undefined) return '';
        let s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      return `${escape(r.id)},${escape(r.date)},${escape(r.title)},${escape(r.category)},${escape(r.currency)},${escape(r.amount)},${escape(r.paymentMethod)},${escape(r.cardName)},${escape(r.userEmail)}`;
    }).join('\n');

    const csvContent = header + rows;
    const UTF8_BOM = "\uFEFF"; 
    const blob = new Blob([UTF8_BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `沖繩即時雲端記帳表_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerHaptic(30);
    showFlash("已成功匯出 CSV 檔案到您的下載資料夾 📥", false);
  };

  // Bulk import via CSV
  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTripId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.trim().split('\n');
        if (lines.length <= 1) {
          showFlash('CSV 檔案規格不符合或為空 ❌', true);
          return;
        }

        // Slice header
        lines.shift();
        let addedCount = 0;

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse RFC4180 CSV safely with quotes
          const fields: string[] = [];
          let inQuote = false;
          let field = '';
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              if (i + 1 < line.length && line[i + 1] === '"') {
                field += '"';
                i++;
              } else {
                inQuote = !inQuote;
              }
            } else if (c === ',' && !inQuote) {
              fields.push(field.trim());
              field = '';
            } else {
              field += c;
            }
          }
          fields.push(field.trim());

          if (fields.length < 6) continue;

          const rawId = fields[0] || `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          const rawDate = fields[1] || new Date().toISOString();
          const rawTitle = fields[2] || '未命名項目';
          const rawCat = fields[3] || '我哪知道';
          const rawCurrency = (fields[4] || 'JPY').toUpperCase() === 'TWD' ? 'TWD' : 'JPY';
          const rawAmount = parseFloat(fields[5]) || 0;
          const rawPay = fields[6] || '現金';
          const rawCard = fields[7] || null;

          const recordData: Expense = {
            id: rawId,
            title: rawTitle,
            amount: rawAmount,
            currency: rawCurrency,
            category: rawCat,
            paymentMethod: rawPay,
            cardName: rawCard || null,
            date: rawDate,
            userId: currentUser?.uid || 'imported',
            userEmail: currentUser?.email || 'imported@domain.com',
            createdAt: serverTimestamp()
          };

          await setDoc(doc(db, 'trips', selectedTripId, 'expenses', rawId), recordData);
          addedCount++;
        }

        showFlash(`成功匯入 ${addedCount} 筆雲端數據！`, false);
        throwConfetti();
      } catch (err) {
        console.error(err);
        showFlash('檔案解析失敗，請確認檔案符合標準 CSV 格式！', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // High quality stats computation
  let jpySum = 0;
  let twdSum = 0;
  let jpyZhen = 0;
  let jpyPei = 0;
  let jpyCash = 0;
  let twdZhen = 0;
  let twdPei = 0;
  let twdCash = 0;

  records.forEach(r => {
    if (r.paymentMethod === '交通卡') return;
    const amt = Number(r.amount) || 0;
    if (r.currency === 'JPY') {
      jpySum += amt;
      if (r.paymentMethod === '震') jpyZhen += amt;
      if (r.paymentMethod === '沛') jpyPei += amt;
      if (r.paymentMethod === '現金') jpyCash += amt;
    } else {
      twdSum += amt;
      if (r.paymentMethod === '震') twdZhen += amt;
      if (r.paymentMethod === '沛') twdPei += amt;
      if (r.paymentMethod === '現金') twdCash += amt;
    }
  });

  const convertedOverallTwd = Math.round((jpySum * exchangeRate) + twdSum);

  const selectedTripObj = trips.find(t => t.id === selectedTripId);

  // Filter out custom excluded categories
  const activeCategoriesInSelector = categories.filter(c => !hiddenCategories.includes(c.name));

  // Loading indicator overlay
  if (authLoading) {
    return (
      <div className="min-height-screen w-full flex items-center justify-center p-4 bg-[#0e1117] text-gray-200">
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🏝️🐕</div>
          <h2 className="text-lg font-bold text-white">正在載入雲端開銷系統...</h2>
          <p className="text-xs text-gray-400 font-mono">正在驗證 Firebase Auth 狀態</p>
        </div>
      </div>
    );
  }

  // Google Login view
  if (!currentUser) {
    return (
      <div className="min-height-screen w-full flex items-center justify-center p-4 bg-[#0e1117] text-gray-200">
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-300">
          <div className="text-6xl">🏝️🪙</div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">沖繩旅程雲端帳本</h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">Senior Full-stack & Firebase Engine</p>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl text-left text-xs leading-relaxed">
            <strong>💡 系統說明：</strong><br />
            本系統已整合 Google 生態安全驗證與雙向 Firebase 即時數據快取。登入後可支援多旅件即時同步記帳、代墊分拆分析。
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-[#1f6feb] to-[#388bfd] hover:brightness-110 active:scale-98 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            🔑 透過 Google 帳號登入
          </button>
        </div>
      </div>
    );
  }

  // Whitelist Verification Error screen
  if (isAuthorized === false) {
    return (
      <div className="min-height-screen w-full flex items-center justify-center p-4 bg-[#0e1117] text-gray-200">
        <div className="bg-[#161b22] border border-[#e74c3c]/20 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
          <div className="text-6xl text-red-500">⚠️</div>
          <div>
            <h1 className="text-2xl font-extrabold text-red-500 tracking-tight">登入未經授權</h1>
            <p className="text-sm text-gray-400 mt-1">您的帳號尚未加入系統白名單！</p>
          </div>

          <div className="bg-[#0d1117] border border-[#21262d] p-3 rounded-xl">
            <span className="block text-xs text-gray-500 text-left font-semibold">目前嘗試登入的信箱：</span>
            <span className="block text-sm text-[#58a6ff] overflow-hidden truncate font-mono text-left font-bold mt-1">
              {currentUser.email}
            </span>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 text-yellow-400/90 text-left text-xs p-4 rounded-xl space-y-2">
            <strong className="text-yellow-400 font-bold block">✨ 系統啟用指南：</strong>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400 leading-normal">
              <li>請前往 Firebase Console 的 Firestore 控制網頁。</li>
              <li>新增一組名稱為 <strong className="text-white">allowed_users</strong> 的集合。</li>
              <li>建立文件：文件 ID 設為上方的電子信箱地址 (小寫)。</li>
              <li>在該文件內加入字串屬性 <strong className="text-white">email</strong>，值同樣輸入該信箱。</li>
            </ol>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-[#21262d] hover:bg-[#30363d] text-red-400 font-semibold py-3 rounded-xl border border-[#da3633]/50 transition-all cursor-pointer"
          >
            🚪 登出並返回登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0e1117] py-6 px-4 text-gray-200 font-sans relative overflow-x-hidden flex justify-center">
      {/* Floating dynamic render confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-50">
        {confettis.map(p => (
          <div
            key={p.id}
            className="absolute rounded-md rotate-12"
            style={{
              left: `${p.left}%`,
              top: `${p.top}px`,
              width: '8px',
              height: '8px',
              backgroundColor: p.color,
              animation: `fall ${p.duration}s linear ${p.delay}s forwards`
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-xl flex flex-col gap-5">
        
        {/* Dynamic global alerts popup and notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 p-4 border rounded-xl shadow-2xl flex items-start gap-2 backdrop-blur-md ${
                notification.isError 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                  : 'bg-[#1f6feb]/10 border-[#388bfd]/30 text-[#58a6ff]'
              }`}
            >
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold leading-relaxed break-all">
                {notification.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brand Banner Block */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-5 text-center relative shadow-md">
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider">Sync Live</span>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            沖繩快速記帳
          </h1>
          <p className="text-xs text-gray-400 mt-1">來去看沖繩狗勾囉～ 🐕🏝️</p>

          {/* User profile layout */}
          <div className="mt-4 p-3 bg-[#0d1117] rounded-xl border border-[#21262d] flex items-center justify-between text-xs text-left">
            <div className="flex items-center gap-2">
              <img 
                src={currentUser.photoURL || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"} 
                className="w-10 h-10 rounded-full border-1.5 border-[#388bfd] object-cover"
                alt="Avatar"
                referrerPolicy="no-referrer"
              />
              <div className="overflow-hidden max-w-[180px]">
                <span className="block font-bold text-white leading-none truncate">{currentUser.displayName || "沖繩冒險者"}</span>
                <span className="block text-[10px] text-gray-500 font-mono mt-0.5 truncate">{currentUser.email}</span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-[#ff7b72] border border-red-500/20 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" /> 登出
            </button>
          </div>

          {/* Trips selector block */}
          <div className="mt-4 p-4 bg-[#1f242c]/50 rounded-xl border border-[#30363d] space-y-3 text-left">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                ✈️ 選擇本次旅程:
              </span>
              <button
                onClick={() => setIsCreateTripOpen(true)}
                className="px-2.5 py-1 text-[11px] font-bold bg-[#39d353]/10 hover:bg-[#39d353]/15 text-[#39d353] border border-[#39d353]/20 rounded-md transition-all flex items-center gap-0.5 cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" /> 建立新旅程
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedTripId}
                  onChange={(e) => {
                    setSelectedTripId(e.target.value);
                    localStorage.setItem('selectedTripId', e.target.value);
                    // Update URL parameter
                    const newUrl = `${window.location.origin}${window.location.pathname}?trip=${e.target.value}`;
                    window.history.pushState({ path: newUrl }, '', newUrl);
                    setTargetTripToJoin(null);
                    triggerHaptic(10);
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] font-bold text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer"
                >
                  {trips.length === 0 ? (
                    <option value="" disabled>暫無群組，請先點建立行程...</option>
                  ) : (
                    trips.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  )}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {selectedTripId && (
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="px-3 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> 分享
                </button>
              )}
            </div>

            {/* Invite Join Group Banner */}
            {targetTripToJoin && (
              <div className="p-3 bg-yellow-500/5 border border-yellow-500/25 rounded-lg text-center space-y-2 animate-pulse">
                <p className="text-yellow-500 text-xs font-semibold">
                  👋 旅伴發現！您目前不在「{targetTripToJoin.name}」群組中！
                </p>
                <div className="flex justify-center">
                  <button
                    onClick={handleJoinTrip}
                    className="px-4 py-1.5 bg-[#f2cc60] hover:brightness-105 text-neutral-900 font-bold rounded-lg text-xs transition-transform transform active:scale-95 cursor-pointer"
                  >
                    ➕ 按此加入旅群，共同記帳
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Dashboard Banner */}
        <div className="bg-gradient-to-br from-[#161b22] to-[#1f242c] border border-[#30363d] rounded-2xl p-4 gap-3 flex flex-col shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#10b981] flex items-center gap-1.5 border-l-3 border-[#10b981] pl-2">
              📊 旅程開銷與分帳試算
            </span>
            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              日幣匯率:
              <input 
                type="number"
                step="0.001"
                min="0.01"
                className="w-14 bg-[#0d1117] border border-[#30363d] rounded-md text-center text-[#58a6ff] text-xs font-bold font-mono py-0.5"
                value={exchangeRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0.2;
                  setExchangeRate(rate);
                  localStorage.setItem('exchangeRate', String(rate));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Click to open chart analysis and indicators */}
            <div 
              onClick={() => setIsAnalysisOpen(true)}
              className="col-span-2 bg-[#0d1117] border border-[#388bfd] hover:border-blue-400 rounded-xl p-3 text-left relative cursor-pointer group transition-all"
            >
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#21262d] border border-[#30363d] py-1 px-2.5 rounded-full text-[10px] text-gray-400 font-semibold group-hover:text-blue-400 cursor-pointer">
                <BarChart3 className="w-3 h-3" /> 點此看圖表分析
              </div>
              <span className="text-[11px] font-semibold text-blue-400 block">🌍 整體支出代墊 (折合台幣)</span>
              <span className="text-2xl font-black text-blue-400 block mt-1.5 font-mono">
                NT$ {convertedOverallTwd.toLocaleString()}
              </span>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-500 border-t border-[#21262d] pt-1.5">
                <span className="font-mono">日幣: ¥{jpySum.toLocaleString()}</span>
                <span className="font-mono">台幣: NT${twdSum.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-3">
              <span className="text-[11px] text-gray-500 font-semibold block">💴 日幣開銷總計</span>
              <span className="text-lg font-bold text-white block mt-1 font-mono">
                ¥{jpySum.toLocaleString()}
              </span>
              <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 mt-2 border-t border-[#21262d] pt-1.5">
                <div className="flex justify-between font-mono"><span>震付:</span><span>¥{jpyZhen.toLocaleString()}</span></div>
                <div className="flex justify-between font-mono"><span>沛付:</span><span>¥{jpyPei.toLocaleString()}</span></div>
                <div className="flex justify-between font-mono"><span>現金:</span><span>¥{jpyCash.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-3">
              <span className="text-[11px] text-gray-500 font-semibold block">💵 台幣開銷總計</span>
              <span className="text-lg font-bold text-white block mt-1 font-mono">
                NT${twdSum.toLocaleString()}
              </span>
              <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 mt-2 border-t border-[#21262d] pt-1.5">
                <div className="flex justify-between font-mono"><span>震付:</span><span>NT${twdZhen.toLocaleString()}</span></div>
                <div className="flex justify-between font-mono"><span>沛付:</span><span>NT${twdPei.toLocaleString()}</span></div>
                <div className="flex justify-between font-mono"><span>現金:</span><span>NT${twdCash.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Input Form */}
        <form onSubmit={handleSubmitExpense} className="bg-[#161b22] border border-[#21262d] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="text-sm font-bold text-white flex items-center gap-1 border-l-3 border-[#3B82F6] pl-2">
            支出登記表
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="titleInput" className="block text-[11px] font-bold text-slate-400 mb-1">消費項目</label>
              <input
                id="titleInput"
                type="text"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-3 px-3.5 text-base focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/15 focus:outline-none transition-all placeholder:text-[#484f58]"
                placeholder="如：暖暮拉麵、美之海水族館"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">幣別</label>
                <div className="flex bg-[#0d1117] p-1 border border-[#30363d] rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setCurrency('JPY'); triggerHaptic(10); }}
                    className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-transform ${currency === 'JPY' ? 'bg-[#1f6feb] text-white shadow-md' : 'text-slate-400'}`}
                  >
                    日圓 ¥
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurrency('TWD'); triggerHaptic(10); }}
                    className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-transform ${currency === 'TWD' ? 'bg-[#1f6feb] text-white shadow-md' : 'text-slate-400'}`}
                  >
                    台幣 $
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="amountInput" className="block text-[11px] font-bold text-slate-400 mb-1">金額</label>
                <input
                  id="amountInput"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0.01"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-2 px-3 text-base text-right font-mono font-bold focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/15 focus:outline-none transition-all"
                  placeholder="輸入金額"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-400">消費分類</span>
                <span className="text-[9px] text-[#8b949e] italic">💡 長按自訂編輯分類</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-[#0d1117] border border-[#21262d] rounded-xl">
                {activeCategoriesInSelector.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(selectedCategory === cat.name ? '' : cat.name);
                      triggerHaptic(10);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditingCategory(cat);
                      setIsAddCategoryOpen(true);
                      triggerHaptic(45);
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all select-none cursor-pointer ${
                      selectedCategory === cat.name 
                        ? 'bg-gradient-to-r from-[#1f6feb] to-[#388bfd] text-white border-blue-400 shadow-md'
                        : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => { setEditingCategory(null); setIsAddCategoryOpen(true); }}
                  className="w-full py-1.5 border border-dashed border-[#388bfd] hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg text-xs font-semibold text-[#58a6ff] flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> 建立新分類
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="w-full py-1.5 border border-dashed border-[#e3b341] hover:border-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10 rounded-lg text-xs font-semibold text-[#f2cc60] flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  ⚙️ 管理與隱藏分類
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">支付人代墊方式</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: '震', label: '🐛 震先付' },
                  { id: '沛', label: '🐌 沛先付' },
                  { id: '現金', label: '💵 現金付' },
                  { id: '交通卡', label: '💳 交通卡' }
                ].map((pay) => (
                  <button
                    key={pay.id}
                    type="button"
                    onClick={() => {
                      setSelectedPayer(selectedPayer === pay.id ? '' : pay.id);
                      triggerHaptic(10);
                    }}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold text-center border transition-all truncate cursor-pointer ${
                      selectedPayer === pay.id 
                        ? 'bg-gradient-to-r from-[#1f6feb] to-[#388bfd] text-white border-blue-400 shadow-md'
                        : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-white'
                    }`}
                  >
                    {pay.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible layout cards brand options */}
            <AnimatePresence>
              {(selectedPayer === '震' || selectedPayer === '沛') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-2 border-t border-dashed border-[#30363d] pt-3"
                >
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">對應代墊信用卡</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['Ubear', '熊本熊', 'Paypay台幣', 'Paypay日幣', 'Paypay熊本熊', '大戶', '吉鶴', '其他'].map((card) => (
                      <button
                        key={card}
                        type="button"
                        onClick={() => { setSelectedCard(selectedCard === card ? '' : card); triggerHaptic(10); }}
                        className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold text-center border transition-all truncate cursor-pointer ${
                          selectedCard === card 
                            ? 'bg-[#2ea043] text-white border-emerald-400 shadow'
                            : 'bg-[#0d1117] border-[#21262d] text-slate-500 hover:text-gray-300'
                        }`}
                      >
                        {card}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="datetimeInput" className="block text-[11px] font-bold text-slate-400 mb-1">記帳日期 & 時間</label>
              <input
                id="datetimeInput"
                type="datetime-local"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl text-white py-2 px-3 text-xs focus:outline-none focus:border-[#58a6ff] transition-all"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!selectedCategory || !selectedPayer}
              className="flex-1 bg-gradient-to-r from-[#1f6feb] to-[#388bfd] hover:brightness-110 active:scale-98 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-white" />
              {editingExpenseId ? '確認修改雲端項目 🖊️' : '送出儲存至雲端'}
            </button>
            {editingExpenseId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 border border-[#30363d] hover:bg-[#21262d] text-neutral-400 rounded-xl py-3 transition-colors text-xs"
              >
                取消修改
              </button>
            )}
          </div>
        </form>

        {/* Expenses List Panel */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-5 shadow-lg space-y-4">
          <div className="text-sm font-bold text-white flex items-center justify-between border-l-3 border-[#3B82F6] pl-2">
            <span>旅程消費明細 ({records.length} 筆)</span>
            <span className="text-[10px] text-gray-500 font-medium">💡 點項目可看詳情或編輯刪除</span>
          </div>

          <div className="order-summary divide-y divide-[#21262d] max-h-[460px] overflow-y-auto pr-1">
            {records.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm italic">
                🏝️ 目前尚未有記帳數據。在上方新增第一筆消費吧！
              </div>
            ) : (
              records.map((r, index) => {
                const catDef = categories.find(c => c.name === r.category) || { emoji: '🤷', color: '#4B5563' };
                const isJpy = r.currency === 'JPY';
                const formattedDate = r.date.slice(5, 10).replace('-', '/');
                const formattedTime = r.date.slice(11, 16);

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.4) }}
                    onClick={() => {
                      setActiveExpense(r);
                      setIsRecordDetailOpen(true);
                      triggerHaptic(10);
                    }}
                    className="flex justify-between items-center py-3.5 hover:bg-[#1a1e24] px-1.5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-[#30363d] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border"
                        style={{
                          backgroundColor: `${catDef.color}15`,
                          borderColor: catDef.color
                        }}
                      >
                        {catDef.emoji}
                      </div>

                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-white truncate max-w-[170px]">{r.title}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                          <span className="bg-[#1f242c] border border-[#30363d] py-0.5 px-1.5 rounded-md font-bold text-slate-400">
                            👤 {r.paymentMethod} {r.cardName ? `• ${r.cardName}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex flex-col items-end pl-2">
                      <span className="text-sm font-extrabold text-white font-mono">
                        {isJpy ? '¥' : 'NT$'}{Number(r.amount || 0).toLocaleString()}
                      </span>
                      {isJpy && (
                        <span className="text-[10px] text-emerald-400 font-bold font-mono">
                          ≈ NT${Math.round(r.amount * exchangeRate).toLocaleString()}
                        </span>
                      )}
                      <span className="text-[9px] text-[#484f58] mt-1 font-semibold">
                        {formattedDate} {formattedTime}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* CSV Import/Export Panel */}
        <div className="flex gap-3">
          <input
            type="file"
            id="csvFileInputInReact"
            className="hidden"
            accept=".csv"
            onChange={handleImportCsvFile}
          />
          <button
            onClick={() => {
              const el = document.getElementById('csvFileInputInReact');
              if (el) el.click();
              triggerHaptic(15);
            }}
            disabled={!selectedTripId}
            className="flex-1 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-200 text-xs py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> 匯入資料 (CSV)
          </button>
          <button
            onClick={handleExportCsvInApp}
            className="flex-1 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-gray-200 text-xs py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> 匯出資料 (CSV)
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500 font-mono tracking-wide py-2 leading-relaxed max-w-sm mx-auto select-none border-t border-[#21262d] mt-2">
          🔓 安全傳輸: 沖繩即時雲端記帳分帳系統已啟動 Firebase 安全防重引擎。
        </div>

      </div>

      {/* TRIP CREATION MODAL */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onCreate={handleCreateTrip}
      />

      {/* CATEGORY SETTINGS MODAL */}
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => { setIsAddCategoryOpen(false); setEditingCategory(null); }}
        categories={categories}
        hiddenCategories={hiddenCategories}
        onSave={(cat, editingName) => {
          handleSaveCategoryInApp(cat, editingName);
          setIsAddCategoryOpen(false);
          setEditingCategory(null);
        }}
        onUnhide={handleUnhideCategoryInApp}
        onEditClick={(c) => setEditingCategory(c)}
        editingCategory={editingCategory}
      />

      {/* EXPENSE DETAIL MODAL */}
      <RecordDetailModal
        isOpen={isRecordDetailOpen}
        onClose={() => { setIsRecordDetailOpen(false); setActiveExpense(null); }}
        expense={activeExpense}
        onEdit={handleEditRecordTrigger}
        onDelete={handleDeleteRecordTrigger}
        exchangeRate={exchangeRate}
      />

      {/* ANALYSIS CHART MODAL */}
      <AnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        records={records}
        exchangeRate={exchangeRate}
        categories={categories}
      />

    </div>
  );
}
