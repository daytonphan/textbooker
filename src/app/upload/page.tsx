"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClasses =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900";

export default function UploadPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/books", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
        setIsSubmitting(false);
        return;
      }
      router.push(data.tocSource === "none" ? `/books/${data.id}/toc` : `/books/${data.id}`);
    } catch {
      setError("Upload failed — is the dev server still running?");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-4 text-lg font-medium">Upload a textbook</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          PDF file
          <input type="file" name="file" accept="application/pdf" required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input type="text" name="title" required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Course <span className="text-slate-400">(optional)</span>
          <input type="text" name="course" placeholder="Stat 134" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Author <span className="text-slate-400">(optional)</span>
          <input type="text" name="author" className={inputClasses} />
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {isSubmitting ? "Uploading and analyzing…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
