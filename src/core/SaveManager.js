import {
  CAR_CATALOG,
  DEFAULT_CAR_UPGRADES,
  WHEEL_STYLES,
  SPOILER_STYLES,
  SUSPENSION_STANCES,
  getCarById
} from '../vehicles/CarCatalog.js';

const STORAGE_KEY = 'usr3d_save_v1';
const BACKUP_STORAGE_KEY = 'usr3d_save_backup_v1';
const IDB_NAME = 'UltimateStreetRacing3D_DB';
const IDB_VERSION = 1;
const IDB_STORE = 'save_profiles';
const IDB_KEY = 'primary_profile';

const VALID_WHEEL_IDS = new Set(WHEEL_STYLES.map((w) => w.id));
const VALID_SPOILER_IDS = new Set(SPOILER_STYLES.map((s) => s.id));
const VALID_STANCE_IDS = new Set(SUSPENSION_STANCES.map((s) => s.id));
const VALID_CAR_IDS = new Set(CAR_CATALOG.map((c) => c.id));

function buildDefaultUpgradesMap() {
  const map = {};
  for (const car of CAR_CATALOG) {
    map[car.id] = { ...DEFAULT_CAR_UPGRADES };
  }
  return map;
}

function buildDefaultCustomizationsMap() {
  const map = {};
  for (const car of CAR_CATALOG) {
    map[car.id] = {
      wheelStyle: 'twin_five',
      spoilerStyle: car.dimensions?.spoilerType || 'sport',
      stance: 'stock'
    };
  }
  return map;
}

export const DEFAULT_SAVE = {
  schemaVersion: 2,
  updatedAt: 0,
  credits: 25000,
  selectedCarId: 'toyota_supra_mk5',
  unlockedCars: ['toyota_supra_mk5'],
  upgrades: buildDefaultUpgradesMap(),
  customColors: {},
  customizations: buildDefaultCustomizationsMap(),
  completedMissions: {},
  bestRecords: {
    circuit: null,
    city_race: null,
    timetrial: null,
    checkpoint: null,
    traffic: 0
  },
  settings: {
    timeOfDay: 'day',         // 'day' | 'sunset' | 'night'
    weather: 'clear',         // 'clear' | 'rain' | 'fog'
    trafficDensity: 'medium', // 'low' | 'medium' | 'high'
    aiDifficulty: 'medium',   // 'easy' | 'medium' | 'hard'
    policeEnabled: true,      // Optional Police Pursuit System toggle
    quality: 'high',          // 'medium' | 'high'
    soundVolume: 0.75,
    engineVolume: 0.85,
    sfxVolume: 0.85,
    ambientVolume: 0.70,
    audioMuted: false,
    cameraMode: 0             // 0: Chase, 1: Far Chase, 2: Hood, 3: Cockpit
  }
};

export class SaveManager {
  constructor() {
    this.db = null;
    this.idbAvailable = false;
    this.lastCorruptionRecovered = false;
    this.corruptionReport = [];
    this.onSaveSynced = null;

    this.data = this.load();
    this.initIndexedDB();
  }

  /**
   * Initializes IndexedDB connection and syncs the latest valid save record
   */
  async initIndexedDB() {
    if (typeof indexedDB === 'undefined') {
      this.idbAvailable = false;
      return false;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
      });

      this.idbAvailable = true;
      const idbRecord = await this.loadFromIndexedDB();
      if (idbRecord) {
        const validated = this.validateAndSanitizeSave(idbRecord);
        if ((validated.updatedAt || 0) >= (this.data.updatedAt || 0)) {
          this.data = validated;
          this._writeLocalStorage(this.data);
          if (this.onSaveSynced) this.onSaveSynced(this.data);
        } else {
          await this.saveToIndexedDB(this.data);
        }
      } else {
        await this.saveToIndexedDB(this.data);
      }
      return true;
    } catch (e) {
      this.idbAvailable = false;
      return false;
    }
  }

  async loadFromIndexedDB() {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async saveToIndexedDB(savePayload = this.data) {
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(structuredClone(savePayload), IDB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async clearIndexedDB() {
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.delete(IDB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Validates and sanitizes a candidate save object, repairing any corrupted,
   * missing, out-of-bounds, or invalid fields without throwing errors.
   */
  validateAndSanitizeSave(candidate) {
    const clean = structuredClone(DEFAULT_SAVE);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Root save payload was non-object or null');
      return clean;
    }

    clean.updatedAt = Number.isFinite(candidate.updatedAt) && candidate.updatedAt >= 0
      ? candidate.updatedAt
      : Date.now();

    // 1. Validate Currency (credits)
    if (typeof candidate.credits === 'number' && Number.isFinite(candidate.credits) && candidate.credits >= 0) {
      clean.credits = Math.round(candidate.credits);
    } else if (candidate.credits !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push(`Invalid credits value repaired: ${candidate.credits}`);
    }

    // 2. Validate Purchased Cars (unlockedCars)
    if (Array.isArray(candidate.unlockedCars)) {
      const validUnlocked = new Set(['toyota_supra_mk5']);
      for (const rawId of candidate.unlockedCars) {
        if (typeof rawId === 'string') {
          const resolved = getCarById(rawId);
          if (resolved && VALID_CAR_IDS.has(resolved.id)) {
            validUnlocked.add(resolved.id);
          } else {
            this.lastCorruptionRecovered = true;
            this.corruptionReport.push(`Unknown car ID removed: ${rawId}`);
          }
        } else {
          this.lastCorruptionRecovered = true;
          this.corruptionReport.push('Non-string car ID in unlockedCars repaired');
        }
      }
      clean.unlockedCars = Array.from(validUnlocked);
    } else if (candidate.unlockedCars !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Corrupted unlockedCars array repaired');
    }

    // 3. Validate Selected Car (selectedCarId)
    if (typeof candidate.selectedCarId === 'string') {
      const resolved = getCarById(candidate.selectedCarId);
      if (resolved && clean.unlockedCars.includes(resolved.id)) {
        clean.selectedCarId = resolved.id;
      } else {
        this.lastCorruptionRecovered = true;
        this.corruptionReport.push(`Selected car '${candidate.selectedCarId}' not unlocked or invalid; reset to starter`);
        clean.selectedCarId = clean.unlockedCars[0];
      }
    } else if (candidate.selectedCarId !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Corrupted selectedCarId repaired');
    }

    // 4. Validate Vehicle Upgrades (upgrades across all 6 categories, clamped 0..5)
    if (candidate.upgrades && typeof candidate.upgrades === 'object' && !Array.isArray(candidate.upgrades)) {
      for (const [rawCarId, carUpg] of Object.entries(candidate.upgrades)) {
        const resolvedCar = getCarById(rawCarId);
        if (!resolvedCar || !carUpg || typeof carUpg !== 'object') continue;
        const targetUpg = clean.upgrades[resolvedCar.id];
        for (const statKey of Object.keys(DEFAULT_CAR_UPGRADES)) {
          const val = carUpg[statKey];
          if (typeof val === 'number' && Number.isFinite(val)) {
            if (val < 0 || val > 5 || !Number.isInteger(val)) {
              this.lastCorruptionRecovered = true;
              this.corruptionReport.push(`Out-of-bounds upgrade level ${statKey}=${val} clamped`);
            }
            targetUpg[statKey] = Math.max(0, Math.min(5, Math.round(val)));
          } else if (val !== undefined) {
            this.lastCorruptionRecovered = true;
            this.corruptionReport.push(`Non-numeric upgrade ${statKey} repaired`);
          }
        }
      }
    } else if (candidate.upgrades !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Corrupted upgrades map repaired');
    }

    // 5. Validate Customizations (customColors & wheel/spoiler/stance customizations)
    if (candidate.customColors && typeof candidate.customColors === 'object' && !Array.isArray(candidate.customColors)) {
      for (const [rawCarId, hex] of Object.entries(candidate.customColors)) {
        const resolvedCar = getCarById(rawCarId);
        if (resolvedCar && typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
          clean.customColors[resolvedCar.id] = hex;
        } else {
          this.lastCorruptionRecovered = true;
          this.corruptionReport.push(`Invalid paint color '${hex}' discarded`);
        }
      }
    }

    if (candidate.customizations && typeof candidate.customizations === 'object' && !Array.isArray(candidate.customizations)) {
      for (const [rawCarId, cust] of Object.entries(candidate.customizations)) {
        const resolvedCar = getCarById(rawCarId);
        if (!resolvedCar || !cust || typeof cust !== 'object') continue;
        const targetCust = clean.customizations[resolvedCar.id];
        if (VALID_WHEEL_IDS.has(cust.wheelStyle)) {
          targetCust.wheelStyle = cust.wheelStyle;
        } else if (cust.wheelStyle !== undefined) {
          this.lastCorruptionRecovered = true;
        }
        if (VALID_SPOILER_IDS.has(cust.spoilerStyle)) {
          targetCust.spoilerStyle = cust.spoilerStyle;
        } else if (cust.spoilerStyle !== undefined) {
          this.lastCorruptionRecovered = true;
        }
        if (VALID_STANCE_IDS.has(cust.stance)) {
          targetCust.stance = cust.stance;
        } else if (cust.stance !== undefined) {
          this.lastCorruptionRecovered = true;
        }
      }
    }

    // 6. Validate Mission Progress (completedMissions)
    if (candidate.completedMissions && typeof candidate.completedMissions === 'object' && !Array.isArray(candidate.completedMissions)) {
      for (const [msnId, rec] of Object.entries(candidate.completedMissions)) {
        if (rec && typeof rec === 'object' && Boolean(rec.completed)) {
          clean.completedMissions[msnId] = {
            completed: true,
            summaryText: typeof rec.summaryText === 'string' ? rec.summaryText : 'Completed',
            completedAt: Number.isFinite(rec.completedAt) ? rec.completedAt : Date.now()
          };
        }
      }
    } else if (candidate.completedMissions !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Corrupted completedMissions object repaired');
    }

    // 7. Validate Race Records (bestRecords)
    if (candidate.bestRecords && typeof candidate.bestRecords === 'object' && !Array.isArray(candidate.bestRecords)) {
      for (const timeMode of ['circuit', 'city_race', 'timetrial', 'checkpoint']) {
        const val = candidate.bestRecords[timeMode];
        if (val === null || val === undefined) {
          clean.bestRecords[timeMode] = null;
        } else if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          clean.bestRecords[timeMode] = val;
        } else {
          this.lastCorruptionRecovered = true;
          this.corruptionReport.push(`Invalid race time record for ${timeMode} repaired`);
        }
      }
      const trafficScore = candidate.bestRecords.traffic;
      if (typeof trafficScore === 'number' && Number.isFinite(trafficScore) && trafficScore >= 0) {
        clean.bestRecords.traffic = Math.round(trafficScore);
      } else if (trafficScore !== undefined) {
        this.lastCorruptionRecovered = true;
      }
    }

    // 8. Validate Settings
    if (candidate.settings && typeof candidate.settings === 'object' && !Array.isArray(candidate.settings)) {
      const s = candidate.settings;
      if (['day', 'sunset', 'night'].includes(s.timeOfDay)) clean.settings.timeOfDay = s.timeOfDay;
      if (['clear', 'rain', 'fog'].includes(s.weather)) clean.settings.weather = s.weather;
      if (['low', 'medium', 'high'].includes(s.trafficDensity)) clean.settings.trafficDensity = s.trafficDensity;
      if (['easy', 'medium', 'hard'].includes(s.aiDifficulty)) clean.settings.aiDifficulty = s.aiDifficulty;
      if (typeof s.policeEnabled === 'boolean') clean.settings.policeEnabled = s.policeEnabled;
      if (['medium', 'high'].includes(s.quality)) clean.settings.quality = s.quality;
      if (typeof s.audioMuted === 'boolean') clean.settings.audioMuted = s.audioMuted;

      for (const volKey of ['soundVolume', 'engineVolume', 'sfxVolume', 'ambientVolume']) {
        if (typeof s[volKey] === 'number' && Number.isFinite(s[volKey])) {
          clean.settings[volKey] = Math.max(0, Math.min(1, s[volKey]));
        }
      }
      if (typeof s.cameraMode === 'number' && Number.isInteger(s.cameraMode) && s.cameraMode >= 0 && s.cameraMode < 4) {
        clean.settings.cameraMode = s.cameraMode;
      }
    } else if (candidate.settings !== undefined) {
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push('Corrupted settings object repaired');
    }

    return clean;
  }

  /**
   * Loads save data from localStorage with automatic fallback to backup snapshot or defaults if corrupted
   */
  load() {
    this.lastCorruptionRecovered = false;
    this.corruptionReport = [];

    if (typeof localStorage === 'undefined') {
      return structuredClone(DEFAULT_SAVE);
    }

    const rawPrimary = localStorage.getItem(STORAGE_KEY);
    if (!rawPrimary) {
      return structuredClone(DEFAULT_SAVE);
    }

    try {
      const parsed = JSON.parse(rawPrimary);
      const sanitized = this.validateAndSanitizeSave(parsed);
      if (this.lastCorruptionRecovered) {
        this._writeLocalStorage(sanitized);
      }
      return sanitized;
    } catch (primaryErr) {
      // Primary save JSON was corrupted/unparseable! Attempt backup snapshot recovery
      this.lastCorruptionRecovered = true;
      this.corruptionReport.push(`Primary save JSON corrupted (${primaryErr.message})`);

      try {
        const rawBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
        if (rawBackup) {
          const parsedBackup = JSON.parse(rawBackup);
          this.corruptionReport.push('Restored from last-known-good backup snapshot');
          const restored = this.validateAndSanitizeSave(parsedBackup);
          this._writeLocalStorage(restored);
          return restored;
        }
      } catch (backupErr) {
        this.corruptionReport.push('Backup snapshot also corrupted; initialized clean factory save');
      }

      const fresh = structuredClone(DEFAULT_SAVE);
      this._writeLocalStorage(fresh);
      return fresh;
    }
  }

  _writeLocalStorage(payload) {
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(payload);
        localStorage.setItem(STORAGE_KEY, serialized);
        localStorage.setItem(BACKUP_STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn('Could not persist save data to localStorage:', e);
    }
  }

  /**
   * Saves all game state to both LocalStorage (with backup) and IndexedDB
   */
  save() {
    this.data.updatedAt = Date.now();
    this._writeLocalStorage(this.data);
    this.saveToIndexedDB(this.data);
  }

  getCredits() {
    return this.data.credits;
  }

  addCredits(amount) {
    if (!Number.isFinite(amount)) return this.data.credits;
    this.data.credits = Math.max(0, Math.round(this.data.credits + amount));
    this.save();
    return this.data.credits;
  }

  spendCredits(amount) {
    if (!Number.isFinite(amount) || amount < 0 || this.data.credits < amount) return false;
    this.data.credits -= Math.round(amount);
    this.save();
    return true;
  }

  isCarUnlocked(carId) {
    const resolved = getCarById(carId);
    return this.data.unlockedCars.includes(resolved.id) || this.data.unlockedCars.includes(carId);
  }

  unlockCar(carId) {
    const resolved = getCarById(carId);
    if (!this.data.unlockedCars.includes(resolved.id)) {
      this.data.unlockedCars.push(resolved.id);
      this.save();
    }
  }

  purchaseCar(carId, price) {
    const resolved = getCarById(carId);
    if (this.isCarUnlocked(resolved.id)) return false;
    if (!this.spendCredits(price)) return false;
    this.unlockCar(resolved.id);
    this.setSelectedCarId(resolved.id);
    return true;
  }

  getSelectedCarId() {
    return getCarById(this.data.selectedCarId).id;
  }

  setSelectedCarId(carId) {
    const resolved = getCarById(carId);
    if (this.isCarUnlocked(resolved.id)) {
      this.data.selectedCarId = resolved.id;
      this.save();
      return true;
    }
    return false;
  }

  getCarUpgrades(carId) {
    const resolved = getCarById(carId);
    if (!this.data.upgrades[resolved.id]) {
      this.data.upgrades[resolved.id] = { ...DEFAULT_CAR_UPGRADES };
    } else {
      this.data.upgrades[resolved.id] = {
        ...DEFAULT_CAR_UPGRADES,
        ...this.data.upgrades[resolved.id]
      };
    }
    return this.data.upgrades[resolved.id];
  }

  upgradeCarStat(carId, statName, cost, maxLevel = 5) {
    const resolved = getCarById(carId);
    const upg = this.getCarUpgrades(resolved.id);
    if (upg[statName] === undefined) upg[statName] = 0;
    if (upg[statName] >= maxLevel) return false;
    if (!this.spendCredits(cost)) return false;
    upg[statName] += 1;
    this.save();
    return true;
  }

  getCarColor(carId, defaultHex) {
    const resolved = getCarById(carId);
    return this.data.customColors[resolved.id] ?? defaultHex;
  }

  setCarColor(carId, hexColor) {
    const resolved = getCarById(carId);
    if (typeof hexColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(hexColor)) {
      this.data.customColors[resolved.id] = hexColor;
      this.save();
    }
  }

  getCarCustomization(carId, carDef = null) {
    const resolved = carDef || getCarById(carId);
    if (!this.data.customizations) this.data.customizations = {};
    if (!this.data.customizations[resolved.id]) {
      this.data.customizations[resolved.id] = {
        wheelStyle: 'twin_five',
        spoilerStyle: resolved?.dimensions?.spoilerType || 'sport',
        stance: 'stock'
      };
    }
    return this.data.customizations[resolved.id];
  }

  setCarCustomization(carId, key, value, carDef = null) {
    const resolved = carDef || getCarById(carId);
    const cust = this.getCarCustomization(resolved.id, resolved);
    cust[key] = value;
    this.save();
    return cust;
  }

  updateSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  }

  getSettings() {
    return this.data.settings;
  }

  recordBestTime(mode, timeSeconds) {
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return false;
    const current = this.data.bestRecords[mode];
    if (current === null || current === undefined || timeSeconds < current) {
      this.data.bestRecords[mode] = timeSeconds;
      this.save();
      return true;
    }
    return false;
  }

  recordBestScore(mode, score) {
    if (!Number.isFinite(score) || score < 0) return false;
    const current = this.data.bestRecords[mode] || 0;
    if (score > current) {
      this.data.bestRecords[mode] = Math.round(score);
      this.save();
      return true;
    }
    return false;
  }

  isMissionCompleted(missionId) {
    return Boolean(this.data.completedMissions && this.data.completedMissions[missionId]?.completed);
  }

  getMissionRecord(missionId) {
    return (this.data.completedMissions && this.data.completedMissions[missionId]) || null;
  }

  markMissionCompleted(missionId, summaryText = 'Completed') {
    if (!this.data.completedMissions) {
      this.data.completedMissions = {};
    }
    const firstTime = !this.isMissionCompleted(missionId);
    this.data.completedMissions[missionId] = {
      completed: true,
      summaryText,
      completedAt: Date.now()
    };
    this.save();
    return firstTime;
  }

  getCompletedMissionsCount() {
    if (!this.data.completedMissions) return 0;
    return Object.values(this.data.completedMissions).filter((m) => m && m.completed).length;
  }

  /**
   * Resets all saved progress across memory, localStorage, backup storage, and IndexedDB
   */
  async resetSave() {
    this.data = structuredClone(DEFAULT_SAVE);
    this.data.updatedAt = Date.now();
    this.lastCorruptionRecovered = false;
    this.corruptionReport = [];

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(BACKUP_STORAGE_KEY);
    }
    this._writeLocalStorage(this.data);
    await this.clearIndexedDB();
    await this.saveToIndexedDB(this.data);
    return this.data;
  }
}
