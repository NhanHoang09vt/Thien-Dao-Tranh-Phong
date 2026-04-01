import { Realm, Race, Element } from "./types";

export const RACES: Race[] = ["Nhân", "Yêu", "Ma", "Linh"];
export const ELEMENTS: Element[] = ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"];
export const DI_LINH: Element[] = ["Lôi", "Phong", "Băng", "Quang", "Ám"];

export const REALM_NAMES = [
  "Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh", "Hóa Thần", 
  "Luyện Hư", "Hợp Thể", "Đại Thừa", "Độ Kiếp", "Chân Tiên", 
  "Thiên Tiên", "Kim Tiên", "Thái Ất", "Đại La", "Tiên Vương", 
  "Tiên Quân", "Tiên Tôn", "Tiên Đế", "Bán Thần", "Thần",
  "Thần Tướng", "Thần Vương", "Thần Tôn", "Thần Đế", "Sáng Thế Thần"
];

export const REALMS: Realm[] = REALM_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  type: i < 9 ? "Phàm" : i < 18 ? "Tiên" : "Thần",
  baseSuccessRate: Math.max(10, 90 - (i * 3)) // Decreases as realm increases, min 10%
}));

export const ELEMENT_MULTIPLIERS: Record<Element, { strong: Element; weak: Element }> = {
  "Kim": { strong: "Mộc", weak: "Hỏa" },
  "Mộc": { strong: "Thổ", weak: "Kim" },
  "Thủy": { strong: "Hỏa", weak: "Thổ" },
  "Hỏa": { strong: "Kim", weak: "Thủy" },
  "Thổ": { strong: "Thủy", weak: "Mộc" },
  "Lôi": { strong: "Phong", weak: "Băng" },
  "Phong": { strong: "Băng", weak: "Lôi" },
  "Băng": { strong: "Quang", weak: "Ám" },
  "Quang": { strong: "Ám", weak: "Băng" },
  "Ám": { strong: "Lôi", weak: "Quang" }
};

export const PROFESSIONS: string[] = ["Luyện Đan Sư", "Luyện Khí Sư", "Trận Pháp Sư", "Phù Lục Sư", "Linh Thực Phu"];
export const EQUIPMENT_SLOTS: string[] = ["Weapon", "Armor", "Accessory", "Head", "Legs"];

export const ELEMENT_SKILLS: Record<Element, string[]> = {
  "Kim": ["Canh Kim Kiếm Khí", "Thái Ất Kiếm Quyết", "Kim Cương Bất Hoại", "Vạn Kiếm Quy Tông", "Kim Tiên Trảm", "Đại La Kim Thân", "Phá Giáp Tiễn", "Kim Quang Trận", "Thần Binh Luyện Thể", "Cửu Chuyển Kim Thân", "Vô Cực Kiếm Vực", "Thiên Phạt Kiếm"],
  "Mộc": ["Thanh Liên Kiếm Ý", "Vạn Vật Sinh Trưởng", "Linh Diệp Phi Hoa", "Thiên Địa Trường Sinh", "Mộc Linh Chưởng", "Thần Mộc Hộ Thể", "Phệ Huyết Đằng", "Độc Mộc Trận", "Sâm La Vạn Tượng", "Bồ Đề Tâm Pháp", "Thanh Long Hô Khiếu", "Sinh Mệnh Tế Đàn"],
  "Thủy": ["Thủy Long Trầm", "Hàn Băng Kiếm Pháp", "Bích Hải Triều Sinh", "Vạn Thủy Quy Nguyên", "Thủy Mạc Thiên Hoa", "Lạc Thủy Quyết", "Băng Sương Xuyên Tâm", "Huyền Thủy Trận", "Kinh Đào Khái Lãng", "Nhược Thủy Tam Thiên", "Băng Phách Thần Quang", "Hải Thần Chi Nộ"],
  "Hỏa": ["Liệt Diễm Chưởng", "Phượng Hoàng Niết Bàn", "Cửu Dương Thần Công", "Thiên Hỏa Phần Thế", "Hồng Liên Nghiệp Hỏa", "Thái Dương Chân Hỏa", "Hỏa Lưu Tinh", "Bát Hoang Hỏa Long", "Phần Thiên Chử Hải", "Viêm Thần Quyết", "Tam Muội Chân Hỏa", "Diệt Thế Hắc Viêm"],
  "Thổ": ["Huyền Vũ Hộ Thể", "Địa Long Phiên Thân", "Thái Sơn Áp Đỉnh", "Bất Động Minh Vương", "Thổ Độn Thuật", "Càn Khôn Đại Na Di", "Phi Sa Tẩu Thạch", "Đại Địa Mạch Động", "Thiên Băng Địa Liệt", "Hậu Thổ Quyết", "Vẫn Thạch Thiên Hàng", "Đại Địa Chi Hồn"],
  "Lôi": ["Cửu Thiên Lôi Đình", "Ngũ Lôi Chính Pháp", "Lôi Đình Vạn Quân", "Thiên Lôi Biến", "Lôi Long Phá", "Tử Tiêu Thần Lôi", "Lôi Quang Độn", "Lôi Võng Thiên La", "Cuồng Lôi Thiên Lao", "Thần Lôi Phạt Thế", "Lôi Đế Quyết", "Vô Tận Lôi Vực"],
  "Phong": ["Tật Phong Bộ", "Ngự Phong Thuật", "Phong Thần Cước", "Cửu Tiêu Phong Vân", "Phong Nh刃", "Thần Phong Trảm", "Cuồng Phong Bạo Vũ", "Toàn Phong Trảm", "Phong Quyển Tàn Vân", "Đại Phong Ca", "Vô Hình Cương Phong", "Phong Thần Lĩnh Vực"],
  "Băng": ["Hàn Băng Phách", "Tuyết Hoa Lục Xuất", "Băng Phong Thiên Lý", "Hàn Băng Chưởng", "Băng Long Phá", "Tuyệt Đối Lãnh Độ", "Băng Tiễn Thuật", "Băng Sương Bạo", "Hàn Khí Cốt Tủy", "Băng Tuyết Phong Bạo", "Cực Hàn Chi Vực", "Băng Đế Hàng Lâm"],
  "Quang": ["Thánh Quang Phổ Chiếu", "Đại Nhật Như Lai", "Hạo Nhiên Chính Khí", "Thiên Quang Trảm", "Quang Minh Đại Đạo", "Phật Quang Phổ Chiếu", "Thánh Quang Thuẫn", "Tịnh Hóa Chi Quang", "Quang Mang Vạn Trượng", "Thần Thánh Thẩm Phán", "Quang Minh Thánh Hỏa", "Thiên Sứ Hàng Lâm"],
  "Ám": ["U Minh Quỷ Trảo", "Thôn Phệ Ma Công", "Hắc Ám Chi Nhãn", "Ma Long Phá", "Cửu U Minh Hỏa", "Ma Ảnh Mê Tung", "Ám Ảnh Độn", "Hấp Huyết Ma Công", "Hắc Ám Thâm Uyên", "Ma Thần Hàng Lâm", "Ám Dạ Lĩnh Vực", "Vô Tận Hắc Ám"]
};

import { Item } from "./types";

export const SHOP_ITEMS: Item[] = [
  { id: "hp_potion_1", name: "Hồi Huyết Đan (Hạ Phẩm)", type: "consumable", quality: "Phàm", stats: { hp: 50 }, price: 10, description: "Hồi phục 50 HP." },
  { id: "hp_potion_2", name: "Hồi Huyết Đan (Trung Phẩm)", type: "consumable", quality: "Linh", stats: { hp: 200 }, price: 50, description: "Hồi phục 200 HP." },
  { id: "mp_potion_1", name: "Hồi Khí Đan (Hạ Phẩm)", type: "consumable", quality: "Phàm", stats: { mp: 50 }, price: 10, description: "Hồi phục 50 MP." },
  { id: "mp_potion_2", name: "Hồi Khí Đan (Trung Phẩm)", type: "consumable", quality: "Linh", stats: { mp: 200 }, price: 50, description: "Hồi phục 200 MP." },
  { id: "wpn_iron_sword", name: "Thiết Kiếm", type: "equipment", slot: "Weapon", quality: "Phàm", stats: { atk: 10 }, price: 100, description: "Vũ khí cơ bản cho người mới tu luyện." },
  { id: "arm_cloth", name: "Bố Y", type: "equipment", slot: "Armor", quality: "Phàm", stats: { def: 5, hp: 20 }, price: 80, description: "Y phục bằng vải thô, phòng ngự yếu." },
  { id: "acc_jade", name: "Ngọc Bội Bình Thường", type: "equipment", slot: "Accessory", quality: "Phàm", stats: { mp: 30 }, price: 150, description: "Ngọc bội chứa chút linh khí." },
  { id: "wpn_spirit_sword", name: "Thanh Phong Kiếm", type: "equipment", slot: "Weapon", quality: "Linh", stats: { atk: 35, spd: 5 }, price: 500, description: "Kiếm pháp linh hoạt, chém sắt như bùn." },
  { id: "arm_spirit", name: "Linh Tơ Giáp", type: "equipment", slot: "Armor", quality: "Linh", stats: { def: 20, hp: 100 }, price: 450, description: "Giáp dệt từ tơ linh thú." },
];

export const CHANGELOG = [
  {
    version: "v1.3.0",
    date: "01/04/2026",
    title: "Mở Rộng Hệ Thống Cảnh Giới & Kỹ Năng",
    changes: [
      "Bổ sung thêm 6 kỹ năng mới cho mỗi Hệ (Kim, Mộc, Thủy, Hỏa, Thổ, Lôi, Phong, Băng, Quang, Ám).",
      "Tăng tần suất học kỹ năng mới: Cứ mỗi 2 cấp độ (thay vì 3) sẽ có cơ hội ngộ ra kỹ năng.",
      "Cải tiến chỉ số khi đột phá: Tăng mạnh HP, MP, ATK, DEF, SPD dựa trên Cảnh Giới và Tầng.",
      "Thưởng thêm Điểm Tiềm Năng (Stat Points) và Điểm Kỹ Năng (Skill Points) khi đột phá đại cảnh giới."
    ]
  },
  {
    version: "v1.2.0",
    date: "01/04/2026",
    title: "Hệ Thống Luyện Khí & Cường Hóa",
    changes: [
      "Thêm tính năng Luyện Khí Đường cho phép nâng cấp trang bị.",
      "Cường hóa tiêu tốn Linh Thạch, tăng mạnh chỉ số ATK, DEF, HP, MP, SPD.",
      "Hỗ trợ cường hóa trực tiếp trang bị đang mặc hoặc trong hành trang."
    ]
  },
  {
    version: "v1.1.0",
    date: "01/04/2026",
    title: "Vạn Bảo Các & Hệ Thống Rớt Đồ",
    changes: [
      "Khai mở Vạn Bảo Các (Cửa Hàng) mua bán vật phẩm bằng Linh Thạch.",
      "Thêm tính năng sử dụng vật phẩm tiêu hao (Đan dược) trực tiếp từ túi đồ.",
      "Cập nhật Thiên Đạo: Đánh bại yêu thú và Boss nay đã có tỷ lệ rớt trang bị và vật phẩm.",
      "Thêm chỉ số Tốc Độ (SPD) cho hệ thống chiến đấu và trang bị."
    ]
  },
  {
    version: "v1.0.0",
    date: "31/03/2026",
    title: "Khai Mở Tiên Hiệp Giới",
    changes: [
      "Ra mắt hệ thống tạo nhân vật với các Tộc, Hệ, và Cảnh Giới cơ bản.",
      "Hệ thống Lịch Luyện tương tác trực tiếp với AI (Thiên Đạo).",
      "Hệ thống Căn Cơ, Hành Trang, và Trang Bị cơ bản.",
      "Bản đồ Lục Giới và hệ thống Truyền Tin."
    ]
  }
];
