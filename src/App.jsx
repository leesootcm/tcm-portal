import React, { useState, useEffect, useCallback, useMemo } from "react";

/* =================================================================
   Pan-Canadian TCM Exam Portal — full navigable shell (single-user)
   Home · Acupuncture(8) · Herbology(3) · Jurisprudence · Study Tools · My Page
   Acupuncture Points ships with real cards + quiz.
================================================================= */

/* ---------------- content model ---------------- */
const AREAS = [
  {
    id: "acu", label: "Acupuncture",
    sections: [
      { id: "acu-found", label: "TCM Foundations", hasNote: true },
      { id: "acu-diag", label: "Diagnostic Methods", hasNote: true },
      { id: "acu-pattern", label: "Diagnosis", hasNote: true },
      { id: "acu-points", label: "Acupuncture Points", live: true },
      { id: "acu-selection", label: "Point Selections", hasNote: true },
      { id: "acu-tech", label: "Techniques", hasNote: true },
      { id: "acu-west", label: "Biomedicine" },
      { id: "acu-safety", label: "Safety", hasNote: true },
    ],
  },
  {
    id: "herb", label: "Herbology",
    sections: [
      { id: "herb-single", label: "Single Herbs" },
      { id: "herb-formula", label: "Formulas" },
      { id: "herb-safety", label: "Safety" },
    ],
  },
];

const SECTION_INDEX = Object.fromEntries(
  AREAS.flatMap(a => a.sections.map(s => [s.id, { ...s, area: a.label, areaId: a.id }]))
);

/* ---------------- acupuncture point data (derived from chapterData) ------- */
const POINT_CHAPTER_IDS = ["pts-lu","pts-li","pts-st","pts-sp","pts-ht","pts-pc","pts-si","pts-bl","pts-ki","pts-te","pts-gb","pts-lv","pts-cv","pts-gv"];

function deriveAllPoints(chapterData) {
  if (!chapterData) return [];
  const chapters = chapterData["acu-points"] || [];
  const out = [];
  chapters.forEach(ch => {
    if (!POINT_CHAPTER_IDS.includes(ch.id)) return;
    (ch.blocks || []).forEach(b => {
      if (!b.table) return;
      const cols = b.table.cols;
      const iPt = cols.indexOf("Point"), iName = cols.indexOf("Name"), iCat = cols.indexOf("Category"),
            iFunc = cols.indexOf("Function"), iLoc = cols.indexOf("Location"),
            iInd = cols.indexOf("Indications"), iNeed = cols.indexOf("Needling");
      if (iPt < 0 || iLoc < 0) return;
      b.table.rows.forEach(row => {
        const rawPt = row[iPt] || "";
        const code = rawPt.replace("★", "").trim();
        const m = code.match(/^([A-Z]+)(\d+)/);
        const channel = m ? m[1] : code;
        const name = iName >= 0 ? (row[iName] || "") : "";
        const parts = name.split(" ");
        const cn = parts[0] || "";
        const pinyin = parts.slice(1).join(" ") || "";
        const fields = [
          { label: "Location", value: row[iLoc] || "" },
          { label: "Category", value: iCat >= 0 ? (row[iCat] || "") : "" },
        ];
        if (iFunc >= 0 && row[iFunc]) fields.push({ label: "Function", value: row[iFunc] });
        fields.push({ label: "Indications", value: iInd >= 0 ? (row[iInd] || "") : "" });
        const caution = iNeed >= 0 ? (row[iNeed] || "—") : "—";
        if (caution !== "—") fields.push({ label: "Needling", value: caution, danger: /caution|contraindicat|avoid/i.test(caution) });
        out.push({
          code, cn, pinyin, tag: channel, tagColor: CH_COLOR[channel] || "#8A6D3B",
          chapterId: ch.id, chapterTitle: ch.title, sectionId: "acu-points",
          fields: fields.filter(f => f.value),
        });
      });
    });
  });
  return out;
}

/* ---------------- generic table-derived cards (herbs, formulas, and any future table-based section) ------- */
const CARD_PALETTE = ["#4A6B7A","#B08D3C","#A85A2E","#8A6D3B","#9A3B32","#7A4B63","#6E7A3B","#3A5A78","#2F4858","#A67C3D","#5B7A4B","#3F6B57","#8A3B5B","#6B5B95"];

function deriveGenericCards(chapterData, sectionId) {
  if (!chapterData) return [];
  const chapters = chapterData[sectionId] || [];
  const out = [];
  chapters.forEach((ch, chIdx) => {
    const tagColor = CARD_PALETTE[chIdx % CARD_PALETTE.length];
    (ch.blocks || []).forEach(b => {
      if (!b.table) return;
      const cols = b.table.cols;
      b.table.rows.forEach(row => {
        const raw = row[0] || "";
        const [line1, line2] = raw.split("\n");
        const code = (line1 || raw).trim();
        const cn = (line2 || "").trim();
        const fields = cols.slice(1).map((label, i) => ({ label, value: row[i + 1] || "" })).filter(f => f.value);
        out.push({
          code, cn, pinyin: "", tag: (b.headingCn || ch.titleCn || "").slice(0, 2) || "·", tagColor,
          chapterId: ch.id, chapterTitle: ch.title, sectionId,
          fields,
        });
      });
    });
  });
  return out;
}

const CH_COLOR = { LU:"#4A6B7A", LI:"#B08D3C", ST:"#A85A2E", SP:"#8A6D3B", HT:"#9A3B32", PC:"#7A4B63", SI:"#6E7A3B", BL:"#3A5A78", KI:"#2F4858", TE:"#A67C3D", GB:"#5B7A4B", LV:"#3F6B57", CV:"#8A3B5B", GV:"#6B5B95" };


/* ---------------- lecture notes (section content) ---------------- */
const CONTENT_URL = "./tcm-content.json"; // content lives in its own file now; fetched at runtime, not bundled in this component

/* ---------------- persistence ---------------- */
const store = {
  async get(k, d) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

function buildQuestions(cards, n = 8) {
  if (!cards || cards.length < 4) return [];
  const out = [];
  const src = shuffle(cards);
  let attempts = 0, i = 0;

  while (out.length < n && attempts < n * 8) {
    attempts++;
    const c = src[i % src.length]; i++;
    const validFields = (c.fields || []).filter(f => f.value && f.value.length > 0);

    const templates = [];

    // T1: given an attribute, name the item
    if (validFields.length > 0) {
      templates.push(() => {
        const shortish = validFields.filter(f => f.value.length < 220);
        if (shortish.length === 0) return null;
        const f = shortish[Math.floor(Math.random() * shortish.length)];
        const pool = cards.map(x => x.code).filter(x => x !== c.code);
        if (pool.length < 3) return null;
        const options = shuffle([c.code, ...shuffle(pool).slice(0, 3)]);
        return { text: `Which one has this ${f.label}: "${f.value}"?`, correct: c.code, options };
      });
    }

    // T2: given a name, identify its chapter
    templates.push(() => {
      const pool = [...new Set(cards.map(x => x.chapterTitle))].filter(x => x !== c.chapterTitle);
      if (pool.length < 3) return null;
      const options = shuffle([c.chapterTitle, ...shuffle(pool).slice(0, 3)]);
      return { text: `Which chapter does ${c.code}${c.cn ? " (" + c.cn + ")" : ""} belong to?`, correct: c.chapterTitle, options };
    });

    // T3: given a name, recall a specific attribute (reverse of T1)
    if (validFields.length > 0) {
      templates.push(() => {
        const shortFields = validFields.filter(f => f.value.length <= 80);
        if (shortFields.length === 0) return null;
        const f = shortFields[Math.floor(Math.random() * shortFields.length)];
        const distractors = [...new Set(
          cards.filter(x => x.code !== c.code)
            .map(x => (x.fields || []).find(ff => ff.label === f.label))
            .filter(Boolean).map(ff => ff.value)
            .filter(v => v && v !== f.value && v.length <= 80)
        )];
        if (distractors.length < 3) return null;
        const options = shuffle([f.value, ...shuffle(distractors).slice(0, 3)]);
        return { text: `What is the ${f.label} of ${c.code}${c.cn ? " (" + c.cn + ")" : ""}?`, correct: f.value, options };
      });
    }

    // T4: odd one out — which one does NOT belong to this chapter
    templates.push(() => {
      const sameChapter = shuffle(cards.filter(x => x.chapterId === c.chapterId && x.code !== c.code)).slice(0, 2);
      const outsider = shuffle(cards.filter(x => x.chapterId !== c.chapterId))[0];
      if (sameChapter.length < 2 || !outsider) return null;
      const options = shuffle([c.code, sameChapter[0].code, sameChapter[1].code, outsider.code]);
      return { text: `Which one does NOT belong to "${c.chapterTitle}"?`, correct: outsider.code, options };
    });

    const t = templates[Math.floor(Math.random() * templates.length)];
    const result = t();
    if (result) {
      out.push({ id: `${c.code}-${out.length}`, text: result.text, correct: result.correct, options: result.options, point: c.code, sectionId: c.sectionId });
    }
  }
  return out;
}

/* ================================================================ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [nav, setNav] = useState({ view: "home" });      // {view, sectionId?}
  const [openArea, setOpenArea] = useState("acu");
  const [sidebar, setSidebar] = useState(false);          // mobile drawer

  const [known, setKnown] = useState({});
  const [wrong, setWrong] = useState([]);
  const [bookmarks, setBookmarks] = useState({});
  const [examDate, setExamDate] = useState("");
  const [chapterData, setChapterData] = useState(null); // null = still loading

  useEffect(() => { (async () => {
    setKnown(await store.get("tcm:known", {}));
    setWrong(await store.get("tcm:wrong", []));
    setBookmarks(await store.get("tcm:bookmarks", {}));
    setExamDate(await store.get("tcm:examDate", ""));
    setReady(true);
  })(); }, []);

  useEffect(() => { (async () => {
    try {
      const res = await fetch(CONTENT_URL);
      const data = await res.json();
      setChapterData(data);
    } catch (e) {
      console.error("Failed to load chapter content:", e);
      setChapterData({}); // fall back to empty so UI doesn't hang forever
    }
  })(); }, []);

  const go = (v, sectionId) => { setNav({ view: v, sectionId }); setSidebar(false); };
  const allPoints = useMemo(() => deriveAllPoints(chapterData), [chapterData]);
  const knownCount = useMemo(() => allPoints.filter(p => known[p.code]).length, [known, allPoints]);
  const pointsPct = allPoints.length ? Math.round((knownCount / allPoints.length) * 100) : 0;

  const herbSingleCards = useMemo(() => deriveGenericCards(chapterData, "herb-single"), [chapterData]);
  const herbFormulaCards = useMemo(() => deriveGenericCards(chapterData, "herb-formula"), [chapterData]);
  const cardsBySection = useMemo(() => {
    const map = { "acu-points": allPoints, "herb-single": herbSingleCards, "herb-formula": herbFormulaCards };
    if (chapterData) {
      Object.keys(chapterData).forEach(sid => {
        if (map[sid]) return; // already handled above
        map[sid] = deriveGenericCards(chapterData, sid);
      });
    }
    return map;
  }, [chapterData, allPoints, herbSingleCards, herbFormulaCards]);
  const allCards = useMemo(() => Object.values(cardsBySection).flat(), [cardsBySection]);

  const dday = useMemo(() => {
    if (!examDate) return null;
    const d = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    return d;
  }, [examDate]);

  if (!ready) return <div style={{ padding: 40, color: "#8F8F8C", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>Loading…</div>;

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* top bar (mobile) */}
      <div className="topbar">
        <button className="burger" onClick={() => setSidebar(s => !s)} aria-label="Menu">☰</button>
        <span className="brandsm">TCM Prep Portal</span>
      </div>

      <div className="layout">
        {/* ---------------- sidebar ---------------- */}
        <aside className={`sidebar ${sidebar ? "open" : ""}`}>
          <div className="brand" onClick={() => go("home")}>
            <div>
              <div className="brandeye">Pan-Canadian TCM</div>
              <div className="brandname">Prep Portal</div>
            </div>
          </div>

          <NavItem label="Home · Dashboard" active={nav.view === "home"} onClick={() => go("home")} />

          {AREAS.map(area => (
            <div key={area.id} className="navgroup">
              <button className="navgrouphead" onClick={() => setOpenArea(o => o === area.id ? "" : area.id)}>
                <span>{area.label}</span>
                <span className="chev">{openArea === area.id ? "−" : "+"}</span>
              </button>
              {openArea === area.id && area.sections.map(s => (
                <NavItem key={s.id} sub label={s.label}
                  active={nav.view === "section" && nav.sectionId === s.id}
                  onClick={() => go("section", s.id)} />
              ))}
            </div>
          ))}


          <div className="navdiv" />
          <div className="navlabel">Study Tools</div>
          <NavItem label="Flashcards" active={nav.view === "cards"} onClick={() => go("cards")} />
          <NavItem label="Quiz" active={nav.view === "quiz" || nav.view === "quizSection"} onClick={() => go("quiz")} />
          <NavItem label="Mock Exam" active={nav.view === "mockexam"} onClick={() => go("mockexam")} />
          <NavItem label={`Wrong Answers${wrong.length ? ` · ${wrong.length}` : ""}`} active={nav.view === "wrong"} onClick={() => go("wrong")} />
          <NavItem label="Upload Exam" active={nav.view === "upload"} onClick={() => go("upload")} />
          <NavItem label="Progress Tracker" active={nav.view === "progress"} onClick={() => go("progress")} />

          <div className="navdiv" />
          <NavItem label="My Page" active={nav.view === "mypage"} onClick={() => go("mypage")} />
        </aside>

        {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}

        {/* ---------------- main ---------------- */}
        <main className="main">
          {nav.view === "home" && <Home go={go} pointsPct={pointsPct} knownCount={knownCount} pointsTotal={allPoints.length} wrong={wrong} dday={dday} examDate={examDate} setExamDate={(v) => { setExamDate(v); store.set("tcm:examDate", v); }} />}
          {nav.view === "section" && <SectionPage sid={nav.sectionId} go={go} known={known} setKnown={setKnown} bookmarks={bookmarks} setBookmarks={setBookmarks} wrong={wrong} setWrong={setWrong} chapterData={chapterData} allPoints={allPoints} cardsBySection={cardsBySection} />}
          {nav.view === "cards" && <CardsPlayer known={known} setKnown={setKnown} points={allCards} />}
          {nav.view === "quiz" && <QuizHub go={go} cardsBySection={cardsBySection} />}
          {nav.view === "quizSection" && <QuizRunner wrong={wrong} setWrong={setWrong} points={cardsBySection[nav.sectionId] || []} sectionTitle={(SECTION_INDEX[nav.sectionId] || {}).label} onBack={() => go("quiz")} />}
          {nav.view === "wrong" && <WrongBook wrong={wrong} setWrong={setWrong} go={go} />}
          {nav.view === "upload" && <UploadStub />}
          {nav.view === "mockexam" && <MockExamStub />}
          {nav.view === "progress" && <ProgressTracker knownCount={knownCount} pointsTotal={allPoints.length} cardsBySection={cardsBySection} known={known} />}
          {nav.view === "mypage" && <MyPage pointsPct={pointsPct} pointsTotal={allPoints.length} bookmarks={bookmarks} setBookmarks={setBookmarks} go={go} dday={dday} />}
        </main>
      </div>
    </div>
  );
}

/* ---------------- nav item ---------------- */
function NavItem({ label, sub, active, onClick }) {
  return (
    <button className={`navitem ${sub ? "navsub" : ""} ${active ? "on" : ""}`} onClick={onClick}>
      <span className="navitemlabel">{label}</span>
    </button>
  );
}

/* ---------------- HOME / dashboard ---------------- */
function Home({ go, pointsPct, knownCount, pointsTotal, wrong, dday, examDate, setExamDate }) {
  const totalSections = AREAS.reduce((n, a) => n + a.sections.length, 0);
  return (
    <div>
      <Header eyebrow="Dashboard" title="Study Today" />
      <div className="grid2">
        <div className="panel accent">
          <div className="panellabel">Days Until Exam</div>
          {dday !== null ? (
            <div className="ddaybig">{dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `+${-dday}d`}</div>
          ) : <div className="ddaymuted">Set your exam date</div>}
          <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="dateinput" />
        </div>
        <div className="panel">
          <div className="panellabel">Points Memorized</div>
          <div className="statbig">{knownCount}<span className="statof"> / {pointsTotal}</span></div>
          <Bar pct={pointsPct} />
          <button className="linkbtn" onClick={() => go("section", "acu-points")}>Open Acupuncture Points →</button>
        </div>
      </div>

      <div className="grid3">
        <MiniStat label="Total Sections" value={`${totalSections}`} note="Acupuncture 8 · Herbology 3 · Jurisprudence 1" />
        <MiniStat label="Wrong Answers" value={`${wrong.length}`} note={wrong.length ? "Needs review" : "All clear"} onClick={() => go("wrong")} />
        <MiniStat label="Content Ready" value="6 / 11" note="Foundations · Diagnostic Methods · Diagnosis · Points · Selections · Techniques" />
      </div>

      <div className="panel">
        <div className="panellabel">Quick Links</div>
        <div className="quickrow">
          <button className="quickbtn" onClick={() => go("cards")}>Flashcards</button>
          <button className="quickbtn" onClick={() => go("quiz")}>Start Quiz</button>
          <button className="quickbtn" onClick={() => go("progress")}>View Progress</button>
          <button className="quickbtn" onClick={() => go("upload")}>Upload Exam</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SECTION page (4 sub-tabs) ---------------- */
function SectionPage({ sid, go, known, setKnown, bookmarks, setBookmarks, wrong, setWrong, chapterData, allPoints, cardsBySection }) {
  const s = SECTION_INDEX[sid];
  const [tab, setTab] = useState("notes");
  const [openChapter, setOpenChapter] = useState(null);
  const [cardFilter, setCardFilter] = useState("all");
  const sectionCards = (cardsBySection && cardsBySection[sid]) || [];
  const isLive = sectionCards.length > 0;
  const contentLoading = chapterData === null;
  const chapters = chapterData ? chapterData[sid] : null;
  const bmKey = `sec:${sid}`;
  const bookmarked = !!bookmarks[bmKey];
  const toggleBm = () => setBookmarks(prev => { const n = { ...prev, [bmKey]: !prev[bmKey] }; store.set("tcm:bookmarks", n); return n; });

  const activeChapter = chapters && openChapter ? chapters.find(c => c.id === openChapter) : null;
  const isCardChapter = isLive && activeChapter && (activeChapter.blocks || []).some(b => b.table);
  const practiceThisChapter = () => { setCardFilter(activeChapter.id); setTab("cards"); };

  return (
    <div>
      <div className="crumb">{s.area}</div>
      <div className="sechead">
        <Header title={s.label} inline />
        <button className={`bmbtn ${bookmarked ? "on" : ""}`} onClick={toggleBm}>{bookmarked ? "★ Bookmarked" : "☆ Bookmark"}</button>
      </div>

      <div className="subtabs">
        {[["notes", "Notes"], ["cards", "Flashcards"], ["bank", "Question Bank"], ["prog", "Progress"]].map(([k, l]) => (
          <button key={k} className={`subtab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "notes" && (contentLoading && s.hasNote
        ? <Empty icon="⏳" title="Loading notes" body="Loading content file..." />
        : chapters
        ? (activeChapter
            ? <div>
                <button className="backbtn" onClick={() => setOpenChapter(null)}>← Chapter List</button>
                {isCardChapter && <button className="mark" style={{ marginBottom: 14 }} onClick={practiceThisChapter}>Practice this chapter with flashcards →</button>}
                <LectureNote note={activeChapter} />
                <button className="backbtn backbtn-bottom" onClick={() => setOpenChapter(null)}>← Back to Chapter List</button>
              </div>
            : <ChapterList chapters={chapters} onOpen={setOpenChapter} sectionId={sid} />)
        : isLive
          ? <PointsNotes points={allPoints} />
          : <Empty icon="✎" title="Notes coming soon" body={`Notes for ${s.label} are not available yet. Lecture notes will appear here.`} />)}

      {tab === "cards" && (isLive
        ? <CardsPlayer known={known} setKnown={setKnown} points={sectionCards} filterChapterId={cardFilter} onFilterChange={setCardFilter} embedded />
        : <Empty icon="▢" title="Flashcards coming soon" body="No card set for this section yet." />)}

      {tab === "bank" && (isLive
        ? <QuizRunner wrong={wrong} setWrong={setWrong} points={sectionCards} filterChapterId={cardFilter} onFilterChange={setCardFilter} embedded />
        : <Empty icon="?" title="Question bank coming soon" body="No past-exam or mock questions yet." />)}

      {tab === "prog" && <SectionProgress isLive={isLive} known={known} total={sectionCards.length} cards={sectionCards} />}
    </div>
  );
}

/* ---------------- chapter drawer groups (collapsible, color-coded) ---------------- */
/* Only sections with a lot of chapters need grouping. Add an entry here to opt a
   section in — everything else keeps the plain flat ChapterList it always had. */
const CHAPTER_GROUPS = {
  "acu-pattern": [
    { key: "zangfu", label: "Zang-Fu Patterns", labelKo: "장부변증", color: "var(--jade)", match: (id) => id.startsWith("diag-zf-") },
    { key: "disease", label: "Disease-Pattern Differentiation", labelKo: "질병별 변증", color: "var(--cinnabar)", match: (id) => id.startsWith("diag-disease-") },
    { key: "systems", label: "Diagnostic Systems", labelKo: "변증 체계", color: "var(--brass)", match: (id) => !id.startsWith("diag-zf-") && !id.startsWith("diag-disease-") },
  ],
};

function groupChapters(sectionId, chapters) {
  const config = CHAPTER_GROUPS[sectionId];
  if (!config) return null;
  const groups = config.map(g => ({ ...g, chapters: chapters.filter(c => g.match(c.id)) }));
  const grouped = groups.some(g => g.chapters.length > 0);
  return grouped ? groups : null;
}

function ChapterList({ chapters, onOpen, sectionId }) {
  const ready = chapters.filter(c => c.status === "ready").length;
  const groups = groupChapters(sectionId, chapters);
  const [openGroup, setOpenGroup] = useState(groups ? groups[0].key : null);

  return (
    <div className="chapwrap">
      <p className="chaplead">{ready} of {chapters.length} chapters ready in this subject. Select a chapter to open its notes.</p>
      {groups
        ? groups.map(g => (
            <ChapterDrawer
              key={g.key}
              group={g}
              isOpen={openGroup === g.key}
              onToggle={() => setOpenGroup(openGroup === g.key ? null : g.key)}
              onOpen={onOpen}
            />
          ))
        : <ChapterRows chapters={chapters} onOpen={onOpen} />}
    </div>
  );
}

function ChapterDrawer({ group, isOpen, onToggle, onOpen }) {
  const readyCount = group.chapters.filter(c => c.status === "ready").length;
  return (
    <div className="drawer" style={{ borderColor: isOpen ? group.color : "var(--parch2)" }}>
      <button className="drawerhead" onClick={onToggle}>
        <span className="drawerswatch" style={{ background: group.color }} />
        <span className="drawertext">
          <span className="drawertitle">{group.label}</span>
          <span className="drawerko">{group.labelKo}</span>
        </span>
        <span className="drawercount" style={{ color: group.color, borderColor: group.color }}>{readyCount}/{group.chapters.length}</span>
        <span className="drawerchev" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
      </button>
      {isOpen && (
        <div className="drawerbody">
          <ChapterRows chapters={group.chapters} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

function ChapterRows({ chapters, onOpen }) {
  return (
    <div className="chaplist">
      {chapters.map((c, i) => {
        const isReady = c.status === "ready";
        return (
          <button key={c.id} className={`chapitem ${isReady ? "ready" : "coming"}`} disabled={!isReady} onClick={() => isReady && onOpen(c.id)}>
            <span className="chapnum">{String(i + 1).padStart(2, "0")}</span>
            <span className="chaptext">
              <span className="chaptitle">{c.title}</span>
            </span>
            <span className="chapchev">{isReady ? "→" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

function LectureNote({ note }) {
  return (
    <div className="lnote">
      <div className="lnotehead">
        <div className="lnotetitle">{note.title}</div>
        <div className="lnotesrc">source · {note.source}</div>
      </div>

      {note.blocks.map((b, bi) => (
        <section className="lblock" key={bi}>
          <h3 className="lblockhead">{b.heading}</h3>
          {b.lead && <p className="llead">{b.lead}</p>}

          {b.image && (
            <figure className="lfig">
              <img className="lfigimg" src={b.image.src} alt={b.image.caption || b.heading} />
              {b.image.caption && <figcaption className="lfigcap">{b.image.caption}</figcaption>}
            </figure>
          )}

          {b.items && (
            <ul className="llist">
              {b.items.map((it, ii) => (
                <li className="litem" key={ii}>
                  <div className="litemmain">
                    <span className="litemt">{it.t}</span>
                    {it.cn && <span className="litemcn">{it.cn}</span>}
                    {it.ko && <span className="litemko">{it.ko}</span>}
                  </div>
                  {it.detail && <div className="litemdetail">{it.detail}</div>}
                </li>
              ))}
            </ul>
          )}

          {b.table && (
            <div className="ltablewrap">
              <table className="ltable">
                <thead>
                  <tr>{b.table.cols.map((c, ci) => <th key={ci} className={ci === 0 ? "ltcorner" : ""}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {b.table.rows.map((r, ri) => (
                    <tr key={ri}>{r.map((cell, ci) => ci === 0
                      ? <th key={ci} className="ltrowhead">{cell}</th>
                      : <td key={ci}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <div className="lnotefoot">
        Extracted from the source lecture notes. Please cross-check against the original material for final verification.
      </div>
    </div>
  );
}

function PointsNotes({ points }) {
  const pts = points || [];
  return (
    <div className="notewrap">
      <p className="notelead">This section covers {pts.length} acupuncture points tested on the Pan-Canadian TCM exam. Below is a summary table — use the Flashcards tab for detailed memorization.</p>
      <div className="notetable">
        {pts.map(p => {
          const category = (p.fields || []).find(f => f.label === "Category");
          return (
            <div className="noterow" key={p.code}>
              <span className="notecode" style={{ color: p.tagColor }}>{p.code}</span>
              <span className="notecn">{p.cn}</span>
              <span className="notecat">{category ? category.value : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionProgress({ isLive, known, total, cards }) {
  const knownInSection = (cards || []).filter(c => known[c.code]).length;
  const pct = isLive && total ? Math.round((knownInSection / total) * 100) : 0;
  return (
    <div className="panel">
      <div className="panellabel">Progress in This Section</div>
      {isLive ? (
        <>
          <div className="statbig">{pct}<span className="statof">%</span></div>
          <Bar pct={pct} />
          <p className="dim">Based on items marked "Known" in Flashcards.</p>
        </>
      ) : <p className="dim">Completion rate will appear here once content is added.</p>}
    </div>
  );
}

/* ---------------- FLASHCARD player ---------------- */
function buildChapterOptions(cards) {
  const bySection = new Map();
  cards.forEach(c => {
    if (!bySection.has(c.sectionId)) bySection.set(c.sectionId, new Map());
    const m = bySection.get(c.sectionId);
    if (!m.has(c.chapterId)) m.set(c.chapterId, c.chapterTitle);
  });
  return [...bySection.entries()].map(([sectionId, chMap]) => ({
    sectionId,
    sectionLabel: (SECTION_INDEX[sectionId] && SECTION_INDEX[sectionId].label) || sectionId,
    options: [...chMap.entries()],
  }));
}

function ChapterFilterSelect({ value, onChange, allCount, groups }) {
  return (
    <select className="ghost" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All ({allCount})</option>
      {groups.length > 1
        ? groups.map(g => (
            <optgroup key={g.sectionId} label={g.sectionLabel}>
              {g.options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </optgroup>
          ))
        : groups[0] && groups[0].options.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
    </select>
  );
}

function CardsPlayer({ known, setKnown, embedded, points, filterChapterId, onFilterChange }) {
  const allPts = points || [];
  const [internalFilter, setInternalFilter] = useState("all");
  const filter = filterChapterId !== undefined ? filterChapterId : internalFilter;
  const setFilter = onFilterChange || setInternalFilter;
  const filtered = filter === "all" ? allPts : allPts.filter(p => p.chapterId === filter);
  const chapterGroups = useMemo(() => buildChapterOptions(allPts), [allPts]);

  const [deck, setDeck] = useState(filtered);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => { setDeck(filtered); setIdx(0); setFlipped(false); }, [filter, allPts.length]);

  const knownCount = allPts.filter(p => known[p.code]).length;

  if (allPts.length === 0) {
    return <Empty icon="⏳" title="Loading data" body="Please wait..." />;
  }
  if (deck.length === 0) {
    return <Empty icon="▢" title="No cards" body="Nothing matches this filter." />;
  }

  const card = deck[idx];
  const toggle = (code) => setKnown(prev => { const n = { ...prev, [code]: !prev[code] }; store.set("tcm:known", n); return n; });
  const move = (d) => { setFlipped(false); setIdx(i => (i + d + deck.length) % deck.length); };

  return (
    <div>
      {!embedded && <Header eyebrow="Study Tools" title="Flashcards" />}
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <ChapterFilterSelect value={filter} onChange={setFilter} allCount={allPts.length} groups={chapterGroups} />
      </div>
      <div className="toolbar">
        <span className="mono">{idx + 1} / {deck.length}</span>
        <span className="pill">Known {knownCount}/{allPts.length}</span>
        <button className="ghost" onClick={() => { setDeck(shuffle(filtered)); setIdx(0); setFlipped(false); }}>↻ Shuffle</button>
      </div>

      <div className="flash" style={{ borderColor: card.tagColor || "#8A6D3B" }} onClick={() => setFlipped(f => !f)}>
        <span className="chtag" style={{ background: card.tagColor || "#8A6D3B" }}>{card.tag}</span>
        {known[card.code] && <span className="knowndot">●</span>}
        {!flipped ? (
          <div className="flashfront">
            <div className="fcode">{card.code}</div>
            {card.cn && <div className="fcn">{card.cn}</div>}
            {card.pinyin && <div className="fpin">{card.pinyin}</div>}
            <div className="ftap">Tap for details →</div>
          </div>
        ) : (
          <div className="flashback">
            <div className="fbhead"><b>{card.code}</b>{card.cn ? ` · ${card.cn}` : ""}</div>
            {(card.fields || []).map((f, i) => f.value && <KV key={i} k={f.label} v={f.value} danger={f.danger} />)}
          </div>
        )}
      </div>

      <div className="cardctrl">
        <button className="nav" onClick={() => move(-1)}>← Prev</button>
        <button className={`mark ${known[card.code] ? "on" : ""}`} onClick={() => toggle(card.code)}>{known[card.code] ? "✓ Known" : "Mark known"}</button>
        <button className="nav" onClick={() => move(1)}>Next →</button>
      </div>
    </div>
  );
}

/* ---------------- QUIZ runner ---------------- */
function QuizRunner({ wrong, setWrong, embedded, points, filterChapterId, onFilterChange, sectionTitle, onBack }) {
  const allPts = points || [];
  const [internalFilter, setInternalFilter] = useState("all");
  const filter = filterChapterId !== undefined ? filterChapterId : internalFilter;
  const setFilter = onFilterChange || setInternalFilter;
  const filtered = filter === "all" ? allPts : allPts.filter(p => p.chapterId === filter);
  const chapterGroups = useMemo(() => buildChapterOptions(allPts), [allPts]);

  const [quiz, setQuiz] = useState(() => buildQuestions(filtered, 8));
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [sec, setSec] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { start(); }, [filter, allPts.length]); // eslint-disable-line
  useEffect(() => { if (done) return; const t = setInterval(() => setSec(s => s + 1), 1000); return () => clearInterval(t); }, [done]);

  const start = () => { setQuiz(buildQuestions(filtered, 8)); setQi(0); setPicked(null); setScore(0); setSec(0); setDone(false); };
  const answer = (opt) => {
    if (picked) return; setPicked(opt);
    const cur = quiz[qi];
    if (opt === cur.correct) setScore(s => s + 1);
    else setWrong(prev => { const n = [{ q: cur.text, correct: cur.correct, chose: opt, point: cur.point, sectionId: cur.sectionId, ts: Date.now() }, ...prev].slice(0, 100); store.set("tcm:wrong", n); return n; });
  };
  const next = () => { if (qi + 1 >= quiz.length) setDone(true); else { setQi(i => i + 1); setPicked(null); } };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (allPts.length === 0) {
    return <Empty icon="⏳" title="Loading data" body="Please wait..." />;
  }
  if (quiz.length === 0) {
    return <Empty icon="?" title="No questions" body="Not enough items match this filter." />;
  }

  if (done) {
    const pct = Math.round((score / quiz.length) * 100);
    return (
      <div>
        {!embedded && <Header eyebrow="Study Tools" title="Results" sub={sectionTitle} />}
        {onBack && <button className="backbtn" onClick={onBack}>← Quiz Categories</button>}
        <div className="result">
          <div className="resultscore">{score}<span className="resultof"> / {quiz.length}</span></div>
          <div className="resultpct">{pct}% · Time {fmt(sec)}</div>
          <p className="resultmsg">{pct === 100 ? "Perfect score!" : pct >= 70 ? "Great work — review your Wrong Answers list." : "Review your Wrong Answers list, then try again."}</p>
          <button className="mark" onClick={start}>Retry</button>
        </div>
      </div>
    );
  }

  const cur = quiz[qi];
  return (
    <div>
      {!embedded && <Header eyebrow="Study Tools" title={sectionTitle ? `Quiz — ${sectionTitle}` : "Quiz"} />}
      {onBack && <button className="backbtn" onClick={onBack}>← Quiz Categories</button>}
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <ChapterFilterSelect value={filter} onChange={setFilter} allCount={allPts.length} groups={chapterGroups} />
      </div>
      <div className="toolbar">
        <span className="mono">Question {qi + 1} / {quiz.length}</span>
        <span className="mono timer">⏱ {fmt(sec)}</span>
        <span className="pill">Score {score}</span>
      </div>
      <div className="qcard">
        <div className="qtext">{cur.text}</div>
        <div className="qopts">
          {cur.options.map(o => {
            const ok = picked && o === cur.correct, bad = picked === o && o !== cur.correct;
            return <button key={o} className={`qopt ${ok ? "ok" : ""} ${bad ? "bad" : ""}`} disabled={!!picked} onClick={() => answer(o)}>{o}{ok ? "  ✓" : bad ? "  ✕" : ""}</button>;
          })}
        </div>
      </div>
      <div className="cardctrl">
        <button className="ghost" onClick={start}>↻ New Set</button>
        <button className="mark" disabled={!picked} style={{ opacity: picked ? 1 : 0.4 }} onClick={next}>{qi + 1 >= quiz.length ? "See Results" : "Next →"}</button>
      </div>
    </div>
  );
}

/* ---------------- QUIZ hub (category landing page) ---------------- */
function QuizHub({ go, cardsBySection }) {
  return (
    <div>
      <Header eyebrow="Study Tools" title="Quiz" sub="Pick a category to practice — questions are generated from that section's content." />
      <div className="grid2">
        {AREAS.flatMap(a => a.sections).map(s => {
          const cards = cardsBySection[s.id] || [];
          const count = cards.length;
          return (
            <button
              key={s.id}
              className={`ministat ${count > 0 ? "click" : ""}`}
              disabled={count === 0}
              style={count === 0 ? { opacity: 0.5, cursor: "default" } : undefined}
              onClick={() => count > 0 && go("quizSection", s.id)}
            >
              <div className="ministatlabel">{s.label}</div>
              <div className="ministatvalue">{count}</div>
              <div className="ministatnote">{count > 0 ? "items available" : "Coming soon"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MOCK EXAM stub ---------------- */
function MockExamStub() {
  return (
    <div>
      <Header eyebrow="Study Tools" title="Mock Exam" />
      <div className="uploadbox">
        <div className="uploadicon">▤</div>
        <div className="uploadtitle">Full-Length Practice Exams</div>
        <p className="dim" style={{ maxWidth: 420, margin: "8px auto 0" }}>
          Timed, full-length mock exams built from real past-exam-style material will live here.
          This is separate from the auto-generated Quiz — it's meant to simulate the real test once source material is added.
        </p>
        <div className="uploadstub">Coming soon · materials to be added</div>
      </div>
    </div>
  );
}

/* ---------------- WRONG book ---------------- */
function WrongBook({ wrong, setWrong, go }) {
  const clear = () => { setWrong([]); store.set("tcm:wrong", []); };
  return (
    <div>
      <Header eyebrow="Study Tools" title="Wrong Answers" />
      <div className="toolbar">
        <span className="mono">{wrong.length} wrong answers</span>
        {wrong.length > 0 && <button className="ghost" onClick={clear}>Clear All</button>}
      </div>
      {wrong.length === 0
        ? <Empty icon="✓" title="No wrong answers yet" body="Missed quiz questions will automatically appear here." />
        : <div className="wronglist">
          {wrong.map((w, i) => (
            <div className="wrongitem" key={i}>
              <div className="wrongq">{w.q}</div>
              <div className="wrongline"><span className="wmy">Your answer: {w.chose}</span><span className="wok">Correct: {w.correct}</span></div>
              <button className="wlink" onClick={() => go("section", w.sectionId || "acu-points")}>→ Review {w.point} in section</button>
            </div>
          ))}
        </div>}
    </div>
  );
}

/* ---------------- UPLOAD stub ---------------- */
function UploadStub() {
  return (
    <div>
      <Header eyebrow="Study Tools" title="Upload Exam" />
      <div className="uploadbox">
        <div className="uploadicon">⇪</div>
        <div className="uploadtitle">PDF · Image → Auto-Generated Questions</div>
        <p className="dim" style={{ maxWidth: 420, margin: "8px auto 0" }}>
          Upload past exams or question images and this feature will automatically turn them into a structured question bank.
          It requires file storage and AI processing on a server, so it will be enabled once the login/database (production) version is live.
        </p>
        <div className="uploadstub">Coming soon · enabled in the production version</div>
      </div>
    </div>
  );
}

/* ---------------- PROGRESS tracker ---------------- */
function ProgressTracker({ knownCount, pointsTotal, cardsBySection, known }) {
  return (
    <div>
      <Header eyebrow="Study Tools" title="Progress Tracker" />
      <div className="panel">
        <div className="panellabel">Completion by Section</div>
        {AREAS.flatMap(a => a.sections).map(s => {
          const cards = (cardsBySection && cardsBySection[s.id]) || [];
          const live = cards.length > 0;
          const knownHere = live ? cards.filter(c => known[c.code]).length : 0;
          const pct = live ? Math.round((knownHere / cards.length) * 100) : 0;
          return (
            <div className="progrow" key={s.id}>
              <div className="progname">{s.label}</div>
              <div className="progbarwrap"><div className="progbar" style={{ width: `${pct}%` }} /></div>
              <div className="progpct">{live ? `${pct}%` : "—"}</div>
            </div>
          );
        })}
      </div>
      <p className="dim">Progress is tracked for sections with flashcards ({knownCount}/{pointsTotal} Acupuncture Points known). Other sections will show completion once their flashcards are used.</p>
    </div>
  );
}

/* ---------------- MY PAGE ---------------- */
function MyPage({ pointsPct, bookmarks, setBookmarks, go, dday }) {
  const bmList = Object.entries(bookmarks).filter(([, v]) => v).map(([k]) => k.replace("sec:", ""));
  const remove = (sid) => setBookmarks(prev => { const n = { ...prev, [`sec:${sid}`]: false }; store.set("tcm:bookmarks", n); return n; });
  return (
    <div>
      <Header eyebrow="My Page" title="Account" />
      <div className="panel">
        <div className="panellabel">Account</div>
        <div className="acctrow"><div className="avatar">G</div><div><div className="acctname">Guest (Local)</div><div className="dim">Login will be supported in the production version.</div></div></div>
      </div>
      <div className="grid2">
        <div className="panel"><div className="panellabel">Overall Progress</div><div className="statbig">{pointsPct}<span className="statof">%</span></div><Bar pct={pointsPct} /></div>
        <div className="panel"><div className="panellabel">Days Until Exam</div><div className="ddaybig">{dday !== null ? (dday > 0 ? `D-${dday}` : "D-DAY") : "Not set"}</div></div>
      </div>
      <div className="panel">
        <div className="panellabel">Bookmarks {bmList.length > 0 && `· ${bmList.length}`}</div>
        {bmList.length === 0
          ? <p className="dim">Add bookmarks using the ☆ button on section pages.</p>
          : bmList.map(sid => (
            <div className="bmrow" key={sid}>
              <button className="bmname" onClick={() => go("section", sid)}>{SECTION_INDEX[sid]?.label || sid}</button>
              <button className="bmremove" onClick={() => remove(sid)}>✕</button>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function Header({ eyebrow, title, sub, inline }) {
  return (
    <div className={inline ? "" : "pagehead"}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="pageheadrow">
        <div>
          <h1 className="pagetitle">{title}</h1>
          {sub && <div className="pagesub">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
const KV = ({ k, v, danger }) => <div className="kv"><div className={`kvk ${danger ? "danger" : ""}`}>{k}</div><div className="kvv">{v}</div></div>;
const Bar = ({ pct }) => <div className="bar"><div className="barfill" style={{ width: `${pct}%` }} /></div>;
const MiniStat = ({ label, value, note, onClick }) => (
  <button className={`ministat ${onClick ? "click" : ""}`} onClick={onClick} disabled={!onClick}>
    <div className="ministatlabel">{label}</div><div className="ministatvalue">{value}</div><div className="ministatnote">{note}</div>
  </button>
);
const Empty = ({ icon, title, body }) => (
  <div className="empty"><div className="emptyicon">{icon}</div><div className="emptytitle">{title}</div><p className="emptybody">{body}</p></div>
);

/* ---------------- styles ---------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
:root{--ink:#242423;--parch:#FAFAFA;--parch2:#E7E7E4;--card:#FFFFFF;--jade:#2F8F6F;--cinnabar:#E5484D;--brass:#3B82C4;--dim:#8F8F8C;}
.app{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:var(--ink);background:var(--parch);min-height:100%;-webkit-font-smoothing:antialiased;}
.topbar{display:none;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--parch2);position:sticky;top:0;z-index:30;}
.burger{border:none;background:none;font-size:22px;cursor:pointer;color:var(--ink);}
.brandsm{font-weight:700;}
.layout{display:flex;align-items:flex-start;}
.sidebar{width:248px;flex-shrink:0;background:var(--card);border-right:1px solid var(--parch2);padding:18px 12px 40px;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand{display:flex;align-items:center;gap:11px;cursor:pointer;padding:6px 8px 16px;}
.brandeye{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:600;}
.brandname{font-size:17px;font-weight:700;letter-spacing:-.01em;}
.navitem{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:none;background:none;padding:8px 10px;border-radius:7px;cursor:pointer;color:var(--ink);font-family:inherit;font-size:13.5px;margin-bottom:1px;transition:background .12s;}
.navitem:hover{background:var(--parch);}
.navitem.on{background:var(--parch2);font-weight:600;}
.navsub{padding-left:18px;font-size:13px;}
.navitemlabel{display:flex;align-items:center;gap:6px;}
.navitemko{font-size:11px;color:var(--dim);margin-top:1px;}
.navgroup{margin-top:4px;}
.navgrouphead{display:flex;justify-content:space-between;align-items:center;width:100%;border:none;background:none;padding:9px 10px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--ink);}
.navgroupen{font-size:11px;color:var(--dim);font-weight:400;}
.chev{color:var(--dim);}
.navdiv{height:1px;background:var(--parch2);margin:12px 6px;}
.navlabel{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:600;padding:0 10px 4px;}
.scrim{display:none;}
.main{flex:1;padding:32px 40px 60px;max-width:820px;}
.pagehead{margin-bottom:22px;}
.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--brass);font-weight:600;}
.pageheadrow{display:flex;justify-content:space-between;align-items:flex-start;}
.pagetitle{font-size:26px;font-weight:700;margin:5px 0 0;letter-spacing:-.01em;}
.pagesub{color:var(--dim);font-size:14px;margin-top:3px;}
.crumb{font-size:12px;color:var(--dim);margin-bottom:4px;letter-spacing:.02em;}
.sechead{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;}
.bmbtn{border:1px solid var(--parch2);background:var(--card);border-radius:20px;padding:6px 14px;font-size:12.5px;cursor:pointer;color:var(--dim);font-family:inherit;}
.bmbtn.on{color:var(--brass);border-color:var(--brass);font-weight:600;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
.panel{background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:20px;margin-bottom:14px;}
.panel.accent{border-color:var(--jade);}
.panellabel{font-size:12px;font-weight:600;color:var(--jade);letter-spacing:.03em;margin-bottom:10px;}
.ddaybig{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:38px;font-weight:600;color:var(--cinnabar);line-height:1;}
.ddaymuted{font-size:15px;color:var(--dim);padding:8px 0;}
.dateinput{margin-top:12px;border:1px solid var(--parch2);border-radius:7px;padding:7px 10px;font-family:inherit;font-size:13px;color:var(--ink);background:var(--parch);}
.statbig{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:36px;font-weight:600;color:var(--jade);line-height:1;}
.statof{font-size:19px;color:var(--dim);}
.bar{height:7px;background:var(--parch2);border-radius:5px;overflow:hidden;margin-top:12px;}
.barfill{height:100%;background:var(--jade);border-radius:5px;transition:width .4s;}
.linkbtn{border:none;background:none;color:var(--brass);font-size:13px;cursor:pointer;padding:12px 0 0;font-family:inherit;font-weight:500;}
.ministat{text-align:left;background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:16px;font-family:inherit;cursor:default;}
.ministat.click{cursor:pointer;}
.ministat.click:hover{border-color:var(--jade);}
.ministatlabel{font-size:12px;color:var(--dim);}
.ministatvalue{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:22px;font-weight:600;margin:4px 0 2px;}
.ministatnote{font-size:12px;color:var(--brass);}
.quickrow{display:flex;gap:10px;flex-wrap:wrap;}
.quickbtn{border:1px solid var(--parch2);background:var(--parch);border-radius:8px;padding:11px 16px;font-size:13.5px;cursor:pointer;color:var(--ink);font-family:inherit;font-weight:500;}
.quickbtn:hover{border-color:var(--jade);}
.subtabs{display:flex;gap:2px;border-bottom:1px solid var(--parch2);margin-bottom:22px;flex-wrap:wrap;}
.subtab{border:none;background:none;padding:10px 14px;font-size:14px;font-weight:500;color:var(--dim);cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;}
.subtab.on{color:var(--ink);border-bottom:2px solid var(--jade);font-weight:600;}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;color:var(--dim);}
.timer{color:var(--cinnabar);}
.pill{font-size:12px;background:var(--parch2);padding:4px 10px;border-radius:20px;color:var(--jade);font-weight:600;margin-left:auto;}
.ghost{border:1px solid var(--parch2);background:transparent;border-radius:6px;padding:5px 12px;font-size:13px;cursor:pointer;color:var(--dim);font-family:inherit;}
.flash{position:relative;background:var(--card);border:2px solid;border-radius:14px;padding:34px 26px;min-height:280px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.chtag{position:absolute;top:-1px;left:20px;color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:0 0 8px 8px;}
.knowndot{position:absolute;top:14px;right:16px;color:var(--jade);font-size:13px;}
.flashfront{display:flex;flex-direction:column;align-items:center;justify-content:center;height:240px;gap:5px;}
.fcode{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:42px;font-weight:600;}
.fcn{font-size:34px;font-weight:600;color:var(--ink);}
.fpin{font-size:16px;color:var(--dim);font-style:italic;}
.ftap{font-size:12px;color:var(--brass);margin-top:16px;letter-spacing:.04em;}
.flashback{display:flex;flex-direction:column;gap:2px;}
.fbhead{padding-bottom:11px;margin-bottom:5px;border-bottom:1px solid var(--parch2);font-size:16px;font-weight:600;}
.kv{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--parch);}
.kvk{min-width:38px;font-size:12px;font-weight:600;color:var(--jade);}
.kvk.danger{color:var(--cinnabar);}
.kvv{font-size:14px;line-height:1.5;color:var(--ink);flex:1;}
.cardctrl{display:flex;gap:10px;margin-top:18px;align-items:center;justify-content:center;flex-wrap:wrap;}
.nav{border:1px solid var(--parch2);background:var(--card);border-radius:8px;padding:11px 18px;font-size:14px;cursor:pointer;color:var(--ink);font-family:inherit;font-weight:500;}
.mark{border:none;background:var(--jade);color:#fff;border-radius:8px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
.mark.on{background:var(--brass);}
.qcard{background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:22px;}
.qtext{font-size:16px;line-height:1.55;font-weight:500;margin-bottom:16px;}
.qopts{display:flex;flex-direction:column;gap:9px;}
.qopt{text-align:left;border:1px solid var(--parch2);background:var(--parch);border-radius:9px;padding:12px 15px;font-size:14.5px;cursor:pointer;color:var(--ink);font-family:inherit;}
.qopt.ok{background:#E7F5EF;border-color:var(--jade);color:var(--jade);font-weight:600;}
.qopt.bad{background:#FDECEC;border-color:var(--cinnabar);color:var(--cinnabar);font-weight:600;}
.result{background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:34px;text-align:center;}
.resultscore{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:56px;font-weight:600;color:var(--jade);line-height:1;}
.resultof{font-size:24px;color:var(--dim);}
.resultpct{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:14px;color:var(--dim);margin-top:8px;}
.resultmsg{font-size:15px;line-height:1.6;color:var(--ink);margin:16px auto 18px;max-width:360px;}
.wronglist{display:flex;flex-direction:column;gap:12px;}
.wrongitem{background:var(--card);border:1px solid var(--parch2);border-left:3px solid var(--cinnabar);border-radius:10px;padding:14px 16px;}
.wrongq{font-size:14.5px;line-height:1.5;margin-bottom:8px;color:var(--ink);}
.wrongline{display:flex;gap:16px;font-size:13px;margin-bottom:6px;flex-wrap:wrap;}
.wmy{color:var(--cinnabar);} .wok{color:var(--jade);font-weight:600;}
.wlink{border:none;background:none;font-size:13px;color:var(--brass);cursor:pointer;font-weight:500;font-family:inherit;padding:0;}
.notewrap{}
.notelead{font-size:14.5px;line-height:1.6;color:var(--ink);margin:0 0 16px;}
.notetable{background:var(--card);border:1px solid var(--parch2);border-radius:12px;overflow:hidden;}
.noterow{display:flex;align-items:center;gap:14px;padding:11px 16px;border-bottom:1px solid var(--parch);}
.noterow:last-child{border-bottom:none;}
.notecode{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:600;min-width:56px;}
.notecn{font-size:15px;min-width:44px;color:var(--dim);}
.notecat{font-size:13px;color:var(--dim);}
.empty{text-align:center;padding:48px 20px;background:var(--card);border:1px dashed var(--parch2);border-radius:12px;}
.emptyicon{font-size:28px;color:var(--brass);margin-bottom:10px;}
.emptytitle{font-size:16px;font-weight:600;margin-bottom:6px;}
.emptybody{font-size:14px;color:var(--dim);max-width:420px;margin:0 auto;line-height:1.55;}
.uploadbox{background:var(--card);border:1px dashed var(--brass);border-radius:14px;padding:44px 24px;text-align:center;}
.uploadicon{font-size:36px;color:var(--brass);}
.uploadtitle{font-size:17px;font-weight:600;margin-top:10px;}
.uploadstub{display:inline-block;margin-top:18px;background:var(--parch2);color:var(--dim);font-size:12.5px;padding:6px 14px;border-radius:20px;}
.progrow{display:flex;align-items:center;gap:14px;padding:9px 0;border-bottom:1px solid var(--parch);}
.progrow:last-child{border-bottom:none;}
.progname{flex:1;font-size:14px;}
.progko{font-size:12px;color:var(--dim);margin-left:6px;}
.progbarwrap{width:120px;height:7px;background:var(--parch2);border-radius:4px;overflow:hidden;}
.progbar{height:100%;background:var(--jade);border-radius:4px;}
.progpct{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12.5px;color:var(--dim);min-width:36px;text-align:right;}
.dim{font-size:13px;color:var(--dim);line-height:1.55;margin:10px 0 0;}
.acctrow{display:flex;align-items:center;gap:14px;}
.avatar{width:44px;height:44px;border-radius:50%;background:var(--jade);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;}
.acctname{font-weight:600;font-size:15px;}
.bmrow{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--parch);}
.bmrow:last-child{border-bottom:none;}
.bmname{border:none;background:none;font-size:14px;color:var(--ink);cursor:pointer;font-family:inherit;font-weight:500;padding:0;}
.bmremove{border:none;background:none;color:var(--dim);cursor:pointer;font-size:14px;}
.lnote{}
.lnotehead{border-bottom:2px solid var(--parch2);padding-bottom:12px;margin-bottom:8px;}
.lnotetitle{font-size:20px;font-weight:700;}
.lnotecn{font-size:14px;color:var(--dim);font-weight:500;margin-left:6px;}
.lnotesrc{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--dim);margin-top:4px;}
.lblock{padding:18px 0;border-bottom:1px solid var(--parch);}
.lblock:last-of-type{border-bottom:none;}
.lblockhead{font-size:16px;font-weight:600;margin:0 0 8px;color:var(--ink);}
.lblockcn{color:var(--dim);font-size:14px;font-weight:400;}
.llead{font-size:14px;line-height:1.6;color:var(--ink);margin:0 0 12px;background:var(--parch);border-left:3px solid var(--jade);border-radius:0;padding:10px 14px;}
.lfig{margin:6px 0 14px;}
.lfigimg{max-width:100%;display:block;border:1px solid var(--parch2);border-radius:10px;background:var(--card);}
.lfigcap{font-size:12px;color:var(--dim);margin-top:6px;line-height:1.4;}
.llist{list-style:none;margin:0;padding:0;}
.litem{padding:8px 0 8px 18px;position:relative;border-bottom:1px solid var(--parch);}
.litem:last-child{border-bottom:none;}
.litem:before{content:"";position:absolute;left:2px;top:15px;width:6px;height:6px;border-radius:50%;background:var(--jade);}
.litemmain{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.litemt{font-size:14.5px;line-height:1.5;color:var(--ink);}
.litemcn{font-size:13px;color:var(--dim);}
.litemko{font-size:12px;color:var(--dim);}
.litemdetail{font-size:13px;line-height:1.55;color:var(--dim);margin-top:4px;}
.ltablewrap{overflow-x:auto;margin-top:6px;border:1px solid var(--parch2);border-radius:10px;}
.ltable{border-collapse:collapse;width:100%;font-size:13px;background:var(--card);}
.ltable th,.ltable td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--parch);border-right:1px solid var(--parch);vertical-align:top;line-height:1.45;white-space:pre-line;}
.ltable thead th{background:var(--parch);font-weight:600;color:var(--jade);white-space:nowrap;}
.ltable tbody th.ltrowhead{background:var(--parch);font-weight:600;color:var(--ink);white-space:pre-line;min-width:150px;}
.ltable tr:last-child th,.ltable tr:last-child td{border-bottom:none;}
.ltable th:last-child,.ltable td:last-child{border-right:none;}
.ltcorner{background:var(--parch)!important;}
.lnotefoot{margin-top:18px;font-size:12px;color:var(--dim);background:var(--card);border:1px dashed var(--parch2);border-radius:10px;padding:12px 14px;line-height:1.5;}
.backbtn{display:block;border:none;background:none;color:var(--brass);font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;padding:0 0 14px;}
.backbtn-bottom{padding:18px 0 0;margin-top:6px;border-top:1px solid var(--parch2);width:100%;text-align:left;}
.chapwrap{}
.chaplead{font-size:14px;color:var(--ink);margin:0 0 16px;line-height:1.6;}
.drawer{border:1px solid var(--parch2);border-radius:12px;margin-bottom:12px;overflow:hidden;transition:border-color .15s;background:var(--card);}
.drawerhead{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:none;background:none;padding:14px 16px;cursor:pointer;font-family:inherit;}
.drawerswatch{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.drawertext{flex:1;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.drawertitle{font-size:14.5px;font-weight:600;color:var(--ink);}
.drawerko{font-size:12px;color:var(--dim);}
.drawercount{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;border:1px solid;border-radius:20px;padding:2px 9px;}
.drawerchev{color:var(--dim);font-size:16px;transition:transform .18s;}
.drawerbody{padding:0 12px 12px;}
.chaplist{display:flex;flex-direction:column;gap:8px;}
.chapitem{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:var(--card);border:1px solid var(--parch2);border-radius:10px;padding:16px 18px;cursor:pointer;font-family:inherit;transition:border-color .12s;}
.chapitem.ready:hover{border-color:var(--jade);}
.chapitem.coming{opacity:.55;cursor:default;}
.chapnum{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:15px;font-weight:600;color:var(--dim);min-width:26px;}
.chaptext{flex:1;display:flex;flex-direction:column;gap:3px;}
.chaptitle{font-size:15.5px;font-weight:600;color:var(--ink);}
.chapcn{font-size:13px;color:var(--dim);font-weight:400;margin-left:4px;}
.chapmeta{font-size:12px;color:var(--dim);}
.chapchev{color:var(--jade);font-size:16px;}
@media(max-width:760px){
  .topbar{display:flex;}
  .sidebar{position:fixed;top:0;left:0;bottom:0;z-index:40;transform:translateX(-100%);transition:transform .25s;box-shadow:0 0 40px rgba(0,0,0,.15);}
  .sidebar.open{transform:translateX(0);}
  .scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:35;}
  .main{padding:22px 18px 50px;}
  .grid2,.grid3{grid-template-columns:1fr;}
  .pagetitle{font-size:23px;}
}
`;
