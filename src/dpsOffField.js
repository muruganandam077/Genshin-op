export function getOffFieldSummon(character, talentAction, constellation = 0) {
  if (character.name === "Yae Miko" && talentAction.isSummonSetup) {
    return {
      id: "sesshou-sakura",
      name: "Sesshou Sakura",
      interval: 2.5,
      initialDelay: 1,
      durationTalentName: "Yakan Evocation: Sesshou Sakura",
      durationAttributeName: "Duration",
      damageTalentName: "Yakan Evocation: Sesshou Sakura",
      damageActionName: "Sesshou Sakura DMG: Level 1",
      damageActionNames: [1, 2, 3, 4].map(
        (level) => `Sesshou Sakura DMG: Level ${level}`,
      ),
      damageActionMode: "totemLevel",
      maxInstances: 3,
      constellation,
    };
  }

  if (character.name === "Odette" && talentAction.isCodaSetup) {
    return {
      id: "odette-coda",
      name: "Coda at Dawn's Tolling",
      interval: 1,
      initialDelay: 1,
      durationSeconds: 2.5,
      damageTalentName: "Adagio: Phantom Night Dancers",
      damageActionName: "Coda at Dawn's Tolling DoT",
      finalDamageActionName:
        "Coda at Dawn's Tolling Stellar-Conduct/Stellar Swirl DMG",
      finalDamageIsStellarConduct: true,
      finalAdditionalDamage: constellation >= 1,
    };
  }

  if (character.name === "Odette" &&
      talentAction.talentName === "Adagio: Phantom Night Dancers" &&
      talentAction.name === "Skill DMG") {
    return {
      id: "odette-dance-double",
      name: "Solo Dance Double",
      interval: 2,
      initialDelay: 2,
      durationTalentName: "Adagio: Phantom Night Dancers",
      durationAttributeName: "Solo Dance Double Duration",
      damageTalentName: "Adagio: Phantom Night Dancers",
      damageActionName: "\"Plume\" Dance Move DMG",
      damageActionNames: [
        "\"Plume\" Dance Move DMG",
        "\"Wing\" Dance Move DMG",
      ],
      damageActionMode: "sequence",
    };
  }

  if (character.name === "Qiqi" &&
      talentAction.talentName === "Adeptus Art: Herald of Frost" &&
      talentAction.name === "Skill DMG") {
    return {
      id: "herald-of-frost",
      name: "Herald of Frost",
      interval: 4 / 3,
      durationTalentName: "Adeptus Art: Herald of Frost",
      durationAttributeName: "Duration",
      damageTalentName: "Adeptus Art: Herald of Frost",
      damageActionName: "Herald of Frost DMG",
    };
  }

  if (character.name === "Fischl") {
    const isSkill = talentAction.talentName === "Nightrider";
    const isBurst = talentAction.talentName === "Midnight Phantasmagoria" &&
      talentAction.name === "Falling Thunder DMG";
    if (!isSkill && !isBurst) return null;
    return {
      id: "oz",
      name: "Oz",
      interval: 1,
      durationTalentName: "Nightrider",
      durationAttributeName: "Oz's Duration",
      damageTalentName: "Nightrider",
      damageActionName: "Oz's ATK DMG",
      durationConstellationBonus: constellation >= 6 ? 2 : 0,
    };
  }

  if (character.name === "Durin" &&
      talentAction.talentName === "Principle of Purity: As the Light Shifts") {
    const isDarkness = talentAction.name.startsWith(
      "Principle of Darkness: As the Stars Smolder",
    ) || talentAction.name === "Dragon of Dark Decay DMG";
    const isPurity = talentAction.name.startsWith(
      "Principle of Purity: As the Light Shifts",
    ) || talentAction.name === "Dragon of White Flame DMG";
    if (!isDarkness && !isPurity) return null;
    const form = isDarkness ? "Dark Decay" : "White Flame";
    return {
      id: `dragon-${form.toLowerCase().replaceAll(" ", "-")}`,
      name: `Dragon of ${form}`,
      interval: 2,
      durationTalentName: talentAction.talentName,
      durationAttributeName: `Dragon of ${form} Duration`,
      damageTalentName: talentAction.talentName,
      damageActionName: `Dragon of ${form} DMG`,
    };
  }

  if (character.name === "Ineffa" &&
      (talentAction.talentName === "Cleaning Mode: Carrier Frequency" ||
        talentAction.talentName === "Supreme Instruction: Cyclonic Exterminator")) {
    return {
      id: "birgitta",
      name: "Birgitta",
      interval: 2.5,
      durationTalentName: "Cleaning Mode: Carrier Frequency",
      durationAttributeName: "Birgitta Duration",
      damageTalentName: "Cleaning Mode: Carrier Frequency",
      damageActionName: "Birgitta Discharge DMG",
    };
  }

  return null;
}

export function getTalentAttributeAction(character, talentName, attributeName) {
  const talentIndex = (character.combatTalents || []).findIndex(
    (talent) => talent.name === talentName,
  );
  if (talentIndex < 0) return null;
  const attributeIndex = character.combatTalents[talentIndex].attributes?.labels?.findIndex(
    (entry) => entry.startsWith(`${attributeName}|`),
  ) ?? -1;
  return attributeIndex < 0 ? null : { talentIndex, attributeIndex };
}
