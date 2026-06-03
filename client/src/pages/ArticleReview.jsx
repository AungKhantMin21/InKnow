import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { saveArticle } from "../lib/api.js";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown.js";

const markdownComponents = {
  h2: ({ children }) => (
    <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", margin: "32px 0 12px" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 16, color: "var(--ink)", margin: "24px 0 8px" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.75, marginBottom: 14 }}>
      {children}
    </p>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBottom: 14 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBottom: 14 }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ fontFamily: "var(--font-body)", fontWeight: 300, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 6 }}>
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{children}</strong>
  ),
};

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
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

const ArticleReview = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { articles: initial = [], roleId, roleName, sessionId } = location.state || {};

  const [articles, setArticles] = useState(initial.map((a) => ({ ...a })));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState("preview");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Article content…" }),
    ],
    content: "",
  });

  if (!articles.length) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="font-body font-light text-sm text-ink-2 mb-4">No articles to review.</p>
          <button onClick={() => navigate("/sessions")} className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors">
            ← Back to sessions
          </button>
        </div>
      </div>
    );
  }

  const current = articles[currentIndex];
  const prev = currentIndex > 0 ? articles[currentIndex - 1] : null;
  const next = articles[currentIndex + 1];
  const total = articles.length;
  const progressPct = ((currentIndex + 1) / total) * 100;

  const enterEditMode = () => {
    setEditTitle(current.title);
    setEditSummary(current.summary || "");
    editor?.commands.setContent(markdownToHtml(current.content));
    setMode("edit");
  };

  const saveEdits = () => {
    const html = editor?.getHTML() || "";
    setArticles((prev) =>
      prev.map((a, i) =>
        i === currentIndex
          ? { ...a, title: editTitle.trim() || a.title, summary: editSummary.trim(), content: htmlToMarkdown(html) }
          : a
      )
    );
    setMode("preview");
  };

  const advance = () => {
    setMode("preview");
    setError(null);
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      navigate("/sessions");
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveArticle({
        role_id: roleId,
        session_id: sessionId,
        title: current.title,
        summary: current.summary,
        content: current.content,
        tags: current.tags,
      });
      setSaving(false);
      advance();
    } catch {
      setError("Something went wrong — try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface" style={{ animation: "pageFade 200ms ease" }}>

      {/* Sticky header: topbar + progress bar */}
      <div className="sticky top-0 z-10">
        <div className="bg-white border-b border-rule flex items-center px-8 gap-4" style={{ height: 52 }}>
          <button onClick={() => navigate("/sessions")} className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors">
            ← Sessions
          </button>
          <div className="w-px h-4 bg-rule" />
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">
            Review articles
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCurrentIndex((i) => i - 1); setMode("preview"); setError(null); }}
              disabled={currentIndex === 0 || mode === "edit"}
              className="font-mono text-[11px] text-ink-3 hover:text-ink transition-colors disabled:opacity-20 disabled:cursor-default px-1"
            >
              ←
            </button>
            <span className="font-mono text-[11px] text-ink-3">
              Article <span className="font-medium text-ink">{currentIndex + 1}</span> of {total}
            </span>
            <button
              onClick={() => { setCurrentIndex((i) => i + 1); setMode("preview"); setError(null); }}
              disabled={currentIndex === total - 1 || mode === "edit"}
              className="font-mono text-[11px] text-ink-3 hover:text-ink transition-colors disabled:opacity-20 disabled:cursor-default px-1"
            >
              →
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-rule">
          <div className="h-full bg-ink transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Content column */}
      <main className="flex justify-center px-8 py-12" style={{ paddingBottom: 120 }}>
        <div style={{ maxWidth: 720, width: "100%" }}>

          {/* Article meta row */}
          <div className="flex items-center justify-between mb-5">
            {roleName ? (
              <span className="font-mono text-[8px] tracking-[0.16em] uppercase text-ink-3 bg-ground border border-rule px-2 py-1">
                {roleName}
              </span>
            ) : <div />}
            {mode === "preview" && (
              <button onClick={enterEditMode} className="flex items-center gap-1.5 font-body font-light text-xs text-ink-3 hover:text-ink transition-colors">
                <PencilIcon />
                Edit this article
              </button>
            )}
          </div>

          {/* Title */}
          {mode === "preview" ? (
            <h1 className="font-display text-ink mb-4" style={{ fontWeight: 200, fontSize: 32, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {current.title}
            </h1>
          ) : (
            <input
              className="w-full border border-rule bg-surface text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors mb-4"
              style={{ fontFamily: "var(--font-display)", fontWeight: 200, fontSize: 24, letterSpacing: "-0.02em" }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          )}

          {/* Summary */}
          {mode === "preview" ? (
            current.summary && (
              <>
                <p className="font-body font-light italic text-sm text-ink-3 mb-7" style={{ lineHeight: 1.65 }}>
                  {current.summary}
                </p>
                <div className="h-px bg-rule mb-8" />
              </>
            )
          ) : (
            <>
              <input
                className="w-full border border-rule bg-surface font-body font-light text-sm text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors mb-5"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="One-sentence summary"
              />
              <div className="h-px bg-rule mb-4" />
            </>
          )}

          {/* Content */}
          {mode === "preview" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {current.content}
            </ReactMarkdown>
          ) : (
            <>
              <Toolbar editor={editor} />
              <EditorContent editor={editor} />
            </>
          )}

          {/* Article navigation — preview mode only */}
          {mode === "preview" && (prev || next) && (
            <div style={{ marginTop: 48 }}>
              <div className="h-px bg-rule mb-5" />

              {prev && (
                <div className={next ? "mb-4" : ""}>
                  <span className="font-mono text-[8px] tracking-[0.22em] uppercase text-ink-4">
                    Previous article
                  </span>
                  <button
                    onClick={() => { setCurrentIndex((i) => i - 1); setError(null); }}
                    className="w-full bg-white border border-rule hover:border-rule-hi transition-colors px-5 py-4 flex items-center gap-4 text-left mt-3"
                  >
                    <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0">
                      ← {currentIndex} of {total}
                    </span>
                    <span className="font-display text-ink-3 flex-1 text-sm" style={{ fontWeight: 200 }}>
                      {prev.title}
                    </span>
                  </button>
                </div>
              )}

              {next && (
                <div>
                  <span className="font-mono text-[8px] tracking-[0.22em] uppercase text-ink-4">
                    Next article
                  </span>
                  <button
                    onClick={() => { setCurrentIndex((i) => i + 1); setError(null); }}
                    className="w-full bg-white border border-rule hover:border-rule-hi transition-colors px-5 py-4 flex items-center gap-4 text-left mt-3"
                  >
                    <span className="font-display text-ink-3 flex-1 text-sm" style={{ fontWeight: 200 }}>
                      {next.title}
                    </span>
                    <span className="font-mono text-[9px] tracking-wider text-ink-4 flex-shrink-0">
                      {currentIndex + 2} of {total} →
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-rule z-10">
        <div className="flex items-center px-8 py-4" style={{ maxWidth: "calc(720px + 64px)", margin: "0 auto" }}>
          {mode === "preview" ? (
            <>
              <div className="flex items-center gap-3">
                <button onClick={handleApprove} disabled={saving} className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50">
                  {saving ? "Saving…" : "Approve & save"}
                </button>
                <button onClick={advance} disabled={saving} className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40">
                  Discard
                </button>
              </div>
              <div className="flex-1" />
              {error ? (
                <p className="font-body text-xs" style={{ color: "var(--danger)" }}>{error}</p>
              ) : (
                <span className="font-mono text-[10px] tracking-wider text-ink-4">
                  Approved articles go to manager review
                </span>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={saveEdits} className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors">
                  Save changes
                </button>
                <button onClick={() => setMode("preview")} className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors">
                  Cancel
                </button>
              </div>
              <div className="flex-1" />
              <span className="font-mono text-[10px] tracking-wider text-ink-4">
                Editing article {currentIndex + 1}
              </span>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default ArticleReview;
