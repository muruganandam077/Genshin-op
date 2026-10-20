export function getGoldenTroupeDamageBonus(member, talentAction, isOffField = false) {
  const isSkillDamage = member.character.combatTalents?.[talentAction.talentIndex]?.slot ===
    "combat2";
  if (!isSkillDamage) return 0;
  const pieces = member.build?.setGroups?.find(
    (group) => group.setName === "Golden Troupe",
  )?.count || 0;
  return (pieces >= 2 ? 20 : 0) +
    (pieces >= 4 ? 25 + (isOffField ? 25 : 0) : 0);
}

export function getSelfEffects({
  member,
  damageElement,
  bondOfLifePercent,
  masqueActive,
  masqueExtraApplied = false,
  artifacts,
  activeSupportEffects,
  activatedSupportEffects,
  fragmentStacks = 0,
  isElementalBurst = false,
  isElementalSkill = false,
  isOffField = false,
  isStellarConduct = false,
  enemyAffectedByStellarConduct = false,
  energyRecharge = member.stats?.energyRecharge || 100,
}) {
  const effects = [];
  if (member.character.name === "Arlecchino" && damageElement === "Pyro") {
    effects.push({
      source: "Arlecchino · The Balemoon Alone May Know",
      description: "+40% Pyro DMG Bonus to Arlecchino",
      applied: true,
    });
  }
  if (masqueActive) {
    effects.push({
      source: "Arlecchino · Masque of the Red Death",
      description: masqueExtraApplied
        ? `Normal Attacks gain Masque extra ATK damage at ${bondOfLifePercent.toFixed(1)}% Bond of Life`
        : `Masque converts this attack to Pyro at ${bondOfLifePercent.toFixed(1)}% Bond of Life; extra damage applies to Normal Attacks only`,
      applied: true,
    });
  }
  if (member.build?.setGroups?.some((group) =>
    group.setName === "Fragment of Harmonic Whimsy" && group.count >= 4)) {
    effects.push({
      source: "Fragment of Harmonic Whimsy · 4-piece",
      description: fragmentStacks
        ? `+${fragmentStacks * 18}% DMG from ${fragmentStacks} active Bond of Life change stack(s)`
        : "Gain 18% DMG per Bond of Life change stack for 6s, up to 3 stacks",
      applied: fragmentStacks > 0,
      modeled: true,
    });
  }
  (member.build?.setGroups || []).forEach((group) => {
    const set = artifacts.find((entry) => String(entry.id) === group.setId);
    if (!set) return;
    const twoPieceStatEffect = (group.setName === "Noblesse Oblige" &&
      isElementalBurst) ||
      (group.setName === "Golden Troupe" && isElementalSkill) ||
      /(?:ATK|HP|DEF|Elemental Mastery|Energy Recharge|CRIT Rate|CRIT DMG|[A-Za-z]+ DMG Bonus)\s*(?:increased\s*)?(?:by\s*)?\+\s*\d|increases?\s+(?:Elemental Mastery|Energy Recharge|ATK|HP|DEF|CRIT Rate|CRIT DMG)[\s\S]{0,40}\bby\s+\d/i
        .test(set.effect2Pc || "");
    const setFourPieceActive =
      (group.setName === "Noblesse Oblige" &&
        activeSupportEffects.some((effect) => effect.source === "Noblesse Oblige · 4-piece")) ||
      (group.setName === "Tenacity of the Millelith" &&
        activeSupportEffects.some((effect) => effect.source === "Tenacity of the Millelith · 4-piece")) ||
      (group.setName === "Heart of the Furnace" &&
        activeSupportEffects.some((effect) =>
          effect.source === "Heart of the Furnace · 4-piece Stellar DMG")) ||
      (group.setName === "Emblem of Severed Fate" && isElementalBurst) ||
      (group.setName === "Fragment of Harmonic Whimsy" && fragmentStacks > 0) ||
      (group.setName === "Golden Troupe" && isElementalSkill) ||
      (group.setName === "Disenchantment in Deep Shadow" &&
        (isStellarConduct || enemyAffectedByStellarConduct)) ||
      (group.setName === "Noblesse Oblige" &&
        activatedSupportEffects.some((effect) => effect.includes("Noblesse Oblige")));
    if (group.count >= 2) {
      effects.push({
        source: `${set.name} · 2-piece`,
        description: set.effect2Pc,
        applied: twoPieceStatEffect,
        modeled: ["Golden Troupe", "Noblesse Oblige"].includes(group.setName) ||
          twoPieceStatEffect,
        status: group.setName === "Noblesse Oblige" && !isElementalBurst
          ? "inactive for this non-Burst hit"
          : group.setName === "Golden Troupe" && !isElementalSkill
            ? "inactive for this non-Skill hit"
          : undefined,
      });
    }
    if (group.count >= 4) {
      effects.push({
        source: `${set.name} · 4-piece`,
        description: set.effect4Pc,
        applied: setFourPieceActive,
        modeled: ["Golden Troupe", "Noblesse Oblige", "Tenacity of the Millelith",
          "Fragment of Harmonic Whimsy", "Disenchantment in Deep Shadow",
          "Heart of the Furnace", "Emblem of Severed Fate"]
          .includes(group.setName),
        status: group.setName === "Golden Troupe"
          ? isElementalSkill
            ? isOffField
              ? "+25% Skill DMG and additional +25% while off-field are active"
              : "+25% Skill DMG active; off-field bonus inactive"
            : "inactive for this non-Skill hit"
          : group.setName === "Disenchantment in Deep Shadow"
            ? setFourPieceActive
              ? "+40% Stellar-Conduct reaction DMG and +16% CRIT Rate while the target is affected"
              : "4-piece bonus activates on Stellar-Conduct; CRIT Rate requires an affected target"
            : group.setName === "Heart of the Furnace"
              ? setFourPieceActive
                ? "+12% ATK and +50% party Stellar-Conduct DMG for 12s are active"
                : "Activates on Stellar-Conduct reaction damage"
            : group.setName === "Emblem of Severed Fate"
              ? isElementalBurst
                ? `+${Math.min(75, energyRecharge * 0.25).toFixed(1)}% Elemental Burst DMG from Energy Recharge`
                : "4-piece bonus applies only to Elemental Burst DMG"
              : setFourPieceActive ? undefined : "inactive until triggered",
      });
    }
  });
  return effects;
}
