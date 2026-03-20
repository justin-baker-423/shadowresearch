'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const password = formData.get('password') as string

  if (password === process.env.PERF_PASSWORD) {
    cookies().set('perf_auth', process.env.PERF_SECRET!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    redirect('/performance')
  }

  return { error: 'Incorrect password' }
}
