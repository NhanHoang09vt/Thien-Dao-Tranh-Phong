import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Key, 
  ShieldCheck, 
  Database, 
  Save, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle2,
  Settings as SettingsIcon,
  LogOut,
  Terminal
} from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Settings state
  const [apiKeys, setApiKeys] = useState<any>({
    gemini_api_key: "",
    other_api_keys: {}
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "dh_admin" && password === "admin@123!") {
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Sai tài khoản hoặc mật khẩu quản trị!");
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      const unsub = onSnapshot(doc(db, "settings", "api_keys"), (docSnap) => {
        if (docSnap.exists()) {
          setApiKeys(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [isLoggedIn]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "api_keys"), {
        ...apiKeys,
        updatedAt: new Date().toISOString()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setError("Không thể lưu cấu hình!");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md glass-card rounded-[2.5rem] p-8 border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic text-orange-500">Quản Trị Hệ Thống</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-2 font-bold">Vui lòng xác thực quyền truy cập</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Tài khoản</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-orange-500/50 focus:ring-0 transition-all"
                  placeholder="Nhập tài khoản..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Mật khẩu</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-orange-500/50 focus:ring-0 transition-all pr-12"
                  placeholder="Nhập mật khẩu..."
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="flex-[2] px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-95"
              >
                Đăng nhập
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl h-[80vh] glass-card rounded-[3rem] border border-orange-500/20 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(249,115,22,0.15)]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <SettingsIcon className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter italic text-orange-500">Bảng Điều Khiển Quản Trị</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Hệ thống quản lý tài nguyên & API</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsLoggedIn(false)}
              className="px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-500 hover:text-red-500 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <LogOut className="w-3 h-3" />
              Đăng xuất
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Info */}
            <div className="space-y-6">
              <section className="p-6 bg-white/5 rounded-3xl border border-white/5">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Terminal className="w-3 h-3" />
                  Trạng thái hệ thống
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Phiên bản</span>
                    <span className="text-xs font-mono text-orange-500">v2.4.0-stable</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Cập nhật cuối</span>
                    <span className="text-[10px] font-mono text-gray-500">{apiKeys.updatedAt ? new Date(apiKeys.updatedAt).toLocaleString() : "N/A"}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-green-500 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Database Online</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="p-6 bg-orange-500/5 rounded-3xl border border-orange-500/10">
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2">Lưu ý bảo mật</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                  Tất cả API Key được lưu trữ trực tiếp trong Firestore và được mã hóa trong quá trình truyền tải. Không chia sẻ quyền truy cập này cho bất kỳ ai.
                </p>
              </section>
            </div>

            {/* Right Column: API Keys Form */}
            <div className="lg:col-span-2 space-y-6">
              <section className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Key className="w-5 h-5 text-cyan-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Cấu hình API Keys</h3>
                </div>

                <div className="space-y-6">
                  {/* Gemini API Key */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Gemini AI API Key</label>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-black uppercase tracking-widest border border-orange-500/20">Bắt buộc</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="password"
                        value={apiKeys.gemini_api_key}
                        onChange={(e) => setApiKeys({ ...apiKeys, gemini_api_key: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono focus:border-orange-500/50 transition-all"
                        placeholder="Nhập Gemini API Key..."
                      />
                    </div>
                  </div>

                  {/* Other Keys (Dynamic) */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Các Key khác (JSON)</label>
                    <textarea 
                      value={JSON.stringify(apiKeys.other_api_keys || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setApiKeys({ ...apiKeys, other_api_keys: parsed });
                        } catch (err) {
                          // Allow typing invalid JSON temporarily
                        }
                      }}
                      rows={6}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono focus:border-orange-500/50 transition-all resize-none custom-scrollbar"
                      placeholder='{ "STRIPE_KEY": "...", "FIREBASE_SECRET": "..." }'
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Đã lưu thành công!
                      </motion.div>
                    )}
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-3 px-8 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-95"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Lưu cấu hình
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Database className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Dữ liệu</p>
                    <p className="text-xs font-bold text-white">Firestore Cloud</p>
                  </div>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Bảo mật</p>
                    <p className="text-xs font-bold text-white">AES-256 Encrypted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
