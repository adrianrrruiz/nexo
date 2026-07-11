'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PROFILE_AVATAR_BUCKET } from '@/lib/account-image-config'

export default function ProfileAvatarUploader({
  initial,
  imageUrl,
}: {
  initial: string
  imageUrl: string | null
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
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
      })

    if (uploadError) {
      setStatus(uploadError.message)
      setUploading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const { error: updateError } = profile
      ? await supabase
          .from('profiles')
          .update({ avatar_path: path })
          .eq('id', user.id)
      : await supabase.from('profiles').insert({
          id: user.id,
          avatar_path: path,
        })

    if (updateError) setStatus(updateError.message)
    else {
      setStatus('Foto actualizada.')
      router.refresh()
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
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
        onClick={() => inputRef.current?.click()}
        className="group relative h-20 w-20 overflow-hidden rounded-full outline-none transition-transform active:scale-95 disabled:opacity-60"
        aria-label="Cambiar foto de perfil"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-brand-deep text-3xl font-bold text-neutral-950">
            {initial}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? 'Subiendo' : 'Cambiar'}
        </span>
      </button>
      {status && <p className="text-center text-xs text-neutral-500">{status}</p>}
    </div>
  )
}
