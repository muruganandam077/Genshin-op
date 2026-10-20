import { getTalentMultiplier } from "../../dpsDamageTalents.js";

export function isRaidenShogun(character) {
  return character?.name === "Raiden Shogun";
}

export function getTalentAttributeValue(character, talentName, attributeName, level = 10) {
  const talentIndex = character.combatTalents?.findIndex(
    (talent) => talent.name === talentName,
  ) ?? -1;
  if (talentIndex < 0) return 0;
  const talent = character.combatTalents[talentIndex];
  const attributeIndex = talent.attributes?.labels?.findIndex((entry) =>
    entry.startsWith(`${attributeName}|`)) ?? -1;
  if (attributeIndex < 0) return 0;
  return getTalentMultiplier(character, { talentIndex, attributeIndex }, level);
}

export function getBurstEnergyCost(character) {
  const burst = character.combatTalents?.find((talent) =>
    talent.slot === "combat3");
  const label = burst?.attributes?.labels?.find((entry) =>
    entry.startsWith("Energy Cost|"));
  const parameterKey = label?.match(/\{param(\d+):[^}]+\}/)?.[1];
  if (!parameterKey) return 0;
  const values = burst.attributes.parameters?.[`param${parameterKey}`] || [];
  return values[Math.min(9, values.length - 1)] || 0;
}

export function getResolveDamageBonus(character, talentAction, level, stacks) {
  if (!isRaidenShogun(character) ||
      talentAction.name !== "Musou no Hitotachi Base DMG") return 0;
  const talent = character.combatTalents?.[talentAction.talentIndex];
  const resolveLabel = talent?.attributes?.labels?.find((entry) =>
    entry.startsWith("Resolve Bonus|")) || "";
  const parameterKeys = [...resolveLabel.matchAll(/\{param(\d+):[^}]+\}/g)]
    .map((match) => match[1]);
  const resolveValues = parameterKeys.map((key) => {
    const values = talent.attributes.parameters?.[`param${key}`] || [];
    return values[Math.min(level - 1, values.length - 1)] || 0;
  });
  return (resolveValues[0] || 0) + (resolveValues[1] || 0) * stacks;
}

export function isBurstOpeningHit(character, talentAction) {
  return isRaidenShogun(character) &&
    talentAction.talentName === "Secret Art: Musou Shinsetsu" &&
    talentAction.name === "Musou no Hitotachi Base DMG";
}

export function getElectroDamageBonus(character, energyRecharge) {
  return isRaidenShogun(character)
    ? Math.max(0, energyRecharge - 100) * 0.4
    : 0;
}

export function getNormalAttackType(character, talentAction) {
  if (!isRaidenShogun(character)) return null;
  if (/^\d+-Hit DMG$/i.test(talentAction.name)) {
    return "normal";
  }
  if (/^Charged Attack DMG$/i.test(talentAction.name)) return "charged";
  if (/^(?:Plunge DMG|Low\/High Plunge DMG)$/i.test(talentAction.name)) {
    return "plunge";
  }
  return null;
}

function getTalentActionByKey(character, talentKey) {
  return character.combatTalents?.flatMap((talent, talentIndex) =>
    (talent.attributes?.labels || []).map((entry, attributeIndex) => ({
      key: `${talentIndex}:${attributeIndex}`,
      talentIndex,
      talentName: talent.name,
      name: entry.split("|")[0],
    })),
  ).find((entry) => entry.key === talentKey);
}

export function isBurstActiveInRotation(actions, actionIndex, member) {
  let burstActionIndex = -1;
  for (let index = actionIndex - 1; index >= 0; index -= 1) {
    const action = actions[index];
    if (action.memberIndex !== member.index) return false;
    const talentAction = getTalentActionByKey(member.character, action.talentKey);
    if (isBurstOpeningHit(member.character, talentAction || {})) {
      burstActionIndex = index;
      break;
    }
  }
  if (burstActionIndex < 0) return false;
  const elapsedFrames = actions.slice(burstActionIndex, actionIndex)
    .reduce((total, action) => total + (Number(action.frames) || 60), 0);
  return elapsedFrames <= 7 * 60;
}

export function getInBurstAttack(character, group, active, sequenceIndex = 0) {
  if (!isRaidenShogun(character) || !active) return null;
  const burstSlot = character.combatTalents?.findIndex(
    (talent) => talent.slot === "combat3",
  );
  const burstActions = group.actions.filter((action) =>
    action.talentIndex === burstSlot &&
    (group.key === "normal"
      ? /^\d+-Hit DMG$/i.test(action.name)
      : group.key === "charged"
        ? /^Charged Attack DMG$/i.test(action.name)
        : group.key === "plunge" &&
          /^(?:Plunge DMG|Low\/High Plunge DMG)$/i.test(action.name)),
  );
  return burstActions.length
    ? burstActions[sequenceIndex % burstActions.length]
    : null;
}

export function getCoordinatedAttack(character) {
  return character.combatTalents?.flatMap((talent, talentIndex) =>
    (talent.attributes?.labels || []).map((entry, attributeIndex) => ({
      key: `${talentIndex}:${attributeIndex}`,
      talentIndex,
      attributeIndex,
      talentName: talent.name,
      name: entry.split("|")[0],
    })),
  ).find((action) =>
    action.talentName === "Transcendence: Baleful Omen" &&
    action.name === "Coordinated ATK DMG");
}

export function isCoordinatedAttack(character, talentAction) {
  return isRaidenShogun(character) &&
    talentAction.talentName === "Transcendence: Baleful Omen" &&
    talentAction.name === "Coordinated ATK DMG";
}

export function getEyeBurstDamageBonus(character, burstCharacter, skillLevel) {
  return getTalentAttributeValue(
    character,
    "Transcendence: Baleful Omen",
    "Elemental Burst DMG Bonus",
    skillLevel,
  ) * getBurstEnergyCost(burstCharacter);
}

export function calculateCoordinatedAttack({
  calculateDamage,
  member,
  talentAction,
  action,
  talentLevel,
  activeBuffs,
  weaponEffects,
  enemyLevel,
  enemyResistance,
  resistanceShredByElement,
  enemyDefenseReduction,
  enemyDamageTakenBonus = 0,
}) {
  const stats = {
    ...member.stats,
    attack: member.stats.attack +
      member.stats.baseAttack * weaponEffects.attackPercent / 100 +
      weaponEffects.flatAttack +
      activeBuffs.filter((buff) => buff.stat === "flat ATK")
        .reduce((total, buff) => total + buff.value, 0) +
      member.stats.baseAttack * activeBuffs
        .filter((buff) => buff.stat === "atkPercent")
        .reduce((total, buff) => total + buff.value, 0) / 100,
    energyRecharge: member.stats.energyRecharge +
      (weaponEffects.energyRecharge || 0),
  };
  const supportDamageBonuses = {
    all: activeBuffs.filter((buff) => buff.stat === "allDamageBonus")
      .reduce((total, buff) => total + buff.value, 0),
    electro: activeBuffs.filter((buff) => buff.stat === "electroDamageBonus")
      .reduce((total, buff) => total + buff.value, 0),
  };
  const hit = calculateDamage(
    stats,
    action,
    member.character,
    talentAction,
    talentLevel,
    enemyLevel,
    enemyResistance,
    {
      supportDamageBonuses,
      weaponDamageBonuses: weaponEffects.damageBonuses,
      resistanceShredByElement,
      enemyDefenseReduction,
      enemyDamageTakenBonus,
    },
  );
  return { stats, hit };
}

export function getResolveGain(raiden, burstCharacter) {
  const constellationBonus = raiden.settings.constellation >= 1
    ? burstCharacter.element === "Electro" ? 1.8 : 1.2
    : 1;
  return getBurstEnergyCost(burstCharacter) * 0.2 * constellationBonus;
}

export function applyResolveGain(state, raidenIndex, amount) {
  state.resolveStacks.set(
    raidenIndex,
    Math.min(60, (state.resolveStacks.get(raidenIndex) || 0) + amount),
  );
}

export function handleBurstAction(state, member, raidenMembers) {
  if (!member.character.combatTalents?.some((talent) =>
    talent.slot === "combat3") || state.burstUsedByMember.has(member.index)) {
    return 0;
  }

  const openingHit = getTalentActionByKey(
    member.character,
    `${member.character.combatTalents.findIndex((talent) =>
      talent.slot === "combat3")}:0`,
  );
  if (isBurstOpeningHit(member.character, openingHit || {})) {
    state.burstUsedByMember.add(member.index);
    return consumeResolve(state, member.index);
  }

  if (isRaidenShogun(member.character)) return 0;
  raidenMembers.forEach((raiden) => {
    applyResolveGain(
      state,
      raiden.index,
      getResolveGain(raiden, member.character),
    );
  });
  state.burstUsedByMember.add(member.index);
  return 0;
}

export function consumeResolve(state, raidenIndex) {
  const stacks = state.resolveStacks.get(raidenIndex) || 0;
  state.resolveStacks.set(raidenIndex, 0);
  return stacks;
}

export function activateEye(state, memberIndex, time, duration) {
  state.eyeExpiresAt.set(memberIndex, time + duration);
}

export function getActiveEyeMember(state, members, time) {
  return members.find((member) =>
    isRaidenShogun(member.character) &&
    (state.eyeExpiresAt.get(member.index) || 0) > time &&
    (state.eyeLastProcAt.get(member.index) === undefined ||
      time - state.eyeLastProcAt.get(member.index) >= 0.9));
}

export function recordEyeAttack(state, memberIndex, time) {
  state.eyeLastProcAt.set(memberIndex, time);
}

export function createState() {
  return {
    resolveStacks: new Map(),
    eyeExpiresAt: new Map(),
    eyeLastProcAt: new Map(),
    burstUsedByMember: new Set(),
  };
}

export function getDamageDetails({ character, stats }) {
  return {
    scalingValue: null,
    arlecchinoNormal: false,
    masqueActive: false,
    masqueExtra: 0,
    damageElement: character.element,
    passiveDamageBonus: getElectroDamageBonus(
      character,
      stats.energyRecharge || 100,
    ),
  };
}
