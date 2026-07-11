import { createClient } from '@/lib/supabase/server'
import { ACCOUNT_IMAGE_BUCKET, PROFILE_AVATAR_BUCKET } from '@/lib/account-image-config'

export async function createAccountImageUrlMap(paths: Array<string | null>) {
  const uniquePaths = [...new Set(paths.filter(Boolean))] as string[]
  if (uniquePaths.length === 0) return new Map<string, string>()

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(ACCOUNT_IMAGE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60)

  if (error || !data) return new Map<string, string>()

  const urls = new Map<string, string>()
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  }
  return urls
}

export async function createProfileAvatarUrl(path: string | null) {
  if (!path) return null

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
