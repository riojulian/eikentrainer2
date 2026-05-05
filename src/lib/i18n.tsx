import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UiLang = "en" | "ja";

const STORAGE_KEY = "eikentango.uiLang";

type Dict = Record<string, { en: string; ja: string }>;

const DICT: Dict = {
  // Header / nav
  "nav.study": { en: "Study", ja: "学習" },
  "nav.signin": { en: "Sign in", ja: "ログイン" },
  // Study home
  "home.hello": { en: "Hello", ja: "こんにちは" },
  "home.friend": { en: "friend", ja: "友達" },
  "home.pickWorld": { en: "Pick a world", ja: "ワールドを選ぶ" },
  "home.worldHint": { en: "Each world has its own stages", ja: "各ワールドにはステージがあります" },
  "home.stage": { en: "Stage", ja: "ステージ" },
  "home.of": { en: "of", ja: "/" },
  "home.words": { en: "words", ja: "単語" },
  "home.studyStage": { en: "Study stage", ja: "ステージを学ぶ" },
  "home.takeQuiz": { en: "Take stage quiz", ja: "クイズに挑戦" },
  "home.journey": { en: "Your journey", ja: "あなたの旅" },
  "home.loading": { en: "Loading your stages…", ja: "ステージを読み込み中…" },
  "home.justMoment": { en: "Just a moment.", ja: "少しお待ちください。" },
  "home.noStages": { en: "No stages here yet", ja: "まだステージがありません" },
  "home.noStagesHint": { en: "Add more words to this world, or pick another world above.", ja: "このワールドに単語を追加するか、別のワールドを選んでください。" },
  "home.empty": { en: "Empty", ja: "空" },
  "home.level": { en: "Level", ja: "レベル" },
  "home.achievements": { en: "Achievements", ja: "実績" },
  "home.mastered": { en: "Mastered", ja: "習得済み" },
  "home.unseen": { en: "Unseen", ja: "未勉強" },
  "home.signOut": { en: "Sign out", ja: "ログアウト" },
  "home.admin": { en: "Admin", ja: "管理" },
  "home.wordsKnowTitle": { en: "Words you know", ja: "覚えた単語" },
  // Menu
  "menu.reviewsLib": { en: "Reviews & Library", ja: "復習・単語帳" },
  "menu.wordsKnow": { en: "Words you know", ja: "覚えた単語" },
  "menu.mastered": { en: "mastered", ja: "習得済み" },
  "menu.weekly": { en: "Weekly review", ja: "週間復習" },
  "menu.monthly": { en: "Monthly review", ja: "月間復習" },
  "menu.weeklyHint": { en: "words from last 7 days", ja: "過去7日間の単語" },
  "menu.monthlyHint": { en: "words from last 30 days", ja: "過去30日間の単語" },
  "menu.unlockHint": { en: "Study 4+ words to unlock", ja: "4単語以上学習で解放" },
  "menu.browse": { en: "Browse all words", ja: "全単語を見る" },
  "menu.language": { en: "Language", ja: "言語" },
  "menu.langEn": { en: "English", ja: "English" },
  "menu.langJa": { en: "日本語", ja: "日本語" },
  // Flashcards
  "fc.definition": { en: "Definition", ja: "意味" },
  "fc.loading": { en: "Loading your cards…", ja: "カードを読み込み中…" },
  "fc.noCards": { en: "No cards here", ja: "カードがありません" },
  "fc.tryAnother": { en: "Try a different filter or add some words.", ja: "フィルターを変えるか、単語を追加してください。" },
  "fc.back": { en: "Back to study", ja: "学習に戻る" },
  "fc.deckDone": { en: "Deck complete", ja: "完了しました" },
  "fc.knew": { en: "knew", ja: "分かった" },
  "fc.stillLearning": { en: "still learning", ja: "勉強中" },
  "fc.shuffle": { en: "Shuffle and restart", ja: "シャッフルして再開" },
  "fc.reviewAgain": { en: "Review again", ja: "もう一度復習" },
  "fc.takeStageQuiz": { en: "Take stage quiz", ja: "ステージクイズへ" },
  "fc.freeStudy": { en: "Free study", ja: "自由学習" },
  "fc.btnLearning": { en: "Still learning", ja: "勉強中" },
  "fc.btnKnown": { en: "Got it", ja: "分かった" },
  // Readiness / Weak Zone
  "rdy.title": { en: "Readiness", ja: "理解度" },
  "rdy.based": { en: "", ja: "" },
  "rdy.answers": { en: "words known", ja: "語習得済" },
  "rdy.live": { en: "Readiness", ja: "理解度" },
  "rdy.tooltip": {
    en: "Words you Know (mastery 2+: 分かった or 完全に習得). Weighted: W1=60%, others 10% each.",
    ja: "「分かった」または「完全に習得」した単語の割合。加重: W1=60%, 他は各10%。",
  },
 "cmp.title": { en: "Completeness", ja: "習得率" },
 "cmp.caption": { en: "words seen", ja: "語接触済" },
 "cmp.tooltip": {
   en: "Share of Pre-1 words you've encountered, regardless of mastery level. Weighted: W1=60%, others 10% each.",
   ja: "出会った準1級単語の割合（習得度に関係なし）。加重: W1=60%, 他は各10%。",
 },
  "weak.title": { en: "Weakness", ja: "弱点" },
  "weak.empty": { en: "No weak words — keep it up! ✨", ja: "弱点なし — その調子！ ✨" },
  "weak.review": { en: "Review", ja: "復習" },
  "weak.quiz": { en: "Quiz weakness", ja: "弱点クイズ" },
  "weak.next": { en: "Next", ja: "次へ" },
  "weak.prev": { en: "Back", ja: "戻る" },
  "weak.of": { en: "of", ja: "/" },
  "quiz.correctAns": { en: "Correct answer", ja: "正解" },
  "quiz.added": { en: "Added to Weak Zone", ja: "弱点ゾーンに追加" },
  "results.delta": { en: "Readiness", ja: "理解度" },
  "results.newBadges": { en: "Badges unlocked!", ja: "バッジ解放！" },
};

type Ctx = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  t: (key: keyof typeof DICT) => string;
};

const LangCtx = createContext<Ctx | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as UiLang | null;
      if (saved === "en" || saved === "ja") setLangState(saved);
      else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ja")) {
        setLangState("ja");
      }
    } catch {}
  }, []);

  const setLang = (l: UiLang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const t = (key: keyof typeof DICT) => DICT[key]?.[lang] ?? String(key);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
