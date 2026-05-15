/** Subpath used at runtime — see fetchYouTubeTranscript in content-ingestion.ts */
declare module "youtube-transcript/dist/youtube-transcript.esm.js" {
  export {
    YoutubeTranscript,
    fetchTranscript,
    YoutubeTranscriptError,
    YoutubeTranscriptTooManyRequestError,
    YoutubeTranscriptVideoUnavailableError,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
  } from "youtube-transcript";
}
