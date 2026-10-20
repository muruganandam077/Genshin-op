import { useMemo, useState } from "react";
import {
  calculateBuildStats,
  makeTeamPresetId,
  optimizeTeam,
  readTeamPresets,
} from "./teamOptimizer.js";
import {
  getGoldenTroupeDamageBonus,
  getSelfEffects,
} from "./dpsSelfBuffs.js";
import {
  calculateActionDamage,
  isArlecchinoNormalAttack,
  getTalentMultiplier,
} from "./dpsDamage.js";
import * as bennettRules from "./dpsDamage/characters/bennett.js";
import * as chevreuseRules from "./dpsDamage/characters/chevreuse.js";
import * as fischlRules from "./dpsDamage/characters/fischl.js";
import * as raidenRules from "./dpsDamage/characters/raiden.js";
import {
  readRotationPresets,
  saveRotationPresets,
} from "./dpsRotationPresets.js";
import {
  getOffFieldSummon,
  getTalentAttributeAction,
} from "./dpsOffField.js";
import {
  getActionFrameData,
  getFullNormalStringFrames,
} from "./dpsActionFrames.js";
import {
  getArlecchinoC2Application,
  getElementalApplicationGroupKey,
  getElementalApplicationRule,
  resolveElementalReaction,
  trackElementalApplication,
} from "./dpsElementalApplication.js";
import {
  createWeaponBuffState,
  getWeaponHitEffects,
  recordWeaponHealing,
  recordWeaponHit,
} from "./dpsWeaponBuffs.js";
import {
  activateHeartOfFurnaceStellarReaction,
  activateNoblesseBurst,
  activateTenacitySkill,
  activateThrillingTales,
  getActiveSupportBuffs,
  storeBuff,
} from "./dpsSupportBuffs.js";
import {
  getStellarCombatEffects,
  getStellarTriggeredBuffs,
} from "./stellarCharacters/index.js";

const EMPTY_ACTION = {
  memberIndex: 0,
  actionType: "",
  normalHitMode: "automatic",
  talentKey: "",
  attributeIndex: "",
  scaling: "atk",
  hits: 1,
  frames: "",
  frameMode: "manual",
  chargedAttackContext: "auto",
  reaction: "none",
};
const CHARACTER_SWAP_FRAMES = 30;
const REACTIONS = [
  ["none", "No reaction"],
  ["overload", "Overloaded"],
  ["forwardMelt", "Forward Melt (2×)"],
  ["reverseMelt", "Reverse Melt (1.5×)"],
  ["forwardVaporize", "Forward Vaporize (2×)"],
  ["reverseVaporize", "Reverse Vaporize (1.5×)"],
  ["electroCharged", "Electro-Charged"],
  ["superconduct", "Superconduct"],
  ["swirl", "Swirl"],
  ["hyperbloom", "Hyperbloom"],
  ["burgeon", "Burgeon"],
  ["aggravate", "Aggravate"],
  ["spread", "Spread"],
  ["stellarConduct", "Stellar-Conduct"],
];
function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function saveCurrentRotation() {
  const name = rotationName.trim();
  if (!name) {
    setRotationPresetError("Enter a name for this rotation.");
    setRotationPresetNotice("");
    return;
  }
  if (!presetId || actions.length === 0) {
    setRotationPresetError("Select a team and add actions before saving a rotation.");
    setRotationPresetNotice("");
    return;
  }
  const next = [...rotationPresets, {
    id: makeTeamPresetId(),
    name,
    teamPresetId: presetId,
    actions: actions.map((action) => ({ ...action })),
  }];
  try {
    saveRotationPresets(next);
    setRotationPresets(next);
    setRotationPresetError("");
    setRotationPresetNotice(`Saved "${name}" for ${selectedPreset.name}.`);
    setRotationName("");
  } catch (saveError) {
    setRotationPresetError(`Could not save rotation presets: ${
      saveError instanceof Error ? saveError.message : "browser storage is unavailable."
    }`);
    setRotationPresetNotice("");
  }
}

function loadRotation(rotation) {
  if (rotation.teamPresetId !== presetId) {
    setRotationPresetError("This rotation belongs to a different team.");
    setRotationPresetNotice("");
    return;
  }
  setActions(rotation.actions.map((action) => ({ ...action })));
  setRotationPresetError("");
  setRotationPresetNotice(`Loaded "${rotation.name}".`);
}

function deleteRotation(rotation) {
  const next = rotationPresets.filter((entry) => entry.id !== rotation.id);
  try {
    saveRotationPresets(next);
    setRotationPresets(next);
    setRotationPresetError("");
    setRotationPresetNotice(`Deleted "${rotation.name}".`);
  } catch (saveError) {
    setRotationPresetError(`Could not delete rotation preset: ${
      saveError instanceof Error ? saveError.message : "browser storage is unavailable."
    }`);
    setRotationPresetNotice("");
  }
}

function getTalentActions(character, includeAutomaticSummonDamage = false) {
  const actions = (character.combatTalents || []).flatMap((talent, talentIndex) =>
    (talent.attributes?.labels || []).flatMap((entry, attributeIndex) => {
      const [name, expression = ""] = entry.split("|");
      const parameterKeys = [...expression.matchAll(/\{param(\d+):[^}]+\}/g)]
        .map((match) => Number(match[1]));
      if (!/DMG|damage|DoT/i.test(name) ||
          /\b(?:DMG|Damage)\s*(?:Bonus|Absorption)\b/i.test(name) ||
          !parameterKeys.length) return [];
      return [{
        key: `${talentIndex}:${attributeIndex}`,
        talentIndex,
        attributeIndex,
        talentName: talent.name,
        name: bennettRules.getTalentActionName(talent.name, name),
      }];
    }));
  if (includeAutomaticSummonDamage) return actions;

  const hiddenSummonDamage = (action) =>
    (character.name === "Yae Miko" &&
      action.talentName === "Yakan Evocation: Sesshou Sakura" &&
      /^Sesshou Sakura DMG: Level \d+$/i.test(action.name)) ||
    (character.name === "Qiqi" &&
      action.talentName === "Adeptus Art: Herald of Frost" &&
      action.name === "Herald of Frost DMG") ||
    (character.name === "Odette" &&
      action.talentName === "Adagio: Phantom Night Dancers" &&
      /^(?:Coda at Dawn's Tolling DoT|Coda at Dawn's Tolling Stellar-Conduct\/Stellar Swirl DMG|"Plume" Dance Move DMG|"Plume" Dance Move Stellar-Conduct\/Stellar Swirl DMG|"Wing" Dance Move DMG|"Wing" Dance Move Stellar-Conduct\/Stellar Swirl DMG)$/
        .test(action.name));
  const visibleActions = actions.filter((action) => !hiddenSummonDamage(action));

  if (character.name === "Yae Miko" || character.name === "Odette") {
    const skillIndex = (character.combatTalents || []).findIndex(
      (talent) => character.name === "Yae Miko"
        ? talent.name === "Yakan Evocation: Sesshou Sakura"
        : talent.name === "Adagio: Phantom Night Dancers",
    );
    const summonAction = actions.find((action) => action.talentIndex === skillIndex &&
      (character.name === "Yae Miko"
        ? action.name === "Sesshou Sakura DMG: Level 1"
        : action.name === "Skill DMG"));
    if (summonAction) {
      visibleActions.push({
        ...summonAction,
        key: character.name === "Yae Miko"
          ? "summon:sesshou-sakura"
          : "summon:odette-coda",
        name: character.name === "Yae Miko"
          ? "Summon Sesshou Sakura"
          : "Adagio: Coda at Dawn's Tolling (E)",
        isSummonSetup: character.name === "Yae Miko",
        isCodaSetup: character.name === "Odette",
      });
    }
  }

  return visibleActions;
}

function getRotationActionGroups(character) {
  const actions = getTalentActions(character);
  const groups = new Map();
  const isNormalAttackHit = (name) => /^\d+-Hit DMG$/i.test(name);
  const isChargedAttackHit = (name) =>
    /charged|aimed shot|frostflake arrow|breakthrough barb|riptide (?:flash|burst)|wreath arrow|clusterbloom arrow|prop arrow|shadowpiercing shot|windsunder arrow|arataki kesagiri|saichimonji slash/i
      .test(name);
  const addToGroup = (key, label, action) => {
    if (!groups.has(key)) groups.set(key, { key, label, actions: [] });
    groups.get(key).actions.push(action);
  };

  actions.forEach((action) => {
    const slot = getTalentSlot(character, action);
    const raidenAttackType = raidenRules.getNormalAttackType(character, action);
    if (raidenAttackType) {
      addToGroup(
        raidenAttackType,
        raidenAttackType === "normal"
          ? "Normal Attack"
          : raidenAttackType === "charged"
            ? "Charged Attack"
            : "Plunging Attack",
        action,
      );
      return;
    }
    if (slot === "combat1") {
      if (isNormalAttackHit(action.name)) {
        addToGroup("normal", "Normal Attack", action);
      } else if (isChargedAttackHit(action.name)) {
        addToGroup("charged", "Charged Attack", action);
      } else if (/plunge/i.test(action.name)) {
        addToGroup("plunge", "Plunging Attack", action);
      } else {
        addToGroup("normal", "Normal Attack", action);
      }
      return;
    }
    if (slot === "combat2") {
      if (isNormalAttackHit(action.name)) {
        addToGroup("normal", "Normal Attack", action);
        return;
      }
      if (isChargedAttackHit(action.name)) {
        addToGroup("charged", "Charged Attack", action);
        return;
      }
      if (/plunge/i.test(action.name)) {
        addToGroup("plunge", "Plunging Attack", action);
        return;
      }
      const supportsHold = /\bhold\b/i.test(getTalentActionDescription(character, action));
      if (/hold|charge level|charged up/i.test(action.name)) {
        addToGroup("skillHold", "Elemental Skill (Hold E)", action);
      } else if (/press/i.test(action.name)) {
        addToGroup("skill", "Elemental Skill (E)", action);
      } else {
        addToGroup("skill", "Elemental Skill (E)", action);
        if (supportsHold) addToGroup("skillHold", "Elemental Skill (Hold E)", action);
      }
      return;
    }
    if (slot === "combat3") {
      addToGroup("burst", "Elemental Burst (Q)", action);
    }
  });

  return [...groups.values()];
}

function getRotationActionType(action, member) {
  if (action.actionType) return action.actionType;
  return getRotationActionGroups(member.character).find((group) =>
    group.actions.some((talent) => talent.key === action.talentKey),
  )?.key || "";
}

function getRotationTalentAction(action, member, actionIndex, actions, raidenBurstActive = false) {
  const actionGroups = getRotationActionGroups(member.character);
  const actionType = getRotationActionType(action, member);
  const group = actionGroups.find((entry) => entry.key === actionType);
  if (!group) return getTalentActionByKey(member.character, action.talentKey);
  if (raidenRules.isRaidenShogun(member.character) && raidenBurstActive &&
      ["normal", "charged", "plunge"].includes(actionType) &&
      action.normalHitMode !== "manual") {
    let sequenceIndex = 0;
    for (let index = actionIndex - 1; index >= 0; index -= 1) {
      const previousAction = actions[index];
      if (previousAction.memberIndex !== member.index ||
          getRotationActionType(previousAction, member) !== actionType) {
        break;
      }
      sequenceIndex += 1;
    }
    const inBurstAttack = raidenRules.getInBurstAttack(
      member.character,
      group,
      true,
      sequenceIndex,
    );
    if (inBurstAttack) return inBurstAttack;
  }
  if (actionType !== "normal" || action.normalHitMode === "manual") {
    return group.actions.find((talent) => talent.key === action.talentKey) ||
      group.actions[0];
  }

  const normalActions = group.actions.filter((talent) =>
    /^\d+-Hit DMG$/i.test(talent.name) &&
    (!raidenRules.isRaidenShogun(member.character) ||
      getTalentSlot(member.character, talent) === "combat1"),
  );
  if (!normalActions.length) return group.actions[0];

  let sequenceIndex = 0;
  for (let index = actionIndex - 1; index >= 0; index -= 1) {
    const previousAction = actions[index];
    const previousMember = previousAction.memberIndex === member.index;
    const previousActionType = previousMember
      ? getRotationActionType(previousAction, member)
      : "";
    if (!previousMember || previousActionType !== "normal") break;
    sequenceIndex += 1;
  }
  return normalActions[sequenceIndex % normalActions.length];
}

function isArlecchino(character) {
  return character.name === "Arlecchino";
}

function isArlecchinoChargedAttack(character, talentAction) {
  return isArlecchino(character) && /^Charged Attack DMG$/i.test(talentAction.name);
}

function isArlecchinoSkill(character, talentAction) {
  return isArlecchino(character) &&
    talentAction.talentName === "All Is Ash" &&
    /^(Spike DMG|Cleave DMG)$/i.test(talentAction.name);
}

function getTalentSlot(character, talentAction) {
  return character.combatTalents?.[talentAction.talentIndex]?.slot || "";
}

function isElementalSkill(character, talentAction) {
  return getTalentSlot(character, talentAction) === "combat2";
}

function isElementalBurst(character, talentAction) {
  return getTalentSlot(character, talentAction) === "combat3";
}

function getTalentActionDescription(character, talentAction) {
  const talent = character.combatTalents?.[talentAction.talentIndex];
  return `${talent?.description || ""} ${talent?.descriptionRaw || ""}`;
}

function actionHasHealing(character, talentAction) {
  return /(?:heal|restor|regenerat)[\s\S]{0,80}\bHP\b|\bHP\b[\s\S]{0,80}(?:heal|restor|regenerat)/i
    .test(getTalentActionDescription(character, talentAction));
}

function getTalentActionByKey(character, talentKey) {
  return getTalentActions(character).find((entry) => entry.key === talentKey);
}

function getAutomaticFrames(character, talentAction, chargedAttackContext = "neutral") {
  if (talentAction?.isSummonSetup || talentAction?.isCodaSetup) return 30;
  return talentAction
    ? getActionFrameData(character, talentAction, chargedAttackContext)?.frames || ""
    : "";
}

function resolveActionFrameContext(action, member, talentAction, previousAction, members) {
  if (action.chargedAttackContext !== "auto" ||
      member.character.name !== "Arlecchino" ||
      !/^Charged Attack DMG$/i.test(talentAction?.name || "")) {
    return action.chargedAttackContext || "neutral";
  }
  const previousMember = members.find(
    (entry) => entry.index === previousAction?.memberIndex,
  );
  const previousTalentAction = previousMember
    ? getTalentActionByKey(previousMember.character, previousAction.talentKey)
    : null;
  const previousActionCancelledFromNormal = previousMember?.index === member.index &&
    previousTalentAction?.talentName === "Invitation to a Beheading" &&
    /^\d+-Hit DMG$/i.test(previousTalentAction.name);
  const previousActionCancelledFromSkill = previousMember?.index === member.index &&
    previousTalentAction?.talentName === "All Is Ash" &&
    /^(Spike DMG|Cleave DMG)$/i.test(previousTalentAction.name);
  return previousActionCancelledFromNormal || previousActionCancelledFromSkill
    ? "cancel"
    : "neutral";
}

function hasArtifactSet(member, setName, pieces) {
  return member.build?.setGroups?.some((group) =>
    group.count >= pieces && group.setName === setName) || false;
}

function getDisenchantmentEffects(member, {
  isStellarConduct = false,
  enemyAffectedByStellarConduct = false,
} = {}) {
  if (!hasArtifactSet(member, "Disenchantment in Deep Shadow", 4)) {
    return { stellarDamageBonus: 0, stellarCritRateBonus: 0 };
  }
  return {
    stellarDamageBonus: isStellarConduct ? 40 : 0,
    stellarCritRateBonus: enemyAffectedByStellarConduct ? 16 : 0,
  };
}

export default function DpsCalculatorPage({
  characters = [],
  weapons = [],
  artifacts = [],
  inventory,
  loading,
  error,
  onBack,
}) {
  const initialPresets = useMemo(() => readTeamPresets(), []);
  const initialRotationPresets = useMemo(() => readRotationPresets(), []);
  const [presets, setPresets] = useState(initialPresets.presets);
  const [presetError, setPresetError] = useState(initialPresets.error);
  const [presetId, setPresetId] = useState(initialPresets.presets[0]?.id || "");
  const [rotationPresets, setRotationPresets] = useState(initialRotationPresets.presets);
  const [rotationPresetError, setRotationPresetError] = useState(initialRotationPresets.error);
  const [rotationPresetNotice, setRotationPresetNotice] = useState("");
  const [rotationName, setRotationName] = useState("");
  const [configuration, setConfiguration] = useState({});
  const [actions, setActions] = useState([]);
  const [enemyLevel, setEnemyLevel] = useState(90);
  const [enemyResistance, setEnemyResistance] = useState(10);
  const [enemyDefenseReduction, setEnemyDefenseReduction] = useState(0);
  const [enemyCount, setEnemyCount] = useState(1);

  const selectedPreset = presets.find((preset) => preset.id === presetId);
  const currentRotationPresets = rotationPresets.filter(
    (rotation) => rotation.teamPresetId === presetId,
  );
  const team = selectedPreset?.team || [];
  const optimization = useMemo(() => optimizeTeam(team, inventory, {
    characters,
    weapons,
    artifacts,
  }), [team, inventory, characters, weapons, artifacts]);
  const selectedTeamCharacters = team.flatMap((member) => {
    const character = characters.find((entry) =>
      String(entry.id) === String(member.characterId));
    return character ? [{ character }] : [];
  });
  const members = team.map((member, index) => {
    const character = characters.find((entry) => String(entry.id) === member.characterId);
    const weapon = optimization.weaponsByIndex.get(index);
    const build = optimization.builds.get(index);
    const stats = build
      ? calculateBuildStats(build, weapon, artifacts, selectedTeamCharacters)
      : null;
    const settings = {
      constellation: 0,
      refinement: 1,
      startingBondOfLife: 0,
      assumeAbove70PercentHp: true,
      weaponHpBelow50: false,
      weaponShielded: false,
      enemyAffectedByPyroHydro: false,
      ...configuration[index],
    };
    return { member, index, character, weapon, build, stats, settings };
  }).filter((entry) => entry.character);
  const hasPyroResonance = members.filter((entry) => entry.character.element === "Pyro").length >= 2;
  const hasCryoResonance = members.filter((entry) => entry.character.element === "Cryo").length >= 2;
  const hasChevreuseOverloadTeam = members.some(
    (entry) => entry.character.name === "Chevreuse",
  ) && chevreuseRules.isOverloadTeam(members);
  const hasStellarConductEnabler = members.some((entry) =>
    ["Sandrone", "Odette", "Aether", "Lumine"].includes(entry.character.name));
  const bondOfLifeByMember = new Map(
    members
      .filter((entry) => isArlecchino(entry.character))
      .map((entry) => [entry.index, Number(entry.settings.startingBondOfLife) || 0]),
  );
  const skillUseByMember = new Map();
  const debtBondGainedByMember = new Map();
  const bloodDebtMarkByMember = new Map();
  const lastCrimsonMoonProcByMember = new Map();
  const fragmentStacksByMember = new Map();
  const fragmentExpiryByMember = new Map();
  const lastThrillingTalesProcByMember = new Map();
  const lastTenacityProcByMember = new Map();
  const enemyResistanceShredExpiry = new Map();
  const stellarResistanceShredExpiry = new Map();
  const yaeTotemsExpiresAt = new Map();
  const polestarHitTimes = [];
  let polestarFieldExpiresAt = 0;
  const supportBuffsByTarget = new Map();
  const weaponBuffState = createWeaponBuffState();
  const chevreuseHealingSchedules = [];
  const activeOffFieldSummons = new Map();
  const offFieldResults = [];
  const pendingSupportEffectDescriptions = [];
  const talentLevelByMemberTalent = new Map();
  const raidenState = raidenRules.createState();
  const elementalApplicationByGroup = new Map();
  const enemyAuras = new Map();
  const summonInstanceSequence = new Map();
  let timelineSequence = 0;
  let chevreuseOverchargedBallReady = false;
  let previousActionMemberIndex = null;
  let elapsedSeconds = 0;
  const onFieldSinceByMember = new Map();
  const odetteMarvelousSplendorByMember = new Map();
  function getOdetteStackCountAtTime(state, time) {
    if (time >= state.expiresAt) return 0;
    if (state.constellation < 1 || state.offFieldAt === null) {
      return state.stackCount;
    }
    return Math.max(0, state.stackCount - (time - state.offFieldAt) * 2);
  }
  function getOdetteMarvelousSplendorBuffs(targetIndex, time) {
    return [...odetteMarvelousSplendorByMember.entries()].flatMap(
      ([odetteIndex, state]) => {
        if (time >= state.expiresAt) return [];
        const stacks = getOdetteStackCountAtTime(state, time);
        return stacks > 0
          ? [{
            source: "Odette C2 · Marvelous Splendor",
            stat: "atkPercent",
            value: 7 * stacks,
            expiresAt: state.expiresAt,
            stackGroup: `odette-marvelous-splendor:${odetteIndex}:${targetIndex}`,
          }]
          : [];
      },
    );
  }
  function getOdetteStellarBaseDamageBonus(time, attackOverride = null) {
    const odette = members.find((entry) => entry.character.name === "Odette");
    if (!odette?.stats) return 0;
    const attackBuffs = [
      ...getActiveSupportBuffs(supportBuffsByTarget, odette.index, time),
      ...getOdetteMarvelousSplendorBuffs(odette.index, time),
    ];
    const attackPercent = attackBuffs
      .filter((buff) => buff.stat === "atkPercent")
      .reduce((total, buff) => total + buff.value, 0);
    const flatAttack = attackBuffs
      .filter((buff) => buff.stat === "flat ATK")
      .reduce((total, buff) => total + buff.value, 0);
    const attack = attackOverride ?? (odette.stats.attack +
      (odette.stats.baseAttack || 0) * attackPercent / 100 + flatAttack);
    return Math.min(14, 0.7 * attack / 100);
  }
  function getPolestarStacks(time) {
    if (time >= polestarFieldExpiresAt) {
      polestarHitTimes.length = 0;
      return 0;
    }
    while (polestarHitTimes.length && time - polestarHitTimes[0] > 4) {
      polestarHitTimes.shift();
    }
    return Math.min(10, polestarHitTimes.length);
  }
  function recordPolestarHit(time) {
    getPolestarStacks(time);
    if (polestarHitTimes.length < 10) polestarHitTimes.push(time);
  }
  function activateStellarCharacterBuffs(member, trigger, time) {
    const buffs = getStellarTriggeredBuffs(member.character.name, {
      constellation: member.settings.constellation,
      trigger,
    });
    buffs.forEach((buff) => {
      members.forEach((target) => storeBuff(
        supportBuffsByTarget,
        target.index,
        {
          ...buff,
          expiresAt: time + buff.duration,
        },
      ));
    });
    return buffs.map((buff) =>
      `${buff.source}: party gains +${buff.value}${
        buff.stat === "elementalMastery" ? " EM" : `% ${buff.stat}`
      } for ${buff.duration}s`);
  }
  function getYaeMikoMasteryBonus(target, time, activeMemberIndex) {
    const yaeMiko = members.find((entry) =>
      entry.character.name === "Yae Miko");
    if (!yaeMiko || (yaeTotemsExpiresAt.get(yaeMiko.index) || 0) <= time) return 0;
    return getStellarCombatEffects("Yae Miko", {
      constellation: yaeMiko.settings.constellation,
      totemsActive: true,
      isSelf: target.index === yaeMiko.index,
      isActiveCharacter: target.index === activeMemberIndex,
    }).elementalMasteryBonus || 0;
  }
  function setBondOfLife(memberIndex, nextValue, eventTime) {
    const previousValue = bondOfLifeByMember.get(memberIndex) || 0;
    if (Math.abs(nextValue - previousValue) < 0.001) return;
    bondOfLifeByMember.set(memberIndex, nextValue);
    const member = members.find((entry) => entry.index === memberIndex);
    const hasFragmentFourPiece = member?.build?.setGroups?.some((group) =>
      group.setName === "Fragment of Harmonic Whimsy" && group.count >= 4);
    if (hasFragmentFourPiece) {
      const previousStacks = fragmentExpiryByMember.get(memberIndex) > eventTime
        ? fragmentStacksByMember.get(memberIndex) || 0
        : 0;
      const nextStacks = Math.min(3, previousStacks + 1);
      fragmentStacksByMember.set(memberIndex, nextStacks);
      fragmentExpiryByMember.set(memberIndex, eventTime + 6);
    }
  }
  function processOffFieldSummons(timeLimit) {
    for (const [summonKey, summon] of activeOffFieldSummons) {
      while (
        (summon.nextTickAt <= timeLimit &&
          summon.nextTickAt <= summon.expiresAt) ||
        (summon.finalDamageActionName &&
          !summon.finalDamageProcessed &&
          summon.expiresAt <= timeLimit)
      ) {
        const isFinalSummonTick = Boolean(
          summon.finalDamageActionName &&
          summon.nextTickAt >= summon.expiresAt,
        );
        const attackTime = isFinalSummonTick
          ? summon.expiresAt
          : summon.nextTickAt;
        let damageTalentAction = summon.damageTalentAction;
        if (summon.damageActionMode === "totemLevel") {
          const activeTotemCount = [...activeOffFieldSummons.values()].filter(
            (entry) => entry.member.index === summon.member.index &&
              entry.id === summon.id &&
              entry.expiresAt >= attackTime,
          ).length;
          const damageLevel = Math.min(
            summon.damageActionNames.length,
            activeTotemCount + (summon.member.settings.constellation >= 2 ? 1 : 0),
          );
          damageTalentAction = getTalentActions(
            summon.member.character,
            true,
          ).find((entry) =>
            entry.talentName === summon.damageTalentName &&
            entry.name === summon.damageActionNames[damageLevel - 1]) ||
            damageTalentAction;
          summon.damageTalentAction = damageTalentAction;
        } else if (summon.damageActionNames) {
          const damageActionName = summon.damageActionNames[
            summon.tickIndex % summon.damageActionNames.length
          ];
          damageTalentAction = getTalentActions(
            summon.member.character,
            true,
          ).find((entry) =>
            entry.talentName === summon.damageTalentName &&
            entry.name === damageActionName) || damageTalentAction;
        } else if (summon.finalDamageActionName &&
            summon.nextTickAt >= summon.expiresAt) {
          damageTalentAction = getTalentActions(
            summon.member.character,
            true,
          ).find((entry) =>
            entry.talentName === summon.damageTalentName &&
            entry.name === summon.finalDamageActionName) || damageTalentAction;
        }
        const isDirectStellarSummonHit = summon.finalDamageIsStellarConduct &&
          damageTalentAction.name === summon.finalDamageActionName;
        if (isDirectStellarSummonHit && hasStellarConductEnabler) {
          polestarFieldExpiresAt = attackTime + 6;
          ["cryo", "electro", "physical"].forEach((element) =>
            stellarResistanceShredExpiry.set(element, attackTime + 6));
        }
        const enemyAffectedByStellarConduct =
          (stellarResistanceShredExpiry.get("electro") || 0) > attackTime;
        const summonArtifactStellarEffects = getDisenchantmentEffects(
          summon.member,
          {
            isStellarConduct: isDirectStellarSummonHit &&
              hasStellarConductEnabler,
            enemyAffectedByStellarConduct,
          },
        );
        const summonElement = summon.member.character.element;
        const isPolestarDamage = polestarFieldExpiresAt > attackTime &&
          ["Cryo", "Electro"].includes(summonElement);
        if (isPolestarDamage) recordPolestarHit(attackTime);
        let polestarStacks = getPolestarStacks(attackTime);
        const activeSupportEffects = [
          ...getActiveSupportBuffs(
            supportBuffsByTarget,
            summon.member.index,
            attackTime,
          ),
          ...getOdetteMarvelousSplendorBuffs(summon.member.index, attackTime),
        ];
        const supportFlatAttack = activeSupportEffects
          .filter((buff) => buff.stat === "flat ATK")
          .reduce((total, buff) => total + buff.value, 0);
        const supportElementalMastery = activeSupportEffects
          .filter((buff) => buff.stat === "elementalMastery")
          .reduce((total, buff) => total + buff.value, 0);
        const supportAttackPercent = activeSupportEffects
          .filter((buff) => buff.stat === "atkPercent")
          .reduce((total, buff) => total + buff.value, 0);
        const supportDamageBonuses = {
          all: activeSupportEffects
            .filter((buff) => buff.stat === "allDamageBonus")
            .reduce((total, buff) => total + buff.value, 0),
          cryo: isPolestarDamage && summonElement === "Cryo"
            ? 28 + polestarStacks
            : 0,
          pyro: activeSupportEffects
            .filter((buff) => buff.stat === "pyroDamageBonus")
            .reduce((total, buff) => total + buff.value, 0),
          electro: activeSupportEffects
            .filter((buff) => buff.stat === "electroDamageBonus")
            .reduce((total, buff) => total + buff.value, 0) +
            (isPolestarDamage && summonElement === "Electro"
              ? 28 + polestarStacks
              : 0),
        };
        const resonanceAttack = hasPyroResonance
          ? (summon.member.stats.baseAttack || 0) * 0.25
          : 0;
        weaponBuffState.activeMemberIndex = summon.member.index;
        const weaponEffects = getWeaponHitEffects({
          member: summon.member,
          members,
          talentAction: damageTalentAction,
          action: { reaction: "none" },
          time: attackTime,
          bondOfLifePercent: 0,
          enemyCount,
          shielded: summon.member.settings.weaponShielded,
          enemyAffectedByPyroHydro: summon.member.settings.enemyAffectedByPyroHydro,
          state: weaponBuffState,
        });
        const effectiveStats = {
          ...summon.member.stats,
          attack: summon.member.stats.attack + resonanceAttack + supportFlatAttack +
            (summon.member.stats.baseAttack || 0) *
              (supportAttackPercent + weaponEffects.attackPercent) / 100 +
            weaponEffects.flatAttack,
          elementalMastery: summon.member.stats.elementalMastery +
            weaponEffects.elementalMastery + supportElementalMastery +
            getYaeMikoMasteryBonus(
              summon.member,
              attackTime,
              previousActionMemberIndex,
            ),
        };
        const summonConstellationEffects = members.map((ally) =>
          getStellarCombatEffects(ally.character.name, {
            constellation: ally.settings.constellation,
            inPolestarField: polestarFieldExpiresAt > attackTime,
            isSelf: ally.index === summon.member.index,
            talentAction: ally.index === summon.member.index
              ? damageTalentAction
              : null,
            attack: ally.index === summon.member.index
              ? effectiveStats.attack
              : ally.stats.attack,
          }));
        const summonEffects = summonConstellationEffects.find(
          (_, index) => members[index].index === summon.member.index,
        ) || {};
        const summonResistanceBonuses = summonConstellationEffects
          .reduce((bonuses, effects) => {
            Object.entries(effects.resistanceShredByElement || {}).forEach(
              ([element, value]) => {
                bonuses[element] = (bonuses[element] || 0) + value;
              },
            );
            return bonuses;
          }, {});
        const summonResistanceOverrides = summonConstellationEffects
          .reduce((overrides, effects) => ({
            ...overrides,
            ...effects.resistanceShredOverrides,
          }), {});
        const resistanceShredByElement = Object.fromEntries(
          ["cryo", "pyro", "electro", "physical"].map((element) => [
            element,
            Math.max(
              ((element === "pyro" || element === "electro") &&
                hasChevreuseOverloadTeam &&
                (enemyResistanceShredExpiry.get(element) || 0) > attackTime
                ? 40
                : 0) +
              ((stellarResistanceShredExpiry.get(element) || 0) > attackTime
                ? element === "physical" ? 40 : ["cryo", "electro"].includes(element) ? 15 : 0
                : 0) +
              (summonResistanceBonuses[element] || 0),
              summonResistanceOverrides[element] || 0,
            ),
          ]),
        );
        const summonCritDamageBonus = ["Cryo", "Electro"].includes(summonElement)
          ? summonConstellationEffects
            .reduce((total, effects) => total + (effects.critDamageBonus || 0), 0)
          : 0;
        const summonEnemyDamageTakenBonus = ["Physical", "Cryo", "Electro"]
          .includes(summonElement)
          ? activeSupportEffects
            .filter((buff) => buff.stat === "enemyDamageTakenBonus")
            .reduce((total, buff) => total + buff.value, 0)
          : 0;
        const offFieldBonusActive = previousActionMemberIndex !== summon.member.index ||
          attackTime >= (onFieldSinceByMember.get(summon.member.index) || 0) + 2;
        const goldenTroupeBonus = getGoldenTroupeDamageBonus(
          summon.member,
          damageTalentAction,
          offFieldBonusActive,
        );
        const odetteStellarBaseDamageBonus = getOdetteStellarBaseDamageBonus(
          attackTime,
          summon.member.character.name === "Odette"
            ? effectiveStats.attack
            : null,
        );
        let hit = calculateActionDamage(
          effectiveStats,
          {
            scaling: "atk",
            reaction: isDirectStellarSummonHit && hasStellarConductEnabler
              ? "stellarConduct"
              : "none",
          },
          summon.member.character,
          damageTalentAction,
          summon.talentLevel,
          Number(enemyLevel),
          Number(enemyResistance),
          {
            constellation: summon.member.settings.constellation,
            supportDamageBonuses,
            weaponDamageBonuses: weaponEffects.damageBonuses,
            polestarStacks,
            enemyDefenseReduction: Number(enemyDefenseReduction) +
              (summonEffects.enemyDefenseReduction || 0),
            critDamageBonus: summonCritDamageBonus,
            enemyDamageTakenBonus: summonEnemyDamageTakenBonus,
            selfDamageBonus: goldenTroupeBonus,
            stellarDamageBonus: activeSupportEffects
              .filter((buff) => [
                "stellarConductDamageBonus",
                "allDamageBonus",
              ].includes(buff.stat))
              .reduce((total, buff) => total + buff.value, 0) +
              (weaponEffects.damageBonuses.stellarConduct || 0) +
              (summonEffects.stellarDamageBonus || 0) +
              summonArtifactStellarEffects.stellarDamageBonus,
            stellarCritRateBonus:
              summonArtifactStellarEffects.stellarCritRateBonus,
            stellarCritDamageBonus: summonConstellationEffects
              .reduce((total, effects) =>
                total + (effects.stellarCritDamageBonus || 0), 0),
            burstDamageBonus: getTalentSlot(
              summon.member.character,
              damageTalentAction,
            ) === "combat3" && hasArtifactSet(summon.member, "Noblesse Oblige", 2)
              ? 20
              : 0,
            resistanceShredByElement,
            stellarBaseDamageBonus: odetteStellarBaseDamageBonus,
          },
        );
        const applicationRule = getElementalApplicationRule(
          summon.member.character,
          damageTalentAction,
          summon.member.settings.constellation,
        );
        const elementalApplication = trackElementalApplication(
          elementalApplicationByGroup,
          getElementalApplicationGroupKey(
            summon.member,
            damageTalentAction,
            applicationRule,
          ),
          applicationRule,
          attackTime,
        );
        const automaticReaction = resolveElementalReaction(
          enemyAuras,
          elementalApplication,
          attackTime,
        );
        const activatedSupportEffects = [];
        let reaction = isDirectStellarSummonHit && hasStellarConductEnabler
          ? "stellarConduct"
          : hasStellarConductEnabler &&
              automaticReaction === "superconduct" &&
              ["Cryo", "Electro"].includes(summonElement)
            ? "stellarConduct"
            : automaticReaction;
        if (reaction === "stellarConduct") {
          polestarFieldExpiresAt = attackTime + 6;
          if (!isPolestarDamage) recordPolestarHit(attackTime);
          polestarStacks = getPolestarStacks(attackTime);
          ["cryo", "electro", "physical"].forEach((element) =>
            stellarResistanceShredExpiry.set(element, attackTime + 6));
          if (!hit.stellarConduct && !isDirectStellarSummonHit) {
            const reactionArtifactStellarEffects = getDisenchantmentEffects(
              summon.member,
              {
                isStellarConduct: true,
                enemyAffectedByStellarConduct,
              },
            );
            hit = calculateActionDamage(
              effectiveStats,
              { scaling: "atk", reaction: "stellarConduct" },
              summon.member.character,
              damageTalentAction,
              summon.talentLevel,
              Number(enemyLevel),
              Number(enemyResistance),
              {
                constellation: summon.member.settings.constellation,
                supportDamageBonuses: {
                  ...supportDamageBonuses,
                  [summonElement.toLowerCase()]:
                    (supportDamageBonuses[summonElement.toLowerCase()] || 0) +
                    28 + polestarStacks,
                },
                weaponDamageBonuses: weaponEffects.damageBonuses,
                polestarStacks,
                enemyDefenseReduction: Number(enemyDefenseReduction) +
                  (summonEffects.enemyDefenseReduction || 0),
                critDamageBonus: summonCritDamageBonus,
                stellarCritDamageBonus: summonConstellationEffects
                  .reduce((total, effects) =>
                    total + (effects.stellarCritDamageBonus || 0), 0),
                stellarDamageBonus: activeSupportEffects
                  .filter((buff) => [
                    "stellarConductDamageBonus",
                    "allDamageBonus",
                  ].includes(buff.stat))
                  .reduce((total, buff) => total + buff.value, 0) +
                  (weaponEffects.damageBonuses.stellarConduct || 0) +
                  (summonEffects.stellarDamageBonus || 0) +
                  reactionArtifactStellarEffects.stellarDamageBonus,
                stellarCritRateBonus:
                  reactionArtifactStellarEffects.stellarCritRateBonus,
                enemyDamageTakenBonus: summonEnemyDamageTakenBonus,
                selfDamageBonus: goldenTroupeBonus,
                resistanceShredByElement,
                stellarBaseDamageBonus: odetteStellarBaseDamageBonus,
              },
            );
          }
          if (summon.member.character.name === "Yae Miko" ||
              summon.member.character.name === "Odette") {
            activatedSupportEffects.push(...activateStellarCharacterBuffs(
              summon.member,
              "stellarConduct",
              attackTime,
            ));
          }
          activatedSupportEffects.push(
            ...activateHeartOfFurnaceStellarReaction({
              member: summon.member,
              members,
              time: attackTime,
              buffsByTarget: supportBuffsByTarget,
            }),
          );
        }
        elementalApplication.reaction = reaction;
        if (chevreuseRules.applyOverloadEffects({
          reaction,
          damageElement: hit.damageElement,
          hasOverloadTeam: hasChevreuseOverloadTeam,
          time: attackTime,
          enemyResistanceShredExpiry,
        })) {
          chevreuseOverchargedBallReady = true;
        }
        if (isElementalSkill(summon.member.character, damageTalentAction) &&
            hasArtifactSet(summon.member, "Tenacity of the Millelith", 4)) {
          const lastProc = lastTenacityProcByMember.get(summon.member.index);
          if (lastProc === undefined || attackTime - lastProc >= 0.5) {
            activatedSupportEffects.push(...activateTenacitySkill({
              member: summon.member,
              members,
              time: attackTime,
              buffsByTarget: supportBuffsByTarget,
            }));
            lastTenacityProcByMember.set(summon.member.index, attackTime);
          }
        }
        offFieldResults.push({
          action: {
            memberIndex: summon.member.index,
            hits: 1,
            frames: 0,
            automatic: true,
          },
          member: summon.member,
          talentAction: damageTalentAction,
          total: hit.damage,
          duration: 0,
          multiplier: hit.multiplier,
          damageBonus: hit.damageBonus,
          damageElement: hit.damageElement,
          resistanceShred: hit.resistanceShred,
          effectiveEnemyResistance: hit.effectiveResistance,
          effectiveAttack: effectiveStats.attack,
          supportFlatAttack,
          supportAttackPercent,
          resonanceAttack,
          weaponAttackPercent: weaponEffects.attackPercent,
          weaponFlatAttack: weaponEffects.flatAttack,
          weaponElementalMastery: weaponEffects.elementalMastery,
          weaponDamageBonus: hit.weaponDamageBonus,
          weaponEffects: weaponEffects.entries,
          activeSupportEffects,
          activatedSupportEffects,
          actionStartTime: attackTime,
          selfEffects: [],
          bondEvents: [],
          enemyEvents: [],
          fragmentStacks: 0,
          automaticSummon: summon.name,
          elementalApplicationEvents: [{
            hitNumber: 1,
            time: attackTime,
            source: summon.name,
            ...elementalApplication,
          }],
          hitTimeline: [{
            time: attackTime,
            sequence: timelineSequence++,
            hitNumber: 1,
            damage: hit.damage,
            source: `Off-field · ${summon.name}`,
            application: elementalApplication,
            reaction,
            concurrent: true,
          }],
        });
        offFieldResults[offFieldResults.length - 1].selfEffects = getSelfEffects({
          member: summon.member,
          damageElement: hit.damageElement,
          bondOfLifePercent: 0,
          masqueActive: false,
          artifacts,
          activeSupportEffects,
          activatedSupportEffects,
          isElementalSkill: isElementalSkill(
            summon.member.character,
            damageTalentAction,
          ),
          isOffField: offFieldBonusActive,
          isStellarConduct: reaction === "stellarConduct",
          enemyAffectedByStellarConduct,
        });
        if (isPolestarDamage) {
          offFieldResults[offFieldResults.length - 1].selfEffects.push({
            source: "Polestar Field",
            description: `+${28 + polestarStacks}% ${summonElement} DMG Bonus at ${polestarStacks} Polestar stack(s)`,
            applied: true,
            modeled: true,
          });
        }
        const codaActionResult = summon.id === "odette-coda"
          ? summon.parentActionResult
          : null;
        if (isDirectStellarSummonHit && codaActionResult) {
          const finalHitEvent = offFieldResults[offFieldResults.length - 1]
            .hitTimeline[0];
          codaActionResult.total += hit.damage;
          codaActionResult.hitTimeline.push({
            ...finalHitEvent,
            sequence: timelineSequence++,
            source: "Odette · Coda finale Stellar-Conduct hit",
          });
          codaActionResult.stellarConductHits.push({
            hitNumber: codaActionResult.stellarConductHits.length + 1,
            ...hit.stellarConduct,
          });
          offFieldResults[offFieldResults.length - 1].suppressFromDisplay = true;
        }
        if (summon.finalAdditionalDamage && isDirectStellarSummonHit &&
            hit.stellarConduct && hit.multiplier > 0) {
          const extraMultiplier = reaction === "stellarSwirl" ? 4.5 : 3;
          const extraDamageRatio = extraMultiplier / hit.multiplier;
          const extraDamage = hit.damage * extraDamageRatio;
          const primaryResult = offFieldResults[offFieldResults.length - 1];
          const primaryTimelineEvent = primaryResult.hitTimeline[0];
          const stellarConduct = Object.fromEntries(
            Object.entries(hit.stellarConduct).map(([key, value]) => [
              key,
              typeof value === "number" &&
                  ["nonCritDamage", "critDamage", "averageDamage"].includes(key)
                ? value * extraDamageRatio
                : value,
            ]),
          );
          const extraResult = {
            ...primaryResult,
            total: extraDamage,
            multiplier: extraMultiplier,
            automaticSummon: "Coda at Dawn's Tolling · C1 additional hit",
            activatedSupportEffects: [],
            elementalApplicationEvents: [],
            hitTimeline: [{
              ...primaryTimelineEvent,
              sequence: timelineSequence++,
              damage: extraDamage,
              source: "Odette · C1 Coda finale additional Stellar hit",
              application: null,
              stellarConduct,
            }],
          };
          if (codaActionResult) {
            codaActionResult.total += extraDamage;
            codaActionResult.hitTimeline.push({
              ...extraResult.hitTimeline[0],
              sequence: timelineSequence++,
            });
            codaActionResult.stellarConductHits.push({
              hitNumber: codaActionResult.stellarConductHits.length + 1,
              ...stellarConduct,
            });
            extraResult.suppressFromDisplay = true;
          }
          offFieldResults.push(extraResult);
        }
        recordWeaponHit({
          member: summon.member,
          talentAction: damageTalentAction,
          action: { reaction: "none" },
          time: attackTime,
          hitIndex: 0,
          state: weaponBuffState,
          isSummonTick: true,
        });
        summon.tickIndex = (summon.tickIndex || 0) + 1;
        if (isFinalSummonTick) summon.finalDamageProcessed = true;
        summon.nextTickAt += summon.interval;
      }
      if (summon.expiresAt <= timeLimit) activeOffFieldSummons.delete(summonKey);
    }
  }
  const results = actions.map((action, actionIndex) => {
    const member = members.find((entry) => entry.index === action.memberIndex);
    if (!member?.stats) return null;
    const talentAction = getRotationTalentAction(
      action,
      member,
      actionIndex,
      actions,
      raidenRules.isRaidenShogun(member.character) &&
        raidenRules.isBurstActiveInRotation(actions, actionIndex, member),
    );
    if (!talentAction) return null;
    const frameContext = resolveActionFrameContext(
      action,
      member,
      talentAction,
      actions[actionIndex - 1],
      members,
    );
    const automaticTiming = getActionFrameData(
      member.character,
      talentAction,
      frameContext,
    );
    if (previousActionMemberIndex !== null &&
        previousActionMemberIndex !== member.index) {
      const outgoingMemberIndex = previousActionMemberIndex;
      previousActionMemberIndex = null;
      elapsedSeconds += CHARACTER_SWAP_FRAMES / 60;
      const outgoingOdetteStacks = odetteMarvelousSplendorByMember.get(
        outgoingMemberIndex,
      );
      if (outgoingOdetteStacks && outgoingOdetteStacks.offFieldAt === null) {
        outgoingOdetteStacks.offFieldAt = elapsedSeconds;
      }
      const swapHealingEffects = [];
      swapHealingEffects.push(...chevreuseRules.processHealing({
        schedules: chevreuseHealingSchedules,
        members,
        time: elapsedSeconds,
        activeMemberIndex: outgoingMemberIndex,
        previousActionMemberIndex,
        buffsByTarget: supportBuffsByTarget,
        onHeal: (target, healTime) =>
          recordWeaponHealing(target, healTime, weaponBuffState),
      }));
      pendingSupportEffectDescriptions.push(...swapHealingEffects);
      processOffFieldSummons(elapsedSeconds);
      previousActionMemberIndex = outgoingMemberIndex;
    }
    const actionTalentLevel = Number(action.talentLevel || 10);
    talentLevelByMemberTalent.set(
      `${member.index}:${talentAction.talentIndex}`,
      actionTalentLevel,
    );
    const actionStartTime = elapsedSeconds;
    const isRaidenBurstOpeningHit = raidenRules.isBurstOpeningHit(
      member.character,
      talentAction,
    );
    const raidenResolveStacks = isElementalBurst(member.character, talentAction)
      ? raidenRules.handleBurstAction(
        raidenState,
        member,
        members.filter((entry) => raidenRules.isRaidenShogun(entry.character)),
      )
      : 0;
    const returningOdetteStacks = odetteMarvelousSplendorByMember.get(member.index);
    if (member.character.name === "Odette" &&
        returningOdetteStacks &&
        returningOdetteStacks.offFieldAt !== null) {
      returningOdetteStacks.stackCount = getOdetteStackCountAtTime(
        returningOdetteStacks,
        actionStartTime,
      );
      returningOdetteStacks.offFieldAt = null;
    }
    const firesChevreuseBall = chevreuseRules.shouldFireOverchargedBall({
      character: member.character,
      talentAction,
      hasOverloadTeam: hasChevreuseOverloadTeam,
      ballReady: chevreuseOverchargedBallReady,
    });
    const precedingActiveMemberIndex = previousActionMemberIndex;
    if (firesChevreuseBall) chevreuseOverchargedBallReady = false;
    const activatedSupportEffects = pendingSupportEffectDescriptions.splice(0);
    activatedSupportEffects.push(...chevreuseRules.processHealing({
      schedules: chevreuseHealingSchedules,
      members,
      time: actionStartTime,
      activeMemberIndex: member.index,
      previousActionMemberIndex,
      buffsByTarget: supportBuffsByTarget,
      onHeal: (target, healTime) =>
        recordWeaponHealing(target, healTime, weaponBuffState),
    }));
    if (previousActionMemberIndex !== null &&
        previousActionMemberIndex !== member.index) {
      const holder = members.find((entry) => entry.index === previousActionMemberIndex);
      if (holder) {
        const lastProc = lastThrillingTalesProcByMember.get(holder.index);
        const proc = activateThrillingTales({
          holder,
          target: member,
          time: actionStartTime,
          buffsByTarget: supportBuffsByTarget,
          isOnCooldown: lastProc !== undefined && actionStartTime - lastProc < 20,
        });
        if (proc.events.length) {
          activatedSupportEffects.push(...proc.events);
          lastThrillingTalesProcByMember.set(holder.index, actionStartTime);
        }
      }
    }
    if (previousActionMemberIndex !== member.index) {
      onFieldSinceByMember.set(member.index, actionStartTime);
    }
    previousActionMemberIndex = member.index;
    const resonanceAttack = hasPyroResonance
      ? (member.stats.baseAttack || 0) * 0.25
      : 0;
    const activeSupportEffects = [
      ...getActiveSupportBuffs(
        supportBuffsByTarget,
        member.index,
        actionStartTime,
      ),
      ...getOdetteMarvelousSplendorBuffs(member.index, actionStartTime),
    ];
    const supportFlatAttack = activeSupportEffects
      .filter((buff) => buff.stat === "flat ATK")
      .reduce((total, buff) => total + buff.value, 0);
    const supportElementalMastery = activeSupportEffects
      .filter((buff) => buff.stat === "elementalMastery")
      .reduce((total, buff) => total + buff.value, 0);
    let supportAttackPercent = activeSupportEffects
      .filter((buff) => buff.stat === "atkPercent")
      .reduce((total, buff) => total + buff.value, 0);
    const elementalBurst = isElementalBurst(member.character, talentAction);
    const noblesseTwoPieceBonus = elementalBurst &&
      hasArtifactSet(member, "Noblesse Oblige", 2) ? 20 : 0;
    const isSummonSetup = Boolean(
      talentAction.isSummonSetup || talentAction.isCodaSetup,
    );
    const hitCount = isSummonSetup ? 0 : Math.max(1, Number(action.hits) || 1);
    if (member.character.name === "Yae Miko" &&
        isElementalSkill(member.character, talentAction)) {
      yaeTotemsExpiresAt.set(member.index, actionStartTime + 14);
    }
    const framesPerHit = Math.max(0, Number(
      action.frameMode === "automatic"
        ? automaticTiming?.frames
        : action.frames,
    ) || 0);
    const summonConfig = getOffFieldSummon(
      member.character,
      talentAction,
      member.settings.constellation,
    );
    if (summonConfig) {
      const durationAction = getTalentAttributeAction(
        member.character,
        summonConfig.durationTalentName,
        summonConfig.durationAttributeName,
      );
      const damageTalentAction = getTalentActions(member.character, true).find(
        (entry) => entry.talentName === summonConfig.damageTalentName &&
          entry.name === summonConfig.damageActionName,
      );
      if ((durationAction || Number.isFinite(summonConfig.durationSeconds)) &&
          damageTalentAction) {
        const durationTalentLevel = durationAction
          ? talentLevelByMemberTalent.get(
            `${member.index}:${durationAction.talentIndex}`,
          ) ?? actionTalentLevel
          : actionTalentLevel;
        const damageTalentLevel = talentLevelByMemberTalent.get(
          `${member.index}:${damageTalentAction.talentIndex}`,
        ) ?? (damageTalentAction.talentIndex === talentAction.talentIndex
          ? actionTalentLevel
          : 10);
        const duration = Number.isFinite(summonConfig.durationSeconds)
          ? summonConfig.durationSeconds
          : getTalentMultiplier(
            member.character,
            durationAction,
            durationTalentLevel,
          ) + (summonConfig.durationConstellationBonus || 0);
        const existingSummons = [...activeOffFieldSummons.entries()].filter(
          ([, summon]) => summon.member.index === member.index &&
            summon.id === summonConfig.id,
        );
        let summonKey = `${member.index}:${summonConfig.id}`;
        if (summonConfig.maxInstances) {
          if (existingSummons.length >= summonConfig.maxInstances) {
            const oldest = existingSummons.sort(
              ([, left], [, right]) => left.createdAt - right.createdAt,
            )[0];
            if (oldest) activeOffFieldSummons.delete(oldest[0]);
          }
          const sequenceKey = `${member.index}:${summonConfig.id}`;
          const sequence = (summonInstanceSequence.get(sequenceKey) || 0) + 1;
          summonInstanceSequence.set(sequenceKey, sequence);
          summonKey = `${sequenceKey}:${sequence}`;
        }
        activeOffFieldSummons.set(summonKey, {
          ...summonConfig,
          member,
          damageTalentAction,
          tickIndex: 0,
          talentLevel: damageTalentLevel,
          createdAt: actionStartTime,
          nextTickAt: actionStartTime +
            (summonConfig.initialDelay || summonConfig.interval),
          expiresAt: actionStartTime + duration,
        });
        if (member.character.name === "Odette" &&
            summonConfig.id === "odette-dance-double" &&
            member.settings.constellation >= 2) {
          const stackCount = 4 + (member.settings.constellation >= 1 ? 2 : 0);
          odetteMarvelousSplendorByMember.set(member.index, {
            stackCount,
            constellation: member.settings.constellation,
            offFieldAt: null,
            expiresAt: actionStartTime + duration,
          });
          const stackBuffs = getOdetteMarvelousSplendorBuffs(
            member.index,
            actionStartTime,
          );
          activeSupportEffects.push(...stackBuffs);
          supportAttackPercent += stackBuffs.reduce(
            (total, buff) => total + buff.value,
            0,
          );
          activatedSupportEffects.push(
            `Odette C2 · Marvelous Splendor grants the party +${7 * stackCount}% ATK from ${stackCount} active stack(s)`,
          );
        }
        if (isSummonSetup) {
          recordWeaponHit({
            member,
            talentAction,
            action: { reaction: "none" },
            time: actionStartTime,
            hitIndex: 0,
            state: weaponBuffState,
          });
        }
      }
    }
    const result = {
      action: { ...action, frames: framesPerHit },
      member,
      talentAction,
      total: 0,
      duration: framesPerHit / 60,
      bondOfLifeBefore: bondOfLifeByMember.get(member.index) || 0,
      bondOfLifeAtDamage: bondOfLifeByMember.get(member.index) || 0,
      bondOfLifeAfter: bondOfLifeByMember.get(member.index) || 0,
      resonanceAttack,
      supportFlatAttack,
      supportAttackPercent,
      effectiveAttack: 0,
      damageBonus: 0,
      damageElement: member.character.element,
      resistanceShred: 0,
      effectiveEnemyResistance: Number(enemyResistance),
      masqueExtra: 0,
      damageBonusBreakdowns: [],
      fragmentStacks: 0,
      activeSupportEffects,
      activatedSupportEffects,
      actionStartTime,
      selfEffects: [],
      bondEvents: [],
      enemyEvents: [],
      weaponEffects: [],
      reactionHitIndexes: [],
      stellarConductHits: [],
      elementalApplicationEvents: [],
      fieldSelfApplication: null,
      hitTimeline: [],
    };
    if (talentAction.isCodaSetup) {
      const codaSummon = [...activeOffFieldSummons.values()].find(
        (summon) => summon.member.index === member.index &&
          summon.id === "odette-coda" &&
          summon.createdAt === actionStartTime,
      );
      if (codaSummon) {
        codaSummon.parentActionResult = result;
        result.isOdetteCoda = true;
        result.hitTimeline.push({
          time: actionStartTime,
          sequence: timelineSequence++,
          hitNumber: 0,
          damage: 0,
          source: "Adagio: Coda at Dawn's Tolling (E)",
          application: null,
          reaction: null,
          concurrent: false,
          actionMarker: true,
          timelineNote: "Duet begins; finale damage resolves after the duet.",
        });
      }
    }
    for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
      const attackTime = elapsedSeconds;
      result.activatedSupportEffects.push(...chevreuseRules.processHealing({
        schedules: chevreuseHealingSchedules,
        members,
        time: attackTime,
        activeMemberIndex: member.index,
        previousActionMemberIndex,
        buffsByTarget: supportBuffsByTarget,
        onHeal: (target, healTime) =>
          recordWeaponHealing(target, healTime, weaponBuffState),
      }));
      processOffFieldSummons(attackTime);
      const activeHitSupportEffects = [
        ...getActiveSupportBuffs(
          supportBuffsByTarget,
          member.index,
          attackTime,
        ),
        ...getOdetteMarvelousSplendorBuffs(member.index, attackTime),
      ];
      const hitSupportAttackPercent = activeHitSupportEffects
        .filter((buff) => buff.stat === "atkPercent")
        .reduce((total, buff) => total + buff.value, 0);
      const hitSupportDamageBonuses = {
        all: activeHitSupportEffects
          .filter((buff) => buff.stat === "allDamageBonus")
          .reduce((total, buff) => total + buff.value, 0),
        pyro: activeHitSupportEffects
          .filter((buff) => buff.stat === "pyroDamageBonus")
          .reduce((total, buff) => total + buff.value, 0),
        electro: activeHitSupportEffects
          .filter((buff) => buff.stat === "electroDamageBonus")
          .reduce((total, buff) => total + buff.value, 0),
      };
      result.activeSupportEffects = activeHitSupportEffects;
      const hitAction = {
        ...action,
        reaction: "none",
      };
      const currentBond = bondOfLifeByMember.get(member.index) || 0;
      if (hitIndex === 0 && isArlecchinoChargedAttack(member.character, talentAction)) {
        const mark = bloodDebtMarkByMember.get(member.index);
        const absorbTime = attackTime + 12 / 60;
        if (mark && absorbTime <= mark.expiresAt) {
          const c2ApplicationRule = getArlecchinoC2Application(
            member.settings.constellation,
          );
          if (c2ApplicationRule) {
            const c2Application = trackElementalApplication(
              elementalApplicationByGroup,
              `${member.index}:arlecchino:c2`,
              c2ApplicationRule,
              absorbTime,
            );
            result.elementalApplicationEvents.push({
              hitNumber: hitIndex + 1,
              time: absorbTime,
              source: "C2 · Balemoon Bloodfire",
              ...c2Application,
            });
            result.hitTimeline.push({
              time: absorbTime,
              sequence: timelineSequence++,
              hitNumber: hitIndex + 1,
              damage: 0,
              source: "C2 · Balemoon Bloodfire",
              application: c2Application,
              reaction: null,
            });
          }
          const markValue = absorbTime - mark.appliedAt >= 5 ? 130 : 65;
          const skillTime = skillUseByMember.get(member.index);
          const isBloodDebtWindowActive = skillTime !== undefined && absorbTime - skillTime <= 35;
          if (isBloodDebtWindowActive) {
            const debtAlreadyGained = debtBondGainedByMember.get(member.index) || 0;
            const debtGain = Math.min(markValue, Math.max(0, 145 - debtAlreadyGained));
            if (debtGain > 0) {
              setBondOfLife(
                member.index,
                Math.min(200, currentBond + debtGain),
                absorbTime,
              );
              debtBondGainedByMember.set(member.index, debtAlreadyGained + debtGain);
              result.bondEvents.push(
                `Absorbed ${absorbTime - mark.appliedAt >= 5 ? "matured Due" : "fresh Directive"} before the hit: +${debtGain}% BoL`,
              );
            }
          } else {
            result.bondEvents.push("Blood-Debt mark expired outside the 35s Skill collection window");
          }
          bloodDebtMarkByMember.delete(member.index);
        }
      }
      const bondAtDamage = bondOfLifeByMember.get(member.index) || 0;
      result.bondOfLifeAtDamage = bondAtDamage;
      const fragmentActive = (fragmentExpiryByMember.get(member.index) || 0) > attackTime;
      const fragmentStacks = fragmentActive
        ? fragmentStacksByMember.get(member.index) || 0
        : 0;
      result.fragmentStacks = fragmentStacks;
      const qiqiEffects = getStellarCombatEffects(member.character.name, {
        constellation: member.settings.constellation,
        inPolestarField: polestarFieldExpiresAt > attackTime,
        isSelf: true,
        normalOrChargedAttack: /^(?:[1-6]-Hit DMG|Charged Attack DMG)$/i
          .test(talentAction.name),
      });
      const qiqiCryoInfusion = Boolean(qiqiEffects.cryoInfusion);
      const sandronePhysicalNormalAttack = member.character.name === "Sandrone" &&
        getTalentSlot(member.character, talentAction) === "combat1" &&
        /^[1-3]-Hit DMG$/i.test(talentAction.name);
      const damageElementOverride = qiqiCryoInfusion
        ? "Cryo"
        : sandronePhysicalNormalAttack ? "Physical" : null;
      const baseHit = calculateActionDamage(
        member.stats,
        { ...hitAction, reaction: "none" },
        member.character,
        talentAction,
        Number(action.talentLevel || 10),
        Number(enemyLevel),
        Number(enemyResistance),
        {
          bondOfLifePercent: bondAtDamage,
          constellation: member.settings.constellation,
          damageElementOverride,
        },
      );
      const elementalApplication = baseHit.damageElement !== "Physical" &&
        baseHit.damageElement !== "None";
      const applicationRule = elementalApplication
        ? getElementalApplicationRule(
          member.character,
          talentAction,
          member.settings.constellation,
        )
        : null;
      const applicationResults = Array.from(
        { length: applicationRule?.applicationsPerActionHit || 1 },
        (_, applicationIndex) => ({
          applicationIndex,
          result: trackElementalApplication(
            elementalApplicationByGroup,
            getElementalApplicationGroupKey(member, talentAction, applicationRule),
            applicationRule,
            attackTime,
          ),
        }),
      );
      const automaticReactions = applicationResults.map(({ result: application }) =>
        resolveElementalReaction(enemyAuras, application, attackTime));
      applicationResults.forEach(({ applicationIndex, result: application }, index) => {
        application.reaction = automaticReactions[index];
        result.elementalApplicationEvents.push({
          hitNumber: hitIndex + 1,
          strikeNumber: applicationIndex + 1,
          time: attackTime,
          source: talentAction.name,
          reaction: null,
          ...application,
        });
      });
      const reactionEligible = applicationResults.some(({ result: application }) =>
        application.applied);
      const automaticReaction = automaticReactions.find(Boolean);
      const selectedReaction = action.reaction === "none"
        ? automaticReaction || "none"
        : action.reaction;
      const directStellarDamageAction = /Stellar-Conduct/i.test(talentAction.name);
      const shouldTriggerStellarConduct = action.reaction === "stellarConduct" ||
        (hasStellarConductEnabler && selectedReaction === "superconduct") ||
        directStellarDamageAction;
      const enemyAffectedByStellarConduct =
        (stellarResistanceShredExpiry.get("electro") || 0) > attackTime;
      hitAction.reaction = (reactionEligible || directStellarDamageAction)
        ? shouldTriggerStellarConduct
          ? hasStellarConductEnabler &&
              ["Cryo", "Electro"].includes(baseHit.damageElement)
            ? "stellarConduct"
            : "none"
          : selectedReaction
        : "none";
      if (hitAction.reaction !== "none") {
        result.reactionHitIndexes.push(hitIndex + 1);
      }
      if (hitAction.reaction === "stellarConduct") {
        applicationResults.forEach(({ result: application }) => {
          if (application.reaction !== "superconduct") return;
          application.reaction = "stellarConduct";
          result.elementalApplicationEvents
            .filter((event) =>
              event.hitNumber === hitIndex + 1 &&
              event.time === attackTime &&
              event.source === talentAction.name)
            .forEach((event) => {
              event.reaction = "stellarConduct";
            });
        });
      }
      if (hitAction.reaction === "stellarConduct") {
        polestarFieldExpiresAt = attackTime + 6;
        ["cryo", "electro", "physical"].forEach((element) =>
          stellarResistanceShredExpiry.set(element, attackTime + 6));
      }
      const isPolestarDamage = polestarFieldExpiresAt > attackTime &&
        ["Cryo", "Electro"].includes(baseHit.damageElement);
      if (isPolestarDamage) recordPolestarHit(attackTime);
      const polestarStacks = getPolestarStacks(attackTime);
      if (isPolestarDamage) {
        const element = baseHit.damageElement.toLowerCase();
        hitSupportDamageBonuses[element] =
          (hitSupportDamageBonuses[element] || 0) + 28 + polestarStacks;
      }
      const fischl = members.find((entry) => entry.character.name === "Fischl");
      const jointAttacks = fischlRules.getJointAttackActions({
        fischl,
        talentAction,
        reaction: hitAction.reaction,
        ozActive: Boolean(fischl &&
          activeOffFieldSummons.get(`${fischl.index}:oz`)?.expiresAt > attackTime),
      });
      jointAttacks.forEach((jointAction) => {
        const jointRule = getElementalApplicationRule(
          fischl.character,
          jointAction,
          fischl.settings.constellation,
        );
        const jointApplication = trackElementalApplication(
          elementalApplicationByGroup,
          getElementalApplicationGroupKey(fischl, jointAction, jointRule),
          jointRule,
          attackTime,
        );
        result.elementalApplicationEvents.push({
          hitNumber: hitIndex + 1,
          time: attackTime,
          source: jointAction.source,
          ...jointApplication,
        });
        result.hitTimeline.push({
          time: attackTime,
          sequence: timelineSequence++,
          hitNumber: hitIndex + 1,
          damage: 0,
          source: jointAction.source,
          application: jointApplication,
          reaction: null,
        });
      });
      weaponBuffState.activeMemberIndex = member.index;
      const weaponEffects = getWeaponHitEffects({
        member,
        members,
        talentAction,
        action: hitAction,
        time: attackTime,
        bondOfLifePercent: bondAtDamage,
        enemyCount,
        shielded: member.settings.weaponShielded,
        enemyAffectedByPyroHydro: member.settings.enemyAffectedByPyroHydro,
        state: weaponBuffState,
      });
      result.weaponEffects = weaponEffects.entries;
      const effectiveStats = {
        ...member.stats,
        attack: member.stats.attack + resonanceAttack + supportFlatAttack +
          (member.stats.baseAttack || 0) *
            (hitSupportAttackPercent + weaponEffects.attackPercent) / 100 +
          weaponEffects.flatAttack,
        energyRecharge: member.stats.energyRecharge +
          (weaponEffects.energyRecharge || 0),
        elementalMastery: member.stats.elementalMastery +
          weaponEffects.elementalMastery + supportElementalMastery +
          getYaeMikoMasteryBonus(member, attackTime, member.index),
      };
      result.effectiveAttack = effectiveStats.attack;
      result.supportAttackPercent = hitSupportAttackPercent;
      result.weaponAttackPercent = weaponEffects.attackPercent;
      result.weaponFlatAttack = weaponEffects.flatAttack;
      result.weaponElementalMastery = weaponEffects.elementalMastery;
      result.weaponEnergyRecharge = weaponEffects.energyRecharge || 0;
      const inPolestarField = polestarFieldExpiresAt > attackTime;
      const teamConstellationEffects = members.map((ally) => ({
        member: ally,
        effects: getStellarCombatEffects(ally.character.name, {
          constellation: ally.settings.constellation,
          inPolestarField,
          isSelf: ally.index === member.index,
          talentAction: ally.index === member.index ? talentAction : null,
          attack: ally.index === member.index ? effectiveStats.attack : ally.stats.attack,
        }),
      }));
      const ownConstellationEffects = teamConstellationEffects.find(
        ({ member: ally }) => ally.index === member.index,
      )?.effects || {};
      const stellarSupportDamageBonus = activeHitSupportEffects
        .filter((buff) => buff.stat === "stellarConductDamageBonus")
        .reduce((total, buff) => total + buff.value, 0) +
        activeHitSupportEffects
          .filter((buff) => buff.stat === "allDamageBonus")
          .reduce((total, buff) => total + buff.value, 0) +
        (weaponEffects.damageBonuses.stellarConduct || 0) +
        (ownConstellationEffects.stellarDamageBonus || 0);
      const artifactStellarEffects = getDisenchantmentEffects(member, {
        isStellarConduct: hitAction.reaction === "stellarConduct",
        enemyAffectedByStellarConduct,
      });
      const stellarCritDamageBonus = teamConstellationEffects
        .reduce((total, entry) =>
          total + (entry.effects.stellarCritDamageBonus || 0), 0);
      const critDamageBonus = ["Cryo", "Electro"].includes(baseHit.damageElement)
        ? teamConstellationEffects
          .reduce((total, entry) =>
            total + (entry.effects.critDamageBonus || 0), 0)
        : 0;
      const constellationResistanceBonuses = teamConstellationEffects
        .reduce((bonuses, entry) => {
          Object.entries(entry.effects.resistanceShredByElement || {}).forEach(
        ([element, value]) => {
          bonuses[element] = (bonuses[element] || 0) + value;
        },
          );
          return bonuses;
        }, {});
      const resistanceShredOverrides = teamConstellationEffects
        .reduce((overrides, entry) => ({
          ...overrides,
          ...entry.effects.resistanceShredOverrides,
        }), {});
      const resistanceShredByElement = Object.fromEntries(
        ["cryo", "pyro", "electro", "physical"].map((element) => [
          element,
          Math.max(
        ((element === "pyro" || element === "electro") &&
        hasChevreuseOverloadTeam &&
        (enemyResistanceShredExpiry.get(element) || 0) > attackTime
        ? 40
        : 0) +
          ((stellarResistanceShredExpiry.get(element) || 0) > attackTime
        ? element === "physical" ? 40 : ["cryo", "electro"].includes(element) ? 15 : 0
        : 0) +
        (constellationResistanceBonuses[element] || 0),
        resistanceShredOverrides[element] || 0,
          ),
        ]),
      );
      const enemyDamageTakenBonus = ["Physical", "Cryo", "Electro"]
        .includes(baseHit.damageElement)
        ? activeHitSupportEffects
          .filter((buff) => buff.stat === "enemyDamageTakenBonus")
          .reduce((total, buff) => total + buff.value, 0)
        : 0;
      const raidenEyeBurstBonus = elementalBurst
        ? members
          .filter((entry) => raidenRules.isRaidenShogun(entry.character) &&
            (raidenState.eyeExpiresAt.get(entry.index) || 0) > attackTime)
          .reduce((total, raiden) => {
            const skillLevel = talentLevelByMemberTalent.get(
              `${raiden.index}:${raiden.character.combatTalents.findIndex(
                (entry) => entry.slot === "combat2",
              )}`,
            ) || 10;
            return total + raidenRules.getEyeBurstDamageBonus(
              raiden.character,
              member.character,
              skillLevel,
            );
          }, 0)
        : 0;
      const emblemBurstBonus = elementalBurst &&
        hasArtifactSet(member, "Emblem of Severed Fate", 4)
        ? Math.min(75, effectiveStats.energyRecharge * 0.25)
        : 0;
      const hit = calculateActionDamage(
        effectiveStats,
        hitAction,
        member.character,
        talentAction,
        Number(action.talentLevel || 10),
        Number(enemyLevel),
        Number(enemyResistance),
        {
          bondOfLifePercent: bondAtDamage,
          constellation: member.settings.constellation,
          supportDamageBonuses: hitSupportDamageBonuses,
          weaponDamageBonuses: weaponEffects.damageBonuses,
          burstDamageBonus: noblesseTwoPieceBonus + raidenEyeBurstBonus +
            emblemBurstBonus,
          resistanceShredByElement,
          stellarDamageBonus: stellarSupportDamageBonus +
            artifactStellarEffects.stellarDamageBonus,
          stellarCritRateBonus: artifactStellarEffects.stellarCritRateBonus,
          stellarCritDamageBonus,
          critDamageBonus,
          polestarStacks,
          enemyDefenseReduction: Number(enemyDefenseReduction) +
            (ownConstellationEffects.enemyDefenseReduction || 0),
          enemyDamageTakenBonus,
          damageElementOverride,
          selfDamageBonus: fragmentStacks * 18 +
            getGoldenTroupeDamageBonus(member, talentAction) +
            (qiqiEffects.selfDamageBonus || 0),
          talentMultiplierOverride: isRaidenBurstOpeningHit
            ? getTalentMultiplier(
              member.character,
              talentAction,
              Number(action.talentLevel || 10),
            ) + raidenRules.getResolveDamageBonus(
              member.character,
              talentAction,
              Number(action.talentLevel || 10),
              raidenResolveStacks,
            )
            : null,
          stellarBaseDamageBonus: getOdetteStellarBaseDamageBonus(
            attackTime,
            member.character.name === "Odette" ? effectiveStats.attack : null,
          ),
        },
      );
      result.total += hit.damage;
      result.isStellarConduct = result.isStellarConduct ||
        hitAction.reaction === "stellarConduct";
      result.enemyAffectedByStellarConduct =
        result.enemyAffectedByStellarConduct || enemyAffectedByStellarConduct;
      if (hit.stellarConduct) {
        result.stellarConductHits.push({
          hitNumber: hitIndex + 1,
          ...hit.stellarConduct,
        });
      }
      if (hitAction.reaction === "stellarConduct") {
        result.activatedSupportEffects.push(...activateStellarCharacterBuffs(
          member,
          "stellarConduct",
          attackTime,
        ));
        result.activatedSupportEffects.push(
          ...activateHeartOfFurnaceStellarReaction({
            member,
            members,
            time: attackTime,
            buffsByTarget: supportBuffsByTarget,
          }),
        );
      }
      result.multiplier = hit.multiplier;
      result.damageBonus = hit.damageBonus;
      result.damageBonusBreakdowns.push({
        hitNumber: hitIndex + 1,
        sources: hit.damageBonusBreakdown,
        total: hit.damageBonus,
      });
      result.resistanceShred = hit.resistanceShred;
      result.effectiveEnemyResistance = hit.effectiveResistance;
      result.weaponDamageBonus = hit.weaponDamageBonus;
      result.damageElement = hit.damageElement;
      result.masqueExtra += hit.masqueExtra;
      if (chevreuseRules.applyOverloadEffects({
        reaction: hitAction.reaction,
        damageElement: hit.damageElement,
        hasOverloadTeam: hasChevreuseOverloadTeam,
        time: attackTime,
        enemyResistanceShredExpiry,
      })) {
        result.enemyEvents.push(
          "Chevreuse's Coordinated Tactics: enemy Pyro/Electro RES −40% for 6s",
        );
        chevreuseOverchargedBallReady = true;
      }

      if (isArlecchinoNormalAttack(member.character, talentAction) && hit.masqueActive) {
        setBondOfLife(member.index, currentBond * 0.925, attackTime);
      }

      result.hitTimeline.push({
        time: attackTime,
        sequence: timelineSequence++,
        hitNumber: hitIndex + 1,
        damage: hit.damage,
        source: `${member.character.name} · ${talentAction.name}`,
        application: applicationResults.map(({ result: application }) => application),
        reaction: hitAction.reaction,
        actionReaction: action.reaction,
        stellarConduct: hit.stellarConduct,
      });

      const raiden = raidenRules.getActiveEyeMember(
        raidenState,
        members,
        attackTime,
      );
      const coordinatedAction = raiden &&
        raidenRules.getCoordinatedAttack(raiden.character);
      if (raiden && coordinatedAction) {
        const raidenSkillLevel = talentLevelByMemberTalent.get(
          `${raiden.index}:${coordinatedAction.talentIndex}`,
        ) || 10;
        const raidenBuffs = getActiveSupportBuffs(
          supportBuffsByTarget,
          raiden.index,
          attackTime,
        );
        const raidenWeaponEffects = getWeaponHitEffects({
          member: raiden,
          members,
          talentAction: coordinatedAction,
          action: { scaling: "atk", reaction: "none" },
          time: attackTime,
          bondOfLifePercent: 0,
          enemyCount,
          shielded: raiden.settings.weaponShielded,
          enemyAffectedByPyroHydro: raiden.settings.enemyAffectedByPyroHydro,
          state: weaponBuffState,
        });
        const coordinatedRule = getElementalApplicationRule(
          raiden.character,
          coordinatedAction,
          raiden.settings.constellation,
        );
        const coordinatedApplication = trackElementalApplication(
          elementalApplicationByGroup,
          getElementalApplicationGroupKey(raiden, coordinatedAction, coordinatedRule),
          coordinatedRule,
          attackTime,
        );
        const coordinatedReaction = resolveElementalReaction(
          enemyAuras,
          coordinatedApplication,
          attackTime,
        );
        const { hit: coordinatedHit } = raidenRules.calculateCoordinatedAttack({
          calculateDamage: calculateActionDamage,
          member: raiden,
          talentAction: coordinatedAction,
          action: { scaling: "atk", reaction: coordinatedReaction || "none" },
          talentLevel: raidenSkillLevel,
          activeBuffs: raidenBuffs,
          weaponEffects: raidenWeaponEffects,
          enemyLevel: Number(enemyLevel),
          enemyResistance: Number(enemyResistance),
          resistanceShredByElement,
          enemyDefenseReduction: Number(enemyDefenseReduction),
        });
        raidenRules.recordEyeAttack(raidenState, raiden.index, attackTime);
        result.total += coordinatedHit.damage;
        result.hitTimeline.push({
          time: attackTime,
          sequence: timelineSequence++,
          hitNumber: hitIndex + 1,
          damage: coordinatedHit.damage,
          source: "Raiden Shogun · Eye of Stormy Judgment",
          application: coordinatedApplication,
          reaction: coordinatedReaction,
          concurrent: true,
        });
        result.elementalApplicationEvents.push({
          hitNumber: hitIndex + 1,
          time: attackTime,
          source: "Raiden Shogun · Eye of Stormy Judgment",
          ...coordinatedApplication,
        });
        if (coordinatedReaction) {
          result.reactionHitIndexes.push(hitIndex + 1);
          if (chevreuseRules.applyOverloadEffects({
            reaction: coordinatedReaction,
            damageElement: coordinatedHit.damageElement,
            hasOverloadTeam: hasChevreuseOverloadTeam,
            time: attackTime,
            enemyResistanceShredExpiry,
          })) {
            result.enemyEvents.push(
              "Chevreuse's Coordinated Tactics: enemy Pyro/Electro RES −40% for 6s",
            );
            chevreuseOverchargedBallReady = true;
          }
        }
        recordWeaponHit({
          member: raiden,
          talentAction: coordinatedAction,
          action: { reaction: coordinatedReaction || "none" },
          time: attackTime,
          hitIndex,
          state: weaponBuffState,
        });
      }

      const triggersCrimsonMoon = recordWeaponHit({
        member,
        talentAction,
        action: hitAction,
        time: attackTime,
        hitIndex,
        state: weaponBuffState,
      });
      if (actionHasHealing(member.character, talentAction)) {
        const description = getTalentActionDescription(member.character, talentAction);
        const healsParty = /(?:nearby )?party members|all nearby/i.test(description);
        const healedIndexes = new Set([member.index, precedingActiveMemberIndex]);
        members
          .filter((target) => target.weapon?.name === "Tidal Shadow" &&
            (healsParty || healedIndexes.has(target.index)))
          .forEach((target) => recordWeaponHealing(target, attackTime, weaponBuffState));
      }
      if (triggersCrimsonMoon) {
        const lastProc = lastCrimsonMoonProcByMember.get(member.index);
        if (lastProc === undefined || attackTime - lastProc >= 14) {
          setBondOfLife(
            member.index,
            Math.min(200, (bondOfLifeByMember.get(member.index) || 0) + 25),
            attackTime,
          );
          lastCrimsonMoonProcByMember.set(member.index, attackTime);
          result.bondEvents.push("Crimson Moon's Semblance: +25% BoL on Charged Attack hit");
        }
      }
      elapsedSeconds += framesPerHit / 60;
      result.activatedSupportEffects.push(...chevreuseRules.processHealing({
        schedules: chevreuseHealingSchedules,
        members,
        time: elapsedSeconds,
        activeMemberIndex: member.index,
        previousActionMemberIndex,
        buffsByTarget: supportBuffsByTarget,
        onHeal: (target, healTime) =>
          recordWeaponHealing(target, healTime, weaponBuffState),
      }));
    }

    if (isSummonSetup) elapsedSeconds += framesPerHit / 60;
    result.bondOfLifeAfter = bondOfLifeByMember.get(member.index) || 0;
    if (isArlecchinoSkill(member.character, talentAction)) {
      skillUseByMember.set(member.index, actionStartTime);
      debtBondGainedByMember.set(member.index, 0);
      bloodDebtMarkByMember.set(member.index, {
        appliedAt: actionStartTime,
        expiresAt: actionStartTime + 30,
      });
      result.bondEvents.push(
        "All Is Ash applies one Blood-Debt Directive to the default single target; it becomes a Due after 5s and expires after 30s",
      );
    }
    if (member.character.name === "Bennett" &&
        talentAction.talentName === "Fantastic Voyage") {
      const burstEffects = bennettRules.activateBurst({
        member,
        members,
        talentLevel: Number(action.talentLevel || 10),
        time: actionStartTime,
        buffsByTarget: supportBuffsByTarget,
        assumeTargetsAbove70PercentHp: member.settings.assumeAbove70PercentHp,
      });
      activatedSupportEffects.push(...burstEffects.events);
      result.fieldSelfApplication = burstEffects.fieldSelfApplication;
    }
    if (isElementalBurst(member.character, talentAction)) {
      activatedSupportEffects.push(...activateNoblesseBurst({
        member,
        members,
        time: actionStartTime,
        buffsByTarget: supportBuffsByTarget,
      }));
      activatedSupportEffects.push(...activateStellarCharacterBuffs(
        member,
        "burst",
        actionStartTime,
      ));
    }
    if (raidenRules.isRaidenShogun(member.character) &&
        isElementalSkill(member.character, talentAction)) {
      const duration = raidenRules.getTalentAttributeValue(
        member.character,
        talentAction.talentName,
        "Duration",
        actionTalentLevel,
      );
      raidenRules.activateEye(
        raidenState,
        member.index,
        actionStartTime,
        duration || 25,
      );
      activatedSupportEffects.push(
        `Raiden Shogun · Eye of Stormy Judgment is active for ${duration || 25}s`,
      );
    }
    if (isRaidenBurstOpeningHit) {
      result.activatedSupportEffects.push(
        `Raiden Shogun · Musou no Hitotachi consumes ${raidenResolveStacks} Resolve stack(s)`,
      );
    }
    if (!isSummonSetup && isElementalSkill(member.character, talentAction) &&
        hasArtifactSet(member, "Tenacity of the Millelith", 4)) {
      const lastProc = lastTenacityProcByMember.get(member.index);
      if (lastProc === undefined || actionStartTime - lastProc >= 0.5) {
        activatedSupportEffects.push(...activateTenacitySkill({
          member,
          members,
          time: actionStartTime,
          buffsByTarget: supportBuffsByTarget,
        }));
        lastTenacityProcByMember.set(member.index, actionStartTime);
      }
    }
    if (chevreuseRules.isSkillAction(member.character, talentAction)) {
      if (firesChevreuseBall) {
        activatedSupportEffects.push(...chevreuseRules.activateOverchargedBall({
          member,
          members,
          time: actionStartTime,
          buffsByTarget: supportBuffsByTarget,
        }));
      }
      const healingSchedule = chevreuseRules.createHealingSchedule(
        member,
        actionStartTime,
      );
      if (healingSchedule) chevreuseHealingSchedules.push(healingSchedule);
      const initialHealEffect = chevreuseRules.applyInitialHeal({
        member,
        time: actionStartTime,
        buffsByTarget: supportBuffsByTarget,
      });
      if (initialHealEffect) {
        recordWeaponHealing(member, actionStartTime, weaponBuffState);
        activatedSupportEffects.push(`${initialHealEffect} after the initial heal pulse`);
      }
    }
    if (isArlecchino(member.character)) {
      result.selfEffects = getSelfEffects({
        member,
        damageElement: result.damageElement,
        bondOfLifePercent: result.bondOfLifeAtDamage,
        masqueActive: result.bondOfLifeAtDamage >= 30,
        masqueExtraApplied: result.masqueExtra > 0,
        artifacts,
        activeSupportEffects,
        activatedSupportEffects,
        fragmentStacks: result.fragmentStacks,
        isElementalBurst: elementalBurst,
        isElementalSkill: isElementalSkill(member.character, talentAction),
        energyRecharge: member.stats.energyRecharge +
          (result.weaponEnergyRecharge || 0),
        isStellarConduct: result.isStellarConduct,
        enemyAffectedByStellarConduct:
          result.enemyAffectedByStellarConduct,
      });
    } else {
      result.selfEffects = getSelfEffects({
        member,
        damageElement: result.damageElement,
        bondOfLifePercent: 0,
        masqueActive: false,
        masqueExtraApplied: false,
        artifacts,
        activeSupportEffects,
        activatedSupportEffects,
        fragmentStacks: result.fragmentStacks,
        isElementalBurst: elementalBurst,
        isElementalSkill: isElementalSkill(member.character, talentAction),
        energyRecharge: member.stats.energyRecharge +
          (result.weaponEnergyRecharge || 0),
        isStellarConduct: result.isStellarConduct,
        enemyAffectedByStellarConduct:
          result.enemyAffectedByStellarConduct,
      });
    }
    if (raidenRules.isRaidenShogun(member.character) &&
        result.damageElement === "Electro") {
      result.selfEffects.push({
        source: "Raiden Shogun · Enlightened One",
        description: `+${raidenRules.getElectroDamageBonus(
          member.character,
          member.stats.energyRecharge + (result.weaponEnergyRecharge || 0),
        )}% Electro DMG from Energy Recharge`,
        applied: true,
        modeled: true,
      });
    }
    processOffFieldSummons(elapsedSeconds);
    return result;
  }).filter(Boolean);
  const odetteCodaEndTime = [...activeOffFieldSummons.values()]
    .filter((summon) => summon.id === "odette-coda")
    .reduce((endTime, summon) => Math.max(endTime, summon.expiresAt), elapsedSeconds);
  if (odetteCodaEndTime > elapsedSeconds) {
    processOffFieldSummons(odetteCodaEndTime);
    elapsedSeconds = odetteCodaEndTime;
  }
  const displayResults = [
    ...results,
    ...offFieldResults
      .filter((result) => !result.suppressFromDisplay)
      .sort((left, right) => left.actionStartTime - right.actionStartTime),
  ];
  const rotationTimeline = displayResults
    .flatMap((result, resultIndex) => (result.hitTimeline || []).map((event, eventIndex) => ({
      ...event,
      memberName: result.member.character.name,
      resultKey: `${resultIndex}:${event.hitNumber}:${event.time}:${eventIndex}`,
      concurrent: Boolean(event.concurrent),
      applicationEvents: Array.isArray(event.application)
        ? event.application
        : [event.application],
    })))
    .sort((left, right) => left.time - right.time ||
      left.sequence - right.sequence);
  const totalDamage = displayResults.reduce((total, result) => total + result.total, 0);
  const hasCompleteTiming = results.length > 0 &&
    results.length === actions.length &&
    results.every((result) => Number(result.action.frames) > 0);
  const totalDuration = elapsedSeconds;

  function addAction() {
    const member = members[0];
    const firstGroup = member
      ? getRotationActionGroups(member.character)[0]
      : null;
    const firstAction = firstGroup?.actions[0];
    const automaticFrames = getAutomaticFrames(member?.character, firstAction);
    setActions((current) => [...current, {
      ...EMPTY_ACTION,
      memberIndex: member?.index || 0,
      actionType: firstGroup?.key || "",
      talentKey: firstAction?.key || "",
      frames: automaticFrames,
      frameMode: automaticFrames ? "automatic" : "manual",
    }]);
  }

  function updateAction(index, changes) {
    setActions((current) => current.map((action, actionIndex) =>
      actionIndex === index ? { ...action, ...changes } : action));
  }

  function updateMember(index, changes) {
    setConfiguration((current) => ({
      ...current,
      [index]: { ...(current[index] || { constellation: 0, refinement: 1, startingBondOfLife: 0, assumeAbove70PercentHp: true }), ...changes },
    }));
  }

  function reloadPresets() {
    const next = readTeamPresets();
    setPresets(next.presets);
    setPresetError(next.error);
    if (!next.presets.some((preset) => preset.id === presetId)) {
      setPresetId(next.presets[0]?.id || "");
      setActions([]);
    }
  }

  return (
    <main className="loadout-page dps-calculator-page">
      <button className="detail-back" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> Back to Team Optimizer
      </button>
      <section className="loadout-intro">
        <div>
          <p className="eyebrow"><span>TEAM DAMAGE MODEL</span> &nbsp; PRESET-BASED</p>
          <h1>DPS Calculator</h1>
          <p>Load a saved team, enter its rotation, and estimate hit damage and rotation DPS.</p>
        </div>
        <div className="loadout-counts">
          <span><b>{presets.length}</b> saved presets</span>
          <span><b>{inventory.artifacts.length}</b> owned artifacts</span>
        </div>
      </section>
      {(loading || error) && (
        <p className={`loadout-message ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>
          {error || "Loading character, weapon, and artifact data…"}
        </p>
      )}
      {presetError && <p className="loadout-message error" role="alert">{presetError}</p>}
      {rotationPresetError && <p className="loadout-message error" role="alert">{rotationPresetError}</p>}
      {rotationPresetNotice && <p className="loadout-message success" role="status">{rotationPresetNotice}</p>}

      <section className="loadout-panel dps-panel">
        <div className="loadout-panel-heading">
          <div>
            <p className="eyebrow"><span>SAVED TEAM</span></p>
            <h2>Import a team preset</h2>
          </div>
          <button className="loadout-submit" onClick={reloadPresets} type="button">Refresh presets</button>
        </div>
        {presets.length ? (
          <label className="loadout-field dps-preset-field">
            <span>Team preset</span>
            <select onChange={(event) => {
              setPresetId(event.target.value);
              setActions([]);
              setRotationPresetError("");
              setRotationPresetNotice("");
            }} value={presetId}>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="empty-state">
            <h2>No saved teams yet</h2>
            <p>Save a four-character team in Team Optimizer, then return here to calculate its rotation.</p>
          </div>
        )}
        {members.length > 0 && (
          <div className="dps-member-grid">
            {members.map(({ index, character, weapon, build, settings }) => (
              <article className="dps-member" key={index}>
                <b>{character.name}</b>
                <span>{build ? `${build.setName} · ${build.setCount} pieces` : "No full artifact build available"}</span>
                <span>{weapon?.name || "No weapon selected"}</span>
                <label className="loadout-field">
                  <span>Constellation</span>
                  <select onChange={(event) => updateMember(index, { constellation: Number(event.target.value) })} value={settings.constellation}>
                    {Array.from({ length: 7 }, (_, value) => <option key={value} value={value}>C{value}</option>)}
                  </select>
                </label>
                <label className="loadout-field">
                  <span>Weapon refinement</span>
                  <select onChange={(event) => updateMember(index, { refinement: Number(event.target.value) })} value={settings.refinement}>
                    {Array.from({ length: 5 }, (_, value) => <option key={value + 1} value={value + 1}>R{value + 1}</option>)}
                  </select>
                </label>
                {isArlecchino(character) && (
                  <label className="loadout-field">
                    <span>Starting Bond of Life (% Max HP)</span>
                    <input
                      min="0"
                      max="300"
                      onChange={(event) => updateMember(index, { startingBondOfLife: Number(event.target.value) })}
                      type="number"
                      value={settings.startingBondOfLife ?? 0}
                    />
                  </label>
                )}
                {character.name === "Bennett" && (
                  <label className="loadout-field">
                    <span>Assume team is above 70% HP in Bennett&apos;s field</span>
                    <input
                      checked={settings.assumeAbove70PercentHp ?? true}
                      onChange={(event) => updateMember(index, { assumeAbove70PercentHp: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                )}
                {weapon?.name === "Staff of Homa" && (
                  <label className="loadout-field">
                    <span>Assume wielder is below 50% HP (Staff of Homa)</span>
                    <input
                      checked={settings.weaponHpBelow50}
                      onChange={(event) => updateMember(index, { weaponHpBelow50: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                )}
                {weapon?.name === "Vortex Vanquisher" && (
                  <label className="loadout-field">
                    <span>Assume wielder is protected by a shield</span>
                    <input
                      checked={settings.weaponShielded}
                      onChange={(event) => updateMember(index, { weaponShielded: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                )}
                {weapon?.name === "Dragon's Bane" && (
                  <label className="loadout-field">
                    <span>Assume enemy is affected by Pyro or Hydro</span>
                    <input
                      checked={settings.enemyAffectedByPyroHydro}
                      onChange={(event) => updateMember(index, { enemyAffectedByPyroHydro: event.target.checked })}
                      type="checkbox"
                    />
                  </label>
                )}
              </article>
            ))}
          </div>
        )}
        {members.length > 0 && (
          <p className="dps-data-note">
            Pyro resonance adds 25% of each character&apos;s combined base ATK when at least two Pyro characters are present{hasPyroResonance ? "." : " (not active for this team)."} Bennett&apos;s Fantastic Voyage Burst is selectable as a character action and applies its level- and constellation-based ATK buff for 12s (C0 requires the target to be above 70% HP; C1 removes that requirement and adds 20% base ATK). Noblesse Oblige grants 20% Burst DMG to its wearer and its 4-piece ATK buff on any wearer&apos;s Burst. Tenacity of the Millelith grants the party 20% ATK for 3s after its wearer&apos;s Skill hits. Thrilling Tales activates on a switch from its holder.
            {" "}Chevreuse&apos;s overload effects activate only when the party contains Pyro and Electro and no other elements: mark an Overloaded hit to apply 40% Pyro/Electro RES reduction for 6s, then use Chevreuse&apos;s Skill to fire the ready Overcharged Ball and grant up to 40% ATK based on her Max HP for 30s. Her C6 DMG bonus follows the Skill&apos;s healing intervals and is granted to the character on-field at each pulse. Fragment of Harmonic Whimsy gains 18% DMG per Bond of Life change, up to 3 stacks for 6s.
            {" "}For Arlecchino, All Is Ash automatically applies one mark to the default single target; after 5s it becomes a Due (130% BoL on absorption, otherwise 65%) and expires after 30s. Her collection cap is 145% per Skill use. Masque activates at 30% BoL, adds the talent-level extra damage to Normal Attacks (doubled at C1), and each Normal hit consumes 7.5% of current BoL. Crimson Moon&apos;s Semblance also grants up to 25% BoL on a Charged Attack hit (14s cooldown).
          </p>
        )}
      </section>

      {members.length > 0 && (
        <>
          <section className="loadout-panel dps-panel">
            <div className="loadout-panel-heading">
              <div>
                <p className="eyebrow"><span>ROTATION TIMELINE</span></p>
                <h2>Enter the action sequence</h2>
              </div>
              <button className="loadout-submit" onClick={addAction} type="button">Add action</button>
            </div>
            <p className="dps-data-note">
              Talent values and action descriptions come from the character archive. Action frames are filled automatically for Arlecchino, Fischl, Chevreuse, and Bennett when timing data is available; select Manual override to change them. Arlecchino&apos;s Charged Attack timing distinguishes neutral casts from Normal/Skill cancels. Switching to a different character adds 30 frames (0.5 seconds) to the rotation and advances buff durations and summon ticks. Action frames also advance weapon stacks, Chevreuse C6 healing stacks, and Arlecchino&apos;s mark maturation. Yae Miko&apos;s Sesshou Sakura, Qiqi&apos;s Herald of Frost, Fischl&apos;s Oz, Durin&apos;s Dragon, and Ineffa&apos;s Birgitta deal damage automatically at their modeled intervals while summoned. Elemental application and reactions follow the character-specific ICD rules in the application rules module; hits show their applied gauge, ICD-blocked status, and any triggered reaction. The selected reaction assumes its enemy aura is available. {hasCryoResonance && "Two Cryo characters grant +15% CRIT Rate to the team in this model."} Bennett&apos;s Burst self-applies 1U Pyro at one-second intervals while its field is active. Weapon buffs have their own result section, separate from support buffs and character self-effects. Homa&apos;s low-HP condition, Vortex Vanquisher&apos;s shield condition, Dragon&apos;s Bane&apos;s enemy aura, and Deathmatch&apos;s nearby enemy count are configurable; unsupported effects are called out rather than assumed.
            </p>
            <div className="optimizer-save-row dps-rotation-save-row">
              <label className="loadout-field">
                <span>Rotation preset name</span>
                <input
                  maxLength={60}
                  onChange={(event) => setRotationName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveCurrentRotation();
                    }
                  }}
                  placeholder="e.g. Chevreuse overload rotation"
                  value={rotationName}
                />
              </label>
              <button
                className="loadout-submit"
                disabled={!actions.length}
                onClick={saveCurrentRotation}
                type="button"
              >
                Save rotation
              </button>
            </div>
            {currentRotationPresets.length > 0 ? (
              <ul className="optimizer-preset-list dps-rotation-preset-list">
                {currentRotationPresets.map((rotation) => (
                  <li key={rotation.id}>
                    <div>
                      <b>{rotation.name}</b>
                      <small>{rotation.actions.length} action(s)</small>
                    </div>
                    <div>
                      <button
                        className="optimizer-text-button"
                        onClick={() => loadRotation(rotation)}
                        type="button"
                      >
                        Load
                      </button>
                      <button
                        aria-label={`Delete ${rotation.name}`}
                        className="optimizer-text-button remove"
                        onClick={() => deleteRotation(rotation)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="optimizer-no-presets">
                Saved rotations are kept on this device and are specific to the selected team.
              </p>
            )}
            <div className="dps-enemy-fields">
              <label className="loadout-field">
                <span>Enemy level</span>
                <input min="1" max="200" onChange={(event) => setEnemyLevel(event.target.value)} type="number" value={enemyLevel} />
              </label>
              <label className="loadout-field">
                <span>Enemy DEF reduction (%)</span>
                <input min="0" max="100" onChange={(event) => setEnemyDefenseReduction(event.target.value)} type="number" value={enemyDefenseReduction} />
              </label>
              <label className="loadout-field">
                <span>Enemy resistance (%)</span>
                <input min="-100" max="100" onChange={(event) => setEnemyResistance(event.target.value)} type="number" value={enemyResistance} />
              </label>
              <label className="loadout-field">
                <span>Nearby opponents (Deathmatch)</span>
                <input min="1" max="20" onChange={(event) => setEnemyCount(Number(event.target.value))} type="number" value={enemyCount} />
              </label>
            </div>
            {!actions.length ? (
              <p className="optimizer-no-presets">Add actions in execution order to form the rotation.</p>
            ) : (
              <ol className="dps-action-list">
                {actions.map((action, index) => {
                  const member = members.find((entry) => entry.index === action.memberIndex) || members[0];
                  const actionGroups = getRotationActionGroups(member.character);
                  const actionType = getRotationActionType(action, member);
                  const selectedActionGroup = actionGroups.find(
                    (group) => group.key === actionType,
                  ) || actionGroups.find((group) =>
                    group.actions.some((talent) => talent.key === action.talentKey),
                  ) || actionGroups[0];
                  const talentActions = selectedActionGroup?.actions || [];
                  const selectedTalentAction = getRotationTalentAction(
                    action,
                    member,
                    index,
                    actions,
                    raidenRules.isRaidenShogun(member.character) &&
                      raidenRules.isBurstActiveInRotation(actions, index, member),
                  );
                  const frameContext = resolveActionFrameContext(
                    action,
                    member,
                    selectedTalentAction,
                    actions[index - 1],
                    members,
                  );
                  const timing = getActionFrameData(
                    member.character,
                    selectedTalentAction || {},
                    frameContext,
                  );
                  const displayedFrames = action.frameMode === "automatic"
                    ? timing?.frames || ""
                    : action.frames;
                  const fullStringFrames = getFullNormalStringFrames(member.character);
                  const isNormalHit = /^([1-6])-Hit DMG$/i.test(
                    selectedTalentAction?.name || "",
                  );
                  return (
                    <li className="dps-action-row" key={index}>
                      <span className="dps-action-number">{String(index + 1).padStart(2, "0")}</span>
                      <label className="loadout-field">
                        <span>Character</span>
                        <select onChange={(event) => {
                          const memberIndex = Number(event.target.value);
                          const nextMember = members.find((entry) => entry.index === memberIndex);
                          const nextGroup = getRotationActionGroups(nextMember.character)[0];
                          const talentAction = nextGroup?.actions[0];
                          const automaticFrames = getAutomaticFrames(
                            nextMember.character,
                            talentAction,
                          );
                          updateAction(index, {
                            memberIndex,
                            actionType: nextGroup?.key || "",
                            normalHitMode: "automatic",
                            talentKey: talentAction?.key || "",
                            frames: automaticFrames,
                            frameMode: automaticFrames ? "automatic" : "manual",
                            chargedAttackContext: "auto",
                          });
                        }} value={action.memberIndex}>
                          {members.map((entry) => <option key={entry.index} value={entry.index}>{entry.character.name}</option>)}
                        </select>
                      </label>
                      <label className="loadout-field">
                        <span>In-game action</span>
                        <select onChange={(event) => {
                          const nextGroup = actionGroups.find(
                            (group) => group.key === event.target.value,
                          );
                          const talentAction = nextGroup?.actions[0];
                          const automaticFrames = getAutomaticFrames(
                            member.character,
                            talentAction,
                            action.chargedAttackContext,
                          );
                          updateAction(index, {
                            actionType: event.target.value,
                            normalHitMode: "automatic",
                            talentKey: talentAction?.key || "",
                            frames: automaticFrames,
                            frameMode: automaticFrames ? "automatic" : "manual",
                          });
                        }} value={actionType || selectedActionGroup?.key || ""}>
                          {actionGroups.map((group) => (
                            <option key={group.key} value={group.key}>{group.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="loadout-field">
                        <span>Damage hit</span>
                        <select onChange={(event) => {
                          const talentAction = getTalentActionByKey(
                            member.character,
                            event.target.value,
                          );
                          const automaticFrames = getAutomaticFrames(
                            member.character,
                            talentAction,
                            action.chargedAttackContext,
                          );
                          updateAction(index, {
                            talentKey: event.target.value,
                            normalHitMode: actionType === "normal"
                              ? "manual"
                              : action.normalHitMode,
                            frames: automaticFrames,
                            frameMode: automaticFrames ? "automatic" : "manual",
                          });
                        }} value={selectedTalentAction?.key || action.talentKey}>
                          {talentActions.map((talent) => <option key={talent.key} value={talent.key}>
                            {talentActions.filter((entry) => entry.name === talent.name).length > 1
                              ? `${talent.name} · ${talent.talentName}`
                              : talent.name}
                          </option>)}
                        </select>
                      </label>
                      <label className="loadout-field">
                        <span>Scaling</span>
                        <select onChange={(event) => updateAction(index, { scaling: event.target.value })} value={action.scaling}>
                          <option value="atk">ATK</option><option value="hp">HP</option><option value="def">DEF</option><option value="eleMas">EM</option>
                        </select>
                      </label>
                      <label className="loadout-field">
                        <span>Talent level</span>
                        <input min="1" max="13" onChange={(event) => updateAction(index, { talentLevel: Number(event.target.value) })} type="number" value={action.talentLevel || 10} />
                      </label>
                      <label className="loadout-field">
                        <span>Hits</span>
                        <input min="1" max="100" onChange={(event) => updateAction(index, { hits: Number(event.target.value) })} type="number" value={action.hits} />
                      </label>
                      {member.character.name === "Arlecchino" &&
                        /^Charged Attack DMG$/i.test(selectedTalentAction?.name || "") && (
                        <label className="loadout-field">
                          <span>Charged Attack start</span>
                          <select onChange={(event) => {
                            const chargedAttackContext = event.target.value;
                            const frames = getAutomaticFrames(
                              member.character,
                              selectedTalentAction,
                              chargedAttackContext,
                            );
                            updateAction(index, {
                              chargedAttackContext,
                              ...(action.frameMode === "automatic" ? { frames } : {}),
                            });
                          }} value={action.chargedAttackContext}>
                            <option value="auto">Automatic from rotation</option>
                            <option value="neutral">Neutral cast (58 frames)</option>
                            <option value="cancel">Normal/Skill cancel (46 frames)</option>
                          </select>
                        </label>
                      )}
                      {timing && (
                        <label className="loadout-field">
                          <span>Timing mode</span>
                          <select onChange={(event) => {
                            const frameMode = event.target.value;
                            updateAction(index, {
                              frameMode,
                              frames: frameMode === "automatic"
                                ? timing.frames
                                : displayedFrames || action.frames,
                            });
                          }} value={action.frameMode}>
                            <option value="automatic">Automatic</option>
                            <option value="manual">Manual override</option>
                          </select>
                        </label>
                      )}
                      <label className="loadout-field">
                        <span>Duration (frames){action.frameMode === "automatic" ? " · automatic" : ""}</span>
                        <input
                          min="1"
                          max="3600"
                          onChange={(event) => updateAction(index, {
                            frames: Number(event.target.value),
                            frameMode: "manual",
                          })}
                          readOnly={action.frameMode === "automatic"}
                          type="number"
                          value={displayedFrames}
                        />
                      </label>
                      {isNormalHit && fullStringFrames && (
                        <small className="dps-data-note">
                          Full normal string: {fullStringFrames} frames
                        </small>
                      )}
                      <label className="loadout-field">
                        <span>Reaction type</span>
                        <select onChange={(event) => updateAction(index, { reaction: event.target.value })} value={action.reaction}>
                          {REACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      {action.reaction === "stellarConduct" && (
                        <small className="dps-data-note">
                          Requires a Cryo/Electro damage hit and Sandrone, Odette, or Traveler in the team.
                          Polestar stacks track Cryo/Electro hits in a rolling 4s window.
                        </small>
                      )}
                      <button aria-label={`Remove action ${index + 1}`} className="optimizer-delete-button" onClick={() => setActions((current) => current.filter((_, actionIndex) => actionIndex !== index))} type="button">Remove</button>
                    </li>
                  );
                })}
              </ol>
            )}
            {rotationTimeline.length > 0 && (
              <div className="dps-hit-timeline" aria-label="Hit and reaction timeline">
                <div className="dps-hit-timeline-heading">
                  <div>
                    <p className="eyebrow"><span>ROTATION EVENTS</span></p>
                    <h3>Hit &amp; reaction timeline</h3>
                  </div>
                  <span>{rotationTimeline.length} event(s)</span>
                </div>
                <ol className="dps-hit-timeline-list">
                  {rotationTimeline.map((event) => {
                    const applications = event.applicationEvents.filter(Boolean);
                    const applied = applications.filter((application) =>
                      application.reason === "applied");
                    const blocked = applications.some((application) =>
                      application.reason === "icd");
                    const reactionLabel = REACTIONS.find(
                      ([value]) => value === event.reaction,
                    )?.[1];
                    return (
                      <li
                        className={`dps-hit-timeline-event${event.reaction ? " has-reaction" : ""}`}
                        key={event.resultKey}
                      >
                        <time>{formatNumber(event.time, 2)}s</time>
                        <span className="dps-hit-timeline-marker" aria-hidden="true" />
                        <div className="dps-hit-timeline-content">
                          <b>{event.memberName} · {event.source}</b>
                          {event.actionMarker && (
                            <span className="dps-hit-timeline-muted">
                              {event.timelineNote}
                            </span>
                          )}
                          {event.hitNumber > 0 && <span>Hit {event.hitNumber}</span>}
                          {event.damage > 0 && <span>{formatNumber(event.damage)} damage</span>}
                          {event.concurrent && (
                            <span className="dps-hit-timeline-muted">
                              Concurrent off-field tick · no added rotation time
                            </span>
                          )}
                          {applied.length > 0 && (
                            <span className="dps-hit-timeline-application">
                              {applied.map((application) =>
                                `${application.gauge}U${application.gauge >= 2 ? " strong" : ""} ${application.element}`,
                              ).join(" + ")} applied
                            </span>
                          )}
                          {blocked && (
                            <span className="dps-hit-timeline-muted">
                              Element application blocked by ICD
                            </span>
                          )}
                          {!event.actionMarker && !applied.length && !blocked && (
                            <span className="dps-hit-timeline-muted">
                              {applications.some((application) =>
                                application.reason === "no-application")
                                ? "No elemental application (0U)"
                                : applications.some((application) =>
                                  application.reason === "no-element")
                                  ? "Physical / non-elemental hit"
                                  : "No elemental application recorded"}
                            </span>
                          )}
                          {event.actionMarker
                            ? null
                            : reactionLabel
                            ? <strong className="dps-hit-timeline-reaction">{reactionLabel}</strong>
                            : <span className="dps-hit-timeline-muted">
                              {event.actionReaction && event.actionReaction !== "none" && blocked
                                ? "No reaction · ICD prevented application"
                                : event.actionReaction && event.actionReaction !== "none" && applied.length
                                  ? "No reaction · aura / reaction result not simulated"
                                  : applied.length
                                    ? "Element applied · no reaction selected"
                                    : event.actionReaction && event.actionReaction !== "none"
                                      ? "No reaction · no elemental application"
                                      : "No reaction selected"}
                            </span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>

          <section className="loadout-panel dps-results">
            <div className="loadout-panel-heading">
              <div>
                <p className="eyebrow"><span>ESTIMATED ROTATION OUTPUT</span></p>
                <h2>{formatNumber(totalDamage)} crit damage</h2>
              </div>
              <b>{hasCompleteTiming && totalDuration
                ? `${formatNumber(totalDamage / totalDuration)} DPS`
                : actions.length ? "Frame timings required for DPS" : "Add actions to calculate DPS"}</b>
            </div>
            {displayResults.map((result, index) => (
              <div className="dps-result-row" key={`${result.action.memberIndex}-${index}`}>
                <span>
                  {index + 1}. {result.automaticSummon
                    ? `Off-field · ${result.automaticSummon} · `
                    : ""}
                  {result.member.character.name} · {result.talentAction.name}
                </span>
                <span>{result.isOdetteCoda
                  ? `${result.stellarConductHits.length} delayed Stellar hit(s)`
                  : `${formatNumber(result.multiplier * 100, 1)}% × ${result.action.hits} hit(s)`}</span>
                <b>
                  {formatNumber(result.total)} · {result.automaticSummon
                    ? `at ${formatNumber(result.actionStartTime, 2)}s`
                    : Number(result.action.frames) > 0
                      ? `${formatNumber(result.duration * result.action.hits, 2)}s`
                      : "timing missing"}
                </b>
                <small>
                  Crit hit · {formatNumber(result.total)} damage
                </small>
                {result.reactionHitIndexes?.length > 0 && (
                  <small>
                    {result.stellarConductHits?.length
                      ? "Stellar-Conduct"
                      : REACTIONS.find(([value]) => value === result.action.reaction)?.[1] ||
                        result.action.reaction} on hit{result.reactionHitIndexes.length > 1 ? "s" : ""}{" "}
                    {result.reactionHitIndexes.join(", ")}
                  </small>
                )}
                {result.stellarConductHits?.map((hit) => (
                  <small key={`stellar-conduct-${hit.hitNumber}`}>
                    Stellar-Conduct · {formatNumber(hit.critDamage)} crit /
                    {" "}{formatNumber(hit.averageDamage)} average ·
                    {" "}{hit.polestarStacks} Polestar stack(s) ·
                    {" "}×{formatNumber(hit.polestarMultiplier, 2)}
                  </small>
                ))}
                {result.elementalApplicationEvents?.map((event, eventIndex) => (
                  <small key={`application-${eventIndex}`}>
                    {event.source} · hit {event.hitNumber}
                    {event.strikeNumber > 1 ? `, strike ${event.strikeNumber}` : ""}
                    {" "}at {formatNumber(event.time, 2)}s:{" "}
                    {event.reason === "applied"
                      ? `${event.gauge}U${event.gauge >= 2 ? " Strong" : ""} ${event.element} applied`
                      : event.reason === "icd"
                        ? `${event.element} application blocked by ICD (0U)`
                        : "0U · no elemental application"}
                    {event.reaction
                      ? ` · ${REACTIONS.find(([value]) => value === event.reaction)?.[1] || event.reaction}`
                      : ""}
                  </small>
                ))}
                {result.fieldSelfApplication && (
                  <small>
                    Bennett Burst self-applies {result.fieldSelfApplication.gauge}U {result.fieldSelfApplication.element}
                    {" "}to the active character every {result.fieldSelfApplication.interval}s
                    {" "}({formatNumber(result.fieldSelfApplication.startsAt, 2)}–{formatNumber(result.fieldSelfApplication.expiresAt, 2)}s);
                    {" "}self-application, not an enemy hit or additional rotation time.
                  </small>
                )}
                <small>
                  {result.damageElement} · ATK {formatNumber(result.effectiveAttack)}
                  {result.resonanceAttack ? ` (Pyro resonance +${formatNumber(result.resonanceAttack)})` : ""}
                  {result.supportFlatAttack ? ` · Support flat ATK +${formatNumber(result.supportFlatAttack)}` : ""}
                  {result.supportAttackPercent ? ` · Support ATK% +${formatNumber(result.supportAttackPercent, 1)}%` : ""}
                  {result.weaponAttackPercent ? ` · Weapon ATK% +${formatNumber(result.weaponAttackPercent, 1)}%` : ""}
                  {result.weaponFlatAttack ? ` · Weapon flat ATK +${formatNumber(result.weaponFlatAttack)}` : ""}
                  {result.weaponElementalMastery ? ` · Weapon EM +${formatNumber(result.weaponElementalMastery)}` : ""}
                  {" "}· DMG Bonus {formatNumber(result.damageBonus, 1)}%
                  {result.resistanceShred
                    ? ` · Enemy RES ${formatNumber(result.effectiveEnemyResistance, 1)}% (−${formatNumber(result.resistanceShred, 1)}% shred)`
                    : ""}
                  {isArlecchino(result.member.character)
                    ? ` · BoL ${formatNumber(result.bondOfLifeBefore, 1)}% → ${formatNumber(result.bondOfLifeAtDamage, 1)}% at hit → ${formatNumber(result.bondOfLifeAfter, 1)}%`
                    : ""}
                  {result.masqueExtra
                    ? ` · Masque base scaling ${formatNumber(result.masqueExtra)} included in hit total`
                    : ""}
                </small>
                {result.damageBonusBreakdowns?.map((breakdown) => {
                  const sourceLabels = {
                    build: "Build",
                    support: "Support",
                    selfAndSets: "Self / sets",
                    burst: "Burst",
                    weapon: "Weapon",
                    characterPassive: "Character passive",
                  };
                  const sources = Object.entries(breakdown.sources)
                    .filter(([, value]) => value)
                    .map(([source, value]) =>
                      `${sourceLabels[source] || source} ${formatNumber(value, 1)}%`);
                  return (
                    <small key={`dmg-bonus-${breakdown.hitNumber}`}>
                      DMG Bonus sources · hit {breakdown.hitNumber}:{" "}
                      {sources.join(" + ")} = {formatNumber(breakdown.total, 1)}%
                    </small>
                  );
                })}
                <div className="dps-effect-log">
                  <div>
                    <b>Support buffs on {result.member.character.name}</b>
                    {result.activeSupportEffects.filter((effect) =>
                      !effect.source.startsWith("Thrilling Tales")).length
                      ? result.activeSupportEffects.filter((effect) =>
                        !effect.source.startsWith("Thrilling Tales")).map((effect, effectIndex) => (
                        <span key={`active-${effectIndex}`}>
                          {effect.source}: +{formatNumber(effect.value, 1)}{effect.stat === "flat ATK" ? " ATK" : "%"} · {formatNumber(Math.max(0, effect.expiresAt - result.actionStartTime), 1)}s remaining
                        </span>
                      ))
                      : <span>None active</span>}
                    {result.activatedSupportEffects.filter((effect) =>
                      !effect.includes("Thrilling Tales")).map((effect, effectIndex) => (
                      <span className="dps-effect-trigger" key={`trigger-${effectIndex}`}>Activated: {effect}</span>
                    ))}
                  </div>
                  <div>
                    <b>Self effects / equipped effects</b>
                    {result.selfEffects.length
                      ? result.selfEffects.map((effect, effectIndex) => (
                        <span className={effect.applied
                          ? "dps-effect-applied"
                          : effect.modeled ? "dps-effect-inactive" : "dps-effect-unmodeled"} key={`self-${effectIndex}`}>
                          {effect.source}: {effect.description} ({effect.status || (effect.applied ? "applied" : effect.modeled ? "inactive" : "not modeled")})
                        </span>
                      ))
                      : <span>No tracked self effect</span>}
                  </div>
                  <div>
                    <b>Weapon buffs</b>
                    {result.weaponEffects.length ||
                    result.activeSupportEffects.some((effect) => effect.source.startsWith("Thrilling Tales"))
                      ? <>
                        {result.weaponEffects.map((effect, effectIndex) => (
                        <span className={effect.applied
                          ? "dps-effect-applied"
                          : effect.modeled ? "dps-effect-inactive" : "dps-effect-unmodeled"} key={`weapon-${effectIndex}`}>
                          {effect.source}: {effect.description} ({effect.status || (effect.applied ? "applied" : effect.modeled ? "inactive/trigger condition" : "not modeled")})
                        </span>
                        ))}
                        {result.activeSupportEffects.filter((effect) =>
                          effect.source.startsWith("Thrilling Tales")).map((effect, effectIndex) => (
                          <span className="dps-effect-applied" key={`tt-active-${effectIndex}`}>
                            {effect.source}: +{formatNumber(effect.value, 1)}% ATK · {formatNumber(Math.max(0, effect.expiresAt - result.actionStartTime), 1)}s remaining
                          </span>
                        ))}
                        {result.activatedSupportEffects.filter((effect) =>
                          effect.includes("Thrilling Tales")).map((effect, effectIndex) => (
                          <span className="dps-effect-trigger" key={`tt-trigger-${effectIndex}`}>{effect}</span>
                        ))}
                      </>
                      : <span>No weapon effect data</span>}
                  </div>
                  {result.bondEvents.map((event, eventIndex) => (
                    <span className="dps-effect-trigger" key={`bond-${eventIndex}`}>{event}</span>
                  ))}
                  {result.enemyEvents.map((event, eventIndex) => (
                    <span className="dps-effect-trigger" key={`enemy-${eventIndex}`}>{event}</span>
                  ))}
                </div>
              </div>
            ))}
            <p className="optimizer-method-note">
              Displayed damage assumes every talent hit is a CRIT, using the character&apos;s CRIT DMG. Transformative reaction damage does not CRIT, consistent with the game&apos;s damage rules. Results include talent scaling, enemy DEF/RES, timed support buffs, Golden Troupe Skill DMG bonuses (including its off-field bonus and 2s on-field grace period), Tenacity and Noblesse set triggers, Chevreuse overload resistance shred/ATK buff/C6 DMG buff when triggered, and Fragment of Harmonic Whimsy stacks when Bond of Life changes. Raiden Shogun&apos;s modeled effects include Resolve scaling from party Bursts, Musou Isshin attacks, Eye of Stormy Judgment coordinated hits and Burst DMG buffs, Enlightened One, Engulfing Lightning, The Catch, and Emblem of Severed Fate. Stellar-Conduct hits account for Polestar Field stack scaling and Electro/Cryo DMG bonuses; Disenchantment in Deep Shadow and Heart of the Furnace reaction buffs are applied when their triggers are met. Yae Miko&apos;s Sesshou Sakura, Qiqi&apos;s Herald of Frost, Fischl&apos;s Oz, Durin&apos;s Dragon, and Ineffa&apos;s Birgitta hits are added automatically at their configured intervals while summoned. Arlecchino&apos;s single-target mark matures from Directive to Due after five seconds.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
