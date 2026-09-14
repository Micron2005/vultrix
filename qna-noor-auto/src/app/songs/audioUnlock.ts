// iOS routes bare Web Audio through the "ambient" category, which the ringer
// switch silences. Playing an HTMLMediaElement first moves the page to the
// media route, so the AudioContext keeps sounding with the switch on silent.
// Must be called from inside a user gesture.

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

let unlockElement: HTMLAudioElement | null = null;
let unlocked = false;

export function unlockMediaRoute() {
  if (unlocked || typeof window === "undefined") return;
  try {
    const element = unlockElement ?? new Audio(SILENT_WAV);
    unlockElement = element;
    element.setAttribute("playsinline", "");
    element.loop = false;
    element.volume = 0.01;
    const result = element.play();
    if (result && typeof result.then === "function") {
      result.then(
        () => {
          unlocked = true;
        },
        () => {
          // Autoplay policy rejected the play; the next gesture retries.
        },
      );
    } else {
      unlocked = true;
    }
  } catch {
    // Media element unavailable; Web Audio still runs on the default route.
  }
}

export async function ensureRunning(context: AudioContext) {
  if (context.state !== "running") {
    await context.resume();
  }
}
