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
 "home.pickWorld": { en: "Pick a category", ja: "カテゴリーを選ぶ" },
 "home.worldHint": { en: "Vocabulary sets by topic", ja: "テーマ別の語彙セット" },
  "home.stage": { en: "Stage", ja: "ステージ" },
  "home.of": { en: "of", ja: "/" },
  "home.words": { en: "words", ja: "単語" },
 "home.studyStage": { en: "Study Flashcards", ja: "フラッシュカードで学ぶ" },
 "home.takeQuiz": { en: "Or take the quiz", ja: "またはクイズに挑戦" },
  "home.journey": { en: "Your journey", ja: "あなたの旅" },
  "home.loading": { en: "Loading your stages…", ja: "ステージを読み込み中…" },
  "home.justMoment": { en: "Just a moment.", ja: "少しお待ちください。" },
  "home.noStages": { en: "No stages here yet", ja: "まだステージがありません" },
 "home.noStagesHint": { en: "Add more words to this category, or pick another category above.", ja: "このカテゴリーに単語を追加するか、別のカテゴリーを選んでください。" },
  "home.empty": { en: "Empty", ja: "空" },
  "home.level": { en: "Level", ja: "レベル" },
  "home.achievements": { en: "Achievements", ja: "実績" },
  "home.mastered": { en: "Mastered", ja: "習得済み" },
  "home.unseen": { en: "Unseen", ja: "未勉強" },
  "home.signOut": { en: "Sign out", ja: "ログアウト" },
  "home.admin": { en: "Admin", ja: "管理" },
  "home.wordsKnowTitle": { en: "Words you know", ja: "覚えた単語" },
 "home.tabs.progress": { en: "Progress", ja: "進捗" },
 "home.tabs.map": { en: "Map", ja: "マップ" },
 "home.tabs.badges": { en: "Badges", ja: "バッジ" },
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
  // Mastery progress
  "mastery.title": { en: "Mastery progress", ja: "習得進捗" },
  "mastery.caption": { en: "words seen", ja: "語接触済" },
  "mastery.known": { en: "known", ja: "習得済" },
  "mastery.live": { en: "Progress", ja: "進捗" },
  "mastery.legend.untouched": { en: "untouched", ja: "未学習" },
  "mastery.tooltip": {
    en: "Linear credit per mastery level: untouched=0, 勉強中=0.25, 分かり始めた=0.5, 分かった=0.75, 完全に習得=1.0. Weighted: W1=60%, others 10%.",
    ja: "習得度ごとの線形配点: 未学習=0, 勉強中=0.25, 分かり始めた=0.5, 分かった=0.75, 完全に習得=1.0。加重: W1=60%, 他は各10%。",
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
  "results.delta": { en: "Progress", ja: "進捗" },
  // Auth
  "auth.welcome": { en: "Welcome to EikenTango", ja: "EikenTango へようこそ" },
  "auth.tagline": { en: "A little every day — master the words.", ja: "毎日コツコツ、単語マスターへ。" },
  "auth.signin": { en: "Sign in", ja: "ログイン" },
  "auth.signup": { en: "Sign up", ja: "新規登録" },
  "auth.email": { en: "Email", ja: "メールアドレス" },
  "auth.password": { en: "Password", ja: "パスワード" },
  "auth.displayName": { en: "Display name", ja: "表示名" },
  "auth.signinBtn": { en: "Sign in", ja: "ログイン" },
  "auth.signupBtn": { en: "Create account", ja: "アカウントを作成" },
  "auth.welcomeBack": { en: "Welcome back", ja: "おかえりなさい" },
  "auth.created": { en: "Account created!", ja: "アカウントを作成しました！" },
  "auth.studentNote": { en: "New accounts are created as students. An admin can promote you in the database.", ja: "新規アカウントは生徒として作成されます。管理者が権限を変更できます。" },
  "auth.continueWithGoogle": { en: "Continue with Google", ja: "Googleで続ける" },
  "auth.continueWithApple": { en: "Continue with Apple", ja: "Appleで続ける" },
  "auth.or": { en: "or", ja: "または" },
  "level.short": { en: "英検準1級 (Pre-1)", ja: "英検準1級" },
  "level.comingSoon": { en: "More levels coming soon", ja: "他の級は近日対応予定" },
  "level.badge": { en: "Pre-1 only · more levels coming soon", ja: "準1級のみ対応 ・ 他の級は近日対応" },
  "results.newBadges": { en: "Badges unlocked!", ja: "バッジ解放！" },
  // Toasts
  "toast.upload.extracting": { en: "Extracting vocabulary…", ja: "単語を抽出中…" },
  "toast.upload.found": { en: "Found {n} words", ja: "{n}語見つかりました" },
  "toast.upload.failed": { en: "Upload failed", ja: "アップロードに失敗しました" },
  "toast.enrich.noLines": { en: "No valid lines. Format: <tier> <word>, e.g. '1 ambiguous'", ja: "有効な行がありません。形式: <ティア> <単語>（例: '1 ambiguous'）" },
  "toast.enrich.skipped": { en: "Skipped {n} unparseable lines", ja: "解析できない{n}行をスキップしました" },
  "toast.enrich.enriching": { en: "Enriching {n} items…", ja: "{n}件を補強中…" },
  "toast.enrich.done": { en: "Enriched {n} words", ja: "{n}語を補強しました" },
  "toast.enrich.failed": { en: "Enrich failed", ja: "補強に失敗しました" },
  "toast.words.saved": { en: "Saved to word bank", ja: "単語バンクに保存しました" },
  "toast.words.updated": { en: "Updated", ja: "更新しました" },
  "toast.words.created": { en: "Created", ja: "作成しました" },
};

type Ctx = {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  t: (key: keyof typeof DICT) => string;
};

const LangCtx = createContext<Ctx | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("ja");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as UiLang | null;
      if (saved === "en" || saved === "ja") setLangState(saved);
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
