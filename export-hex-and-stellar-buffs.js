/**
 * Genshin Impact Hex Buffs (Hexerei) & Stellar Buffs (Stellar-Conduct) Compiler
 * 
 * Aggregates:
 * 1. Hex Buffs / Witch's Homework System (Hexerei: Secret Rite, Faction Resonance, Character Kit Upgrades)
 * 2. Stellar Buffs / Radiance: Stellar-Conduct System (Superconduct Rework, Polestar Field, Radiance State Upgrades)
 * 3. Enriches individual character JSON files with their corresponding Hex / Stellar enhancements.
 * 4. Generates master JSON files: hex_buffs.json and stellar_buffs.json.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const CHAR_DIR = path.join(OUTPUT_DIR, 'characters');

/**
 * Complete Hex Buffs (Hexerei / Witch's Homework System) Data
 */
const HEX_BUFFS_DATA = {
  systemMetadata: {
    systemName: "Hexerei: Witch's Homework (Hex Buffs)",
    faction: "Hexenzirkel",
    loreItem: "The Little Witch's Dictionary (Alice)",
    unlockConditions: [
      "Complete Mondstadt Archon Quest Prologue: Act III 'Song of the Dragon and Freedom'",
      "Complete introductory quest 'Witch's Homework: Solution' (Knights of Favonius Library / Lisa)",
      "Raise eligible characters to Level 70+ to unlock individual Witch's Revelation trials"
    ],
    factionResonance: {
      name: "Hexerei: Secret Rite",
      triggerCondition: "At least two Hexerei-affiliated characters fielded together in the party",
      effects: [
        "Increases party-wide Elemental Mastery by +80 and Anemo/Arcane reaction damage by +25%",
        "Triggering Swirl, Overload, or Electro-Charged creates an Arcane Spark that deals 120% ATK AoE damage (CD: 3s)",
        "Reduces skill cooldowns of Hexerei characters by 15% and increases particle generation efficiency"
      ]
    }
  },
  characters: {
    "Venti": {
      character: "Venti",
      role: "Hexerei Anemo Sub-DPS & Crowd Control",
      witchRiteTitle: "Rite of Zephyr and Song",
      kitEnhancements: {
        normalAndChargedAttack: "During Wind's Grand Ode (Burst), Venti's Normal Attacks are infused with Anemo and fire piercing wind arrows that penetrate multiple targets.",
        elementalBurstAdjustments: "Burst vacuum height is lowered to optimal ground level, allowing melee characters (swords, claymores, polearms) to hit suspended enemies consistently. Hits from normal attacks extend burst duration by up to 3s.",
        passiveUpgrade: "Stormeye restores 20 energy (up from 15) to Venti and party members of the absorbed element."
      },
      constellationUpgrades: {
        c1: "Splits Arrows: Fired arrows deal 40% DMG (up from 33%) and converge towards targets pulled into the vortex.",
        c2: "Breeze of Reminiscence: Anemo & Physical RES shred increased to 15% (30% on airborne targets), duration refreshed on swirl.",
        c6: "Storm of Defiance: Elemental RES shred of absorbed element increased to 25%, granting matching elemental DMG bonus to party."
      }
    },
    "Klee": {
      character: "Klee",
      role: "Hexerei Pyro Main DPS",
      witchRiteTitle: "Rite of Sparks and Embers",
      kitEnhancements: {
        normalAndChargedAttack: "Animation speeds of Normal Attacks increased by 20%, with smoother dash-cancels and reduced recovery frames. Normal attacks have a 60% chance to grant an Explosive Spark without hitting enemies.",
        explosiveSparks: "Consuming an Explosive Spark removes stamina cost, increases Charged Attack DMG by +65% (up from 50%), and generates 4 flat energy for the team.",
        elementalSkill: "Jumpy Dumpty split mines explode with a 25% larger AoE and suction attraction towards the primary target."
      },
      constellationUpgrades: {
        c2: "Explosive Frags: DEF shred increased to 25% for 12 seconds; triggering Pyro reactions refreshes duration.",
        c4: "Sparkly Burst: If Klee leaves the field during Sparks 'n' Splash or when the timer expires, an automatic 555% ATK AoE Pyro blast triggers."
      }
    },
    "Albedo": {
      character: "Albedo",
      role: "Hexerei Geo Sub-DPS & Buffer",
      witchRiteTitle: "Rite of the Kreideprinz",
      kitEnhancements: {
        solarIsotomaDurability: "Solar Isotoma construct can no longer be shattered by boss hitboxes. If placed atop an entity, it phases through and remains active.",
        transientBlossoms: "Transient Blossom procs gain additional DEF scaling (+35%) and have a 100% chance to generate 1 Geo particle (up from 67%).",
        homunculusBonus: "Casting Rite of Progeniture: Tectonic Tide increases party Elemental Mastery by +150 (up from 125) and grants +15% Geo DMG bonus for 15s."
      },
      constellationUpgrades: {
        c1: "Flower of Eden: Transient Blossom hits restore 2.0 energy to Albedo (up from 1.2).",
        c2: "Phanerozoic Fluke: Fatal Blossom bonus scaling per stack increased from 30% to 50% of Albedo's DEF."
      }
    },
    "Mona": {
      character: "Mona",
      role: "Hexerei Hydro Enabler & Buffer",
      witchRiteTitle: "Rite of Astrological Fate",
      kitEnhancements: {
        illusoryBubble: "Omen damage amplification duration extended from 5s to 7s after bubble pop.",
        phantomPulse: "Mirror Reflection of Doom phantom radius increased by 30% and pulses apply continuous Hydro with zero internal cooldown on every second tick.",
        alternateSprint: "Exiting Illusory Torrent grants Mona a 15% Hydro DMG bonus for 8s and creates an automatic miniature phantom."
      },
      constellationUpgrades: {
        c1: "Prophecy of Submersion: Reaction DMG bonus increased to 20% for Vaporize, Electro-Charged, and Hydro Swirl.",
        c4: "Prophecy of Oblivion: Crit Rate against enemies affected by Omen increased from +15% to +20%."
      }
    },
    "Fischl": {
      character: "Fischl",
      role: "Hexerei Electro Off-Field Sub-DPS",
      witchRiteTitle: "Rite of the Prinzessin",
      kitEnhancements: {
        ozCoordinatedAttacks: "Oz attack frequency increased by 15%. When active Hexerei allies attack, Oz unleashes a Piercing Night Raven blast dealing 120% ATK Electro DMG.",
        undoneBeThySinfulHex: "A4 passive lightning smite trigger rate increased, and now scales with both ATK (80%) and Elemental Mastery (40%).",
        burstUtility: "Midnight Phantasmagoria grants full invulnerability during flight and resets Elemental Skill cooldown immediately."
      },
      constellationUpgrades: {
        c2: "Devourer of All Sins: Skill cast damage increased by 200% ATK, radius expanded by 50%.",
        c6: "Evernight Raven: Oz coordinated strike damage increased to 35% of Fischl's ATK, scaling further if an active Hexerei ally is on field."
      }
    },
    "Razor": {
      character: "Razor",
      role: "Hexerei Physical/Electro Hybrid Carry",
      witchRiteTitle: "Rite of Lupical",
      kitEnhancements: {
        wolfWithinEnhancement: "During Lightning Fang, 35% of Razor's Physical DMG is converted into Arcane Electro DMG that triggers superconduct and electro reactions simultaneously.",
        attackSpeedScaling: "Attack Speed bonus increased to +45% at max level, with innate resistance to interruption increased to maximum poise.",
        energyGeneration: "Claw and Thunder resets immediately upon casting burst and generates 3 clear particles for the party upon hitting an opponent."
      },
      constellationUpgrades: {
        c2: "Suppression: Crit Rate against opponents below 40% HP increased to +15% (up from 10%), extending to all Electro attacks.",
        c4: "Bite: DEF shred increased to 20% for 9s on Claw and Thunder hit."
      }
    },
    "Sucrose": {
      character: "Sucrose",
      role: "Hexerei Anemo Swirl Buffer",
      witchRiteTitle: "Rite of Bio-Alchemy",
      kitEnhancements: {
        emSharingMultiplier: "Catalyst Conversion transfers 25% of Sucrose's EM to the party (up from 20%), plus an additional flat +50 EM if another Hexerei ally is present.",
        swirlPullingForce: "Pulling force of Forbidden Creation - Isomer 75 / Type II increased by 25%, grouping mid-weight enemies effortlessly.",
        elementalInfusion: "Infused elements gain a +15% Elemental DMG bonus for all party members matching that element."
      },
      constellationUpgrades: {
        c2: "Beth - Unbound Form: Burst duration increased by 3s (up from 2s).",
        c6: "Chaotic Entropy: Elemental DMG bonus for matching absorbed element increased from 20% to 25%."
      }
    },
    "Durin": {
      character: "Durin",
      role: "Hexerei Arcane Resonance Enabler",
      witchRiteTitle: "Rite of the Dragon's Rebirth",
      kitEnhancements: {
        resonancePillar: "Innately activates Hexerei: Secret Rite regardless of team composition.",
        arcaneBreath: "Skill emits corrosive Dragonspine Flames that reduce all Elemental RES by 15% and increase Hexerei ally Crit DMG by 30%.",
        burstTransformation: "Transforms into Dragon Aspect, raining dark fire and ice that trigger simultaneous Melt and Superconduct reactions."
      },
      constellationUpgrades: {
        c1: "Heart of the Mountain: Increases Dragon Flame radius by 40% and restores 15 energy on cast.",
        c2: "Alchemical Synergy: When paired with Albedo, Venti, or Klee, all Hexerei skill damage is increased by 35%."
      }
    }
  }
};

/**
 * Complete Stellar Buffs (Radiance: Stellar-Conduct System) Data
 */
const STELLAR_BUFFS_DATA = {
  systemMetadata: {
    systemName: "Radiance: Stellar-Conduct (Stellar Buffs)",
    versionIntroduced: "Version 6.8 (Luna VIII Update)",
    coreReaction: "Stellar-Conduct (Transformed Superconduct)",
    enablers: ["Sandrone", "Cryo Traveler", "Odette"],
    triggerCondition: "Apply Cryo and Electro to an opponent with a qualifying Stellar Glimmer enabler in the party",
    mechanics: {
      reactionProperties: [
        "Replaces conventional flat Superconduct reaction damage with high-scaling ATK + EM formula",
        "Reaction damage CAN trigger CRIT Hits (scales with character Crit Rate and Crit DMG)",
        "Applies 40% Physical RES Shred and 15% Cryo & Electro RES Shred"
      ],
      polestarField: {
        name: "Polestar Field (Starlight Prism Arena)",
        duration: "6 seconds (refreshes on each subsequent reaction trigger)",
        effects: [
          "Grants party-wide +20% Cryo DMG Bonus and +20% Electro DMG Bonus to all allies inside",
          "Accumulates Polestar Stacks (up to 10 stacks) every time Cryo or Electro damage connects inside the field",
          "Every 4s, the field releases a Starlight Nova shockwave that deals damage proportional to accumulated stacks"
        ]
      },
      radianceState: {
        name: "Radiance: Stellar-Conduct",
        description: "When designated characters stand inside the active Polestar Field, they enter the Radiance state, unlocking transformed kit mechanics and numerical scaling."
      }
    }
  },
  characters: {
    "Cyno": {
      character: "Cyno",
      role: "Stellar Electro Main DPS",
      radianceBuffTitle: "Radiance: Jackal's Stellar Judgment",
      radianceStateModifications: {
        skillTransformation: "Inside the Polestar Field, Secret Rite: Chasmic Soulfarer can be cast to enter Pactsworn Pathclearer state directly without consuming 80 Burst energy.",
        elementalMasteryScaling: "During Radiance, Cyno gains additional Electro DMG equal to 0.15% of his Elemental Mastery per Polestar stack (up to +75% Electro DMG).",
        endseerIntervals: "Endseer intervals trigger every 3s (down from 4s) and automatically synchronize with Polestar Nova pulses, dealing guaranteed Critical Hits."
      },
      constellationUpgrades: {
        c1: "Ordnance: Normal Attack SPD increased by 25% (up from 20%), extending throughout Radiance.",
        c2: "Ceremony: Electro DMG bonus stacks up to 60% (up from 50%) and does not expire as long as Polestar Field is active.",
        c6: "Raiment: Duststalker Bolt triggers increased from 4 to 6 bolts, dealing 120% ATK damage."
      }
    },
    "Yae Miko": {
      character: "Yae Miko",
      role: "Stellar Electro Off-Field Sub-DPS",
      radianceBuffTitle: "Radiance: Fox-Fire Polestar",
      radianceStateModifications: {
        totemDischarge: "Sesshou Sakura lightning strikes inside the Polestar Field trigger bonus Stellar-Conduct discharges dealing 85% ATK + 150% EM damage.",
        totemPlacement: "Holding Yakan Evocation: Sesshou Sakura instantly summons all 3 Level 3 totems simultaneously in a triangular formation.",
        burstSynergy: "Great Secret Art: Tenko Kenshin consumes Polestar stacks to increase Tenko Thunderbolt damage by +20% per stack without destroying totems."
      },
      constellationUpgrades: {
        c1: "Yakan Offering: Restores 10 energy per Tenko Thunderbolt (up from 8), allowing zero-ER burst uptime.",
        c2: "Fox's Mooncall: Totem level starts at Level 2, max Level 4, with attack range expanded by 75%."
      }
    },
    "Wriothesley": {
      character: "Wriothesley",
      role: "Stellar Cryo Main DPS",
      radianceBuffTitle: "Radiance: Cerberus Glacial Fist",
      radianceStateModifications: {
        enhancedInfusion: "During Chilling Penalty, Frostbound strikes consume 1 Polestar stack to unleash a Glacial Shatter dealing 140% ATK AoE Cryo damage.",
        rebukeRebellion: "Enhanced Charged Attacks (Rebuke: Vaulting Fist) gain +80% Crit DMG inside the Polestar Field and cost 0 Stamina.",
        staggerResistance: "Interruption resistance upgraded to super-armor level, preventing knockbacks from elite enemies."
      },
      constellationUpgrades: {
        c1: "Terror for the Evildoers: Rebuke proc threshold loosened to 60% HP (or every 5th normal hit regardless of HP).",
        c2: "Crescendo of the Shackles: Burst damage bonus per stack increased to 50% (up to 250% total)."
      }
    },
    "Qiqi": {
      character: "Qiqi",
      role: "Stellar Cryo Healer & Physical/Cryo Sub-DPS",
      radianceBuffTitle: "Radiance: Fortune-Preserving Talisman",
      radianceStateModifications: {
        energyGenerationFix: "Hitting enemies marked by Fortune-Preserving Talismans inside Polestar Field generates 2 Cryo particles every 3.5s (solving Qiqi's historical zero-particle flaw).",
        healingToDamageConversion: "100% of overflow healing dealt to active characters is converted into Glacial Burst AoE damage dealing up to 35,000 damage every 3 seconds.",
        heraldOfFrost: "Herald of Frost pulse speed increased by 50%, applying rapid off-field Cryo application."
      },
      constellationUpgrades: {
        c1: "Ascetics of Frost: Restores 3 energy per talisman proc (up from 2).",
        c2: "Frozen to the Bone: Normal and Charged attack DMG against Cryo-affected enemies increased by +30% (up from 15%)."
      }
    },
    "Diona": {
      character: "Diona",
      role: "Stellar Cryo Shielder & Buffer",
      radianceBuffTitle: "Radiance: Kätzlein Starlight Blend",
      radianceStateModifications: {
        polestarShield: "Icy Paws shield gains +35% absorption. While active inside Polestar Field, it periodically fires tracking starlight icicles at enemies.",
        signatureMixAura: "Signature Mix Drunken Mist field grants all characters inside +200 Elemental Mastery and generates 1 Polestar stack every second.",
        staminaReduction: "Stamina consumption reduced by 25% and movement speed increased by 15%."
      },
      constellationUpgrades: {
        c1: "A Lingering Flavor: Restores 18 energy to Diona after burst ends (up from 15).",
        c6: "Cat's Tail Closing Time: The +200 EM bonus triggers at all HP levels inside the Polestar Field."
      }
    },
    "Beidou": {
      character: "Beidou",
      role: "Stellar Electro Sub-DPS & Shielder",
      radianceBuffTitle: "Radiance: Thunderbeast Cleaver",
      radianceStateModifications: {
        stormbreakerBounces: "Stormbreaker chain lightning bounce limit increased from 3 (or 5 at C2) to 7 target bounces, with lightning jumping across the entire Polestar Field.",
        instantStackCap: "Landing a perfect parry with Tidecaller instantly grants max (10) Polestar stacks to the active field.",
        energyCostReduction: "Triggering Stellar-Conduct while Stormbreaker is active reduces Beidou's Burst cooldown by 1s and refunds 3 energy."
      },
      constellationUpgrades: {
        c2: "Upon the Turbulent Sea: Lightning arc jumps to 2 additional targets per trigger.",
        c4: "Stunning Revenge: Normal attacks gain 25% Electro DMG infusion for 10s after taking damage."
      }
    },
    "Sandrone": {
      character: "Sandrone",
      role: "Stellar Conduit Enabler & Off-Field Automaton DPS",
      radianceBuffTitle: "Radiance: Clockwork Marionette",
      radianceStateModifications: {
        innateEnabler: "Automatically upgrades party Superconduct into Stellar-Conduct.",
        automatonBarrage: "Giant Automaton performs coordinated rocket volleys whenever a character inside Polestar Field deals Cryo or Electro damage.",
        fieldExtension: "Automaton strikes extend the duration of the Polestar Field by 1.5s per hit (up to a max of 12s)."
      },
      constellationUpgrades: {
        c1: "Gears of the Steambird: Automaton rocket damage increased by 40% and applies automatic Cryo shred.",
        c2: "Perpetual Engine: Polestar Field grants an additional +30% Crit DMG to all Cryo and Electro characters."
      }
    },
    "Cryo Traveler": {
      character: "Traveler (Cryo)",
      role: "Stellar Cryo Enabler & Buffer",
      radianceBuffTitle: "Radiance: Starlight Frost",
      radianceStateModifications: {
        starlightPrismDeployment: "Elemental Skill deploys a Starlight Prism that acts as an independent Polestar Field beacon.",
        burstSynergy: "Elemental Burst creates a sweeping blizzard vortex that pulls enemies towards the center of the Polestar Field, shredding Physical and Cryo RES by 25%."
      },
      constellationUpgrades: {
        c1: "Frozen Orbit: Increases skill duration by 3s and grants 15% Cryo DMG bonus.",
        c6: "Stellar Horizon: Characters standing inside the blizzard gain +40% Stellar-Conduct reaction Crit DMG."
      }
    }
  }
};

async function runBuffsCompiler() {
  console.log('==================================================');
  console.log(' Genshin Impact Hex & Stellar Buffs Compiler');
  console.log('==================================================\n');

  // 1. Save master Hex Buffs JSON
  const hexFile = path.join(OUTPUT_DIR, 'hex_buffs.json');
  fs.writeFileSync(hexFile, JSON.stringify(HEX_BUFFS_DATA, null, 2), 'utf-8');
  console.log(`Saved Hex Buffs Master:     ${hexFile}`);

  // 2. Save master Stellar Buffs JSON
  const stellarFile = path.join(OUTPUT_DIR, 'stellar_buffs.json');
  fs.writeFileSync(stellarFile, JSON.stringify(STELLAR_BUFFS_DATA, null, 2), 'utf-8');
  console.log(`Saved Stellar Buffs Master: ${stellarFile}`);

  // 3. Enrich individual character files
  console.log('\nEnriching individual character JSON files...');
  let hexEnriched = 0;
  let stellarEnriched = 0;

  // Enrich Hex characters
  for (const [charName, buffData] of Object.entries(HEX_BUFFS_DATA.characters)) {
    const filename = `${charName.replace(/[\\/:*?"<>|]/g, '_').trim()}.json`;
    const charFilePath = path.join(CHAR_DIR, filename);

    if (fs.existsSync(charFilePath)) {
      try {
        const charJson = JSON.parse(fs.readFileSync(charFilePath, 'utf-8'));
        charJson.hexBuffs = {
          hasHexBuff: true,
          ...buffData,
          factionResonanceSummary: HEX_BUFFS_DATA.systemMetadata.factionResonance
        };
        fs.writeFileSync(charFilePath, JSON.stringify(charJson, null, 2), 'utf-8');
        hexEnriched++;
        console.log(` - Enriched Hex buffs for: ${charName}`);
      } catch (err) {
        console.error(`Error enriching ${charName}:`, err.message);
      }
    }
  }

  // Enrich Stellar characters
  for (const [charName, buffData] of Object.entries(STELLAR_BUFFS_DATA.characters)) {
    const filename = `${charName.replace(/[\\/:*?"<>|]/g, '_').trim()}.json`;
    const charFilePath = path.join(CHAR_DIR, filename);

    if (fs.existsSync(charFilePath)) {
      try {
        const charJson = JSON.parse(fs.readFileSync(charFilePath, 'utf-8'));
        charJson.stellarBuffs = {
          hasStellarBuff: true,
          ...buffData,
          systemMechanicsSummary: STELLAR_BUFFS_DATA.systemMetadata.mechanics
        };
        fs.writeFileSync(charFilePath, JSON.stringify(charJson, null, 2), 'utf-8');
        stellarEnriched++;
        console.log(` - Enriched Stellar buffs for: ${charName}`);
      } catch (err) {
        console.error(`Error enriching ${charName}:`, err.message);
      }
    }
  }

  console.log('\n==================================================');
  console.log(' Buffs Compilation Summary');
  console.log('==================================================');
  console.log(`Hex Buffs Master JSON:     ${hexFile}`);
  console.log(`Stellar Buffs Master JSON: ${stellarFile}`);
  console.log(`Hex Characters Enriched:   ${hexEnriched}`);
  console.log(`Stellar Characters Enriched: ${stellarEnriched}`);
  console.log('==================================================\n');
}

runBuffsCompiler().catch((err) => {
  console.error('Fatal error during buffs compilation:', err);
});
