import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Users, Save, RotateCcw, ChevronRight, ChevronLeft, GripVertical } from "lucide-react";
import { supabase } from "./lib/supabase";
import { calculateScores } from "./lib/scoring";
import type { PlayerScore } from "./lib/scoring";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Team = {
  id: string;
  name: string;
  flag: string;
};

type Group = {
  id: string;
  teams: Team[];
};

type RankedThird = {
  groupId: string;
  team: Team;
};

type Match = {
  id: string;
  left?: Team | null;
  right?: Team | null;
  winner?: Team | null;
  round: string;
};

type Rankings = Record<string, Team[]>;

type Rounds = {
  R32: Match[];
  R16: Match[];
  QF: Match[];
  SF: Match[];
  F: Match[];
};

const GROUPS: Group[] = [
  { id: "A", teams: [{ id: "MEX", name: "Mexique", flag: "🇲🇽" }, { id: "RSA", name: "Afrique du Sud", flag: "🇿🇦" }, { id: "KOR", name: "Corée du Sud", flag: "🇰🇷" }, { id: "CZE", name: "Tchéquie", flag: "🇨🇿" }] },
  { id: "B", teams: [{ id: "CAN", name: "Canada", flag: "🇨🇦" }, { id: "SUI", name: "Suisse", flag: "🇨🇭" }, { id: "QAT", name: "Qatar", flag: "🇶🇦" }, { id: "BIH", name: "Bosnie-Herzégovine", flag: "🇧🇦" }] },
  { id: "C", teams: [{ id: "BRA", name: "Brésil", flag: "🇧🇷" }, { id: "MAR", name: "Maroc", flag: "🇲🇦" }, { id: "HAI", name: "Haïti", flag: "🇭🇹" }, { id: "SCO", name: "Écosse", flag: "🏴" }] },
  { id: "D", teams: [{ id: "USA", name: "États-Unis", flag: "🇺🇸" }, { id: "PAR", name: "Paraguay", flag: "🇵🇾" }, { id: "AUS", name: "Australie", flag: "🇦🇺" }, { id: "TUR", name: "Turquie", flag: "🇹🇷" }] },
  { id: "E", teams: [{ id: "GER", name: "Allemagne", flag: "🇩🇪" }, { id: "CUW", name: "Curaçao", flag: "🇨🇼" }, { id: "CIV", name: "Côte d’Ivoire", flag: "🇨🇮" }, { id: "ECU", name: "Équateur", flag: "🇪🇨" }] },
  { id: "F", teams: [{ id: "NED", name: "Pays-Bas", flag: "🇳🇱" }, { id: "JPN", name: "Japon", flag: "🇯🇵" }, { id: "TUN", name: "Tunisie", flag: "🇹🇳" }, { id: "SWE", name: "Suède", flag: "🇸🇪" }] },
  { id: "G", teams: [{ id: "BEL", name: "Belgique", flag: "🇧🇪" }, { id: "EGY", name: "Égypte", flag: "🇪🇬" }, { id: "IRN", name: "Iran", flag: "🇮🇷" }, { id: "NZL", name: "Nouvelle-Zélande", flag: "🇳🇿" }] },
  { id: "H", teams: [{ id: "ESP", name: "Espagne", flag: "🇪🇸" }, { id: "CPV", name: "Cap-Vert", flag: "🇨🇻" }, { id: "KSA", name: "Arabie saoudite", flag: "🇸🇦" }, { id: "URU", name: "Uruguay", flag: "🇺🇾" }] },
  { id: "I", teams: [{ id: "FRA", name: "France", flag: "🇫🇷" }, { id: "SEN", name: "Sénégal", flag: "🇸🇳" }, { id: "NOR", name: "Norvège", flag: "🇳🇴" }, { id: "IRQ", name: "Irak", flag: "🇮🇶" }] },
  { id: "J", teams: [{ id: "ARG", name: "Argentine", flag: "🇦🇷" }, { id: "ALG", name: "Algérie", flag: "🇩🇿" }, { id: "AUT", name: "Autriche", flag: "🇦🇹" }, { id: "JOR", name: "Jordanie", flag: "🇯🇴" }] },
  { id: "K", teams: [{ id: "POR", name: "Portugal", flag: "🇵🇹" }, { id: "UZB", name: "Ouzbékistan", flag: "🇺🇿" }, { id: "COL", name: "Colombie", flag: "🇨🇴" }, { id: "COD", name: "RD Congo", flag: "🇨🇩" }] },
  { id: "L", teams: [{ id: "ENG", name: "Angleterre", flag: "🏴" }, { id: "CRO", name: "Croatie", flag: "🇭🇷" }, { id: "GHA", name: "Ghana", flag: "🇬🇭" }, { id: "PAN", name: "Panama", flag: "🇵🇦" }] },
];

const FLAG_CODES: Record<string, string> = {
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
  CAN: "ca", SUI: "ch", QAT: "qa", BIH: "ba",
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct",
  USA: "us", PAR: "py", AUS: "au", TUR: "tr",
  GER: "de", CUW: "cw", CIV: "ci", ECU: "ec",
  NED: "nl", JPN: "jp", TUN: "tn", SWE: "se",
  BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
  ESP: "es", CPV: "cv", KSA: "sa", URU: "uy",
  FRA: "fr", SEN: "sn", NOR: "no", IRQ: "iq",
  ARG: "ar", ALG: "dz", AUT: "at", JOR: "jo",
  POR: "pt", UZB: "uz", COL: "co", COD: "cd",
  ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa",
};

const STEPS = ["Groupes", "Meilleurs 3es", "16es", "8es", "Quarts", "Demies", "Finale", "Validation"];

function initialRankings(): Rankings {
  return Object.fromEntries(GROUPS.map((group) => [group.id, group.teams])) as Rankings;
}

function getFlagUrl(team?: Team | null) {
  if (!team) return null;
  const code = FLAG_CODES[team.id];
  return code ? `https://flagcdn.com/${code}.svg` : null;
}

function createMatch(id: string, left: Team | null | undefined, right: Team | null | undefined, round: string): Match {
  return { id, left, right, winner: null, round };
}

function getTeam(rankings: Rankings, groupId: string, positionIndex: number) {
  return rankings[groupId]?.[positionIndex];
}

function buildRoundOf32(rankings: Rankings, selectedThirds: RankedThird[]) {
  const thirdTeams = selectedThirds.slice(0, 8).map((t) => t.team);
  const pickThird = (index: number) => thirdTeams[index] || { id: `TBD${index}`, name: "Meilleur 3e à définir", flag: "❔" };

  return [
    createMatch("73", getTeam(rankings, "A", 1), getTeam(rankings, "B", 1), "R32"),
    createMatch("74", getTeam(rankings, "E", 0), pickThird(0), "R32"),
    createMatch("75", getTeam(rankings, "F", 0), getTeam(rankings, "C", 1), "R32"),
    createMatch("76", getTeam(rankings, "C", 0), getTeam(rankings, "F", 1), "R32"),
    createMatch("77", getTeam(rankings, "I", 0), pickThird(1), "R32"),
    createMatch("78", getTeam(rankings, "E", 1), getTeam(rankings, "I", 1), "R32"),
    createMatch("79", getTeam(rankings, "A", 0), pickThird(2), "R32"),
    createMatch("80", getTeam(rankings, "L", 0), pickThird(3), "R32"),
    createMatch("81", getTeam(rankings, "D", 0), pickThird(4), "R32"),
    createMatch("82", getTeam(rankings, "G", 0), pickThird(5), "R32"),
    createMatch("83", getTeam(rankings, "K", 1), getTeam(rankings, "L", 1), "R32"),
    createMatch("84", getTeam(rankings, "H", 0), getTeam(rankings, "J", 1), "R32"),
    createMatch("85", getTeam(rankings, "B", 0), pickThird(6), "R32"),
    createMatch("86", getTeam(rankings, "J", 0), getTeam(rankings, "H", 1), "R32"),
    createMatch("87", getTeam(rankings, "K", 0), pickThird(7), "R32"),
    createMatch("88", getTeam(rankings, "D", 1), getTeam(rankings, "G", 1), "R32"),
  ];
}

function buildNextRound(matches: Match[], nextRound: string) {
  const output: Match[] = [];
  for (let i = 0; i < matches.length; i += 2) {
    output.push(createMatch(`${nextRound}-${i / 2 + 1}`, matches[i]?.winner, matches[i + 1]?.winner, nextRound));
  }
  return output;
}

export default function App() {
  const [step, setStep] = useState(0);
  const [appMode, setAppMode] = useState<"prediction" | "admin" | "results">("prediction");
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [rankings, setRankings] = useState<Rankings>(initialRankings);
  const [thirdRankingIds, setThirdRankingIds] = useState<string[]>([]);
  const [rounds, setRounds] = useState<Rounds>({ R32: [], R16: [], QF: [], SF: [], F: [] });
  const [participantName, setParticipantName] = useState("");
  const [submittedPrediction, setSubmittedPrediction] = useState<object | null>(null);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresError, setScoresError] = useState<string | null>(null);
  const [adminPressTimer, setAdminPressTimer] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const currentGroup = GROUPS[currentGroupIndex];

  const thirds = useMemo<RankedThird[]>(
    () => GROUPS.map((group) => ({ groupId: group.id, team: rankings[group.id][2] })),
    [rankings]
  );

  const thirdItems = useMemo(() => {
    const baseIds = thirds.map((third) => third.team.id);
    const existingIds = thirdRankingIds.filter((id) => baseIds.includes(id));
    const missingIds = baseIds.filter((id) => !existingIds.includes(id));
    return [...existingIds, ...missingIds];
  }, [thirdRankingIds, thirds]);

  const rankedThirds = useMemo(() => {
    return thirdItems
      .map((teamId) => thirds.find((third) => third.team.id === teamId))
      .filter(Boolean) as RankedThird[];
  }, [thirdItems, thirds]);

  const selectedThirds = rankedThirds.slice(0, 8);
  const champion = rounds.F[0]?.winner;

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupId = currentGroup.id;
    setRankings((prev) => {
      const teams = prev[groupId];
      const oldIndex = teams.findIndex((team) => team.id === active.id);
      const newIndex = teams.findIndex((team) => team.id === over.id);
      return { ...prev, [groupId]: arrayMove(teams, oldIndex, newIndex) };
    });
  }

  function handleThirdDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = thirdItems.findIndex((id) => id === active.id);
    const newIndex = thirdItems.findIndex((id) => id === over.id);
    setThirdRankingIds(arrayMove(thirdItems, oldIndex, newIndex));
  }

  function startKnockout() {
    const R32 = buildRoundOf32(rankings, selectedThirds);
    setRounds({ R32, R16: [], QF: [], SF: [], F: [] });
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseWinner(roundKey: keyof Rounds, matchId: string, team?: Team | null) {
    if (!team) return;

    setRounds((prev) => {
      const updatedRound = prev[roundKey].map((match) =>
        match.id === matchId ? { ...match, winner: team } : match
      );
      const next = { ...prev, [roundKey]: updatedRound };

      if (roundKey === "R32" && updatedRound.every((m) => m.winner)) next.R16 = buildNextRound(updatedRound, "R16");
      if (roundKey === "R16" && updatedRound.every((m) => m.winner)) next.QF = buildNextRound(updatedRound, "QF");
      if (roundKey === "QF" && updatedRound.every((m) => m.winner)) next.SF = buildNextRound(updatedRound, "SF");
      if (roundKey === "SF" && updatedRound.every((m) => m.winner)) next.F = buildNextRound(updatedRound, "F");

      return next;
    });
  }

  async function submitPrediction() {
    if (!participantName.trim()) return;
    if (!champion) return;

    const payload = {
      participant_name: participantName.trim(),
      group_rankings: rankings,
      best_thirds: selectedThirds,
      knockout_predictions: rounds,
      champion,
    };

    const { error } = await supabase
      .from("predictions")
      .insert(payload);

    if (error) {
      console.error(error);
      alert("Erreur pendant l'enregistrement du pronostic.");
      return;
    }

    setSubmittedPrediction(payload);
    alert("Pronostic enregistré !");
  }


  async function loadScores() {
    setScoresLoading(true);
    setScoresError(null);

    const { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select("*");

    if (predictionsError) {
      setScoresError("Impossible de charger les pronostics.");
      setScoresLoading(false);
      return;
    }

    const { data: realResultsRows, error: realResultsError } = await supabase
      .from("real_results")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (realResultsError) {
      setScoresError("Impossible de charger les résultats réels.");
      setScoresLoading(false);
      return;
    }

    const realResults = realResultsRows?.[0];

    if (!realResults) {
      setScoresError("Aucun résultat réel trouvé.");
      setScoresLoading(false);
      return;
    }

    const calculatedScores = calculateScores(predictions || [], realResults);

    setScores(calculatedScores);
    setScoresLoading(false);
  }

  useEffect(() => {
    if (step === 8) {
      loadScores();
    }
  }, [step]);


  async function saveRealResults() {
    const payload = {
      group_rankings: rankings,
      best_thirds: step >= 1 ? selectedThirds : null,
      knockout_results: step >= 2 ? rounds : null,
      champion: champion || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingRows, error: fetchError } = await supabase
      .from("real_results")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error(fetchError);
      alert("Erreur pendant la récupération des résultats réels.");
      return;
    }

    const existingId = existingRows?.[0]?.id;

    const query = existingId
      ? supabase.from("real_results").update(payload).eq("id", existingId)
      : supabase.from("real_results").insert(payload);

    const { error } = await query;

    if (error) {
      console.error(error);
      alert("Erreur pendant la sauvegarde des résultats réels.");
      return;
    }

    alert("Résultats réels sauvegardés !");
  }

  function unlockAdmin() {
    const password = window.prompt("Mot de passe admin");

    if (password === "Railton") {
      setAppMode("admin");
      setStep(0);
      setCurrentGroupIndex(0);
      alert("Mode admin activé.");
    } else {
      alert("Mot de passe incorrect.");
    }
  }


  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-6 text-center">
          <div
            className="mb-3 cursor-pointer rounded-3xl bg-white/10 p-3 shadow-lg select-none"
            onMouseDown={() => {
              const timer = window.setTimeout(unlockAdmin, 3000);
              setAdminPressTimer(timer);
            }}
            onMouseUp={() => {
              if (adminPressTimer) window.clearTimeout(adminPressTimer);
            }}
            onMouseLeave={() => {
              if (adminPressTimer) window.clearTimeout(adminPressTimer);
            }}
            onTouchStart={() => {
              const timer = window.setTimeout(unlockAdmin, 3000);
              setAdminPressTimer(timer);
            }}
            onTouchEnd={() => {
              if (adminPressTimer) window.clearTimeout(adminPressTimer);
            }}
          >
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            {appMode === "admin"
              ? "Admin résultats réels"
              : "Pronostics Coupe du monde 2026"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Un parcours simple : classe les groupes, ordonne les meilleurs troisièmes, puis clique sur les vainqueurs jusqu’au champion.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                setAppMode("prediction");
                setStep(0);
                setCurrentGroupIndex(0);
              }}
              className={appMode === "prediction" ? "btn-primary" : "btn-secondary"}
            >
              Mode pronostic
            </button>

            <button
              onClick={() => {
                setAppMode("results");
                loadScores();
              }}
              className={appMode === "results" ? "btn-primary" : "btn-secondary"}
            >
              Résultats
            </button>
          </div>

          {appMode !== "results" && (
          <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1">
            {STEPS.filter((_, index) => appMode === "prediction" || index < 8).map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  index === step ? "bg-white text-slate-950" : "bg-slate-200 text-slate-700 hover:bg-white/15"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>)}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <AnimatePresence mode="wait">

          {appMode !== "results" && (
            <>
          {step === 0 && (
            <motion.section key="groups" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <SectionTitle
                icon={<Users className="h-5 w-5" />}
                title={`Groupe ${currentGroup.id}`}
                subtitle="Glisse les équipes pour les placer de la 1re à la 4e position. Les deux premiers sont qualifiés, le troisième pourra être repêché."
              />

              <GroupPager currentIndex={currentGroupIndex} setCurrentIndex={setCurrentGroupIndex} />

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={rankings[currentGroup.id].map((team) => team.id)} strategy={verticalListSortingStrategy}>
                  <div className="mx-auto mt-6 max-w-xl space-y-3">
                    {rankings[currentGroup.id].map((team, index) => (
                      <SortableTeamRow key={team.id} id={team.id} team={team} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <FooterActions>
                <button onClick={() => setRankings(initialRankings())} className="btn-secondary">
                  <RotateCcw className="h-4 w-4" /> Réinitialiser
                </button>
                {appMode === "admin" && (
                  <button onClick={saveRealResults} className="btn-primary">
                    Sauvegarder résultats réels
                  </button>
                )}
                {currentGroupIndex < GROUPS.length - 1 ? (
                  <button onClick={() => setCurrentGroupIndex((prev) => prev + 1)} className="btn-primary">
                    Groupe suivant <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button onClick={() => setStep(1)} className="btn-primary">
                    Meilleurs 3es <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </FooterActions>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section key="thirds" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <SectionTitle
                icon={<Medal className="h-5 w-5" />}
                title="Classement des troisièmes"
                subtitle="Glisse les 12 troisièmes dans l’ordre. Les positions 1 à 8 sont qualifiées, les positions 9 à 12 sont éliminées."
              />

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleThirdDragEnd}>
                <SortableContext items={thirdItems} strategy={verticalListSortingStrategy}>
                  <div className="mx-auto max-w-xl space-y-3">
                    {rankedThirds.map((third, index) => (
                      <SortableThirdRow key={third.team.id} id={third.team.id} third={third} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <FooterActions>
                <button onClick={() => setStep(0)} className="btn-secondary">
                  <ChevronLeft className="h-4 w-4" /> Retour groupes
                </button>
                {appMode === "admin" && (
                  <button onClick={saveRealResults} className="btn-primary">
                    Sauvegarder résultats réels
                  </button>
                )}
                <button onClick={startKnockout} className="btn-primary">
                  Générer les 16es <ChevronRight className="h-4 w-4" />
                </button>
              </FooterActions>
            </motion.section>
          )}

          {step >= 2 && step <= 6 && (
            <motion.section key={STEPS[step]} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <SectionTitle
                icon={<Trophy className="h-5 w-5" />}
                title={STEPS[step]}
                subtitle="Clique sur l’équipe que tu vois gagnante. Les tours suivants se génèrent automatiquement."
              />

              {step === 2 && <RoundView title="16es de finale" matches={rounds.R32} roundKey="R32" onWinner={chooseWinner} />}
              {step === 3 && <RoundView title="8es de finale" matches={rounds.R16} roundKey="R16" onWinner={chooseWinner} />}
              {step === 4 && <RoundView title="Quarts de finale" matches={rounds.QF} roundKey="QF" onWinner={chooseWinner} />}
              {step === 5 && <RoundView title="Demi-finales" matches={rounds.SF} roundKey="SF" onWinner={chooseWinner} />}
              {step === 6 && <RoundView title="Finale" matches={rounds.F} roundKey="F" onWinner={chooseWinner} />}

              {champion && step === 6 && (
                <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-yellow-300/30 bg-yellow-300/50 p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-yellow-100/97">Champion prédit</p>
                  <p className="mt-2 text-4xl font-black"><InlineTeam team={champion} large /></p>
                </div>
              )}

              <FooterActions>
                <button onClick={() => setStep(Math.max(1, step - 1))} className="btn-secondary">
                  <ChevronLeft className="h-4 w-4" /> Retour
                </button>
                {appMode === "admin" && (
                  <button onClick={saveRealResults} className="btn-primary">
                    Sauvegarder résultats réels
                  </button>
                )}
                <button disabled={!canGoNext(step, rounds)} onClick={() => setStep(step + 1)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">
                  Continuer <ChevronRight className="h-4 w-4" />
                </button>
              </FooterActions>
            </motion.section>
          )}

          {step === 7 && (
            <motion.section key="submit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <SectionTitle
                icon={<Save className="h-5 w-5" />}
                title="Validation"
                subtitle="Entre ton nom, valide ton pronostic, puis il sera enregistré dans Supabase dans la version branchée."
              />

              <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                <label className="text-sm font-bold text-slate-700">Nom du participant</label>
                <input
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Ex : Nathan"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-white outline-none focus:border-white/40"
                />



                {appMode === "admin" ? (
                  <button onClick={saveRealResults} className="btn-primary mt-6 w-full justify-center">
                    Sauvegarder les résultats réels
                  </button>
                ) : (
                  <button
                    disabled={!participantName.trim() || !champion}
                    onClick={submitPrediction}
                    className="btn-primary mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Save className="h-4 w-4" /> Valider mon pronostic
                  </button>
                )}

                {submittedPrediction && (
                  <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
                    <p className="font-bold text-emerald-100">Pronostic prêt à envoyer à Supabase.</p>
                    <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-slate-200">
                      {JSON.stringify(submittedPrediction, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.section>
          )}
          </>
          )} 
          {appMode === "results" && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <SectionTitle
                icon={<Trophy className="h-5 w-5" />}
                title="Classement des participants"
                subtitle="Le classement compare les pronostics avec les résultats réels déjà renseignés dans Supabase."
              />

              <div className="mx-auto max-w-2xl">
                <button onClick={loadScores} className="btn-primary mb-5 w-full justify-center">
                  Actualiser le classement
                </button>

                {scoresLoading && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                    Chargement du classement...
                  </div>
                )}

                {scoresError && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
                    {scoresError}
                  </div>
                )}

                {!scoresLoading && !scoresError && scores.length === 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                    Aucun pronostic à comparer pour le moment.
                  </div>
                )}

                {!scoresLoading && !scoresError && scores.length > 0 && (
                  <div className="space-y-4">
                    {scores.map((score, index) => (
                      <div
                        key={score.participantName}
                        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">
                              #{index + 1}
                            </p>
                            <h3 className="text-xl font-black">{score.participantName}</h3>
                          </div>

                          <div className="text-right">
                            <p className="text-3xl font-black">
                              {score.totalPercentage ?? 0}%
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {score.totalCorrect}/{score.totalAvailable} bons résultats
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 space-y-2">
                          <ScoreLine label="Groupes" section={score.sections.groups} />
                          <ScoreLine label="Meilleurs 3es" section={score.sections.bestThirds} />
                          <ScoreLine label="16es" section={score.sections.R32} />
                          <ScoreLine label="8es" section={score.sections.R16} />
                          <ScoreLine label="Quarts" section={score.sections.QF} />
                          <ScoreLine label="Demies" section={score.sections.SF} />
                          <ScoreLine label="Finale" section={score.sections.F} />
                          <ScoreLine label="Champion" section={score.sections.champion} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>


      <style>{`
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border-radius: 9999px;
          background: #0f172a;
          color: white;
          padding: 0.75rem 1rem;
          font-weight: 800;
          transition: 150ms ease;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border-radius: 9999px;
          background: white;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          padding: 0.75rem 1rem;
          font-weight: 700;
          transition: 150ms ease;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}

function Flag({ team, size = "md" }: { team?: Team | null; size?: "sm" | "md" | "lg" }) {
  const url = getFlagUrl(team);
  const sizeClass = size === "lg" ? "h-9 w-12" : size === "sm" ? "h-5 w-7" : "h-7 w-10";

  if (!team || !url) {
    return <span className={`inline-flex ${sizeClass} items-center justify-center rounded-md bg-slate-200 text-xs`}>?</span>;
  }

  return (
    <img
      src={url}
      alt={`Drapeau ${team.name}`}
      className={`${sizeClass} shrink-0 rounded-md object-cover shadow-sm ring-1 ring-slate-200`}
      loading="lazy"
    />
  );
}

function InlineTeam({ team, large = false }: { team?: Team | null; large?: boolean }) {
  return (
    <span className="inline-flex items-center justify-center gap-3">
      <Flag team={team} size={large ? "lg" : "md"} />
      <span>{team?.name || "À déterminer"}</span>
    </span>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <div className="mb-3 rounded-2xl bg-slate-200 p-2">{icon}</div>
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{subtitle}</p>
    </div>
  );
}

function GroupPager({ currentIndex, setCurrentIndex }: { currentIndex: number; setCurrentIndex: React.Dispatch<React.SetStateAction<number>> }) {
  return (
    <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-3">
      <button disabled={currentIndex === 0} onClick={() => setCurrentIndex((prev) => prev - 1)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-30">
        <ChevronLeft className="h-4 w-4" /> Précédent
      </button>
      <p className="text-sm font-bold text-slate-700">{currentIndex + 1} / {GROUPS.length}</p>
      <button disabled={currentIndex === GROUPS.length - 1} onClick={() => setCurrentIndex((prev) => prev + 1)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-30">
        Suivant <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

  function SortableTeamRow({ id, team, index }: { id: string; team: Team; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-xl ${isDragging ? "z-50 opacity-70" : ""}`}>
      <div className="flex items-center gap-4">
        <button {...attributes} {...listeners} className="cursor-grab rounded-2xl bg-slate-200 p-2 active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-base font-black text-slate-950">{index + 1}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black"><span className="mr-2 inline-flex align-middle"><Flag team={team} /></span>{team.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {index === 0 ? "Qualifié — 1er du groupe" : index === 1 ? "Qualifié — 2e du groupe" : index === 2 ? "Candidat meilleur troisième" : "Éliminé"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SortableThirdRow({ id, third, index }: { id: string; third: RankedThird; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const qualified = index < 8;

  return (
    <div ref={setNodeRef} style={style} className={`rounded-3xl border p-4 shadow-xl ${qualified ? "border-emerald-300/30 bg-emerald-300/10" : "border-slate-200 bg-white"} ${isDragging ? "z-50 opacity-70" : ""}`}>
      <div className="flex items-center gap-4">
        <button {...attributes} {...listeners} className="cursor-grab rounded-2xl bg-slate-200 p-2 active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-slate-600" />
        </button>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-black ${qualified ? "bg-emerald-200 text-emerald-950" : "bg-white text-slate-950"}`}>{index + 1}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black"><span className="mr-2 inline-flex align-middle"><Flag team={third.team} /></span>{third.team.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">3e du groupe {third.groupId} · {qualified ? "Qualifié" : "Éliminé"}</p>
        </div>
      </div>
    </div>
  );
}

function RoundView({ title, matches, roundKey, onWinner }: { title: string; matches: Match[]; roundKey: keyof Rounds; onWinner: (roundKey: keyof Rounds, matchId: string, team?: Team | null) => void }) {
  if (!matches?.length) {
    return <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Termine le tour précédent pour générer {title.toLowerCase()}.</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h3 className="mb-5 text-center text-xl font-black">{title}</h3>
      <div className="space-y-5">
        {matches.map((match) => (
          <div key={match.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Match {match.id}</p>
            <TeamButton team={match.left} active={match.winner?.id === match.left?.id} onClick={() => onWinner(roundKey, match.id, match.left)} />
            <div className="py-2 text-center text-xs font-black text-slate-500">VS</div>
            <TeamButton team={match.right} active={match.winner?.id === match.right?.id} onClick={() => onWinner(roundKey, match.id, match.right)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamButton({ team, active, onClick }: { team?: Team | null; active: boolean; onClick: () => void }) {
  return (
    <button
      disabled={!team}
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-center transition ${active ? "border-emerald-200 bg-emerald-200 text-black shadow-lg shadow-emerald-500/30" : "border-slate-200 bg-white hover:bg-slate-200"} disabled:cursor-not-allowed disabled:opacity-30`}
    >
      <span className="text-lg font-black"><span className="mr-2 inline-flex align-middle"><Flag team={team} /></span>{team?.name || "À déterminer"}</span>
    </button>
  );
}

function FooterActions({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-3 border-t border-slate-200 pt-6">{children}</div>;
}

function ScoreLine({
    label,
    section,
  }: {
    label: string;
    section: {
      correct: number;
      available: number;
      percentage: number | null;
    };
  }) {
    const percentage = section.percentage ?? 0;

    return (
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="font-bold text-slate-900">
            {section.available === 0
              ? "Non renseigné"
              : `${section.correct}/${section.available} · ${percentage}%`}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }



function canGoNext(step: number, rounds: Rounds) {
  if (step === 2) return rounds.R32.length > 0 && rounds.R32.every((m) => m.winner);
  if (step === 3) return rounds.R16.length > 0 && rounds.R16.every((m) => m.winner);
  if (step === 4) return rounds.QF.length > 0 && rounds.QF.every((m) => m.winner);
  if (step === 5) return rounds.SF.length > 0 && rounds.SF.every((m) => m.winner);
  if (step === 6) return rounds.F.length > 0 && rounds.F.every((m) => m.winner);
  return true;
}

