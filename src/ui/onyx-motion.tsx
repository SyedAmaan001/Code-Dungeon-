"use client";
/**
 * Motion for the Onyx preview theme (DEC-019). Nothing here runs in the default theme or when
 * the player prefers reduced motion, and the libraries are loaded on demand, so the default
 * theme downloads none of them.
 *
 *   Lenis   smooth wheel scrolling (native scrolling, sticky elements and anchors keep working)
 *   GSAP    scroll-linked reveal of map zones and their trails (ScrollTrigger)
 *   Motion  spring entrances for map rooms, the level room, challenge feedback and hints
 *
 * Everything here is decoration. All content is in the page from the first render (and read by
 * assistive technology); map zones below the fold fade in as they scroll into view.
 */
import { useEffect } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const onyxActive = () => document.documentElement.dataset.theme === "onyx";

/** Rendered by the root layout only when the Onyx theme is active. */
export function OnyxMotion() {
  // Smooth scrolling for the whole session; GSAP's scroll triggers follow Lenis.
  useEffect(() => {
    if (reducedMotion()) return;
    let destroy = () => {};
    let cancelled = false;
    void Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({ autoRaf: true, anchors: true });
        lenis.on("scroll", ScrollTrigger.update);
        destroy = () => lenis.destroy();
      },
    );
    return () => {
      cancelled = true;
      destroy();
    };
  }, []);

  return null;
}

/**
 * Entrance animations for the page it is rendered in (map, level room). It must live inside the
 * page, not the layout: its effect then runs only after that page has hydrated, so the
 * animations never touch markup React has not yet matched against the server HTML.
 */
export function OnyxEntrance() {
  useEffect(() => {
    if (!onyxActive() || reducedMotion()) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("motion")]).then(
      ([{ gsap }, { ScrollTrigger }, { animate, stagger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          for (const zone of gsap.utils.toArray<HTMLElement>(".zone")) {
            gsap.from(zone, {
              opacity: 0,
              y: 28,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: { trigger: zone, start: "top 88%", once: true },
            });
            const path = zone.querySelector<HTMLElement>(".path");
            if (path) {
              gsap.fromTo(
                path,
                { "--trail": 0 },
                {
                  "--trail": 1,
                  duration: 0.9,
                  ease: "power1.inOut",
                  scrollTrigger: { trigger: path, start: "top 85%", once: true },
                },
              );
            }
          }
        });
        cleanups.push(() => ctx.revert());

        const rooms = document.querySelectorAll(".room");
        if (rooms.length) {
          animate(
            rooms,
            { opacity: [0, 1], y: [10, 0], scale: [0.96, 1] },
            { delay: stagger(0.025), type: "spring", bounce: 0.3, duration: 0.5 },
          );
        }

        const room = document.querySelector(".room-layout");
        if (room) {
          animate(
            room,
            { opacity: [0, 1], y: [8, 0] },
            {
              duration: 0.35,
            },
          );
        }

        // Feedback and hints appear after a server response: spring them in as they arrive.
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (!(node instanceof HTMLElement)) continue;
              const target = node.matches(".feedback, .hint")
                ? node
                : node.querySelector<HTMLElement>(".feedback, .hint");
              if (target) {
                animate(
                  target,
                  { opacity: [0, 1], y: [6, 0], scale: [0.98, 1] },
                  { type: "spring", bounce: 0.25, duration: 0.45 },
                );
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        cleanups.push(() => observer.disconnect());
      },
    );

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
