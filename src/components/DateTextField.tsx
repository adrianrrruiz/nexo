'use client'

import { useRef } from 'react'
import { formatLongDate } from '@/lib/format'

export default function DateTextField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => {
          if (inputRef.current?.showPicker) inputRef.current.showPicker()
          else inputRef.current?.click()
        }}
        className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.05] px-4 py-3.5 text-left text-base text-neutral-100 outline-none transition-colors focus:border-brand/60"
      >
        <span className="capitalize">{formatLongDate(value)}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 3v3M17 3v3" />
          <rect x="4" y="5" width="16" height="16" rx="3" />
          <path d="M4 10h16" />
        </svg>
      </button>
    </div>
  )
}
