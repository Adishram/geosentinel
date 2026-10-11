import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import Landing from "./pages/Landing";
import { Brand, Loading } from "./components/ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
type Page = "home" | "workspace" | "analytics" | "methodology";
export default function App() {
  const [page, setPage] = useState<Page>(() =>
    ["workspace", "analytics", "methodology"].includes(location.hash.slice(1))
      ? (location.hash.slice(1) as Page)
      : "home",
  );
  const navigate = (next: Page) => {
    setPage(next);
    location.hash = next === "home" ? "" : next;
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const onHash = () =>
      setPage(
        ["workspace", "analytics", "methodology"].includes(
          location.hash.slice(1),
        )
          ? (location.hash.slice(1) as Page)
          : "home",
      );
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Brand onClick={() => navigate("home")} />
        {page === "home" && (
          <nav aria-label="Main navigation">
            <button onClick={() => navigate("workspace")}>Workspace</button>
            <button onClick={() => navigate("analytics")}>Analytics</button>
            <button onClick={() => navigate("methodology")}>Methodology</button>
          </nav>
        )}
        {page === "home" ? (
          <button className="header-cta" onClick={() => navigate("workspace")}>
            Open workspace
            <ArrowUpRight size={15} />
          </button>
        ) : (
          <span className="header-location">Mudumalai · The Nilgiris</span>
        )}
      </header>
      <div className="research-strip">
        <FlaskConical size={13} />
        <span>Research simulation</span>
        <p>
          Illustrative scenarios. Not animal detections, probabilities, or
          operational warnings.
        </p>
      </div>
      <main id="main">
        <AnimatePresence mode="wait">
          {page === "home" ? (
            <motion.div
              key="landing"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Landing
                launch={() => navigate("workspace")}
                methodology={() => navigate("methodology")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              <Suspense fallback={<Loading />}>
                <Dashboard view={page} setView={navigate} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
