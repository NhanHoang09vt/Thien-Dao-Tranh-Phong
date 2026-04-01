export type Race = "Nhân" | "Yêu" | "Ma" | "Linh";
export type Element = "Kim" | "Mộc" | "Thủy" | "Hỏa" | "Thổ" | "Lôi" | "Phong" | "Băng" | "Quang" | "Ám";
export type RealmType = "Phàm" | "Tiên" | "Thần";
export type EquipmentSlot = "Weapon" | "Armor" | "Accessory" | "Head" | "Legs";
export type ProfessionType = "Luyện Đan Sư" | "Luyện Khí Sư" | "Trận Pháp Sư" | "Phù Lục Sư" | "Linh Thực Phu";

export interface Equipment {
  id: string;
  name: string;
  slot: EquipmentSlot;
  quality: "Phàm" | "Linh" | "Huyền" | "Địa" | "Thiên" | "Thần";
  requiredRealm: number;
  stats: {
    atk?: number;
    def?: number;
    hp?: number;
    mp?: number;
    spd?: number;
    crit?: number;
  };
  effect?: string;
  upgradeLevel?: number;
}

export interface Profession {
  type: ProfessionType;
  level: number;
  exp: number;
  rank: string; // e.g., "Nhất Phẩm", "Nhị Phẩm"
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: "PvE" | "PvP" | "Exploration" | "Story";
  difficulty: "Dễ" | "Trung Bình" | "Khó" | "Cực Khó" | "Truyền Thuyết";
  requirements: string;
  rewards: {
    exp: number;
    linhThach: number;
    item?: string;
  };
  status: "Active" | "Completed" | "Failed";
  progress: number;
  target: number;
}

export interface Story {
  title: string;
  lore: string;
  conflict: string;
  characterRole: string;
  stages: {
    title: string;
    description: string;
  }[];
}

export interface Item {
  id: string;
  name: string;
  type: "equipment" | "consumable" | "material";
  slot?: EquipmentSlot;
  quality: "Phàm" | "Linh" | "Huyền" | "Địa" | "Thiên" | "Thần";
  requiredRealm?: number;
  stats?: {
    atk?: number;
    def?: number;
    hp?: number;
    mp?: number;
    spd?: number;
  };
  price?: number; // For shop
  description?: string;
  upgradeLevel?: number;
}

export interface Character {
  uid: string;
  name: string;
  race: Race;
  element: Element;
  linhCan: number; // Multiplier (0.6 - 2.0)
  realm: number; // 1-20
  realmLevel: number; // 1-12 (Tầng)
  level: number; // Overall level (sum of tiers)
  exp: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  cDMG: number;
  acc: number;
  eva: number;
  ngoTinh: number;
  canCot: number;
  phucDuyen: number;
  tamMa: number;
  khiVan: number;
  skillPoints: number;
  statPoints: number;
  linhThach: number;
  tienNgoc: number;
  skills: string[];
  activeSkills: string[];
  inventory: Item[];
  equipment: Partial<Record<EquipmentSlot, Equipment | null>>;
  profession?: Profession;
  currentRealm: string;
  story?: Story;
  lastActionAt: string;
  activeQuests: Quest[];
}

export interface Realm {
  id: number;
  name: string;
  type: RealmType;
  baseSuccessRate: number;
}

export interface DungeonLog {
  id: string;
  text: string;
  type: "info" | "success" | "danger" | "reward";
  timestamp: string;
}
