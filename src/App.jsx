import React, { useState, useEffect, useCallback, useMemo } from "react";

/* =================================================================
   Pan-Canadian TCM Exam Portal — full navigable shell (single-user)
   Home · 침구(7) · 허벌(3) · 법규 · 학습도구 · 마이페이지
   Acupuncture Points ships with real cards + quiz.
================================================================= */

/* ---------------- content model ---------------- */
const AREAS = [
  {
    id: "acu", label: "침구", en: "Acupuncture",
    sections: [
      { id: "acu-found", label: "TCM Foundations", ko: "기초 이론", hasNote: true },
      { id: "acu-diag", label: "Diagnosis", ko: "진단", hasNote: true },
      { id: "acu-points", label: "Acupuncture Points", ko: "경혈", live: true },
      { id: "acu-selection", label: "Point Selections", ko: "배혈법", hasNote: true },
      { id: "acu-tech", label: "Techniques", ko: "자침 수기", hasNote: true },
      { id: "acu-thera", label: "Therapeutics", ko: "치료", hasNote: true },
      { id: "acu-west", label: "Biomedicine", ko: "서양의학" },
      { id: "acu-safety", label: "Safety", ko: "안전" },
    ],
  },
  {
    id: "herb", label: "허벌", en: "Herbology",
    sections: [
      { id: "herb-single", label: "Single Herbs", ko: "본초" },
      { id: "herb-formula", label: "Formulas", ko: "방제" },
      { id: "herb-safety", label: "Safety", ko: "안전·상호작용" },
    ],
  },
  {
    id: "common", label: "공통", en: "Common",
    sections: [
      { id: "juris", label: "Jurisprudence", ko: "법규" },
    ],
  },
];

const SECTION_INDEX = Object.fromEntries(
  AREAS.flatMap(a => a.sections.map(s => [s.id, { ...s, area: a.label, areaId: a.id }]))
);

/* ---------------- acupuncture point data (live section) ------- */
const POINTS = [
  { code: "LI-4", pinyin: "Hégǔ", cn: "合谷", channel: "Large Intestine", location: "Dorsum of the hand, between the 1st & 2nd metacarpals, midpoint of the 2nd metacarpal, radial side.", category: "Yuan-source; Command point of the face & mouth", indications: "Headache, facial & dental pain, common cold, immune regulation.", caution: "Contraindicated in pregnancy." },
  { code: "ST-36", pinyin: "Zúsānlǐ", cn: "足三里", channel: "Stomach", location: "3 cun below ST-35, one finger-breadth lateral to the anterior crest of the tibia.", category: "He-sea; Sea of Nourishment", indications: "Tonifies Qi & Blood, digestion, fatigue, immunity & longevity.", caution: "—" },
  { code: "SP-6", pinyin: "Sānyīnjiāo", cn: "三陰交", channel: "Spleen", location: "3 cun above the tip of the medial malleolus, posterior to the tibia.", category: "Crossing of the 3 leg Yin channels", indications: "Gynaecology, digestion, blood disorders, insomnia.", caution: "Contraindicated in pregnancy." },
  { code: "LV-3", pinyin: "Tàichōng", cn: "太衝", channel: "Liver", location: "Dorsum of the foot, distal to the junction of the 1st & 2nd metatarsals.", category: "Yuan-source; Shu-stream", indications: "Moves Liver Qi, calms the mind, headache, hypertension.", caution: "Part of the 'Four Gates' with LI-4." },
  { code: "PC-6", pinyin: "Nèiguān", cn: "內關", channel: "Pericardium", location: "2 cun above the wrist crease, between palmaris longus & flexor carpi radialis.", category: "Luo-connecting; Confluent of Yin Wei", indications: "Nausea, vomiting, chest pain, palpitations, anxiety.", caution: "—" },
  { code: "GB-20", pinyin: "Fēngchí", cn: "風池", channel: "Gallbladder", location: "Below the occiput, between the sternocleidomastoid & trapezius.", category: "Crossing with Yang Wei vessel", indications: "Expels Wind, headache, dizziness, eye disorders, neck stiffness.", caution: "Angle toward the opposite eye; avoid deep medial needling." },
  { code: "HT-7", pinyin: "Shénmén", cn: "神門", channel: "Heart", location: "Wrist crease, radial side of the flexor carpi ulnaris tendon.", category: "Yuan-source; Shu-stream", indications: "Calms the Shen, insomnia, palpitations, anxiety, poor memory.", caution: "—" },
  { code: "LU-7", pinyin: "Lièquē", cn: "列缺", channel: "Lung", location: "1.5 cun above the wrist crease, above the styloid process of the radius.", category: "Luo-connecting; Command of head & neck; Confluent of Ren", indications: "Cough, sore throat, headache, neck pain, common cold.", caution: "—" },
  { code: "KI-3", pinyin: "Tàixī", cn: "太谿", channel: "Kidney", location: "Between the tip of the medial malleolus & the Achilles tendon.", category: "Yuan-source; Shu-stream", indications: "Tonifies Kidney Yin & Yang, tinnitus, low back pain.", caution: "—" },
  { code: "BL-40", pinyin: "Wěizhōng", cn: "委中", channel: "Bladder", location: "Midpoint of the popliteal crease, between biceps femoris & semitendinosus.", category: "He-sea; Command point of the back", indications: "Low back pain, sciatica, knee disorders, clears Heat.", caution: "Avoid the popliteal artery/vein." },
  { code: "GV-20", pinyin: "Bǎihuì", cn: "百會", channel: "Governing Vessel", location: "Vertex, on the midline, 5 cun posterior to the anterior hairline.", category: "Crossing of all Yang channels", indications: "Raises Yang (prolapse), calms the Shen, headache, dizziness.", caution: "—" },
  { code: "ST-25", pinyin: "Tiānshū", cn: "天樞", channel: "Stomach", location: "2 cun lateral to the centre of the umbilicus.", category: "Front-Mu point of the Large Intestine", indications: "Diarrhoea, constipation, abdominal pain, regulates intestines.", caution: "—" },
];
const CH_COLOR = { "Large Intestine": "#B08D3C", "Stomach": "#A85A2E", "Spleen": "#8A6D3B", "Liver": "#3F6B57", "Pericardium": "#7A4B63", "Gallbladder": "#5B7A4B", "Heart": "#9A3B32", "Lung": "#4A6B7A", "Kidney": "#2F4858", "Bladder": "#3A5A78", "Governing Vessel": "#6B5B95" };

/* ---------------- lecture notes (section content) ---------------- */
const CONTENT_URL = "./tcm-content.json"; // content lives in its own file now; fetched at runtime, not bundled in this component

/* ---------------- persistence ---------------- */
const store = {
  async get(k, d) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

function buildQuestions(n = 8) {
  const T = [
    (p) => ({ q: `다음 위치의 혈자리는? "${p.location}"`, c: p.code, pool: POINTS.map(x => x.code) }),
    (p) => ({ q: `${p.code} (${p.cn}) 는 어느 경락인가요?`, c: p.channel, pool: [...new Set(POINTS.map(x => x.channel))] }),
    (p) => ({ q: `분류 "${p.category}" 에 해당하는 혈자리는?`, c: p.code, pool: POINTS.map(x => x.code) }),
    (p) => ({ q: `주치 "${p.indications}" 는 어느 혈자리?`, c: p.code, pool: POINTS.map(x => x.code) }),
  ];
  const src = shuffle(POINTS), out = [];
  for (let i = 0; i < n; i++) {
    const p = src[i % src.length], t = T[Math.floor(Math.random() * T.length)](p);
    const opts = shuffle([t.c, ...shuffle(t.pool.filter(o => o !== t.c)).slice(0, 3)]);
    out.push({ id: `${p.code}-${i}`, text: t.q, correct: t.c, options: opts, point: p.code });
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
  const knownCount = Object.values(known).filter(Boolean).length;
  const pointsPct = Math.round((knownCount / POINTS.length) * 100);

  const dday = useMemo(() => {
    if (!examDate) return null;
    const d = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    return d;
  }, [examDate]);

  if (!ready) return <div style={{ padding: 40, color: "#6b6455", fontFamily: "sans-serif" }}>불러오는 중…</div>;

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* top bar (mobile) */}
      <div className="topbar">
        <button className="burger" onClick={() => setSidebar(s => !s)} aria-label="메뉴">☰</button>
        <span className="brandsm">TCM Exam Portal</span>
      </div>

      <div className="layout">
        {/* ---------------- sidebar ---------------- */}
        <aside className={`sidebar ${sidebar ? "open" : ""}`}>
          <div className="brand" onClick={() => go("home")}>
            <span className="brandseal">穴</span>
            <div>
              <div className="brandeye">Pan-Canadian TCM</div>
              <div className="brandname">Exam Portal</div>
            </div>
          </div>

          <NavItem label="홈 · 대시보드" active={nav.view === "home"} onClick={() => go("home")} />

          {AREAS.map(area => (
            <div key={area.id} className="navgroup">
              <button className="navgrouphead" onClick={() => setOpenArea(o => o === area.id ? "" : area.id)}>
                <span>{area.label} <span className="navgroupen">{area.en}</span></span>
                <span className="chev">{openArea === area.id ? "−" : "+"}</span>
              </button>
              {openArea === area.id && area.sections.map(s => (
                <NavItem key={s.id} sub label={s.label} ko={s.ko} live={s.live}
                  active={nav.view === "section" && nav.sectionId === s.id}
                  onClick={() => go("section", s.id)} />
              ))}
            </div>
          ))}

          <div className="navdiv" />
          <div className="navlabel">학습도구</div>
          <NavItem label="플래시카드" active={nav.view === "cards"} onClick={() => go("cards")} />
          <NavItem label="퀴즈 · 모의고사" active={nav.view === "quiz"} onClick={() => go("quiz")} />
          <NavItem label={`오답노트${wrong.length ? ` · ${wrong.length}` : ""}`} active={nav.view === "wrong"} onClick={() => go("wrong")} />
          <NavItem label="시험지 업로드" active={nav.view === "upload"} onClick={() => go("upload")} />
          <NavItem label="진도 트래커" active={nav.view === "progress"} onClick={() => go("progress")} />

          <div className="navdiv" />
          <NavItem label="마이페이지" active={nav.view === "mypage"} onClick={() => go("mypage")} />
        </aside>

        {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}

        {/* ---------------- main ---------------- */}
        <main className="main">
          {nav.view === "home" && <Home go={go} pointsPct={pointsPct} knownCount={knownCount} wrong={wrong} dday={dday} examDate={examDate} setExamDate={(v) => { setExamDate(v); store.set("tcm:examDate", v); }} />}
          {nav.view === "section" && <SectionPage sid={nav.sectionId} go={go} known={known} setKnown={setKnown} bookmarks={bookmarks} setBookmarks={setBookmarks} wrong={wrong} setWrong={setWrong} chapterData={chapterData} />}
          {nav.view === "cards" && <CardsPlayer known={known} setKnown={setKnown} />}
          {nav.view === "quiz" && <QuizRunner wrong={wrong} setWrong={setWrong} />}
          {nav.view === "wrong" && <WrongBook wrong={wrong} setWrong={setWrong} go={go} />}
          {nav.view === "upload" && <UploadStub />}
          {nav.view === "progress" && <ProgressTracker pointsPct={pointsPct} knownCount={knownCount} />}
          {nav.view === "mypage" && <MyPage pointsPct={pointsPct} bookmarks={bookmarks} setBookmarks={setBookmarks} go={go} dday={dday} />}
        </main>
      </div>
    </div>
  );
}

/* ---------------- nav item ---------------- */
function NavItem({ label, ko, sub, live, active, onClick }) {
  return (
    <button className={`navitem ${sub ? "navsub" : ""} ${active ? "on" : ""}`} onClick={onClick}>
      <span className="navitemlabel">{label}{live && <span className="livedot" title="콘텐츠 있음" />}</span>
      {ko && <span className="navitemko">{ko}</span>}
    </button>
  );
}

/* ---------------- HOME / dashboard ---------------- */
function Home({ go, pointsPct, knownCount, wrong, dday, examDate, setExamDate }) {
  const totalSections = AREAS.reduce((n, a) => n + a.sections.length, 0);
  return (
    <div>
      <Header eyebrow="대시보드" title="오늘의 공부" seal="始" />
      <div className="grid2">
        <div className="panel accent">
          <div className="panellabel">시험까지</div>
          {dday !== null ? (
            <div className="ddaybig">{dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `+${-dday}일`}</div>
          ) : <div className="ddaymuted">시험일을 설정하세요</div>}
          <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="dateinput" />
        </div>
        <div className="panel">
          <div className="panellabel">경혈 암기</div>
          <div className="statbig">{knownCount}<span className="statof"> / {POINTS.length}</span></div>
          <Bar pct={pointsPct} />
          <button className="linkbtn" onClick={() => go("section", "acu-points")}>경혈 섹션 열기 →</button>
        </div>
      </div>

      <div className="grid3">
        <MiniStat label="전체 섹션" value={`${totalSections}개`} note="침구7 · 허벌3 · 법규1" />
        <MiniStat label="오답노트" value={`${wrong.length}개`} note={wrong.length ? "복습 필요" : "깨끗함"} onClick={() => go("wrong")} />
        <MiniStat label="콘텐츠 준비" value="6 / 12" note="Foundations · Diagnosis · Points · Selections · Techniques · Therapeutics" />
      </div>

      <div className="panel">
        <div className="panellabel">바로가기</div>
        <div className="quickrow">
          <button className="quickbtn" onClick={() => go("cards")}>플래시카드</button>
          <button className="quickbtn" onClick={() => go("quiz")}>퀴즈 시작</button>
          <button className="quickbtn" onClick={() => go("progress")}>진도 보기</button>
          <button className="quickbtn" onClick={() => go("upload")}>시험지 업로드</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SECTION page (4 sub-tabs) ---------------- */
function SectionPage({ sid, go, known, setKnown, bookmarks, setBookmarks, wrong, setWrong, chapterData }) {
  const s = SECTION_INDEX[sid];
  const [tab, setTab] = useState("notes");
  const [openChapter, setOpenChapter] = useState(null);
  const isLive = !!s.live;
  const contentLoading = chapterData === null;
  const chapters = chapterData ? chapterData[sid] : null;
  const bmKey = `sec:${sid}`;
  const bookmarked = !!bookmarks[bmKey];
  const toggleBm = () => setBookmarks(prev => { const n = { ...prev, [bmKey]: !prev[bmKey] }; store.set("tcm:bookmarks", n); return n; });

  const activeChapter = chapters && openChapter ? chapters.find(c => c.id === openChapter) : null;

  return (
    <div>
      <div className="crumb">{s.area} · {s.en || ""}</div>
      <div className="sechead">
        <Header title={s.label} sub={s.ko} inline />
        <button className={`bmbtn ${bookmarked ? "on" : ""}`} onClick={toggleBm}>{bookmarked ? "★ 즐겨찾기됨" : "☆ 즐겨찾기"}</button>
      </div>

      <div className="subtabs">
        {[["notes", "노트"], ["cards", "플래시카드"], ["bank", "문제은행"], ["prog", "진도"]].map(([k, l]) => (
          <button key={k} className={`subtab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "notes" && (contentLoading && s.hasNote
        ? <Empty icon="⏳" title="노트 불러오는 중" body="콘텐츠 파일을 불러오고 있어요..." />
        : chapters
        ? (activeChapter
            ? <div>
                <button className="backbtn" onClick={() => setOpenChapter(null)}>← 챕터 목록</button>
                <LectureNote note={activeChapter} />
              </div>
            : <ChapterList chapters={chapters} onOpen={setOpenChapter} />)
        : isLive
          ? <PointsNotes />
          : <Empty icon="✎" title="노트 준비 중" body={`${s.label} 섹션의 노트가 아직 없어요. 이 자리에 강의 노트가 들어갑니다.`} />)}

      {tab === "cards" && (isLive
        ? <CardsPlayer known={known} setKnown={setKnown} embedded />
        : <Empty icon="▢" title="플래시카드 준비 중" body="이 섹션의 카드 세트가 아직 없어요." />)}

      {tab === "bank" && (isLive
        ? <QuizRunner wrong={wrong} setWrong={setWrong} embedded />
        : <Empty icon="?" title="문제은행 준비 중" body="기출·모의고사 문제가 아직 없어요." />)}

      {tab === "prog" && <SectionProgress isLive={isLive} known={known} />}
    </div>
  );
}

function ChapterList({ chapters, onOpen }) {
  const ready = chapters.filter(c => c.status === "ready").length;
  return (
    <div className="chapwrap">
      <p className="chaplead">이 과목의 챕터 {chapters.length}개 중 {ready}개 완료. 챕터를 선택하면 노트가 열립니다.</p>
      <div className="chaplist">
        {chapters.map((c, i) => {
          const isReady = c.status === "ready";
          return (
            <button key={c.id} className={`chapitem ${isReady ? "ready" : "coming"}`} disabled={!isReady} onClick={() => isReady && onOpen(c.id)}>
              <span className="chapnum">{String(i + 1).padStart(2, "0")}</span>
              <span className="chaptext">
                <span className="chaptitle">{c.title} <span className="chapcn">{c.titleCn}</span></span>
                <span className="chapmeta">{isReady ? "노트 준비됨" : "준비 중"}</span>
              </span>
              <span className="chapchev">{isReady ? "→" : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LectureNote({ note }) {
  return (
    <div className="lnote">
      <div className="lnotehead">
        <div className="lnotetitle">{note.title} <span className="lnotecn">{note.titleCn}</span></div>
        <div className="lnotesrc">source · {note.source}</div>
      </div>

      {note.blocks.map((b, bi) => (
        <section className="lblock" key={bi}>
          <h3 className="lblockhead">{b.heading}{b.headingCn && <span className="lblockcn"> {b.headingCn}</span>}</h3>
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
        강의 노트에서 추출한 원문입니다. 한글 표기는 참고용 · 최종 확인은 원본 대조를 권장합니다.
      </div>
    </div>
  );
}

function PointsNotes() {
  return (
    <div className="notewrap">
      <p className="notelead">이 섹션은 Pan-Canadian TCM 시험에서 자주 나오는 경혈 {POINTS.length}개를 다룹니다. 아래는 요약 표이고, 상세 암기는 플래시카드 탭에서 하세요.</p>
      <div className="notetable">
        {POINTS.map(p => (
          <div className="noterow" key={p.code}>
            <span className="notecode" style={{ color: CH_COLOR[p.channel] }}>{p.code}</span>
            <span className="notecn">{p.cn}</span>
            <span className="notecat">{p.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionProgress({ isLive, known }) {
  const pct = isLive ? Math.round((Object.values(known).filter(Boolean).length / POINTS.length) * 100) : 0;
  return (
    <div className="panel">
      <div className="panellabel">이 섹션 진도</div>
      {isLive ? (
        <>
          <div className="statbig">{pct}<span className="statof">%</span></div>
          <Bar pct={pct} />
          <p className="dim">플래시카드에서 "외웠어요"로 표시한 경혈 기준입니다.</p>
        </>
      ) : <p className="dim">콘텐츠가 추가되면 여기에 완료율이 표시됩니다.</p>}
    </div>
  );
}

/* ---------------- FLASHCARD player ---------------- */
function CardsPlayer({ known, setKnown, embedded }) {
  const [deck, setDeck] = useState(POINTS);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = deck[idx];
  const toggle = (code) => setKnown(prev => { const n = { ...prev, [code]: !prev[code] }; store.set("tcm:known", n); return n; });
  const move = (d) => { setFlipped(false); setIdx(i => (i + d + deck.length) % deck.length); };
  const knownCount = Object.values(known).filter(Boolean).length;

  return (
    <div>
      {!embedded && <Header eyebrow="학습도구" title="플래시카드" seal="卡" />}
      <div className="toolbar">
        <span className="mono">{idx + 1} / {deck.length}</span>
        <span className="pill">외운 경혈 {knownCount}/{POINTS.length}</span>
        <button className="ghost" onClick={() => { setDeck(shuffle(POINTS)); setIdx(0); setFlipped(false); }}>↻ 섞기</button>
      </div>

      <div className="flash" style={{ borderColor: CH_COLOR[card.channel] }} onClick={() => setFlipped(f => !f)}>
        <span className="chtag" style={{ background: CH_COLOR[card.channel] }}>{card.channel}</span>
        {known[card.code] && <span className="knowndot">●</span>}
        {!flipped ? (
          <div className="flashfront">
            <div className="fcode">{card.code}</div>
            <div className="fcn">{card.cn}</div>
            <div className="fpin">{card.pinyin}</div>
            <div className="ftap">탭하면 상세 →</div>
          </div>
        ) : (
          <div className="flashback">
            <div className="fbhead"><b>{card.code}</b> {card.cn} · {card.pinyin}</div>
            <KV k="위치" v={card.location} />
            <KV k="분류" v={card.category} />
            <KV k="주치" v={card.indications} />
            {card.caution !== "—" && <KV k="주의" v={card.caution} danger />}
          </div>
        )}
      </div>

      <div className="cardctrl">
        <button className="nav" onClick={() => move(-1)}>← 이전</button>
        <button className={`mark ${known[card.code] ? "on" : ""}`} onClick={() => toggle(card.code)}>{known[card.code] ? "✓ 외웠어요" : "외웠어요"}</button>
        <button className="nav" onClick={() => move(1)}>다음 →</button>
      </div>
    </div>
  );
}

/* ---------------- QUIZ runner ---------------- */
function QuizRunner({ wrong, setWrong, embedded }) {
  const [quiz, setQuiz] = useState(() => buildQuestions(8));
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [sec, setSec] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { if (done) return; const t = setInterval(() => setSec(s => s + 1), 1000); return () => clearInterval(t); }, [done]);

  const start = () => { setQuiz(buildQuestions(8)); setQi(0); setPicked(null); setScore(0); setSec(0); setDone(false); };
  const answer = (opt) => {
    if (picked) return; setPicked(opt);
    const cur = quiz[qi];
    if (opt === cur.correct) setScore(s => s + 1);
    else setWrong(prev => { const n = [{ q: cur.text, correct: cur.correct, chose: opt, point: cur.point, ts: Date.now() }, ...prev].slice(0, 100); store.set("tcm:wrong", n); return n; });
  };
  const next = () => { if (qi + 1 >= quiz.length) setDone(true); else { setQi(i => i + 1); setPicked(null); } };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (done) {
    const pct = Math.round((score / quiz.length) * 100);
    return (
      <div>
        {!embedded && <Header eyebrow="학습도구" title="결과" seal="果" />}
        <div className="result">
          <div className="resultscore">{score}<span className="resultof"> / {quiz.length}</span></div>
          <div className="resultpct">{pct}% · 소요 {fmt(sec)}</div>
          <p className="resultmsg">{pct === 100 ? "완벽해요." : pct >= 70 ? "잘 하고 있어요. 오답노트를 복습하세요." : "오답노트를 먼저 훑어본 뒤 다시 도전하세요."}</p>
          <button className="mark" onClick={start}>다시 풀기</button>
        </div>
      </div>
    );
  }

  const cur = quiz[qi];
  return (
    <div>
      {!embedded && <Header eyebrow="학습도구" title="퀴즈 · 모의고사" seal="問" />}
      <div className="toolbar">
        <span className="mono">문항 {qi + 1} / {quiz.length}</span>
        <span className="mono timer">⏱ {fmt(sec)}</span>
        <span className="pill">점수 {score}</span>
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
        <button className="ghost" onClick={start}>↻ 새 문제</button>
        <button className="mark" disabled={!picked} style={{ opacity: picked ? 1 : 0.4 }} onClick={next}>{qi + 1 >= quiz.length ? "결과 보기" : "다음 →"}</button>
      </div>
    </div>
  );
}

/* ---------------- WRONG book ---------------- */
function WrongBook({ wrong, setWrong, go }) {
  const clear = () => { setWrong([]); store.set("tcm:wrong", []); };
  return (
    <div>
      <Header eyebrow="학습도구" title="오답노트" seal="誤" />
      <div className="toolbar">
        <span className="mono">틀린 문항 {wrong.length}개</span>
        {wrong.length > 0 && <button className="ghost" onClick={clear}>전체 비우기</button>}
      </div>
      {wrong.length === 0
        ? <Empty icon="✓" title="아직 틀린 문항이 없어요" body="퀴즈를 풀면 틀린 문항이 여기에 자동으로 모입니다." />
        : <div className="wronglist">
          {wrong.map((w, i) => (
            <div className="wrongitem" key={i}>
              <div className="wrongq">{w.q}</div>
              <div className="wrongline"><span className="wmy">내 답: {w.chose}</span><span className="wok">정답: {w.correct}</span></div>
              <button className="wlink" onClick={() => go("section", "acu-points")}>→ {w.point} 섹션에서 복습</button>
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
      <Header eyebrow="학습도구" title="시험지 업로드" seal="卷" />
      <div className="uploadbox">
        <div className="uploadicon">⇪</div>
        <div className="uploadtitle">PDF · 이미지 → 자동 문제화</div>
        <p className="dim" style={{ maxWidth: 420, margin: "8px auto 0" }}>
          기출 시험지나 문제 이미지를 올리면 자동으로 구조화된 문제은행으로 바꾸는 기능이에요.
          이 기능은 파일 저장과 AI 처리를 위한 서버가 필요해서, 로그인·DB 버전(실서비스)에서 켜집니다.
        </p>
        <div className="uploadstub">준비 중 · 실서비스 단계에서 활성화</div>
      </div>
    </div>
  );
}

/* ---------------- PROGRESS tracker ---------------- */
function ProgressTracker({ pointsPct, knownCount }) {
  return (
    <div>
      <Header eyebrow="학습도구" title="진도 트래커" seal="度" />
      <div className="panel">
        <div className="panellabel">섹션별 완료율</div>
        {AREAS.flatMap(a => a.sections).map(s => {
          const live = !!s.live, pct = live ? pointsPct : 0;
          return (
            <div className="progrow" key={s.id}>
              <div className="progname">{s.label} <span className="progko">{s.ko}</span></div>
              <div className="progbarwrap"><div className="progbar" style={{ width: `${pct}%` }} /></div>
              <div className="progpct">{live ? `${pct}%` : "—"}</div>
            </div>
          );
        })}
      </div>
      <p className="dim">현재는 Acupuncture Points만 실제 진도가 집계됩니다({knownCount}/{POINTS.length}). 다른 섹션은 콘텐츠 추가 후 자동 반영돼요.</p>
    </div>
  );
}

/* ---------------- MY PAGE ---------------- */
function MyPage({ pointsPct, bookmarks, setBookmarks, go, dday }) {
  const bmList = Object.entries(bookmarks).filter(([, v]) => v).map(([k]) => k.replace("sec:", ""));
  const remove = (sid) => setBookmarks(prev => { const n = { ...prev, [`sec:${sid}`]: false }; store.set("tcm:bookmarks", n); return n; });
  return (
    <div>
      <Header eyebrow="마이페이지" title="내 정보" seal="我" />
      <div className="panel">
        <div className="panellabel">계정</div>
        <div className="acctrow"><div className="avatar">나</div><div><div className="acctname">게스트 (로컬)</div><div className="dim">로그인은 실서비스 버전에서 지원됩니다.</div></div></div>
      </div>
      <div className="grid2">
        <div className="panel"><div className="panellabel">전체 진도</div><div className="statbig">{pointsPct}<span className="statof">%</span></div><Bar pct={pointsPct} /></div>
        <div className="panel"><div className="panellabel">시험까지</div><div className="ddaybig">{dday !== null ? (dday > 0 ? `D-${dday}` : "D-DAY") : "미설정"}</div></div>
      </div>
      <div className="panel">
        <div className="panellabel">즐겨찾기 {bmList.length > 0 && `· ${bmList.length}`}</div>
        {bmList.length === 0
          ? <p className="dim">섹션 페이지에서 ☆ 버튼으로 즐겨찾기를 추가하세요.</p>
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
function Header({ eyebrow, title, sub, seal, inline }) {
  return (
    <div className={inline ? "" : "pagehead"}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="pageheadrow">
        <div>
          <h1 className="pagetitle">{title}</h1>
          {sub && <div className="pagesub">{sub}</div>}
        </div>
        {seal && <div className="pageseal">{seal}</div>}
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
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
:root{--ink:#231F1A;--parch:#EFE9DC;--parch2:#E5DDCB;--card:#FBF8F1;--jade:#3F6B57;--cinnabar:#9A3B32;--brass:#A8863E;--dim:#8a8170;}
.app{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--parch);min-height:100%;}
.topbar{display:none;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border-bottom:1px solid var(--parch2);position:sticky;top:0;z-index:30;}
.burger{border:none;background:none;font-size:22px;cursor:pointer;color:var(--ink);}
.brandsm{font-family:'Noto Serif SC',serif;font-weight:700;}
.layout{display:flex;align-items:flex-start;}
.sidebar{width:248px;flex-shrink:0;background:var(--card);border-right:1px solid var(--parch2);padding:18px 12px 40px;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand{display:flex;align-items:center;gap:11px;cursor:pointer;padding:6px 8px 16px;}
.brandseal{font-family:'Noto Serif SC',serif;color:var(--parch);background:var(--cinnabar);width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;}
.brandeye{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass);font-weight:600;}
.brandname{font-family:'Noto Serif SC',serif;font-size:18px;font-weight:700;}
.navitem{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:none;background:none;padding:8px 10px;border-radius:7px;cursor:pointer;color:var(--ink);font-family:inherit;font-size:13.5px;margin-bottom:1px;}
.navitem:hover{background:var(--parch);}
.navitem.on{background:var(--parch2);font-weight:600;}
.navsub{padding-left:18px;font-size:13px;}
.navitemlabel{display:flex;align-items:center;gap:6px;}
.navitemko{font-size:11px;color:var(--dim);margin-top:1px;}
.livedot{width:6px;height:6px;border-radius:50%;background:var(--jade);display:inline-block;}
.navgroup{margin-top:4px;}
.navgrouphead{display:flex;justify-content:space-between;align-items:center;width:100%;border:none;background:none;padding:9px 10px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:var(--ink);}
.navgroupen{font-size:11px;color:var(--dim);font-weight:400;}
.chev{color:var(--dim);}
.navdiv{height:1px;background:var(--parch2);margin:12px 6px;}
.navlabel{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--brass);font-weight:600;padding:0 10px 4px;}
.scrim{display:none;}
.main{flex:1;padding:32px 40px 60px;max-width:820px;}
.pagehead{margin-bottom:22px;}
.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--brass);font-weight:600;}
.pageheadrow{display:flex;justify-content:space-between;align-items:flex-start;}
.pagetitle{font-family:'Noto Serif SC',serif;font-size:30px;font-weight:700;margin:5px 0 0;}
.pagesub{color:var(--dim);font-size:14px;margin-top:3px;}
.pageseal{font-family:'Noto Serif SC',serif;color:var(--parch);background:var(--jade);width:46px;height:46px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;}
.crumb{font-size:12px;color:var(--dim);margin-bottom:4px;letter-spacing:.03em;}
.sechead{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;}
.bmbtn{border:1px solid var(--parch2);background:var(--card);border-radius:20px;padding:6px 14px;font-size:12.5px;cursor:pointer;color:var(--dim);font-family:inherit;}
.bmbtn.on{color:var(--brass);border-color:var(--brass);font-weight:600;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
.panel{background:var(--card);border:1px solid var(--parch2);border-radius:14px;padding:20px;margin-bottom:14px;}
.panel.accent{border-color:var(--jade);}
.panellabel{font-size:12px;font-weight:600;color:var(--jade);letter-spacing:.04em;margin-bottom:10px;}
.ddaybig{font-family:'IBM Plex Mono',monospace;font-size:40px;font-weight:600;color:var(--cinnabar);line-height:1;}
.ddaymuted{font-size:15px;color:var(--dim);padding:8px 0;}
.dateinput{margin-top:12px;border:1px solid var(--parch2);border-radius:7px;padding:7px 10px;font-family:inherit;font-size:13px;color:var(--ink);background:var(--parch);}
.statbig{font-family:'IBM Plex Mono',monospace;font-size:38px;font-weight:600;color:var(--jade);line-height:1;}
.statof{font-size:20px;color:#b3aa96;}
.bar{height:8px;background:var(--parch2);border-radius:5px;overflow:hidden;margin-top:12px;}
.barfill{height:100%;background:var(--jade);border-radius:5px;transition:width .4s;}
.linkbtn{border:none;background:none;color:var(--brass);font-size:13px;cursor:pointer;padding:12px 0 0;font-family:inherit;font-weight:500;}
.ministat{text-align:left;background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:16px;font-family:inherit;cursor:default;}
.ministat.click{cursor:pointer;}
.ministat.click:hover{border-color:var(--jade);}
.ministatlabel{font-size:12px;color:var(--dim);}
.ministatvalue{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;margin:4px 0 2px;}
.ministatnote{font-size:12px;color:var(--brass);}
.quickrow{display:flex;gap:10px;flex-wrap:wrap;}
.quickbtn{border:1px solid var(--parch2);background:var(--parch);border-radius:8px;padding:11px 16px;font-size:13.5px;cursor:pointer;color:var(--ink);font-family:inherit;font-weight:500;}
.quickbtn:hover{border-color:var(--jade);}
.subtabs{display:flex;gap:2px;border-bottom:1px solid var(--parch2);margin-bottom:22px;flex-wrap:wrap;}
.subtab{border:none;background:none;padding:10px 14px;font-size:14px;font-weight:500;color:var(--dim);cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;}
.subtab.on{color:var(--ink);border-bottom:2px solid var(--jade);font-weight:600;}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.mono{font-family:'IBM Plex Mono',monospace;font-size:13px;color:#6b6455;}
.timer{color:var(--cinnabar);}
.pill{font-size:12px;background:var(--parch2);padding:4px 10px;border-radius:20px;color:var(--jade);font-weight:600;margin-left:auto;}
.ghost{border:1px solid var(--parch2);background:transparent;border-radius:6px;padding:5px 12px;font-size:13px;cursor:pointer;color:#6b6455;font-family:inherit;}
.flash{position:relative;background:var(--card);border:2px solid;border-radius:14px;padding:34px 26px;min-height:280px;cursor:pointer;box-shadow:0 6px 24px rgba(60,50,30,.08);}
.chtag{position:absolute;top:-1px;left:20px;color:var(--parch);font-size:11px;font-weight:600;padding:4px 12px;border-radius:0 0 8px 8px;}
.knowndot{position:absolute;top:14px;right:16px;color:var(--jade);font-size:13px;}
.flashfront{display:flex;flex-direction:column;align-items:center;justify-content:center;height:240px;gap:5px;}
.fcode{font-family:'IBM Plex Mono',monospace;font-size:44px;font-weight:600;}
.fcn{font-family:'Noto Serif SC',serif;font-size:38px;font-weight:600;color:var(--cinnabar);}
.fpin{font-size:17px;color:#6b6455;font-style:italic;}
.ftap{font-size:12px;color:var(--brass);margin-top:16px;letter-spacing:.05em;}
.flashback{display:flex;flex-direction:column;gap:2px;}
.fbhead{padding-bottom:11px;margin-bottom:5px;border-bottom:1px solid var(--parch2);font-family:'Noto Serif SC',serif;font-size:17px;}
.kv{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--parch);}
.kvk{min-width:38px;font-size:12px;font-weight:600;color:var(--jade);}
.kvk.danger{color:var(--cinnabar);}
.kvv{font-size:14px;line-height:1.5;color:#3a352c;flex:1;}
.cardctrl{display:flex;gap:10px;margin-top:18px;align-items:center;justify-content:center;flex-wrap:wrap;}
.nav{border:1px solid var(--parch2);background:var(--card);border-radius:8px;padding:11px 18px;font-size:14px;cursor:pointer;color:var(--ink);font-family:inherit;font-weight:500;}
.mark{border:none;background:var(--jade);color:#fff;border-radius:8px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
.mark.on{background:var(--brass);}
.qcard{background:var(--card);border:1px solid var(--parch2);border-radius:14px;padding:22px;}
.qtext{font-family:'Noto Serif SC',serif;font-size:16px;line-height:1.55;font-weight:500;margin-bottom:16px;}
.qopts{display:flex;flex-direction:column;gap:9px;}
.qopt{text-align:left;border:1px solid var(--parch2);background:var(--parch);border-radius:9px;padding:12px 15px;font-size:14.5px;cursor:pointer;color:var(--ink);font-family:inherit;}
.qopt.ok{background:#E3EDE6;border-color:var(--jade);color:var(--jade);font-weight:600;}
.qopt.bad{background:#F3E2DF;border-color:var(--cinnabar);color:var(--cinnabar);font-weight:600;}
.result{background:var(--card);border:1px solid var(--parch2);border-radius:14px;padding:34px;text-align:center;}
.resultscore{font-family:'IBM Plex Mono',monospace;font-size:60px;font-weight:600;color:var(--jade);line-height:1;}
.resultof{font-size:26px;color:#b3aa96;}
.resultpct{font-family:'IBM Plex Mono',monospace;font-size:14px;color:#6b6455;margin-top:8px;}
.resultmsg{font-size:15px;line-height:1.6;color:#3a352c;margin:16px auto 18px;max-width:360px;}
.wronglist{display:flex;flex-direction:column;gap:12px;}
.wrongitem{background:var(--card);border:1px solid var(--parch2);border-left:3px solid var(--cinnabar);border-radius:10px;padding:14px 16px;}
.wrongq{font-size:14.5px;line-height:1.5;margin-bottom:8px;color:#3a352c;}
.wrongline{display:flex;gap:16px;font-size:13px;margin-bottom:6px;flex-wrap:wrap;}
.wmy{color:var(--cinnabar);} .wok{color:var(--jade);font-weight:600;}
.wlink{border:none;background:none;font-size:13px;color:var(--brass);cursor:pointer;font-weight:500;font-family:inherit;padding:0;}
.notewrap{}
.notelead{font-size:14.5px;line-height:1.6;color:#3a352c;margin:0 0 16px;}
.notetable{background:var(--card);border:1px solid var(--parch2);border-radius:12px;overflow:hidden;}
.noterow{display:flex;align-items:center;gap:14px;padding:11px 16px;border-bottom:1px solid var(--parch);}
.noterow:last-child{border-bottom:none;}
.notecode{font-family:'IBM Plex Mono',monospace;font-weight:600;min-width:56px;}
.notecn{font-family:'Noto Serif SC',serif;font-size:16px;min-width:44px;}
.notecat{font-size:13px;color:#6b6455;}
.empty{text-align:center;padding:48px 20px;background:var(--card);border:1px dashed var(--parch2);border-radius:14px;}
.emptyicon{font-size:30px;color:var(--brass);margin-bottom:10px;}
.emptytitle{font-size:16px;font-weight:600;margin-bottom:6px;}
.emptybody{font-size:14px;color:var(--dim);max-width:420px;margin:0 auto;line-height:1.55;}
.uploadbox{background:var(--card);border:1px dashed var(--brass);border-radius:16px;padding:44px 24px;text-align:center;}
.uploadicon{font-size:38px;color:var(--brass);}
.uploadtitle{font-size:17px;font-weight:600;margin-top:10px;}
.uploadstub{display:inline-block;margin-top:18px;background:var(--parch2);color:#6b6455;font-size:12.5px;padding:6px 14px;border-radius:20px;}
.progrow{display:flex;align-items:center;gap:14px;padding:9px 0;border-bottom:1px solid var(--parch);}
.progrow:last-child{border-bottom:none;}
.progname{flex:1;font-size:14px;}
.progko{font-size:12px;color:var(--dim);margin-left:6px;}
.progbarwrap{width:120px;height:7px;background:var(--parch2);border-radius:4px;overflow:hidden;}
.progbar{height:100%;background:var(--jade);border-radius:4px;}
.progpct{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:#6b6455;min-width:36px;text-align:right;}
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
.lnotetitle{font-family:'Noto Serif SC',serif;font-size:20px;font-weight:700;}
.lnotecn{font-size:15px;color:var(--cinnabar);font-weight:600;margin-left:6px;}
.lnotesrc{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--dim);margin-top:4px;}
.lblock{padding:18px 0;border-bottom:1px solid var(--parch);}
.lblock:last-of-type{border-bottom:none;}
.lblockhead{font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600;margin:0 0 8px;color:var(--ink);}
.lblockcn{color:var(--brass);font-size:14px;font-weight:400;}
.llead{font-size:14px;line-height:1.6;color:#3a352c;margin:0 0 12px;background:var(--card);border-left:3px solid var(--jade);border-radius:0;padding:10px 14px;}
.lfig{margin:6px 0 14px;}
.lfigimg{max-width:100%;display:block;border:1px solid var(--parch2);border-radius:10px;background:var(--card);}
.lfigcap{font-size:12px;color:var(--dim);margin-top:6px;line-height:1.4;}
.llist{list-style:none;margin:0;padding:0;}
.litem{padding:8px 0 8px 18px;position:relative;border-bottom:1px solid var(--parch);}
.litem:last-child{border-bottom:none;}
.litem:before{content:"";position:absolute;left:2px;top:15px;width:6px;height:6px;border-radius:50%;background:var(--jade);}
.litemmain{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.litemt{font-size:14.5px;line-height:1.5;color:var(--ink);}
.litemcn{font-family:'Noto Serif SC',serif;font-size:13px;color:var(--cinnabar);}
.litemko{font-size:12px;color:var(--dim);}
.litemdetail{font-size:13px;line-height:1.55;color:#6b6455;margin-top:4px;}
.ltablewrap{overflow-x:auto;margin-top:6px;border:1px solid var(--parch2);border-radius:10px;}
.ltable{border-collapse:collapse;width:100%;font-size:13px;background:var(--card);}
.ltable th,.ltable td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--parch);border-right:1px solid var(--parch);vertical-align:top;line-height:1.45;}
.ltable thead th{background:var(--parch2);font-weight:600;color:var(--jade);font-family:'Noto Serif SC',serif;white-space:nowrap;}
.ltable tbody th.ltrowhead{background:#F4EFE3;font-weight:600;color:#3a352c;white-space:nowrap;}
.ltable tr:last-child th,.ltable tr:last-child td{border-bottom:none;}
.ltable th:last-child,.ltable td:last-child{border-right:none;}
.ltcorner{background:var(--parch2)!important;}
.lnotefoot{margin-top:18px;font-size:12px;color:var(--dim);background:var(--card);border:1px dashed var(--parch2);border-radius:10px;padding:12px 14px;line-height:1.5;}
.backbtn{border:none;background:none;color:var(--brass);font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;padding:0 0 14px;}
.chapwrap{}
.chaplead{font-size:14px;color:#3a352c;margin:0 0 16px;line-height:1.6;}
.chaplist{display:flex;flex-direction:column;gap:8px;}
.chapitem{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:var(--card);border:1px solid var(--parch2);border-radius:12px;padding:16px 18px;cursor:pointer;font-family:inherit;}
.chapitem.ready:hover{border-color:var(--jade);}
.chapitem.coming{opacity:.55;cursor:default;}
.chapnum{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--brass);min-width:26px;}
.chaptext{flex:1;display:flex;flex-direction:column;gap:3px;}
.chaptitle{font-family:'Noto Serif SC',serif;font-size:16px;font-weight:600;color:var(--ink);}
.chapcn{font-size:13px;color:var(--cinnabar);font-weight:400;margin-left:4px;}
.chapmeta{font-size:12px;color:var(--dim);}
.chapitem.ready .chapmeta{color:var(--jade);}
.chapchev{color:var(--jade);font-size:16px;}
@media(max-width:760px){
  .topbar{display:flex;}
  .sidebar{position:fixed;top:0;left:0;bottom:0;z-index:40;transform:translateX(-100%);transition:transform .25s;box-shadow:0 0 40px rgba(0,0,0,.15);}
  .sidebar.open{transform:translateX(0);}
  .scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:35;}
  .main{padding:22px 18px 50px;}
  .grid2,.grid3{grid-template-columns:1fr;}
  .pagetitle{font-size:25px;}
}
`;
