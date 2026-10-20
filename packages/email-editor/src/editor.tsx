"use client";

import {
  BubbleMenu,
  EditorContent,
  EditorProvider,
  FloatingMenu,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useRef } from "react";
import { TextMenu } from "./menus/TextMenu";
import { EditorToolbar } from "./menus/EditorToolbar";
import { cn } from "@bytesend/ui/lib/utils";

import { extensions } from "./extensions";
import LinkMenu from "./menus/LinkMenu";
import { Content, Editor as TipTapEditor } from "@tiptap/core";
import { UploadFn } from "./extensions/ImageExtension";

const content = `<h2>Hello World!</h2>

<h3>ByteSend is the best open source email platform.</h3>

<p>Use markdown (<code># </code>, <code>## </code>, <code>### </code>, <code>\`\`</code>, <code>* *</code>, <code>** **</code>) to write your email. </p>
<p>You can <b>Bold</b> text.
You can <i>Italic</i> text.
You can <u>Underline</u> text.
You can <del>Delete</del> text.
You can <code>Code</code> text.
you can change <span style="color: #dc2626;"> color</span> of text. Add <a href="https://bytesend.cloud" target="_blank">link</a> to text
</p>
<br>
You can create ordered list
<ol>
  <li>Ordered list item</li>
  <li>Ordered list item</li>
  <li>Ordered list item</li>
</ol>

<br>
You can create unordered list
<ul>
  <li>Unordered list item</li>
  <li>Unordered list item</li>
  <li>Unordered list item</li>
</ul>

<p></p>
<p>Add code by typing \`\`\` and enter</p>
<pre>
<code>
const bytesend = new ByteSend("bs_12345");

// const bytesend = new ByteSend("bs_12345", "https://bytesend.cloud");

bytesend.emails.send({
  to: "john@doe.com",
  from: "john@doe.com",
  subject: "Hello World!",
  html: "<p>Hello World!</p>",
  text: "Hello World!",
});
</code>
</pre>
`;

export type EditorProps = {
  onUpdate?: (content: TipTapEditor) => void;
  initialContent?: Content;
  variables?: Array<string>;
  uploadImage?: UploadFn;
  variableSuggestionsHelperText?: string;
};

export const Editor: React.FC<EditorProps> = ({
  onUpdate,
  initialContent,
  variables,
  uploadImage,
  variableSuggestionsHelperText,
}) => {
  const menuContainerRef = useRef(null);

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: cn("bytesend-prose w-full"),
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          // prevent default event listeners from firing when slash command is active
          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
            const slashCommand = document.querySelector("#slash-command");
            if (slashCommand) {
              return true;
            }
          }
        },
      },
    },
    extensions: extensions({
      variables,
      uploadImage,
      variableSuggestionsHelperText,
    }),
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
    content: initialContent,
  });

  return (
    <div className="bytesend-editor flex flex-col" ref={menuContainerRef}>
      {editor ? <EditorToolbar editor={editor} /> : null}
      {/* The email sits on a white page at inbox width, whatever the dashboard theme, so it looks like what people receive. */}
      <div className="bg-muted/40 px-2 py-6 sm:px-6 sm:py-10">
        <div className="light mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-sm">
          <EditorContent editor={editor} className="min-h-[55vh] p-5 outline-none sm:p-10" />
        </div>
      </div>
      {editor ? <TextMenu editor={editor} /> : null}
      {editor ? <LinkMenu editor={editor} appendTo={menuContainerRef} /> : null}
    </div>
  );
};
