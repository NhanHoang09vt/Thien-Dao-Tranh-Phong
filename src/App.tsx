import React, { useState, useEffect, useRef } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sword, 
  Shield, 
  Zap, 
  Heart, 
  User as UserIcon, 
  Map as MapIcon, 
  MessageSquare, 
  Scroll, 
  Settings, 
  LogOut, 
  Send, 
  ChevronRight, 
  Sparkles, 
  Skull, 
  Gem, 
  Flame, 
  Wind, 
  Droplets, 
  Mountain, 
  CloudLightning, 
  Snowflake, 
  CircleDot,
  Star,
  Plus,
  ShieldCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  ShoppingCart,
  Hammer,
  History
} from "lucide-react";
import { auth, db } from "./firebase";
import { AdminPanel } from "./components/AdminPanel";
import { Character, DungeonLog, Realm, Race, Element, Equipment, Item } from "./types";
import { RACES, ELEMENTS, REALMS, REALM_NAMES, ELEMENT_MULTIPLIERS, ELEMENT_SKILLS, SHOP_ITEMS, CHANGELOG } from "./constants";
import { processDungeonAction, chatWithNPC, generateGameContent, generateWorldPlot } from "./services/geminiService";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CharacterAura = ({ element, realm }: { element: string, realm: number }) => {
  const colors: Record<string, string> = {
    "Kim": "from-yellow-400 to-amber-600",
    "Mộc": "from-green-400 to-emerald-600",
    "Thủy": "from-blue-400 to-cyan-600",
    "Hỏa": "from-red-400 to-orange-600",
    "Thổ": "from-amber-700 to-yellow-900",
    "Lôi": "from-purple-400 to-indigo-600",
    "Phong": "from-teal-400 to-emerald-500",
    "Băng": "from-sky-200 to-blue-400",
    "Quang": "from-white to-yellow-200",
    "Ám": "from-gray-800 to-black"
  };

  const color = colors[element] || "from-orange-400 to-orange-600";
  const intensity = Math.min(0.1 + (realm * 0.05), 0.8);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [intensity, intensity * 1.5, intensity]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "absolute inset-0 bg-gradient-to-t blur-3xl opacity-20",
          color
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreation, setShowCreation] = useState(false);
  const [activeTab, setActiveTab] = useState<"dungeon" | "stats" | "map" | "chat" | "gm" | "shop" | "forge" | "changelog">("dungeon");
  const [dungeonLogs, setDungeonLogs] = useState<DungeonLog[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [worldState, setWorldState] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gmContent, setGmContent] = useState<any>(null);
  const [worldPlot, setWorldPlot] = useState<any>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isGeneratingGM, setIsGeneratingGM] = useState(false);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [combatState, setCombatState] = useState<any>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    firestore: "connecting" | "connected" | "error";
    socket: "connecting" | "connected" | "error";
  }>({ firestore: "connecting", socket: "connecting" });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // Test Firestore connection
          await getDocFromServer(doc(db, "characters", u.uid));
          console.log("Firestore connection verified.");
          setConnectionStatus(prev => ({ ...prev, firestore: "connected" }));
        } catch (error: any) {
          console.error("Firestore connection error:", error);
          setConnectionStatus(prev => ({ ...prev, firestore: "error" }));
          if (error.message?.includes("offline")) {
            console.error("Firestore is offline. Check Firebase config and Authorized Domains.");
          }
        }

        const charDoc = await getDoc(doc(db, "characters", u.uid));
        if (charDoc.exists()) {
          const data = charDoc.data() as Character;
          setCharacter({
            ...data,
            skills: data.skills || [],
            activeSkills: data.activeSkills || [],
            inventory: data.inventory || [],
            activeQuests: data.activeQuests || [],
            equipment: data.equipment || {
              Weapon: null,
              Armor: null,
              Accessory: null,
              Head: null,
              Legs: null
            },
            profession: data.profession || undefined
          });
          setShowCreation(false);
        } else {
          setShowCreation(true);
        }
      }
      setLoading(false);
    });

    // World State Listener
    const worldUnsub = onSnapshot(doc(db, "world", "state"), (doc) => {
      if (doc.exists()) setWorldState(doc.data());
    });

    // Real Socket.io Connection
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket.io connected:", newSocket.id);
      setConnectionStatus(prev => ({ ...prev, socket: "connected" }));
    });

    newSocket.on("connect_error", () => {
      setConnectionStatus(prev => ({ ...prev, socket: "error" }));
    });

    newSocket.on("world_update", (state) => {
      setWorldState(state);
    });

    newSocket.on("realm_event", (event) => {
      setDungeonLogs(prev => [{
        id: Date.now().toString(),
        text: `[Sự kiện Realm] ${event.text}`,
        type: "event",
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    });

    newSocket.on("chat_broadcast", (msg) => {
      setChatMessages(prev => [...prev, msg].slice(-100));
    });

    return () => {
      unsubscribe();
      worldUnsub();
      newSocket.disconnect();
    };
  }, []);

  // Auto-Cultivation (Idle EXP)
  useEffect(() => {
    if (!character || activeTab !== "dungeon") return;

    const interval = setInterval(async () => {
      const expGain = Math.floor(character.realm * character.linhCan * 2);
      const newExp = character.exp + expGain;
      
      // Update local state for immediate feedback
      setCharacter(prev => prev ? { ...prev, exp: newExp } : null);

      // Persist every 10 seconds or so to avoid spam
    }, 5000);

    return () => clearInterval(interval);
  }, [character?.realm, character?.linhCan, activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dungeonLogs, chatMessages]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Set custom parameters for Google Auth if needed
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      console.log("Login successful:", result.user.email);
    } catch (error: any) {
      console.error("Login Error:", error);
      
      // Handle common Firebase Auth errors
      if (error.code === 'auth/popup-blocked') {
        alert("Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép bật lên để đăng nhập.");
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("Phương thức đăng nhập Google chưa được bật trong Firebase Console.");
      } else if (error.code === 'auth/unauthorized-domain') {
        alert("Tên miền này chưa được cấp phép trong Firebase Console. Vui lòng thêm tên miền Vercel của bạn vào 'Authorized Domains' trong Firebase Auth Settings.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need for alert
      } else {
        alert("Lỗi đăng nhập: " + error.message);
      }
    }
  };

  const handleCreateCharacter = async (name: string, race: Race, element: Element) => {
    if (!user) return;
    const startingSkill = ELEMENT_SKILLS[element][Math.floor(Math.random() * 3)]; // Pick from first 3 for starting
    
    // Randomize attributes
    const linhCan = 0.6 + Math.random() * 1.4;
    const ngoTinh = 5 + Math.floor(Math.random() * 15);
    const canCot = 5 + Math.floor(Math.random() * 15);
    const phucDuyen = 5 + Math.floor(Math.random() * 15);
    const khiVan = 5 + Math.floor(Math.random() * 15);
    
    const hpMax = 80 + Math.floor(Math.random() * 40) + (canCot * 2);
    const mpMax = 40 + Math.floor(Math.random() * 20) + (ngoTinh * 1);
    const atk = 8 + Math.floor(Math.random() * 5) + Math.floor(canCot / 2);
    const def = 4 + Math.floor(Math.random() * 4) + Math.floor(canCot / 3);
    const spd = 4 + Math.floor(Math.random() * 4) + Math.floor(phucDuyen / 5);
    const crit = 2 + Math.floor(Math.random() * 6) + Math.floor(khiVan / 5);

    const newChar: Character = {
      uid: user.uid,
      name,
      race,
      element,
      linhCan,
      realm: 1,
      realmLevel: 1,
      level: 1,
      exp: 0,
      hp: hpMax,
      hpMax: hpMax,
      mp: mpMax,
      mpMax: mpMax,
      atk,
      def,
      spd,
      crit,
      cDMG: 150,
      acc: 90,
      eva: 5,
      ngoTinh,
      canCot,
      phucDuyen,
      tamMa: 0,
      khiVan,
      skillPoints: 0,
      statPoints: 0,
      linhThach: 100,
      tienNgoc: 0,
      skills: [startingSkill],
      activeSkills: [startingSkill],
      inventory: [],
      equipment: {
        Weapon: null,
        Armor: null,
        Accessory: null,
        Head: null,
        Legs: null
      },
      currentRealm: "Nhân Giới",
      lastActionAt: new Date().toISOString(),
      activeQuests: []
    };

    try {
      // Generate unique story for this character
      const plot = await generateWorldPlot(newChar);
      if (plot) {
        newChar.story = plot;
      }
      
      // Pre-generate initial event to reduce first-action delay
      const initialEvent = await processDungeonAction(newChar, "Khởi đầu hành trình", []);
      
      await setDoc(doc(db, "characters", user.uid), newChar);
      setCharacter(newChar);
      setShowCreation(false);
      
      setDungeonLogs([{
        id: "start",
        text: initialEvent.story || `Chào mừng đạo hữu ${name} gia nhập Thiên Đạo Tranh Phong! Cốt truyện của bạn đã được khởi tạo.`,
        type: "success",
        timestamp: new Date().toLocaleTimeString(),
        choices: initialEvent.choices
      }]);
      setChoices(initialEvent.choices || []);
    } catch (error) {
      console.error("Error creating character:", error);
      alert("Có lỗi xảy ra khi tạo nhân vật. Vui lòng thử lại.");
    }
  };

  const handleAction = async (action: string) => {
    if (!character || isProcessing) return;
    setIsProcessing(true);
    setStreamingText("");
    
    // Add player action to logs
    const playerLog: DungeonLog = {
      id: Date.now().toString(),
      text: `> ${action}`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    };
    setDungeonLogs(prev => [...prev, playerLog]);

    try {
      // 1. Context-aware Caching: Generate a unique cache key for this action
      // We use a simple hash of the story context to ensure cache hits for same state
      const storyContext = character.story?.lore?.slice(-200) || "";
      const contextHash = storyContext.split("").reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString(36);
      
      const cacheKey = `${character.uid}-${action}-${character.level}-${contextHash}`;

      // Pass last 10 relevant logs as history
      const history = dungeonLogs
        .filter(log => 
          (log.type === "info" || log.type === "success" || log.type === "danger") &&
          !log.text.includes("Thiên địa linh khí dao động")
        )
        .slice(-10)
        .map(log => ({
          role: log.text.startsWith("> ") ? "user" : "model",
          parts: [{ text: log.text.replace("> ", "") }]
        }));

      const result = await processDungeonAction(character, action, history, cacheKey);
      
      if (!result || !result.story) {
        throw new Error("Invalid AI response");
      }

      // UX: Streaming effect for the story
      const words = result.story.split(" ");
      let currentText = "";
      for (let i = 0; i < words.length; i++) {
        currentText += words[i] + " ";
        setStreamingText(currentText);
        // Speed up typing for longer stories
        const delay = Math.max(2, 20 - Math.floor(i / 15));
        await new Promise(r => setTimeout(r, delay));
      }
      
      if (result.combat && result.combat.isActive) {
        setCombatState(result.combat);
        if (result.combat.enemyDamage > 0) {
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
          }, 500);
        }
      } else {
        setCombatState(null);
      }

      const aiLog: DungeonLog = {
        id: (Date.now() + 1).toString(),
        text: result.story,
        type: result.outcome === "SUCCESS" ? "success" : result.outcome === "FAILURE" ? "danger" : "info",
        timestamp: new Date().toLocaleTimeString()
      };
      setDungeonLogs(prev => [...prev, aiLog]);
      setStreamingText(""); // Clear streaming text after adding to log

      // Apply rewards
      const updatedChar = {
        ...character,
        exp: character.exp + (result.rewards?.exp || 0),
        hp: Math.min(character.hpMax, Math.max(0, character.hp + (result.rewards?.hpChange || 0))),
        mp: Math.min(character.mpMax, Math.max(0, character.mp + (result.rewards?.mpChange || 0))),
        linhThach: character.linhThach + (result.rewards?.linhThach || 0),
        tamMa: Math.max(0, character.tamMa + (result.rewards?.tamMaChange || 0)),
        inventory: result.rewards?.item ? [...character.inventory, result.rewards.item] : character.inventory
      };
      
      if (result.rewards?.item) {
        setDungeonLogs(prev => [...prev, {
          id: Date.now().toString() + "_item",
          text: `Bạn nhận được vật phẩm: ${result.rewards.item.name || "Vật phẩm vô danh"}`,
          type: "reward",
          timestamp: new Date().toLocaleTimeString()
        }]);
      }

      setCharacter(updatedChar);
      setChoices(result.choices || []);
      await updateDoc(doc(db, "characters", character.uid), {
        exp: updatedChar.exp,
        hp: updatedChar.hp,
        mp: updatedChar.mp,
        linhThach: updatedChar.linhThach,
        tamMa: updatedChar.tamMa,
        inventory: updatedChar.inventory
      });

    } catch (error) {
      console.error("Action error:", error);
      setStreamingText("Thiên cơ hỗn loạn, không thể thực hiện hành động này.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!character || isGeneratingGM) return;
    setIsGeneratingGM(true);
    try {
      // Pass last 20 logs as context
      const context = dungeonLogs.slice(-20).map(l => l.text).join("\n");
      const content = await generateGameContent(character, worldState, context);
      setGmContent(content);
    } catch (error) {
      console.error("GM Content Error:", error);
    } finally {
      setIsGeneratingGM(false);
    }
  };

  const handleGeneratePlot = async () => {
    if (!character || isGeneratingPlot) return;
    setIsGeneratingPlot(true);
    try {
      const plot = await generateWorldPlot(character);
      if (plot) setWorldPlot(plot);
    } catch (error) {
      console.error("Plot generation error:", error);
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  const acceptQuest = async (quest: any) => {
    if (!character) return;
    if (character.activeQuests?.find(q => q.id === quest.id)) {
      alert("Bạn đã nhận nhiệm vụ này rồi!");
      return;
    }
    const updatedChar = {
      ...character,
      activeQuests: [...(character.activeQuests || []), quest]
    };
    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      activeQuests: updatedChar.activeQuests
    });
    
    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Bạn đã nhận nhiệm vụ: ${quest.title}`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
    setActiveTab("dungeon");
  };

  const completeQuest = async (questId: string) => {
    if (!character) return;
    const quest = character.activeQuests.find(q => q.id === questId);
    if (!quest) return;

    const updatedQuests = character.activeQuests.filter(q => q.id !== questId);
    const updatedChar = {
      ...character,
      activeQuests: updatedQuests,
      exp: character.exp + quest.rewards.exp,
      linhThach: character.linhThach + quest.rewards.linhThach,
      inventory: quest.rewards.item ? [...character.inventory, { name: quest.rewards.item, type: "item" }] : character.inventory
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      activeQuests: updatedChar.activeQuests,
      exp: updatedChar.exp,
      linhThach: updatedChar.linhThach,
      inventory: updatedChar.inventory
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Chúc mừng! Bạn đã hoàn thành nhiệm vụ: ${quest.title}`,
      type: "success",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const equipItem = async (item: any) => {
    if (!character || item.type !== "equipment") return;
    if (character.realm < item.requiredRealm) {
      alert("Cảnh giới không đủ để trang bị!");
      return;
    }

    const slot = item.slot as keyof typeof character.equipment;
    const oldItem = character.equipment[slot];
    
    const updatedInventory = character.inventory.filter(i => i.id !== item.id);
    if (oldItem) {
      updatedInventory.push(oldItem);
    }

    const updatedEquipment = {
      ...character.equipment,
      [slot]: item
    };

    // Recalculate stats based on equipment
    // This is a simplified version
    const updatedChar = {
      ...character,
      inventory: updatedInventory,
      equipment: updatedEquipment,
      atk: character.atk + (item.stats.atk || 0) - (oldItem?.stats.atk || 0),
      def: character.def + (item.stats.def || 0) - (oldItem?.stats.def || 0),
      hpMax: character.hpMax + (item.stats.hp || 0) - (oldItem?.stats.hp || 0),
      mpMax: character.mpMax + (item.stats.mp || 0) - (oldItem?.stats.mp || 0),
      spd: character.spd + (item.stats.spd || 0) - (oldItem?.stats.spd || 0),
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      inventory: updatedChar.inventory,
      equipment: updatedChar.equipment,
      atk: updatedChar.atk,
      def: updatedChar.def,
      hpMax: updatedChar.hpMax,
      mpMax: updatedChar.mpMax,
      spd: updatedChar.spd
    });
  };

  const unequipItem = async (slot: string) => {
    if (!character) return;
    const item = character.equipment[slot as keyof typeof character.equipment];
    if (!item) return;

    const updatedEquipment = {
      ...character.equipment,
      [slot]: null
    };

    const updatedChar = {
      ...character,
      inventory: [...character.inventory, item],
      equipment: updatedEquipment,
      atk: character.atk - (item.stats.atk || 0),
      def: character.def - (item.stats.def || 0),
      hpMax: character.hpMax - (item.stats.hp || 0),
      mpMax: character.mpMax - (item.stats.mp || 0),
      spd: character.spd - (item.stats.spd || 0),
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      inventory: updatedChar.inventory,
      equipment: updatedChar.equipment,
      atk: updatedChar.atk,
      def: updatedChar.def,
      hpMax: updatedChar.hpMax,
      mpMax: updatedChar.mpMax,
      spd: updatedChar.spd
    });
  };

  const buyItem = async (item: Item) => {
    if (!character) return;
    if (!item.price || character.linhThach < item.price) {
      setDungeonLogs(prev => [...prev, {
        id: Date.now().toString(),
        text: `Linh thạch không đủ để mua ${item.name}!`,
        type: "danger",
        timestamp: new Date().toLocaleTimeString()
      }]);
      return;
    }

    const updatedChar = {
      ...character,
      linhThach: character.linhThach - item.price,
      inventory: [...character.inventory, item]
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      linhThach: updatedChar.linhThach,
      inventory: updatedChar.inventory
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Đã mua ${item.name} với giá ${item.price} Linh Thạch.`,
      type: "success",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const sellItem = async (item: Item, index: number) => {
    if (!character) return;
    const sellPrice = item.price ? Math.floor(item.price / 2) : 10; // Default sell price if none

    const updatedInventory = [...character.inventory];
    updatedInventory.splice(index, 1); // Remove the specific item instance

    const updatedChar = {
      ...character,
      linhThach: character.linhThach + sellPrice,
      inventory: updatedInventory
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      linhThach: updatedChar.linhThach,
      inventory: updatedChar.inventory
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Đã bán ${item.name} thu được ${sellPrice} Linh Thạch.`,
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const useItem = async (item: Item, index: number) => {
    if (!character || item.type !== "consumable") return;

    const hpHeal = item.stats?.hp || 0;
    const mpHeal = item.stats?.mp || 0;

    if (hpHeal === 0 && mpHeal === 0) return;

    const updatedInventory = [...character.inventory];
    updatedInventory.splice(index, 1);

    const updatedChar = {
      ...character,
      hp: Math.min(character.hpMax, character.hp + hpHeal),
      mp: Math.min(character.mpMax, character.mp + mpHeal),
      inventory: updatedInventory
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      hp: updatedChar.hp,
      mp: updatedChar.mp,
      inventory: updatedChar.inventory
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Đã sử dụng ${item.name}. Hồi phục ${hpHeal > 0 ? hpHeal + ' HP' : ''} ${mpHeal > 0 ? mpHeal + ' MP' : ''}.`,
      type: "success",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const upgradeItem = async (item: Item, index: number, isEquipped: boolean, slot?: string) => {
    if (!character || item.type !== "equipment") return;
    
    const currentLevel = item.upgradeLevel || 0;
    const upgradeCost = 50 + currentLevel * 50; // Base cost 50, increases by 50 each level

    if (character.linhThach < upgradeCost) {
      setDungeonLogs(prev => [...prev, {
        id: Date.now().toString(),
        text: `Linh thạch không đủ để cường hóa ${item.name}! Cần ${upgradeCost} LT.`,
        type: "danger",
        timestamp: new Date().toLocaleTimeString()
      }]);
      return;
    }

    const newStats = { ...item.stats };
    if (newStats.atk !== undefined) newStats.atk = Math.floor(newStats.atk * 1.1) + 5;
    if (newStats.def !== undefined) newStats.def = Math.floor(newStats.def * 1.1) + 5;
    if (newStats.hp !== undefined) newStats.hp = Math.floor(newStats.hp * 1.1) + 20;
    if (newStats.mp !== undefined) newStats.mp = Math.floor(newStats.mp * 1.1) + 10;
    if (newStats.spd !== undefined) newStats.spd = Math.floor(newStats.spd * 1.05) + 1;

    const baseName = item.name.replace(/\s\+\d+$/, '');
    const upgradedItem = {
      ...item,
      upgradeLevel: currentLevel + 1,
      name: `${baseName} +${currentLevel + 1}`,
      stats: newStats
    };

    let updatedChar = { ...character, linhThach: character.linhThach - upgradeCost };

    if (isEquipped && slot) {
      updatedChar.equipment = {
        ...updatedChar.equipment,
        [slot]: upgradedItem
      };
      updatedChar.atk += (newStats.atk || 0) - (item.stats?.atk || 0);
      updatedChar.def += (newStats.def || 0) - (item.stats?.def || 0);
      updatedChar.hpMax += (newStats.hp || 0) - (item.stats?.hp || 0);
      updatedChar.mpMax += (newStats.mp || 0) - (item.stats?.mp || 0);
      updatedChar.spd += (newStats.spd || 0) - (item.stats?.spd || 0);
    } else {
      const updatedInventory = [...updatedChar.inventory];
      updatedInventory[index] = upgradedItem;
      updatedChar.inventory = updatedInventory;
    }

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      linhThach: updatedChar.linhThach,
      equipment: updatedChar.equipment,
      inventory: updatedChar.inventory,
      atk: updatedChar.atk,
      def: updatedChar.def,
      hpMax: updatedChar.hpMax,
      mpMax: updatedChar.mpMax,
      spd: updatedChar.spd
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Cường hóa thành công! ${item.name} lên cấp +${currentLevel + 1}.`,
      type: "success",
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const joinProfession = async (profType: any) => {
    if (!character) return;
    if (character.profession) {
      alert("Bạn đã có nghề nghiệp rồi!");
      return;
    }

    const newProf = {
      type: profType,
      level: 1,
      exp: 0,
      rank: "Nhất Phẩm"
    };

    const updatedChar = {
      ...character,
      profession: newProf
    };

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      profession: updatedChar.profession
    });
  };

  const learnSkill = async (skill: any) => {
    if (!character) return;
    if (character.skills?.includes(skill.name)) {
      alert("Bạn đã lĩnh ngộ kỹ năng này rồi!");
      return;
    }
    if (character.realm < skill.requiredRealm) {
      alert("Cảnh giới của bạn chưa đủ để lĩnh ngộ kỹ năng này!");
      return;
    }
    const updatedChar = {
      ...character,
      skills: [...(character.skills || []), skill.name]
    };
    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      skills: updatedChar.skills
    });

    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: `Chúc mừng! Bạn đã lĩnh ngộ kỹ năng mới: ${skill.name}`,
      type: "success",
      timestamp: new Date().toLocaleTimeString()
    }]);
    setActiveTab("dungeon");
  };

  const challengeBoss = async (boss: any) => {
    if (!character) return;
    setActiveTab("dungeon");
    handleAction(`Ta muốn khiêu chiến ${boss.title} ${boss.name}!`);
  };

  const handleUseSkill = async (skillName: string) => {
    if (isProcessing || !character || !combatState?.isActive) return;
    handleAction(`Sử dụng kỹ năng: ${skillName}`);
  };

  const handleBreakthrough = async () => {
    if (!character || isProcessing) return;
    
    if (character.realm >= REALM_NAMES.length && character.realmLevel >= 12) {
      alert("Bạn đã đạt đến cảnh giới tối cao, không thể đột phá thêm!");
      return;
    }

    const expRequired = Math.floor(Math.pow(character.level, 1.5) * 100);
    if (character.exp < expRequired) {
      alert("Linh khí chưa đủ, chưa thể đột phá!");
      return;
    }

    setIsProcessing(true);
    setDungeonLogs(prev => [...prev, {
      id: Date.now().toString(),
      text: "Bạn đang vận công, cố gắng đột phá cảnh giới...",
      type: "info",
      timestamp: new Date().toLocaleTimeString()
    }]);

    // Success rate calculation
    // Base 70%, + Ngo Tinh, - Tam Ma
    const successRate = 0.7 + (character.ngoTinh / 100) - (character.tamMa / 200);
    const isSuccess = Math.random() < successRate;

    setTimeout(async () => {
      if (isSuccess) {
        let newRealmLevel = character.realmLevel + 1;
        let newRealm = character.realm;
        let newLevel = character.level + 1;

        if (newRealmLevel > 12) {
          if (newRealm < REALM_NAMES.length) {
            newRealmLevel = 1;
            newRealm += 1;
          } else {
            newRealmLevel = 12; // Max level reached
          }
        }

        // Chance to learn new skill on breakthrough
        let newSkills = [...character.skills];
        let newActiveSkills = [...character.activeSkills];
        
        // Every major realm breakthrough (or every 2 levels)
        if (newRealmLevel === 1 || newLevel % 2 === 0) {
          const availableSkills = ELEMENT_SKILLS[character.element].filter(s => !newSkills.includes(s));
          if (availableSkills.length > 0) {
            const learnedSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            newSkills.push(learnedSkill);
            if (newActiveSkills.length < 4) {
              newActiveSkills.push(learnedSkill);
            }
            
            setDungeonLogs(prev => [...prev, {
              id: Date.now().toString() + "-skill",
              text: `Bạn đã ngộ ra kỹ năng mới: ${learnedSkill}!`,
              type: "success",
              timestamp: new Date().toLocaleTimeString()
            }]);
          }
        }

        const hpGain = 50 * newRealm + 10 * newRealmLevel;
        const mpGain = 30 * newRealm + 5 * newRealmLevel;
        const atkGain = 10 * newRealm + 2 * newRealmLevel;
        const defGain = 5 * newRealm + 1 * newRealmLevel;
        const spdGain = Math.floor(newRealm / 2) + (newRealmLevel % 3 === 0 ? 1 : 0);
        const statPointsGain = 5 + Math.floor(newRealm / 2);
        const skillPointsGain = newRealmLevel === 1 ? 3 : 1;

        const updatedChar = {
          ...character,
          realm: newRealm,
          realmLevel: newRealmLevel,
          level: newLevel,
          exp: character.exp - expRequired,
          hpMax: character.hpMax + hpGain,
          mpMax: character.mpMax + mpGain,
          atk: character.atk + atkGain,
          def: character.def + defGain,
          spd: character.spd + spdGain,
          statPoints: character.statPoints + statPointsGain,
          skillPoints: character.skillPoints + skillPointsGain,
          hp: character.hpMax + hpGain, // Full heal on breakthrough
          mp: character.mpMax + mpGain,
          skills: newSkills,
          activeSkills: newActiveSkills
        };

        setCharacter(updatedChar);
        await updateDoc(doc(db, "characters", character.uid), updatedChar);

        setDungeonLogs(prev => [...prev, {
          id: Date.now().toString(),
          text: `Đột phá THÀNH CÔNG! Đạt tới ${REALM_NAMES[newRealm - 1]} - Tầng ${newRealmLevel}. Tăng: HP +${hpGain}, MP +${mpGain}, ATK +${atkGain}, DEF +${defGain}, SPD +${spdGain}. Nhận ${statPointsGain} điểm tiềm năng, ${skillPointsGain} điểm kỹ năng.`,
          type: "success",
          timestamp: new Date().toLocaleTimeString()
        }]);
      } else {
        const updatedChar = {
          ...character,
          hp: Math.max(1, Math.floor(character.hp * 0.5)),
          tamMa: character.tamMa + 5,
          exp: Math.floor(character.exp * 0.8) // Lose some exp
        };
        setCharacter(updatedChar);
        await updateDoc(doc(db, "characters", character.uid), {
          hp: updatedChar.hp,
          tamMa: updatedChar.tamMa,
          exp: updatedChar.exp
        });

        setDungeonLogs(prev => [...prev, {
          id: Date.now().toString(),
          text: "Đột phá THẤT BẠI! Kinh mạch nghịch chuyển, tâm ma bùng phát!",
          type: "danger",
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
      setIsProcessing(false);
    }, 2000);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !character) return;
    
    // Mock chat broadcast
    const newMsg = {
      sender: character.name,
      text: inputText,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages(prev => [...prev, newMsg]);
    setInputText("");
  };

  const handleAddStat = async (stat: keyof Character) => {
    if (!character || character.statPoints <= 0) return;
    
    let updatedChar = {
      ...character,
      [stat]: (character[stat] as number) + 1,
      statPoints: character.statPoints - 1
    };

    // Update derived stats
    if (stat === "canCot") {
      updatedChar.hpMax += 2;
      updatedChar.hp += 2;
      if (updatedChar.canCot % 2 === 0) updatedChar.atk += 1;
      if (updatedChar.canCot % 3 === 0) updatedChar.def += 1;
    } else if (stat === "ngoTinh") {
      updatedChar.mpMax += 1;
      updatedChar.mp += 1;
    } else if (stat === "phucDuyen") {
      if (updatedChar.phucDuyen % 5 === 0) updatedChar.spd += 1;
    } else if (stat === "khiVan") {
      if (updatedChar.khiVan % 5 === 0) updatedChar.crit += 1;
    }

    setCharacter(updatedChar);
    await updateDoc(doc(db, "characters", character.uid), {
      [stat]: updatedChar[stat],
      statPoints: updatedChar.statPoints,
      hpMax: updatedChar.hpMax,
      hp: updatedChar.hp,
      mpMax: updatedChar.mpMax,
      mp: updatedChar.mp,
      atk: updatedChar.atk,
      def: updatedChar.def,
      spd: updatedChar.spd,
      crit: updatedChar.crit
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-6">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(249,115,22,0.3)]"
      />
      <div className="text-center space-y-2">
        <p className="text-orange-500 font-mono text-sm animate-pulse uppercase tracking-widest">Đang kết nối Thiên Đạo...</p>
        <div className="flex items-center justify-center space-x-4 text-[10px] font-mono uppercase tracking-tighter">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus.firestore === "connected" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : connectionStatus.firestore === "error" ? "bg-red-500" : "bg-gray-600 animate-pulse"}`} />
            <span className={connectionStatus.firestore === "connected" ? "text-green-500/80" : "text-gray-500"}>Firestore</span>
          </div>
          <div className="w-px h-2 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus.socket === "connected" ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" : connectionStatus.socket === "error" ? "bg-red-500" : "bg-gray-600 animate-pulse"}`} />
            <span className={connectionStatus.socket === "connected" ? "text-cyan-500/80" : "text-gray-500"}>Socket</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  if (showCreation) return <CreationScreen onCreate={handleCreateCharacter} />;
  if (!character) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/20 relative z-10 rotate-3 group-hover:rotate-6 transition-transform">
              <Flame className="text-white w-6 h-6" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic text-glow-orange">Thiên Đạo Tranh Phong</h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.3em] ml-0.5">The Path of Immortality</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6">
            <div className="flex flex-col items-end group cursor-help">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest font-black group-hover:text-cyan-400 transition-colors">Linh Thạch</span>
              <div className="flex items-center gap-1.5">
                <Gem className="w-3 h-3 text-cyan-500" />
                <span className="text-sm font-mono font-bold text-white">{character.linhThach.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-end group cursor-help">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest font-black group-hover:text-orange-400 transition-colors">Tiên Ngọc</span>
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-mono font-bold text-white">{character.tienNgoc.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          {user.email === "hoangnhan99vt@gmail.com" && (
            <button 
              onClick={() => setShowAdmin(true)}
              className="p-2.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all group"
              title="Quản Trị Hệ Thống"
            >
              <ShieldCheck className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
            </button>
          )}
          <button 
            onClick={() => auth.signOut()}
            className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-xl border border-white/5 hover:border-red-500/30 transition-all group"
            title="Đăng Xuất"
          >
            <LogOut className="w-5 h-5 text-gray-500 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)]">
        {/* Left Sidebar: Character Stats */}
        <aside className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
          <section className="glass-card rounded-[2rem] p-6 space-y-6 relative overflow-hidden group">
            <CharacterAura element={character.element} realm={character.realm} />
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-orange-500/20 transition-colors" />
            
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Tu Sĩ Bản Mệnh</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-gray-300">Đang Trực Tuyến</span>
                </div>
              </div>
              <div className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[9px] rounded-full border border-orange-500/20 font-black uppercase tracking-widest">
                Linh Căn x{character.linhCan.toFixed(1)}
              </div>
            </div>
            
            <div className="space-y-4 relative z-10">
              <ProgressBar label="Khí Huyết" current={character.hp} max={character.hpMax} color="bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(220,38,38,0.3)]" icon={<Heart className="w-3 h-3" />} />
              <ProgressBar label="Linh Lực" current={character.mp} max={character.mpMax} color="bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]" icon={<Zap className="w-3 h-3" />} />
              <ProgressBar label="Tu Vi" current={character.exp} max={Math.floor(Math.pow(character.level, 1.5) * 100)} color="bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.3)]" icon={<Sparkles className="w-3 h-3" />} />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 relative z-10">
              <MiniStat icon={<Sword className="w-3 h-3 text-red-400" />} label="Lực Công" value={character.atk} />
              <MiniStat icon={<Shield className="w-3 h-3 text-cyan-400" />} label="Phòng Ngự" value={character.def} />
              <MiniStat icon={<Zap className="w-3 h-3 text-green-400" />} label="Thân Pháp" value={character.spd} />
              <MiniStat icon={<Skull className="w-3 h-3 text-purple-400" />} label="Tâm Ma" value={character.tamMa} />
            </div>
          </section>

          <nav className="space-y-2">
            <NavButton active={activeTab === "dungeon"} onClick={() => setActiveTab("dungeon")} icon={<Scroll />} label="Lịch Luyện" />
            <NavButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")} icon={<UserIcon />} label="Căn Cơ" />
            <NavButton active={activeTab === "shop"} onClick={() => setActiveTab("shop")} icon={<ShoppingCart />} label="Cửa Hàng" />
            <NavButton active={activeTab === "forge"} onClick={() => setActiveTab("forge")} icon={<Hammer />} label="Luyện Khí" />
            <NavButton active={activeTab === "story"} onClick={() => setActiveTab("story")} icon={<Sparkles />} label="Cốt Truyện" />
            <NavButton active={activeTab === "map"} onClick={() => setActiveTab("map")} icon={<MapIcon />} label="Lục Giới" />
            <NavButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")} icon={<MessageSquare />} label="Truyền Tin" />
            <NavButton active={activeTab === "gm"} onClick={() => { setActiveTab("gm"); if (!gmContent) handleGenerateContent(); }} icon={<Sparkles />} label="Thiên Cơ" />
            <NavButton active={activeTab === "changelog"} onClick={() => setActiveTab("changelog")} icon={<History />} label="Cập Nhật" />
          </nav>

          {worldState && (
            <section className="glass-card rounded-[2rem] p-5 border-orange-500/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 text-orange-500 mb-3 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-4 h-4 animate-bounce" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Biến Cố Thế Giới</span>
              </div>
              <p className="text-xs text-gray-400 font-medium leading-relaxed relative z-10">{worldState.globalEvent}</p>
              {worldState.bossAlive && (
                <div className="mt-4 pt-4 border-t border-white/5 relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] text-red-500 font-black uppercase tracking-widest">Ma Vương Giáng Thế</span>
                    <span className="text-[9px] font-mono text-gray-500">92% HP</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 w-[92%] shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-9 flex flex-col gap-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "dungeon" && (
              <motion.div 
                key="dungeon"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col gap-6 overflow-hidden"
              >
                {/* Dungeon Logs */}
                <div 
                  ref={scrollRef}
                  className="flex-1 glass-card rounded-[2.5rem] p-8 overflow-y-auto custom-scrollbar space-y-6 relative flex flex-col"
                >
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/cultivation/1920/1080?blur=10')] bg-cover bg-center opacity-10 pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.1),transparent_70%)] pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest">Nhật Ký Thám Hiểm</h3>
                  </div>

                  <>
                    {combatState && combatState.isActive && (
                      <div className="sticky top-0 z-50 p-6 bg-black/90 backdrop-blur-xl border border-red-900/50 rounded-[2rem] mb-6 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Skull className="w-5 h-5 text-red-600" />
                            <h3 className="text-lg font-black text-red-600 italic tracking-tight uppercase">{combatState.enemyName}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-black">Sinh Mệnh: {combatState.enemyHp}/{combatState.enemyHpMax}</p>
                          </div>
                        </div>

                        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-6 border border-white/5">
                          <motion.div 
                            initial={{ width: `${(combatState.enemyHp / combatState.enemyHpMax) * 100}%` }}
                            animate={{ width: `${(combatState.enemyHp / combatState.enemyHpMax) * 100}%` }}
                            className="h-full bg-red-600"
                          />
                        </div>

                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-6">
                          <p className="text-sm text-gray-300 italic text-center font-medium leading-relaxed">
                            {combatState.combatLog}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                          {character.activeSkills.map((skill, i) => (
                            <button 
                              key={i}
                              onClick={() => handleUseSkill(skill)}
                              disabled={isProcessing}
                              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                            >
                              {skill}
                            </button>
                          ))}
                        </div>

                        {combatState.isVictory && (
                          <div className="mt-4 p-3 bg-green-900/20 border border-green-900/30 rounded-xl text-center">
                            <p className="text-green-500 font-black uppercase tracking-widest text-xs">Chiến Thắng!</p>
                          </div>
                        )}
                        {combatState.isDefeat && (
                          <div className="mt-4 p-3 bg-red-900/20 border border-red-900/30 rounded-xl text-center">
                            <p className="text-red-500 font-black uppercase tracking-widest text-xs">Thất Bại!</p>
                          </div>
                        )}
                      </div>
                    )}

                      {character.exp >= Math.floor(Math.pow(character.level, 1.5) * 100) && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-8 bg-orange-500/10 border border-orange-500/30 rounded-[2rem] text-center space-y-6 relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-orange-500/5 animate-pulse" />
                          <div className="relative z-10">
                            <div className="flex items-center justify-center gap-3 text-orange-500 mb-2">
                              <Sparkles className="w-8 h-8 animate-pulse" />
                              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-glow-orange">Cơ Hội Đột Phá</h3>
                            </div>
                            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">Linh khí trong cơ thể đã đạt tới trạng thái viên mãn. Thiên địa đang rung chuyển, hãy nắm bắt thời cơ để nghịch thiên cải mệnh!</p>
                          </div>
                          <button 
                            onClick={handleBreakthrough}
                            disabled={isProcessing}
                            className="relative z-10 px-12 py-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] active:scale-95"
                          >
                            Đột Phá Cảnh Giới
                          </button>
                        </motion.div>
                      )}

                      {dungeonLogs.length === 0 && !combatState?.isActive && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-6">
                          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                            <Scroll className="w-10 h-10 opacity-20" />
                          </div>
                          <p className="text-sm italic font-medium tracking-wide">Thiên địa linh khí đang hội tụ... Hãy bắt đầu hành trình của bạn.</p>
                        </div>
                      )}

                      <div className="space-y-4 relative z-10">
                        {dungeonLogs.map((log) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={log.id} 
                            className={cn(
                              "p-5 rounded-2xl border transition-all duration-500 group relative overflow-hidden",
                              log.type === "info" ? "bg-white/5 border-white/5 text-gray-400" :
                              log.type === "success" ? "bg-green-500/5 border-green-500/20 text-green-400" :
                              log.type === "danger" ? "bg-red-500/5 border-red-500/20 text-red-400" :
                              "bg-orange-500/5 border-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.05)]"
                            )}
                          >
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-colors" />
                        <div className="flex justify-between items-center mb-2 relative z-10">
                          <span className="text-[9px] uppercase tracking-[0.3em] font-black opacity-40">{log.timestamp}</span>
                          {log.type === "success" && <Sparkles className="w-3 h-3 animate-pulse" />}
                          {log.type === "danger" && <Skull className="w-3 h-3 animate-bounce" />}
                        </div>
                        <p className="text-sm leading-relaxed relative z-10 font-medium">{log.text}</p>
                      </motion.div>
                    ))}
                  </div>

                  {streamingText && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl border bg-orange-500/5 border-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.05)] relative z-10"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] uppercase tracking-[0.3em] font-black opacity-40">Đang truyền tải...</span>
                        <Sparkles className="w-3 h-3 animate-pulse" />
                      </div>
                      <p className="text-sm leading-relaxed font-medium">{streamingText}</p>
                    </motion.div>
                  )}

                  {isProcessing && !streamingText && (
                    <div className="flex items-center gap-3 p-6 text-orange-500 relative z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-orange-500 blur-md opacity-40 animate-pulse" />
                        <CircleDot className="w-5 h-5 animate-spin relative z-10" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Thiên Đạo đang phản hồi...</span>
                    </div>
                  )}

                  {!isProcessing && choices.length > 0 && (
                    <div className="flex flex-wrap gap-3 p-6 bg-white/[0.02] border border-white/5 rounded-3xl relative z-10">
                      <div className="w-full text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Lựa chọn của bạn:</div>
                      {choices.map((choice, i) => (
                        <button 
                          key={i}
                          onClick={() => handleAction(choice)}
                          className="px-6 py-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-500 hover:text-white transition-all hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] active:scale-95"
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              </div>

              {/* Action Input */}
              <div className="glass-card rounded-[2.5rem] p-5 flex gap-4 items-center group focus-within:border-orange-500/50 transition-all shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-focus-within:border-orange-500/30 transition-colors">
                  <MessageSquare className="w-5 h-5 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAction(inputText)}
                  placeholder="Nhập ý định của bạn vào Thiên Đạo..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-gray-600 font-medium"
                />
                <button 
                  onClick={() => handleAction(inputText)}
                  disabled={isProcessing || !inputText.trim()}
                  className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-30 text-white px-8 py-4 rounded-2xl transition-all flex items-center gap-3 group/btn shadow-xl shadow-orange-500/20 active:scale-95"
                >
                  <span className="text-xs font-black uppercase tracking-widest">Khởi Hành</span>
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {["Tu luyện tĩnh tọa", "Khám phá bí cảnh", "Tìm kiếm cơ duyên", "Săn lùng yêu thú"].map((act) => (
                  <button 
                    key={act}
                    onClick={() => handleAction(act)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                  >
                    {act}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

            {activeTab === "chat" && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden"
              >
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">{msg.sender}</span>
                        <span className="text-[9px] text-gray-500">{msg.timestamp}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2 px-3 max-w-[80%]">
                        <p className="text-sm text-gray-300">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChat} className="p-4 bg-black/40 border-t border-white/10 flex gap-3">
                  <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Truyền tin cho các tu sĩ khác..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50"
                  />
                  <button className="bg-white/10 hover:bg-white/20 text-white px-6 rounded-xl transition-all">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === "story" && (
              <motion.div 
                key="story"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 glass-card rounded-[3rem] p-10 overflow-y-auto custom-scrollbar relative"
              >
                <div className="absolute inset-0 bg-grid opacity-10" />
                <div className="relative z-10 max-w-4xl mx-auto">
                  <div className="text-center mb-12">
                    <motion.h2 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-5xl font-black uppercase tracking-tighter italic text-glow-orange"
                    >
                      Bản Mệnh Cốt Truyện
                    </motion.h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-black mt-4">Thiên mệnh của riêng bạn trong Thiên Đạo</p>
                  </div>

                  {character.story ? (
                    <div className="space-y-12">
                      <section className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <Scroll className="w-6 h-6 text-orange-500" />
                          </div>
                          <h3 className="text-2xl font-black uppercase tracking-tight text-white">{character.story.title}</h3>
                        </div>
                        <div className="p-8 bg-white/5 border border-white/10 rounded-[2rem] relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-24 h-24 text-orange-500" />
                          </div>
                          <p className="text-gray-300 leading-relaxed italic relative z-10">{character.story.lore}</p>
                        </div>
                      </section>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <section className="space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-orange-500/70">Biến Cố Thiên Địa</h4>
                          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
                            <p className="text-sm text-gray-300 leading-relaxed">{character.story.conflict}</p>
                          </div>
                        </section>
                        <section className="space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-widest text-cyan-500/70">Vai Trò Của Bạn</h4>
                          <div className="p-6 bg-cyan-500/5 border border-cyan-500/10 rounded-3xl">
                            <p className="text-sm text-gray-300 leading-relaxed">{character.story.characterRole}</p>
                          </div>
                        </section>
                      </div>

                      <section className="space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 text-center">Các Giai Đoạn Thiên Mệnh</h4>
                        <div className="grid grid-cols-1 gap-4">
                          {character.story.stages.map((stage, idx) => (
                            <div key={idx} className="flex gap-6 items-start group">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                  0{idx + 1}
                                </div>
                                {idx < character.story.stages.length - 1 && (
                                  <div className="w-px h-16 bg-gradient-to-b from-white/10 to-transparent my-2" />
                                )}
                              </div>
                              <div className="flex-1 p-6 bg-white/5 border border-white/10 rounded-3xl group-hover:border-orange-500/30 transition-all">
                                <h5 className="text-sm font-bold text-white mb-2">{stage.title}</h5>
                                <p className="text-xs text-gray-400 leading-relaxed">{stage.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="text-center py-20 space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                        <Sparkles className="w-10 h-10 text-gray-600 animate-pulse" />
                      </div>
                      <p className="text-gray-500 text-sm italic">Thiên cơ chưa hiển lộ, hãy tiếp tục lịch luyện để khai mở cốt truyện...</p>
                      <button 
                        onClick={async () => {
                          setIsGeneratingPlot(true);
                          const plot = await generateWorldPlot(character);
                          if (plot) {
                            const updatedChar = { ...character, story: plot };
                            setCharacter(updatedChar);
                            await updateDoc(doc(db, "characters", character.uid), { story: plot });
                          }
                          setIsGeneratingPlot(false);
                        }}
                        disabled={isGeneratingPlot}
                        className="px-8 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {isGeneratingPlot ? "Đang Khai Mở..." : "Khai Mở Thiên Mệnh"}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "map" && (
              <motion.div 
                key="map"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 glass-card rounded-[3rem] p-10 overflow-y-auto custom-scrollbar relative"
              >
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="relative z-10">
                  <div className="text-center mb-16">
                    <motion.h2 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-5xl font-black uppercase tracking-tighter italic text-glow-orange"
                    >
                      Lục Giới Toàn Đồ
                    </motion.h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-black mt-4">Khám phá các cõi giới trong Thiên Đạo</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {[
                      { name: "Nhân Giới", icon: <UserIcon />, desc: "Nơi khởi đầu của vạn vật, linh khí mỏng manh nhưng ý chí kiên cường.", minRealm: 1, color: "from-blue-500/20", border: "border-blue-500/30" },
                      { name: "Yêu Giới", icon: <Skull />, desc: "Vùng đất của linh thú và yêu ma, nơi kẻ mạnh nuốt chửng kẻ yếu.", minRealm: 3, color: "from-green-500/20", border: "border-green-500/30" },
                      { name: "Linh Giới", icon: <Sparkles />, desc: "Linh khí dồi dào, tiên thảo khắp nơi, thiên đường của tu sĩ.", minRealm: 6, color: "from-cyan-500/20", border: "border-cyan-500/30" },
                      { name: "Ma Giới", icon: <Flame />, desc: "Hỗn loạn và tàn khốc, nơi ma khí ngút trời, thử thách tâm ma.", minRealm: 10, color: "from-red-500/20", border: "border-red-500/30" },
                      { name: "Tiên Giới", icon: <Zap />, desc: "Cõi vĩnh hằng của các bậc đại năng, nơi trường sinh bất tử.", minRealm: 15, color: "from-orange-500/20", border: "border-orange-500/30" },
                      { name: "Thần Giới", icon: <Gem />, desc: "Nơi ngự trị của Thiên Đạo, khởi nguyên của mọi quy luật.", minRealm: 19, color: "from-purple-500/20", border: "border-purple-500/30" },
                    ].map((realm, idx) => (
                      <motion.button 
                        key={realm.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => {
                          if (character.realm >= realm.minRealm) {
                            handleAction(`Ta muốn du hành tới ${realm.name}!`);
                            setActiveTab("dungeon");
                          } else {
                            alert(`Cảnh giới của bạn chưa đủ để tới ${realm.name}! Cần ít nhất ${REALM_NAMES[realm.minRealm - 1]}`);
                          }
                        }}
                        className={cn(
                          "group relative p-8 rounded-[2.5rem] border transition-all duration-500 text-left overflow-hidden glass-card-hover",
                          character.currentRealm === realm.name ? "border-orange-500 bg-orange-500/10" : "border-white/10 bg-white/5",
                          character.realm < realm.minRealm && "opacity-40 grayscale pointer-events-none"
                        )}
                      >
                        <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700", realm.color)} />
                        <div className="relative z-10 space-y-6">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-2xl",
                            character.currentRealm === realm.name ? "bg-orange-500 text-white" : "bg-white/10 text-gray-400 group-hover:text-white"
                          )}>
                            {React.cloneElement(realm.icon as React.ReactElement, { className: "w-8 h-8" })}
                          </div>
                          <div>
                            <h3 className="font-black text-2xl tracking-tight italic group-hover:text-glow-orange transition-all">{realm.name}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed mt-2 font-medium">{realm.desc}</p>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div>
                              <p className="text-[9px] text-gray-600 uppercase tracking-widest font-black">Yêu Cầu</p>
                              <p className="text-xs font-bold text-orange-500/80">{REALM_NAMES[realm.minRealm - 1]}</p>
                            </div>
                            {character.currentRealm === realm.name && (
                              <div className="px-3 py-1 bg-orange-500 text-white text-[9px] font-black uppercase rounded-full animate-pulse">Hiện Tại</div>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === "stats" && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20"
              >
                {/* Character Header Card */}
                <div className="glass-card rounded-[3rem] p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10 opacity-50" />
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full animate-pulse-slow" />
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full animate-pulse-slow" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="relative">
                      <div className="w-40 h-40 rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-purple-600 p-1 shadow-2xl shadow-orange-500/20">
                        <div className="w-full h-full rounded-[2.3rem] bg-black flex items-center justify-center overflow-hidden relative group">
                          <UserIcon className="w-20 h-20 text-white opacity-20 group-hover:scale-110 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Đạo Hữu</span>
                          </div>
                        </div>
                      </div>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-4 border border-dashed border-orange-500/20 rounded-full" 
                      />
                    </div>

                    <div className="flex-1 space-y-6 text-center md:text-left">
                      <div>
                        <h2 className="text-5xl font-black italic tracking-tighter text-glow-orange mb-2">{character.name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                          <div className="px-6 py-2 bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-xl shadow-orange-500/20">
                            {REALM_NAMES[character.realm - 1]}
                          </div>
                          <div className="px-6 py-2 bg-white/5 border border-white/10 text-gray-400 text-xs font-black uppercase tracking-widest rounded-full">
                            Cấp {character.level}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatItem label="Ngộ Tính" value={character.ngoTinh} onAdd={character.statPoints > 0 ? () => handleAddStat("ngoTinh") : undefined} />
                        <StatItem label="Căn Cốt" value={character.canCot} onAdd={character.statPoints > 0 ? () => handleAddStat("canCot") : undefined} />
                        <StatItem label="Phúc Duyên" value={character.phucDuyen} onAdd={character.statPoints > 0 ? () => handleAddStat("phucDuyen") : undefined} />
                        <StatItem label="Khí Vận" value={character.khiVan} onAdd={character.statPoints > 0 ? () => handleAddStat("khiVan") : undefined} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Left Column: Equipment & Inventory */}
                  <div className="space-y-8">
                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                          <Shield className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Pháp Bảo Trang Bị</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(character.equipment).map(([slot, item]: [string, any]) => (
                          <div key={slot} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-orange-500/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-orange-500/5 transition-colors">
                                {slot === "Weapon" ? <Sword className="w-5 h-5 text-gray-500 group-hover:text-orange-500" /> : 
                                 slot === "Armor" ? <Shield className="w-5 h-5 text-gray-500 group-hover:text-cyan-500" /> :
                                 <Gem className="w-5 h-5 text-gray-500 group-hover:text-purple-500" />}
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-0.5">{slot}</p>
                                <p className={cn("text-sm font-bold tracking-tight", item ? "text-orange-400" : "text-gray-700 italic")}>
                                  {item ? item.name : "Vị trí trống"}
                                </p>
                              </div>
                            </div>
                            {item && (
                              <button 
                                onClick={() => unequipItem(slot)}
                                className="px-4 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-lg hover:bg-red-500 hover:text-white transition-all"
                              >
                                Tháo
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Gem className="w-5 h-5 text-cyan-500" />
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tighter italic">Hành Trang</h3>
                        </div>
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{character.inventory?.length || 0} / 50</span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {character.inventory?.length === 0 && (
                          <div className="py-10 text-center space-y-3 opacity-20">
                            <Gem className="w-10 h-10 mx-auto" />
                            <p className="text-xs italic font-medium">Hành trang trống rỗng...</p>
                          </div>
                        )}
                        {character.inventory?.map((item, i) => (
                          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                <Gem className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-300">{item.name}</p>
                                <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest">{item.type}</p>
                              </div>
                            </div>
                            {item.type === "equipment" && (
                              <button 
                                onClick={() => equipItem(item)}
                                className="px-5 py-2 bg-cyan-500/10 text-cyan-500 text-[10px] font-black uppercase rounded-xl hover:bg-cyan-500 hover:text-white transition-all shadow-lg shadow-cyan-500/10"
                              >
                                Trang bị
                              </button>
                            )}
                            {item.type === "consumable" && (
                              <button 
                                onClick={() => useItem(item, i)}
                                className="px-5 py-2 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/10"
                              >
                                Sử dụng
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Profession & Quests */}
                  <div className="space-y-8">
                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                          <Sparkles className="w-5 h-5 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Nghề Nghiệp & Kỹ Năng</h3>
                      </div>

                      {character.profession ? (
                        <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/10 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-2xl -mr-12 -mt-12" />
                          <div className="flex justify-between items-center relative z-10">
                            <div>
                              <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Nghề Nghiệp Hiện Tại</p>
                              <h4 className="text-xl font-black text-cyan-400 italic tracking-tight">{character.profession.type}</h4>
                            </div>
                            <div className="px-4 py-1.5 bg-cyan-500 text-white text-[10px] rounded-full font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20">
                              {character.profession.rank}
                            </div>
                          </div>
                          <div className="space-y-2 relative z-10">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                              <span className="text-gray-500">Cấp Độ {character.profession.level}</span>
                              <span className="text-cyan-500">{character.profession.exp} / 100 EXP</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(character.profession.exp % 100)}%` }}
                                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-6 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl text-center">
                            <p className="text-xs text-gray-600 italic font-medium">Bạn chưa gia nhập nghề nghiệp nào để bắt đầu hành trình sản xuất.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {["Luyện Đan Sư", "Luyện Khí Sư", "Trận Pháp Sư", "Phù Lục Sư", "Linh Thực Phu"].map((prof) => (
                              <button 
                                key={prof}
                                onClick={() => joinProfession(prof)}
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-gray-400 hover:text-cyan-400"
                              >
                                {prof}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest ml-1">Kỹ Năng Đã Lĩnh Hội</p>
                          <p className="text-[9px] text-orange-500/60 uppercase font-black tracking-widest mr-1">
                            Kỹ năng tiếp theo: Cấp {character.level % 2 === 0 ? character.level + 2 : character.level + 1}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {character.skills?.length === 0 && (
                            <p className="text-xs text-gray-700 italic ml-1">Chưa lĩnh hội kỹ năng nào...</p>
                          )}
                          {character.skills?.map((skill, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:border-orange-500/30 transition-all">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
                                <Scroll className="w-5 h-5 text-orange-500" />
                              </div>
                              <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{skill}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                          <Flame className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Nhiệm Vụ Thiên Đạo</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {character.activeQuests?.length === 0 && (
                          <div className="py-10 text-center space-y-3 opacity-20">
                            <Scroll className="w-10 h-10 mx-auto" />
                            <p className="text-xs italic font-medium">Chưa có nhiệm vụ nào...</p>
                          </div>
                        )}
                        {character.activeQuests?.map((quest, i) => (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={i} 
                            className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 space-y-4 group hover:border-orange-500/30 transition-all"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-base font-black text-orange-400 italic tracking-tight mb-1">{quest.title}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-full uppercase font-black tracking-widest border border-orange-500/20">{quest.difficulty}</span>
                                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Nhiệm Vụ Chính Tuyến</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium">{quest.description}</p>
                            <button 
                              onClick={() => completeQuest(quest.id)}
                              className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                            >
                              Hoàn Thành Nhiệm Vụ
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "shop" && (
              <motion.div 
                key="shop"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20"
              >
                <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-lg shadow-orange-500/10">
                        <ShoppingCart className="w-8 h-8 text-orange-500" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter italic">Vạn Bảo Các</h2>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Nơi trao đổi kỳ trân dị bảo</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3">
                      <Gem className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Linh Thạch</p>
                        <p className="text-xl font-black text-cyan-400">{character.linhThach}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Mua Vật Phẩm */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-black uppercase tracking-tighter italic text-orange-500">Mua Vật Phẩm</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {SHOP_ITEMS.map((item) => (
                          <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group hover:border-orange-500/30 transition-all">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                  <Gem className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-200">{item.name}</p>
                                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{item.type} • {item.quality}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-cyan-400">{item.price} LT</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-400">{item.description}</p>
                            <button 
                              onClick={() => buyItem(item)}
                              disabled={character.linhThach < (item.price || 0)}
                              className="w-full py-2 bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase rounded-xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-orange-500/10 disabled:hover:text-orange-500"
                            >
                              Mua
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Bán Vật Phẩm */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-black uppercase tracking-tighter italic text-cyan-500">Bán Vật Phẩm</h3>
                      <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {character.inventory?.length === 0 && (
                          <div className="py-10 text-center space-y-3 opacity-20">
                            <Gem className="w-10 h-10 mx-auto" />
                            <p className="text-xs italic font-medium">Hành trang trống rỗng...</p>
                          </div>
                        )}
                        {character.inventory?.map((item, index) => {
                          const sellPrice = item.price ? Math.floor(item.price / 2) : 10;
                          return (
                            <div key={`${item.id}-${index}`} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                  <Gem className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-200">{item.name}</p>
                                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{item.type}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <p className="text-xs font-black text-cyan-400">+{sellPrice} LT</p>
                                <button 
                                  onClick={() => sellItem(item, index)}
                                  className="px-4 py-1.5 bg-cyan-500/10 text-cyan-500 text-[10px] font-black uppercase rounded-xl hover:bg-cyan-500 hover:text-white transition-all"
                                >
                                  Bán
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "forge" && (
              <motion.div 
                key="forge"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20"
              >
                <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-lg shadow-red-500/10">
                        <Hammer className="w-8 h-8 text-red-500" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter italic">Luyện Khí Đường</h2>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Cường hóa trang bị, đột phá giới hạn</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3">
                      <Gem className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Linh Thạch</p>
                        <p className="text-xl font-black text-cyan-400">{character.linhThach}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Trang bị đang mặc */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-black uppercase tracking-tighter italic text-red-500">Trang Bị Đang Mặc</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(character.equipment).map(([slot, itemValue]) => {
                          const item = itemValue as any;
                          if (!item) return null;
                          const currentLevel = item.upgradeLevel || 0;
                          const upgradeCost = 50 + currentLevel * 50;
                          return (
                            <div key={`equip-${slot}`} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group hover:border-red-500/30 transition-all">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                    <Hammer className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-200">{item.name}</p>
                                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{slot} • {item.quality}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-cyan-400">{upgradeCost} LT</p>
                                </div>
                              </div>
                              <div className="flex gap-2 text-xs text-gray-400">
                                {item.stats?.atk && <span>ATK: {item.stats.atk}</span>}
                                {item.stats?.def && <span>DEF: {item.stats.def}</span>}
                                {item.stats?.hp && <span>HP: {item.stats.hp}</span>}
                                {item.stats?.mp && <span>MP: {item.stats.mp}</span>}
                              </div>
                              <button 
                                onClick={() => upgradeItem(item, -1, true, slot)}
                                disabled={character.linhThach < upgradeCost}
                                className="w-full py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-red-500/10 disabled:hover:text-red-500"
                              >
                                Cường Hóa
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* Trang bị trong túi */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-black uppercase tracking-tighter italic text-gray-400">Trang Bị Trong Túi</h3>
                      <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {character.inventory?.filter(i => i.type === "equipment").length === 0 && (
                          <div className="py-10 text-center space-y-3 opacity-20">
                            <Hammer className="w-10 h-10 mx-auto" />
                            <p className="text-xs italic font-medium">Không có trang bị nào...</p>
                          </div>
                        )}
                        {character.inventory?.map((item, index) => {
                          if (item.type !== "equipment") return null;
                          const currentLevel = item.upgradeLevel || 0;
                          const upgradeCost = 50 + currentLevel * 50;
                          return (
                            <div key={`inv-${item.id}-${index}`} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 group hover:border-gray-400/30 transition-all">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                                    <Hammer className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-200">{item.name}</p>
                                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{item.slot} • {item.quality}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-cyan-400">{upgradeCost} LT</p>
                                </div>
                              </div>
                              <div className="flex gap-2 text-xs text-gray-400">
                                {item.stats?.atk && <span>ATK: {item.stats.atk}</span>}
                                {item.stats?.def && <span>DEF: {item.stats.def}</span>}
                                {item.stats?.hp && <span>HP: {item.stats.hp}</span>}
                                {item.stats?.mp && <span>MP: {item.stats.mp}</span>}
                              </div>
                              <button 
                                onClick={() => upgradeItem(item, index, false)}
                                disabled={character.linhThach < upgradeCost}
                                className="w-full py-2 bg-gray-500/10 text-gray-400 text-[10px] font-black uppercase rounded-xl hover:bg-gray-500 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-gray-500/10 disabled:hover:text-gray-400"
                              >
                                Cường Hóa
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "changelog" && (
              <motion.div 
                key="changelog"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20"
              >
                <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10">
                      <History className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter italic">Nhật Ký Cập Nhật</h2>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Lịch sử tiến hóa của Tiên Hiệp Giới</p>
                    </div>
                  </div>

                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                    {CHANGELOG.map((log, index) => (
                      <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-black/50 backdrop-blur-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">
                          <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                        </div>
                        
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-card p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-white">{log.version}</h3>
                            <span className="text-[10px] text-blue-400 font-black tracking-widest uppercase bg-blue-500/10 px-3 py-1 rounded-full">{log.date}</span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-300 mb-4">{log.title}</h4>
                          <ul className="space-y-2">
                            {log.changes.map((change, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "gm" && (
              <motion.div 
                key="gm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pb-20"
              >
                <div className="glass-card rounded-[3rem] p-10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10 opacity-50" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-2 text-center md:text-left">
                      <h2 className="text-4xl font-black tracking-tighter italic text-glow-orange flex items-center justify-center md:justify-start gap-4">
                        <Sparkles className="w-10 h-10 text-orange-500 animate-pulse" />
                        Thiên Cơ Lâu
                      </h2>
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Nơi AI Game Master dẫn dắt vận mệnh của bạn</p>
                    </div>
                    <button 
                      onClick={handleGenerateContent}
                      disabled={isGeneratingGM}
                      className="px-10 py-5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-[1.5rem] transition-all shadow-2xl shadow-orange-500/20 active:scale-95 flex items-center gap-3"
                    >
                      {isGeneratingGM ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang Bói Quẻ...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Gieo Quẻ Mới
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleGeneratePlot}
                      disabled={isGeneratingPlot}
                      className="px-10 py-5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-[1.5rem] transition-all shadow-2xl shadow-purple-500/20 active:scale-95 flex items-center gap-3"
                    >
                      {isGeneratingPlot ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang Viết Sử...
                        </>
                      ) : (
                        <>
                          <Scroll className="w-4 h-4" />
                          Tạo Cốt Truyện
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isGeneratingPlot && (
                  <div className="h-96 flex flex-col items-center justify-center space-y-6 glass-card rounded-[3rem]">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-purple-500/20 rounded-full" />
                      <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <Scroll className="absolute inset-0 m-auto w-8 h-8 text-purple-500 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-black italic text-purple-500 animate-pulse">Đại Văn Hào đang chấp bút...</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Vận mệnh sử thi đang được hình thành</p>
                    </div>
                  </div>
                )}

                {worldPlot && !isGeneratingPlot && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card rounded-[3rem] p-10 space-y-8 border border-purple-500/20"
                  >
                    <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <Scroll className="w-8 h-8 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black italic text-glow-purple tracking-tighter uppercase">{worldPlot.title}</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Sử Thi Của Cõi {character.currentRealm}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <section>
                          <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3">Bối Cảnh Lịch Sử</h4>
                          <p className="text-sm text-gray-400 leading-relaxed italic">"{worldPlot.lore}"</p>
                        </section>
                        <section>
                          <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Đại Họa / Âm Mưu</h4>
                          <p className="text-sm text-gray-400 leading-relaxed">{worldPlot.conflict}</p>
                        </section>
                        <section>
                          <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-3">Vai Trò Của Bạn</h4>
                          <p className="text-sm text-gray-400 leading-relaxed">{worldPlot.characterRole}</p>
                        </section>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Các Giai Đoạn Vận Mệnh</h4>
                        <div className="space-y-4">
                          {worldPlot.stages.map((stage: any, idx: number) => (
                            <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
                              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/20 group-hover:bg-purple-500 transition-colors" />
                              <h5 className="font-black text-sm text-purple-400 mb-2 uppercase tracking-tight">{stage.title}</h5>
                              <p className="text-xs text-gray-500 leading-relaxed">{stage.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isGeneratingGM ? (
                  <div className="h-96 flex flex-col items-center justify-center space-y-6 glass-card rounded-[3rem]">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-orange-500/20 rounded-full" />
                      <div className="absolute inset-0 w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-orange-500 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-black italic text-orange-500 animate-pulse">Thiên Đạo đang vận hành...</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Vận mệnh đang được định đoạt</p>
                    </div>
                  </div>
                ) : gmContent ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Quests */}
                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                          <Scroll className="w-5 h-5 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Nhiệm Vụ Cơ Duyên</h3>
                      </div>
                      <div className="space-y-4">
                        {gmContent.quests.map((q: any) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={q.id} 
                            className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-4 hover:border-orange-500/30 transition-all group relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl -mr-12 -mt-12" />
                            <div className="flex justify-between items-start relative z-10">
                              <div>
                                <h4 className="font-black text-lg text-orange-400 italic tracking-tight mb-1">{q.title}</h4>
                                <span className="text-[9px] px-2 py-0.5 bg-white/10 rounded-full uppercase font-black tracking-widest border border-white/10">{q.difficulty}</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium relative z-10">{q.description}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                              <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Thưởng: <span className="text-orange-500">{q.rewards.exp} EXP</span></div>
                              <button 
                                onClick={() => acceptQuest(q)}
                                className="px-5 py-2 bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-lg shadow-orange-500/10"
                              >
                                Nhận Nhiệm Vụ
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>

                    {/* Skills */}
                    <section className="glass-card rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <Zap className="w-5 h-5 text-cyan-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Bí Tịch Thất Truyền</h3>
                      </div>
                      <div className="space-y-4">
                        {gmContent.skills.map((s: any, i: number) => (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={i} 
                            className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-4 hover:border-cyan-500/30 transition-all group relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl -mr-12 -mt-12" />
                            <div className="flex justify-between items-start relative z-10">
                              <div>
                                <h4 className="font-black text-lg text-cyan-400 italic tracking-tight mb-1">{s.name}</h4>
                                <span className="text-[9px] px-2 py-0.5 bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded-full uppercase font-black tracking-widest">
                                  Cảnh Giới {s.requiredRealm}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium relative z-10">{s.description}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                              <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Hệ: <span className="text-cyan-500">{s.element}</span></span>
                              <button 
                                onClick={() => learnSkill(s)}
                                className="px-5 py-2 bg-cyan-500/10 text-cyan-500 text-[10px] font-black uppercase rounded-xl hover:bg-cyan-500 hover:text-white transition-all shadow-lg shadow-cyan-500/10"
                              >
                                Lĩnh Ngộ
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>

                    {/* Bosses */}
                    <section className="xl:col-span-2 glass-card rounded-[2.5rem] p-8 space-y-8">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                          <Skull className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tighter italic">Đại Ma Đầu Xuất Thế</h3>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {gmContent.bosses.map((b: any, i: number) => (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={i} 
                            className="bg-red-500/5 border border-red-500/20 p-8 rounded-[2rem] flex flex-col md:flex-row gap-8 hover:bg-red-500/10 transition-all group relative overflow-hidden"
                          >
                            <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/10 blur-3xl rounded-full" />
                            <div className="w-32 h-32 bg-red-500/10 rounded-3xl flex items-center justify-center shrink-0 border border-red-500/20 group-hover:scale-110 transition-transform duration-500 relative z-10">
                              <Skull className="w-16 h-16 text-red-500 animate-pulse" />
                            </div>
                            <div className="flex-1 space-y-4 relative z-10">
                              <div>
                                <h4 className="text-2xl font-black text-red-500 italic tracking-tight">{b.name}</h4>
                                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black mt-1">{b.title}</p>
                              </div>
                              <p className="text-xs text-gray-400 italic leading-relaxed font-medium">"{b.mechanics}"</p>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { label: "HP", value: b.hp.toLocaleString(), color: "text-red-500" },
                                  { label: "ATK", value: b.atk.toLocaleString(), color: "text-orange-500" },
                                  { label: "DEF", value: b.def.toLocaleString(), color: "text-blue-500" },
                                ].map((stat) => (
                                  <div key={stat.label} className="text-center p-3 bg-black/40 rounded-2xl border border-white/5">
                                    <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-1">{stat.label}</p>
                                    <p className={cn("text-xs font-black", stat.color)}>{stat.value}</p>
                                  </div>
                                ))}
                              </div>
                              <button 
                                onClick={() => challengeBoss(b)}
                                className="w-full py-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl shadow-red-600/30 active:scale-95"
                              >
                                Khiêu Chiến Đại Ma Đầu
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center text-gray-600 space-y-6 glass-card rounded-[3rem]">
                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10 animate-float">
                      <Sparkles className="w-12 h-12 opacity-20" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-black italic text-gray-500">Thiên Cơ Bất Khả Lộ</p>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Hãy gieo quẻ để nhận cơ duyên từ Thiên Đạo</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showAdmin && (
          <AdminPanel onClose={() => setShowAdmin(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.05),transparent_70%)]" />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-12 text-center space-y-8 backdrop-blur-xl relative z-10"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20 rotate-3">
          <Flame className="text-white w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Thiên Đạo Tranh Phong</h1>
          <p className="text-gray-400 text-sm leading-relaxed">Hành trình tu tiên, nghịch thiên cải mệnh trong thế giới MMORPG AI thế hệ mới.</p>
        </div>
        <button 
          onClick={onLogin}
          className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-orange-500 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 group"
        >
          <Sparkles className="w-5 h-5 transition-transform group-hover:scale-110" />
          Bắt Đầu Tu Luyện
        </button>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Powered by Google Gemini AI</p>
      </motion.div>
    </div>
  );
}

function CreationScreen({ onCreate }: { onCreate: (name: string, race: Race, element: Element) => void }) {
  const [name, setName] = useState("");
  const [race, setRace] = useState<Race>("Nhân");
  const [element, setElement] = useState<Element>("Hỏa");

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-10 shadow-2xl shadow-orange-500/5"
      >
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-glow-orange">Khởi Tạo Đạo Hiệu</h2>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Lựa chọn căn cơ để bước vào con đường tu tiên.</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Tên Đạo Hiệu</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Tiêu Viêm, Thạch Hạo, Hàn Lập..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-gray-200 focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-gray-700 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Chủng Tộc</label>
              <div className="grid grid-cols-4 gap-3">
                {RACES.map(r => (
                  <button 
                    key={r}
                    onClick={() => setRace(r)}
                    className={cn(
                      "py-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95",
                      race === r ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-white/[0.03] border-white/10 text-gray-500 hover:border-white/20"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Bản Mệnh Ngũ Hành</label>
              <div className="grid grid-cols-5 gap-3">
                {ELEMENTS.map(e => (
                  <button 
                    key={e}
                    onClick={() => setElement(e)}
                    className={cn(
                      "py-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all active:scale-95",
                      element === e ? "bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "bg-white/[0.03] border-white/10 text-gray-500 hover:border-white/20"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-orange-500/5 border border-orange-500/10 rounded-[2rem] p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-orange-500 mb-2">
              <Sparkles className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Thiên Mệnh</p>
            </div>
            <p className="text-[10px] text-gray-500 italic leading-relaxed">Kỹ năng khởi đầu sẽ được ban tặng dựa trên Bản Mệnh Ngũ Hành mà bạn đã chọn. Hãy cân nhắc kỹ trước khi bước vào Lục Giới.</p>
          </div>
        </div>

        <button 
          onClick={() => onCreate(name, race, element)}
          disabled={!name.trim()}
          className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black uppercase tracking-[0.2em] py-5 rounded-[2rem] hover:from-orange-500 hover:to-orange-400 disabled:opacity-30 transition-all flex items-center justify-center gap-4 shadow-xl shadow-orange-500/20 active:scale-[0.98]"
        >
          Bước Vào Lục Giới
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
}

function ProgressBar({ label, current, max, color, icon }: any) {
  const percent = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tighter">
        <div className="flex items-center gap-1 text-gray-400">
          {icon}
          {label}
        </div>
        <span className="text-gray-300">{current} / {max}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

function StatItem({ label, value, onAdd }: any) {
  return (
    <div className="flex flex-col relative group p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-orange-500/30 transition-all">
      <span className="text-[9px] text-gray-600 uppercase tracking-widest font-black mb-1">{label}</span>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-mono font-black text-gray-100 italic">{value}</span>
        {onAdd && (
          <button 
            onClick={onAdd}
            className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 rounded-xl flex items-center justify-center text-white transition-all shadow-lg shadow-orange-500/20 active:scale-90"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: any) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex items-center gap-3 group hover:border-white/20 transition-all">
      <div className="text-gray-500 group-hover:text-orange-500 transition-colors">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[8px] text-gray-600 uppercase font-black tracking-widest">{label}</span>
        <span className="text-xs font-mono font-black text-gray-300">{value}</span>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative overflow-hidden",
        active ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-2xl shadow-orange-500/30" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <div className={cn("relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", active ? "text-white" : "text-gray-600")}>
        {React.cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
      {active && (
        <motion.div 
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="relative z-10 ml-auto"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.div>
      )}
    </button>
  );
}
