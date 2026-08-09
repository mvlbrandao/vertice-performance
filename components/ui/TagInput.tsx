"use client";

import { useState, type KeyboardEvent } from "react";

const POSITION_SUGGESTIONS = [
  "Goleiro",
  "Fixo",
  "Ala",
  "Pivô",
  "Zagueiro",
  "Lateral",
  "Volante",
  "Meia",
  "Atacante",
];

export function TagInput({
  name,
  defaultValue = [],
  value: controlledValue,
  onChange,
  placeholder,
  suggestions = POSITION_SUGGESTIONS,
}: {
  name: string;
  defaultValue?: string[];
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [internalTags, setInternalTags] = useState<string[]>(defaultValue);
  const tags = controlledValue ?? internalTags;
  const setTags = (updater: (prev: string[]) => string[]) => {
    const next = updater(tags);
    if (onChange) onChange(next);
    else setInternalTags(next);
  };
  const [inputValue, setInputValue] = useState("");

  function addTag(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setInputValue("");
  }

  function removeTag(value: string) {
    setTags((prev) => prev.filter((t) => t !== value));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  const listId = `${name}-suggestions`;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 border border-line rounded-sm bg-white focus-within:outline focus-within:outline-2 focus-within:outline-amber focus-within:outline-offset-1 focus-within:border-amber">
      {tags.map((t) => (
        <input key={t} type="hidden" name={name} value={t} />
      ))}
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 bg-chalk border border-line rounded-full pl-2.5 pr-1.5 py-0.5 text-xs font-semibold"
        >
          {t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            className="text-ink-faint hover:text-clay leading-none"
            aria-label={`Remover ${t}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] text-sm outline-none py-0.5"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
