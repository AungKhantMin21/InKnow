import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { computeLineDiff } from "../../lib/diff.js";

const UndoIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
  </svg>
);

const LINE_STYLES = {
  unchanged: {
    bg: "var(--white)",
    textColor: "var(--ink-2)",
    glyph: "·",
    glyphColor: "var(--ink-4)",
    gutterBg: "var(--ground)",
    gutterBorder: "var(--rule)",
    textDecoration: "none",
    opacity: 1,
    editable: true,
    cursor: "text",
    pointerEvents: "auto",
  },
  added: {
    bg: "var(--forest-light)",
    textColor: "var(--forest)",
    glyph: "+",
    glyphColor: "var(--forest)",
    gutterBg: "rgba(26,107,69,0.08)",
    gutterBorder: "rgba(26,107,69,0.3)",
    textDecoration: "none",
    opacity: 1,
    editable: true,
    cursor: "text",
    pointerEvents: "auto",
  },
  removed: {
    bg: "#FDF0F0",
    textColor: "var(--danger)",
    glyph: "−",
    glyphColor: "var(--danger)",
    gutterBg: "rgba(139,26,26,0.08)",
    gutterBorder: "rgba(139,26,26,0.3)",
    textDecoration: "line-through",
    opacity: 0.65,
    editable: false,
    cursor: "not-allowed",
    pointerEvents: "none",
  },
  "human-edited": {
    bg: "var(--forest-light)",
    textColor: "var(--forest)",
    glyph: "~",
    glyphColor: "var(--forest)",
    gutterBg: "rgba(26,107,69,0.08)",
    gutterBorder: "rgba(26,107,69,0.3)",
    textDecoration: "none",
    opacity: 1,
    editable: true,
    cursor: "text",
    pointerEvents: "auto",
  },
  restored: {
    bg: "var(--forest-light)",
    textColor: "var(--forest)",
    glyph: "~",
    glyphColor: "var(--forest)",
    gutterBg: "rgba(26,107,69,0.08)",
    gutterBorder: "rgba(26,107,69,0.3)",
    textDecoration: "none",
    opacity: 1,
    editable: true,
    cursor: "text",
    pointerEvents: "auto",
  },
};

const getLineFont = (content, color) => {
  if (content.startsWith("## ")) {
    return { fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 17, color, lineHeight: 1.4 };
  }
  if (content.startsWith("### ")) {
    return { fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 15, color, lineHeight: 1.4 };
  }
  return { fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 13, color, lineHeight: 1.6 };
};

const DiffLine = ({ line, onInput, onRestore, registerRef }) => {
  const elRef = useRef(null);

  const effectiveType = line.isRestored ? "restored" : line.isHumanEdited ? "human-edited" : line.type;
  const s = LINE_STYLES[effectiveType];
  const fontStyle = getLineFont(line.content, s.textColor);

  // Set initial content once after mount — never let React overwrite it again
  useLayoutEffect(() => {
    if (elRef.current) {
      elRef.current.innerText = line.content;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex" style={{ background: s.bg, borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
      {/* Gutter */}
      <div
        style={{
          width: 28,
          flexShrink: 0,
          background: s.gutterBg,
          borderRight: `0.5px solid ${s.gutterBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: s.glyphColor,
          userSelect: "none",
          minHeight: 32,
        }}
      >
        {s.glyph}
      </div>

      {/* Content — managed by browser, not React */}
      <div
        ref={(node) => {
          elRef.current = node;
          registerRef(node);
        }}
        contentEditable={s.editable}
        suppressContentEditableWarning={true}
        onInput={s.editable ? onInput : undefined}
        style={{
          ...fontStyle,
          flex: 1,
          padding: "6px 14px",
          outline: "none",
          textDecoration: s.textDecoration,
          opacity: s.opacity,
          cursor: s.cursor,
          pointerEvents: s.pointerEvents,
          minHeight: 32,
          wordBreak: "break-word",
        }}
      />

      {/* Restore tooltip — only on removed lines */}
      {effectiveType === "removed" && (
        <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "auto", zIndex: 1 }}>
          <button
            onClick={onRestore}
            style={{
              background: "var(--ink)",
              color: "var(--surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "3px 6px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <UndoIcon />
            Restore
          </button>
        </div>
      )}
    </div>
  );
};

const ArticleDiffView = ({ article, proposedUpdate, onApply, onKeep, saving, error }) => {
  const [lines, setLines] = useState(() =>
    computeLineDiff(article.content || "", proposedUpdate.content || "").map((d, i) => ({
      id: i,
      type: d.type,
      content: d.content,
      isHumanEdited: false,
      isRestored: false,
    }))
  );

  const domRefs = useRef({});
  const humanEdits = lines.filter(l => l.isHumanEdited || l.isRestored).length;

  const handleInput = useCallback((id) => {
    setLines(prev => {
      const line = prev.find(l => l.id === id);
      if (!line || line.type !== "unchanged" || line.isHumanEdited) return prev;
      return prev.map(l => l.id === id ? { ...l, isHumanEdited: true } : l);
    });
  }, []);

  const handleRestore = useCallback((id) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, isRestored: true } : l));
  }, []);

  const collectContent = () =>
    lines
      .filter(l => l.type !== "removed" || l.isRestored)
      .map(l => {
        const el = domRefs.current[l.id];
        return el ? el.innerText : l.content;
      })
      .join("\n");

  const handleApply = () => onApply(collectContent());

  return (
    <>
      {/* Diff block */}
      <div style={{ border: "0.5px solid var(--rule)", background: "var(--white)", overflow: "hidden" }}>
        {lines.map(line => (
          <DiffLine
            key={line.id}
            line={line}
            onInput={() => handleInput(line.id)}
            onRestore={() => handleRestore(line.id)}
            registerRef={(el) => { domRefs.current[line.id] = el; }}
          />
        ))}
      </div>

      {/* Human edit counter */}
      {humanEdits > 0 && (
        <div className="mt-3">
          <div
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.08em",
              color: "var(--forest)",
              background: "var(--ground)",
              border: "0.5px solid var(--rule)",
              padding: "5px 10px",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--forest)", flexShrink: 0 }} />
            {humanEdits} manual edit{humanEdits !== 1 ? "s" : ""} applied
          </div>
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-rule z-10">
        <div className="flex items-center px-9 py-4" style={{ maxWidth: "calc(760px + 72px)", margin: "0 auto" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={handleApply}
              disabled={saving}
              style={{ background: "var(--forest)", color: "var(--white)" }}
              className="font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving…" : "Apply update"}
            </button>
            <button
              onClick={onKeep}
              disabled={saving}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40"
            >
              Keep current version
            </button>
          </div>
          <div className="flex-1" />
          {error ? (
            <p className="font-body text-xs" style={{ color: "var(--danger)" }}>{error}</p>
          ) : (
            <span className="font-mono text-ink-4" style={{ fontSize: 10, letterSpacing: "0.04em" }}>
              v{article.version || 1} stays live in Inno until applied
            </span>
          )}
        </div>
      </div>
    </>
  );
};

export default ArticleDiffView;
