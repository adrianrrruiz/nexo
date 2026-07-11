'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ACCOUNT_IMAGE_BUCKET } from '@/lib/account-image-config'

export default function AccountImageUploader({
  accountId,
  children,
}: {
  accountId: string
  children: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  async function upload(file: File) {
    setStatus(null)
    if (!file.type.startsWith('image/')) {
      setStatus('Elige una imagen.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setStatus('Máximo 3 MB.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setStatus('Sesión expirada.')
      setUploading(false)
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${accountId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(ACCOUNT_IMAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
      })

    if (uploadError) {
      setStatus(uploadError.message)
      setUploading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ image_path: path })
      .eq('id', accountId)

    if (updateError) setStatus(updateError.message)
    else {
      setStatus('Foto actualizada.')
      router.refresh()
    }
    setUploading(false)
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.currentTarget.value = ''
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          inputRef.current?.click()
        }}
        className="group relative rounded-2xl outline-none transition-transform active:scale-95 disabled:opacity-60"
        aria-label="Cambiar foto de cuenta"
      >
        {children}
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 px-1 text-center text-[9px] font-semibold leading-tight text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? 'Subiendo' : 'Cambiar'}
        </span>
      </button>
      {status && <p className="max-w-24 text-center text-[10px] text-neutral-500">{status}</p>}
    </div>
  )
}
