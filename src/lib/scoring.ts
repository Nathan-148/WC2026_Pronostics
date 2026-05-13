type Team = {
  id: string;
  name: string;
  flag?: string;
};

type Match = {
  id: string;
  winner?: Team | null;
};

type SectionScore = {
  correct: number;
  available: number;
  percentage: number | null;
};

export type PlayerScore = {
  participantName: string;
  totalCorrect: number;
  totalAvailable: number;
  totalPercentage: number | null;
  sections: {
    groups: SectionScore;
    bestThirds: SectionScore;
    R32: SectionScore;
    R16: SectionScore;
    QF: SectionScore;
    SF: SectionScore;
    F: SectionScore;
    champion: SectionScore;
  };
};

function percent(correct: number, available: number) {
  if (available === 0) return null;
  return Math.round((correct / available) * 1000) / 10;
}

function emptySection(): SectionScore {
  return {
    correct: 0,
    available: 0,
    percentage: null,
  };
}

function scoreGroups(predicted: any, real: any): SectionScore {
  if (!predicted || !real) return emptySection();

  let correct = 0;
  let available = 0;

  for (const groupId of Object.keys(real)) {
    const realTeams: Team[] = real[groupId] || [];
    const predictedTeams: Team[] = predicted[groupId] || [];

    realTeams.forEach((realTeam, index) => {
      if (!realTeam?.id) return;

      available += 1;

      const predictedTeam = predictedTeams[index];

      if (predictedTeam?.id === realTeam.id) {
        correct += 1;
      }
    });
  }

  return {
    correct,
    available,
    percentage: percent(correct, available),
  };
}

function scoreBestThirds(predicted: any, real: any): SectionScore {
  if (!predicted || !real) return emptySection();

  const predictedIds = new Set(
    predicted
      .map((item: any) => item?.team?.id)
      .filter(Boolean)
  );

  const realIds = real
    .map((item: any) => item?.team?.id)
    .filter(Boolean);

  let correct = 0;

  for (const realId of realIds) {
    if (predictedIds.has(realId)) {
      correct += 1;
    }
  }

  return {
    correct,
    available: realIds.length,
    percentage: percent(correct, realIds.length),
  };
}

function scoreRound(predictedMatches: Match[] | undefined, realMatches: Match[] | undefined): SectionScore {
  if (!predictedMatches || !realMatches) return emptySection();

  let correct = 0;
  let available = 0;

  for (const realMatch of realMatches) {
    if (!realMatch?.winner?.id) continue;

    available += 1;

    const predictedMatch = predictedMatches.find(
      (match) => match.id === realMatch.id
    );

    if (predictedMatch?.winner?.id === realMatch.winner.id) {
      correct += 1;
    }
  }

  return {
    correct,
    available,
    percentage: percent(correct, available),
  };
}

function scoreChampion(predicted: Team | null | undefined, real: Team | null | undefined): SectionScore {
  if (!real?.id) return emptySection();

  const correct = predicted?.id === real.id ? 1 : 0;

  return {
    correct,
    available: 1,
    percentage: percent(correct, 1),
  };
}

export function calculatePlayerScore(prediction: any, realResults: any): PlayerScore {
  const sections = {
    groups: scoreGroups(prediction.group_rankings, realResults.group_rankings),
    bestThirds: scoreBestThirds(prediction.best_thirds, realResults.best_thirds),
    R32: scoreRound(prediction.knockout_predictions?.R32, realResults.knockout_results?.R32),
    R16: scoreRound(prediction.knockout_predictions?.R16, realResults.knockout_results?.R16),
    QF: scoreRound(prediction.knockout_predictions?.QF, realResults.knockout_results?.QF),
    SF: scoreRound(prediction.knockout_predictions?.SF, realResults.knockout_results?.SF),
    F: scoreRound(prediction.knockout_predictions?.F, realResults.knockout_results?.F),
    champion: scoreChampion(prediction.champion, realResults.champion),
  };

  const totalCorrect = Object.values(sections).reduce(
    (sum, section) => sum + section.correct,
    0
  );

  const totalAvailable = Object.values(sections).reduce(
    (sum, section) => sum + section.available,
    0
  );

  return {
    participantName: prediction.participant_name,
    totalCorrect,
    totalAvailable,
    totalPercentage: percent(totalCorrect, totalAvailable),
    sections,
  };
}

export function calculateScores(predictions: any[], realResults: any): PlayerScore[] {
  return predictions
    .map((prediction) => calculatePlayerScore(prediction, realResults))
    .sort((a, b) => (b.totalPercentage ?? 0) - (a.totalPercentage ?? 0));
}