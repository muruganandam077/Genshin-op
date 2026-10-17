import { useMemo, useState } from "react";
import {
  calculateBuildStats,
  makeTeamPresetId,
  optimizeTeam,
  readTeamPresets,
  saveTeamPresets,
  TEAM_ROLES,
} from "./teamOptimizer.js";

const EMPTY_MEMBER = {
  characterId: "",
  role: "dps",
  weaponId: "",
  setId: "",
};
const TEAM_SIZE = 4;

function makeEmptyTeam() {
  return Array.from({ length: TEAM_SIZE }, () => ({ ...EMPTY_MEMBER }));
}

function itemStatLabel(stat) {
  const labels = {
    hp: "HP", atk: "ATK", def: "DEF", atk_: "ATK%", hp_: "HP%", def_: "DEF%",
    critRate_: "CRIT Rate", critDMG_: "CRIT DMG", enerRech_: "ER", eleMas: "EM",
  };
  return labels[stat] || stat
    .replace(/_dmg_$/, " DMG")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function artifactStats(entry) {
  if (entry.source === "GOOD") {
    return [
      itemStatLabel(entry.good.mainStatKey),
      ...entry.good.substats.map((stat) => `${itemStatLabel(stat.key)} ${stat.value}${String(stat.key).endsWith("_") ? "%" : ""}`),
    ];
  }
  return [entry.mainStat, ...entry.substats].filter(Boolean);
}

function slugifyAssetName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatNumber(value, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits });
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function level90WeaponAttack(weapon) {
  const level90Entries = weapon.ascensionStats?.filter((entry) => entry.level === 90) || [];
  const highestAscension = level90Entries.sort((a, b) => b.ascension - a.ascension)[0];
  return highestAscension?.attack || weapon.baseAttack;
}

function BuildFaceCard({ character, weapon, build, artifacts }) {
  const stats = calculateBuildStats(build, weapon, artifacts);
  const weaponImage = weapon
    ? `./assets/weapons/${encodeURIComponent(slugifyAssetName(weapon.name))}.png`
    : "";
  const artifactImages = build.items.map((item) => ({
    ...item,
    src: `./assets/artifact_images/${encodeURIComponent(item.setName)}/${item.slot}.png`,
  }));
  const statRows = [
    ["HP", "hp", formatNumber(stats.hp)],
    ["ATK", "attack", formatNumber(stats.attack)],
    ["DEF", "defense", formatNumber(stats.defense)],
    ["Elemental Mastery", "elementalMastery", formatNumber(stats.elementalMastery)],
    ["CRIT Rate", "critRate", formatPercent(stats.critRate)],
    ["CRIT DMG", "critDamage", formatPercent(stats.critDamage)],
    ["Energy Recharge", "energyRecharge", formatPercent(stats.energyRecharge)],
    [`${character.element} DMG Bonus`, "elementalDamageBonus", formatPercent(stats.elementalDamageBonus)],
  ];

  return (
    <section className={`optimizer-face-card ${character.element.toLowerCase()}`}>
      <div className="optimizer-face-portrait">
        <img
          alt={`${character.name} portrait`}
          onError={(event) => { event.currentTarget.hidden = true; }}
          src={`./assets/char/${encodeURIComponent(slugifyAssetName(character.name))}.png`}
        />
        <div className="optimizer-face-identity">
          <span>LEVEL {stats.baseLevel || 90} · {character.element}</span>
          <h4>{character.name}</h4>
          <span>{TEAM_ROLES.find(([role]) => role === build.role)?.[1]}</span>
        </div>
      </div>
      <div className="optimizer-face-details">
        <div className="optimizer-face-weapon">
          {weapon ? (
            <img
              alt={`${weapon.name} icon`}
              onError={(event) => { event.currentTarget.hidden = true; }}
              src={weaponImage}
            />
          ) : (
            <span className="optimizer-face-weapon-placeholder" aria-hidden="true">◇</span>
          )}
          <div>
            <span>WEAPON · LEVEL {stats.weaponLevel || 90} ASSUMED</span>
            <b>{weapon?.name || "No compatible weapon selected"}</b>
            {weapon && (
            <small>
              ATK {formatNumber(level90WeaponAttack(weapon))}
                {weapon.mainStat ? ` · ${weapon.mainStat} ${weapon.baseStatText || ""}` : ""}
              </small>
            )}
          </div>
        </div>
        <div className="optimizer-face-stat-grid">
          {statRows.map(([label, key, value]) => {
            const sources = stats.statSources[key] || [];
            const sourceCategories = [...new Set(sources.map((source) => {
              if (source.label.startsWith("Base ") || source.label.startsWith("Character base")) return "Base";
              if (source.label === "Character ascension") return "Ascension";
              if (source.label === "Weapon secondary stat" || source.label === "Weapon base ATK") return "Weapon";
              if (source.label.startsWith("Artifact ")) return "Artifacts";
              return "Set bonuses";
            }))];
            return (
              <div className="optimizer-face-stat" key={label}>
                <span>{label}</span>
                <b>{value}</b>
                <small className="optimizer-face-stat-origin">
                  From: {sourceCategories.length ? sourceCategories.join(" · ") : "No contributing stats"}
                </small>
                <details className="optimizer-face-stat-sources">
                  <summary>View sources</summary>
                  {sources.length ? (
                    <ul>
                      {sources.map((source) => (
                        <li key={`${source.label}-${source.value}`}>
                          <span>{source.label}</span>
                          <b>{source.value > 0 ? "+" : ""}{formatNumber(source.value, 1)}{stats.statSourceUnits[key]}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No artifact, ascension, weapon, or set bonus contributes to this stat.</p>
                  )}
                </details>
              </div>
            );
          })}
        </div>
        <div className="optimizer-face-artifacts" aria-label="Equipped artifacts">
          {artifactImages.map((item) => (
            <div className="optimizer-face-artifact" key={item.entry.id} title={`${item.slot} · ${item.setName}`}>
              <img
                alt={`${item.setName} ${item.slot}`}
                onError={(event) => { event.currentTarget.hidden = true; }}
                src={item.src}
              />
            </div>
          ))}
          <span>{build.setGroups.filter((group) => group.count >= 2)
            .map((group) => `${group.count} ${group.setName}`)
            .join(" · ") || "No active set bonus"}</span>
        </div>
      </div>
      <p className="optimizer-face-assumption">
        Level 90 character and weapon; totals include equipped artifacts and readable static set bonuses. Temporary buffs and conditional combat effects are excluded.
        {!stats.hasCharacterBase && " Character base stats are unavailable in the catalog."}
        {weapon && !stats.hasWeaponBase && " Weapon base stats are unavailable in the catalog."}
        {stats.critRateRaw > 100 && ` Uncapped CRIT Rate: ${formatPercent(stats.critRateRaw)}.`}
      </p>
    </section>
  );
}

function TeamOptimizerPage({
  characters = [],
  weapons = [],
  artifacts = [],
  inventory,
  loading,
  error,
  onBack,
}) {
  const initialPresets = useMemo(() => readTeamPresets(), []);
  const [team, setTeam] = useState(makeEmptyTeam);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState(initialPresets.presets);
  const [presetError, setPresetError] = useState(initialPresets.error);
  const [presetNotice, setPresetNotice] = useState("");

  const optimization = useMemo(() => optimizeTeam(team, inventory, {
    characters,
    weapons,
    artifacts,
  }), [team, inventory, characters, weapons, artifacts]);
  const selectedCharacterIds = team.map((member) => member.characterId).filter(Boolean);
  const canSaveTeam = team.every((member) =>
    member.characterId && characters.some((character) =>
      String(character.id) === member.characterId)) &&
    new Set(selectedCharacterIds).size === TEAM_SIZE;
  const selectedElements = team.flatMap((member) => {
    const character = characters.find((item) => String(item.id) === member.characterId);
    return character && character.element !== "None" ? [character.element] : [];
  });
  const resonanceElements = [...new Set(selectedElements)].filter((element) =>
    selectedElements.filter((memberElement) => memberElement === element).length >= 2);

  function updateMember(index, changes) {
    setTeam((current) => current.map((member, memberIndex) =>
      memberIndex === index ? { ...member, ...changes } : member));
    setPresetNotice("");
  }

  function persistPresets(nextPresets, message) {
    try {
      saveTeamPresets(nextPresets);
      setPresets(nextPresets);
      setPresetError("");
      setPresetNotice(message);
      return true;
    } catch (saveError) {
      setPresetError(`Could not save team presets: ${
        saveError instanceof Error ? saveError.message : "browser storage is unavailable."
      }`);
      setPresetNotice("");
      return false;
    }
  }

  function saveCurrentTeam() {
    const name = presetName.trim();
    if (!name) {
      setPresetError("Enter a name for this team preset.");
      return;
    }
    if (!canSaveTeam) {
      setPresetError("Choose four different characters before saving a team preset.");
      return;
    }
    const next = [...presets, {
      id: makeTeamPresetId(),
      name,
      team: team.map((member) => ({ ...member })),
    }];
    if (persistPresets(next, `Saved "${name}" to this device.`)) setPresetName("");
  }

  function loadPreset(preset) {
    setTeam(preset.team.map((member) => ({ ...member })));
    setPresetNotice(`Loaded "${preset.name}".`);
    setPresetError("");
  }

  return (
    <main className="loadout-page optimizer-page">
      <button className="detail-back" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> Back to My Loadout
      </button>
      <section className="loadout-intro">
        <div>
          <p className="eyebrow"><span>OWNED ARTIFACT INVENTORY</span> &nbsp; STORED ON THIS DEVICE</p>
          <h1>Team Optimizer</h1>
          <p>Build a four-character team, choose weapons from the archive, then find the strongest artifact pieces you own for each character.</p>
        </div>
        <div className="loadout-counts">
          <span><b>{inventory.artifacts.length}</b> owned artifacts</span>
          <span><b>{weapons.length}</b> archive weapons</span>
        </div>
      </section>

      {(loading || error) && (
        <p className={`loadout-message ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>
          {error || "Loading characters, weapons, and artifact sets…"}
        </p>
      )}
      {presetError && <p className="loadout-message error" role="alert">{presetError}</p>}
      {presetNotice && <p className="loadout-message success" role="status">{presetNotice}</p>}

      <section className="loadout-panel optimizer-team-panel">
        <div className="loadout-panel-heading">
          <div>
            <p className="eyebrow"><span>TEAM COMPOSITION</span></p>
            <h2>Select four characters</h2>
          </div>
          <span className="optimizer-team-count">{selectedCharacterIds.length} / 4 selected</span>
        </div>
        <div className="optimizer-member-grid">
          {team.map((member, index) => {
            const character = characters.find((item) => String(item.id) === member.characterId);
            const build = optimization.builds.get(index);
            const equippedWeapon = optimization.weaponsByIndex.get(index);
            const compatibleWeapons = weapons.filter((weapon) =>
              weapon.weaponType === character?.weaponType);
            return (
              <article className="optimizer-member-card" key={index}>
                <div className="optimizer-member-heading">
                  <span className="optimizer-member-number">0{index + 1}</span>
                  <span>{character?.element || "TEAM SLOT"}</span>
                </div>
                <label className="loadout-field">
                  <span>Character</span>
                  <select
                    onChange={(event) => updateMember(index, { characterId: event.target.value })}
                    value={member.characterId}
                  >
                    <option value="">Choose a character</option>
                    {characters.map((item) => (
                      <option
                        disabled={selectedCharacterIds.includes(String(item.id)) &&
                          String(item.id) !== member.characterId}
                        key={item.id}
                        value={item.id}
                      >
                        {item.name} · {item.element} · {item.weaponType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="loadout-field">
                  <span>Build role</span>
                  <select
                    onChange={(event) => updateMember(index, { role: event.target.value })}
                    value={member.role}
                  >
                    {TEAM_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="loadout-field">
                  <span>Required 4-piece set</span>
                  <select
                    onChange={(event) => updateMember(index, { setId: event.target.value })}
                    value={member.setId}
                  >
                    <option value="">Any set — optimize</option>
                    {artifacts.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
                  </select>
                </label>
                <label className="loadout-field">
                  <span>Weapon from archive</span>
                  <select
                    disabled={!character}
                    onChange={(event) => updateMember(index, { weaponId: event.target.value })}
                    value={member.weaponId}
                  >
                    <option value="">Auto-recommend from archive</option>
                    {compatibleWeapons.map((weapon) => {
                      const usedElsewhere = team.some((other, otherIndex) =>
                        otherIndex !== index &&
                        other.weaponId === String(weapon.id));
                      return (
                        <option disabled={usedElsewhere} key={weapon.id} value={weapon.id}>
                          {weapon.name} · {weapon.rarity}★ · {weapon.mainStat || "No secondary stat"}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {character && (
                  <div className="optimizer-recommendation">
                    <span>WEAPON PICK</span>
                    <b>{equippedWeapon?.name || "No compatible weapon in archive"}</b>
                    {build ? (
                      <small>
                        {build.items.length === 5
                          ? `${member.setId
                            ? `${artifacts.find((set) => String(set.id) === member.setId)?.name || "Required set"} · `
                            : ""}${build.setName} · ${build.setCount} pieces`
                          : `Need all 5 artifact slots · ${build.items.length} available`}
                      </small>
                    ) : (
                      <small>
                        {member.setId
                          ? "Need 4 owned pieces from the required set"
                          : inventory.artifacts.length
                            ? "Not enough unused artifacts for a full build"
                            : "Add artifacts to your inventory to optimize"}
                      </small>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className="optimizer-team-context">
          <span>TEAM CONTEXT</span>
          {resonanceElements.length
            ? <p>Repeated element: {resonanceElements.join(", ")}. Party-wide artifact effects are valued against the selected teammates.</p>
            : <p>Choose teammates to give party-wide artifact effects their team context.</p>}
        </div>
      </section>

      <section className="loadout-panel optimizer-presets">
        <div className="loadout-panel-heading">
          <div>
            <p className="eyebrow"><span>TEAM PRESETS</span></p>
            <h2>Save or load a team</h2>
          </div>
        </div>
        <div className="optimizer-save-row">
          <label className="loadout-field">
            <span>Preset name</span>
            <input
              maxLength={60}
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveCurrentTeam();
                }
              }}
              placeholder="e.g. Spiral Abyss — Vaporize"
              value={presetName}
            />
          </label>
          <button
            className="loadout-submit"
            disabled={!canSaveTeam}
            onClick={saveCurrentTeam}
            type="button"
          >
            Save team preset
          </button>
        </div>
        {presets.length > 0 && (
          <ul className="optimizer-preset-list">
            {presets.map((preset) => (
              <li key={preset.id}>
                <div>
                  <b>{preset.name}</b>
                  <small>{preset.team.map((member) =>
                    characters.find((item) => String(item.id) === member.characterId)?.name ||
                    "Unavailable character").join(" · ")}</small>
                </div>
                <div>
                  <button className="optimizer-text-button" onClick={() => loadPreset(preset)} type="button">Load</button>
                  <button
                    aria-label={`Delete ${preset.name}`}
                    className="optimizer-text-button remove"
                    onClick={() => persistPresets(
                      presets.filter((entry) => entry.id !== preset.id),
                      `Deleted "${preset.name}".`,
                    )}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!presets.length && <p className="optimizer-no-presets">Saved teams stay in this browser. Choose four characters to create your first preset.</p>}
      </section>

      <section className="loadout-inventory optimizer-results">
        <div className="loadout-inventory-heading">
          <div>
            <p className="eyebrow"><span>INVENTORY-BASED RESULTS</span></p>
            <h2>Recommended builds</h2>
          </div>
          <span className="loadout-local-tag">Owned pieces only</span>
        </div>
        {!inventory.artifacts.length ? (
          <div className="empty-state">
            <span className="empty-star">✧</span>
            <h2>No artifacts to optimize yet</h2>
            <p>Import a GOOD export or add artifacts in My Loadout. The optimizer searches only your local inventory.</p>
          </div>
        ) : selectedCharacterIds.length === 0 ? (
          <div className="empty-state">
            <span className="empty-star">✧</span>
            <h2>Choose a character to begin</h2>
            <p>Build results update as you select your team, roles, and preferred sets.</p>
          </div>
        ) : (
          <div className="optimizer-result-grid">
            {team.map((member, index) => {
              const character = characters.find((item) => String(item.id) === member.characterId);
              if (!character) return null;
              const build = optimization.builds.get(index);
              const weapon = optimization.weaponsByIndex.get(index);
              return (
                <article className="optimizer-result-card" key={index}>
                  <div className="optimizer-result-heading">
                    <div>
                      <span>{character.element} · {TEAM_ROLES.find(([role]) => role === member.role)?.[1]}</span>
                      <h3>{character.name}</h3>
                    </div>
                    {build && <b>{build.score.toFixed(1)} <small>BUILD SCORE</small></b>}
                  </div>
                  {build ? (
                    <>
                      <BuildFaceCard
                        artifacts={artifacts}
                        build={build}
                        character={character}
                        weapon={weapon}
                      />
                      <ul className="optimizer-artifact-list">
                        {build.items.map((item) => {
                          const slotLabel = item.slot[0].toUpperCase() + item.slot.slice(1);
                          const stats = artifactStats(item.entry);
                          const isOffPiece = build.setGroups.find((set) =>
                            set.setId === item.setId)?.count === 1;
                          return (
                            <li key={item.entry.id}>
                              <div>
                                <b>{slotLabel} · {item.setName}{isOffPiece ? " · off-piece" : ""}</b>
                                <small>{stats.join(" · ")}</small>
                              </div>
                              <span>{item.baseScore.toFixed(1)}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="optimizer-set-summary">
                        {build.setGroups.some((set) => set.count >= 2)
                          ? build.setGroups
                            .filter((set) => set.count >= 2)
                            .map((set) => `${set.count}-piece ${set.setName}`)
                            .join(" + ") + " bonus included"
                          : "No 2-piece or 4-piece set bonus active"}
                      </p>
                    </>
                  ) : (
                    <p className="optimizer-target-note">
                      {member.setId
                        ? "Could not find four available pieces of the required set in different slots. No substitute set is shown; add or free matching pieces, or choose a different required set."
                        : "Could not make a complete five-slot build from the remaining inventory."}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <p className="optimizer-method-note">
          A selected 4-piece set is a hard requirement; the fifth piece is chosen from another set when available. Weapons can be selected from the full archive; artifact builds use owned pieces only.           Scores are a transparent first-pass estimate from artifact main/substats, selected role, set-bonus text, and teammate context—not simulated damage. DPS characters with a Cryo/Pyro teammate receive higher EM value for potential Melt; other teams use a lower baseline EM weight. Exact talent scaling, rotations, reaction ownership, weapon passives, and elemental resonance are not yet calculated.
        </p>
      </section>
    </main>
  );
}

export default TeamOptimizerPage;
