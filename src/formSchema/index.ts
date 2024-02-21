import * as z from 'zod'

export const tagOptionSchema = z.object({
  label: z.string().trim().min(1, {message: 'Label cannot be empty'}),
  value: z.string().trim().min(1, {message: 'Value cannot be empty'})
})

//TODO: improve this not to use the library name as z. and also, this should be wrapped with util
export const assetFormSchema = z.object({
  alt: z.string().trim().optional(),
  description: z.string().trim().optional(),
  opt: z.object({
    media: z.object({
      tags: z.array(tagOptionSchema).nullable()
    })
  }),
  originalFilename: z.string().trim().min(1, {message: 'Filename cannot be empty'}),
  title: z.string().trim().optional(),
  attribution: z.string().trim().optional()
})

export const tagFormSchema = z.object({
  name: z.string().min(1, {message: 'Name cannot be empty'})
})
