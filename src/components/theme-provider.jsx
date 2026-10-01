import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
const ThemeContext = createContext(null);
const key = "pocket-chef-theme";
function savedTheme() {
  try {
    const t = localStorage.getItem(key);
    return ["light", "dark", "system"].includes(t) ? t : "system";
  } catch {
    return "system";
  }
}
export function ThemeProvider({ children }) {
  const [theme, updateTheme] = useState(savedTheme);
  const [system, setSystem] = useState(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const resolvedTheme = theme === "system" ? system : theme;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", changed);
    const sync = (e) => {
      if (e.key === key) updateTheme(savedTheme());
    };
    addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", changed);
      removeEventListener("storage", sync);
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
    const suffix = resolvedTheme === "dark" ? "-dark" : "";
    document.querySelector("#favicon")?.setAttribute("href", `/icon-${resolvedTheme}.svg?v=line1`);
    document.querySelector("#favicon-fallback")?.setAttribute("href", `/favicon${suffix}.ico?v=line1`);
    document.querySelector("#favicon-png")?.setAttribute("href", `/favicon${suffix}.png?v=line1`);
  }, [resolvedTheme]);
  const setTheme = (value) => {
    updateTheme(value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  };
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  return useContext(ThemeContext);
}
