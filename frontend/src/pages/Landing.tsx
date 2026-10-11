import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScenarioExample from "../components/ScenarioExample";

gsap.registerPlugin(ScrollTrigger);
export default function Landing({
  launch,
  methodology,
}: {
  launch: () => void;
  methodology: () => void;
}) {
  const page = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const match = gsap.matchMedia();
    match.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) =>
          gsap.from(element, {
            y: 24,
            opacity: 0,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 92%", once: true },
          }),
        );
      }, page);
      return () => context.revert();
    });
    return () => match.revert();
  }, []);
  const enter = {
    initial: reduced ? (false as const) : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };
  return (
    <div ref={page} className="landing">
      <section className="hero">
        <motion.div className="hero-copy" {...enter}>
          <p className="eyebrow">A perspective on the shared landscape</p>
          <h1>
            Intelligence
            <br />
            for the <em>Wild.</em>
          </h1>
          <p className="hero-description">
            See where geography meets environmental change. Explore the
            landscape. Understand the assumptions.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={launch}>
              Explore the Platform <ArrowUpRight size={18} />
            </button>
          </div>
          <p className="hero-note">
            A research simulator for Mudumalai, India.
          </p>
        </motion.div>
        <motion.figure
          className="hero-geography"
          {...enter}
          transition={{ ...enter.transition, delay: reduced ? 0 : 0.15 }}
        >
          <img
            src="/mudumalai-study.svg"
            alt="Cached Mudumalai reserve boundary, waterways and six village locations"
            width="900"
            height="600"
            fetchPriority="high"
          />
          <figcaption>
            <span>Mudumalai & the Nilgiris</span>
            <span>Cached OSM geography · © OpenStreetMap contributors</span>
          </figcaption>
        </motion.figure>
        <div className="hero-bottom">
          <a href="#technology">
            Discover the landscape <ArrowDown size={16} />
          </a>
          <span>Geography. Scenarios. Understanding.</span>
        </div>
      </section>
      <section className="landscape-story" id="technology">
        <div className="story-copy" data-reveal>
          <span className="section-kicker">The shared landscape</span>
          <h2>
            The forest doesn’t end
            <br />
            at its <em>boundary.</em>
          </h2>
          <p>
            Six villages. One connected landscape. Follow the reserve edge,
            waterways, and settlements to see the geographic context behind each
            scenario.
          </p>
          <button className="text-link" onClick={launch}>
            Explore the geographic workspace <ArrowUpRight size={17} />
          </button>
        </div>
        <figure className="study-detail" data-reveal>
          <img
            src="/mudumalai-study.svg"
            alt="Geographic relationships between the Mudumalai reserve and nearby villages"
            width="900"
            height="600"
            loading="lazy"
          />
          <figcaption>
            Actual cached locations. Illustrative geofences in the workspace.
          </figcaption>
        </figure>
      </section>
      <section className="scenario-story" data-reveal>
        <ScenarioExample />
        <div className="story-copy">
          <span className="section-kicker">A question, made visible</span>
          <h2>
            Change an assumption.
            <br />
            See its <em>effect.</em>
          </h2>
          <p>
            Start with a preset or adjust the conditions yourself. Compare
            against a saved baseline, then follow every contribution back to its
            source.
          </p>
          <button className="text-link" onClick={launch}>
            Build a scenario <ArrowUpRight size={17} />
          </button>
        </div>
      </section>
      <section className="method-teaser" data-reveal>
        <h2>
          Clarity begins with
          <br />
          <em>honest assumptions.</em>
        </h2>
        <div>
          <p>
            Cached geography. Reanalysis rainfall. Explicit hypothetical inputs.
            GeoSentinel explores an illustrative scoring rule; it does not
            predict animal movement or issue operational warnings.
          </p>
          <button className="text-link" onClick={methodology}>
            Read the methodology <ArrowUpRight size={17} />
          </button>
        </div>
      </section>
      <section className="launch-section" data-reveal>
        <h2>A closer look starts here.</h2>
        <button className="button primary" onClick={launch}>
          Explore the Platform <ArrowUpRight size={18} />
        </button>
      </section>
      <footer className="site-footer">
        <span>GeoSentinel</span>
        <p>Research simulation · Built for understanding.</p>
        <button onClick={methodology}>
          Sources & limitations <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}
