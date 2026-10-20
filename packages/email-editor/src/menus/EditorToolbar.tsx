"use client";

import { Editor } from "@tiptap/core";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  SeparatorHorizontalIcon,
  StrikethroughIcon,
  Undo2Icon,
  UnderlineIcon,
  UnlinkIcon,
} from "lucide-react";
import { cn } from "@bytesend/ui/lib/utils";

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  isActive: boolean;
  icon: React.FC<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="sticky top-12 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-3 py-1.5 backdrop-blur sm:px-6">
      {/* Content type */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive("paragraph") && !editor.isActive("orderedList") && !editor.isActive("bulletList")}
        icon={PilcrowIcon}
        label="Paragraph"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        icon={Heading1Icon}
        label="Heading 1"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        icon={Heading2Icon}
        label="Heading 2"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        icon={Heading3Icon}
        label="Heading 3"
      />

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        icon={BoldIcon}
        label="Bold"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        icon={ItalicIcon}
        label="Italic"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        icon={UnderlineIcon}
        label="Underline"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        icon={StrikethroughIcon}
        label="Strikethrough"
      />

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        icon={ListIcon}
        label="Bullet list"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        icon={ListOrderedIcon}
        label="Numbered list"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        icon={ListTodoIcon}
        label="Task list"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        icon={AlignLeftIcon}
        label="Align left"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        icon={AlignCenterIcon}
        label="Align center"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        icon={AlignRightIcon}
        label="Align right"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        icon={QuoteIcon}
        label="Blockquote"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        icon={CodeIcon}
        label="Code block"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        isActive={false}
        icon={SeparatorHorizontalIcon}
        label="Horizontal rule"
      />

      <Divider />

      {/* Link */}
      <ToolbarButton
        onClick={() => {
          const url = window.prompt("Enter URL");
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive("link")}
        icon={LinkIcon}
        label="Link"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
        isActive={false}
        icon={UnlinkIcon}
        label="Remove link"
      />

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        isActive={false}
        icon={Undo2Icon}
        label="Undo"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        isActive={false}
        icon={Redo2Icon}
        label="Redo"
      />
    </div>
  );
}
