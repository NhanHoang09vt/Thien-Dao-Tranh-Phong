import Phaser from "phaser";
import { Character, Equipment } from "../../types";

export default class CombatScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private enemy!: Phaser.GameObjects.Container;
  private playerHPBar!: Phaser.GameObjects.Graphics;
  private enemyHPBar!: Phaser.GameObjects.Graphics;
  private playerManaBar!: Phaser.GameObjects.Graphics;
  private combatLog!: Phaser.GameObjects.Text;
  
  private characterData!: Character;
  private enemyData: any = {
    name: "Huyễn",
    hp: 1000,
    hpMax: 1000,
    atk: 50,
    def: 20,
    skills: ["Ma Ảnh Trảm", "Huyễn Ảnh Bộ"]
  };

  private combatLoopTimer?: Phaser.Time.TimerEvent;

  private playerEquipment: Record<string, Phaser.GameObjects.GameObject> = {};
  private enemyEquipment: Record<string, Phaser.GameObjects.GameObject> = {};

  constructor() {
    super("CombatScene");
  }

  init(data: { character: Character }) {
    this.characterData = data.character;
  }

  preload() {
    // Assets structure (using remote URLs for preview compatibility)
    // In a real project, these would be in the /assets folder
    this.load.image("bg", "https://picsum.photos/seed/cultivation_bg/800/600?blur=5");
    this.load.image("player_base", "https://api.dicebear.com/7.x/pixel-art/svg?seed=Huyen&backgroundColor=b6e3f4");
    this.load.image("enemy_base", "https://api.dicebear.com/7.x/pixel-art/svg?seed=HuyenEnemy&backgroundColor=ffdfbf");
    
    // Skill effects
    this.load.image("slash", "https://api.dicebear.com/7.x/shapes/svg?seed=slash&fillColor=ffffff");
    this.load.image("fire", "https://api.dicebear.com/7.x/shapes/svg?seed=fire&fillColor=ff4400");
    this.load.image("ice", "https://api.dicebear.com/7.x/shapes/svg?seed=ice&fillColor=00ccff");
    this.load.image("heal", "https://api.dicebear.com/7.x/shapes/svg?seed=heal&fillColor=00ff44");
    
    // Equipment icons (mockup)
    this.load.image("weapon_icon", "https://api.dicebear.com/7.x/shapes/svg?seed=weapon&fillColor=cccccc");
    this.load.image("armor_icon", "https://api.dicebear.com/7.x/shapes/svg?seed=armor&fillColor=888888");
  }

  create() {
    // Background
    this.add.image(400, 300, "bg").setDisplaySize(800, 600);

    // Create Player (Huyền)
    this.player = this.createCharacter(200, 400, "player_base", "Huyền", true);
    
    // Create Enemy (Huyễn)
    this.enemy = this.createCharacter(600, 400, "enemy_base", "Huyễn", false);

    // HP & Mana Bars
    this.playerHPBar = this.add.graphics();
    this.enemyHPBar = this.add.graphics();
    this.playerManaBar = this.add.graphics();

    // Combat Log Text
    this.combatLog = this.add.text(400, 100, "Bắt đầu giao tranh!", {
      fontSize: "22px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
      fontFamily: "Arial Black",
      align: "center"
    }).setOrigin(0.5);

    this.updateBars();

    // Combat Loop every 2 seconds (PVE Loop)
    this.combatLoopTimer = this.time.addEvent({
      delay: 2000,
      callback: this.combatStep,
      callbackScope: this,
      loop: true
    });

    // Initial equipment display
    this.refreshEquipmentDisplay();
  }

  /**
   * Creates a character container with base sprite and name
   */
  private createCharacter(x: number, y: number, key: string, name: string, isPlayer: boolean) {
    const container = this.add.container(x, y);
    
    const sprite = this.add.sprite(0, 0, key).setDisplaySize(140, 140);
    const nameText = this.add.text(0, -90, name, {
      fontSize: "20px",
      color: isPlayer ? "#00ccff" : "#ff4400",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    container.add([sprite, nameText]);
    return container;
  }

  /**
   * Refreshes the visual equipment overlays on characters
   */
  private refreshEquipmentDisplay() {
    // Clear existing overlays
    Object.values(this.playerEquipment).forEach(obj => obj.destroy());
    Object.values(this.enemyEquipment).forEach(obj => obj.destroy());
    this.playerEquipment = {};
    this.enemyEquipment = {};

    // Player Equipment (Huyền)
    if (this.characterData.equipment.Weapon) {
      const weapon = this.add.rectangle(50, 0, 12, 70, 0x00ccff).setOrigin(0.5).setRotation(0.2);
      this.player.add(weapon);
      this.playerEquipment.Weapon = weapon;
    }
    if (this.characterData.equipment.Armor) {
      const armor = this.add.rectangle(0, 0, 80, 100, 0x00ccff, 0.2).setOrigin(0.5);
      this.player.add(armor);
      this.playerEquipment.Armor = armor;
    }
    if (this.characterData.equipment.Head) {
      const hat = this.add.rectangle(0, -70, 50, 15, 0x00ccff).setOrigin(0.5);
      this.player.add(hat);
      this.playerEquipment.Head = hat;
    }
    if (this.characterData.equipment.Legs) {
      const shoes = this.add.rectangle(0, 70, 80, 10, 0x00ccff).setOrigin(0.5);
      this.player.add(shoes);
      this.playerEquipment.Legs = shoes;
    }

    // Enemy Equipment (Huyễn - Simple)
    const enemyWeapon = this.add.rectangle(-50, 0, 10, 60, 0xff4400).setOrigin(0.5).setRotation(-0.2);
    this.enemy.add(enemyWeapon);
    this.enemyEquipment.Weapon = enemyWeapon;
  }

  /**
   * Updates HP and Mana bars on screen
   */
  private updateBars() {
    const barWidth = 220;
    
    // Player HP
    this.playerHPBar.clear();
    this.playerHPBar.fillStyle(0x222222);
    this.playerHPBar.fillRoundedRect(80, 500, barWidth, 24, 6);
    this.playerHPBar.fillStyle(0x00ff00);
    const playerHPPercent = Math.max(0, this.characterData.hp / this.characterData.hpMax);
    this.playerHPBar.fillRoundedRect(80, 500, barWidth * playerHPPercent, 24, 6);

    // Player Mana
    this.playerManaBar.clear();
    this.playerManaBar.fillStyle(0x222222);
    this.playerManaBar.fillRoundedRect(80, 530, barWidth, 12, 4);
    this.playerManaBar.fillStyle(0x00aaff);
    const playerMPPercent = Math.max(0, this.characterData.mp / this.characterData.mpMax);
    this.playerManaBar.fillRoundedRect(80, 530, barWidth * playerMPPercent, 12, 4);

    // Enemy HP
    this.enemyHPBar.clear();
    this.enemyHPBar.fillStyle(0x222222);
    this.enemyHPBar.fillRoundedRect(500, 500, barWidth, 24, 6);
    this.enemyHPBar.fillStyle(0xff0000);
    const enemyHPPercent = Math.max(0, this.enemyData.hp / this.enemyData.hpMax);
    this.enemyHPBar.fillRoundedRect(500, 500, barWidth * enemyHPPercent, 24, 6);
  }

  /**
   * Main combat step logic (PVE Loop)
   */
  private combatStep() {
    if (this.characterData.hp <= 0 || this.enemyData.hp <= 0) {
      this.combatLoopTimer?.remove();
      return;
    }

    // Determine skill to use
    const skills = ["slash", "fire", "ice"];
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];

    // Player attacks Enemy
    this.executeSkill(this.player, this.enemy, randomSkill, true);

    // Delay enemy counter (Huyễn phản đòn)
    this.time.delayedCall(1000, () => {
      if (this.enemyData.hp > 0 && this.characterData.hp > 0) {
        this.executeSkill(this.enemy, this.player, "slash", false);
      }
    });
  }

  /**
   * Executes a skill with animation and damage calculation
   */
  private executeSkill(attacker: Phaser.GameObjects.Container, target: Phaser.GameObjects.Container, type: string, isPlayer: boolean) {
    // Attack Animation (Move towards target)
    this.tweens.add({
      targets: attacker,
      x: isPlayer ? attacker.x + 80 : attacker.x - 80,
      duration: 150,
      yoyo: true,
      ease: "Power2",
      onComplete: () => {
        // Show skill effect
        this.showEffect(target.x, target.y, type);
        // Calculate and apply damage
        this.calculateDamage(isPlayer, type);
        // Screen shake on hit
        this.cameras.main.shake(100, 0.005);
      }
    });
  }

  /**
   * Displays skill visual effects
   */
  private showEffect(x: number, y: number, type: string) {
    const effect = this.add.sprite(x, y, type).setScale(0.5).setAlpha(0);
    
    // Animation based on type
    if (type === "fire") {
      effect.setTint(0xff4400);
    } else if (type === "ice") {
      effect.setTint(0x00ccff);
    } else if (type === "heal") {
      effect.setTint(0x00ff44);
    }

    this.tweens.add({
      targets: effect,
      scale: 2,
      alpha: 1,
      angle: 360,
      duration: 300,
      yoyo: true,
      onComplete: () => effect.destroy()
    });
  }

  /**
   * Calculates damage based on stats and skill effects
   */
  private calculateDamage(isPlayer: boolean, skillType: string) {
    if (isPlayer) {
      // Player damage logic
      let damage = Math.max(15, (this.characterData.atk * 1.2) - this.enemyData.def);
      
      // Skill multipliers
      if (skillType === "fire") damage *= 1.3;
      if (skillType === "ice") damage *= 1.1;
      if (skillType === "slash") damage *= 1.2;

      this.enemyData.hp = Math.max(0, this.enemyData.hp - damage);
      this.combatLog.setText(`Huyền dùng ${skillType.toUpperCase()} gây ${Math.floor(damage)} sát thương!`);
      
      // Damage text animation
      this.showDamageText(this.enemy.x, this.enemy.y - 50, `-${Math.floor(damage)}`, "#ff0000");

      if (this.enemyData.hp <= 0) {
        this.combatLog.setText("Huyễn bị hạ!");
        this.enemy.setAlpha(0.3);
        this.tweens.add({ targets: this.enemy, y: this.enemy.y + 20, duration: 500 });
      }
    } else {
      // Enemy damage logic
      let damage = Math.max(10, this.enemyData.atk - (this.characterData.def * 0.8));
      this.characterData.hp = Math.max(0, this.characterData.hp - damage);
      this.combatLog.setText(`Huyễn phản đòn gây ${Math.floor(damage)} sát thương!`);
      
      // Damage text animation
      this.showDamageText(this.player.x, this.player.y - 50, `-${Math.floor(damage)}`, "#ff4400");

      if (this.characterData.hp <= 0) {
        this.combatLog.setText("Huyền bị hạ!");
        this.player.setAlpha(0.3);
        this.tweens.add({ targets: this.player, y: this.player.y + 20, duration: 500 });
      }
    }
    this.updateBars();
  }

  /**
   * Shows floating damage text
   */
  private showDamageText(x: number, y: number, text: string, color: string) {
    const txt = this.add.text(x, y, text, {
      fontSize: "28px",
      color: color,
      fontStyle: "black",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy()
    });
  }

  /**
   * Public method to equip/unequip items in real-time
   */
  public equipItem(target: "player" | "enemy", item: Equipment | null, slot?: string) {
    console.log(`Equipping ${item?.name || "nothing"} to ${target}`);
    if (target === "player") {
      const targetSlot = item ? item.slot : slot;
      if (targetSlot) {
        this.characterData.equipment[targetSlot as keyof typeof this.characterData.equipment] = item as any;
        this.refreshEquipmentDisplay();
        this.showEffect(this.player.x, this.player.y, "heal");
      }
    }
  }
}
