function refinementValues(weapon, refinement) {
  const entry = weapon?.refinements?.find((value) => value.rank === refinement);
  return (entry?.values || []).map((value) => Number.parseFloat(String(value)) || 0);
}

function isElementalSkill(member, talentAction) {
  return member.character.combatTalents?.[talentAction.talentIndex]?.slot === "combat2";
}

function isElementalBurst(member, talentAction) {
  return member.character.combatTalents?.[talentAction.talentIndex]?.slot === "combat3";
}

function getBurstEnergyCost(character) {
  const burst = character.combatTalents?.find((talent) => talent.slot === "combat3");
  const label = burst?.attributes?.labels?.find((entry) => entry.startsWith("Energy Cost|"));
  const parameter = label?.match(/\{param(\d+):[^}]+\}/);
  if (!parameter) return 0;
  return burst.attributes.parameters?.[`param${parameter[1]}`]?.[0] || 0;
}

export function createWeaponBuffState() {
  return {
    jadeHits: new Map(),
    vortexHits: new Map(),
    scarletStacks: new Map(),
    calamitySkills: new Map(),
    missiveExpiresAt: new Map(),
    lastHitTimes: new Map(),
  };
}

export function getWeaponHitEffects({
  member,
  members,
  talentAction,
  action,
  time,
  bondOfLifePercent,
  enemyCount = 1,
  shielded = false,
  enemyAffectedByPyroHydro = false,
  state,
}) {
  const weapon = member.weapon;
  if (!weapon) return { attackPercent: 0, flatAttack: 0, elementalMastery: 0, damageBonuses: {}, entries: [] };
  const values = refinementValues(weapon, member.settings.refinement);
  const entries = [];
  const damageBonuses = {};
  let attackPercent = 0;
  let flatAttack = 0;
  let elementalMastery = 0;
  const addDamage = (type, value) => {
    damageBonuses[type] = (damageBonuses[type] || 0) + value;
  };

  switch (weapon.name) {
    case "Crimson Moon's Semblance": {
      const hasBond = bondOfLifePercent > 0;
      const bonus = hasBond ? values[0] + (bondOfLifePercent >= 30 ? values[1] || 0 : 0) : 0;
      addDamage("all", bonus);
      entries.push({
        source: weapon.name,
        description: hasBond
          ? `+${bonus}% DMG while Bond of Life is present${bondOfLifePercent >= 30 ? " (30% threshold bonus included)" : ""}`
          : `No DMG bonus; Bond of Life is ${bondOfLifePercent}%`,
        applied: bonus > 0,
        modeled: true,
      });
      break;
    }
    case "Staff of the Scarlet Sands": {
      const stacks = (state.scarletStacks.get(member.index) || []).filter((expiry) => expiry > time).length;
      flatAttack += member.stats.elementalMastery * ((values[0] + stacks * (values[1] || 0)) / 100);
      entries.push({
        source: weapon.name,
        description: `Bonus ATK from ${values[0]}% of EM${stacks ? ` + ${stacks} Skill-hit stack(s) at ${values[1]}% EM each` : ""}`,
        applied: true,
        modeled: true,
      });
      break;
    }
    case "Primordial Jade Winged-Spear": {
      const stacks = (state.jadeHits.get(member.index) || []).filter((expiry) => expiry > time).length;
      attackPercent += stacks * values[0];
      if (stacks >= 7) addDamage("all", values[1] || 0);
      entries.push({
        source: weapon.name,
        description: stacks
          ? `${stacks}/7 active hit stacks: +${stacks * values[0]}% ATK${stacks >= 7 ? ` and +${values[1]}% DMG` : ""}`
          : "Hit stacks not active",
        applied: stacks > 0,
        modeled: true,
      });
      break;
    }
    case "Staff of Homa": {
      const hpRatio = member.settings.weaponHpBelow50 ? values[2] || 0 : 0;
      flatAttack += (member.stats.hp + (member.stats.baseHp || 0) * values[0] / 100) *
        ((values[1] + hpRatio) / 100);
      entries.push({
        source: weapon.name,
        description: `+${values[1]}% Max HP as ATK${hpRatio ? `, plus ${hpRatio}% while below 50% HP` : " (below-50% HP bonus inactive)"}`,
        applied: true,
        modeled: true,
      });
      break;
    }
    case "Deathmatch": {
      const atLeastTwo = Number(enemyCount) >= 2;
      attackPercent += atLeastTwo ? values[0] : values[2];
      entries.push({
        source: weapon.name,
        description: `+${atLeastTwo ? values[0] : values[2]}% ATK for ${atLeastTwo ? "2+ nearby opponents" : "fewer than 2 nearby opponents"}`,
        applied: true,
        modeled: true,
      });
      break;
    }
    case "White Tassel": {
      if (talentAction.talentName === "Invitation to a Beheading" &&
          /^\d+-Hit DMG$/i.test(talentAction.name)) {
        addDamage("normal", values[0]);
      }
      entries.push({
        source: weapon.name,
        description: `+${values[0]}% Normal Attack DMG${talentAction.talentName === "Invitation to a Beheading" && /^\d+-Hit DMG$/i.test(talentAction.name) ? " (applied)" : " (only applies to Normal Attacks)"}`,
        applied: talentAction.talentName === "Invitation to a Beheading" && /^\d+-Hit DMG$/i.test(talentAction.name),
        modeled: true,
      });
      break;
    }
    case "Ballad of the Fjords": {
      const types = new Set(members.map((entry) => entry.character.element)
        .filter((element) => element !== "None"));
      const active = types.size >= 3;
      if (active) elementalMastery += values[0];
      entries.push({
        source: weapon.name,
        description: active ? `+${values[0]} Elemental Mastery (3+ party elements)` : `Requires 3 party elements; current count: ${types.size}`,
        applied: active,
        modeled: true,
      });
      break;
    }
    case "Vortex Vanquisher": {
      const stacks = (state.vortexHits.get(member.index) || []).filter((expiry) => expiry > time).length;
      attackPercent += stacks * values[1] * (shielded ? 2 : 1);
      entries.push({
        source: weapon.name,
        description: `+${values[0]}% Shield Strength; ${stacks}/5 hit stacks: +${stacks * values[1] * (shielded ? 2 : 1)}% ATK${shielded ? " (doubled while shielded)" : ""}`,
        applied: stacks > 0,
        modeled: true,
      });
      break;
    }
    case "Calamity Queller": {
      const skillTime = state.calamitySkills.get(member.index);
      const active = skillTime !== undefined && time < skillTime + 20;
      const stacks = active ? Math.min(6, Math.floor(time - skillTime)) : 0;
      addDamage(member.character.element.toLowerCase(), values[0]);
      attackPercent += stacks * values[1] * (member.index !== state.activeMemberIndex ? 2 : 1);
      entries.push({
        source: weapon.name,
        description: `+${values[0]}% Elemental DMG${active ? `; Consummation ${stacks}/6 ATK stacks` : "; ATK stacks begin after Elemental Skill"}`,
        applied: true,
        modeled: true,
      });
      break;
    }
    case "Missive Windspear": {
      const active = (state.missiveExpiresAt.get(member.index) || 0) > time;
      if (active) {
        attackPercent += values[0];
        elementalMastery += values[1];
      }
      entries.push({
        source: weapon.name,
        description: active
          ? `+${values[0]}% ATK and +${values[1]} Elemental Mastery`
          : "Triggers for 10s after an Elemental Reaction",
        applied: active,
        modeled: true,
      });
      break;
    }
    case "Dragon's Bane": {
      const active = enemyAffectedByPyroHydro;
      if (active) addDamage("all", values[0]);
      entries.push({
        source: weapon.name,
        description: `+${values[0]}% DMG against Pyro/Hydro-affected enemies${active ? "" : " (aura inactive)"}`,
        applied: active,
        modeled: true,
      });
      break;
    }
    case "Lithic Spear": {
      const liyueCount = members.filter((entry) => entry.character.region === "Liyue").length;
      const stacks = Math.min(4, liyueCount);
      attackPercent += stacks * values[0];
      const critRate = stacks * values[1];
      entries.push({
        source: weapon.name,
        description: `${stacks}/4 Liyue party stacks: +${stacks * values[0]}% ATK and +${critRate}% CRIT Rate`,
        applied: stacks > 0,
        modeled: true,
      });
      break;
    }
    case "Skyward Spine":
      entries.push({
        source: weapon.name,
        description: `+${values[0]}% CRIT Rate (does not affect crit-only damage); Normal Attack speed and vacuum blade proc are not modeled in frame timings`,
        applied: false,
        modeled: false,
        status: "partially modeled",
      });
      break;
    case "Wavebreaker's Fin": {
      if (isElementalBurst(member, talentAction)) {
        const teamEnergy = members.reduce(
          (total, entry) => total + getBurstEnergyCost(entry.character),
          0,
        );
        const burstBonus = Math.min(values[0] * teamEnergy, values[1]);
        addDamage("burst", burstBonus);
        entries.push({
          source: weapon.name,
          description: `+${burstBonus}% Burst DMG from ${teamEnergy} combined party Energy (cap ${values[1]}%)`,
          applied: burstBonus > 0,
          modeled: true,
        });
      }
      break;
    }
    case "Blackcliff Pole":
      entries.push({
        source: weapon.name,
        description: "ATK stacks require defeating an enemy; no kill action is represented in the timeline",
        applied: false,
        modeled: false,
      });
      break;
    default:
      if (weapon.effectTemplate) {
        entries.push({
          source: weapon.name,
          description: `${weapon.refinements?.find((entry) =>
            entry.rank === member.settings.refinement)?.description || weapon.effectTemplate} · not modeled`,
          applied: false,
          modeled: false,
        });
      }
  }

  if (weapon.name === "Staff of the Scarlet Sands" && isElementalSkill(member, talentAction)) {
    entries.push({
      source: weapon.name,
      description: "Skill hit adds a Scarlet Sands stack after this hit",
      applied: false,
      modeled: true,
    });
  }
  if (weapon.name === "Crimson Moon's Semblance" &&
      talentAction.name === "Charged Attack DMG") {
    entries.push({
      source: weapon.name,
      description: "Charged Attack hit grants 25% Max HP as Bond of Life (14s cooldown)",
      applied: false,
      modeled: true,
    });
  }
  if (weapon.name === "Calamity Queller" && isElementalSkill(member, talentAction)) {
    entries.push({
      source: weapon.name,
      description: "Elemental Skill starts Consummation for 20s after this hit",
      applied: false,
      modeled: true,
    });
  }
  if (weapon.name === "Missive Windspear" && action.reaction !== "none") {
    entries.push({
      source: weapon.name,
      description: "Elemental Reaction activates the 10s ATK/EM bonus after this hit",
      applied: false,
      modeled: true,
    });
  }

  return { attackPercent, flatAttack, elementalMastery, damageBonuses, entries };
}

export function recordWeaponHit({
  member,
  talentAction,
  action,
  time,
  hitIndex,
  state,
}) {
  const weaponName = member.weapon?.name;
  const recordStack = (map, duration, cooldown, maximumStacks) => {
    const active = (map.get(member.index) || []).filter((expiry) => expiry > time);
    const key = `${weaponName}:${member.index}`;
    const lastHit = state.lastHitTimes.get(key);
    if (active.length < maximumStacks &&
        (lastHit === undefined || time - lastHit >= cooldown)) {
      active.push(time + duration);
      state.lastHitTimes.set(key, time);
    }
    map.set(member.index, active);
  };
  if (weaponName === "Primordial Jade Winged-Spear") recordStack(state.jadeHits, 6, 0.3, 7);
  if (weaponName === "Vortex Vanquisher") recordStack(state.vortexHits, 8, 0.3, 5);
  if (weaponName === "Staff of the Scarlet Sands" && isElementalSkill(member, talentAction)) {
    const active = (state.scarletStacks.get(member.index) || []).filter((expiry) => expiry > time);
    if (active.length < 3) active.push(time + 10);
    state.scarletStacks.set(member.index, active);
  }
  if (weaponName === "Calamity Queller" && isElementalSkill(member, talentAction)) {
    state.calamitySkills.set(member.index, time);
  }
  if (weaponName === "Missive Windspear" && action.reaction !== "none") {
    state.missiveExpiresAt.set(member.index, time + 10);
  }
  state.activeMemberIndex = member.index;
  return weaponName === "Crimson Moon's Semblance" &&
    talentAction.name === "Charged Attack DMG" && hitIndex === 0;
}
