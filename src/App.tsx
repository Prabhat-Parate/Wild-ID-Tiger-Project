import React, { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Focus,
  Grid2X2,
  History,
  ImagePlus,
  Info,
  Leaf,
  Loader2,
  Menu,
  RefreshCw,
  ScanLine,
  Shield,
  SlidersHorizontal,
  Undo2,
  Upload,
  X,
  ZoomIn,
  Download,
} from "lucide-react";
import {
  api,
  media,
  type Analysis,
  type Candidate,
  type Dataset,
  type Health,
  type RecordImage,
} from "./api";
import {
  clean,
  download,
  reviewRecord,
  validateFile,
  type Review,
  type SessionRetrieval,
  evaluationRankingRows,
} from "./session";
import {
  Detect,
  DetectorEvaluation,
  DetectorScore,
  type CapturedQuery,
} from "./Detect";
import { cropBlob } from "./camera";
import { project } from "./config/project";
import { InfoPage } from "./InfoPages";
import {
  CandidateComparison,
  ImageMetadata,
  SimilarityScore,
  NoReliableMatch,
  sourceFilename,
  ACCURACY_UNAVAILABLE,
} from "./Comparison";

const navigation = [
  ["/", "Overview", Activity],
  ["/identify", "Compare Tigers", ScanLine],
  ["/detect", "Detect Animal", Focus],
  ["/gallery", "Tiger Gallery", Grid2X2],
  ["/history", "Review History", History],
  ["/evaluation", "Evaluation", SlidersHorizontal],
] as const;
interface Observation {
  id: string;
  timestamp: string;
  query_id: string;
  scenario: string;
  decision: string;
  method: string;
  dataset_version: string;
  notes: string;
}

function Photo({
  record,
  crop = false,
  className = "",
}: {
  record: RecordImage;
  crop?: boolean;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={media(crop ? record.crop_url || record.image_url : record.image_url)}
      alt={
        crop
          ? "Tiger photograph, published animal crop"
          : "Tiger photograph from the Hugging Face dataset"
      }
      onError={(e) => {
        e.currentTarget.alt =
          "Tiger photograph unavailable; reload the local cache.";
        e.currentTarget.classList.add("image-missing");
      }}
    />
  );
}
function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Exports({ rows, name }: { rows: object[]; name: string }) {
  return (
    <div className="action-row">
      <button
        className="button small"
        onClick={() => download(rows, name, "csv")}
      >
        <Download size={14} /> CSV
      </button>
      <button
        className="button small"
        onClick={() => download(rows, name, "json")}
      >
        <Download size={14} /> JSON
      </button>
    </div>
  );
}
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>The workspace could not render</h1>
        <p>
          Unsaved session records may be lost. Previously downloaded exports are
          unaffected.
        </p>
        <a href="/">Return to Overview</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Workspace />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function Workspace() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<Health | null>(null),
    [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reviews, setReviews] = useState<Review[]>([]),
    [observations, setObservations] = useState<Observation[]>([]),
    [retrievals, setRetrievals] = useState<SessionRetrieval[]>([]),
    [incoming, setIncoming] = useState<CapturedQuery | null>(null),
    [mobile, setMobile] = useState(false),
    [checking, setChecking] = useState(false);
  const location = useLocation();
  async function load() {
    setChecking(true);
    try {
      const h = await api.health();
      setHealth(h);
      try {
        const d = await api.dataset();
        setData(d);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } // Dataset errors must not falsely mark a healthy server offline.
    } catch (e) {
      setHealth(null);
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setMobile(false);
    document.title = `${navigation.find((x) => x[0] === location.pathname)?.[1] || "Information"} · Wild-ID Tigers`;
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  function clear() {
    if (
      window.confirm(
        "Clear all temporary reviews and observations? Export first; this cannot be undone.",
      )
    ) {
      setReviews([]);
      setObservations([]);
      setRetrievals([]);
      setIncoming(null);
      setNotice("Session data cleared.");
    }
  }
  async function diagnostic() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            app_version: project.version,
            backend_status: health?.status || "unavailable",
            last_error: error,
          },
          null,
          2,
        ),
      );
      setNotice(
        "Diagnostic info copied. No image data or personal details included.",
      );
    } catch {
      setNotice(
        "Clipboard unavailable. App " +
          project.version +
          "; backend " +
          (health?.status || "unavailable"),
      );
    }
  }
  const reportLink =
    project.issueUrl ||
    (project.repositoryUrl
      ? project.repositoryUrl + "/issues"
      : project.contactEmail
        ? "mailto:" + project.contactEmail
        : "");
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Link className="brand" to="/">
          <div className="brand-icon">
            <ScanLine size={25} />
          </div>
          <div>
            <strong>
              WILD-ID<span className="brand-dot">.</span>
            </strong>
            <small>
              Tiger photograph
              <br />
              comparison workspace
            </small>
          </div>
        </Link>
        <div className="nav-label">TIGER RESEARCH WORKSPACE</div>
        <nav aria-label="Primary">
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              end
              key={path}
              to={path}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={18} />
              {label}
              {path === "/identify" && (
                <ChevronRight size={14} className="nav-arrow" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-label">RESOURCES</div>
          <nav aria-label="Resources">
            <NavLink className="nav-link" to="/about">
              <Info size={17} />
              About & Data
            </NavLink>
            <NavLink className="nav-link" to="/help">
              <CircleHelp size={17} />
              Help
            </NavLink>
            <NavLink className="nav-link" to="/privacy">
              <Shield size={17} />
              Privacy
            </NavLink>
          </nav>
          <div className="team-stamp">
            <Leaf size={18} />
            <div>
              <b>Beyond Infinity</b>
              <small>WildHack 2026 · Challenge A</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="header-left">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>CONSERVATION RESEARCH</span>
            <span className="divider">/</span>
            <span>Tiger workspace</span>
          </div>
          <div className="header-status">
            <span className={"dot " + (health ? "online" : "offline")} />
            <span>{health ? "Backend connected" : "Backend unavailable"}</span>
            <button
              className="icon-button"
              aria-label="Check backend connection"
              onClick={() => void load()}
              disabled={checking}
            >
              <RefreshCw size={13} className={checking ? "spin" : ""} />
            </button>
            <span className="mode-label">Image similarity</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="workspace-context">
            <span>
              <span className="live-square" /> RESEARCH PROTOTYPE{" "}
              <span className="context-line">—</span> TIGERS ONLY
            </span>
            <span>HUGGING FACE DATA</span>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => void load()} disabled={checking}>
                Retry connection
              </button>
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={<Overview data={data} health={health} />}
            />
            <Route
              path="/identify"
              element={
                <Compare
                  data={data}
                  incoming={incoming}
                  onConsumed={() => setIncoming(null)}
                  onAnalysis={(entry) => setRetrievals((v) => [entry, ...v])}
                  onReview={(r) => {
                    setReviews((v) => [r, ...v]);
                    setNotice("Visual review recorded in temporary session.");
                  }}
                  undo={() => setReviews((v) => v.slice(1))}
                  canUndo={reviews.length > 0}
                />
              }
            />
            <Route
              path="/detect"
              element={
                <Detect
                  health={health}
                  onCapture={(query) => {
                    setIncoming(query);
                    setRetrievals((v) => [
                      {
                        analysis: query.analysis,
                        query_filename: query.file.name,
                      },
                      ...v,
                    ]);
                    navigate("/identify");
                  }}
                />
              }
            />
            <Route path="/gallery" element={<Gallery data={data} />} />
            <Route
              path="/history"
              element={
                <ReviewHistory reviews={reviews} data={data} clear={clear} />
              }
            />
            <Route
              path="/evaluation"
              element={
                <Evaluation
                  health={health}
                  data={data}
                  entries={observations}
                  retrievals={retrievals}
                  reviews={reviews}
                  setEntries={setObservations}
                />
              }
            />
            {["about", "help", "privacy", "responsible", "contact"].map(
              (page) => (
                <Route
                  key={page}
                  path={"/" + page}
                  element={
                    <InfoPage
                      page={page}
                      data={data}
                      health={health}
                      diagnostic={diagnostic}
                      clear={clear}
                      reportLink={reportLink}
                    />
                  }
                />
              ),
            )}
            <Route
              path="*"
              element={
                <section className="empty-page">
                  <span className="eyebrow">404 / OUTSIDE THE TRANSECT</span>
                  <h1>This page isn’t in the field guide.</h1>
                  <p>Your current session is still here.</p>
                  <Link className="button primary" to="/">
                    Return to Overview <ArrowRight size={16} />
                  </Link>
                </section>
              }
            />
          </Routes>
          <div className="session-notice" aria-live="polite">
            {notice}
          </div>
        </main>
        <footer>
          <span>WILD-ID · Beyond Infinity · Tiger research prototype</span>
          <nav aria-label="Footer">
            <Link to="/about">About & Data</Link>
            <Link to="/help">Help</Link>
            <Link to="/privacy">Privacy draft</Link>
            <Link to="/responsible">Responsible use</Link>
            <Link to="/contact">Contact</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

function Overview({
  data,
  health,
}: {
  data: Dataset | null;
  health: Health | null;
}) {
  return (
    <>
      <Heading
        eyebrow="FIELD NOTES / 01"
        title="Tiger patterns. A closer comparison."
        description="Choose a tiger photograph, retrieve similar images, and inspect the stripes side by side."
      >
        <Link className="button primary" to="/identify">
          Compare tiger photos <ArrowRight size={17} />
        </Link>
      </Heading>
      <div className="overview-hero">
        {data?.records[0] && <Photo record={data.records[0]} />}
        <div className="hero-caption">
          <span>TIGERS ONLY · REAL PHOTOGRAPHS</span>
          <h2>
            Look beyond
            <br />
            the first resemblance.
          </h2>
          <p>
            A focused image-comparison workspace.
            <br />
            Real source photographs. Careful visual review.
          </p>
          <Link to="/gallery">
            Browse tiger photographs <ArrowUpRight size={16} />
          </Link>
        </div>
        <span className="image-credit">
          Ultralytics / Tiger-pose · AGPL-3.0
        </span>
      </div>
      <section className="stat-row" aria-label="Actual workspace status">
        <div>
          <strong>{data?.records.length ?? "—"}</strong>
          <span>cached tiger photographs</span>
        </div>
        <div>
          <strong className="small-stat">Tigers only</strong>
          <span>Hugging Face source images</span>
        </div>
        <div>
          <strong className="small-stat">Visual review</strong>
          <span>not verified animal identity</span>
        </div>
        <div>
          <strong className="small-stat">
            {health ? "Connected" : "Unavailable"}
          </strong>
          <span>local retrieval backend</span>
        </div>
      </section>
      <div className="overview-columns">
        <section className="panel">
          <div className="panel-title">
            <h2>A simple comparison workflow</h2>
            <span>PHOTOGRAPH → REVIEW</span>
          </div>
          <ol className="pipeline-list">
            {[
              [
                "01",
                "Choose a tiger photograph",
                "Browse real dataset photographs or upload an authorised tiger image.",
              ],
              [
                "02",
                "Compare visible patterns",
                "The backend uses published crops and an untrained gradient descriptor to rank images.",
              ],
              [
                "03",
                "Inspect the evidence",
                "Compare the photographs side by side. A similarity score is not an identity probability.",
              ],
              [
                "04",
                "Record a visual review",
                "Mark visually similar, reject or stay uncertain. Export before closing.",
              ],
            ].map(([n, t, d]) => (
              <li key={n}>
                <span>{n}</span>
                <div>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h2>What this result can tell you</h2>
            <span className="tag">IMAGE SIMILARITY</span>
          </div>
          <div className="scope-copy">
            <h3>Photographs, not invented tiger IDs.</h3>
            <p>
              The selected Hugging Face dataset has tiger images and pose
              annotations, but no individual-animal identity labels.
            </p>
            <p>
              Identity stays <b>UNKNOWN</b>. You can compare patterns and record
              a visual judgement, but this build cannot confirm which individual
              tiger is shown.
            </p>
          </div>
          <div className="note">
            <Info size={17} />
            <p>
              Available source filenames and metadata support comparison. No
              tiger population totals or re-identification accuracy are claimed.
            </p>
          </div>
          <Link className="text-link" to="/about">
            Source, licence & limitations <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}

function Compare({
  data,
  incoming,
  onConsumed,
  onReview,
  onAnalysis,
  undo,
  canUndo,
}: {
  data: Dataset | null;
  incoming: CapturedQuery | null;
  onConsumed: () => void;
  onReview: (r: Review) => void;
  onAnalysis: (entry: SessionRetrieval) => void;
  undo: () => void;
  canUndo: boolean;
}) {
  const location = useLocation();
  const [selected, setSelected] = useState<RecordImage | null>(null),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [candidate, setCandidate] = useState<Candidate | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [crop, setCrop] = useState(false),
    [zoom, setZoom] = useState(false),
    [capturedCrop, setCapturedCrop] = useState<Blob | null>(null),
    [cropPreview, setCropPreview] = useState(""),
    [detectionBox, setDetectionBox] = useState<number[] | null>(null);
  const input = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    initialized = useRef(false),
    handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const requested = (location.state as { recordId?: string } | null)
      ?.recordId;
    if (requested && handled.current !== requested) {
      setSelected(
        data.records.find((r) => r.id === requested) || data.records[0],
      );
      setFile(null);
      handled.current = requested;
      initialized.current = true;
    } else if (!initialized.current) {
      setSelected(data.records[0]);
      initialized.current = true;
    }
  }, [data, location.state]);
  useEffect(() => {
    if (!incoming) return;
    initialized.current = true;
    setSelected(null);
    setFile(incoming.file);
    setAnalysis(incoming.analysis);
    setCandidate(incoming.analysis.candidates[0] || null);
    setDetectionBox(incoming.analysis.detection?.normalized_bbox || null);
    setCapturedCrop(incoming.crop);
    setError("");
    onConsumed();
  }, [incoming]);
  useEffect(() => {
    if (!capturedCrop) {
      setCropPreview("");
      return;
    }
    const url = URL.createObjectURL(capturedCrop);
    setCropPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedCrop]);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => abort.current?.abort(), []);
  function reset() {
    abort.current?.abort();
    setAnalysis(null);
    setCandidate(null);
    setError("");
    setFeedback("");
    setCrop(false);
    setZoom(false);
    setCapturedCrop(null);
    setDetectionBox(null);
  }
  function choose(r: RecordImage) {
    reset();
    setFile(null);
    setSelected(r);
  }
  function upload(f?: File) {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) {
      setError(problem);
      return;
    }
    reset();
    setFile(f);
    setSelected(null);
  }
  async function analyze() {
    setBusy(true);
    setError("");
    setFeedback("");
    setAnalysis(null);
    setCandidate(null);
    const controller = new AbortController();
    abort.current = controller;
    const body = new FormData();
    if (file) {
      body.append("file", file);
      if (detectionBox) {
        body.append("detect_first", "true");
        body.append("detection_box", JSON.stringify(detectionBox));
      }
    } else if (selected) body.append("record_id", selected.id);
    try {
      const result = await api.analyze(body, controller.signal);
      setAnalysis(result);
      setCandidate(result.candidates[0] || null);
      if (file && result.detection?.normalized_bbox) {
        setCapturedCrop(await cropBlob(file, result.detection.bbox, true));
      }
      onAnalysis({
        analysis: result,
        query_filename: file?.name || sourceFilename(selected),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function review(action: Review["action"]) {
    if (!analysis) return;
    onReview(reviewRecord(analysis, candidate?.id || null, action, null, ""));
    setFeedback(
      action === "confirm"
        ? "Recorded as visually similar — not an identity confirmation."
        : action === "reject"
          ? "Candidate photograph rejected."
          : "Recorded as uncertain. Identity remains UNKNOWN.",
    );
  }
  const url = file
    ? preview
    : selected
      ? media(
          crop ? selected.crop_url || selected.image_url : selected.image_url,
        )
      : "";
  return (
    <>
      <Heading
        eyebrow="TIGER COMPARISON / 02"
        title="Compare tiger photographs"
        description="Focus on the photographs. Inspect the stripes before drawing a conclusion."
      >
        <span className="outline-label">
          <ScanLine size={15} /> Tiger images only
        </span>
      </Heading>
      <div className="method-strip">
        <span className="tag">IMAGE SIMILARITY</span>
        <span>
          Real backend retrieval · visual review · no identity prediction
        </span>
        <Link to="/help">
          How to read results <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="identify-grid">
        <section className="query-panel panel">
          <div className="panel-title">
            <h2>
              <span className="step">01</span> Query photograph
            </h2>
            <div className="action-row">
              <button
                className="text-button"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                Replace
              </button>
              <button
                className="icon-button"
                aria-label="Remove query"
                disabled={busy || (!selected && !file)}
                onClick={() => {
                  reset();
                  setSelected(null);
                  setFile(null);
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            aria-label="Upload query image"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div
            className={"query-image " + (zoom ? "zoomed" : "")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) upload(e.dataTransfer.files[0]);
            }}
          >
            {url ? (
              <>
                <button
                  className="image-zoom"
                  aria-label="Zoom query image"
                  onClick={() => setZoom(!zoom)}
                >
                  <img
                    src={url}
                    alt={
                      file
                        ? "Uploaded tiger query preview"
                        : "Selected tiger query photograph"
                    }
                    onError={() =>
                      setError(
                        "Query photograph could not be loaded. Replace it or reload the cache.",
                      )
                    }
                  />
                </button>
                <span className="image-label">
                  {crop ? "ANIMAL CROP" : "QUERY PHOTOGRAPH"}
                </span>
                <button
                  className="zoom-control icon-button"
                  aria-label="Toggle image zoom"
                  onClick={() => setZoom(!zoom)}
                >
                  <ZoomIn size={18} />
                </button>
              </>
            ) : (
              <button
                className="empty-upload"
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={35} />
                <b>Add a tiger photograph</b>
                <span>Choose below, or drop a JPG or PNG</span>
              </button>
            )}
          </div>
          <div className="photo-toolbar">
            <span>
              {file ? "Uploaded photograph" : "Hugging Face tiger photograph"}
            </span>
            {selected?.crop_url && (
              <button
                className={"button small " + (crop ? "selected" : "")}
                onClick={() => {
                  setCrop(!crop);
                  setZoom(false);
                }}
              >
                <Focus size={15} />
                {crop ? "Full photograph" : "Animal crop"}
              </button>
            )}
          </div>
          <ImageMetadata
            record={selected}
            filename={file?.name}
            upload={file ? { type: file.type, size: file.size } : null}
          />
          <div className="upload-notice">
            <Shield size={15} />
            <span>
              JPG/PNG · 8 MiB max · processed in backend memory, not saved. Use
              tiger photographs only; uploads are not automatically
              species-validated. <Link to="/privacy">Privacy draft</Link>
            </span>
          </div>
          <div className="query-actions">
            <Link className="button" to="/detect">
              <Focus size={16} /> Camera detection
            </Link>
            <button
              className="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} /> Upload tiger photo
            </button>
            {busy ? (
              <button
                className="button primary"
                onClick={() => abort.current?.abort()}
              >
                <Loader2 className="spin" size={17} /> Cancel comparison
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!selected && !file}
                onClick={() => void analyze()}
              >
                <ScanLine size={17} /> Compare Image <ArrowRight size={16} />
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="inline-error">
              {error}
              <button
                disabled={busy || (!selected && !file)}
                onClick={() => void analyze()}
              >
                Retry
              </button>
            </div>
          )}
        </section>
        <section className="candidate-panel panel">
          <div className="panel-title">
            <h2>
              <span className="step">02</span> Visual similarity candidates
            </h2>
            <span className="micro-label">
              {analysis
                ? `${analysis.candidates.length} RESULTS`
                : "AWAITING COMPARISON"}
            </span>
          </div>
          <div aria-live="polite">
            {busy ? (
              <div className="candidate-empty">
                <Loader2 className="spin" size={30} />
                <h3>Comparing tiger photographs</h3>
                <p>
                  Computing real image similarities.
                  <br />
                  You can cancel this request.
                </p>
              </div>
            ) : analysis ? (
              <>
                <NoReliableMatch reason="This source has no individual-level ground truth. Visual resemblance alone cannot establish an identity." />
                <p className="retrieval-method">
                  Retrieval method: {analysis.method} · Descriptor:{" "}
                  {analysis.model}
                </p>
                <div className="candidate-list">
                  {analysis.candidates.length ? (
                    analysis.candidates.map((c) => (
                      <button
                        key={c.id}
                        className={
                          "candidate-row " +
                          (candidate?.id === c.id ? "current" : "")
                        }
                        onClick={() => setCandidate(c)}
                      >
                        <span className="rank">
                          {String(c.rank).padStart(2, "0")}
                        </span>
                        <Photo record={c} crop />
                        <span className="candidate-info">
                          <b>{sourceFilename(c) || "Reference photograph"}</b>
                          <span>Unverified visual resemblance</span>
                        </span>
                        <span className="score">
                          <SimilarityScore score={c.score} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="empty">
                      No reference photographs are available. Identity UNKNOWN.
                    </div>
                  )}
                </div>
                <p className="candidate-footnote">
                  Cosine similarity is a ranking signal, not accuracy, identity
                  confidence or probability.
                </p>
              </>
            ) : (
              <div>
                <NoReliableMatch
                  reason={
                    error
                      ? "The retrieval result is missing or invalid. Retry before reviewing any candidate."
                      : "No retrieval result is available yet."
                  }
                />
                <div className="candidate-empty">
                  <div className="scan-glyph">
                    <ScanLine size={35} />
                  </div>
                  <h3>Start with the visible pattern.</h3>
                  <p>
                    Choose a tiger photograph below.
                    <br />
                    Similar reference photographs will appear here.
                  </p>
                  <div className="mini-pipeline">
                    <span>Choose</span>
                    <ChevronRight size={14} />
                    <span>Compare</span>
                    <ChevronRight size={14} />
                    <span>Review</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      {analysis && candidate && (
        <section className="panel comparison">
          <div className="panel-title">
            <h2>
              <span className="step">03</span> Compare & review
            </h2>
            <button className="text-button" onClick={() => setZoom(!zoom)}>
              <ZoomIn size={16} />
              {zoom ? "Reset zoom" : "Zoom all images"}
            </button>
          </div>
          {analysis.detection?.detector_score != null && (
            <div className="comparison-detection-evidence">
              <p>
                Selected detection crop from {analysis.detection.source} · raw
                model label: {analysis.detection.label}. This is detection
                evidence, separate from similarity ranking.
              </p>
              <DetectorScore score={analysis.detection.detector_score} />
            </div>
          )}
          <CandidateComparison
            analysis={analysis}
            query={selected}
            queryFilename={file?.name || sourceFilename(selected)}
            upload={file ? { type: file.type, size: file.size } : null}
            queryUrl={
              analysis.detection?.crop_url
                ? media(analysis.detection.crop_url)
                : selected
                  ? media(selected.image_url)
                  : cropPreview || preview
            }
            selectedId={candidate.id}
            onSelect={(id) =>
              setCandidate(analysis.candidates.find((c) => c.id === id) || null)
            }
            zoom={zoom}
          />
          <div className="evidence-note">
            <Info size={16} />
            <p>
              These are real tiger photographs ranked by image similarity. The
              dataset has no individual-tiger labels, so this comparison cannot
              verify an identity.
            </p>
          </div>
          <div className="verification">
            <div>
              <h3>What does the visual comparison support?</h3>
              <p>
                Unsaved session · a visual review is not an identity
                confirmation.
              </p>
            </div>
            <div className="review-actions">
              <button
                className="button primary"
                onClick={() => review("confirm")}
              >
                <Check size={16} /> Visually similar
              </button>
              <button className="button" onClick={() => review("reject")}>
                <X size={16} /> Reject
              </button>
              <button
                className="button amber"
                onClick={() => review("uncertain")}
              >
                Uncertain
              </button>
              <button
                className="icon-button"
                aria-label="Undo last review"
                disabled={!canUndo}
                onClick={() => {
                  undo();
                  setFeedback("Last visual review undone.");
                }}
              >
                <Undo2 size={17} />
              </button>
            </div>
          </div>
          <p className="review-feedback" role="status">
            {feedback}
          </p>
        </section>
      )}
      <section className="dataset-browser">
        <div className="section-heading">
          <div>
            <h2>Choose a tiger photograph</h2>
            <p>
              {data?.records.length || 0} real photographs · Hugging Face source
              · verified source photographs
            </p>
          </div>
          <Link className="text-link" to="/gallery">
            Open tiger gallery <ArrowRight size={15} />
          </Link>
        </div>
        <div className="dataset-grid">
          {data?.records.map((r, index) => (
            <button
              key={r.id}
              className={
                "dataset-tile tiger-tile " +
                (selected?.id === r.id ? "chosen" : "")
              }
              disabled={busy}
              aria-label={`Select tiger photograph ${index + 1}`}
              onClick={() => choose(r)}
            >
              <div>
                <Photo record={r} />
                {selected?.id === r.id && (
                  <span className="chosen-check">
                    <Check size={14} />
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        {!data && (
          <div className="empty">
            Tiger photographs are unavailable. Check the backend connection
            above.
          </div>
        )}
        <div className="source-line">
          <span>
            Ultralytics / Tiger-pose · Hugging Face · resized/cropped
            derivatives
          </span>
          <Link to="/about">
            Source & licence <ArrowUpRight size={13} />
          </Link>
        </div>
      </section>
    </>
  );
}

function Gallery({ data }: { data: Dataset | null }) {
  const navigate = useNavigate();
  return (
    <>
      <Heading
        eyebrow="PHOTOGRAPH COLLECTION / 03"
        title="Tiger gallery"
        description="Real tiger photographs. Select a source photograph for comparison; individual identity remains UNKNOWN."
      />
      <div className="method-strip">
        <span className="tag">TIGERS ONLY</span>
        <span>
          Choose any photograph to compare. Images are not grouped into invented
          individuals.
        </span>
      </div>
      <div className="tiger-gallery">
        {data?.records.map((r, index) => (
          <button
            className="gallery-cover"
            key={r.id}
            aria-label={`Compare tiger photograph ${index + 1}`}
            onClick={() => navigate("/identify", { state: { recordId: r.id } })}
          >
            <Photo record={r} />
            <span>
              Compare photograph <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
      {!data && (
        <div className="empty">
          No tiger photographs loaded. Retry the backend connection.
        </div>
      )}
    </>
  );
}

function ReviewHistory({
  reviews,
  data,
  clear,
}: {
  reviews: Review[];
  data: Dataset | null;
  clear: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const rows = reviews.filter((r) => filter === "all" || r.action === filter);
  return (
    <>
      <Heading
        eyebrow="TEMPORARY REVIEWS / 04"
        title="Review history"
        description="Your visual decisions only. No verified individual identities or live sightings."
      >
        <span className="unsaved">
          <span className="dot amber-dot" /> Unsaved session · {reviews.length}{" "}
          reviews
        </span>
      </Heading>
      <div className="filter-bar">
        <label>
          Visual decision
          <select
            aria-label="Filter visual decisions"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All reviews</option>
            <option value="confirm">Visually similar</option>
            <option value="reject">Rejected</option>
            <option value="uncertain">Uncertain</option>
          </select>
        </label>
        <Exports
          rows={rows.map(({ notes, ...safe }) => safe)}
          name="tiger-reviews"
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Query photograph</th>
              <th>Reference photograph</th>
              <th>Visual review</th>
              <th>Individual identity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const query = data?.records.find((x) => x.id === r.query_id),
                candidate = data?.records.find((x) => x.id === r.candidate_id);
              return (
                <tr key={r.id}>
                  <td>
                    {query ? (
                      <div className="table-image">
                        <Photo record={query} />
                      </div>
                    ) : (
                      "Uploaded tiger query"
                    )}
                  </td>
                  <td>
                    {candidate ? (
                      <div className="table-image">
                        <Photo record={candidate} />
                      </div>
                    ) : (
                      "No reference"
                    )}
                  </td>
                  <td>
                    {r.action === "confirm"
                      ? "Visually similar"
                      : r.action === "reject"
                        ? "Rejected"
                        : "Uncertain"}
                  </td>
                  <td>UNKNOWN</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">
            <History size={27} />
            <h3>No visual reviews yet.</h3>
            <p>
              Compare photographs and record a visual decision. Export your work
              before refreshing.
            </p>
            <Link className="text-link" to="/identify">
              Compare tigers <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
      <div className="note">
        <Shield size={17} />
        <p>
          Reviews exist only in browser memory. Exports contain record
          identifiers, scores and decisions, never image data, free-text notes
          or locations.
        </p>
      </div>
      <button className="text-button danger" onClick={clear}>
        Clear session data
      </button>
    </>
  );
}

function Evaluation({
  data,
  health,
  entries,
  retrievals,
  reviews,
  setEntries,
}: {
  data: Dataset | null;
  health: Health | null;
  entries: Observation[];
  retrievals: SessionRetrieval[];
  reviews: Review[];
  setEntries: React.Dispatch<React.SetStateAction<Observation[]>>;
}) {
  const [query, setQuery] = useState(""),
    [scenario, setScenario] = useState("Different poses"),
    [decision, setDecision] = useState("uncertain"),
    [notes, setNotes] = useState(""),
    [feedback, setFeedback] = useState("");
  const source = data?.records.find((r) => r.id === query);
  function add(event: React.FormEvent) {
    event.preventDefault();
    setEntries((v) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        query_id: query,
        scenario,
        decision,
        notes: clean(notes),
        method: "manual visual observation; not identity evaluation",
        dataset_version: data?.commit || "unavailable",
      },
      ...v,
    ]);
    setFeedback("Visual observation added to temporary session.");
    setNotes("");
  }
  return (
    <>
      <Heading
        eyebrow="RESEARCH LOG / 05"
        title="Evaluation & observations"
        description="Do not turn unlabelled tiger photographs into invented identity results."
      >
        <Exports
          rows={[
            ...evaluationRankingRows(retrievals, reviews),
            ...entries.map(({ notes, ...safe }) => ({
              ...safe,
              record_type: "manual_visual_observation",
              retrieval_rank: null,
              retrieval_score: null,
              ground_truth_identity: null,
              ground_truth_source: null,
              human_review_decision: safe.decision,
            })),
          ]}
          name="tiger-evaluation"
        />
      </Heading>
      <DetectorEvaluation health={health} />
      <div className="notice-block">
        <b>Identity evaluation is unavailable.</b>
        <p>{ACCURACY_UNAVAILABLE}</p>
        <br />
        This Hugging Face source has no individual-tiger identity labels. There
        is no validated identity threshold, labelled re-identification split or
        accuracy result. Identity remains UNKNOWN; source train/validation
        folders are pose-estimation partitions only.
      </div>
      <h2 className="section-title">Recorded image-retrieval ranking</h2>
      <p className="evaluation-method-note">
        Only actual successful retrieval requests appear below. Scores rank
        visual resemblance, not identity. Ground truth and human decisions are
        separate; no re-identification metric is computed.
      </p>
      <div className="table-wrap recorded-rankings">
        <table>
          <thead>
            <tr>
              <th>Image-retrieval ranking</th>
              <th>Detection evidence (not identity)</th>
              <th>Ground-truth identity</th>
              <th>Human review decision</th>
            </tr>
          </thead>
          <tbody>
            {retrievals.flatMap(({ analysis: a, query_filename }) =>
              (a.candidates.length ? a.candidates : [null]).map((c) => {
                const decision = reviews.find(
                  (r) =>
                    r.request_id === a.request_id &&
                    r.candidate_id === (c?.id ?? null),
                );
                return (
                  <tr key={a.request_id + ":" + (c?.id || "empty")}>
                    <td>
                      {query_filename && (
                        <p className="ranking-filename">
                          Query: {query_filename}
                        </p>
                      )}
                      {c ? (
                        <>
                          <b>Rank {c.rank}</b>
                          {sourceFilename(c) && (
                            <p className="ranking-filename">
                              Reference: {sourceFilename(c)}
                            </p>
                          )}
                          <SimilarityScore score={c.score} />
                        </>
                      ) : (
                        <p>No candidates returned.</p>
                      )}
                      <p>
                        {a.method} · {a.model}
                      </p>
                    </td>
                    <td>
                      {a.detection?.detector_score != null ? (
                        <>
                          <p>
                            {a.detection.source} · raw label:{" "}
                            {a.detection.label}
                          </p>
                          <DetectorScore score={a.detection.detector_score} />
                        </>
                      ) : (
                        <p>
                          {a.detection
                            ? "Published pose annotation, not a live detection"
                            : "Not requested — full-frame retrieval"}
                        </p>
                      )}
                    </td>
                    <td>
                      <b>UNKNOWN</b>
                      <p>No individual-level ground truth available.</p>
                    </td>
                    <td>
                      {decision
                        ? decision.action === "confirm"
                          ? "Visually similar — not identity confirmation"
                          : decision.action === "reject"
                            ? "Rejected"
                            : "Uncertain"
                        : "Not reviewed"}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
        {!retrievals.length && (
          <div className="empty">
            No recorded image-retrieval results yet. Run Compare Image; manual
            observations below are not retrieval rankings.
          </div>
        )}
      </div>
      <details className="sample-evaluation">
        <summary>View a labelled sample — not recorded results</summary>
        <p>
          <b>SAMPLE / ILLUSTRATIVE ONLY</b> · Not run, not included in metrics,
          not exported.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image-retrieval ranking</th>
                <th>Ground-truth identity</th>
                <th>Human review decision</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Illustrative ordering only; no computed score.</td>
                <td>UNKNOWN · no ground-truth label</td>
                <td>Uncertain (sample)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <section className="panel evaluation-entry">
        <div className="panel-title">
          <h2>Record a visual observation</h2>
          <span className="unsaved">UNSAVED SESSION</span>
        </div>
        <form className="evaluation-form" onSubmit={add}>
          <label>
            Photograph
            <select
              aria-label="Observation photograph"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            >
              <option value="">Select a tiger photograph</option>
              {data?.records.map((r, index) => (
                <option key={r.id} value={r.id}>
                  Tiger photograph {index + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed condition
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {[
                "Different poses",
                "Low image quality",
                "Partial occlusion",
                "Potential look-alike",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {source && (
            <div className="observation-preview">
              <Photo record={source} />
            </div>
          )}
          <label>
            Review decision
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            >
              <option value="uncertain">Uncertain</option>
              <option value="inspect">Needs further inspection</option>
              <option value="unsuitable">Unsuitable photograph</option>
            </select>
          </label>
          <label className="wide">
            Observation notes (not exported)
            <input
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visible image conditions only; no locations or personal details"
            />
          </label>
          <button className="button primary" type="submit">
            Record observation <Check size={16} />
          </button>
          <span role="status">{feedback}</span>
        </form>
      </section>
      <h2 className="section-title">
        Visual observation log <span>{entries.length} entries</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Photograph</th>
              <th>Observed condition</th>
              <th>Human review decision</th>
              <th>Image-retrieval ranking</th>
              <th>Ground-truth identity</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const photo = data?.records.find((r) => r.id === entry.query_id);
              return (
                <tr key={entry.id}>
                  <td>
                    {photo && (
                      <div className="table-image">
                        <Photo record={photo} />
                      </div>
                    )}
                  </td>
                  <td>{entry.scenario}</td>
                  <td>
                    {entry.decision === "inspect"
                      ? "Needs inspection"
                      : entry.decision === "unsuitable"
                        ? "Unsuitable"
                        : "Uncertain"}
                  </td>
                  <td>
                    Not evaluated — manual observation, no retrieval ranking
                  </td>
                  <td>UNKNOWN · no individual-level ground truth available</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!entries.length && (
          <div className="empty">
            No observations recorded this session. No fabricated test rows or
            accuracy metrics.
          </div>
        )}
      </div>
    </>
  );
}
