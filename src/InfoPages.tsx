import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clipboard } from "lucide-react";
import { DatasetInformation } from "./DatasetInformation";
import { project } from "./config/project";
import { api, type Dataset, type Health, type SpeciesRegistry } from "./api";

function TadobaRegistry() {
  const [reg, setReg] = useState<SpeciesRegistry | null>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  useEffect(() => {
    api.species().then(setReg).catch(() => setReg(null));
  }, []);
  const rows = useMemo(() => {
    const list = [...(reg?.species || []), ...(reg?.detector_only_labels || [])];
    return list.filter((s) => {
      if (group !== "all" && s.group !== group) return false;
      const hay = `${s.common_name} ${s.scientific_name || ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [reg, q, group]);
  if (!reg)
    return (
      <p>
        Tadoba reference list unavailable until the backend answers /api/species.
      </p>
    );
  return (
    <section className="tadoba-registry">
      <h2>Tadoba reference species</h2>
      <p>
        {reg.disclaimer} {reg.camera_detection_limit}
      </p>
      <p>
        {reg.entry_count_label || "Registry entries"}: {reg.entry_count ?? reg.species.length}.
        This is not a total fauna count and not a claim of Tadoba validation.
      </p>
      <p>
        Detector vocabulary (loaded model):{" "}
        {(reg.detector_labels || []).join(", ") || "unavailable"}.
      </p>
      <label>
        Search{" "}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search reference species"
        />
      </label>
      <label>
        Group{" "}
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label="Filter by group"
        >
          <option value="all">All</option>
          <option value="mammal">Mammal</option>
          <option value="bird">Bird</option>
          <option value="reptile">Reptile</option>
        </select>
      </label>
      <table>
        <thead>
          <tr>
            <th>Common name</th>
            <th>Scientific name</th>
            <th>Group</th>
            <th>Tier</th>
            <th>Detector</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.common_name + (s.scientific_name || "")}>
              <td>{s.common_name}</td>
              <td>
                <i>{s.scientific_name || "—"}</i>
              </td>
              <td>{s.group}</td>
              <td>{s.tier || "—"}</td>
              <td>{s.support_flag}</td>
              <td>
                {s.source_urls?.[0] ? (
                  <a href={s.source_urls[0]} rel="noreferrer" target="_blank">
                    Source
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function InfoPage({
  page,
  data,
  health,
  diagnostic,
  clear,
  reportLink,
}: {
  page: string;
  data: Dataset | null;
  health: Health | null;
  diagnostic: () => void;
  clear: () => void;
  reportLink: string;
}) {
  const titles: Record<string, string> = {
    about: "About & data",
    help: "How to compare tiger photographs",
    privacy: "Privacy notice — draft",
    responsible: "Responsible use",
    contact: "Contact & feedback",
  };
  return (
    <article className="info-page">
      <span className="eyebrow">WILD-ID / TIGER WORKSPACE</span>
      <h1>{titles[page]}</h1>
      {page === "about" ? (
        <>
          <p className="lead">
            Tiger photographs only. Real image comparison, without invented
            identities.
          </p>
          <DatasetInformation data={data} />
          <h2>Source & licence</h2>
          <p>
            The current source is{" "}
            <a
              href="https://huggingface.co/datasets/Ultralytics/Tiger-pose"
              target="_blank"
              rel="noreferrer"
            >
              Ultralytics / Tiger-pose on Hugging Face
            </a>
            . Photographs and pose annotations are attributed to Ultralytics and
            distributed under the repository’s stated{" "}
            <a
              href="https://huggingface.co/datasets/Ultralytics/Tiger-pose/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              AGPL-3.0 licence
            </a>
            . The full source card and licence are included with the project.
            Images shown here are resized, metadata-free derivatives; animal
            crops use the published pose bounding boxes.
          </p>
          <p>
            {data?.records.length ?? "No"} real photographs are cached for this
            workspace. All source photographs are downloaded from Hugging Face
            by the backend, not a third-party image service. The source card
            describes 210 training and 53 validation images, but the pinned
            repository actually contains 100 training and 53 validation images.
            Only verified repository files are used.
          </p>
          <p>
            The card provides no BibTeX citation block; none has been invented.
            Source and version details, exact selected paths, original selected
            annotations and the licence are recorded in DATASET.md and the local
            source inventory.
          </p>
          <TadobaRegistry />
          <h2>What it does — and does not do</h2>
          <p>
            The backend compares real tiger photographs using an untrained
            gradient descriptor and cosine similarity. It is image retrieval,
            not a connected learned tiger re-identification model. The dataset
            supplies pose annotations, but no individual-tiger identities. The
            app therefore does not assign animal IDs, estimate identity
            accuracy, count distinct tigers or apply an invented identity
            threshold. Multiple photographs may show the same animal; different
            photographs are not assumed to be different animals.
          </p>
          <p>
            Comparison figures display actual source filenames and available
            source metadata. Missing metadata fields are omitted; embedded
            GPS/EXIF is not exposed. Published boxes are source annotations, not
            inferred matching regions. A visual review is a reviewer’s
            observation, not verified animal identity.
          </p>
          <h2>Project & software</h2>
          <p>
            {project.team} · {project.institution}. Research prototype for
            WildHack 2026, Challenge A; not a deployed monitoring system and not
            validated on Tadoba photographs. MegaDetector, MegaDescriptor and
            Supabase are not connected. Local YOLOv8s-World v2 ONNX detection is
            available when its pinned weights load; health and Detect Animal
            report failures explicitly. Its configured tiger label is not
            verified species or identity. Reviews are temporary browser-memory
            records until exported.
          </p>
          <p>
            React, TypeScript, Vite, Tailwind, Lucide, FastAPI, NumPy, Pillow
            and ONNX Runtime are used. Dependency-generated licence notices and
            full available texts are included in THIRD_PARTY_NOTICES.md.
            Original code licence: {project.codeLicense}; this is separate from
            the source dataset’s stated licence and requires team/institution
            review before public distribution.
          </p>
          {project.repositoryUrl && (
            <a href={project.repositoryUrl}>Project repository</a>
          )}
        </>
      ) : page === "help" ? (
        <>
          <p className="lead">
            Compare stripe detail. A high similarity score is not proof of
            identity.
          </p>
          <TadobaRegistry />
          <h2>Camera detection & demo fallback</h2>
          <p>
            Open <Link to="/detect">Detect Animal</Link>. Before clicking Start
            camera, read the privacy explanation: permission is requested only
            after your click; JPEG frames go only to this Wild-ID backend, are
            processed in memory and discarded. No audio, GPS or recording.
            Camera access requires HTTPS or localhost; if embedding blocks
            permission, open the secure app in its own browser tab. Revoke
            permission in browser site settings.
          </p>
          <p>
            Stop camera is always available while permission is pending or the
            stream is on. Tracks stop on Stop, route exit, unmount and tab hide.
            Choose a camera after granting permission; rear-facing is preferred
            on mobile. Mirror preview changes both video and overlay
            coordinates. Frames are serialized (800 ms after each request
            finishes), skipped while busy, and backed off on rate/network
            errors. Stale positive boxes expire after at most 1.2 seconds from
            frame capture; this is display smoothing, not tracking.
          </p>
          <p>
            Only returned boxes are drawn. A model tiger label says Tiger
            detected; other animal outputs say Animal detected (species not
            determined). Scores are not probabilities, accuracy or individual
            identity. A reported person is ignored; the entire frame is blocked
            from similarity capture. This cannot guarantee all people are
            detected. Click Capture and find visual similarity candidates to
            stop the stream, freeze the latest eligible frame, show its
            temporary crop and explicitly request comparison. No automatic
            per-frame re-identification occurs.
          </p>
          <p>
            <b>Demo fallback:</b> choose Upload a photo, select an authorised
            JPG/JPEG/PNG (including an included dataset photo), then Detect
            photo. The active mode is shown. If weights are missing, Detector
            unavailable is shown with setup instructions; no boxes are
            simulated. You can still use the original full-frame Compare Tigers
            workflow without detection. Camera/screen images, printed tigers and
            toys can fool this research model; observed species confusion and
            absence of labelled detector evaluation are disclosed.
          </p>
          <h2>Four-step comparison quick start</h2>
          <ol>
            <li>
              Open <Link to="/identify">Compare Tigers</Link> and choose a tiger
              photograph.
            </li>
            <li>
              Inspect the full photograph or published animal crop, then select
              Compare Image.
            </li>
            <li>
              Select a ranked photograph. Inspect the query and reference side
              by side; use Zoom all images to enlarge them.
            </li>
            <li>
              Record Visually similar, Reject or Uncertain. Export your
              temporary reviews before refreshing.
            </li>
          </ol>
          <h2>What results mean</h2>
          <dl className="glossary">
            <div>
              <dt>Query</dt>
              <dd>The tiger photograph you are comparing.</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>
                A photograph in the local Hugging Face subset. The same source
                photograph is excluded for dataset queries.
              </dd>
            </div>
            <div>
              <dt>Descriptor</dt>
              <dd>
                A numerical description of visible image gradients. This build
                has no trained identity embedding.
              </dd>
            </div>
            <div>
              <dt>Cosine similarity</dt>
              <dd>
                A relative ranking signal, not a probability, confidence
                percentage or accuracy measure.
              </dd>
            </div>
            <div>
              <dt>Identity UNKNOWN</dt>
              <dd>
                The dataset has no individual-tiger labels and no validated
                identity threshold. The app cannot accept an individual
                identity, even if two photographs look very similar.
              </dd>
            </div>
            <div>
              <dt>Visual review</dt>
              <dd>
                A human observation about the comparison. It does not change
                source annotations or establish ground-truth animal identity.
              </dd>
            </div>
          </dl>
          <h2>Limitations</h2>
          <ul>
            <li>
              Pose, lighting, background, distance, occlusion and image quality
              affect ranking.
            </li>
            <li>
              Adjacent frames can be very similar without proving general
              re-identification capability.
            </li>
            <li>
              The source includes captive/enclosure imagery; it is not proof of
              performance on wild camera-trap images.
            </li>
            <li>
              Uploaded reference copies may trivially self-match because uploads
              are not linked back to source records.
            </li>
            <li>
              Uploads are not automatically checked for tiger species. Use only
              authorised tiger photographs.
            </li>
            <li>
              Reliable tiger identity evaluation requires independently labelled
              individuals and encounter-aware known/unknown tests.
            </li>
          </ul>
          <h2>Keyboard & accessibility</h2>
          <p>
            Use Tab, Shift+Tab, Enter and Space. No custom shortcuts are
            implemented. There is a skip link, visible focus, semantic controls,
            text status, live announcements and reduced-motion support. Tests
            and known gaps are in TEST_REPORT.md. Simple zoom does not provide
            panning; no screen-reader user study or full accessibility
            certification is claimed.
          </p>
        </>
      ) : page === "privacy" ? (
        <>
          <div className="notice-block">
            DRAFT — team verification is required before public deployment. This
            notice is not legal advice.
          </div>
          <h2>What is processed</h2>
          <p>
            Tiger dataset photographs, optional uploaded query photographs,
            optional live camera JPEG frames, detection outputs, visual-review
            decisions and manual observation entries. No accounts are collected.
            Available source filenames and whitelisted metadata are displayed in
            comparisons; EXIF/GPS is stripped from uploaded images before
            descriptor processing and from cached derivatives.
          </p>
          <h2>Camera permission, people and stopping</h2>
          <p>
            Camera permission is requested only after Start camera. HTTPS or
            localhost is required; use the app in its own secure tab if an
            embedded preview blocks permission. No microphone/audio or GPS is
            requested. The live preview visibly says Camera on with Stop camera.
            Every track stops on Stop, navigation/unmount, page exit or tab
            hide. Revoke permission through browser site settings; this app
            cannot revoke the browser grant itself.
          </p>
          <p>
            About one JPEG frame per second is transmitted only to the Wild-ID
            backend (800 ms after the preceding request finishes; slower on
            errors). No overlapping frame requests or recording queue is
            created. Ordinary live frame buffers are short-lived, with stale
            detections expiring within 1.2 seconds; an explicit Capture action
            temporarily holds a frame and crop in browser memory for comparison.
            No server frame or crop file is saved. Leaving/replacing that
            comparison releases image references and object URLs; secure memory
            erasure is not guaranteed. No frame-save/recording feature is
            provided.
          </p>
          <p>
            People can appear in input. The object detector may report Person,
            but this app does not identify faces/people or perform person
            analytics. Person detections are ignored, never cropped, and block
            the entire detected frame from downstream similarity. No person
            region is saved. Missed people remain a detector limitation; do not
            use this as a privacy filter or feed unauthorised footage.
          </p>
          <h2>Where & how long</h2>
          <p>
            Analysis runs in this app’s FastAPI backend. No image is sent to an
            external model provider. Dataset/weight setup downloads pinned
            artifacts from Hugging Face before use; inference performs no
            network weight download. Licences/notices are retained separately.
            No frame is uploaded to Hugging Face or another third party. Uploads
            remain in bounded request memory and are not written to disk or
            retained after the request. Browser preview object URLs are revoked
            when replaced or the comparison screen unmounts. This is not a
            guarantee of secure memory erasure.
          </p>
          <p>
            In this preview the backend shares the sandbox host with the
            frontend. Any separate deployment’s host, region, access controls
            and host-level logs still require verification by the team.
            Application logs include route templates, status and duration, not
            image contents, filenames, notes or raw client addresses. Rate
            limiting keeps a salted peer-address hash in memory for a one-minute
            window, purged on subsequent requests.
          </p>
          <h2>Temporary session</h2>
          <p>
            Retrieval rankings (including the query filename), reviews and
            observations are browser-memory only. Detection evidence attached to
            an explicit comparison is separate from similarity scores and human
            decisions; ordinary live detection results are not added to history
            or exports. Refreshing or closing loses them. Application code adds
            no cookies, localStorage, sessionStorage, IndexedDB, analytics or
            trackers. CSV/JSON exports omit images, filenames, locations and
            free-text notes. Downloaded exports remain on the reviewer’s device
            and must be deleted there.
          </p>
          <button className="button" onClick={clear}>
            Clear session data
          </button>
          <h2>Questions & future changes</h2>
          <p>
            See <Link to="/contact">Contact & feedback</Link>. A contact address
            has not yet been provided. New accounts, persistent storage or
            third-party processing require an updated notice and institutional
            review.
          </p>
        </>
      ) : page === "responsible" ? (
        <>
          <p className="lead">
            Visual suggestions for expert review, not identity conclusions.
          </p>
          <ul>
            <li>
              Not for enforcement, legal evidence or automated decisions
              affecting people or animals.
            </li>
            <li>Process only photographs you are authorised to use.</li>
            <li>
              Do not enter precise wildlife coordinates or personal information
              into notes or share sensitive source material.
            </li>
            <li>
              Do not call visually similar photographs a verified tiger
              identity.
            </li>
            <li>
              Confirm the dataset’s AGPL-3.0 obligations, image provenance,
              institutional permission, code licence, host security and privacy
              notice before public redistribution or deployment.
            </li>
          </ul>
        </>
      ) : (
        <>
          <p className="lead">{project.team}</p>
          <p>{project.institution}</p>
          {project.contactEmail && (
            <p>
              <a href={"mailto:" + project.contactEmail}>
                {project.contactEmail}
              </a>
            </p>
          )}
          {project.repositoryUrl && (
            <p>
              <a href={project.repositoryUrl}>Project repository</a>
            </p>
          )}
          {reportLink ? (
            <a className="button" href={reportLink}>
              Report a problem
            </a>
          ) : (
            <p>
              The team has not published a feedback channel yet. Copy
              diagnostics and share them directly with the team during the
              demonstration.
            </p>
          )}
          <button className="button" onClick={diagnostic}>
            <Clipboard size={16} /> Copy diagnostic info
          </button>
          <p className="muted">
            App version, backend status and last error only; no photographs or
            personal data.
          </p>
          <h2>Current connection</h2>
          <p>
            App {project.version} · backend {health?.status || "unavailable"} ·
            image retrieval
          </p>
        </>
      )}
    </article>
  );
}
