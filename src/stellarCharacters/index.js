import {
  getCombatEffects as beidouCombatEffects,
} from "./beidou.js";
import {
  getCombatEffects as cynoCombatEffects,
} from "./cyno.js";
import {
  getCombatEffects as dionaCombatEffects,
  getTriggeredBuffs as dionaTriggeredBuffs,
} from "./diona.js";
import {
  getCombatEffects as odetteCombatEffects,
  getTriggeredBuffs as odetteTriggeredBuffs,
} from "./odette.js";
import {
  getCombatEffects as qiqiCombatEffects,
  getTriggeredBuffs as qiqiTriggeredBuffs,
} from "./qiqi.js";
import {
  getCombatEffects as sandroneCombatEffects,
} from "./sandrone.js";
import {
  getCombatEffects as yaeMikoCombatEffects,
  getTriggeredBuffs as yaeMikoTriggeredBuffs,
} from "./yaeMiko.js";
import { STELLAR_SYSTEM } from "./stellarSystem.js";

export { STELLAR_SYSTEM };

export const STELLAR_CHARACTER_RULES = {
  "Beidou": { getCombatEffects: beidouCombatEffects },
  "Cyno": { getCombatEffects: cynoCombatEffects },
  "Diona": {
    getCombatEffects: dionaCombatEffects,
    getTriggeredBuffs: dionaTriggeredBuffs,
  },
  "Odette": {
    getCombatEffects: odetteCombatEffects,
    getTriggeredBuffs: odetteTriggeredBuffs,
  },
  "Qiqi": {
    getCombatEffects: qiqiCombatEffects,
    getTriggeredBuffs: qiqiTriggeredBuffs,
  },
  "Sandrone": { getCombatEffects: sandroneCombatEffects },
  "Yae Miko": {
    getCombatEffects: yaeMikoCombatEffects,
    getTriggeredBuffs: yaeMikoTriggeredBuffs,
  },
};

export function getStellarCharacter(name) {
  return STELLAR_CHARACTER_RULES[name] || null;
}

export function getStellarCombatEffects(name, context) {
  return getStellarCharacter(name)?.getCombatEffects?.(context) || {};
}

export function getStellarTriggeredBuffs(name, context) {
  return getStellarCharacter(name)?.getTriggeredBuffs?.(context) || [];
}
