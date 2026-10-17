export function getOffFieldSummon(character, talentAction, constellation = 0) {
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
