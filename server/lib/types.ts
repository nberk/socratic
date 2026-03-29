export type ConceptInput = {
  name: string;
  description: string;
  question: string;
  ideal_answer: string;
};

export type SectionCompleteInput = {
  concepts: ConceptInput[];
  section_summary: string;
};

export type GradeResult = {
  rating: "again" | "hard" | "good" | "easy";
  feedback: string;
  correct_points: string[];
  missed_points: string[];
};

export type LessonPlanInput = {
  title: string;
  sections: {
    sectionTitle: string;
    objectives: string[];
  }[];
};
