export function getJointAttackActions({
  fischl,
  talentAction,
  reaction,
  ozActive,
}) {
  if (!fischl) return [];
  const actions = [];
  if (fischl.settings.constellation >= 6 &&
      /^\d+-Hit DMG$/i.test(talentAction.name) &&
      ozActive) {
    actions.push({
      key: "fischl-c6-joint-attack",
      talentIndex: fischl.character.combatTalents.findIndex(
        (talent) => talent.name === "Nightrider",
      ),
      talentName: "Nightrider",
      name: "Oz's ATK DMG",
      source: "Fischl C6 · Oz's joint attack",
    });
  }
  if (["overload", "electroCharged", "superconduct", "aggravate"].includes(reaction)) {
    actions.push({
      key: "fischl-a4-joint-attack",
      talentIndex: -1,
      talentName: "Oz's Joint Attack",
      name: "Joint Attack DMG",
      source: "Fischl A4 · Undone Be Thy Sin",
    });
  }
  return actions;
}
