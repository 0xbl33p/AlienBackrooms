import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './index.css'
import { queryAIS, type AISMessage } from './lib/ais'
import { BackroomsGame } from './components/BackroomsGame'
import { DesertScene } from './components/DesertScene'
import {
  type PursueRecord,
  fetchRecords,
  assetUrl,
  recordsToPickups,
} from './lib/pursue'
import { MAZE_PICKUP_COUNT, type FilePickup } from './lib/gameState'

const BOOT_SEQUENCE = [
  "INITIALIZING DEPARTMENT OF WAR SECURE KERNEL...",
  "LOADING SUBSYSTEMS [OK]",
  "ESTABLISHING SECURE CONNECTION TO SECTOR 7...",
  "BYPASSING LOCAL PROXY...",
  "ACCESSING CLASSIFIED DATABASE: PURSUE",
  "WARNING: YOU ARE ACCESSING A SECURE SYSTEM.",
  "UNAUTHORIZED ACCESS IS PUNISHABLE BY FEDERAL LAW.",
  "PLEASE PROVIDE CLEARANCE CODE:"
];

const RELEASE_NOTICE = "PURSUE — PRESIDENTIAL UNSEALING AND REPORTING SYSTEM FOR UAP ENCOUNTERS. ROLLING RELEASES PER SECDEF DIRECTIVE. UNRESOLVED CASES — NO DEFINITIVE DETERMINATION ON THE NATURE OF OBSERVED PHENOMENA.";

const RECORDS_PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────
// CRT screen wrapper
// ─────────────────────────────────────────────────────────────────────────
function CRTScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-screen-frame">
      <div className="crt-screen-curve">
        <div className="crt-screen-content">{children}</div>
        <div className="crt-screen-scanlines" />
        <div className="crt-screen-rgb" />
        <div className="crt-screen-vignette" />
        <div className="crt-screen-roll" />
        <div className="crt-screen-flicker" />
      </div>
    </div>
  );
}

function TypingText({ text, speed = 30, onComplete }: { text: string, speed?: number, onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("");
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return <div>{displayedText}</div>;
}

function GlobalAISTerminal({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<AISMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const userMsg: AISMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);
    try {
      const response = await queryAIS([...messages, userMsg]);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN FAULT';
      setMessages(prev => [...prev, { role: 'assistant', content: `SYSTEM ERROR: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', paddingBottom: '60px' }}>
      <div style={{ marginBottom: '16px', opacity: 0.7 }}>{"<< [ESC] RETURN TO MAIN MENU"}</div>
      <h2 className="glow-text" style={{ marginTop: 0 }}>A.I.S. GLOBAL TERMINAL v4.2</h2>
      <p style={{ opacity: 0.7 }}>AWAITING INPUT. QUERY ANY CLASSIFIED DATA OR SUBMIT ANALYSIS REQUESTS.</p>
      <div style={{ marginTop: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '15px' }}>
            <span className="glow-text">{m.role === 'user' ? "USER > " : "A.I.S. > "}</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
          </div>
        ))}
        {isLoading && <div className="loading-cursor">A.I.S. PROCESSING</div>}
      </div>
      <form onSubmit={handleSubmit} className="terminal-input-row" style={{ position: 'absolute', bottom: '4vmin', left: '6vmin', right: '6vmin', width: 'auto' }}>
        <label className="glow-text">{"> "}</label>
        <input
          type="text" autoFocus value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ENTER QUERY..."
          disabled={isLoading}
        />
      </form>
    </div>
  );
}

function BootSequenceOnCRT({ onComplete }: { onComplete: () => void }) {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (sequenceIndex < BOOT_SEQUENCE.length - 1) setSequenceIndex(sequenceIndex + 1);
    else setShowInput(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.toUpperCase() === "ECHO-7") onComplete();
    else { setError("INVALID CLEARANCE CODE. ATTEMPT LOGGED."); setInputValue(""); }
  };

  return (
    <CRTScreen>
      {BOOT_SEQUENCE.slice(0, sequenceIndex + 1).map((line, idx) => (
        <div key={idx}>
          {idx === sequenceIndex
            ? <TypingText text={line} speed={18} onComplete={handleNext} />
            : <div>{line}</div>}
        </div>
      ))}
      {showInput && (
        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <label className="glow-text">{"> "}</label>
          <input
            type="text" autoFocus value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(null); }}
            placeholder="[CLEARANCE CODE]"
          />
          {error && <div style={{ color: '#ff6666', marginTop: '8px' }}>{error}</div>}
          <div style={{ opacity: 0.5, fontSize: '14px', marginTop: '10px' }}>
            FIELD AGENT CLEARANCE: ECHO-7
          </div>
        </form>
      )}
    </CRTScreen>
  );
}

interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

function RecordDetail({
  record,
  onBack,
}: {
  record: PursueRecord;
  onBack: () => void;
}) {
  const [aisResponse, setAisResponse] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [aiQuery, setAiQuery] = useState("");

  const thumbUrl = assetUrl(record.thumbnailUrl);
  const docUrl = assetUrl(record.documentUrl);
  const docExt = record.documentUrl.split('.').pop()?.toLowerCase() || record.type.toLowerCase();
  const isVideo = record.type.toUpperCase().startsWith('V') || !!record.videoId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !(document.activeElement instanceof HTMLInputElement)) {
        onBack();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const handleHypothesis = async () => {
    if (isQuerying) return;
    setIsQuerying(true); setAisResponse(null);
    try {
      const prompt = `PROVIDE A HYPOTHESIS FOR CASE: ${record.title}. AGENCY: ${record.agency}. DATA: ${record.description}`;
      setAisResponse(await queryAIS([{ role: 'user', content: prompt }]));
    } catch (err: unknown) {
      setAisResponse(`SYSTEM ERROR: ${err instanceof Error ? err.message : 'UNKNOWN'}`);
    } finally { setIsQuerying(false); }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || isQuerying) return;
    setIsQuerying(true);
    const q = aiQuery; setAiQuery("");
    try {
      const prompt = `REGARDING CASE ${record.title} [${record.agency}]: ${q}. CONTEXT: ${record.description}`;
      setAisResponse(await queryAIS([{ role: 'user', content: prompt }]));
    } catch (err: unknown) {
      setAisResponse(`SYSTEM ERROR: ${err instanceof Error ? err.message : 'UNKNOWN'}`);
    } finally { setIsQuerying(false); }
  };

  return (
    <div style={{ border: '2px solid var(--phosphor-green)', padding: '20px', backgroundColor: 'rgba(51, 255, 51, 0.05)' }}>
      <div style={{ marginBottom: '20px', opacity: 0.7 }}>{"<< [ESC] RETURN TO ARCHIVE"}</div>
      <h2 className="glow-text" style={{ marginTop: 0, wordBreak: 'break-word' }}>{record.title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '16px', marginTop: '10px' }}>
        <div><strong>AGENCY:</strong> {record.agency}</div>
        <div><strong>TYPE:</strong> {record.type || 'PDF'}</div>
        <div><strong>RELEASE:</strong> {record.releaseDate || 'N/A'}</div>
        <div><strong>INCIDENT:</strong> {record.incidentDate || 'N/A'}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong>LOCATION:</strong> {record.incidentLocation}</div>
      </div>

      {thumbUrl && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <img
            src={thumbUrl}
            alt={record.title}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '320px', border: '1px solid var(--phosphor-green)', filter: 'sepia(0.4) hue-rotate(40deg) brightness(0.95)' }}
          />
        </div>
      )}

      <hr style={{ borderColor: 'var(--phosphor-green)', margin: '20px 0' }} />
      <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{record.description || '[NO DESCRIPTION ON FILE]'}</p>
      {record.redacted && (
        <p style={{ marginTop: '12px', opacity: 0.75, fontSize: '15px' }}>
          [NOTE] REDACTIONS PRESENT — APPLIED TO PROTECT WITNESSES, SENSITIVE LOCATIONS, OR UNRELATED MATERIAL.
        </p>
      )}

      {isVideo && record.videoId && (
        <p style={{ marginTop: '20px' }}>
          <strong>DVIDS VIDEO ID:</strong> {record.videoId} —{' '}
          <a
            href={`https://www.dvidshub.net/video/${record.videoId}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#9cf' }}
          >
            VIEW ON DVIDS ↗
          </a>
        </p>
      )}

      {docUrl && (
        <div style={{ marginTop: '20px' }}>
          <a
            href={docUrl}
            target="_blank"
            rel="noreferrer"
            className="button"
            style={{ display: 'inline-block', padding: '10px 18px', border: '1px solid var(--phosphor-green)', color: 'var(--phosphor-green)', textDecoration: 'none' }}
          >
            [ DOWNLOAD .{docExt.toUpperCase()} ]
          </a>
        </div>
      )}

      <div style={{ marginTop: '30px', borderTop: '1px solid var(--phosphor-green)', paddingTop: '20px' }}>
        <h3 className="glow-text">A.I.S. ANALYSIS TOOLS</h3>
        <button onClick={handleHypothesis} disabled={isQuerying}>
          {isQuerying ? "A.I.S. CRUNCHING..." : "[REQUEST A.I.S. HYPOTHESIS]"}
        </button>
        <form onSubmit={handleQuery} className="terminal-input-row" style={{ marginTop: '15px' }}>
          <label className="glow-text">A.I.S. QUERY {" > "} </label>
          <input
            type="text" value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="ASK ABOUT THIS FILE..."
            disabled={isQuerying}
          />
        </form>
        {aisResponse && (
          <div style={{ marginTop: '20px', padding: '15px', border: '1px dashed var(--phosphor-green)', backgroundColor: 'rgba(51, 255, 51, 0.02)' }}>
            <div className="glow-text">A.I.S. RESPONSE:</div>
            <TypingText text={aisResponse} speed={10} />
          </div>
        )}
      </div>
    </div>
  );
}

function ArchiveBrowser({
  records,
  collected,
  onSelect,
  onBack,
}: {
  records: PursueRecord[];
  collected: Set<string>;
  onSelect: (r: PursueRecord) => void;
  onBack: () => void;
}) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [agency, setAgency] = useState<string>('ALL');
  const [rowIndex, setRowIndex] = useState(0);

  const agencies = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) if (r.agency) set.add(r.agency);
    return ['ALL', ...Array.from(set).sort()];
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (agency !== 'ALL' && r.agency !== agency) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.incidentLocation.toLowerCase().includes(q)
      );
    });
  }, [records, query, agency]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));
  const start = page * RECORDS_PER_PAGE;
  const slice = filtered.slice(start, start + RECORDS_PER_PAGE);

  useEffect(() => { setPage(0); setRowIndex(0); }, [query, agency]);
  useEffect(() => { setRowIndex(0); }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While typing in the search box, only Escape & Enter are global; let
      // arrows/letters edit text.
      const inField =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      if (e.code === 'Escape') {
        if (inField) (document.activeElement as HTMLElement).blur();
        else { onBack(); }
        e.preventDefault();
        return;
      }

      if (inField) return;

      if (e.code === 'ArrowDown') {
        setRowIndex((i) => {
          if (slice.length === 0) return 0;
          if (i >= slice.length - 1) {
            if (page < pageCount - 1) setPage((p) => p + 1);
            return slice.length - 1;
          }
          return i + 1;
        });
        e.preventDefault();
      } else if (e.code === 'ArrowUp') {
        setRowIndex((i) => {
          if (slice.length === 0) return 0;
          if (i <= 0) {
            if (page > 0) setPage((p) => p - 1);
            return 0;
          }
          return i - 1;
        });
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'PageDown') {
        if (page < pageCount - 1) setPage((p) => p + 1);
        e.preventDefault();
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') {
        if (page > 0) setPage((p) => p - 1);
        e.preventDefault();
      } else if (e.code === 'Enter') {
        const target = slice[rowIndex];
        if (target) onSelect(target);
        e.preventDefault();
      } else if (e.code === 'Slash') {
        // Quick "/" to focus search, terminal-style.
        const input = document.querySelector<HTMLInputElement>('input[data-archive-search]');
        if (input) { input.focus(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, onSelect, page, pageCount, slice, rowIndex]);

  return (
    <>
      <div style={{ marginBottom: '20px', opacity: 0.7 }}>{"<< [ESC] RETURN TO MAIN MENU"}</div>
      <div style={{ border: '1px solid var(--phosphor-green)', padding: '10px', margin: '10px 0' }}>
        <h2 className="glow-text" style={{ marginTop: 0 }}>PURSUE ARCHIVE — {filtered.length} / {records.length} FILES</h2>
        <p>Access Level: DECLASSIFIED // PUBLIC RELEASE</p>
        <p style={{ fontSize: '15px', opacity: 0.8, marginTop: '8px', lineHeight: 1.4 }}>{RELEASE_NOTICE}</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH (TAP /) — TITLE / LOCATION / DESCRIPTION..."
          style={{ flex: '1 1 280px', minWidth: 0 }}
          data-archive-search
        />
        <select
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          style={{ background: 'transparent', color: 'var(--phosphor-green)', border: '1px solid var(--phosphor-green)', padding: '6px 10px', fontFamily: 'inherit', fontSize: '16px' }}
        >
          {agencies.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ marginTop: '20px' }}>
        {slice.length === 0 && <div style={{ opacity: 0.6 }}>NO RECORDS MATCH QUERY.</div>}
        {slice.map((r, i) => {
          const recovered = collected.has(r.id);
          const selected = i === rowIndex;
          return (
            <div
              key={r.id}
              className={`crt-row${selected ? ' selected' : ''}`}
              onClick={() => onSelect(r)}
              onMouseEnter={() => setRowIndex(i)}
              style={{ cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(51,255,51,0.15)' }}
            >
              {selected ? "> " : "  "}[{r.incidentDate || r.releaseDate || 'N/A'}] [{r.agency}] {r.title}
              {recovered && <span style={{ color: '#ffe88a', marginLeft: '10px' }}>★ RECOVERED</span>}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: '20px', opacity: 0.6, fontSize: '14px' }}>
        ↑↓ NAVIGATE &nbsp;·&nbsp; ENTER OPEN &nbsp;·&nbsp; ←→ PAGE &nbsp;·&nbsp; / SEARCH &nbsp;·&nbsp; ESC BACK
      </p>

      {pageCount > 1 && (
        <div style={{ marginTop: '20px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← PREV</button>
          <span style={{ opacity: 0.7 }}>PAGE {page + 1} / {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>NEXT →</button>
        </div>
      )}
    </>
  );
}

function MainTerminal({
  onExit,
  collected,
  records,
  loading,
  error,
}: {
  onExit: () => void;
  collected: Set<string>;
  records: PursueRecord[];
  loading: boolean;
  error: string | null;
}) {
  const [view, setView] = useState<'menu' | 'database' | 'ais'>('menu');
  const [selectedRecord, setSelectedRecord] = useState<PursueRecord | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);

  const menuItems: MenuItem[] = useMemo(() => ([
    { label: "[ACCESS CLASSIFIED DATABASE]", action: () => setView('database') },
    { label: "[INITIALIZE A.I.S. SUBSYSTEM]", action: () => setView('ais') },
    { label: "[DISCONNECT TERMINAL]", action: onExit, danger: true },
  ]), [onExit]);

  useEffect(() => {
    if (view !== 'menu') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') { setMenuIndex(i => (i + 1) % menuItems.length); e.preventDefault(); }
      else if (e.code === 'ArrowUp') { setMenuIndex(i => (i - 1 + menuItems.length) % menuItems.length); e.preventDefault(); }
      else if (e.code === 'Enter') { menuItems[menuIndex].action(); e.preventDefault(); }
      else if (e.code === 'Escape') { onExit(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, menuItems, menuIndex, onExit]);

  if (view === 'ais') {
    return (
      <CRTScreen>
        <GlobalAISTerminal onBack={() => setView('menu')} />
      </CRTScreen>
    );
  }

  return (
    <CRTScreen>
      <h1 className="glow-text" style={{ marginTop: 0 }}>DEPARTMENT OF WAR — CLASSIFIED DATABASE</h1>

      {view === 'menu' && (
        <div style={{ marginTop: '40px' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {menuItems.map((item, idx) => (
              <li
                key={idx}
                className={`crt-row${idx === menuIndex ? ' selected' : ''}${item.danger ? ' danger' : ''}`}
                style={{ fontSize: '24px', margin: '8px 0' }}
                onClick={() => { setMenuIndex(idx); item.action(); }}
                onMouseEnter={() => setMenuIndex(idx)}
              >
                {idx === menuIndex ? "> " : "  "}{item.label}
                {idx === 0 && (
                  <span style={{ opacity: 0.6, fontSize: '18px', marginLeft: '12px' }}>
                    ({loading ? 'SYNCING…' : `${records.length} FILES`})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '60px', opacity: 0.6, fontSize: '16px' }}>
            ↑↓ NAVIGATE &nbsp;·&nbsp; ENTER SELECT &nbsp;·&nbsp; ESC DISCONNECT<br/>
            ARCHIVE SYNCED LIVE FROM PURSUE FIRST TRANCHE.
          </p>
        </div>
      )}

      {view === 'database' && !selectedRecord && (
        <>
          {loading && <p style={{ opacity: 0.7 }}>SYNCING PURSUE ARCHIVE FROM SECTOR 7 RELAY…</p>}
          {error && (
            <div style={{ color: '#ff8888', padding: '12px', border: '1px dashed #ff8888' }}>
              ARCHIVE FETCH FAILED: {error}
              <br/>
              <button onClick={() => setView('menu')} style={{ marginTop: '10px' }}>[ BACK ]</button>
            </div>
          )}
          {!loading && !error && (
            <ArchiveBrowser
              records={records}
              collected={collected}
              onSelect={setSelectedRecord}
              onBack={() => { setView('menu'); setMenuIndex(0); }}
            />
          )}
        </>
      )}

      {selectedRecord && view === 'database' && (
        <RecordDetail
          record={selectedRecord}
          onBack={() => setSelectedRecord(null)}
        />
      )}
    </CRTScreen>
  );
}

function DetainedScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'VT323, monospace', color: '#ffffff',
      flexDirection: 'column', padding: '40px', textAlign: 'center',
    }}>
      <div style={{
        border: '4px double #ff3333', padding: '40px 80px',
        background: 'rgba(20,0,0,0.6)', maxWidth: 700,
      }}>
        <div style={{ fontSize: '64px', color: '#ff3333', letterSpacing: '8px', marginBottom: '20px', textShadow: '0 0 18px rgba(255,51,51,0.6)' }}>
          INCIDENT REPORT
        </div>
        <div style={{ fontSize: '36px', marginBottom: '40px', letterSpacing: '4px' }}>
          SUBJECT DETAINED
        </div>
        <div style={{ fontSize: '20px', lineHeight: 1.5, opacity: 0.85 }}>
          ████ ████████ ████ ████ DEPT OF WAR ████████ ████<br/>
          ██████ ████████████ SUBJECT TRANSFERRED TO ████<br/>
          ██████ FACILITY. ██ ██ MEMORY ████████ COMPLETE.<br/><br/>
          <span style={{ color: "#ff8888" }}>[ALL PURSUE CASE ACCESS REVOKED]</span>
        </div>
      </div>
      <button onClick={onRestart} style={{ marginTop: '40px', fontSize: '22px', padding: '10px 24px' }}>
        {"[ INITIATE NEW BREACH ]"}
      </button>
    </div>
  );
}

function EscapedScreen({ onRestart, collected, total }: { onRestart: () => void; collected: number; total: number }) {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'radial-gradient(ellipse at center, #0a1830 0%, #000 80%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'VT323, monospace', color: '#cfe6ff',
      flexDirection: 'column', padding: '40px', textAlign: 'center',
    }}>
      <div style={{
        border: '2px solid #88aaff', padding: '40px 80px',
        background: 'rgba(10,30,60,0.6)', maxWidth: 700,
        boxShadow: '0 0 40px rgba(136,170,255,0.2)',
      }}>
        <div style={{ fontSize: '56px', color: '#cfe6ff', letterSpacing: '6px', marginBottom: '20px', textShadow: '0 0 20px rgba(136,170,255,0.6)' }}>
          EXTRACTED
        </div>
        <div style={{ fontSize: '24px', marginBottom: '30px', letterSpacing: '2px', opacity: 0.85 }}>
          PERIMETER RE-ACQUIRED — NEVADA SECTOR 7
        </div>
        <div style={{ fontSize: '20px', lineHeight: 1.5 }}>
          ARTIFACTS RECOVERED: {collected} / {total}<br/>
          <span style={{ color: '#9cf' }}>STATUS: BREACH SEALED</span><br/><br/>
          The PURSUE database holds what you brought back.<br/>
          What you left behind stays in there.
        </div>
      </div>
      <button onClick={onRestart} style={{ marginTop: '40px', fontSize: '22px', padding: '10px 24px' }}>
        {"[ RE-DEPLOY ]"}
      </button>
    </div>
  );
}

type GameState = 'desert' | 'exploring' | 'boot' | 'terminal' | 'detained' | 'escaped';

interface PickupToast {
  id: string;
  fileId: string;
  flavor: string;
  exitHint?: string;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('desert');
  const [collectedFiles, setCollectedFiles] = useState<Set<string>>(new Set());
  const [bootCompleted, setBootCompleted] = useState(false);
  const [toasts, setToasts] = useState<PickupToast[]>([]);

  const [records, setRecords] = useState<PursueRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [pickups, setPickups] = useState<FilePickup[]>([]);
  const [runId, setRunId] = useState(0);

  // Fetch the archive once on mount. Stays alive across maze runs.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchRecords(ctrl.signal)
      .then((rs) => {
        setRecords(rs);
        setRecordsError(null);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setRecordsError(err instanceof Error ? err.message : 'UNKNOWN FAULT');
      })
      .finally(() => setRecordsLoading(false));
    return () => ctrl.abort();
  }, []);

  // Re-roll maze pickups each new run, once records are available.
  useEffect(() => {
    if (records.length === 0) { setPickups([]); return; }
    setPickups(recordsToPickups(records, MAZE_PICKUP_COUNT));
  }, [records, runId]);

  // Release pointer lock whenever we leave the maze for a CRT overlay.
  // Otherwise the cursor stays trapped on the canvas and DOM clicks/scroll
  // don't reach the terminal UI.
  useEffect(() => {
    if (gameState !== 'exploring' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [gameState]);

  useEffect(() => {
    const titles: Record<GameState, string> = {
      desert:    'AlienBackrooms — NEVADA SECTOR 7',
      exploring: 'SECTOR 7 // BACKROOMS — UNAUTHORIZED',
      boot:      'DEPT OF WAR — SECURE TERMINAL',
      terminal:  'DEPT OF WAR — PURSUE ARCHIVE',
      detained:  'INCIDENT REPORT — SUBJECT DETAINED',
      escaped:   'EXTRACTED — BREACH SEALED',
    };
    document.title = titles[gameState];
  }, [gameState]);

  const handleEnterBackrooms = () => setGameState('exploring');

  const handleTerminalInteract = useCallback(() => {
    if (!bootCompleted) setGameState('boot');
    else setGameState('terminal');
  }, [bootCompleted]);

  const handleBootComplete = () => {
    setBootCompleted(true);
    setGameState('terminal');
  };

  const handleCollectFile = useCallback((id: string, flavor: string, exitHint?: string) => {
    setCollectedFiles(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const toastId = `${id}-${Date.now()}`;
    setToasts(prev => [...prev, { id: toastId, fileId: id, flavor, exitHint }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 6000);
  }, []);

  const handleRestart = () => {
    setCollectedFiles(new Set());
    setBootCompleted(false);
    setToasts([]);
    setRunId((n) => n + 1);
    setGameState('desert');
  };

  const containerClass =
    gameState === 'exploring' || gameState === 'desert' || gameState === 'escaped'
      ? 'world-container'
      : 'crt-container';

  return (
    <div className={containerClass}>
      {gameState === 'desert' && (
        <DesertScene onEnterPortal={handleEnterBackrooms} />
      )}

      {(gameState === 'exploring' || gameState === 'boot' || gameState === 'terminal') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: gameState === 'exploring' ? 'auto' : 'none',
          }}
        >
          <BackroomsGame
            onTerminalInteract={handleTerminalInteract}
            onCaught={() => setGameState('detained')}
            onEscaped={() => setGameState('escaped')}
            collectedFiles={collectedFiles}
            onCollectFile={handleCollectFile}
            bootCompleted={bootCompleted}
            pickups={pickups}
            interactive={gameState === 'exploring'}
          />
        </div>
      )}

      {gameState === 'boot' && (
        <BootSequenceOnCRT onComplete={handleBootComplete} />
      )}

      {gameState === 'terminal' && (
        <MainTerminal
          onExit={() => setGameState('exploring')}
          collected={collectedFiles}
          records={records}
          loading={recordsLoading}
          error={recordsError}
        />
      )}

      {gameState === 'detained' && (
        <DetainedScreen onRestart={handleRestart} />
      )}

      {gameState === 'escaped' && (
        <EscapedScreen onRestart={handleRestart} collected={collectedFiles.size} total={pickups.length} />
      )}

      {gameState === 'exploring' && toasts.length > 0 && (
        <div style={{
          position: 'fixed', top: 80, right: 20,
          display: 'flex', flexDirection: 'column', gap: '10px',
          zIndex: 50, pointerEvents: 'none',
        }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid #d8c98a',
              padding: '10px 14px',
              fontFamily: 'VT323, monospace',
              color: '#fff5cc',
              minWidth: '300px',
              maxWidth: '420px',
              boxShadow: '0 0 12px rgba(216,201,138,0.25)',
            }}>
              <div style={{ fontSize: '16px', color: '#ffe88a', marginBottom: '4px' }}>
                ARTIFACT RECOVERED — {t.fileId}
              </div>
              <div style={{ fontSize: '15px', lineHeight: 1.4, wordBreak: 'break-word' }}>{t.flavor}</div>
              {t.exitHint && (
                <div style={{ fontSize: '14px', marginTop: '6px', color: '#9cf' }}>
                  {t.exitHint}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App
