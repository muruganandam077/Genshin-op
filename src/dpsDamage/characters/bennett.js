import { getTalentMultiplier } from "../../dpsDamageTalents.js";
import { getBennettFieldSelfApplication } from "../../dpsElementalApplication.js";
import { getTalentAttributeAction } from "../../dpsOffField.js";
import { getTalentAttributeValue, storeBuff } from "../../dpsSupportBuffs.js";

export function getTalentActionName(talentName, actionName) {
  return talentName === "Fantastic Voyage" && /^Skill DMG$/i.test(actionName)
    ? "Burst DMG · Inspiration Field"
    : actionName;
}

export function activateBurst({
  member,
  members,
  talentLevel,
  time,
  buffsByTarget,
  assumeTargetsAbove70PercentHp,
}) {
  const ratio = getTalentAttributeValue(
    member.character,
    "Fantastic Voyage",
    "ATK Bonus Ratio",
    talentLevel,
  );
  const buffActive = member.settings.constellation >= 1 || assumeTargetsAbove70PercentHp;
  const baseAttackBonus = buffActive
    ? (member.stats.baseAttack || 0) *
      (ratio + (member.settings.constellation >= 1 ? 0.2 : 0))
    : 0;
  const duration = getTalentAttributeValue(
    member.character,
    "Fantastic Voyage",
    "Duration",
    talentLevel,
  ) || 12;
  const events = [];

  members.forEach((target) => {
    if (baseAttackBonus > 0) {
      storeBuff(buffsByTarget, target.index, {
        source: "Bennett · Fantastic Voyage",
        stat: "flat ATK",
        value: baseAttackBonus,
        expiresAt: time + duration,
      });
      events.push(`${target.character.name} receives +${Math.round(baseAttackBonus)} ATK from Bennett's Burst for ${duration}s`);
    } else {
      events.push(`${target.character.name} is assumed below 70% HP; Bennett's C0 ATK buff is inactive`);
    }

    if (member.settings.constellation >= 6 &&
        ["Sword", "Claymore", "Polearm"].includes(target.character.weaponType)) {
      storeBuff(buffsByTarget, target.index, {
        source: "Bennett · C6",
        stat: "pyroDamageBonus",
        value: 15,
        expiresAt: time + duration,
      });
      events.push(`${target.character.name} receives +15% Pyro DMG Bonus from Bennett C6 for ${duration}s`);
    }
  });

  const durationAction = getTalentAttributeAction(
    member.character,
    "Fantastic Voyage",
    "Duration",
  );
  const { element, gauge, interval } = getBennettFieldSelfApplication();
  const fieldSelfApplication = durationAction
    ? {
        element,
        gauge,
        interval,
        startsAt: time,
        expiresAt: time + getTalentMultiplier(
          member.character,
          durationAction,
          talentLevel,
        ),
      }
    : null;

  return { events, fieldSelfApplication };
}
