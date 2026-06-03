import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../hooks/useAuth.jsx";
import Sidebar from "../components/ui/Sidebar.jsx";
import { getArticle, updateArticle } from "../lib/api.js";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown.js";

const markdownComponents = {
  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 200,
        fontSize: 20,
        color: "var(--ink)",
        letterSpacing: "-0.01em",
        margin: "32px 0 12px",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 200,
        fontSize: 16,
        color: "var(--ink)",
        margin: "24px 0 8px",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 300,
        fontSize: 14,
        color: "var(--ink-2)",
        lineHeight: 1.75,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBottom: 14 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBottom: 14 }}>{children}</ol>,
  li: ({ children }) => (
    <li
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 300,
        fontSize: 14,
        color: "var(--ink-2)",
        lineHeight: 1.65,
        marginBottom: 6,
      }}
    >
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 500, color: "var(--ink)" }}>{children}</strong>
  ),
};

const PencilIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const Toolbar = ({ editor }) => {
  if (!editor) return null;
  return (
    <div className="toolbar">
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("bold") ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBold().run();
        }}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("italic") ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleItalic().run();
        }}
      >
        <em>I</em>
      </button>
      <div className="toolbar-sep" />
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        }}
      >
        H2
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        }}
      >
        H3
      </button>
      <div className="toolbar-sep" />
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("bulletList") ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleBulletList().run();
        }}
      >
        •–
      </button>
      <button
        type="button"
        className={`toolbar-btn ${editor.isActive("orderedList") ? "is-active" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().toggleOrderedList().run();
        }}
      >
        1.
      </button>
    </div>
  );
};

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("view");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Article content…" })],
    content: "",
  });

  useEffect(() => {
    getArticle(id)
      .then(({ data }) => setArticle(data.data.article))
      .catch(() => setError("We couldn't find that. Try going back."))
      .finally(() => setLoading(false));
  }, [id]);

  const isAuthor = article && user && article.captured_by === user.id;

  const enterEditMode = () => {
    setEditTitle(article.title);
    setEditSummary(article.summary || "");
    editor?.commands.setContent(markdownToHtml(article.content));
    setSaveError(null);
    setMode("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const html = editor?.getHTML() || "";
      const { data } = await updateArticle(id, {
        title: editTitle.trim() || article.title,
        summary: editSummary.trim() || null,
        content: htmlToMarkdown(html),
      });
      setArticle(data.data.article);
      setMode("view");
    } catch {
      setSaveError("Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
        <Sidebar />
        <main className="flex-1 flex justify-center px-8 py-12">
          <div style={{ maxWidth: 720, width: "100%" }}>
            <div className="h-4 bg-ground w-24 mb-10" />
            <div className="h-8 bg-ground w-2/3 mb-4" />
            <div className="h-4 bg-ground w-full mb-2" />
            <div className="h-4 bg-ground w-5/6 mb-2" />
            <div className="h-4 bg-ground w-3/4" />
          </div>
        </main>
      </div>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────
  if (error || !article) {
    return (
      <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-body font-light text-sm text-ink-2 mb-4">
              {error || "We couldn't find that. Try going back."}
            </p>
            <button
              onClick={() => navigate("/knowledge")}
              className="font-body font-medium text-xs text-ink-3 hover:text-ink transition-colors"
            >
              ← Back to knowledge
            </button>
          </div>
        </main>
      </div>
    );
  }

  const date = new Date(article.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── Article view ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex" style={{ animation: "pageFade 200ms ease" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="bg-white border-b border-rule flex items-center px-8 gap-4 flex-shrink-0" style={{ height: 52 }}>
          <button
            onClick={() => navigate("/knowledge")}
            className="font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Knowledge
          </button>
          <div className="w-px h-4 bg-rule" />
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-4">
            {article.roles?.name || ""}
          </span>
          <div className="flex-1" />
          {isAuthor && mode === "view" && (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-1.5 font-body font-light text-xs text-ink-3 hover:text-ink transition-colors"
            >
              <PencilIcon />
              Edit
            </button>
          )}
        </div>

        {/* Content */}
        <main className="flex justify-center px-8 py-12" style={{ paddingBottom: mode === "edit" ? 100 : 80 }}>
          <div style={{ maxWidth: 720, width: "100%" }}>

            {/* Meta */}
            <div className="flex items-center gap-3 mb-6">
              <span className="font-mono text-[8px] tracking-[0.16em] uppercase text-ink-3 bg-ground border border-rule px-2 py-1">
                {article.roles?.name || "Unknown role"}
              </span>
              <span className="font-mono text-[9px] tracking-wider text-ink-4">
                {article.capturer?.name || "Unknown"} · {date}
              </span>
              {(article.view_count || 0) > 0 && (
                <span className="font-mono text-[9px] tracking-wider text-ink-4">
                  {article.view_count} view{article.view_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Title */}
            {mode === "view" ? (
              <h1
                className="font-display text-ink mb-4"
                style={{ fontWeight: 200, fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                {article.title}
              </h1>
            ) : (
              <input
                className="w-full border border-rule bg-surface text-ink px-3 py-2.5 outline-none focus:border-rule-hi transition-colors mb-4"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 200,
                  fontSize: 24,
                  letterSpacing: "-0.02em",
                }}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            )}

            {/* Summary */}
            {mode === "view" ? (
              article.summary && (
                <>
                  <p
                    className="font-body font-light italic text-sm text-ink-3 mb-7"
                    style={{ lineHeight: 1.65 }}
                  >
                    {article.summary}
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
            {mode === "view" ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {article.content}
              </ReactMarkdown>
            ) : (
              <>
                <Toolbar editor={editor} />
                <EditorContent editor={editor} />
              </>
            )}

          </div>
        </main>

        {/* Edit bottom bar */}
        {mode === "edit" && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-rule z-10">
            <div className="flex items-center px-8 py-4" style={{ maxWidth: "calc(720px + 64px + 224px)", margin: "0 auto" }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-ink text-surface font-body font-medium text-xs px-6 py-2.5 tracking-wider uppercase hover:bg-ink-2 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => { setMode("view"); setSaveError(null); }}
                  disabled={saving}
                  className="border border-rule bg-transparent text-ink-2 font-body font-medium text-xs px-4 py-2 hover:bg-ground transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
              <div className="flex-1" />
              {saveError ? (
                <p className="font-body text-xs" style={{ color: "var(--danger)" }}>{saveError}</p>
              ) : (
                <span className="font-mono text-[10px] tracking-wider text-ink-4">
                  Only you can edit this article
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleDetail;
