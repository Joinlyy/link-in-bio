import { supabase } from './supabase'

const IMAGE_BUCKET = 'creator-images'
const FILE_BUCKET = 'product-files'
const MAX_IMAGE = 5 * 1024 * 1024
const MAX_FILE = 100 * 1024 * 1024

async function userId() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Please sign in again.')
  return data.user.id
}

function extOf(name, fallback) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name || '')
  return (m ? m[1] : fallback).toLowerCase()
}

/**
 * Upload an image to the public `creator-images` bucket (File, Blob or remote URL).
 * Files live under <user id>/<folder>/ so storage policies can enforce ownership.
 */
export async function uploadImage(input, folder = 'pages') {
  let blob = input
  if (typeof input === 'string') {
    const res = await fetch(input)
    if (!res.ok) throw new Error('Could not download that image')
    blob = await res.blob()
  }
  if (!blob.type?.startsWith('image/')) throw new Error('Please choose an image file.')
  if (blob.size > MAX_IMAGE) throw new Error('Images must be smaller than 5 MB.')
  const uid = await userId()
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${extOf(blob.name, blob.type.split('/')[1] || 'jpg')}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    contentType: blob.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm|wmv|flv|3gp|mpeg|mpg)$/i

/**
 * Upload a private product file (PDF, presets, templates, ebooks…). Videos are not allowed.
 * Files live in the page owner's folder so team editors can manage them too.
 */
export async function uploadProductFile(file, productId, ownerId) {
  if (file.type.startsWith('video/') || VIDEO_EXT.test(file.name)) throw new Error('Video files are not supported.')
  if (file.size > MAX_FILE) throw new Error('Files must be smaller than 100 MB.')
  const uid = ownerId || (await userId())
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
  const path = `${uid}/${productId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { file_path: path, file_name: file.name, file_size: file.size }
}

export async function removeProductFile(path) {
  if (path) await supabase.storage.from(FILE_BUCKET).remove([path])
}
