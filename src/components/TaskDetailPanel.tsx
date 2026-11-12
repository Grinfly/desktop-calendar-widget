import { invoke } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";

import { formatDayTitle } from "../lib/dates";
import {
  isTaskImage, keepLinkedNoteImages, MAX_TASK_IMAGE_BYTES, noteImageNumbers, noteWithImageLinks, removeNoteImageLink,
  splitNoteImageLinks, taskImageLink,
} from "../lib/taskImages";
import type { Task, TaskDetailUpdate } from "../lib/types";

interface TaskDetailPanelProps {
  task: Task;
  dateKey?: string;
  subTitle?: string;
  onRename: (title: string) => void;
  onDetailsChange: (update: TaskDetailUpdate) => void;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TaskDetailPanel({
  task,
  dateKey,
  subTitle,
  onRename,
  onDetailsChange,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [imageError, setImageError] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const openingPreview = useRef(false);
  const noteEditor = useRef<HTMLTextAreaElement>(null);
  const noteCaret = useRef(0);
  const imageStrip = useRef<HTMLUListElement>(null);
  const images = task.noteImages ?? [];
  const displayedNote = noteWithImageLinks(task.note ?? "", images.length);
  const draftLinks = editingNote ? noteImageNumbers(note) : null;
  const thumbnails = images.map((src, index) => ({ src, index }))
    .filter(({ index }) => !draftLinks || draftLinks.has(index + 1));
  const hasThumbnails = thumbnails.length > 0;

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    setNote(task.note ?? "");
  }, [task.note, task.noteImages]);

  useEffect(() => {
    const strip = imageStrip.current;
    if (!strip) return;
    const scrollImages = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        strip.scrollWidth <= strip.clientWidth) return;
      event.preventDefault();
      strip.scrollLeft += event.deltaY * unit;
    };
    strip.addEventListener("wheel", scrollImages, { passive: false });
    return () => strip.removeEventListener("wheel", scrollImages);
  }, [hasThumbnails]);

  useLayoutEffect(() => {
    if (editingNote) {
      noteEditor.current?.setSelectionRange(noteCaret.current, noteCaret.current);
    }
  }, [editingNote]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      onRename(trimmed);
    } else {
      setTitle(task.title);
    }
  };

  const commitNote = () => {
    setEditingNote(false);
    if (note !== displayedNote) {
      onDetailsChange(({ noteImages = [] }) => keepLinkedNoteImages(note, noteImages));
    }
  };

  const pasteImages = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!files.length) return;
    event.preventDefault();
    setImageError("");
    const editor = event.currentTarget;
    const { value, selectionStart, selectionEnd } = editor;

    const results = await Promise.allSettled(files.map(async (file) => {
      if (file.size > MAX_TASK_IMAGE_BYTES) throw new Error("单张图片不能超过 5 MB");
      const image = await readImage(file);
      if (!isTaskImage(image)) throw new Error("不支持此图片格式");
      return image;
    }));
    const pasted = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) {
      setImageError(failure.reason instanceof Error ? failure.reason.message : "无法读取剪贴板图片");
    }
    if (pasted.length) {
      const currentDraft = editor.isConnected ? editor.value : null;
      const start = currentDraft === value ? selectionStart : editor.selectionStart;
      const end = currentDraft === value ? selectionEnd : editor.selectionEnd;
      onDetailsChange(({ note: savedNote, noteImages = [] }) => {
        const text = currentDraft ?? noteWithImageLinks(savedNote, noteImages.length);
        const from = currentDraft !== null ? start : text === value ? selectionStart : text.length;
        const to = currentDraft !== null ? end : text === value ? selectionEnd : text.length;
        const links = pasted.map((_, index) => taskImageLink(noteImages.length + index + 1)).join(" ");
        return keepLinkedNoteImages(text.slice(0, from) + links + text.slice(to), [...noteImages, ...pasted]);
      });
      setEditingNote(false);
    }
  };

  const openPreview = async (index: number, gallery = images) => {
    if (openingPreview.current) return;
    openingPreview.current = true;
    setImageError("");
    try {
      const selected = new Image();
      selected.src = gallery[index];
      await selected.decode();
      await invoke("open_task_image_preview", {
        images: gallery,
        index,
        imageWidth: selected.naturalWidth,
        imageHeight: selected.naturalHeight,
      });
    } catch (error) {
      console.error("打开图片预览失败", error);
      setImageError("无法打开图片预览");
    } finally {
      openingPreview.current = false;
    }
  };

  const removeImage = (index: number) => {
    const text = editingNote ? note : displayedNote;
    setEditingNote(false);
    onDetailsChange(({ noteImages = [] }) => keepLinkedNoteImages(
      removeNoteImageLink(text, index + 1, noteImages.length),
      noteImages.filter((_, i) => i !== index),
    ));
  };

  const startEditing = (caret = displayedNote.length) => {
    noteCaret.current = caret;
    setNote(displayedNote);
    setEditingNote(true);
  };

  const dayTitle = subTitle === undefined && dateKey ? formatDayTitle(dateKey) : null;

  return (
    <section className="task-detail-panel" aria-label="待办详情">
      <div className="task-detail-label-row">
        <label className="task-detail-label" htmlFor="task-detail-title-input">
          标题
        </label>
        <span className="task-detail-date">
          {dayTitle ? (
            <>
              {dayTitle.day}
              <span className="task-date-weekday"> {dayTitle.weekday}</span>
            </>
          ) : subTitle ?? "长期待办"}
        </span>
      </div>
      <input
        id="task-detail-title-input"
        className="task-detail-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />

      <div className="task-detail-label-row">
        <label className="task-detail-label" htmlFor="task-detail-note-input">
          备注
        </label>
        <span className="task-detail-date" id="task-detail-paste-hint">Ctrl+V 粘贴图片</span>
      </div>
      {editingNote || !images.length ? (
        <textarea
          ref={noteEditor}
          id="task-detail-note-input"
          className="task-detail-textarea"
          value={note}
          placeholder="添加备注..."
          aria-describedby="task-detail-paste-hint"
          rows={5}
          autoFocus={editingNote}
          onChange={(event) => setNote(event.target.value)}
          onBlur={commitNote}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.currentTarget.blur();
            }
          }}
          onPaste={pasteImages}
        />
      ) : (
        <div
          className="task-detail-textarea task-detail-note-content"
          aria-label="备注，按 Enter 编辑"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && event.key === "Enter") {
              event.preventDefault();
              startEditing();
            }
          }}
          onClick={(event) => {
            const content = event.currentTarget;
            const position = document.caretPositionFromPoint?.(event.clientX, event.clientY);
            if (!position || !content.contains(position.offsetNode)) {
              startEditing();
              return;
            }
            const range = document.createRange();
            range.selectNodeContents(content);
            range.setEnd(position.offsetNode, position.offset);
            startEditing(range.toString().length);
          }}
        >
          {splitNoteImageLinks(displayedNote, images.length)
            .map((part, index) => typeof part === "number" ? (
              <button
                key={index}
                type="button"
                className="task-detail-image-link"
                onClick={(event) => {
                  event.stopPropagation();
                  void openPreview(part - 1);
                }}
              >
                {taskImageLink(part)}
              </button>
            ) : part)}
        </div>
      )}
      {imageError && <span className="task-detail-image-error" role="status">{imageError}</span>}
      {hasThumbnails && (
        <ul
          className="task-detail-images"
          aria-label="备注图片"
          ref={imageStrip}
          onMouseDown={(event) => {
            // Keep draft indices stable until the clicked thumbnail action runs.
            if (editingNote && event.button === 0 && (event.target as Element).closest("button")) {
              event.preventDefault();
            }
          }}
        >
          {thumbnails.map(({ src, index }, galleryIndex) => (
            <li className="task-detail-image" key={index}>
              <button
                type="button"
                className="task-detail-image-thumb"
                aria-label={`放大查看图片 ${index + 1}`}
                onClick={() => {
                  noteEditor.current?.blur();
                  void openPreview(galleryIndex, thumbnails.map(({ src }) => src));
                }}
              >
                <img src={src} alt="" />
              </button>
              <button
                type="button"
                className="task-detail-image-remove"
                aria-label={`移除图片 ${index + 1}`}
                onClick={() => removeImage(index)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
