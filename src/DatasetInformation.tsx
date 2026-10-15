import type { Dataset } from "./api";
export function DatasetInformation({ data }: { data: Dataset | null }) {
  const info = data?.information;
  return (
    <section
      className="dataset-information"
      aria-labelledby="dataset-information-title"
    >
      <h2 id="dataset-information-title">Dataset Information</h2>
      {info ? (
        <>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{info.name}</dd>
            </div>
            <div>
              <dt>Hugging Face source</dt>
              <dd>
                <a href={info.source_url} target="_blank" rel="noreferrer">
                  {info.source_url}
                </a>
              </dd>
            </div>
            {info.card_license_declaration && (
              <div>
                <dt>Licence declaration (copied from card)</dt>
                <dd>
                  <code>{info.card_license_declaration}</code>
                </dd>
              </div>
            )}
            <div>
              <dt>Included images, counted from files</dt>
              <dd>
                {info.included_image_count} photographs ·{" "}
                {info.original_image_file_count} original source JPEGs ·{" "}
                {info.crop_file_count} crop derivatives. Derivatives are not
                additional independent samples.
              </dd>
            </div>
          </dl>
          {info.attribution_text && (
            <>
              <p className="micro-label">
                ATTRIBUTION / SOURCE DESCRIPTION — COPIED CARD TEXT
              </p>
              <blockquote>{info.attribution_text}</blockquote>
            </>
          )}
          <p>
            Tiger-pose is intended for tiger pose estimation. It does not
            provide the individual identity labels required to validate
            re-identification. Multiple frames may show the same tiger;
            photographs are not independent animal counts. Captive/enclosure
            scenes and adjacent frames limit relevance to wild camera-trap
            conditions.
          </p>
          <p>
            The card states 210 training and 53 validation images; the pinned
            source inventory contains {info.source_train_image_count} training
            and {info.source_validation_image_count} validation images. Only
            actual files were selected.
          </p>
          <p>
            <b>
              Review the licence’s redistribution terms before publishing these
              images or the repository publicly.
            </b>{" "}
            The full dataset licence and selected corresponding source are
            included with this project.
          </p>
        </>
      ) : (
        <p>
          Dataset information is unavailable until the backend supplies verified
          source information. Retry the connection; no dataset counts or licence
          details are guessed.
        </p>
      )}
    </section>
  );
}
