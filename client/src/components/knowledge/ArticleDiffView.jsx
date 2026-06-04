import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { computeChanges } from "../../lib/diffEngine.js";
import { markdownToHtml, htmlToMarkdown } from "../../lib/markdown.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the 0-based line index in currentContent where a change begins.
// Removed changes have no lines in currentContent — they are skipped.
const getStartLine = (changes, targetId) => {
  let line = 0;
  for (const change of changes) {
    if (change.id === targetId) return line;
    if (change.type !== "removed") line += change.lineCount;
  }
  return line;
};

// ── Sub-components ────────────────────────────────────────────────────────────

const GUTTER = {
  unchanged: { rowBg: "var(--white)",        gutterBg: "var(--ground)",             gutterBorder: "var(--rule)",               glyph: "·", glyphColor: "var(--ink-4)"  },
  removed:   { rowBg: "#FDF0F0",             gutterBg: "rgba(139,26,26,0.08)",      gutterBorder: "rgba(139,26,26,0.3)",       glyph: "−", glyphColor: "var(--danger)" },
  added:     { rowBg: "var(--forest-light)", gutterBg: "rgba(26,107,69,0.08)",      gutterBorder: "rgba(26,107,69,0.3)",       glyph: "+", glyphColor: "var(--forest)" },
};

const getTextStyle = (content, color) => {
  if (content.startsWith("## "))  return { fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 17, color, lineHeight: 1.4 };
  if (content.startsWith("### ")) return { fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 15, color, lineHeight: 1.4 };
  return { fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 13, color, lineHeight: 1.6 };
};

const getDisplayContent = (content) => {
  if (content.startsWith("## "))  return content.slice(3);
  if (content.startsWith("### ")) return content.slice(4);
  return content;
};

const ChangeRow = ({ change, onRestore }) => {
  const [hovered, setHovered] = useState(false);
  const s = GUTTER[change.type] || GUTTER.unchanged;
  const textColor = change.type === "removed"
    ? "var(--danger)"
    : change.type === "added"
    ? "var(--forest)"
    : "var(--ink-2)";
  const textStyle = getTextStyle(change.content, textColor);
  const displayContent = getDisplayContent(change.content);

  return (
    <div
      className="relative flex"
      style={{ background: s.rowBg, borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Gutter */}
      <div
        style={{
          width: 28,
          flexShrink: 0,
          background: s.gutterBg,
          borderRight: `0.5px solid ${s.gutterBorder}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: s.glyphColor,
          userSelect: "none",
        }}
      >
        {s.glyph}
      </div>

      {/* Content */}
      <div
        style={{
          ...textStyle,
          flex: 1,
          padding: "6px 14px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textDecoration: change.type === "removed" ? "line-through" : "none",
          opacity: change.type === "removed" ? 0.7 : 1,
        }}
      >
        {displayContent}
      </div>

      {/* Restore button — only on hovered removed rows that have a paired added */}
      {change.type === "removed" && hovered && onRestore && (
        <div
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1,
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={onRestore}
            style={{
              background: "var(--ink)",
              color: "var(--surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "3px 8px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            ↩ Restore
          </button>
        </div>
      )}
    </div>
  );
};

const StatChip = ({ color, bg, count, label, faded }) => (
  <span
    className="inline-flex items-center gap-1.5"
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.04em",
      color,
      opacity: faded ? 0.4 : 1,
      transition: "opacity 200ms",
    }}
  >
    <span style={{ width: 8, height: 8, background: bg, flexShrink: 0, display: "inline-block" }} />
    {count} {label}
  </span>
);

const Toolbar = ({ editor }) => {
  if (!editor) return null;
  return (
    <div className="toolbar">
      <button type="button" className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>
        <strong>B</strong>
      </button>
      <button type="button" className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>
        <em>I</em>
      </button>
      <div className="toolbar-sep" />
      <button type="button" className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}>
        H2
      </button>
      <button type="button" className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}>
        H3
      </button>
      <div className="toolbar-sep" />
      <button type="button" className={`toolbar-btn ${editor.isActive("bulletList") ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}>
        •–
      </button>
      <button type="button" className={`toolbar-btn ${editor.isActive("orderedList") ? "is-active" : ""}`} onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}>
        1.
      </button>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ArticleDiffView = ({ article, proposedUpdate, onApply, onKeep, saving, error }) => {
  const baseContent = article.content || "";

  const [currentContent, setCurrentContent] = useState(proposedUpdate.content || "");
  const [changes, setChanges] = useState([]);
  const [view, setView] = useState("diff"); // "diff" | "editor"

  // Track the initial removed count to show a restored note
  const initialRemovedRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Article content…" }),
    ],
    content: "",
  });

  // Recompute diff whenever currentContent changes — single source of truth
  useEffect(() => {
    const computed = computeChanges(baseContent, currentContent);
    setChanges(computed);
    if (initialRemovedRef.current === null) {
      initialRemovedRef.current = computed.filter((c) => c.type === "removed").length;
    }
  }, [currentContent]); // eslint-disable-line react-hooks/exhaustive-deps — baseContent is stable per mount

  // ── Restore ─────────────────────────────────────────────────────────────────

  const handleRestore = (removedChange, pairedAddedChange) => {
    const lines = currentContent.split("\n");
    const addedStartLine = getStartLine(changes, pairedAddedChange.id);
    const restoredLines = removedChange.content.split("\n");
    lines.splice(addedStartLine, pairedAddedChange.lineCount, ...restoredLines);
    setCurrentContent(lines.join("\n"));
  };

  // ── Editor view transitions ──────────────────────────────────────────────────

  const handleSwitchToEditor = () => {
    editor?.commands.setContent(markdownToHtml(currentContent));
    setView("editor");
  };

  const handleDoneEditing = () => {
    const markdown = htmlToMarkdown(editor?.getHTML() || "");
    setCurrentContent(markdown);
    setView("diff");
  };

  const handleCancelEditing = () => {
    setView("diff");
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const removedCount  = changes.filter((c) => c.type === "removed").length;
  const addedCount    = changes.filter((c) => c.type === "added").length;
  const unchangedCount = changes.filter((c) => c.type === "unchanged").length;
  const restoredCount = initialRemovedRef.current !== null
    ? initialRemovedRef.current - removedCount
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* View toggle strip */}
      <div className="flex items-center" style={{ borderBottom: "0.5px solid var(--rule)", marginBottom: 20 }}>
        <button
          onClick={() => view === "editor" ? handleCancelEditing() : undefined}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            padding: "0 0 10px",
            marginRight: 24,
            color: view === "diff" ? "var(--ink)" : "var(--ink-4)",
            borderBottom: view === "diff" ? "1.5px solid var(--ink)" : "1.5px solid transparent",
            marginBottom: "-0.5px",
            background: "none",
            border: "none",
            borderBottomStyle: "solid",
            cursor: view === "editor" ? "pointer" : "default",
          }}
        >
          Diff view
        </button>
        <button
          onClick={view === "diff" ? handleSwitchToEditor : undefined}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            padding: "0 0 10px",
            color: view === "editor" ? "var(--ink)" : "var(--ink-4)",
            borderBottom: view === "editor" ? "1.5px solid var(--ink)" : "1.5px solid transparent",
            marginBottom: "-0.5px",
            background: "none",
            border: "none",
            borderBottomStyle: "solid",
            cursor: view === "diff" ? "pointer" : "default",
          }}
        >
          Edit proposed
        </button>
      </div>

      {view === "diff" ? (
        <>
          {/* Diff stats bar */}
          <div className="flex items-center gap-4 mb-3">
            <StatChip color="var(--danger)" bg="#FDF0F0" count={removedCount} label="removed" faded={removedCount === 0} />
            <span style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontSize: 10 }}>·</span>
            <StatChip color="var(--forest)" bg="var(--forest-light)" count={addedCount} label="added" faded={false} />
            <span style={{ color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontSize: 10 }}>·</span>
            <StatChip color="var(--ink-3)" bg="var(--ground)" count={unchangedCount} label="unchanged" faded={false} />
          </div>

          {/* Diff block */}
          <div style={{ border: "0.5px solid var(--rule)", background: "var(--white)", overflow: "hidden" }}>
            {changes.map((change, idx) => {
              const pairedAdded =
                change.type === "removed" && changes[idx + 1]?.type === "added"
                  ? changes[idx + 1]
                  : null;
              return (
                <ChangeRow
                  key={change.id}
                  change={change}
                  onRestore={pairedAdded ? () => handleRestore(change, pairedAdded) : undefined}
                />
              );
            })}
          </div>

          {/* Restored note */}
          {restoredCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--forest)", background: "var(--ground)", border: "0.5px solid var(--rule)", padding: "5px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--forest)", flexShrink: 0 }} />
              {restoredCount} line{restoredCount !== 1 ? "s" : ""} restored
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tiptap editor */}
          <div className="bg-white border border-rule">
            <Toolbar editor={editor} />
            <div style={{ padding: "8px 16px" }}>
              <EditorContent editor={editor} className="tiptap" />
            </div>
          </div>

          {/* Editor actions */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleDoneEditing}
              className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors"
            >
              Done editing
            </button>
            <button
              onClick={handleCancelEditing}
              className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-rule z-10">
        <div
          className="flex items-center px-9 py-4"
          style={{ maxWidth: "calc(760px + 72px)", margin: "0 auto" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => onApply(currentContent)}
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
