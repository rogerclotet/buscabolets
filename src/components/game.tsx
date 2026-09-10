"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  ABILITIES,
  SPECIES,
  STAMINA_TURNS,
  clue,
  collectedCount,
  initialSave,
  isCollected,
  mushroomAt,
  parseSave,
  speciesList,
  tapsRemaining,
  totalCollected,
  transition,
  type Action,
  type Save,
  type Tool,
} from "@/lib/game";
import { ForestArt, Icon, MushroomArt, Sprout } from "./art";
import { PwaUpdate } from "./pwa-update";

const STORAGE_KEY = "buscabolets-v1";
const WELCOME_KEY = "buscabolets-welcome-v1";
type Panel =
  | "guide"
  | "collection"
  | "stats"
  | "install"
  | "restart"
  | "reward"
  | "ended"
  | null;
type State = {
  save: Save;
  ready: boolean;
  storageOk: boolean;
  welcome: boolean;
};
type Event =
  | { kind: "load"; save: Save; storageOk: boolean; welcome: boolean }
  | { kind: "dismiss-welcome" }
  | { kind: "action"; action: Action }
  | { kind: "storage-error" };
function reducer(state: State, event: Event): State {
  switch (event.kind) {
    case "load":
      return {
        save: event.save,
        ready: true,
        storageOk: event.storageOk,
        welcome: event.welcome,
      };
    case "dismiss-welcome":
      return { ...state, welcome: false };
    case "action":
      return { ...state, save: transition(state.save, event.action) };
    case "storage-error":
      return { ...state, storageOk: false };
  }
}
function makeSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
}
function Dialog({
  children,
  onClose,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Tanca"
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
function playNote() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      760,
      audio.currentTime + 0.09,
    );
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);
    oscillator.onended = () => {
      void audio.close();
    };
  } catch {
    /* Sound is optional if the device does not support Web Audio. */
  }
}
export default function Game() {
  const [state, dispatch] = useReducer(reducer, {
    save: initialSave(),
    ready: false,
    storageOk: true,
    welcome: false,
  });
  const [tool, setTool] = useState<Tool>("pick");
  const [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(false);
  const [focusTile, setFocusTile] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const { run, totals } = state.save;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const restored = saved ? parseSave(saved) : null;
      const welcome = !restored && localStorage.getItem(WELCOME_KEY) !== "seen";
      dispatch({
        kind: "load",
        save: restored ?? initialSave(makeSeed()),
        storageOk: true,
        welcome,
      });
    } catch {
      dispatch({
        kind: "load",
        save: initialSave(makeSeed()),
        storageOk: false,
        welcome: true,
      });
    }
  }, []);
  useEffect(() => {
    if (!state.ready || !state.storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
    } catch {
      dispatch({ kind: "storage-error" });
    }
  }, [state.save, state.ready, state.storageOk]);
  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_KEY, "seen");
    } catch {
      // The introduction can still be dismissed when storage is unavailable.
    }
    dispatch({ kind: "dismiss-welcome" });
  };
  const act = (action: Action) => {
    // Never apply a move to the placeholder run before restoring browser storage.
    if (!state.ready) return;
    if (action.type === "compass") {
      setTool("pick");
      requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      });
    }
    const next = transition(state.save, action);
    if (next === state.save) return;
    dispatch({ kind: "action", action });
    if (sound && action.type === "tile" && action.tool !== "flag") playNote();
    if (next.run.phase === "reward") setPanel("reward");
    if (next.run.phase === "ended") setPanel("ended");
  };
  const restart = () => {
    act({ type: "new", seed: makeSeed() });
    setTool("pick");
    setPanel(null);
  };
  const found = collectedCount(run);
  const percent = (run.turns / run.budget) * 100;
  const levelsBeaten =
    run.level -
    1 +
    (run.phase === "reward" || run.mushrooms.every(isCollected) ? 1 : 0);
  const panelTitle =
    panel === "stats"
      ? "El teu quadern"
      : panel === "collection"
        ? "El boletari"
        : panel === "reward"
          ? "Tria un talent"
          : panel === "ended"
            ? "Final de l'excursió"
            : "Informació";
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Buscabolets, inici">
          <span className="brand-mark">
            <MushroomArt size={39} />
          </span>
          <span>
            buscabolets<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Navegació principal">
          <button
            className={
              panel !== "collection" && panel !== "stats"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setPanel(null)}
          >
            <Icon name="compass" size={19} />
            L’excursió
          </button>
          <button
            className={`nav-item ${panel === "collection" ? "active" : ""}`}
            onClick={() => setPanel("collection")}
          >
            <Icon name="basket" size={19} />
            El boletari
          </button>
          <button
            className={`nav-item ${panel === "stats" ? "active" : ""}`}
            onClick={() => setPanel("stats")}
          >
            <Icon name="chart" size={19} />
            El meu quadern
          </button>
        </nav>
        <button
          className="help-button"
          aria-label="Com s’hi juga"
          onClick={() => setPanel("guide")}
        >
          <Icon name="help" size={19} />
          <span>Com s’hi juga</span>
        </button>
      </header>
      <main>
        <div className="game-heading">
          <div className="section-heading">
            <span className="mini-icon">
              <Icon name="compass" />
            </span>
            <div>
              <h1>La teva excursió</h1>
              <p>Un racó de bosc ple de possibilitats.</p>
            </div>
          </div>
          <button
            className="text-button"
            onClick={() =>
              run.used > 0 && run.phase !== "ended"
                ? setPanel("restart")
                : restart()
            }
          >
            Nova excursió <Icon name="arrow" size={17} />
          </button>
        </div>
        <PwaUpdate
          saveProgress={() => {
            if (!state.ready) return false;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
              return true;
            } catch {
              dispatch({ kind: "storage-error" });
              return false;
            }
          }}
        />
        {!state.storageOk && (
          <p className="storage-warning" role="status">
            No podem desar el progrés en aquest navegador. Pots jugar, però es
            perdrà quan tanquis la pàgina.
          </p>
        )}
        <div className="game-layout">
          <section className="board-card" aria-label="Tauler de joc">
            <div className="board-top">
              <div className="level-label">
                <span className="level-number">
                  {String(run.level).padStart(2, "0")}
                </span>
                <div>
                  <span className="eyebrow">NIVELL {run.level}</span>
                  <h3>
                    {run.level < 3
                      ? "La clariana"
                      : run.level < 6
                        ? "El bosc endins"
                        : "El bosc dels secrets"}
                  </h3>
                </div>
              </div>
              <span className="weather">
                <Icon name="sun" size={18} />
                <span>
                  {run.level < 3
                    ? "Un bon dia per collir"
                    : "Encara queda camí"}
                </span>
              </span>
            </div>
            <div className="board-stats">
              <div>
                <Icon name="sun" size={20} />
                <span>
                  <strong className={run.turns < 10 ? "low-turns" : ""}>
                    {run.turns}
                  </strong>
                  <span> torns restants</span>
                </span>
              </div>
              <div>
                <MushroomArt size={23} />
                <span>
                  <strong>
                    {found}
                    <span className="stat-divider">
                      {" "}
                      / {run.mushrooms.length}
                    </span>
                  </strong>
                  <span> bolets</span>
                </span>
              </div>
              <div>
                <Icon name="spark" size={19} />
                <span>
                  <strong>{run.score}</strong>
                  <span> punts</span>
                </span>
              </div>
            </div>
            <div
              className="turn-track"
              role="meter"
              aria-label="Torns restants"
              aria-valuenow={run.turns}
              aria-valuemin={0}
              aria-valuemax={run.budget}
            >
              <span
                style={{ width: `${percent}%` }}
                className={percent < 25 ? "low" : ""}
              />
            </div>
            <div className={`board-surround tool-${tool}`}>
              <div
                className="board-grid"
                ref={boardRef}
                aria-label="Bosc de 10 per 10 caselles"
                aria-busy={!state.ready}
              >
                {Array.from({ length: 100 }, (_, index) => {
                  const revealed = run.revealed.includes(index);
                  const flagged = run.flags.includes(index);
                  const mushroom = mushroomAt(run, index);
                  const collected = mushroom && isCollected(mushroom);
                  const taps = tapsRemaining(run, index);
                  const needsPicking =
                    run.phase === "playing" &&
                    revealed &&
                    mushroom &&
                    SPECIES[mushroom.species].strength > 1 &&
                    taps > 0;
                  const endReveal = run.phase === "ended" && mushroom;
                  const number = revealed && !mushroom ? clue(run, index) : 0;
                  const coordinate = `${String.fromCharCode(65 + (index % 10))}${Math.floor(index / 10) + 1}`;
                  const description = flagged
                    ? "marcada"
                    : revealed || endReveal
                      ? mushroom
                        ? `${SPECIES[mushroom.species].name}, ${collected ? "collit" : taps > 0 ? `encara ${taps} ${taps === 1 ? "toc" : "tocs"} per collir, 1 torn per toc` : "meitat collida, falta la parella"}`
                        : number
                          ? `${number} caselles amb bolets a prop`
                          : "buida"
                      : "per explorar";
                  return (
                    <button
                      key={index}
                      tabIndex={focusTile === index ? 0 : -1}
                      onFocus={() => setFocusTile(index)}
                      aria-disabled={!state.ready || run.phase !== "playing"}
                      aria-label={`${coordinate}, ${description}`}
                      aria-describedby={
                        needsPicking ? "picking-help" : undefined
                      }
                      title={
                        needsPicking
                          ? `${SPECIES[mushroom.species].name}: ${taps} ${taps === 1 ? "toc més" : "tocs més"} per collir-lo`
                          : undefined
                      }
                      className={`tile ${revealed ? "revealed" : "covered"} ${collected ? "collected" : ""} ${needsPicking ? "needs-picking" : ""} ${endReveal && !revealed ? "missed" : ""} ${flagged ? "flagged" : ""} ${index === run.lastTile && run.used > 0 ? "last-tile" : ""}`}
                      onClick={() => {
                        act({ type: "tile", index, tool });
                        if (tool === "rake") setTool("pick");
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        act({ type: "tile", index, tool: "flag" });
                      }}
                      onKeyDown={(e) => {
                        const offsets: Record<string, number> = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -10,
                          ArrowDown: 10,
                        };
                        const offset = offsets[e.key];
                        if (offset !== undefined) {
                          e.preventDefault();
                          const next = Math.max(
                            0,
                            Math.min(99, index + offset),
                          );
                          boardRef.current
                            ?.querySelectorAll("button")
                            [next]?.focus();
                        }
                        if (e.key.toLowerCase() === "f") {
                          e.preventDefault();
                          act({ type: "tile", index, tool: "flag" });
                        }
                      }}
                    >
                      {(revealed || endReveal) && mushroom ? (
                        <>
                          <MushroomArt
                            color={SPECIES[mushroom.species].color}
                            size={30}
                          />
                          {needsPicking && (
                            <span className="picking-badge" aria-hidden="true">
                              <Icon name="hand" size={11} />
                              <span>×{taps}</span>
                            </span>
                          )}
                          {mushroom.species === "rossinyol" && (
                            <span className="pair-mark">
                              {mushroom.tiles[0] === index ? "1" : "2"}
                            </span>
                          )}
                          {collected && (
                            <span className="collected-check">✓</span>
                          )}
                        </>
                      ) : flagged ? (
                        <Icon name="flag" size={21} />
                      ) : revealed ? (
                        number > 0 ? (
                          <span className={`clue clue-${number}`}>
                            {number}
                          </span>
                        ) : (
                          <span className="empty-dot" />
                        )
                      ) : index % 7 === 0 || index % 13 === 0 ? (
                        <Sprout variant={index % 3} />
                      ) : (
                        <span className="tile-speck" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="board-tools">
              <div className="tool-switch" aria-label="Eina activa">
                <button
                  aria-pressed={tool === "pick"}
                  className={tool === "pick" ? "selected" : ""}
                  onClick={() => setTool("pick")}
                >
                  <Icon name="hand" size={17} />
                  Explora
                </button>
                <button
                  aria-pressed={tool === "flag"}
                  className={tool === "flag" ? "selected" : ""}
                  onClick={() => setTool("flag")}
                >
                  <Icon name="flag" size={16} />
                  Marca
                </button>
              </div>
              <div
                className="board-abilities"
                role="group"
                aria-label="Talents actius"
              >
                <button
                  className={`board-ability rake-action ${tool === "rake" ? "armed" : ""}`}
                  disabled={!run.rakeLeft || run.phase !== "playing"}
                  onClick={() => setTool(tool === "rake" ? "pick" : "rake")}
                  aria-pressed={tool === "rake"}
                  aria-label={`Rasclet del bosc, ${run.rakeLeft} de ${run.abilities.rake} usos. Explora 3 caselles amb 1 torn`}
                  title="Rasclet del bosc: 3 caselles amb 1 torn"
                >
                  <span className="ability-control-top">
                    <Icon name="rake" size={18} />
                    <span className="ability-uses" aria-hidden="true">
                      {run.rakeLeft}/{run.abilities.rake}
                    </span>
                  </span>
                  <span>Rasclet</span>
                </button>
                <button
                  className="board-ability hint-action"
                  disabled={!run.compassLeft || run.phase !== "playing"}
                  onClick={() => act({ type: "compass" })}
                  aria-label={`Olfacte boletaire, ${run.compassLeft} de ${run.abilities.compass} usos. Pista gratuïta`}
                  title="Olfacte boletaire: una pista sense gastar torns"
                >
                  <span className="ability-control-top">
                    <Icon name="compass" size={18} />
                    <span className="ability-uses" aria-hidden="true">
                      {run.compassLeft}/{run.abilities.compass}
                    </span>
                  </span>
                  <span>Pista</span>
                </button>
              </div>
            </div>
            {run.phase === "playing" &&
              run.revealed.some((index) => {
                const mushroom = mushroomAt(run, index);
                return (
                  mushroom &&
                  SPECIES[mushroom.species].strength > 1 &&
                  tapsRemaining(run, index) > 0
                );
              }) && (
                <div className="picking-legend" id="picking-help">
                  <span className="picking-badge" aria-hidden="true">
                    <Icon name="hand" size={13} />
                    <span>×2</span>
                  </span>
                  <p>
                    <strong>Torna a tocar per collir.</strong> El número de la
                    mà indica quants tocs falten. Cada toc costa 1 torn.
                  </p>
                </div>
              )}
            <div
              className="board-message"
              ref={feedbackRef}
              role="status"
              aria-live="polite"
            >
              <Icon name={tool === "rake" ? "rake" : "leaf"} size={17} />
              <span>
                {tool === "rake"
                  ? "Tria una casella: exploraràs també la seva esquerra i dreta."
                  : tool === "flag"
                    ? "Marca on creus que hi ha bolets. Marcar no gasta torns."
                    : run.hint}
              </span>
            </div>
            {run.phase !== "playing" && (
              <button
                className="primary-button phase-button"
                onClick={() =>
                  setPanel(run.phase === "reward" ? "reward" : "ended")
                }
              >
                {run.phase === "reward"
                  ? "Nivell superat! Tria el teu talent"
                  : "L’excursió s’ha acabat. Mira el cistell"}
                <Icon name="arrow" size={18} />
              </button>
            )}
          </section>
          <aside className="sidebar">
            <section className="basket-card">
              <div className="card-heading">
                <h3>
                  <Icon name="basket" />
                  El teu cistell
                </h3>
                <span className="small-tag">AQUESTA EXCURSIÓ</span>
              </div>
              <div className="basket-total">
                <strong>{totalCollected(run.collected)}</strong>
                <span>bolets recollits</span>
                <span className="basket-illustration">
                  <Icon name="basket" size={58} />
                  <MushroomArt size={29} />
                </span>
              </div>
              <div className="species-list">
                {speciesList.map((species) => (
                  <div key={species}>
                    <span className={`species-icon ${species}`}>
                      <MushroomArt color={SPECIES[species].color} size={27} />
                    </span>
                    <span>
                      {SPECIES[species].plural}
                      <small>{SPECIES[species].points} punts / bolet</small>
                    </span>
                    <strong>{run.collected[species]}</strong>
                  </div>
                ))}
              </div>
              <div className="basket-foot">
                Cada troballa compta. <span>Omplim-lo?</span>
              </div>
            </section>
            <section className="talents-card">
              <div className="card-heading">
                <h3>
                  <Icon name="spark" size={20} />
                  Talents passius
                </h3>
              </div>
              <p className="card-description">
                Sempre actius, sense prémer cap botó.
              </p>
              <div className="talent-list">
                <div className="talent">
                  <span className="talent-icon power">
                    <Icon name="hand" />
                  </span>
                  <div>
                    <h4>
                      Mans expertes <span>Niv. {run.abilities.power}</span>
                    </h4>
                    <p>Força de collita: {run.abilities.power}</p>
                  </div>
                  <span className="passive-badge">PASSIU</span>
                </div>
                {(["stamina", "spores"] satisfies (keyof typeof ABILITIES)[])
                  .filter((key) => run.abilities[key] > 0)
                  .map((key) => (
                    <div className="talent" key={key}>
                      <span className="talent-icon compass">
                        <Icon name={ABILITIES[key].icon} />
                      </span>
                      <div>
                        <h4>
                          {ABILITIES[key].name}{" "}
                          <span>Niv. {run.abilities[key]}</span>
                        </h4>
                        <p>
                          {key === "stamina"
                            ? `+${run.abilities[key] * STAMINA_TURNS} torns per nivell`
                            : `+${run.abilities[key]} caselles per bolet`}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="talent-note">
                <Icon name="leaf" size={17} />
                <span>
                  Supera el nivell per triar un nou talent
                  <br />o millorar-ne un que ja tens.
                </span>
              </div>
            </section>
            <section className="tip-card">
              <span className="tip-doodle">
                <Icon name="help" size={29} />
              </span>
              <div>
                <h4>El bosc et dona pistes</h4>
                <p>
                  Els números indiquen quantes de les 8 caselles del voltant
                  tenen bolets. Observa, dedueix… i cull!
                </p>
                <button
                  className="text-button"
                  onClick={() => setPanel("guide")}
                >
                  Aprèn a jugar <Icon name="arrow" size={15} />
                </button>
              </div>
            </section>
          </aside>
        </div>
        <section className="journey-strip">
          <div className="journey-intro">
            <span className="journal-icon">
              <Icon name="chart" size={25} />
            </span>
            <div>
              <h3>Petites passes, moltes històries.</h3>
              <p>El teu quadern creix amb cada excursió.</p>
            </div>
          </div>
          <div className="journey-stat">
            <strong>{totalCollected(totals.mushrooms)}</strong>
            <span>bolets en total</span>
          </div>
          <div className="journey-stat">
            <strong>{totals.levels}</strong>
            <span>nivells superats</span>
          </div>
          <div className="journey-stat">
            <strong>{totals.runs}</strong>
            <span>excursions acabades</span>
          </div>
          <button
            className="icon-button"
            aria-label="Obre el meu quadern"
            onClick={() => setPanel("stats")}
          >
            <Icon name="arrow" />
          </button>
        </section>
      </main>
      <footer>
        <span>
          <MushroomArt size={19} /> Fet per perdre’s una estona al bosc.
        </span>
        <span className="footer-actions">
          <button
            className="sound-button"
            onClick={() => setSound(!sound)}
            aria-label={sound ? "Desactiva el so" : "Activa el so"}
          >
            <Icon name={sound ? "volume" : "mute"} size={17} />
            <span>So {sound ? "activat" : "desactivat"}</span>
          </button>
          <span className="footer-dot">·</span>
          <button onClick={() => setPanel("install")}>
            <Icon name="download" size={16} />
            Instal·la el joc
          </button>
          <span className="language">CAT</span>
        </span>
      </footer>
      {state.welcome && (
        <Dialog
          title="Benvingut a Buscabolets"
          className="welcome-dialog"
          onClose={dismissWelcome}
        >
          <div className="welcome-art" aria-hidden="true">
            <ForestArt />
            <span className="welcome-caption">El bosc t’espera.</span>
          </div>
          <div className="welcome-copy">
            <div className="eyebrow">UNA PETITA AVENTURA AL BOSC</div>
            <h2>
              Un pas. Una pista.
              <br />
              Un cistell per omplir.
            </h2>
            <p>
              Endinsa’t al bosc i troba tots els bolets abans d’esgotar els
              torns. Cada excursió és una nova aventura.
            </p>
            <ol className="guide-steps">
              <li>
                <strong>Explora i segueix les pistes.</strong> Toca una casella.
                Els números indiquen quantes de les 8 caselles del voltant tenen
                bolets.
              </li>
              <li>
                <strong>Omple el cistell i avança.</strong> Cada toc de collita
                costa un torn. Troba tots els bolets per passar de nivell i
                triar un talent.
              </li>
            </ol>
            <button className="primary-button" onClick={dismissWelcome}>
              Cap al bosc <Icon name="arrow" size={18} />
            </button>
            <p className="welcome-help">
              Tens la guia a «Com s’hi juga» sempre que et calgui.
            </p>
          </div>
        </Dialog>
      )}
      {panel && (
        <Dialog title={panelTitle} onClose={() => setPanel(null)}>
          {panel === "guide" && (
            <>
              <span className="modal-symbol">
                <Icon name="compass" size={33} />
              </span>
              <div className="eyebrow">GUIA DE BUTXACA</div>
              <h2>El bosc té els seus secrets.</h2>
              <p>
                Troba tots els bolets abans d’esgotar els torns. Si te’n deixes
                algun, l’excursió s’acaba.
              </p>
              <ol className="guide-steps">
                <li>
                  <strong>Explora una casella.</strong> Cada toc de collita
                  costa un torn. Les zones buides connectades es revelen de
                  franc.
                </li>
                <li>
                  <strong>Llegeix les pistes.</strong> Un número compta les
                  caselles amb bolets entre les 8 veïnes, incloses les dels ja
                  collits. Si les dues meitats d’una parella de rossinyols són
                  al costat, compten com a 2.
                </li>
                <li>
                  <strong>Cull amb paciència.</strong> Els rovellons van
                  directes al cistell. Els ceps necessiten 3 de força acumulada.
                  Si cal tornar-hi, la casella es torna lila i la mà indica els
                  tocs que falten, segons la teva força. Cada toc costa 1 torn.
                  Els rossinyols ocupen dues caselles horitzontals: cal
                  collir-les totes dues.
                </li>
                <li>
                  <strong>Fes servir els talents.</strong> El rasclet explora
                  fins a 3 caselles amb un torn. L’olfacte dona una direcció des
                  de l’última casella tocada, o E5 a l’inici, sense gastar
                  torns.
                </li>
                <li>
                  <strong>Tria com créixer.</strong> Cada nivell superat ofereix
                  fins a 3 talents. Tria’n un. Els usos es recuperen al següent
                  nivell i totes les millores es reinicien a la següent
                  excursió.
                </li>
              </ol>
              <p className="modal-note">
                Marca amb el botó «Marca», el clic dret o la tecla F. Mou-te amb
                les fletxes i explora amb Retorn o Espai. Marcar no gasta torns.
              </p>
              <button className="primary-button" onClick={() => setPanel(null)}>
                Cap al bosc <Icon name="arrow" size={18} />
              </button>
            </>
          )}
          {panel === "collection" && (
            <>
              <span className="modal-symbol">
                <Icon name="basket" size={33} />
              </span>
              <div className="eyebrow">EL BOLETARI</div>
              <h2>Coneix els teus tresors.</h2>
              <p>
                Totes les espècies del joc i les teves troballes acumulades.
              </p>
              <div className="collection-grid">
                {speciesList.map((species) => (
                  <article key={species}>
                    <span className={`collection-art ${species}`}>
                      <MushroomArt color={SPECIES[species].color} size={66} />
                    </span>
                    <div>
                      <h3>
                        {SPECIES[species].name}
                        <span>{SPECIES[species].points} punts</span>
                      </h3>
                      <p>{SPECIES[species].description}</p>
                      <small>
                        {totals.mushrooms[species]} recollits en total
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <p className="modal-note">
                Un boletari de ficció per jugar. No és una guia per identificar
                bolets reals.
              </p>
            </>
          )}
          {panel === "stats" && (
            <>
              <span className="modal-symbol">
                <Icon name="chart" size={33} />
              </span>
              <div className="eyebrow">EL MEU QUADERN</div>
              <h2>Cada excursió deixa petjada.</h2>
              <p>
                Les teves estadístiques en aquest dispositiu, inclosa l’excursió
                actual.
              </p>
              <div className="modal-stats">
                {[
                  [totalCollected(totals.mushrooms), "bolets recollits"],
                  [totals.levels, "nivells superats"],
                  [totals.turns, "torns utilitzats"],
                  [totals.runs, "excursions acabades"],
                  [totals.score, "punts acumulats"],
                  [totals.bestLevel, "millor nivell superat"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="modal-note">
                Aquí només hi guardem records. Les estadístiques no donen
                avantatges dins del joc. El progrés es desa en aquest navegador.
              </p>
            </>
          )}
          {panel === "install" && (
            <>
              <span className="modal-symbol">
                <Icon name="download" size={33} />
              </span>
              <div className="eyebrow">EL BOSC, A LA BUTXACA</div>
              <h2>Ens emportes amb tu?</h2>
              <p>
                Instal·la Buscabolets per obrir-lo com una app i jugar-hi sense
                connexió després de la primera visita en línia.
              </p>
              <ol className="guide-steps">
                <li>
                  <strong>iPhone o iPad, amb Safari.</strong> Toca Compartir i
                  després «Afegeix a la pantalla d’inici».
                </li>
                <li>
                  <strong>Android, amb Chrome.</strong> Obre el menú ⋮ i tria
                  «Instal·la l’aplicació» o «Afegeix a la pantalla d’inici».
                </li>
                <li>
                  <strong>A l’ordinador.</strong> Fes servir la icona
                  d’instal·lació de la barra d’adreces, si el teu navegador la
                  mostra.
                </li>
              </ol>
              <p className="modal-note">
                Les dades queden en aquest dispositiu. Cal obrir el joc amb
                connexió una primera vegada per preparar-lo.
              </p>
            </>
          )}
          {panel === "restart" && (
            <>
              <span className="modal-symbol">
                <Icon name="leaf" size={33} />
              </span>
              <h2>Tornem a començar?</h2>
              <p>
                Acabaràs aquesta excursió i començaràs al nivell 1 amb els
                talents inicials. Els {totalCollected(run.collected)} bolets que
                has collit ja són al teu quadern.
              </p>
              <div className="modal-buttons">
                <button
                  className="secondary-button"
                  onClick={() => setPanel(null)}
                >
                  Continuem collint
                </button>
                <button className="primary-button" onClick={restart}>
                  Nova excursió <Icon name="arrow" size={18} />
                </button>
              </div>
            </>
          )}
          {panel === "reward" && (
            <>
              <span className="modal-symbol success">
                <Icon name="spark" size={35} />
              </span>
              <div className="eyebrow">NIVELL {run.level} SUPERAT</div>
              <h2>El bosc et fa un regal.</h2>
              <p>
                Tots {run.mushrooms.length} bolets al cistell i encara{" "}
                {run.turns} torns! Tria un talent per continuar l’excursió.
              </p>
              <div className="reward-list">
                {run.choices.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      act({ type: "upgrade", ability: key });
                      setTool("pick");
                      setPanel(null);
                    }}
                  >
                    <span className="talent-icon">
                      <Icon name={ABILITIES[key].icon} size={27} />
                    </span>
                    <span>
                      <strong>
                        {ABILITIES[key].name}
                        <small>
                          Niv. {run.abilities[key]} → {run.abilities[key] + 1}
                        </small>
                      </strong>
                      <span>{ABILITIES[key].description}</span>
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                ))}
              </div>
              {!run.choices.length && (
                <>
                  <p>
                    Ja has dominat tots els talents. El bosc encara té camins
                    per descobrir.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      act({ type: "upgrade", ability: "power" });
                      setPanel(null);
                    }}
                  >
                    Següent nivell <Icon name="arrow" size={18} />
                  </button>
                </>
              )}
              <p className="modal-note">
                Els talents t’acompanyen fins al final d’aquesta excursió.
              </p>
            </>
          )}
          {panel === "ended" && (
            <>
              <span className="modal-symbol">
                <Icon name="basket" size={38} />
              </span>
              <div className="eyebrow">FI DE L’EXCURSIÓ</div>
              <h2>El bosc t’espera un altre dia.</h2>
              <p>
                {run.turns === 0
                  ? "T’has quedat sense torns, però marxes amb un cistell ple d’històries."
                  : "Tanquem el cistell per avui. Cada troballa queda al teu quadern."}
              </p>
              <div className="modal-stats">
                <div>
                  <strong>{totalCollected(run.collected)}</strong>
                  <span>bolets recollits</span>
                </div>
                <div>
                  <strong>{run.score}</strong>
                  <span>punts</span>
                </div>
                <div>
                  <strong>{levelsBeaten}</strong>
                  <span>nivells superats</span>
                </div>
                <div>
                  <strong>{run.used}</strong>
                  <span>torns utilitzats</span>
                </div>
              </div>
              <div className="result-species">
                {speciesList.map((key) => (
                  <span key={key}>
                    <MushroomArt color={SPECIES[key].color} size={28} />
                    {run.collected[key]} {SPECIES[key].plural.toLowerCase()}
                  </span>
                ))}
              </div>
              <button className="primary-button" onClick={restart}>
                Una altra excursió <Icon name="arrow" size={18} />
              </button>
              <button
                className="text-button centered"
                onClick={() => setPanel(null)}
              >
                Repassa el tauler
              </button>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
