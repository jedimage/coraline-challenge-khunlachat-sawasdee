import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function Invitation({ onYes }: { onYes: () => void }) {
  const noButton = useRef<HTMLButtonElement>(null);
  const [escaped, setEscaped] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({
    left: "62%",
    top: "8px",
  });

  useEffect(() => {
    const resetPosition = () => setPosition({ left: "62%", top: "8px" });
    window.addEventListener("resize", resetPosition);
    return () => window.removeEventListener("resize", resetPosition);
  }, []);

  function move() {
    const button = noButton.current;
    const bounds = button?.getBoundingClientRect();
    const card = button?.closest(".card")?.getBoundingClientRect();
    const actions = button?.offsetParent?.getBoundingClientRect();
    if (!bounds || !card || !actions) return;
    setEscaped(true);
    // Choose freely within the visible card, leaving padding at its edges.
    const minX = Math.max(card.left + 20, 8);
    const maxX = Math.max(minX, Math.min(card.right - 20, window.innerWidth - 8) - bounds.width);
    const minY = Math.max(card.top + 20, 8);
    const maxY = Math.max(minY, Math.min(card.bottom - 20, window.innerHeight - 8) - bounds.height);
    setPosition({
      position: "absolute",
      zIndex: 2,
      left: minX + Math.random() * (maxX - minX) - actions.left,
      top: minY + Math.random() * (maxY - minY) - actions.top,
    });
  }

  return (
    <>
      <div className="illustration" aria-hidden="true">
        <span className="sun">✳</span>
        <img className="miku" src="/images/sakura-miku.png" alt="" width="120" height="120" />
        <span className="sparkle">✧</span>
      </div>
      <p className="eyebrow">A LITTLE INVITATION, JUST FOR YOU</p>
      <h1>
        Wanna go on a<br />
        <em>date with me?</em> 💖
      </h1>
      <p className="intro">
        Let’s trade a little screen time for a little us time.
        <br />
        Help Jedi go touch grass. 🌱
      </p>
      <div className="invitation-actions">
        <button className="primary yes" onClick={onYes}>
          Yes, let’s! <span aria-hidden="true">↗</span>
        </button>
        <button
          ref={noButton}
          className="no"
          style={position}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") move();
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") {
              event.preventDefault();
              move();
            }
          }}
          onClick={move}
        >
          No
        </button>
      </div>
      <p className="small playful" aria-live="polite">
        {escaped
          ? "Oops. That button has other plans 🙃"
          : "One small plan. Something lovely to look forward to."}
      </p>
    </>
  );
}
