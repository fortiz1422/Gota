import { notFound } from 'next/navigation'
import { OnboardingDesignExamples } from '@/components/_exploration/OnboardingDesignExamples'

export default function OnboardingDesignPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <OnboardingDesignExamples />
}
