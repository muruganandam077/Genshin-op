import { useEffect, useMemo, useRef, useState } from "react";
import {
  makeLoadoutId,
  mergeGoodInventory,
  normalizeSavedLoadout,
  parseGoodFile,
  readSavedLoadout,
  saveLoadout,
} from "./loadout.js";
import TeamOptimizerPage from "./TeamOptimizer.jsx";
import DpsCalculatorPage from "./DpsCalculator.jsx";

const PAGE_SIZE = 12;
const ELEMENTS = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"];
const WEAPON_TYPES = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"];
const CATALOGS = {
  characters: {
    label: "Characters",
    heading: "Celestial Combatant Archives",
    description: "Explore the heroes, visions, and stories that shape the fate of Teyvat.",
    singular: "combatant",
    fields: ["name", "title", "region", "element", "weaponType"],
    sortOptions: [
      ["name", "Name: A to Z"],
      ["rarity-desc", "Rarity: highest"],
      ["rarity-asc", "Rarity: lowest"],
      ["version-desc", "Newest release"],
    ],
  },
  weapons: {
    label: "Weapons",
    heading: "Armaments of Teyvat",
    description: "Browse the blades, bows, and catalysts carried by Teyvat's adventurers.",
    singular: "weapon",
    fields: ["name", "description", "weaponType", "mainStat", "effectName"],
    sortOptions: [
      ["name", "Name: A to Z"],
      ["rarity-desc", "Rarity: highest"],
      ["rarity-asc", "Rarity: lowest"],
      ["attack-desc", "Base attack: highest"],
    ],
  },
  artifacts: {
    label: "Artifacts",
    heading: "Relic Set Archives",
    description: "Explore artifact sets, their two-piece and four-piece bonuses, and every relic.",
    singular: "artifact set",
    fields: ["name", "effect2Pc", "effect4Pc", "version"],
    sortOptions: [
      ["name", "Name: A to Z"],
      ["version-desc", "Newest release"],
      ["rarity-desc", "Rarity: highest"],
    ],
  },
};
const ELEMENT_SYMBOLS = {
  Anemo: "❋",
  Cryo: "❄",
  Dendro: "❧",
  Electro: "ϟ",
  Geo: "⬡",
  Hydro: "◉",
  None: "✧",
  Pyro: "♨",
};
const GOOD_STAT_LABELS = {
  hp: "HP",
  hp_: "HP",
  atk: "ATK",
  atk_: "ATK",
  def: "DEF",
  def_: "DEF",
  eleMas: "Elemental Mastery",
  enerRech_: "Energy Recharge",
  critRate_: "CRIT Rate",
  critDMG_: "CRIT DMG",
  heal_: "Healing Bonus",
  physical_dmg_: "Physical DMG Bonus",
  anemo_dmg_: "Anemo DMG Bonus",
  cryo_dmg_: "Cryo DMG Bonus",
  dendro_dmg_: "Dendro DMG Bonus",
  electro_dmg_: "Electro DMG Bonus",
  geo_dmg_: "Geo DMG Bonus",
  hydro_dmg_: "Hydro DMG Bonus",
  pyro_dmg_: "Pyro DMG Bonus",
};

function formatGoodStat(key, value) {
  const label = GOOD_STAT_LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${label}${value === undefined ? "" : ` ${value}${key.endsWith("_") ? "%" : ""}`}`;
}

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function characterPortraitPath(name) {
  return `./assets/char/${encodeURIComponent(slugify(name))}.png`;
}

function weaponImagePath(name) {
  return `./assets/weapons/${encodeURIComponent(slugify(name))}.png`;
}

function elementClass(element) {
  return (element || "none").toLowerCase();
}

function elementName(character) {
  return character.element && character.element !== "None"
    ? character.element
    : "Traveler";
}

function formatCount(count, digits = 2) {
  return String(count).padStart(digits, "0");
}

async function fetchJson(url, description) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${description} request failed (${response.status}).`);
  }
  return response.json();
}

async function loadCatalog(catalog) {
  if (catalog === "characters") {
    const filenames = await fetchJson("./characters/index.json", "Character index");
    if (!Array.isArray(filenames) || filenames.some((filename) => typeof filename !== "string")) {
      throw new Error("Character index is not a list of filenames.");
    }
    const characters = await Promise.all(
      filenames.map((filename) =>
        fetchJson(`./characters/${encodeURIComponent(filename)}`, `Character ${filename}`),
      ),
    );
    return characters.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (catalog === "weapons") {
    const filenames = await fetchJson("./weapons/index.json", "Weapon index");
    if (!Array.isArray(filenames) || filenames.some((filename) => typeof filename !== "string")) {
      throw new Error("Weapon index is not a list of filenames.");
    }
    const weapons = await Promise.all(
      filenames.map((filename) =>
        fetchJson(`./weapons/${encodeURIComponent(filename)}`, `Weapon ${filename}`),
      ),
    );
    return weapons.sort((a, b) => a.name.localeCompare(b.name));
  }
  return fetchJson("./all_artifacts.json", "Artifact catalog");
}

function getItemRarity(item, catalog) {
  if (catalog === "artifacts") return Math.max(...(item.rarityList || [0]));
  return item.rarity || 0;
}

function getCatalogFilters(catalog) {
  if (catalog === "characters") {
    return [
      { value: "all", label: "All", symbol: "✧" },
      ...ELEMENTS.map((element) => ({
        value: element,
        label: element,
        symbol: "◈",
        className: element.toLowerCase(),
      })),
    ];
  }
  if (catalog === "weapons") {
    return [
      { value: "all", label: "All", symbol: "✧" },
      ...WEAPON_TYPES.map((type) => ({ value: type, label: type, symbol: "◇" })),
    ];
  }
  return [
    { value: "all", label: "All sets", symbol: "✧" },
    { value: "5", label: "5-Star", symbol: "★" },
    { value: "4", label: "4-Star", symbol: "★" },
  ];
}

function ArchiveHeader({
  catalog,
  dataCatalog,
  items,
  onCatalogChange,
  onLoadoutOpen,
  onOptimizerOpen,
}) {
  const current = CATALOGS[dataCatalog];
  const releases = [...new Set(items.map((item) => item.version).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let secondaryValue = "—";
  let secondaryLabel = "COLLECTION";
  let editionValue = releases.at(-1) || "—";
  let editionLabel = "LATEST RELEASE";

  if (dataCatalog === "characters") {
    secondaryValue = String(
      new Set(items.map((item) => item.element).filter((value) => value && value !== "None")).size,
    ).padStart(2, "0");
    secondaryLabel = "ELEMENTS";
    editionValue = releases.length ? `${releases[0]}–${releases.at(-1)}` : "—";
    editionLabel = "VERSIONS";
  } else if (dataCatalog === "weapons") {
    secondaryValue = String(new Set(items.map((item) => item.weaponType).filter(Boolean)).size)
      .padStart(2, "0");
    secondaryLabel = "WEAPON TYPES";
    editionValue = `${new Set(items.map((item) => item.rarity).filter(Boolean)).size}`;
    editionLabel = "RARITY TIERS";
  } else {
    secondaryValue = String(
      items.reduce((total, item) => total + Object.keys(item.pieces || {}).length, 0),
    ).padStart(3, "0");
    secondaryLabel = "RELIC PIECES";
    editionLabel = "LATEST RELEASE";
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="./" aria-label="Teyvat Nexus home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span className="brand-name">TEYVAT <b>NEXUS</b></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-link${catalog === "home" ? " active" : ""}`}
            aria-current={catalog === "home" ? "page" : undefined}
            onClick={() => onCatalogChange("home")}
            type="button"
          >
            Home
          </button>
          {Object.entries(CATALOGS).map(([key, entry]) => (
            <button
              className={`nav-link${catalog === key ? " active" : ""}`}
              aria-current={catalog === key ? "page" : undefined}
              key={key}
              onClick={() => onCatalogChange(key)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
          <button
            className={`nav-link${catalog === "loadout" ? " active" : ""}`}
            aria-current={catalog === "loadout" ? "page" : undefined}
            onClick={onLoadoutOpen}
            type="button"
          >
            My Loadout
          </button>
          <button
            className={`nav-link${catalog === "optimizer" ? " active" : ""}`}
            aria-current={catalog === "optimizer" ? "page" : undefined}
            onClick={onOptimizerOpen}
            type="button"
          >
            Team Optimizer
          </button>
          <button
            className={`nav-link${catalog === "dps-calculator" ? " active" : ""}`}
            aria-current={catalog === "dps-calculator" ? "page" : undefined}
            onClick={() => onCatalogChange("dps-calculator")}
            type="button"
          >
            DPS Calculator
          </button>
        </nav>
        <div className="topbar-status">
          <span className="status-dot" aria-hidden="true" />
          <span>DATABASE ONLINE</span>
        </div>
      </header>

      {catalog !== "home" && catalog !== "loadout" && catalog !== "optimizer" && catalog !== "dps-calculator" && (
        <section className="archive-heading">
          <div className="heading-copy">
            <p className="eyebrow"><span>TEYVAT NEXUS</span> &nbsp; FIELD ARCHIVE</p>
            <h1>{current.heading}</h1>
            <p className="heading-description">{current.description}</p>
          </div>
          <div className="archive-stats" aria-label="Catalog statistics">
            <StatBlock value={formatCount(items.length, 3)} label={current.label.toUpperCase()} />
            <div className="stat-divider" />
            <StatBlock value={secondaryValue} label={secondaryLabel} />
            <div className="stat-divider" />
            <StatBlock value={editionValue} label={editionLabel} />
          </div>
        </section>
      )}
    </>
  );
}

function LandingPage({ counts, countError, onCatalogChange }) {
  const categories = [
    {
      id: "characters",
      index: "01",
      title: "Character Archive",
      description: "Meet the vision bearers, adventurers, and legends across Teyvat.",
      count: counts.characters,
      image: "./assets/char/arlecchino.png",
      imageAlt: "Arlecchino character portrait",
    },
    {
      id: "weapons",
      index: "02",
      title: "Weapon Archive",
      description: "Browse swords, bows, polearms, catalysts, and claymores.",
      count: counts.weapons,
      image: "./assets/weapons/mistsplitter-reforged.png",
      imageAlt: "Mistsplitter Reforged weapon",
    },
    {
      id: "artifacts",
      index: "03",
      title: "Artifact Sets",
      description: "Compare relic collections and their two- and four-piece effects.",
      count: counts.artifacts,
      image: "./assets/artifact_images/Emblem of Severed Fate/flower.png",
      imageAlt: "Emblem of Severed Fate flower artifact",
    },
  ];

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow"><span>TEYVAT NEXUS</span> &nbsp; THE FIELD ARCHIVE</p>
          <h1>Build Beyond <em>Limits.</em></h1>
          <p className="landing-description">
            Explore the characters, weapons, and artifact sets that make every
            journey through Teyvat your own.
          </p>
          <div className="landing-actions">
            <button
              className="landing-button primary"
              onClick={() => onCatalogChange("characters")}
              type="button"
            >
              Explore Character Archive <span aria-hidden="true">→</span>
            </button>
            <button
              className="landing-button secondary"
              onClick={() => onCatalogChange("weapons")}
              type="button"
            >
              Browse Weapons
            </button>
          </div>
          <div className="landing-stats">
            <StatBlock value={counts.characters || "—"} label="CHARACTERS" />
            <StatBlock value={counts.weapons || "—"} label="WEAPONS" />
            <StatBlock value={counts.artifacts || "—"} label="ARTIFACT SETS" />
          </div>
          {countError && <p className="landing-count-error" role="alert">{countError}</p>}
        </div>
        <div className="landing-side-panel">
          <div className="landing-panel-topline">
            <span><span className="status-dot" /> NEXUS ARCHIVE / LIVE INDEX</span>
            <span>V5.2</span>
          </div>
          <img
            className="landing-feature-portrait"
            src="./assets/char/arlecchino.png"
            alt="Arlecchino"
          />
          <div className="landing-panel-caption">
            <span>FIELD NOTES · COMBATANT</span>
            <strong>Discover your next favorite.</strong>
          </div>
        </div>
      </section>

      <section className="landing-collection">
        <div className="landing-section-heading">
          <p className="eyebrow"><span>01</span> &nbsp; THE ARCHIVE</p>
          <h2>Everything you need to know about Teyvat.</h2>
        </div>
        <div className="landing-category-grid">
          {categories.map((category) => (
            <button
              className="landing-category-card"
              key={category.id}
              onClick={() => onCatalogChange(category.id)}
              type="button"
            >
              <span className="landing-card-index">{category.index} / ARCHIVE</span>
              <span className="landing-card-art">
                <img src={category.image} alt={category.imageAlt} loading="lazy" />
              </span>
              <span className="landing-card-title">{category.title}</span>
              <span className="landing-card-description">{category.description}</span>
              <span className="landing-card-footer">
                <span>{category.count || "—"} ENTRIES</span>
                <span aria-hidden="true">↗</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="landing-callout">
        <span className="landing-callout-mark" aria-hidden="true">✦</span>
        <p className="eyebrow">THE TEYVAT NEXUS ARCHIVE</p>
        <h2>Every journey starts with a discovery.</h2>
        <p>Browse the growing collection of characters, weapons, and artifact sets.</p>
        <button
          className="landing-button primary"
          onClick={() => onCatalogChange("artifacts")}
          type="button"
        >
          Explore Artifact Sets <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  );
}

function StatBlock({ value, label }) {
  return (
    <div className="stat-block">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function CatalogFilters({ catalog, selectedFilter, onSelect }) {
  const filters = getCatalogFilters(catalog);
  return (
    <div className="element-filter" aria-label={`Filter ${CATALOGS[catalog].label}`}>
      {filters.map((filter) => (
        <button
          className={`element-chip${selectedFilter === filter.value ? " active" : ""}`}
          aria-pressed={selectedFilter === filter.value}
          key={filter.value}
          onClick={() => onSelect(filter.value)}
          type="button"
        >
          <span className={`filter-symbol ${filter.className || ""}`}>{filter.symbol}</span>
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function CatalogToolbar({
  catalog,
  search,
  setSearch,
  rarity,
  setRarity,
  sort,
  setSort,
  searchRef,
}) {
  const isArtifact = catalog === "artifacts";

  return (
    <div className="catalog-toolbar">
      <label className="search-box">
        <span className="search-icon" aria-hidden="true" />
        <span className="visually-hidden">Search {CATALOGS[catalog].label.toLowerCase()}</span>
        <input
          ref={searchRef}
          type="search"
          placeholder={`Search ${CATALOGS[catalog].label.toLowerCase()}...`}
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <kbd>Ctrl K</kbd>
      </label>
      {!isArtifact && (
        <label className="select-control">
          <span className="visually-hidden">Filter by rarity</span>
          <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
            <option value="all">All rarities</option>
            {(catalog === "characters" ? [5, 4] : [5, 4, 3, 2, 1]).map((value) => (
              <option key={value} value={value}>{value} star</option>
            ))}
          </select>
        </label>
      )}
      <label className="select-control sort-control">
        <span className="visually-hidden">Sort {CATALOGS[catalog].label.toLowerCase()}</span>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          {CATALOGS[catalog].sortOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CharacterCard({ character, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  const element = elementClass(character.element);

  return (
    <button
      className="character-card"
      type="button"
      aria-label={`View ${character.name} details`}
      onClick={() => onSelect(character.id)}
    >
      <span
        className={`card-portrait${imageFailed ? " portrait-missing" : ""}`}
        style={{ "--element-color": `var(--${element})` }}
      >
        {!imageFailed ? (
          <img
            src={characterPortraitPath(character.name)}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="portrait-initial">{character.name.charAt(0)}</span>
        )}
      </span>
      <span className="card-rarity">{"★".repeat(character.rarity || 0)}</span>
      <span className={`card-element ${element}`}>
        {ELEMENT_SYMBOLS[character.element] || "✧"}
      </span>
      <span className="card-info">
        <span className="card-name">{character.name}</span>
        <span className="card-subtitle">{character.region || elementName(character)}</span>
      </span>
      <span className="card-weapon">{character.weaponType || "Unknown weapon"}</span>
    </button>
  );
}

function WeaponCard({ weapon, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button
      className="catalog-card weapon-card"
      type="button"
      aria-label={`View ${weapon.name} details`}
      onClick={() => onSelect(weapon.id)}
    >
      <span className="weapon-art">
        {!imageFailed ? (
          <img
            src={weaponImagePath(weapon.name)}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="weapon-art-fallback" aria-hidden="true">◇</span>
        )}
        <span className="card-rarity">{"★".repeat(weapon.rarity || 0)}</span>
      </span>
      <span className="resource-card-info">
        <span className="resource-card-kicker">{weapon.weaponType || "Weapon"}</span>
        <span className="card-name">{weapon.name}</span>
        <span className="resource-card-stat">
          ATK {Math.floor(weapon.baseAttack || 0)}
          {weapon.mainStat ? ` · ${weapon.mainStat} ${weapon.baseStatText || ""}` : ""}
        </span>
      </span>
    </button>
  );
}

function ArtifactCard({ artifact, onSelect }) {
  return (
    <button
      className="catalog-card artifact-card"
      type="button"
      aria-label={`View ${artifact.name} artifact set`}
      onClick={() => onSelect(artifact.id)}
    >
      <span className="artifact-card-art">
        {Object.entries(artifact.pieces || {}).slice(0, 5).map(([slot, piece]) => (
          <img
            key={slot}
            src={`./assets/${piece.localImagePath}`}
            alt=""
            loading="lazy"
          />
        ))}
      </span>
      <span className="resource-card-info">
        <span className="resource-card-kicker">
          {artifact.rarityList?.map((value) => `${value}★`).join(" / ") || "Artifact set"}
        </span>
        <span className="card-name">{artifact.name}</span>
        <span className="artifact-bonus-preview">
          <b>2-Piece</b> {artifact.effect2Pc}
        </span>
      </span>
    </button>
  );
}

function DetailArtwork({ catalog, item }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (catalog === "artifacts") {
    return (
      <div className="detail-artifact-pieces">
        {Object.entries(item.pieces || {}).map(([slot, piece]) => (
          <div className="detail-artifact-piece" key={slot}>
            <img src={`./assets/${piece.localImagePath}`} alt={piece.name} />
            <span>{piece.relicText || slot}</span>
          </div>
        ))}
      </div>
    );
  }

  const src = catalog === "characters"
    ? characterPortraitPath(item.name)
    : weaponImagePath(item.name);

  return (
    <div className={`detail-artwork ${catalog}-detail-artwork`}>
      {!imageFailed ? (
        <img src={src} alt={`${item.name} ${catalog === "characters" ? "portrait" : "artwork"}`} onError={() => setImageFailed(true)} />
      ) : (
        <span className="weapon-art-fallback" aria-hidden="true">
          {catalog === "characters" ? item.name.charAt(0) : "◇"}
        </span>
      )}
      <span className="detail-rarity">{"★".repeat(item.rarity || 0)}</span>
      {catalog === "characters" && (
        <span className={`detail-element ${elementClass(item.element)}`}>
          {ELEMENT_SYMBOLS[item.element] || "✧"}
        </span>
      )}
    </div>
  );
}

function DetailHero({ catalog, item, onBack }) {
  let kicker;
  let subtitle;
  let description = item.description;
  let metadata;
  if (catalog === "characters") {
    kicker = `${item.region || "TEYVAT"} · ${elementName(item)} · ${item.rarity || "?"} STAR`;
    subtitle = item.title || `${elementName(item)} adventurer`;
    metadata = [
      ["Weapon", item.weaponType],
      ["Affiliation", item.affiliation],
      ["Ascension", item.substat],
      ["Birthday", item.birthday],
      ["Constellation", item.constellationName],
      ["English voice", item.cv?.english],
      ["Release", item.version && `Version ${item.version}`],
    ];
  } else if (catalog === "weapons") {
    kicker = `${item.weaponType || "WEAPON"} · ${item.rarity || "?"} STAR`;
    subtitle = item.mainStat
      ? `${item.mainStat} ${item.baseStatText || ""}`
      : `${Math.floor(item.baseAttack || 0)} Base ATK`;
    metadata = [
      ["Base ATK", item.baseAttack && formatGrowthStat(item.baseAttack)],
      ["Secondary stat", item.mainStat && `${item.mainStat} ${item.baseStatText || ""}`],
      ["Release", item.version && `Version ${item.version}`],
    ];
  } else {
    kicker = `ARTIFACT SET · ${item.rarityList?.map((value) => `${value}★`).join(" / ") || "ARCHIVE"}`;
    subtitle = item.version ? `Released in version ${item.version}` : "Teyvat artifact set";
    description = "";
    metadata = [
      ["Release", item.version && `Version ${item.version}`],
      ["Rarity", item.rarityList?.map((value) => `${value} star`).join(" / ")],
      ["Relic pieces", `${Object.keys(item.pieces || {}).length} pieces`],
    ];
  }

  return (
    <>
      <button className="detail-back" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> Back to {CATALOGS[catalog].label}
      </button>
      <section className="detail-hero">
        <DetailArtwork catalog={catalog} item={item} />
        <div className="detail-hero-copy">
          <p className="eyebrow"><span>TEYVAT NEXUS</span> &nbsp; {kicker}</p>
          <h1>{item.name}</h1>
          <p className="detail-subtitle">{subtitle}</p>
          {description && <p className="detail-description">{description}</p>}
          <div className="detail-metadata">
            {metadata.filter(([, value]) => value).map(([label, value]) => (
              <div className="detail-metadata-item" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function CharacterDetails({ character }) {
  return (
    <div className="detail-content">
      <CharacterProgression character={character} />
      {character.affiliation && (
        <details className="detail-section">
          <summary>Character profile</summary>
          <div className="detail-section-content">
            <ProfileFact label="GENDER" value={character.gender} />
            <ProfileFact label="BODY TYPE" value={character.bodyType} />
            <ProfileFact label="AFFILIATION" value={character.affiliation} />
            <ProfileFact label="CONSTELLATION" value={character.constellationName} />
            {Object.entries(character.cv || {}).map(([language, actor]) => (
              <ProfileFact key={language} label={`VOICE · ${language.toUpperCase()}`} value={actor} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function WeaponDetails({ weapon }) {
  return (
    <div className="detail-content">
      {weapon.effectName && (
        <section className="effect-section detail-primary-effect">
          <h3>{weapon.effectName} · Refinement 1</h3>
          <p>{weapon.refinements?.[0]?.description || weapon.r1?.description || weapon.effectTemplate || "No weapon effect is listed."}</p>
        </section>
      )}
      <WeaponProgression weapon={weapon} />
      <WeaponRefinements weapon={weapon} />
      {weapon.story && (
        <details className="detail-section">
          <summary>Weapon lore</summary>
          <div className="detail-section-content">
            <p className="weapon-story">{weapon.story}</p>
          </div>
        </details>
      )}
    </div>
  );
}

function ArtifactDetails({ artifact }) {
  return (
    <div className="detail-content artifact-detail-content">
      <section className="effect-section">
        <h3>2-Piece Set Bonus</h3>
        <p>{artifact.effect2Pc || "No two-piece set bonus listed."}</p>
      </section>
      <section className="effect-section">
        <h3>4-Piece Set Bonus</h3>
        <p>{artifact.effect4Pc || "No four-piece set bonus listed."}</p>
      </section>
      <details className="detail-section" open>
        <summary>Relic pieces</summary>
        <div className="detail-section-content artifact-piece-list">
          {Object.entries(artifact.pieces || {}).map(([slot, piece]) => (
            <article className="passive-entry artifact-piece-entry" key={slot}>
              <img src={`./assets/${piece.localImagePath}`} alt="" />
              <div>
                <h3>{piece.name}</h3>
                <p className="resource-card-kicker">{piece.relicText || slot}</p>
                <p>{piece.description || "No relic description available."}</p>
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function ArchiveDetailPage({ catalog, item, onBack }) {
  return (
    <main className="archive-detail-page">
      <DetailHero catalog={catalog} item={item} onBack={onBack} />
      {catalog === "characters" && <CharacterDetails character={item} />}
      {catalog === "weapons" && <WeaponDetails weapon={item} />}
      {catalog === "artifacts" && <ArtifactDetails artifact={item} />}
    </main>
  );
}

const ARTIFACT_SLOT_LABELS = {
  flower: "Flower of Life",
  plume: "Plume of Death",
  sands: "Sands of Eon",
  goblet: "Goblet of Eonothem",
  circlet: "Circlet of Logos",
};

function ManualLoadoutForm({ onAdd, weapons = [], artifacts = [], disabled }) {
  const [kind, setKind] = useState("weapons");
  const [weapon, setWeapon] = useState({
    catalogId: "",
    level: "1",
    ascension: "0",
    refinement: "1",
    baseAttack: "",
    secondaryStat: "",
  });
  const [artifact, setArtifact] = useState({
    catalogId: "",
    slot: "flower",
    rarity: "5",
    level: "0",
    mainStat: "",
    substats: "",
  });

  function submitWeapon(event) {
    event.preventDefault();
    const recognizedWeapon = weapons.find(
      (item) => String(item.id) === weapon.catalogId,
    );
    if (!recognizedWeapon) return;
    onAdd("weapons", {
      source: "manual",
      ...weapon,
      name: recognizedWeapon.name,
      weaponType: recognizedWeapon.weaponType,
      rarity: recognizedWeapon.rarity,
      level: Number(weapon.level),
      ascension: Number(weapon.ascension),
      refinement: Number(weapon.refinement),
      baseAttack: weapon.baseAttack ? Number(weapon.baseAttack) : null,
    });
    setWeapon((current) => ({ ...current, catalogId: "" }));
  }

  function submitArtifact(event) {
    event.preventDefault();
    const recognizedArtifact = artifacts.find(
      (item) => String(item.id) === artifact.catalogId,
    );
    if (
      !recognizedArtifact ||
      !(recognizedArtifact.rarityList || []).includes(Number(artifact.rarity))
    ) {
      return;
    }
    onAdd("artifacts", {
      source: "manual",
      ...artifact,
      setName: recognizedArtifact.name,
      rarity: Number(artifact.rarity),
      level: Number(artifact.level),
      substats: artifact.substats
        .split(",")
        .map((stat) => stat.trim())
        .filter(Boolean),
    });
    setArtifact((current) => ({
      ...current,
      catalogId: "",
      mainStat: "",
      substats: "",
    }));
  }

  return (
    <section className="loadout-panel manual-entry-panel">
      <div className="loadout-panel-heading">
        <div>
          <p className="eyebrow"><span>ADD TO YOUR INVENTORY</span></p>
          <h2>Manual entry</h2>
        </div>
        <div className="loadout-tabs" role="tablist" aria-label="Manual entry type">
          <button
            className={kind === "weapons" ? "active" : ""}
            aria-pressed={kind === "weapons"}
            disabled={disabled}
            onClick={() => setKind("weapons")}
            type="button"
          >
            Weapon
          </button>
          <button
            className={kind === "artifacts" ? "active" : ""}
            aria-pressed={kind === "artifacts"}
            disabled={disabled}
            onClick={() => setKind("artifacts")}
            type="button"
          >
            Artifact
          </button>
        </div>
      </div>
      {kind === "weapons" ? (
        <form className="loadout-form" onSubmit={submitWeapon}>
          <label className="loadout-field loadout-field-wide">
            <span>Recognized weapon</span>
            <select
              disabled={disabled}
              onChange={(event) => setWeapon({ ...weapon, catalogId: event.target.value })}
              required
              value={weapon.catalogId}
            >
              <option value="">Choose a weapon</option>
              {weapons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.weaponType} · {item.rarity}★
                </option>
              ))}
            </select>
          </label>
          <label className="loadout-field">
            <span>Weapon type</span>
            <output>
              {weapons.find((item) => String(item.id) === weapon.catalogId)?.weaponType || "Choose a weapon"}
            </output>
          </label>
          <label className="loadout-field">
            <span>Level</span>
            <input
              disabled={disabled}
              max="90"
              min="1"
              onChange={(event) => setWeapon({ ...weapon, level: event.target.value })}
              required
              type="number"
              value={weapon.level}
            />
          </label>
          <label className="loadout-field">
            <span>Ascension</span>
            <select
              disabled={disabled}
              onChange={(event) => setWeapon({ ...weapon, ascension: event.target.value })}
              value={weapon.ascension}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>A{value}</option>)}
            </select>
          </label>
          <label className="loadout-field">
            <span>Refinement</span>
            <select
              disabled={disabled}
              onChange={(event) => setWeapon({ ...weapon, refinement: event.target.value })}
              value={weapon.refinement}
            >
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>R{value}</option>)}
            </select>
          </label>
          <label className="loadout-field">
            <span>Base ATK <small>optional</small></span>
            <input
              min="0"
              disabled={disabled}
              onChange={(event) => setWeapon({ ...weapon, baseAttack: event.target.value })}
              step="any"
              type="number"
              value={weapon.baseAttack}
            />
          </label>
          <label className="loadout-field loadout-field-wide">
            <span>Secondary stat <small>optional</small></span>
            <input
              maxLength={100}
              disabled={disabled}
              onChange={(event) => setWeapon({ ...weapon, secondaryStat: event.target.value })}
              placeholder="e.g. CRIT DMG 44.1%"
              value={weapon.secondaryStat}
            />
          </label>
          <button
            className="loadout-submit"
            disabled={disabled || !weapon.catalogId}
            type="submit"
          >
            Add weapon
          </button>
        </form>
      ) : (
        <form className="loadout-form" onSubmit={submitArtifact}>
          <label className="loadout-field loadout-field-wide">
            <span>Recognized artifact set</span>
            <select
              disabled={disabled}
              onChange={(event) => {
                const selectedArtifact = artifacts.find(
                  (item) => String(item.id) === event.target.value,
                );
                setArtifact({
                  ...artifact,
                  catalogId: event.target.value,
                  rarity: String(Math.max(...(selectedArtifact?.rarityList || [5]))),
                });
              }}
              required
              value={artifact.catalogId}
            >
              <option value="">Choose an artifact set</option>
              {artifacts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="loadout-field">
            <span>Piece slot</span>
            <select
              disabled={disabled}
              onChange={(event) => setArtifact({ ...artifact, slot: event.target.value })}
              value={artifact.slot}
            >
              {Object.entries(ARTIFACT_SLOT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="loadout-field">
            <span>Rarity</span>
            <select
              disabled={disabled || !artifact.catalogId}
              onChange={(event) => setArtifact({ ...artifact, rarity: event.target.value })}
              required
              value={artifact.rarity}
            >
              {(artifacts.find((item) => String(item.id) === artifact.catalogId)?.rarityList || [])
                .slice()
                .sort((a, b) => b - a)
                .map((value) => <option key={value} value={value}>{value} star</option>)}
            </select>
          </label>
          <label className="loadout-field">
            <span>Level</span>
            <input
              disabled={disabled}
              max="20"
              min="0"
              onChange={(event) => setArtifact({ ...artifact, level: event.target.value })}
              required
              type="number"
              value={artifact.level}
            />
          </label>
          <label className="loadout-field loadout-field-wide">
            <span>Main stat</span>
            <input
              disabled={disabled}
              maxLength={80}
              onChange={(event) => setArtifact({ ...artifact, mainStat: event.target.value })}
              placeholder="e.g. CRIT Rate 31.1%"
              required
              value={artifact.mainStat}
            />
          </label>
          <label className="loadout-field loadout-field-wide">
            <span>Substats <small>comma-separated, optional</small></span>
            <input
              disabled={disabled}
              maxLength={300}
              onChange={(event) => setArtifact({ ...artifact, substats: event.target.value })}
              placeholder="e.g. CRIT DMG 14.0%, ATK 5.8%, ER 11.0%"
              value={artifact.substats}
            />
          </label>
          <button
            className="loadout-submit"
            disabled={disabled || !artifact.catalogId}
            type="submit"
          >
            Add artifact
          </button>
        </form>
      )}
    </section>
  );
}

function LoadoutPage({
  data,
  storageError,
  storageNotice,
  catalogData = {},
  catalogLoading,
  catalogError,
  onImport,
  onAdd,
  onSectionChange,
  onOptimizerOpen,
}) {
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const weapons = Array.isArray(catalogData.weapons) ? catalogData.weapons : [];
  const artifacts = Array.isArray(catalogData.artifacts) ? catalogData.artifacts : [];
  const ready = weapons.length > 0 && artifacts.length > 0 && !catalogLoading && !catalogError;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage("");
    setImportError("");
    try {
      if (!ready) throw new Error("Wait for the recognized weapon and artifact catalogs to finish loading.");
      const imported = parseGoodFile(await file.text());
      const result = onImport(imported);
      const summary =
        `Imported ${result.addedWeapons} weapon${result.addedWeapons === 1 ? "" : "s"} and ` +
          `${result.addedArtifacts} artifact${result.addedArtifacts === 1 ? "" : "s"}. ` +
          `${result.duplicates} existing duplicate${result.duplicates === 1 ? " was" : "s were"} skipped. ` +
          `${result.unrecognizedWeapons} unrecognized weapon${result.unrecognizedWeapons === 1 ? " was" : "s were"} and ` +
          `${result.unrecognizedArtifacts} unrecognized artifact${result.unrecognizedArtifacts === 1 ? " was" : "s were"} ignored.`;
      setImportMessage(result.saved ? summary : `${summary} The changes are not saved locally.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The selected file could not be imported.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="loadout-page">
      <section className="loadout-intro">
        <div>
          <p className="eyebrow"><span>YOUR PRIVATE ARCHIVE</span> &nbsp; STORED ON THIS DEVICE</p>
          <h1>My Loadout</h1>
          <p>Your weapons and artifact inventory is saved locally in this browser. Import a GOOD file or add pieces yourself.</p>
        </div>
        <div className="loadout-counts">
          <span><b>{data.weapons.length}</b> weapons</span>
          <span><b>{data.artifacts.length}</b> artifacts</span>
        </div>
      </section>

      {storageError && <p className="loadout-message error-state" role="alert">{storageError}</p>}
      {storageNotice && <p className="loadout-message success" role="status">{storageNotice}</p>}
      {catalogError && <p className="loadout-message error" role="alert">
        The catalogs needed to validate loadout entries could not be loaded: {catalogError}
      </p>}
      <section className="loadout-panel good-import-panel">
        <div>
          <p className="eyebrow"><span>IMPORT INVENTORY</span></p>
          <h2>Import a GOOD file</h2>
          <p>Choose a GOOD-format JSON export. Only weapons and artifact sets in the Teyvat Nexus catalogs are added; duplicates are skipped.</p>
        </div>
        <label className={`good-file-button${ready ? "" : " disabled"}`}>
          {catalogLoading ? "Loading catalog..." : "Choose GOOD file"}
          <input accept=".json,application/json" disabled={!ready} onChange={handleFileChange} type="file" />
        </label>
        {importMessage && <p className="loadout-message success" role="status">{importMessage}</p>}
        {importError && <p className="loadout-message error" role="alert">{importError}</p>}
      </section>

      <ManualLoadoutForm
        onAdd={onAdd}
        weapons={weapons}
        artifacts={artifacts}
        disabled={!ready}
      />

      <section className="loadout-inventory">
        <div className="loadout-inventory-heading">
          <div>
            <p className="eyebrow"><span>PERSONAL INVENTORY</span></p>
            <h2>Choose an inventory</h2>
          </div>
          <span className="loadout-local-tag">Saved on this device</span>
        </div>
        <div className="loadout-inventory-grid">
          <button
            className="loadout-category-card"
            onClick={() => onSectionChange("weapons")}
            type="button"
          >
            <span className="loadout-category-icon" aria-hidden="true">◇</span>
            <span><b>Weapons</b><small>{data.weapons.length} owned</small></span>
            <span className="loadout-category-arrow" aria-hidden="true">→</span>
          </button>
          <button
            className="loadout-category-card"
            onClick={() => onSectionChange("artifacts")}
            type="button"
          >
            <span className="loadout-category-icon" aria-hidden="true">✧</span>
            <span><b>Artifacts</b><small>{data.artifacts.length} owned</small></span>
            <span className="loadout-category-arrow" aria-hidden="true">→</span>
          </button>
          <button
            className="loadout-category-card optimizer-category-card"
            onClick={onOptimizerOpen}
            type="button"
          >
            <span className="loadout-category-icon" aria-hidden="true">✦</span>
            <span><b>Team Optimizer</b><small>Build four-character presets</small></span>
            <span className="loadout-category-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function LoadoutInventoryPage({ kind, data, catalogData, onBack, onRemove }) {
  const [search, setSearch] = useState("");
  const isArtifact = kind === "artifacts";
  const inventory = isArtifact ? data.artifacts : data.weapons;
  const title = isArtifact ? "Artifacts" : "Weapons";
  const normalizedQuery = search.trim().toLocaleLowerCase();

  const filteredInventory = inventory.filter((entry) => {
    const good = entry.source === "GOOD" ? entry.good : null;
    const record = isArtifact
      ? catalogData.artifacts?.find((item) => String(item.id) === String(entry.catalogId))
      : catalogData.weapons?.find((item) => String(item.id) === String(entry.catalogId));
    const name = record?.name || (isArtifact ? entry.setName : entry.name) || "";
    const slot = isArtifact
      ? ARTIFACT_SLOT_LABELS[good?.slotKey || entry.slot] || ""
      : record?.weaponType || entry.weaponType || "";
    const details = isArtifact
      ? [
          good ? formatGoodStat(good.mainStatKey) : entry.mainStat,
          ...(good?.substats || []).map((stat) => formatGoodStat(stat.key, stat.value)),
          ...(entry.substats || []),
        ].join(" ")
      : `${slot} ${good ? `R${good.refinement}` : `R${entry.refinement}`}`;
    return `${name} ${slot} ${details}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  return (
    <main className="loadout-page loadout-inventory-page">
      <button className="detail-back" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> Back to My Loadout
      </button>
      <section className="loadout-intro">
        <div>
          <p className="eyebrow"><span>PERSONAL INVENTORY</span> &nbsp; SAVED ON THIS DEVICE</p>
          <h1>{title}</h1>
          <p>Search, review, and manage the {title.toLowerCase()} in your local inventory.</p>
        </div>
        <div className="loadout-counts">
          <span><b>{inventory.length}</b> {title.toLowerCase()}</span>
        </div>
      </section>
      <label className="loadout-search">
        <span className="search-icon" aria-hidden="true" />
        <span className="visually-hidden">Search {title.toLowerCase()}</span>
        <input
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          type="search"
          value={search}
        />
        {search && (
          <button aria-label="Clear search" onClick={() => setSearch("")} type="button">×</button>
        )}
      </label>
      <p className="loadout-search-count">
        {filteredInventory.length} of {inventory.length} {title.toLowerCase()}
      </p>
      {filteredInventory.length ? (
        <ul className={`loadout-entry-list loadout-inventory-list ${isArtifact ? "artifact-loadout-list" : ""}`}>
          {filteredInventory.map((entry) => {
            const good = entry.source === "GOOD" ? entry.good : null;
            if (isArtifact) {
              const slotKey = good?.slotKey || entry.slot;
              const artifactSet = catalogData.artifacts?.find(
                (artifact) => String(artifact.id) === String(entry.catalogId),
              );
              const piece = artifactSet?.pieces?.[slotKey];
              const name = artifactSet?.name || entry.setName;
              const slot = ARTIFACT_SLOT_LABELS[slotKey] || slotKey;
              return (
                <li className="loadout-entry artifact-loadout-entry" key={entry.id}>
                  <div className="artifact-loadout-image">
                    {piece?.localImagePath ? (
                      <img src={`./assets/${piece.localImagePath}`} alt={`${name} ${slot}`} />
                    ) : (
                      <span aria-hidden="true">✧</span>
                    )}
                  </div>
                  <div className="loadout-entry-copy">
                    <b>{name} · {slot}</b>
                    <span>
                      {good
                        ? `${good.rarity}★ · +${good.level} · ${formatGoodStat(good.mainStatKey)}` +
                          (good.location ? ` · Equipped: ${good.location}` : "")
                        : `${entry.rarity}★ · +${entry.level} · ${entry.mainStat}`}
                    </span>
                    {good?.substats?.length > 0 && (
                      <small>{good.substats.map((stat) => formatGoodStat(stat.key, stat.value)).join(" · ")}</small>
                    )}
                    {!good && entry.substats.length > 0 && (
                      <small>{entry.substats.join(" · ")}</small>
                    )}
                  </div>
                  <button
                    aria-label={`Remove ${name} ${slot}`}
                    onClick={() => onRemove("artifacts", entry.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              );
            }

            const weapon = catalogData.weapons?.find(
              (item) => String(item.id) === String(entry.catalogId),
            );
            const name = weapon?.name || entry.name;
            return (
              <li className="loadout-entry weapon-loadout-entry" key={entry.id}>
                <div className="weapon-loadout-image">
                  {weapon ? (
                    <img src={weaponImagePath(weapon.name)} alt="" />
                  ) : (
                    <span aria-hidden="true">◇</span>
                  )}
                </div>
                <div className="loadout-entry-copy">
                  <b>{name}</b>
                  <span>
                    {good
                      ? `${weapon?.weaponType || ""} · Lv. ${good.level} · A${good.ascension} · R${good.refinement}` +
                        (good.location ? ` · Equipped: ${good.location}` : "")
                      : `${weapon?.weaponType || entry.weaponType} · ${entry.rarity}★ · Lv. ${entry.level} · A${entry.ascension} · R${entry.refinement}`}
                  </span>
                </div>
                <button
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove("weapons", entry.id)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state loadout-filter-empty">
          <span className="empty-star">✧</span>
          <h2>{inventory.length ? "No matching items" : `No ${title.toLowerCase()} yet`}</h2>
          <p>{inventory.length ? "Try another search." : "Add items from My Loadout using manual entry or a GOOD file."}</p>
        </div>
      )}
    </main>
  );
}

function ProfileFact({ label, value }) {
  return (
    <div className="profile-fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value || "Unknown"}</span>
    </div>
  );
}

function formatGrowthStat(value) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—";
}

function formatSpecializedStat(value, statName) {
  if (!Number.isFinite(value)) return "—";
  if (/elemental mastery/i.test(statName || "")) return formatGrowthStat(value);
  return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function ascensionUnlockLevel(stage) {
  return stage === 1 ? 20 : stage * 10 + 20;
}

function ProgressionTable({ headers, rows, className = "" }) {
  if (!rows.length) return <p className="detail-empty">Progression data is not available.</p>;
  return (
    <div className={`progression-table-wrap ${className}`}>
      <table className="progression-table">
        <thead>
          <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${row[1] || index}-${index}`}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialList({ materials }) {
  if (!materials?.length) return <p className="detail-empty">No materials listed for this stage.</p>;
  return (
    <ul className="material-list">
      {materials.map((material) => (
        <li key={`${material.id}-${material.name}`}>
          <span>{material.name}</span>
          <b>×{material.count.toLocaleString()}</b>
        </li>
      ))}
    </ul>
  );
}

function MaterialCosts({ title, costs, getStageTitle }) {
  const stages = Object.entries(costs || {}).filter(([, materials]) => Array.isArray(materials));
  if (!stages.length) return null;
  return (
    <details className="detail-section">
      <summary>{title}</summary>
      <div className="detail-section-content">
        {stages.map(([key, materials]) => (
          <details className="detail-subsection" key={key}>
            <summary>{getStageTitle(key)}</summary>
            <MaterialList materials={materials} />
          </details>
        ))}
      </div>
    </details>
  );
}

function formatTalentValue(template, parameters, levelIndex) {
  return template.replace(/\{param(\d+):([^}]+)\}/g, (match, parameterId, format) => {
    const value = parameters[`param${parameterId}`]?.[levelIndex];
    if (!Number.isFinite(value)) return "—";
    if (format.includes("P")) {
      const precision = Number(format.match(/F(\d+)/)?.[1] ?? 1);
      return `${(value * 100).toFixed(precision)}%`;
    }
    const precision = Number(format.match(/F(\d+)/)?.[1] ?? 2);
    return value.toFixed(precision);
  });
}

function TalentDetails({ talent, defaultOpen = false }) {
  const labels = talent.attributes?.labels || [];
  const parameters = talent.attributes?.parameters || {};
  const levels = Math.max(
    0,
    ...Object.values(parameters).filter(Array.isArray).map((values) => values.length),
  );
  const rows = labels.map((label) => {
    const [name, formula = ""] = label.split("|");
    return [
      name,
      ...Array.from({ length: levels }, (_, levelIndex) =>
        formula ? formatTalentValue(formula, parameters, levelIndex) : "—",
      ),
    ];
  });

  return (
    <details className="detail-subsection talent-detail" open={defaultOpen}>
      <summary>{talent.name}</summary>
      <div className="detail-subsection-content">
        <p className="talent-description">{talent.description || "No description available."}</p>
        {rows.length > 0 ? (
          <ProgressionTable
            className="talent-progression"
            headers={["Talent scaling", ...Array.from({ length: levels }, (_, index) => `Lv. ${index + 1}`)]}
            rows={rows}
          />
        ) : (
          <p className="detail-empty">No level-by-level multipliers are listed for this talent.</p>
        )}
      </div>
    </details>
  );
}

function CharacterProgression({ character }) {
  const progression = [...new Map(
    (character.ascensionStats || []).map((entry) => [JSON.stringify(entry), entry]),
  ).values()];
  const statRows = progression.map((entry) => [
    entry.level,
    `A${entry.ascension}`,
    formatGrowthStat(entry.hp),
    formatGrowthStat(entry.attack),
    formatGrowthStat(entry.defense),
    formatSpecializedStat(entry.specialized, character.substat),
  ]);
  const maxLevel = Math.max(0, ...progression.map((entry) => entry.level));

  return (
    <div className="progression-sections">
      <details className="detail-section" open>
        <summary>Level &amp; ascension growth · Lv. 1–{maxLevel || 90}</summary>
        <div className="detail-section-content">
          <p className="detail-note">
            Base stats at each level and ascension breakpoint provided in the archive.
            Ascension rank is shown as A0–A6; values are not estimated between breakpoints.
          </p>
          <ProgressionTable
            headers={["Level", "Asc.", "HP", "ATK", "DEF", character.substat || "Bonus"]}
            rows={statRows}
          />
        </div>
      </details>

      <details className="detail-section" open>
        <summary>Combat talents &amp; multipliers</summary>
        <div className="detail-section-content">
          {(character.combatTalents || []).length ? (
            character.combatTalents.map((talent, index) => (
              <TalentDetails
                key={talent.slot || talent.name}
                talent={talent}
                defaultOpen={index === 0}
              />
            ))
          ) : (
            <p className="detail-empty">Combat talent data is not available for this character.</p>
          )}
        </div>
      </details>

      <details className="detail-section" open>
        <summary>Passive talents</summary>
        <div className="detail-section-content">
          {(character.passives || []).length ? (
            character.passives.map((passive) => (
              <article className="passive-entry" key={passive.slot || passive.name}>
                <h3>{passive.name}</h3>
                <p>{passive.description || "No description available."}</p>
              </article>
            ))
          ) : (
            <p className="detail-empty">Passive talent data is not available for this character.</p>
          )}
        </div>
      </details>

      <details className="detail-section">
        <summary>Constellations</summary>
        <div className="detail-section-content">
          {(character.constellations || []).length ? (
            character.constellations.map((constellation) => (
              <article className="passive-entry" key={constellation.level}>
                <h3>{constellation.level} · {constellation.name}</h3>
                <p>{constellation.description || "No description available."}</p>
              </article>
            ))
          ) : (
            <p className="detail-empty">Constellation data is not available for this character.</p>
          )}
        </div>
      </details>

      <MaterialCosts
        title="Character ascension materials"
        costs={character.ascensionCosts}
        getStageTitle={(key) => {
          const stage = Number(key.replace("ascend", ""));
          return `Ascension ${stage} · unlock level ${Math.min(ascensionUnlockLevel(stage), maxLevel || 90)}`;
        }}
      />
      <MaterialCosts
        title="Talent upgrade materials"
        costs={character.talentUpgradeCosts}
        getStageTitle={(key) => `Talent level ${key.replace("lvl", "")}`}
      />
    </div>
  );
}

function WeaponRefinements({ weapon }) {
  const refinements = weapon.refinements?.length
    ? weapon.refinements
    : Array.from({ length: 5 }, (_, index) => weapon[`r${index + 1}`])
      .map((refinement, index) => refinement && ({ ...refinement, rank: index + 1 }))
      .filter(Boolean);

  return (
    <details className="detail-section" open>
      <summary>{weapon.effectName || "Weapon refinement"} · R1–R5</summary>
      <div className="detail-section-content refinement-list">
        {refinements.length ? (
          refinements.map((refinement) => (
            <article className="passive-entry refinement-entry" key={refinement.rank}>
              <h3>Refinement {refinement.rank}</h3>
              <p>{refinement.description || "No refinement description available."}</p>
              {refinement.values?.length > 0 && (
                <p className="refinement-values">
                  {refinement.values.map((value, index) => (
                    <span key={`${value}-${index}`}>Effect {index + 1}: {value}</span>
                  ))}
                </p>
              )}
            </article>
          ))
        ) : (
          <p className="detail-empty">
            This weapon has no refinement effects listed in the available data.
          </p>
        )}
      </div>
    </details>
  );
}

function WeaponProgression({ weapon }) {
  const progression = [...new Map(
    (weapon.ascensionStats || []).map((entry) => [JSON.stringify(entry), entry]),
  ).values()];
  const statRows = progression.map((entry) => [
    entry.level,
    `A${entry.ascension}`,
    formatGrowthStat(entry.attack),
    weapon.baseStatText?.includes("%")
      ? formatSpecializedStat(entry.specialized, weapon.mainStat)
      : formatGrowthStat(entry.specialized),
  ]);
  const maxLevel = Math.max(0, ...progression.map((entry) => entry.level));

  return (
    <div className="progression-sections">
      <details className="detail-section" open>
        <summary>Weapon level &amp; ascension · Lv. 1–{maxLevel || 90}</summary>
        <div className="detail-section-content">
          <p className="detail-note">
            Base attack and secondary stat at each level and ascension breakpoint present in the archive.
            Ascension rank is shown as A0–A6.
          </p>
          <ProgressionTable
            headers={["Level", "Asc.", "Base ATK", weapon.mainStat || "Secondary"]}
            rows={statRows}
          />
        </div>
      </details>
      <MaterialCosts
        title="Weapon ascension materials"
        costs={weapon.ascensionCosts}
        getStageTitle={(key) => {
          const stage = Number(key.replace("ascend", ""));
          return `Ascension ${stage} · unlock level ${Math.min(ascensionUnlockLevel(stage), maxLevel || 90)}`;
        }}
      />
    </div>
  );
}

function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount < 2) return null;

  return (
    <nav className="pagination" aria-label="Catalog pages">
      <button
        className="page-button page-arrow"
        type="button"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ←
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
        <button
          className={`page-button${pageNumber === page ? " active" : ""}`}
          type="button"
          aria-label={`Page ${pageNumber}`}
          aria-current={pageNumber === page ? "page" : undefined}
          key={pageNumber}
          onClick={() => onPageChange(pageNumber)}
        >
          {formatCount(pageNumber)}
        </button>
      ))}
      <button
        className="page-button page-arrow"
        type="button"
        aria-label="Next page"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        →
      </button>
    </nav>
  );
}

function SiteFooter({ catalog }) {
  return (
    <footer className="site-footer">
      <span>
        TEYVAT NEXUS <i>·</i>{" "}
        {catalog === "loadout"
          ? "MY LOADOUT"
          : catalog === "optimizer"
          ? "TEAM OPTIMIZER"
          : catalog === "dps-calculator"
          ? "DPS CALCULATOR"
          : `${CATALOGS[catalog === "home" ? "characters" : catalog].label.toUpperCase()} ARCHIVE`}
      </span>
      <span>AN UNOFFICIAL FAN PROJECT</span>
    </footer>
  );
}

function ResourceCard({ catalog, item, onSelect }) {
  if (catalog === "characters") {
    return (
      <CharacterCard
        character={item}
        onSelect={onSelect}
      />
    );
  }
  if (catalog === "weapons") {
    return <WeaponCard weapon={item} onSelect={onSelect} />;
  }
  return <ArtifactCard artifact={item} onSelect={onSelect} />;
}

function readArchiveRoute() {
  const match = window.location.hash.match(/^#\/(home|characters|weapons|artifacts|loadout|optimizer|dps-calculator)(?:\/([^/]+))?$/);
  if (!match) return { catalog: "home", detailId: null, loadoutSection: null };
  if (match[1] === "loadout") {
    return {
      catalog: "loadout",
      detailId: null,
      loadoutSection: ["weapons", "artifacts"].includes(match[2]) ? match[2] : null,
    };
  }
  let detailId = null;
  if (match[2]) {
    try {
      detailId = decodeURIComponent(match[2]);
    } catch (error) {
      console.error("Could not decode the catalog detail route.", error);
    }
  }
  return { catalog: match[1], detailId, loadoutSection: null };
}

export default function App() {
  const [route, setRoute] = useState(readArchiveRoute);
  const catalog = route.catalog;
  const activeCatalog = catalog === "home" || catalog === "loadout" || catalog === "optimizer" || catalog === "dps-calculator"
    ? "characters"
    : catalog;
  const [catalogData, setCatalogData] = useState({});
  const [loadErrors, setLoadErrors] = useState({});
  const [loadingCatalog, setLoadingCatalog] = useState("");
  const [archiveCounts, setArchiveCounts] = useState({});
  const [countError, setCountError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [loadoutState, setLoadoutState] = useState(readSavedLoadout);
  const [loadoutNotice, setLoadoutNotice] = useState("");
  const searchRef = useRef(null);
  const current = CATALOGS[activeCatalog];
  const currentData = catalogData[activeCatalog] || [];
  const currentError = loadErrors[activeCatalog] || "";

  useEffect(() => {
    function syncRoute() {
      setRoute(readArchiveRoute());
    }
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJson("./catalog-index.json", "Catalog index")
      .then((counts) => {
        if (
          !counts ||
          ["characters", "weapons", "artifacts"].some(
            (key) => !Number.isInteger(counts[key]),
          )
        ) {
          throw new Error("Catalog index does not contain valid collection counts.");
        }
        if (!cancelled) setArchiveCounts(counts);
      })
      .catch((error) => {
        if (!cancelled) {
          setCountError(
            `${error instanceof Error ? error.message : "Unknown catalog index error."} ` +
              "Collection counts are unavailable.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (catalogData[activeCatalog] || loadErrors[activeCatalog]) return undefined;
    let cancelled = false;

    async function loadCurrentCatalog() {
      setLoadingCatalog(activeCatalog);
      try {
        const entries = await loadCatalog(activeCatalog);
        if (!cancelled) {
          setCatalogData((existing) => ({ ...existing, [activeCatalog]: entries }));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadErrors((existing) => ({
            ...existing,
            [activeCatalog]: `${error instanceof Error ? error.message : "Unknown catalog loading error."} ` +
              "Make sure the app is served with npm run dev.",
          }));
        }
      } finally {
        if (!cancelled) setLoadingCatalog("");
      }
    }

    loadCurrentCatalog();
    return () => {
      cancelled = true;
    };
  }, [activeCatalog, catalogData, loadErrors]);

  useEffect(() => {
    if (catalog !== "loadout" && catalog !== "optimizer" && catalog !== "dps-calculator") return undefined;
    let cancelled = false;
    ["weapons", "artifacts"].forEach((resource) => {
      if (catalogData[resource] || loadErrors[resource]) return;
      loadCatalog(resource)
        .then((entries) => {
          if (!cancelled) {
            setCatalogData((existing) => ({ ...existing, [resource]: entries }));
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setLoadErrors((existing) => ({
              ...existing,
              [resource]: error instanceof Error ? error.message : `Could not load ${resource} names.`,
            }));
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, catalogData, loadErrors]);

  useEffect(() => {
    if (
      catalog !== "loadout" ||
      !catalogData.weapons ||
      !catalogData.artifacts
    ) return;
    const normalized = normalizeSavedLoadout(loadoutState.data, {
      weapons: catalogData.weapons,
      artifacts: catalogData.artifacts,
    });
    if (JSON.stringify(normalized.data) === JSON.stringify(loadoutState.data)) return;
    let error = "";
    try {
      saveLoadout(normalized.data);
    } catch (saveError) {
      error = `Could not update saved loadout data: ${
        saveError instanceof Error ? saveError.message : "browser storage is unavailable."
      }`;
    }
    setLoadoutState({ data: normalized.data, error });
    const removed = normalized.removedWeapons + normalized.removedArtifacts;
    setLoadoutNotice(
      removed
        ? `${removed} saved entr${removed === 1 ? "y was" : "ies were"} removed because they are not in the current catalogs.`
        : "",
    );
  }, [catalog, catalogData, loadoutState.data]);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const detail = catalog !== "home" && catalogData[catalog]?.find(
      (item) => String(item.id) === String(route.detailId),
    );
    document.title = catalog === "optimizer"
      ? "Team Optimizer | Teyvat Nexus"
      : catalog === "dps-calculator"
      ? "DPS Calculator | Teyvat Nexus"
      : catalog === "loadout"
      ? `${route.loadoutSection ? `${route.loadoutSection[0].toUpperCase()}${route.loadoutSection.slice(1)} | ` : ""}My Loadout | Teyvat Nexus`
      : detail
      ? `${detail.name} | ${current.label} | Teyvat Nexus`
      : catalog === "home"
        ? "Teyvat Nexus | Character, Weapon & Artifact Archive"
        : `${current.label} Archive | Teyvat Nexus`;
  }, [catalog, catalogData, current.label, route.detailId, route.loadoutSection]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = currentData.filter((item) => {
      let matchesFilter = true;
      if (activeCatalog === "characters" && selectedFilter !== "all") {
        matchesFilter = item.element === selectedFilter;
      } else if (activeCatalog === "weapons" && selectedFilter !== "all") {
        matchesFilter = item.weaponType === selectedFilter;
      } else if (activeCatalog === "artifacts" && selectedFilter !== "all") {
        matchesFilter = (item.rarityList || []).includes(Number(selectedFilter));
      }
      const matchesRarity =
        rarity === "all" || String(item.rarity) === rarity ||
        (activeCatalog === "artifacts" && (item.rarityList || []).includes(Number(rarity)));
      const matchesSearch =
        !query ||
        CATALOGS[activeCatalog].fields.some((field) => {
          const value = item[field];
          return Array.isArray(value)
            ? value.some((part) => String(part).toLocaleLowerCase().includes(query))
            : String(value || "").toLocaleLowerCase().includes(query);
        }) ||
        (activeCatalog === "artifacts" &&
          Object.values(item.pieces || {}).some((piece) =>
            piece.name.toLocaleLowerCase().includes(query),
          ));
      return matchesFilter && matchesRarity && matchesSearch;
    });

    return filtered.sort((a, b) => {
      if (sort === "rarity-desc") {
        return getItemRarity(b, activeCatalog) - getItemRarity(a, activeCatalog) ||
          a.name.localeCompare(b.name);
      }
      if (sort === "rarity-asc") {
        return getItemRarity(a, activeCatalog) - getItemRarity(b, activeCatalog) ||
          a.name.localeCompare(b.name);
      }
      if (sort === "version-desc") {
        return (b.version || "").localeCompare(a.version || "", undefined, { numeric: true }) ||
          a.name.localeCompare(b.name);
      }
      if (sort === "attack-desc") {
        return (b.baseAttack || 0) - (a.baseAttack || 0) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [activeCatalog, currentData, rarity, search, selectedFilter, sort]);

  const pageCount = Math.ceil(filteredItems.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  function resetPage(update) {
    update();
    setPage(1);
  }

  function changeCatalog(nextCatalog) {
    const nextRoute = { catalog: nextCatalog, detailId: null, loadoutSection: null };
    window.history.pushState({}, "", `#/${nextCatalog}`);
    setRoute(nextRoute);
    setSelectedFilter("all");
    setRarity("all");
    setSearch("");
    setSort("name");
    setPage(1);
  }

  function changeLoadoutSection(section) {
    window.history.pushState({}, "", section ? `#/loadout/${section}` : "#/loadout");
    setRoute({ catalog: "loadout", detailId: null, loadoutSection: section });
  }

  function persistLoadout(data) {
    let error = "";
    try {
      saveLoadout(data);
    } catch (saveError) {
      error = `Could not save this loadout on this device: ${
        saveError instanceof Error ? saveError.message : "browser storage is unavailable."
      }`;
    }
    setLoadoutState({ data, error });
    return !error;
  }

  function importGoodInventory(imported) {
    const result = mergeGoodInventory(loadoutState.data, imported, {
      weapons: catalogData.weapons || [],
      artifacts: catalogData.artifacts || [],
    });
    const saved = persistLoadout(result.data);
    return {
      addedWeapons: result.addedWeapons,
      addedArtifacts: result.addedArtifacts,
      duplicates: imported.weapons.length + imported.artifacts.length -
        result.addedWeapons - result.addedArtifacts -
        result.unrecognizedWeapons - result.unrecognizedArtifacts,
      unrecognizedWeapons: result.unrecognizedWeapons,
      unrecognizedArtifacts: result.unrecognizedArtifacts,
      saved,
    };
  }

  function addManualEntry(kind, entry) {
    const recognized = kind === "weapons"
      ? catalogData.weapons?.some((item) => String(item.id) === entry.catalogId)
      : catalogData.artifacts?.some(
        (item) =>
          String(item.id) === entry.catalogId &&
          (item.rarityList || []).includes(entry.rarity),
      );
    if (!recognized) {
      setLoadoutState((existing) => ({
        ...existing,
        error: "Only weapons and artifacts present in the current catalogs can be added.",
      }));
      return;
    }
    const next = {
      ...loadoutState.data,
      [kind]: [...loadoutState.data[kind], { id: makeLoadoutId(), ...entry }],
    };
    persistLoadout(next);
  }

  function removeLoadoutEntry(kind, id) {
    const next = {
      ...loadoutState.data,
      [kind]: loadoutState.data[kind].filter((entry) => entry.id !== id),
    };
    persistLoadout(next);
  }

  function openDetail(itemId) {
    const encodedId = encodeURIComponent(itemId);
    window.history.pushState(
      { archiveDetail: true },
      "",
      `#/${activeCatalog}/${encodedId}`,
    );
    setRoute({ catalog: activeCatalog, detailId: itemId });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function backToCatalog() {
    if (window.history.state?.archiveDetail) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", `#/${activeCatalog}`);
    setRoute({ catalog: activeCatalog, detailId: null });
  }

  const isLoading = loadingCatalog === activeCatalog && !currentData.length && !currentError;
  const detailItem = route.detailId
    ? (catalogData[activeCatalog] || []).find(
      (item) => String(item.id) === String(route.detailId),
    )
    : null;
  const landingCounts = {
    characters: catalogData.characters?.length ?? archiveCounts.characters,
    weapons: catalogData.weapons?.length ?? archiveCounts.weapons,
    artifacts: catalogData.artifacts?.length ?? archiveCounts.artifacts,
  };

  return (
    <div className="site-shell" id="archive">
      <ArchiveHeader
        catalog={catalog}
        dataCatalog={activeCatalog}
        items={currentData}
        onCatalogChange={changeCatalog}
        onLoadoutOpen={() => changeCatalog("loadout")}
        onOptimizerOpen={() => changeCatalog("optimizer")}
      />
      {catalog === "home" ? (
        <LandingPage
          counts={landingCounts}
          countError={countError}
          onCatalogChange={changeCatalog}
        />
      ) : catalog === "loadout" ? (
        route.loadoutSection ? (
          <LoadoutInventoryPage
            kind={route.loadoutSection}
            data={loadoutState.data}
            catalogData={catalogData}
            onBack={() => changeLoadoutSection(null)}
            onRemove={removeLoadoutEntry}
          />
        ) : (
          <LoadoutPage
            data={loadoutState.data}
            storageError={loadoutState.error}
            storageNotice={loadoutNotice}
            catalogData={catalogData}
            catalogLoading={!loadErrors.weapons && !loadErrors.artifacts &&
              (!catalogData.weapons || !catalogData.artifacts)}
            catalogError={loadErrors.weapons || loadErrors.artifacts || ""}
            onImport={importGoodInventory}
            onAdd={addManualEntry}
            onSectionChange={changeLoadoutSection}
            onOptimizerOpen={() => changeCatalog("optimizer")}
          />
        )
      ) : catalog === "optimizer" ? (
        <TeamOptimizerPage
          characters={catalogData.characters || []}
          weapons={catalogData.weapons || []}
          artifacts={catalogData.artifacts || []}
          inventory={loadoutState.data}
          loading={!catalogData.characters || !catalogData.weapons || !catalogData.artifacts}
          error={loadErrors.characters || loadErrors.weapons || loadErrors.artifacts || ""}
          onBack={() => changeCatalog("loadout")}
        />
      ) : catalog === "dps-calculator" ? (
        <DpsCalculatorPage
          characters={catalogData.characters || []}
          weapons={catalogData.weapons || []}
          artifacts={catalogData.artifacts || []}
          inventory={loadoutState.data}
          loading={!catalogData.characters || !catalogData.weapons || !catalogData.artifacts}
          error={loadErrors.characters || loadErrors.weapons || loadErrors.artifacts || ""}
          onBack={() => changeCatalog("optimizer")}
        />
      ) : route.detailId ? (
        detailItem ? (
          <ArchiveDetailPage
            catalog={activeCatalog}
            item={detailItem}
            onBack={backToCatalog}
          />
        ) : currentError ? (
          <main className="archive-detail-page">
            <button className="detail-back" onClick={backToCatalog} type="button">
              <span aria-hidden="true">←</span> Back to {current.label}
            </button>
            <div className="error-state" role="alert">{currentError}</div>
          </main>
        ) : isLoading ? (
          <main className="archive-detail-page">
            <p className="detail-loading">Loading {current.label.toLowerCase()} details...</p>
          </main>
        ) : (
          <main className="archive-detail-page">
            <button className="detail-back" onClick={backToCatalog} type="button">
              <span aria-hidden="true">←</span> Back to {current.label}
            </button>
            <div className="empty-state">
              <span className="empty-star">✧</span>
              <h2>Record not found</h2>
              <p>This record is not available in the current archive.</p>
            </div>
          </main>
        )
      ) : (
      <main>
        <section className="archive-layout" aria-label={`${current.label} catalog`}>
          <div className="catalog-column">
            <CatalogFilters
              catalog={catalog}
              selectedFilter={selectedFilter}
              onSelect={(value) => resetPage(() => setSelectedFilter(value))}
            />
            <CatalogToolbar
              catalog={catalog}
              search={search}
              setSearch={(value) => resetPage(() => setSearch(value))}
              rarity={rarity}
              setRarity={(value) => resetPage(() => setRarity(value))}
              sort={sort}
              setSort={(value) => resetPage(() => setSort(value))}
              searchRef={searchRef}
            />
            <div className="results-line">
              <span>
                {currentError
                  ? "ARCHIVE UNAVAILABLE"
                  : isLoading
                    ? `Loading ${current.label.toLowerCase()}...`
                    : `${formatCount(filteredItems.length)} RECORD${filteredItems.length === 1 ? "" : "S"} FOUND`}
              </span>
              <span className="results-hint">
                SELECT {catalog === "artifacts" ? "AN" : "A"} {current.singular.toUpperCase()} TO VIEW DETAILS
              </span>
            </div>
            {currentError ? (
              <div className="error-state" role="alert">{currentError}</div>
            ) : pageItems.length ? (
              <div className={`character-grid ${catalog}-grid`} aria-live="polite">
                {pageItems.map((item) => (
                  <ResourceCard
                    catalog={catalog}
                    item={item}
                    key={item.id}
                    onSelect={openDetail}
                  />
                ))}
              </div>
            ) : !isLoading ? (
              <div className="empty-state">
                <span className="empty-star">✧</span>
                <h2>No records found</h2>
                <p>Try another name or adjust your filters.</p>
              </div>
            ) : null}
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </section>
      </main>
      )}
      <SiteFooter catalog={catalog} />
    </div>
  );
}
