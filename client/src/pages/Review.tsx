import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  fetchDueCards,
  gradeAnswer,
  skipCard,
  type DueCard,
  type GradeResponse,
} from "../api";
import ReviewCard from "../components/review/ReviewCard";
import ReviewFeedback from "../components/review/ReviewFeedback";
import ReviewSummary from "../components/review/ReviewSummary";
import GradingState from "../components/review/GradingState";

type Phase = "answering" | "grading" | "feedback" | "skipped" | "complete";

export default function Review() {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [currentResult, setCurrentResult] = useState<GradeResponse | null>(null);
  const [allResults, setAllResults] = useState<GradeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [skipScheduledDays, setSkipScheduledDays] = useState(0);

  useEffect(() => {
    fetchDueCards()
      .then((c) => {
        setCards(c);
        if (c.length === 0) setPhase("complete");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmitAnswer(answer: string) {
    const card = cards[currentIndex]!;
    setSubmittedAnswer(answer);
    setPhase("grading");

    try {
      const result = await gradeAnswer(card.id, answer);
      setCurrentResult(result);
      setAllResults((prev) => [...prev, result]);
      setPhase("feedback");
    } catch (err) {
      console.error("Grading error:", err);
      setError(err instanceof Error ? err.message : "Failed to grade answer. Please try again.");
      setPhase("answering");
    }
  }

  async function handleSkip() {
    const card = cards[currentIndex]!;
    try {
      const result = await skipCard(card.id);
      const syntheticResult: GradeResponse = {
        grade: {
          rating: "easy",
          feedback: "Skipped — marked as known",
          correct_points: [],
          missed_points: [],
        },
        scheduling: result.scheduling,
      };
      setAllResults((prev) => [...prev, syntheticResult]);
      setSkipScheduledDays(result.scheduling.scheduledDays);
      setPhase("skipped");

      // Auto-advance after a brief pause
      setTimeout(() => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= cards.length) {
          setPhase("complete");
        } else {
          setCurrentIndex(nextIndex);
          setPhase("answering");
        }
      }, 1200);
    } catch (err) {
      console.error("Skip error:", err);
      setError(err instanceof Error ? err.message : "Failed to skip card. Please try again.");
    }
  }

  function handleNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      setPhase("complete");
    } else {
      setCurrentIndex(nextIndex);
      setCurrentResult(null);
      setPhase("answering");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading reviews...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Daily Review</h1>
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700">
          Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {phase === "answering" && cards.length > 0 && (
        <ReviewCard
          card={cards[currentIndex]!}
          onSubmit={handleSubmitAnswer}
          onSkip={handleSkip}
          disabled={false}
          currentIndex={currentIndex}
          totalCards={cards.length}
        />
      )}

      {phase === "grading" && (
        <GradingState
          card={cards[currentIndex]!}
          submittedAnswer={submittedAnswer}
          currentIndex={currentIndex}
          totalCards={cards.length}
        />
      )}

      {phase === "skipped" && (
        <div className="mx-auto max-w-2xl animate-fade-in">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-emerald-900">
              Marked as known
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Next review in {skipScheduledDays} {skipScheduledDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
      )}

      {phase === "feedback" && currentResult && (
        <ReviewFeedback
          result={currentResult}
          idealAnswer={cards[currentIndex]!.concept.idealAnswer}
          onNext={handleNext}
        />
      )}

      {phase === "complete" && (
        <>
          {allResults.length > 0 ? (
            <ReviewSummary results={allResults} />
          ) : (
            <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center">
              <p className="text-lg font-medium text-zinc-900">
                No reviews due!
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Come back later when more cards are due for review.
              </p>
              <Link
                to="/"
                className="mt-4 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Back to Dashboard
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
