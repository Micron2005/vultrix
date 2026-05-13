"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { useCallback, useRef, useState, useTransition } from "react";
import { saveLandingContent } from "./actions";
import { Extension } from "@tiptap/react";

/* ── Custom FontSize extension ── */
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

/* ── Toolbar button helper ── */
function Btn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded px-2 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-100"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-6 w-px bg-zinc-200" />;
}

/* ── Main editor component ── */
export function RichTextEditor({ initialHtml }: { initialHtml: string }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none min-h-[60vh] p-6 focus:outline-none",
      },
    },
  });

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    startTransition(async () => {
      await saveLandingContent(html);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }, [editor]);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        editor.chain().focus().setImage({ src: dataUrl }).run();
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [editor],
  );

  const setFontSize = useCallback(
    (size: string) => {
      if (!editor) return;
      if (size === "default") {
        editor.chain().focus().unsetMark("textStyle").run();
      } else {
        editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* ── Toolbar ── */}
      <div className="sticky top-[65px] z-40 flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 rounded-t-lg">
        {/* Undo / Redo */}
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
          disabled={!editor.can().undo()}
        >
          ↩
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
          disabled={!editor.can().redo()}
        >
          ↪
        </Btn>

        <Sep />

        {/* Text style */}
        <Btn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </Btn>
        <Btn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </Btn>
        <Btn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <span className="underline">U</span>
        </Btn>
        <Btn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </Btn>

        <Sep />

        {/* Headings */}
        <Btn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          title="Heading 1"
        >
          H1
        </Btn>
        <Btn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          H2
        </Btn>
        <Btn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          H3
        </Btn>

        <Sep />

        {/* Font size */}
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700"
          onChange={(e) => setFontSize(e.target.value)}
          value="default"
          title="Font size"
        >
          <option value="default">Size</option>
          <option value="12px">Small (12)</option>
          <option value="14px">Normal (14)</option>
          <option value="16px">Medium (16)</option>
          <option value="18px">Large (18)</option>
          <option value="24px">XL (24)</option>
          <option value="32px">XXL (32)</option>
          <option value="48px">Huge (48)</option>
        </select>

        {/* Text color */}
        <div className="relative" title="Text color">
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded border border-zinc-300"
            onInput={(e) =>
              editor
                .chain()
                .focus()
                .setColor((e.target as HTMLInputElement).value)
                .run()
            }
            defaultValue="#000000"
          />
        </div>

        {/* Highlight */}
        <div className="relative" title="Highlight color">
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded border border-zinc-300"
            onInput={(e) =>
              editor
                .chain()
                .focus()
                .toggleHighlight({
                  color: (e.target as HTMLInputElement).value,
                })
                .run()
            }
            defaultValue="#ffff00"
          />
        </div>

        <Sep />

        {/* Alignment */}
        <Btn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align left"
        >
          ≡
        </Btn>
        <Btn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align center"
        >
          ≡
        </Btn>
        <Btn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align right"
        >
          ≡
        </Btn>

        <Sep />

        {/* Lists */}
        <Btn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </Btn>
        <Btn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </Btn>

        <Sep />

        {/* Image */}
        <Btn onClick={() => fileRef.current?.click()} title="Insert image">
          📷 Image
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <Sep />

        {/* Blockquote */}
        <Btn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          &ldquo;&rdquo;
        </Btn>

        {/* Horizontal rule */}
        <Btn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal line"
        >
          ─
        </Btn>

        {/* Save button — right side */}
        <div className="ml-auto flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600 font-medium">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ── Editor content area ── */}
      <EditorContent editor={editor} />
    </div>
  );
}
