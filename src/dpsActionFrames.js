const ACTION_FRAMES = {
  Arlecchino: {
    normal: [11, 21, 31, 49, 33, 55],
    chargedAttack: { neutral: 58, cancel: 46 },
    skill: 42,
    burst: 60,
    normalString: 200,
  },
  Fischl: {
    normal: [25, 23, 38, 32, 37],
    fullyChargedAimedShot: 96,
    skill: 42,
    burst: 43,
    normalString: 155,
  },
  Chevreuse: {
    normal: [31, 34, 41, 64],
    chargedAttack: 58,
    skillPress: 50,
    skillHold: 52,
    burst: 57,
    normalString: 170,
  },
  Bennett: {
    normal: [26, 23, 45, 54, 72],
    chargedAttack: 54,
    skillPress: 52,
    skillHoldLevel1: 87,
    skillHoldLevel2: 166,
    burst: 50,
    normalString: 220,
  },
};

export function getActionFrameData(character, talentAction, chargedAttackContext = "neutral") {
  if (!character || !talentAction?.name) return null;
  if (talentAction.isSummonSetup || talentAction.isCodaSetup) {
    return { frames: 30, kind: "skill" };
  }
  const timing = ACTION_FRAMES[character.name];
  if (!timing) return null;

  const slot = character.combatTalents?.[talentAction.talentIndex]?.slot;
  const normalAttack = talentAction.name.match(/^([1-6])-Hit DMG$/i);
  if (slot === "combat1" && normalAttack && timing.normal) {
    const frames = timing.normal[Number(normalAttack[1]) - 1];
    return frames ? { frames, kind: "normal" } : null;
  }

  if (character.name === "Arlecchino" && /^Charged Attack DMG$/i.test(talentAction.name)) {
    return {
      frames: timing.chargedAttack[chargedAttackContext] || timing.chargedAttack.neutral,
      kind: "chargedAttack",
    };
  }
  if (character.name === "Fischl" && /^Fully-Charged Aimed Shot$/i.test(talentAction.name)) {
    return { frames: timing.fullyChargedAimedShot, kind: "aimedShot" };
  }
  if ((character.name === "Chevreuse" || character.name === "Bennett") &&
      /^Charged Attack DMG$/i.test(talentAction.name)) {
    return { frames: timing.chargedAttack, kind: "chargedAttack" };
  }
  if (character.name === "Chevreuse" && /^Press DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillPress, kind: "skillPress" };
  }
  if (character.name === "Chevreuse" && /^Hold DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillHold, kind: "skillHold" };
  }
  if (character.name === "Bennett" && /^Press DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillPress, kind: "skillPress" };
  }
  if (character.name === "Bennett" && /^Charge Level 1 DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillHoldLevel1, kind: "skillHoldLevel1" };
  }
  if (character.name === "Bennett" && /^Charge Level 2 DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillHoldLevel2, kind: "skillHoldLevel2" };
  }

  if (slot === "combat2") {
    if (character.name === "Arlecchino" &&
        /^(Spike DMG|Cleave DMG)$/i.test(talentAction.name)) {
      return { frames: timing.skill, kind: "skill" };
    }
    if (character.name === "Fischl" && /^Summoning DMG$/i.test(talentAction.name)) {
      return { frames: timing.skill, kind: "skill" };
    }
  }
  if (character.name === "Chevreuse" && slot === "combat2" &&
      /^Overcharged Ball DMG$/i.test(talentAction.name)) {
    return { frames: timing.skillHold, kind: "skillHold" };
  }
  if (character.name === "Bennett" && slot === "combat2" &&
      /^(Charge Level 2 DMG|Explosion DMG)$/i.test(talentAction.name)) {
    return { frames: timing.skillHoldLevel2, kind: "skillHoldLevel2" };
  }
  if (slot === "combat3" && timing.burst) {
    return { frames: timing.burst, kind: "burst" };
  }
  return null;
}

export function getFullNormalStringFrames(character) {
  return ACTION_FRAMES[character.name]?.normalString || null;
}
