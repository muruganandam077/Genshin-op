export const STANDARD_ICD = Object.freeze({ hitCount: 3, seconds: 2.5 });

const STANDARD = Object.freeze({
  type: "standard",
  hitCount: STANDARD_ICD.hitCount,
  seconds: STANDARD_ICD.seconds,
});
const NO_ICD = Object.freeze({ type: "none" });
const FISCHL_OZ_ICD = Object.freeze({ type: "standard", hitCount: 4, seconds: 5 });

function rule(element, gauge, icd = STANDARD, group = null) {
  return { element, gauge, icd, group, applicationsPerActionHit: 1 };
}

export function getElementalApplicationRule(character, talentAction, constellation = 0) {
  if (!character || !talentAction) return null;
  const { name } = character;
  const talentName = talentAction.talentName || "";
  const actionName = talentAction.name || "";

  if (name === "Arlecchino") {
    if (talentName === "Invitation to a Beheading") {
      if (/^[1-6]-Hit DMG$/i.test(actionName)) return rule("Pyro", 1, STANDARD, "normal");
      if (/^Charged Attack DMG$/i.test(actionName)) return rule("Pyro", 1, NO_ICD);
    }
    if (talentName === "All Is Ash" &&
        /^(Spike DMG|Cleave DMG|Blood-Debt Directive DMG)$/i.test(actionName)) {
      return rule("Pyro", 1, NO_ICD);
    }
    if (talentName === "Balemoon Rising" && /^Skill DMG$/i.test(actionName)) {
      return rule("Pyro", 2, NO_ICD);
    }
  }

  if (name === "Fischl") {
    if (talentName === "Nightrider" &&
        /^(Oz's ATK DMG|Summoning DMG)$/i.test(actionName)) {
      return rule("Electro", 1, FISCHL_OZ_ICD, "oz");
    }
    if (talentName === "Midnight Phantasmagoria" &&
        /^Falling Thunder DMG$/i.test(actionName)) {
      return rule("Electro", 1, STANDARD);
    }
    if (talentName === "Oz's Joint Attack") {
      return rule("Electro", 1, NO_ICD, "a4");
    }
  }

  if (name === "Chevreuse") {
    if (talentName === "Short-Range Rapid Interdiction Fire") {
      if (/^Surging Blade DMG$/i.test(actionName)) return rule("Pyro", 0, NO_ICD);
      if (/^(Press DMG|Hold DMG|Overcharged Ball DMG)$/i.test(actionName)) {
        return rule("Pyro", 1, NO_ICD);
      }
    }
    if (talentName === "Ring of Bursting Grenades") {
      if (/^Explosive Grenade DMG$/i.test(actionName)) return rule("Pyro", 2, NO_ICD);
      if (/^Secondary Explosive Shell DMG$/i.test(actionName)) return rule("Pyro", 1, STANDARD);
    }
  }

  if (name === "Bennett") {
    if (talentName === "Passion Overload") {
      if (/^Press DMG$/i.test(actionName)) return rule("Pyro", 2, NO_ICD);
      if (/^(Charge Level 1 DMG|Charge Level 2 DMG|Explosion DMG)$/i.test(actionName)) {
        const hitRule = rule("Pyro", 1, NO_ICD);
        if (/^Charge Level [12] DMG$/i.test(actionName)) {
          hitRule.applicationsPerActionHit = 2;
        }
        return hitRule;
      }
    }
    if (talentName === "Fantastic Voyage" &&
        /^Burst DMG · Inspiration Field$/i.test(actionName)) {
      return rule("Pyro", 2, NO_ICD);
    }
  }

  if (character.element === "None" || character.element === "Physical") return null;
  return rule(character.element, 1, STANDARD);
}

export function getElementalApplicationGroupKey(member, talentAction, applicationRule) {
  if (!applicationRule) {
    return `${member.index}:no-element:${talentAction.key || talentAction.name}`;
  }
  if (applicationRule.group === "oz") return `${member.index}:fischl:oz`;
  if (applicationRule.group) return `${member.index}:${applicationRule.group}`;
  const slot = member.character.combatTalents?.[talentAction.talentIndex]?.slot;
  const isNormalHit = /^\d+-Hit DMG$/i.test(talentAction.name || "");
  const attackGroup = slot === "combat1" && isNormalHit
    ? `${talentAction.talentIndex}:normal`
    : talentAction.key || `${talentAction.talentIndex}:${talentAction.attributeIndex}`;
  return `${member.index}:${attackGroup}`;
}

export function trackElementalApplication(stateByGroup, groupKey, applicationRule, time) {
  if (!applicationRule || applicationRule.gauge <= 0) {
    return {
      applied: false,
      gauge: 0,
      element: applicationRule?.element || null,
      reason: applicationRule ? "no-application" : "no-element",
    };
  }
  if (applicationRule.icd.type === "none") {
    return {
      applied: true,
      gauge: applicationRule.gauge,
      element: applicationRule.element,
      reason: "applied",
    };
  }

  const state = stateByGroup.get(groupKey) || {
    hitCount: 0,
    lastApplicationTime: null,
  };
  state.hitCount += 1;
  const eligible = state.lastApplicationTime === null ||
    state.hitCount >= applicationRule.icd.hitCount ||
    time - state.lastApplicationTime >= applicationRule.icd.seconds;
  if (eligible) {
    state.hitCount = 0;
    state.lastApplicationTime = time;
  }
  stateByGroup.set(groupKey, state);
  return {
    applied: eligible,
    gauge: eligible ? applicationRule.gauge : 0,
    element: applicationRule.element,
    reason: eligible ? "applied" : "icd",
  };
}

export function resolveElementalReaction(auraByEnemy, application, time) {
  if (application?.reason !== "applied" ||
      !["Pyro", "Electro"].includes(application.element)) {
    return null;
  }

  const activeAuras = [...auraByEnemy.entries()].filter(([, aura]) =>
    aura.expiresAt > time && aura.gauge > 0);
  const opposingElement = application.element === "Pyro" ? "Electro" : "Pyro";
  const opposingAura = activeAuras.find(([element]) => element === opposingElement);
  if (!opposingAura) {
    auraByEnemy.set(application.element, {
      gauge: application.gauge * 0.8,
      expiresAt: time + 9.5,
    });
    return null;
  }

  auraByEnemy.delete(opposingElement);
  const remainingGauge = application.gauge * 0.8 - 0.5;
  if (remainingGauge > 0) {
    auraByEnemy.set(application.element, {
      gauge: remainingGauge,
      expiresAt: time + 9.5,
    });
  } else {
    auraByEnemy.delete(application.element);
  }
  return "overload";
}

export function getBennettFieldSelfApplication() {
  return { element: "Pyro", gauge: 1, interval: 1, icd: NO_ICD };
}

export function getArlecchinoC2Application(constellation) {
  return constellation >= 2 ? rule("Pyro", 1, NO_ICD) : null;
}
