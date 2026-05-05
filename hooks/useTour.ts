import { useContext } from 'react'
import { TourContext } from '@/components/tour/TourProvider'

export function useTour() {
  return useContext(TourContext)
}
