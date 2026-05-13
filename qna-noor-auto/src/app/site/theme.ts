export interface LandingTheme {
  pageBg: string;
  headerBg: string;
  headerText: string;
  headerBorder: string;
  heroBg: string;
  heroText: string;
  heroSubtext: string;
  buttonBg: string;
  buttonText: string;
  footerBg: string;
  footerText: string;
  footerBorder: string;
  bgPattern: string;
}

export const DEFAULT_THEME: LandingTheme = {
  pageBg: "#fafaf9",
  headerBg: "#ffffff",
  headerText: "#18181b",
  headerBorder: "#e4e4e7",
  heroBg: "#18181b",
  heroText: "#ffffff",
  heroSubtext: "#d4d4d8",
  buttonBg: "#18181b",
  buttonText: "#ffffff",
  footerBg: "#ffffff",
  footerText: "#71717a",
  footerBorder: "#e4e4e7",
  bgPattern: "none",
};

export function parseTheme(raw: string): LandingTheme {
  try {
    const parsed = JSON.parse(raw) as Partial<LandingTheme>;
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return { ...DEFAULT_THEME };
  }
}
